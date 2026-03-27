from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import models, transaction
from django.contrib.auth.hashers import make_password
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
import logging
import uuid

SGT = ZoneInfo("Asia/Singapore")

logger = logging.getLogger(__name__)

from .format_response import include_all_info, prefetch_related_data
from ..scheduling_algo import *
from ..sg_geo.src import geo_onemap
from ..models import (
    Appointments,
    Customers,
    Technicians,
    CustomerAirconDevices,
    Messages,
    AppointmentRating,
)
from ..serializers import AppointmentSerializer
from ..utils import sendMail
from ..utils.notifications import (
    send_appointment_confirmation,
    send_appointment_cancellation,
    send_penalty_notification_telegram,
)
from ..penalty_utils import (
    check_and_apply_penalty,
    get_penalty_summary,
    CANCELLATION_THRESHOLD,
)

# Pricing constants (matching frontend)
SERVICE_COST_PER_AIRCON = 50  # $50 per aircon serviced


def extract_aircon_brand(aircon_to_service):
    """
    Extract the aircon brand from a list of CustomerAirconDevice IDs.
    Returns the brand of the first device, or None if not determinable.
    """
    if not aircon_to_service:
        return None
    try:
        device = CustomerAirconDevices.objects.get(id=aircon_to_service[0])
        # Try catalog first
        if device.airconCatalogId:
            return device.airconCatalogId.airconBrand
        # Use airconType field (e.g., 'daikin' -> 'Daikin')
        if device.airconType and device.airconType != "other":
            return device.get_airconType_display()
        # Parse from airconName (format: "Brand - Model (Booking ...)")
        if device.airconName and " - " in device.airconName:
            return device.airconName.split(" - ")[0].strip()
    except CustomerAirconDevices.DoesNotExist:
        pass
    return None


TRAVEL_FEE = 10  # $10 standard travel fee


class GuestBookingThrottle(AnonRateThrottle):
    scope = "guest_booking"
    rate = "10/minute"


