from unittest.mock import patch

from django.contrib.auth.hashers import make_password
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient, APITestCase
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle

from backend_api.models import (
    Coordinators,
    Customers,
    Technicians,
    TechnicianHiringApplication,
)
from backend_api.tests.helpers import auth_client_as

# Valid 1x1 red-pixel PNG (verified with Pillow)
TINY_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01"
    b"\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00"
    b"\x00\x00\x0cIDATx\x9cc\xf8\xcf\xc0\x00\x00\x03\x01"
    b"\x01\x00\xc9\xfe\x92\xef\x00\x00\x00\x00IEND\xaeB`\x82"
)


def _img(name="file.png"):
    return SimpleUploadedFile(name, TINY_PNG, content_type="image/png")


@patch(
    "backend_api.views.hiring_views.geo.get_location_from_postal",
    return_value="1.3521,103.8198",
)
class HiringApplicationAPITests(APITestCase):
    def setUp(self):
        AnonRateThrottle.THROTTLE_RATES = {"anon": "1000/minute"}
        UserRateThrottle.THROTTLE_RATES = {"user": "1000/minute"}
        self.client = APIClient()
        self.base_url = "/api/hiring-applications/"

        self.coordinator = Coordinators.objects.create(
            coordinatorName="Admin Coord",
            coordinatorEmail="coord@example.com",
            coordinatorPhone="81234567",
            coordinatorPassword=make_password("coordpass"),
        )

        # Customer used for auth token
        self.customer = Customers.objects.create(
            customerName="Auth Customer",
            customerPostalCode="123456",
            customerAddress="1 Auth Street",
            customerPhone="91234567",
            customerEmail="auth@example.com",
            customerPassword=make_password("pass1234"),
            customerLocation="1.3521,103.8198",
        )

        self.valid_payload = {
            "applicantName": "John Doe",
            "nric": "S1234567A",
            "citizenship": "Singaporean",
            "applicantAddress": "10 Test Lane",
            "applicantPostalCode": "123456",
            "applicantPhone": "98765432",
            "applicantEmail": "john@example.com",
            "workExperience": "5 years HVAC",
            "race": "Chinese",
            "languagesSpoken": "English,Mandarin",
            "nextOfKinName": "Jane Doe",
            "nextOfKinContact": "87654321",
            "nextOfKinRelationship": "Spouse",
            "specializations": '["Daikin","Mitsubishi"]',
        }

    # ── helpers ────────────────────────────────────────────────────────
    def _auth(self):
        auth_client_as(self.client, self.coordinator, "coordinator")

    def _post_valid(self, nric="S1234567A", phone="98765432", email="john@example.com"):
        data = {
            **self.valid_payload,
            "nric": nric,
            "applicantPhone": phone,
            "applicantEmail": email,
            "nricPhotoFront": _img("front.png"),
            "nricPhotoBack": _img("back.png"),
            "drivingLicense": _img("license.png"),
        }
        return self.client.post(self.base_url, data, format="multipart")

    def _create_application_in_db(self, nric="S9999999Z", phone="99999999"):
        return TechnicianHiringApplication.objects.create(
            applicantName="DB App",
            nric=nric,
            citizenship="PR",
            applicantAddress="99 DB Lane",
            applicantPostalCode="999999",
            applicantPhone=phone,
            applicantEmail=f"{nric}@example.com",
            workExperience="3 years",
            race="Malay",
            languagesSpoken="English",
            nextOfKinName="Kin",
            nextOfKinContact="88888888",
            nextOfKinRelationship="Sibling",
        )

    # ── 1. Create with valid data → 201 ───────────────────────────────
    def test_create_application_valid(self, mock_geo):
        resp = self._post_valid()
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["applicantName"], "John Doe")
        self.assertEqual(resp.data["applicationStatus"], "personal_details")
        self.assertTrue(
            TechnicianHiringApplication.objects.filter(nric="S1234567A").exists()
        )

    # ── 2. Missing NRIC front photo → 201 (file validation relaxed for cloud) ─
    def test_create_missing_nric_front(self, mock_geo):
        data = {
            **self.valid_payload,
            "nricPhotoBack": _img("back.png"),
            "drivingLicense": _img("license.png"),
        }
        resp = self.client.post(self.base_url, data, format="multipart")
        self.assertEqual(resp.status_code, 201)

    # ── 3. Missing NRIC back photo → 201 (file validation relaxed for cloud) ─
    def test_create_missing_nric_back(self, mock_geo):
        data = {
            **self.valid_payload,
            "nric": "S2234567B",
            "applicantPhone": "98765433",
            "applicantEmail": "john2@example.com",
            "nricPhotoFront": _img("front.png"),
            "drivingLicense": _img("license.png"),
        }
        resp = self.client.post(self.base_url, data, format="multipart")
        self.assertEqual(resp.status_code, 201)

    # ── 4. Missing driving license → 201 (file validation relaxed for cloud) ─
    def test_create_missing_driving_license(self, mock_geo):
        data = {
            **self.valid_payload,
            "nric": "S3234567C",
            "applicantPhone": "98765434",
            "applicantEmail": "john3@example.com",
            "nricPhotoFront": _img("front.png"),
            "nricPhotoBack": _img("back.png"),
        }
        resp = self.client.post(self.base_url, data, format="multipart")
        self.assertEqual(resp.status_code, 201)

    # ── 5. Duplicate NRIC → 400 ──────────────────────────────────────
    def test_create_duplicate_nric(self, mock_geo):
        self._post_valid(nric="S1234567A", phone="98765432", email="first@example.com")
        resp = self._post_valid(
            nric="S1234567A", phone="11112222", email="second@example.com"
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("nric", str(resp.data).lower())

    # ── 6. Invalid NRIC format → 400 ─────────────────────────────────
    def test_create_invalid_nric_format(self, mock_geo):
        data = {
            **self.valid_payload,
            "nric": "INVALID",
            "nricPhotoFront": _img(),
            "nricPhotoBack": _img(),
            "drivingLicense": _img(),
        }
        resp = self.client.post(self.base_url, data, format="multipart")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("nric", str(resp.data).lower())

    # ── 7. List applications → 200 ───────────────────────────────────
    def test_list_applications(self, mock_geo):
        self._auth()
        self._create_application_in_db(nric="S1111111A")
        self._create_application_in_db(nric="S2222222B", phone="77777777")
        resp = self.client.get(self.base_url)
        self.assertEqual(resp.status_code, 200)
        self.assertIsInstance(resp.data, list)
        self.assertEqual(len(resp.data), 2)

    # ── 8. List filtered by applicationStatus → 200 ──────────────────
    def test_list_filtered_by_status(self, mock_geo):
        self._auth()
        app1 = self._create_application_in_db(nric="S1111111A")
        app2 = self._create_application_in_db(nric="S2222222B", phone="77777777")
        app2.applicationStatus = "bank_info"
        app2.save()
        resp = self.client.get(self.base_url, {"applicationStatus": "personal_details"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]["nric"], "S1111111A")

    # ── 9. List filtered by applicantName → 200 ──────────────────────
    def test_list_filtered_by_name(self, mock_geo):
        self._auth()
        self._create_application_in_db(nric="S1111111A")
        resp = self.client.get(self.base_url, {"applicantName": "DB"})
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)

    # ── 10. Retrieve single → 200 ────────────────────────────────────
    def test_retrieve_application(self, mock_geo):
        self._auth()
        app = self._create_application_in_db(nric="S1111111A")
        resp = self.client.get(f"{self.base_url}{app.id}/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["nric"], "S1111111A")

    # ── 11. Partial update → 200 ─────────────────────────────────────
    def test_partial_update(self, mock_geo):
        self._auth()
        app = self._create_application_in_db(nric="S1111111A")
        resp = self.client.patch(
            f"{self.base_url}{app.id}/",
            {"applicantName": "Updated Name"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["applicantName"], "Updated Name")

    # ── 12. Delete → 204 ─────────────────────────────────────────────
    def test_delete_application(self, mock_geo):
        self._auth()
        app = self._create_application_in_db(nric="S1111111A")
        resp = self.client.delete(f"{self.base_url}{app.id}/")
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(TechnicianHiringApplication.objects.filter(id=app.id).exists())

    # ── 13. Confirm personal details (Stage 1 → Stage 2) → 200 ──────
    def test_confirm_personal_details(self, mock_geo):
        app = self._create_application_in_db(nric="S1111111A")
        resp = self.client.post(f"{self.base_url}{app.id}/confirm-personal-details/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["applicationStatus"], "bank_info")
        app.refresh_from_db()
        self.assertTrue(app.personalDetailsConfirmed)

    # ── 14. Submit bank info (Stage 2 → Stage 3) → 200 ──────────────
    def test_submit_bank_info(self, mock_geo):
        app = self._create_application_in_db(nric="S1111111A")
        app.personalDetailsConfirmed = True
        app.save()
        resp = self.client.post(
            f"{self.base_url}{app.id}/submit-bank-info/",
            {
                "bankName": "DBS",
                "bankAccountNumber": "1234567890",
                "bankAccountHolderName": "DB App",
                "bankInfoConfirmed": True,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["applicationStatus"], "coordinator_review")
        app.refresh_from_db()
        self.assertTrue(app.bankInfoConfirmed)

    # ── 15. Submit bank info without personal details confirmed → 400 ─
    def test_submit_bank_info_without_personal_details(self, mock_geo):
        app = self._create_application_in_db(nric="S1111111A")
        resp = self.client.post(
            f"{self.base_url}{app.id}/submit-bank-info/",
            {"bankName": "DBS"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Personal details must be confirmed", str(resp.data))

    # ── 16. Coordinator approve (Stage 3) → 200 ─────────────────────
    def test_coordinator_approve(self, mock_geo):
        self._auth()
        app = self._create_application_in_db(nric="S1111111A")
        app.personalDetailsConfirmed = True
        app.bankInfoConfirmed = True
        app.applicationStatus = "coordinator_review"
        app.specializations = ["Daikin", "Mitsubishi"]
        app.save()

        resp = self.client.post(
            f"{self.base_url}{app.id}/coordinator-approve/",
            {
                "coordinatorId": str(self.coordinator.id),
                "coordinatorApproved": True,
                "payRate": "25.00",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        app.refresh_from_db()
        self.assertEqual(app.applicationStatus, "approved")
        self.assertIsNotNone(app.createdTechnician)

        # Verify technician was created with correct fields
        tech = app.createdTechnician
        self.assertEqual(tech.technicianName, app.applicantName)
        self.assertEqual(tech.technicianPhone, app.applicantPhone)
        self.assertEqual(tech.technicianPostalCode, app.applicantPostalCode)
        self.assertEqual(tech.technicianAddress, app.applicantAddress)
        self.assertEqual(tech.specializations, ["Daikin", "Mitsubishi"])
        self.assertEqual(tech.technicianStatus, "1")

        # Response includes temporary password and technician ID
        self.assertIn("technicianId", resp.data)
        self.assertIn("temporaryPassword", resp.data)

    # ── 17. Coordinator approve without bank info → 400 ──────────────
    def test_coordinator_approve_without_bank_info(self, mock_geo):
        self._auth()
        app = self._create_application_in_db(nric="S1111111A")
        app.personalDetailsConfirmed = True
        app.save()
        resp = self.client.post(
            f"{self.base_url}{app.id}/coordinator-approve/",
            {"coordinatorApproved": True},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Bank information must be confirmed", str(resp.data))

    # ── 18. Coordinator approve without coordinatorApproved=True → 400
    def test_coordinator_approve_without_flag(self, mock_geo):
        self._auth()
        app = self._create_application_in_db(nric="S1111111A")
        app.personalDetailsConfirmed = True
        app.bankInfoConfirmed = True
        app.save()
        resp = self.client.post(
            f"{self.base_url}{app.id}/coordinator-approve/",
            {"coordinatorId": str(self.coordinator.id)},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Coordinator must confirm approval", str(resp.data))

    # ── 19. Coordinator reject → 200 ─────────────────────────────────
    def test_coordinator_reject(self, mock_geo):
        self._auth()
        app = self._create_application_in_db(nric="S1111111A")
        app.personalDetailsConfirmed = True
        app.bankInfoConfirmed = True
        app.save()
        resp = self.client.post(
            f"{self.base_url}{app.id}/coordinator-reject/",
            {
                "coordinatorId": str(self.coordinator.id),
                "coordinatorNotes": "Failed background check",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        app.refresh_from_db()
        self.assertEqual(app.applicationStatus, "rejected")
        self.assertEqual(app.coordinatorNotes, "Failed background check")

    # ── 20. Create and confirm-personal-details are AllowAny ─────────
    def test_create_is_allow_any(self, mock_geo):
        client = APIClient()  # unauthenticated
        resp = client.post(
            self.base_url,
            {
                **self.valid_payload,
                "nricPhotoFront": _img(),
                "nricPhotoBack": _img(),
                "drivingLicense": _img(),
            },
            format="multipart",
        )
        self.assertEqual(resp.status_code, 201)

    def test_confirm_personal_details_is_allow_any(self, mock_geo):
        app = self._create_application_in_db(nric="S1111111A")
        client = APIClient()
        resp = client.post(f"{self.base_url}{app.id}/confirm-personal-details/")
        self.assertEqual(resp.status_code, 200)

    # ── 21. submit-bank-info is AllowAny ─────────────────────────────
    def test_submit_bank_info_is_allow_any(self, mock_geo):
        app = self._create_application_in_db(nric="S1111111A")
        app.personalDetailsConfirmed = True
        app.save()
        client = APIClient()
        resp = client.post(
            f"{self.base_url}{app.id}/submit-bank-info/",
            {"bankName": "OCBC", "bankInfoConfirmed": True},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)

    # ── 22. coordinator-approve requires auth ─────────────────────────
    def test_coordinator_approve_requires_auth(self, mock_geo):
        app = self._create_application_in_db(nric="S1111111A")
        app.personalDetailsConfirmed = True
        app.bankInfoConfirmed = True
        app.save()
        client = APIClient()
        resp = client.post(
            f"{self.base_url}{app.id}/coordinator-approve/",
            {"coordinatorApproved": True},
            format="json",
        )
        self.assertEqual(resp.status_code, 401)
