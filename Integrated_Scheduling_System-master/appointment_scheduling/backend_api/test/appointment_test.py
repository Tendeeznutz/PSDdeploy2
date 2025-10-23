import unittest

import requests

customer_id = "678d4693-f1ca-40cc-ad3b-4aad70435ae9"
customer_aircon = ["552176a6-8ce8-43a0-8c6f-e652b5085076"]


class AppointmentTest(unittest.TestCase):

    def setUp(self):
        self.url = "https://integrated-scheduling.eastasia.cloudapp.azure.com/api/appointments/"
        self.headers = {'Content-Type': 'application/json'}

    # Test Case 1: Get unavailable timeslots for a customer
    def test_unavailable(self):
        response = requests.get(self.url + "unavailable/?customerId=" + customer_id)
        response_json = response.json()
        print(response_json)
        self.nearby_technicians = response_json['nearby_technicians']
        self.assertEqual(response.status_code, 200)

    # Test Case 2: Book an appointment
    def test_book(self):
        self.test_unavailable()
        data = {
            "customerId": customer_id,
            "appointmentStartTime": 1711908261,
            "nearby_technicians": self.nearby_technicians,
            "airconToService": customer_aircon
        }
        response = requests.post(self.url, headers=self.headers, json=data)
        print(response.json())
        self.assertEqual(response.status_code, 201)

    # Test Case 3: Get all appointments
    def test_get_all_appointments(self):
        response = requests.get(self.url)
        for appointment in response.json():
            for key in appointment:
                print(key, ":", appointment[key])
            print("\n")

        self.assertEqual(response.status_code, 200)

    # Test Case 4: Get appointment by id
    def test_get_appointment_by_id(self):
        response = requests.get(self.url + "?customerName=ri")
        for appt in response.json():
            for key in appt:
                print(key, ":", appt[key])
            print("\n")
        self.assertEqual(response.status_code, 200)

    # Test Case 5: update appointmnt by id, change date
    def test_update_appointment_by_id(self):
        self.test_unavailable()
        self.appointment_id = "464a47a70c6f436dbd02a59a904648ee"
        data = {
            "appointmentStartTime": 1806880335,
            "nearby_technicians": self.nearby_technicians,
            "airconToService": customer_aircon
        }
        response = requests.patch(self.url + str(self.appointment_id) + "/", headers=self.headers, json=data)
        print(response.json())
        self.assertEqual(response.status_code, 200)

    # Test Case 6: change aircon to service
    def test_change_aircon(self):
        self.test_unavailable()
        self.appointment_id = "464a47a70c6f436dbd02a59a904648ee"
        data = {
            "airconToService": ["7a6cba4c4f9848e99d3280308e4b0ae6"]
        }
        response = requests.patch(self.url + str(self.appointment_id) + "/", headers=self.headers, json=data)
        print(response.json())
        self.assertEqual(response.status_code, 200)

    # Test Case 7: coordinator update appointment
    def test_coordinator_update_appointment(self):
        self.appointment_id = "464a47a70c6f436dbd02a59a904648ee"
        data = {
            "appointmentStatus": '1',
            "technicianId": None
        }
        response = requests.put(self.url + str(self.appointment_id) + "/", headers=self.headers, json=data)
        print(response.json())
        self.assertEqual(response.status_code, 200)