class AppointmentViewSet(viewsets.ModelViewSet):
    queryset = Appointments.objects.select_related("customerId", "technicianId").all()
    serializer_class = AppointmentSerializer

    def get_permissions(self):
        if self.action == "guest_booking":
            return [AllowAny()]
        return [IsAuthenticated()]

    def _role(self, request):
        role = (
            getattr(request.auth, "payload", {}).get("role") if request.auth else None
        )
        return role or getattr(request.user, "role", None)

    def _require_role(self, request, allowed_roles):
        return self._role(request) in allowed_roles

    def _get_user_id(self, request):
        user_id = (
            getattr(request.auth, "payload", {}).get("user_id")
            if request.auth
            else None
        )
        if user_id is None:
            user_id = getattr(request.user, "id", None) or getattr(
                request.user, "pk", None
            )
        return str(user_id) if user_id is not None else None

    def get_queryset(self):
        qs = Appointments.objects.select_related("customerId", "technicianId")
        request = getattr(self, "request", None)
        if request is None:
            return qs

        role = self._role(request)
        user_id = self._get_user_id(request)

        if role == "customer" and user_id:
            return qs.filter(customerId=user_id)
        if role == "technician" and user_id:
            return qs.filter(technicianId=user_id)
        if role == "coordinator":
            return qs
        return qs.none()

    def send_receipt_to_mailbox(self, appointment, customer, aircon_ids):
        """
        Generate and send a receipt message to the customer's mailbox
        """
        try:
            # Get aircon details
            aircon_devices = CustomerAirconDevices.objects.filter(id__in=aircon_ids)
            aircon_names = [device.airconName for device in aircon_devices]
            num_aircons = sum(device.numberOfUnits for device in aircon_devices)

            # Calculate costs
            service_cost = num_aircons * SERVICE_COST_PER_AIRCON
            total_cost = service_cost + TRAVEL_FEE

            # Add penalty fee if any
            penalty_fee = customer.pendingPenaltyFee
            total_cost_with_penalty = total_cost + float(penalty_fee)

            # Format appointment time
            appointment_time = datetime.fromtimestamp(
                appointment.appointmentStartTime, tz=SGT
            )
            formatted_time = appointment_time.strftime("%B %d, %Y at %I:%M %p")

            # Get payment method display name
            payment_methods = {
                "cash": "Cash",
                "cheque": "Cheque",
                "card": "Credit/Debit Card",
                "bank_transfer": "Bank Transfer",
                "paynow": "PayLah/PayNow",
            }
            payment_display = payment_methods.get(
                appointment.paymentMethod, appointment.paymentMethod
            )

            # Create receipt body
            receipt_body = f"""
Dear {customer.customerName},

Thank you for booking an appointment with AirServe!

============================================
           APPOINTMENT RECEIPT
============================================

Booking Reference: {str(appointment.id)[:8].upper()}
Date & Time: {formatted_time}

--------------------------------------------
SERVICE DETAILS
--------------------------------------------
Aircon Units to be Serviced:
"""
            for i, name in enumerate(aircon_names, 1):
                receipt_body += f"  {i}. {name}\n"

            receipt_body += f"""
--------------------------------------------
COST BREAKDOWN
--------------------------------------------
Service Fee ({num_aircons} aircon{"s" if num_aircons > 1 else ""} x ${SERVICE_COST_PER_AIRCON}):    ${service_cost}.00
Travel Fee:                            ${TRAVEL_FEE}.00"""

            if penalty_fee > 0:
                receipt_body += f"""
Penalty Fee (Cancellations):          ${penalty_fee}"""

            receipt_body += f"""
--------------------------------------------
TOTAL AMOUNT:                          ${total_cost_with_penalty:.2f}
--------------------------------------------

Payment Method: {payment_display}

--------------------------------------------
SERVICE ADDRESS
--------------------------------------------
{customer.customerAddress}
Singapore {customer.customerPostalCode}

============================================

If you have any questions or need to make changes to your appointment, please contact us or visit your dashboard.

Thank you for choosing AirServe!

Best regards,
AirServe Team
"""

            # Create message in mailbox
            Messages.objects.create(
                senderType="coordinator",
                senderId="00000000-0000-0000-0000-000000000000",  # System sender
                senderName="AirServe System",
                recipientType="customer",
                recipientId=customer.id,
                recipientName=customer.customerName,
                subject=f"Appointment Receipt - Booking #{str(appointment.id)[:8].upper()}",
                body=receipt_body,
                isRead=False,
                relatedAppointment=appointment,
            )

        except Exception as e:
            logger.exception("Failed to send receipt to mailbox: %s", e)

    def check_monthly_cancellation_limit(self, technician_id):
        """
        Check if technician has reached monthly cancellation limit (3 per month)
        Returns (is_allowed, count) tuple
        """
        # Get the first day of current month
        now = timezone.now()
        first_day_of_month = now.replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        )

        # Count cancellations by this technician in current month
        cancellation_count = Appointments.objects.filter(
            appointmentStatus="4",  # Cancelled status
            cancelledBy="technician",
            technicianId=technician_id,
            cancelledAt__gte=first_day_of_month,
        ).count()

        return (cancellation_count < 3, cancellation_count)

    @action(detail=False, methods=["get"], url_path="unavailable")
    def unavailable(self, request, *args, **kwargs):
        # check if request contains customer id
        customer_id = request.query_params.get("customerId", None)
        if customer_id is None:
            return Response(status=400)
        else:
            nearby_technicians = get_nearby_technicians(customer_id)
            data_dict = {
                "nearby_technicians": nearby_technicians,
                "unavailable_timeslots": get_common_unavailable_time(
                    nearby_technicians
                ),
            }
        return Response(data_dict, status=200)

    # GET request
    def list(self, request, *args, **kwargs):
        query_params = request.query_params
        base_qs = self.get_queryset()

        if "customerId" in query_params:
            qs = base_qs.filter(customerId__id__icontains=query_params["customerId"])
        elif "technicianId" in query_params:
            qs = base_qs.filter(technicianId=query_params["technicianId"])
        elif "appointmentStatus" in query_params:
            qs = base_qs.filter(appointmentStatus=query_params["appointmentStatus"])
        elif "customerName" in query_params:
            qs = base_qs.filter(
                customerId__customerName__icontains=query_params["customerName"]
            )
        elif "technicianName" in query_params:
            qs = base_qs.filter(
                technicianId__technicianName__icontains=query_params["technicianName"]
            )
        elif "appointmentStartTime" in query_params:
            qs = base_qs.filter(
                appointmentStartTime__gte=query_params["appointmentStartTime"]
            )
        elif "customerPhone" in query_params:
            qs = base_qs.filter(
                customerId__customerPhone__icontains=query_params["customerPhone"]
            )
        elif "customerEmail" in query_params:
            qs = base_qs.filter(
                customerId__customerEmail__icontains=query_params["customerEmail"]
            )
        elif "technicianPhone" in query_params:
            qs = base_qs.filter(
                technicianId__technicianPhone__icontains=query_params["technicianPhone"]
            )
        elif "technicianPostalCode" in query_params:
            qs = base_qs.filter(
                technicianId__technicianPostalCode__icontains=query_params[
                    "technicianPostalCode"
                ]
            )
        elif "customerPostalCode" in query_params:
            qs = base_qs.filter(
                customerId__customerPostalCode__icontains=query_params[
                    "customerPostalCode"
                ]
            )
        elif request.GET:
            return Response(status=400)
        else:
            qs = base_qs.all()

        serializer = AppointmentSerializer(qs, many=True)

        serialized_data = serializer.data
        serialized_data_list = [dict(item) for item in serialized_data]
        prefetched = prefetch_related_data(serialized_data_list)
        modified_data_list = [
            include_all_info(data, request, prefetched=prefetched)
            for data in serialized_data_list
        ]

        return Response(modified_data_list, status=200)

    # Send email to customer for enquiry
    @action(detail=False, methods=["post"], url_path="sendEnquiry")
    def sendEnquiry(self, request, *args, **kwargs):
        # get all data from post request
        customerId = request.data.get("customerId", None)
        emailSubject = request.data.get("emailSubject", None)
        emailBody = request.data.get("emailBody", None)

        if not all([customerId, emailSubject, emailBody]):
            return Response(
                {"error": "Invalid request data."}, status=status.HTTP_400_BAD_REQUEST
            )

        # get customer data from database
        customer = get_object_or_404(Customers, id=customerId)

        # send email
        sendMail.send_email(
            emailSubject, emailBody, customer.customerEmail, "Coordinator"
        )
        return Response(
            {"success": "Email sent successfully."}, status=status.HTTP_200_OK
        )

    def get_appointment_end_time(self, start_time, aircon_to_service):
        # get the appointment end time by adding an hour for each aircon to the appointment start time
        appointment_end_time = start_time
        for _ in aircon_to_service:
            appointment_end_time += 3600  # TODO: change the magic number

        return appointment_end_time

    # POST request
    def create(self, request, *args, **kwargs):
        role = self._role(request)
        user_id = self._get_user_id(request)
        customer_id = request.data.get("customerId")

        if role not in ("customer", "coordinator"):
            return Response(
                {"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN
            )

        if not customer_id:
            return Response({"customerId": ["This field is required."]}, status=400)

        if role == "customer" and str(customer_id) != str(user_id):
            return Response(
                {"error": "Customers can only create appointments for themselves."},
                status=status.HTTP_403_FORBIDDEN,
            )

        aircon_brand = extract_aircon_brand(request.data.get("airconToService", []))
        nearby_technicians = get_nearby_technicians(
            customer_id,
            aircon_brand=aircon_brand,
            appointment_start_time=request.data["appointmentStartTime"],
        )
        request.data["appointmentEndTime"] = self.get_appointment_end_time(
            request.data["appointmentStartTime"], request.data["airconToService"]
        )
        request.data["technicianId"] = get_technician_to_assign(
            nearby_technicians,
            request.data["appointmentStartTime"],
            request.data["appointmentEndTime"],
        )
        if request.data["technicianId"] is not None:
            request.data["appointmentStatus"] = "2"

        serializer = AppointmentSerializer(
            data=request.data, context={"request": request}
        )
        if serializer.is_valid():
            # Wrap technician assignment + save in a transaction to prevent race conditions
            with transaction.atomic():
                tech_id = request.data.get("technicianId")
                if tech_id is not None:
                    # Re-verify technician availability with select_for_update to lock conflicting rows
                    conflicting = (
                        Appointments.objects.select_for_update()
                        .filter(
                            technicianId=tech_id,
                            appointmentStartTime__lt=request.data["appointmentEndTime"],
                            appointmentEndTime__gt=request.data["appointmentStartTime"],
                            appointmentStatus__in=["1", "2"],
                        )
                        .exists()
                    )
                    if conflicting:
                        # Technician was taken by a concurrent request, fall back to pending
                        request.data["technicianId"] = None
                        request.data["appointmentStatus"] = "1"
                        serializer = AppointmentSerializer(
                            data=request.data, context={"request": request}
                        )
                        if not serializer.is_valid():
                            return Response(serializer.errors, status=400)

                appointment = serializer.save()

            # Send confirmation email to customer and technician
            try:
                customer = Customers.objects.get(id=appointment.customerId.id)
                technician = (
                    appointment.technicianId if appointment.technicianId else None
                )
                send_appointment_confirmation(appointment, customer, technician)
            except Exception as e:
                logger.exception("Failed to send appointment confirmation email: %s", e)

            # Send receipt to customer's mailbox
            try:
                customer = Customers.objects.get(id=appointment.customerId.id)
                aircon_ids = request.data.get("airconToService", [])
                self.send_receipt_to_mailbox(appointment, customer, aircon_ids)
            except Exception as e:
                logger.exception("Failed to send receipt to customer mailbox: %s", e)

            serializer_data = dict(serializer.data)
            modified_data = include_all_info(serializer_data, request)
            return Response(modified_data, status=201)
        return Response(serializer.errors, status=400)

    # GET request with primary key
    def retrieve(self, request, pk=None):
        item = get_object_or_404(self.get_queryset(), pk=pk)
        serializer = AppointmentSerializer(item)
        serializer_data = dict(serializer.data)
        modified_data = include_all_info(serializer_data, request)
        return Response(modified_data)

    def update(self, request, pk=None):
        role = self._role(request)
        user_id = self._get_user_id(request)

        if role not in ("coordinator", "technician"):
            return Response(
                {"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN
            )

        item = get_object_or_404(self.get_queryset(), pk=pk)

        if role == "technician":
            if not item.technicianId or str(item.technicianId.id) != str(user_id):
                return Response(
                    {"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN
                )
            if request.data.get("customerId") and str(
                request.data.get("customerId")
            ) != str(item.customerId.id):
                return Response(
                    {
                        "error": "Technicians cannot reassign appointments to another customer."
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )
            if request.data.get("technicianId") and str(
                request.data.get("technicianId")
            ) != str(item.technicianId.id):
                return Response(
                    {"error": "Technicians cannot reassign appointments."},
                    status=status.HTTP_403_FORBIDDEN,
                )

        # Block cancellation via PUT — must use PATCH for cancellations
        if (
            str(request.data.get("appointmentStatus")) == "4"
            and str(item.appointmentStatus) != "4"
        ):
            return Response(
                {
                    "error": "Cancellations must use PATCH, not PUT, to enforce cancellation rules."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = AppointmentSerializer(
            item, data=request.data, context={"request": request}
        )
        if serializer.is_valid():
            serializer.save()
            serializer_data = dict(serializer.data)
            modified_data = include_all_info(serializer_data, request)
            return Response(modified_data)
        return Response(status=400)

    # PATCH request
    def partial_update(self, request, pk=None):
        # Coordinators can update any field; customers/technicians can only cancel their own
        role = self._role(request)
        user_id = self._get_user_id(request)
        if role not in ("coordinator", "customer", "technician"):
            return Response(
                {"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN
            )

        item = get_object_or_404(self.get_queryset(), pk=pk)

        if role == "customer":
            if str(item.customerId.id) != str(user_id):
                return Response(
                    {"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN
                )

            is_cancel = request.data.get("appointmentStatus") in ("4", 4)
            is_reschedule = (
                "appointmentStartTime" in request.data
                or "appointmentEndTime" in request.data
            ) and "appointmentStatus" not in request.data

            if not is_cancel and not is_reschedule:
                return Response(
                    {
                        "error": "Customers can only cancel or reschedule their own appointments."
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

            if is_cancel:
                request.data["cancelledBy"] = "customer"

            if is_reschedule:
                # Only allow rescheduling pending or confirmed appointments
                if item.appointmentStatus not in ("1", "2"):
                    return Response(
                        {
                            "error": "Only pending or confirmed appointments can be rescheduled."
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                # Restrict to only time fields for reschedule
                allowed_fields = {"appointmentStartTime", "appointmentEndTime"}
                disallowed = set(request.data.keys()) - allowed_fields
                if disallowed:
                    return Response(
                        {
                            "error": "Customers can only update appointment times during reschedule. "
                            f"Disallowed fields: {disallowed}"
                        },
                        status=status.HTTP_403_FORBIDDEN,
                    )

        if role == "technician":
            if not item.technicianId or str(item.technicianId.id) != str(user_id):
                return Response(
                    {"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN
                )
            if request.data.get("customerId") and str(
                request.data.get("customerId")
            ) != str(item.customerId.id):
                return Response(
                    {
                        "error": "Technicians cannot reassign appointments to another customer."
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )
            if request.data.get("technicianId") not in (None, "", "null"):
                current_technician_id = (
                    str(item.technicianId.id) if item.technicianId else None
                )
                if str(request.data.get("technicianId")) != current_technician_id:
                    return Response(
                        {"error": "Technicians cannot reassign appointments."},
                        status=status.HTTP_403_FORBIDDEN,
                    )

        # Handle empty string technicianId (convert to None for proper validation)
        if (
            request.data.get("technicianId") == ""
            or request.data.get("technicianId") == "null"
        ):
            request.data["technicianId"] = None

        # Ensure technicianId is a valid UUID string if present
        if request.data.get("technicianId") is not None:
            try:
                # Validate it's a proper UUID format
                import uuid

                tech_id = request.data.get("technicianId")
                if not isinstance(tech_id, str):
                    tech_id = str(tech_id)
                uuid.UUID(tech_id)  # This will raise ValueError if invalid
                request.data["technicianId"] = tech_id
            except (ValueError, AttributeError) as e:
                return Response(
                    {"error": f"Invalid technician ID format: {tech_id}"}, status=400
                )

        # Track if this is a cancellation for sending notification later
        is_cancellation = False
        cancellation_reason = None
        cancelled_by = None

        # Check if this is a cancellation request (status changing to '4' which is Cancelled)
        if (
            request.data.get("appointmentStatus") == "4"
            or request.data.get("appointmentStatus") == 4
        ):
            is_cancellation = True

            # Check if cancellation reason is provided
            cancellation_reason = request.data.get("cancellationReason")
            if not cancellation_reason or cancellation_reason.strip() == "":
                return Response(
                    {"error": "Cancellation reason is required."}, status=400
                )

            # Determine who is cancelling — default to "customer" so penalty logic fires correctly
            if role == "customer":
                cancelled_by = "customer"
            elif role == "technician":
                cancelled_by = "technician"
            else:
                cancelled_by = request.data.get("cancelledBy") or "coordinator"

            # Only check limit for technicians and coordinators, not customers
            if cancelled_by in ["technician", "coordinator"] and item.technicianId:
                is_allowed, count = self.check_monthly_cancellation_limit(
                    item.technicianId.id
                )
                if not is_allowed:
                    return Response(
                        {
                            "error": f"Monthly cancellation limit reached. You have already cancelled {count} appointments this month. Maximum is 3 per month."
                        },
                        status=400,
                    )

            # Set cancellation metadata
            request.data["cancelledAt"] = timezone.now()
            request.data["cancelledBy"] = cancelled_by
            request.data["appointmentStatus"] = "4"

        # Check if coordinator is manually assigning a technician
        manual_technician_assignment = request.data.get("technicianId") is not None

        # Track if technician was newly assigned (for sending confirmation email)
        technician_newly_assigned = False

        # Only auto-assign technician if not manually assigned and time/aircons are being changed
        if not manual_technician_assignment:
            aircon_ids = request.data.get("airconToService", item.airconToService or [])
            aircon_brand = extract_aircon_brand(aircon_ids)
            # Use the new or existing start time for proximity calculation
            effective_start_time = request.data.get(
                "appointmentStartTime", item.appointmentStartTime
            )
            nearby_technicians = get_nearby_technicians(
                item.customerId.id,
                aircon_brand=aircon_brand,
                appointment_start_time=effective_start_time,
            )

            if nearby_technicians is None:
                if request.data.get("appointmentStartTime") is not None:
                    return Response(
                        {
                            "error": "Changing the appointment time require reallocation of the technician."
                        },
                        status=400,
                    )
                elif request.data.get("airconToService") is not None:
                    if len(request.data["airconToService"]) <= len(
                        item.airconToService
                    ):
                        request.data["appointmentEndTime"] = (
                            self.get_appointment_end_time(
                                item.appointmentStartTime,
                                request.data["airconToService"],
                            )
                        )
                    else:
                        return Response(
                            {
                                "error": "Increasing the number of aircon to service require reallocation of the "
                                "technician."
                            },
                            status=400,
                        )
            elif (
                request.data.get("appointmentStartTime") is not None
                or request.data.get("airconToService") is not None
            ):
                # nearby_technicians = request.data.get('nearby_technicians')
                request.data["appointmentEndTime"] = self.get_appointment_end_time(
                    request.data["appointmentStartTime"],
                    request.data["airconToService"],
                )
                request.data["technicianId"] = get_technician_to_assign(
                    nearby_technicians,
                    request.data["appointmentStartTime"],
                    request.data["appointmentEndTime"],
                    item.technicianId,
                    item,
                )

        serializer = AppointmentSerializer(
            item, data=request.data, partial=True, context={"request": request}
        )

        if not serializer.is_valid():
            # Return the actual validation errors to the frontend
            return Response(
                {"error": "Validation failed", "details": serializer.errors}, status=400
            )

        # Check if technician is being assigned for the first time
        if serializer.validated_data.get("technicianId") is not None:
            if item.technicianId is None:
                # Technician being assigned to previously unassigned appointment
                technician_newly_assigned = True
            elif (
                item.technicianId.id != serializer.validated_data.get("technicianId").id
            ):
                # Different technician being assigned
                technician_newly_assigned = True

            # Only auto-set status if NOT a cancellation and NOT completed
            if not is_cancellation and item.appointmentStatus != "3":
                serializer.validated_data["appointmentStatus"] = "2"
        elif (
            serializer.validated_data.get("technicianId") is None
            and not is_cancellation
            and item.appointmentStatus != "3"
        ):
            serializer.validated_data["appointmentStatus"] = "1"

        # Fix B3: Check and apply penalty BEFORE saving the appointment
        penalty_result = None
        if is_cancellation and cancelled_by == "customer":
            appt_start = getattr(item, "appointmentStartTime", None)
            penalty_result = check_and_apply_penalty(
                item.customerId.id, appointment_start_time_unix=appt_start
            )

        updated_appointment = serializer.save()

        # Send confirmation email if technician was newly assigned
        if technician_newly_assigned and not is_cancellation:
            try:
                customer = Customers.objects.get(id=updated_appointment.customerId.id)
                technician = updated_appointment.technicianId
                send_appointment_confirmation(updated_appointment, customer, technician)
            except Exception as e:
                logger.exception(
                    "Failed to send technician assignment confirmation: %s", e
                )

        # Send cancellation email if this was a cancellation
        if is_cancellation:
            try:
                customer = Customers.objects.get(id=updated_appointment.customerId.id)
                technician = (
                    updated_appointment.technicianId
                    if updated_appointment.technicianId
                    else None
                )

                send_appointment_cancellation(
                    appointment=updated_appointment,
                    customer=customer,
                    technician=technician,
                    cancelled_by=cancelled_by,
                    cancellation_reason=cancellation_reason,
                )

                # Send penalty notification to customer if penalty was applied
                if penalty_result and penalty_result["penalty_applied"]:
                    penalty_reasons = []
                    if penalty_result.get("short_notice_penalty"):
                        penalty_reasons.append(
                            "Short-notice cancellation (within 30 mins of appointment)"
                        )
                    if penalty_result.get("monthly_limit_penalty"):
                        penalty_reasons.append(
                            f"Exceeded monthly cancellation limit ({CANCELLATION_THRESHOLD} free per month)"
                        )
                    reasons_text = "\n".join(f"• {r}" for r in penalty_reasons)
                    penalty_message = f"""
Dear {customer.customerName},

Your appointment has been cancelled. The following penalty(ies) have been applied:

{reasons_text}

PENALTY NOTICE:
================
Cancellations this month: {penalty_result["cancellation_count"]}
Penalty fee: ${penalty_result["penalty_amount"]}
Total pending penalty: ${penalty_result["total_pending_penalty"]}

This penalty fee will be added to your next payment.

To avoid future penalties: cancel at least 30 minutes before your appointment, and limit cancellations to 3 per month.

If you have any questions, please contact us.

Best regards,
AirServe Team
"""
                    Messages.objects.create(
                        senderType="coordinator",
                        senderId="00000000-0000-0000-0000-000000000000",
                        senderName="AirServe System",
                        recipientType="customer",
                        recipientId=customer.id,
                        recipientName=customer.customerName,
                        subject="Cancellation Penalty Notice",
                        body=penalty_message,
                        isRead=False,
                        relatedAppointment=updated_appointment,
                    )

                    # Send penalty notice via Telegram
                    send_penalty_notification_telegram(customer, penalty_result)
            except Exception as e:
                logger.exception("Failed to process cancellation notification: %s", e)

        serializer_data = dict(serializer.data)
        modified_data = include_all_info(serializer_data, request)
        return Response(modified_data, status=200)

    # DELETE request
    def destroy(self, request, pk=None):
        if not self._require_role(request, ["coordinator"]):
            return Response(
                {"error": "Coordinator access required"},
                status=status.HTTP_403_FORBIDDEN,
            )

        item = get_object_or_404(self.get_queryset(), pk=pk)
        item.delete()
        return Response(status=204)

    @action(detail=True, methods=["post"], url_path="rate-technician")
    def rate_technician(self, request, pk=None):
        """
        Customer rates technician (1-5 stars). Call from customer context.
        Body: { rating: 1-5, customerId: uuid }
        """
        if not self._require_role(request, ["customer"]):
            return Response(
                {"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN
            )

        appointment = get_object_or_404(self.get_queryset(), pk=pk)
        authenticated_user_id = self._get_user_id(request)
        customer_id = request.data.get("customerId")
        rating = request.data.get("rating")
        if not customer_id:
            return Response({"error": "customerId is required"}, status=400)
        if rating is None:
            return Response({"error": "rating is required (1-5)"}, status=400)
        try:
            rating = int(rating)
        except (TypeError, ValueError):
            return Response({"error": "rating must be an integer 1-5"}, status=400)

        if str(customer_id) != str(authenticated_user_id):
            return Response(
                {"error": "You can only rate appointments that belong to you."},
                status=403,
            )

        if str(appointment.customerId.id) != str(customer_id):
            return Response(
                {"error": "You can only rate appointments that belong to you."},
                status=403,
            )
        if appointment.appointmentStatus != "3":
            return Response(
                {"error": "You can only rate completed appointments."}, status=400
            )
        if not appointment.technicianId:
            return Response(
                {"error": "No technician was assigned to this appointment."}, status=400
            )
        if not (1 <= rating <= 5):
            return Response({"error": "Rating must be between 1 and 5."}, status=400)

        existing = AppointmentRating.objects.filter(
            appointment=appointment, ratedBy="customer"
        ).first()
        if existing:
            return Response(
                {
                    "error": "You have already rated this technician for this appointment."
                },
                status=400,
            )

        from decimal import Decimal

        technician = appointment.technicianId
        old_avg = float(technician.technicianRating)
        old_count = technician.technicianRatingCount
        new_count = old_count + 1
        new_avg = (old_avg * old_count + rating) / new_count
        technician.technicianRating = Decimal(str(round(new_avg, 2)))
        technician.technicianRatingCount = new_count
        technician.save()
        AppointmentRating.objects.create(
            appointment=appointment, ratedBy="customer", rating=rating
        )
        return Response(
            {
                "technicianRating": float(technician.technicianRating),
                "technicianRatingCount": technician.technicianRatingCount,
            },
            status=200,
        )

    @action(detail=True, methods=["post"], url_path="rate-customer")
    def rate_customer(self, request, pk=None):
        """
        Technician rates customer (1-5 stars). Call from technician context.
        Body: { rating: 1-5, technicianId: uuid }
        """
        if not self._require_role(request, ["technician"]):
            return Response(
                {"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN
            )

        appointment = get_object_or_404(self.get_queryset(), pk=pk)
        authenticated_user_id = self._get_user_id(request)
        technician_id = request.data.get("technicianId")
        rating = request.data.get("rating")
        if not technician_id:
            return Response({"error": "technicianId is required"}, status=400)
        if rating is None:
            return Response({"error": "rating is required (1-5)"}, status=400)
        try:
            rating = int(rating)
        except (TypeError, ValueError):
            return Response({"error": "rating must be an integer 1-5"}, status=400)

        if str(technician_id) != str(authenticated_user_id):
            return Response(
                {"error": "You can only rate appointments assigned to you."},
                status=403,
            )

        if not appointment.technicianId or str(appointment.technicianId.id) != str(
            technician_id
        ):
            return Response(
                {"error": "You can only rate appointments assigned to you."}, status=403
            )
        if appointment.appointmentStatus != "3":
            return Response(
                {"error": "You can only rate completed appointments."}, status=400
            )
        if not (1 <= rating <= 5):
            return Response({"error": "Rating must be between 1 and 5."}, status=400)

        existing = AppointmentRating.objects.filter(
            appointment=appointment, ratedBy="technician"
        ).first()
        if existing:
            return Response(
                {"error": "You have already rated this customer for this appointment."},
                status=400,
            )

        from decimal import Decimal

        customer = appointment.customerId
        old_avg = float(customer.customerRating)
        old_count = customer.ratingCount
        new_count = old_count + 1
        new_avg = (old_avg * old_count + rating) / new_count
        customer.customerRating = Decimal(str(round(new_avg, 2)))
        customer.ratingCount = new_count
        customer.save()
        AppointmentRating.objects.create(
            appointment=appointment, ratedBy="technician", rating=rating
        )
        return Response(
            {
                "customerRating": float(customer.customerRating),
                "ratingCount": customer.ratingCount,
            },
            status=200,
        )

    @action(detail=False, methods=["get"], url_path="penalty-status")
    def penalty_status(self, request):
        """
        Get penalty status for a customer
        Query params: customerId
        """
        role = self._role(request)
        user_id = self._get_user_id(request)
        requested_customer_id = request.query_params.get("customerId")

        if role == "customer":
            if requested_customer_id and str(requested_customer_id) != str(user_id):
                return Response(
                    {"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN
                )
            customer_id = user_id
        elif role == "coordinator":
            customer_id = requested_customer_id
            if not customer_id:
                return Response({"error": "customerId is required"}, status=400)
        else:
            return Response(
                {"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN
            )

        try:
            penalty_summary = get_penalty_summary(customer_id)
            return Response(penalty_summary, status=200)
        except Exception as e:
            logger.exception(
                "Failed to get penalty status for customer %s: %s", customer_id, e
            )
            return Response({"error": "Failed to retrieve penalty status"}, status=500)

    @action(detail=False, methods=["get"], url_path="unrated-completed")
    def unrated_completed(self, request):
        """
        Return completed appointments that the requesting user has not yet rated.
        Query params: customerId OR technicianId
        """
        role = self._role(request)
        user_id = self._get_user_id(request)
        requested_customer_id = request.query_params.get("customerId")
        requested_technician_id = request.query_params.get("technicianId")

        if role == "customer":
            if requested_technician_id or (
                requested_customer_id and str(requested_customer_id) != str(user_id)
            ):
                return Response(
                    {"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN
                )
            completed = (
                self.get_queryset()
                .filter(
                    appointmentStatus="3",
                    technicianId__isnull=False,
                )
                .exclude(ratings__ratedBy="customer")
            )
        elif role == "technician":
            if requested_customer_id or (
                requested_technician_id and str(requested_technician_id) != str(user_id)
            ):
                return Response(
                    {"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN
                )
            completed = (
                self.get_queryset()
                .filter(
                    appointmentStatus="3",
                )
                .exclude(ratings__ratedBy="technician")
            )
        elif role == "coordinator":
            base_qs = Appointments.objects.select_related("customerId", "technicianId")
            if requested_customer_id:
                completed = base_qs.filter(
                    customerId=requested_customer_id,
                    appointmentStatus="3",
                    technicianId__isnull=False,
                ).exclude(ratings__ratedBy="customer")
            elif requested_technician_id:
                completed = base_qs.filter(
                    technicianId=requested_technician_id,
                    appointmentStatus="3",
                ).exclude(ratings__ratedBy="technician")
            else:
                return Response(
                    {"error": "customerId or technicianId is required"}, status=400
                )
        else:
            return Response(
                {"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN
            )

        serializer = AppointmentSerializer(completed, many=True)
        serialized_data = [dict(item) for item in serializer.data]
        prefetched = prefetch_related_data(serialized_data)
        modified_data = [
            include_all_info(data, request, prefetched=prefetched)
            for data in serialized_data
        ]
        return Response(modified_data, status=200)

    @action(detail=True, methods=["get"], url_path="ratings")
    def get_ratings(self, request, pk=None):
        """
        Get individual ratings for a specific appointment.
        Used by coordinators to view per-appointment rating details.
        """
        if not self._require_role(request, ["coordinator"]):
            return Response(
                {"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN
            )

        appointment = get_object_or_404(self.get_queryset(), pk=pk)
        ratings = AppointmentRating.objects.filter(appointment=appointment)

        result = []
        for r in ratings:
            result.append(
                {
                    "id": str(r.id),
                    "ratedBy": r.ratedBy,
                    "rating": r.rating,
                    "created_at": r.created_at.isoformat(),
                }
            )

        return Response(result, status=200)

    @action(detail=False, methods=["post"], url_path="guest-booking")
    def guest_booking(self, request):
        """
        Create a guest booking without requiring customer registration
        Expected fields:
        - customerName
        - customerPhone
        - customerEmail
        - customerAddress
        - customerPostalCode
        - airconBrand (legacy single-device)
        - airconModel (optional, legacy single-device)
        - numberOfUnits (optional, legacy single-device)
        - airconDevices (new multi-device format: [{"brand": "...", "model": "...", "units": N}, ...])
        - appointmentStartTime
        - paymentMethod
        """
        self.throttle_classes = [GuestBookingThrottle]
        self.check_throttles(request)

        try:
            # Extract data from request
            name = request.data.get("customerName")
            phone = request.data.get("customerPhone")
            email = request.data.get("customerEmail")
            address = request.data.get("customerAddress")
            postal_code = request.data.get("customerPostalCode")
            appointment_time = request.data.get("appointmentStartTime")
            payment_method = request.data.get("paymentMethod", "cash")

            # Parse aircon devices — support both new multi-device and legacy single-device format
            aircon_devices_data = request.data.get("airconDevices", None)

            if aircon_devices_data and isinstance(aircon_devices_data, list):
                # New multi-device format
                devices = aircon_devices_data
            else:
                # Legacy single-device format (backward compat)
                devices = [
                    {
                        "brand": request.data.get("airconBrand", ""),
                        "model": request.data.get("airconModel", "Standard"),
                        "units": int(request.data.get("numberOfUnits", 1)),
                    }
                ]

            # Validate devices
            if not devices or len(devices) == 0:
                return Response(
                    {"error": "At least one aircon device is required"}, status=400
                )

            for device in devices:
                if not device.get("brand"):
                    return Response(
                        {"error": "Aircon brand is required for each device"},
                        status=400,
                    )
                if int(device.get("units", 1)) < 1:
                    return Response(
                        {"error": "Number of units must be at least 1"}, status=400
                    )

            total_units = sum(int(d.get("units", 1)) for d in devices)

            # Use first device brand for technician assignment and backward-compat references
            aircon_brand = devices[0].get("brand", "") if devices else ""

            # Validate required fields
            if not all(
                [
                    name,
                    phone,
                    email,
                    address,
                    postal_code,
                    aircon_brand,
                    appointment_time,
                ]
            ):
                return Response(
                    {
                        "error": "Missing required fields. Please provide: name, phone, email, address, postal code, aircon brand, and appointment time."
                    },
                    status=400,
                )

            # Check if customer already exists — refuse guest booking for existing accounts
            existing_customer = Customers.objects.filter(
                models.Q(customerPhone=phone) | models.Q(customerEmail=email)
            ).first()

            if existing_customer:
                return Response(
                    {
                        "error": "An account with this phone number or email already exists. Please log in to book an appointment."
                    },
                    status=status.HTTP_409_CONFLICT,
                )

            # Create temporary guest customer with a default password
            customer = Customers.objects.create(
                customerName=name,
                customerPhone=phone,
                customerEmail=email,
                customerAddress=address,
                customerPostalCode=postal_code,
                customerLocation=geo_onemap.get_location_from_postal(postal_code),
                customerPassword=make_password(
                    "GUEST_ACCOUNT_" + str(uuid.uuid4())[:8]
                ),  # Hashed random password for guest
            )

            # Create aircon device records for this booking
            # Add timestamp to make the name unique for each booking
            booking_timestamp = timezone.now().strftime("%Y%m%d%H%M%S")

            # Map brand name to airconType choice
            brand_to_type = {
                "Daikin": "daikin",
                "Mitsubishi": "mitsubishi",
                "Panasonic": "panasonic",
                "LG": "lg",
                "Samsung": "samsung",
                "Fujitsu": "fujitsu",
                "Sharp": "sharp",
                "Toshiba": "toshiba",
                "Hitachi": "hitachi",
                "York": "york",
            }

            aircon_device_ids = []
            for device in devices:
                brand = device.get("brand", "")
                model = device.get("model", "Standard")
                units = int(device.get("units", 1))
                aircon_type = brand_to_type.get(brand, "other")

                aircon_device = CustomerAirconDevices.objects.create(
                    customerId=customer,
                    airconName=f"{brand} - {model} (Booking {booking_timestamp})",
                    numberOfUnits=units,
                    airconType=aircon_type,
                )
                aircon_device_ids.append(str(aircon_device.id))

            # Get nearby technicians and find available slot (prioritize specialists for this brand)
            nearby_technicians = get_nearby_technicians(
                customer.id,
                aircon_brand=aircon_brand,
                appointment_start_time=appointment_time,
            )
            appointment_end_time = appointment_time + (
                3600 * total_units
            )  # 1 hour per aircon unit

            # Try to assign a technician
            assigned_technician = None
            for tech_id in nearby_technicians:
                technician = Technicians.objects.get(id=tech_id)
                # Check if technician is available (simplified check)
                conflicting_appointments = Appointments.objects.filter(
                    technicianId=technician,
                    appointmentStartTime__lt=appointment_end_time,
                    appointmentEndTime__gt=appointment_time,
                    appointmentStatus__in=["1", "2"],  # Pending or Upcoming
                ).exists()

                if not conflicting_appointments:
                    assigned_technician = technician
                    break

            # If no technician is available, leave unassigned (status will be Pending)
            # Do NOT force-assign a technician who has conflicts

            # Create the appointment
            # Set status to '2' (Confirmed) if technician is assigned, otherwise '1' (Pending)
            appointment_status = "2" if assigned_technician else "1"
            appointment = Appointments.objects.create(
                customerId=customer,
                technicianId=assigned_technician,
                appointmentStartTime=appointment_time,
                appointmentEndTime=appointment_end_time,
                appointmentStatus=appointment_status,
                paymentMethod=payment_method,
            )

            # Link all aircon devices to the appointment (airconToService is a JSONField list of IDs)
            appointment.airconToService = aircon_device_ids
            appointment.save()

            # Send email confirmation directly to guest's email
            appointment_datetime = datetime.fromtimestamp(appointment_time, tz=SGT)
            formatted_time = appointment_datetime.strftime("%B %d, %Y at %I:%M %p")

            # Calculate costs
            service_fee = 50 * total_units  # $50 per unit
            travel_fee = 10
            total_cost = service_fee + travel_fee

            # Build device listing for emails
            if len(devices) == 1:
                device_summary = f"Aircon: {devices[0].get('brand', '')} - {devices[0].get('model', 'Standard')}"
                device_detail = f"Number of Units: {total_units}"
            else:
                device_lines = []
                for i, d in enumerate(devices, 1):
                    device_lines.append(
                        f"  {i}. {d.get('brand', '')} - {d.get('model', 'Standard')} ({int(d.get('units', 1))} unit(s))"
                    )
                device_summary = "Aircon Devices:\n" + "\n".join(device_lines)
                device_detail = f"Total Units: {total_units}"

            # Build technician info for customer email
            technician_note = ""
            if assigned_technician:
                technician_note = f"""
ASSIGNED TECHNICIAN
===================
Name: {assigned_technician.technicianName}
Phone: {assigned_technician.technicianPhone}

Your assigned technician will contact you shortly to confirm the appointment details and discuss any specific requirements for the service.
"""
            else:
                technician_note = """
NOTE: A technician will be assigned to your appointment shortly. Once assigned, they will contact you to confirm the details.
"""

            email_subject = f"Booking Confirmation - AirServe Appointment"
            email_body = f"""
Dear {name},

Thank you for booking with AirServe!

Your appointment has been {"confirmed" if assigned_technician else "received and is pending technician assignment"}.

APPOINTMENT DETAILS
===================
Booking Reference: {str(appointment.id)[:8].upper()}
Date & Time: {formatted_time}
{device_summary}
{device_detail}
Address: {address}, Singapore {postal_code}
{technician_note}
COST BREAKDOWN
==============
Service Fee ({total_units} unit(s) x $50):  ${service_fee:.2f}
Travel Fee:                       $10.00
-------------------------------------------
TOTAL AMOUNT:                     ${total_cost:.2f}

Payment Method: {payment_method.replace("_", " ").title()}

If you have any questions, please contact us at support@airserve.com

Thank you for choosing AirServe!

Best regards,
AirServe Team
"""

            # Send confirmation email to customer
            try:
                sendMail.send_email(email_subject, email_body, email, "AirServe System")
            except Exception as e:
                logger.exception(
                    "Failed to send guest booking confirmation email: %s", e
                )

            # Send email notification to assigned technician
            if assigned_technician and assigned_technician.technicianEmail:
                tech_email_subject = f"New Appointment Assignment - {formatted_time}"
                tech_email_body = f"""
Dear {assigned_technician.technicianName},

You have been assigned a new appointment. Please review the details below and contact the customer to confirm.

APPOINTMENT DETAILS
===================
Booking Reference: {str(appointment.id)[:8].upper()}
Date & Time: {formatted_time}
Status: Confirmed

CUSTOMER INFORMATION
====================
Name: {name}
Phone: {phone}
Email: {email}
Address: {address}, Singapore {postal_code}

SERVICE DETAILS
===============
{device_summary}
{device_detail}
Estimated Duration: {total_units} hour(s)

ACTION REQUIRED
===============
Please contact the customer to confirm the appointment and discuss any specific requirements.

You can view this appointment in your technician dashboard.

Best regards,
AirServe Scheduling System
"""
                try:
                    sendMail.send_email(
                        tech_email_subject,
                        tech_email_body,
                        assigned_technician.technicianEmail,
                        "AirServe Assignments",
                    )
                except Exception as e:
                    logger.exception(
                        "Failed to send technician notification for guest booking: %s",
                        e,
                    )

            # Send notification email to coordinator(s)
            try:
                from ..models import Coordinators

                coordinators = Coordinators.objects.all()

                if assigned_technician:
                    coord_email_subject = f"New Guest Booking - {name}"
                    coord_status = "Confirmed - Technician Assigned"
                    coord_action = f"Technician {assigned_technician.technicianName} has been automatically assigned."
                else:
                    coord_email_subject = (
                        f"[ACTION REQUIRED] New Guest Booking - No Technician Available"
                    )
                    coord_status = "Pending - No Technician Assigned"
                    coord_action = "ATTENTION: No technician could be automatically assigned. Please manually assign a technician to this appointment."

                coord_email_body = f"""
New guest booking received via the website.

BOOKING STATUS
==============
Status: {coord_status}
{coord_action}

APPOINTMENT DETAILS
===================
Booking Reference: {str(appointment.id)[:8].upper()}
Date & Time: {formatted_time}

CUSTOMER INFORMATION
====================
Name: {name}
Phone: {phone}
Email: {email}
Address: {address}, Singapore {postal_code}

SERVICE DETAILS
===============
{device_summary}
{device_detail}
Payment Method: {payment_method.replace("_", " ").title()}
Estimated Cost: ${total_cost:.2f}

Please review this booking in the coordinator dashboard.

Best regards,
AirServe Scheduling System
"""
                for coordinator in coordinators:
                    try:
                        sendMail.send_email(
                            coord_email_subject,
                            coord_email_body,
                            coordinator.coordinatorEmail,
                            "AirServe Notifications",
                        )
                    except Exception as e:
                        logger.exception(
                            "Failed to send coordinator notification email: %s", e
                        )
            except Exception as e:
                logger.exception(
                    "Failed to notify coordinators about guest booking: %s", e
                )

            # Return appointment details
            serializer = AppointmentSerializer(appointment)
            response_data = include_all_info(dict(serializer.data), request)

            return Response(
                {
                    "message": "Booking created successfully! A confirmation email has been sent.",
                    "appointment": response_data,
                    "customerId": str(customer.id),
                    "isGuestBooking": not existing_customer,
                    "totalUnits": total_units,
                    "numberOfDevices": len(devices),
                    "airconDeviceIds": aircon_device_ids,
                },
                status=201,
            )

        except Exception as e:
            logger.exception("Failed to create guest booking: %s", e)
            return Response(
                {
                    "error": "Failed to create booking. Please try again or contact support."
                },
                status=500,
            )
