from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import models
from django.contrib.auth.hashers import make_password
from datetime import datetime, timedelta
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
import logging
import uuid

logger = logging.getLogger(__name__)

from .format_response import include_all_info
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
        if device.airconType and device.airconType != 'other':
            return device.get_airconType_display()
        # Parse from airconName (format: "Brand - Model (Booking ...)")
        if device.airconName and " - " in device.airconName:
            return device.airconName.split(" - ")[0].strip()
    except CustomerAirconDevices.DoesNotExist:
        pass
    return None


TRAVEL_FEE = 10  # $10 standard travel fee


class AppointmentViewSet(viewsets.ModelViewSet):
    queryset = Appointments.objects.all()
    serializer_class = AppointmentSerializer

    def get_permissions(self):
        if self.action == "guest_booking":
            return [AllowAny()]
        return [IsAuthenticated()]

    def send_receipt_to_mailbox(self, appointment, customer, aircon_ids):
        """
        Generate and send a receipt message to the customer's mailbox
        """
        try:
            # Get aircon details
            aircon_devices = CustomerAirconDevices.objects.filter(id__in=aircon_ids)
            aircon_names = [device.airconName for device in aircon_devices]
            num_aircons = len(aircon_ids)

            # Calculate costs
            service_cost = num_aircons * SERVICE_COST_PER_AIRCON
            total_cost = service_cost + TRAVEL_FEE

            # Add penalty fee if any
            penalty_fee = customer.pendingPenaltyFee
            total_cost_with_penalty = total_cost + float(penalty_fee)

            # Format appointment time
            appointment_time = datetime.fromtimestamp(appointment.appointmentStartTime)
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
        if "customerId" in query_params:
            serializer = AppointmentSerializer(
                Appointments.objects.filter(
                    customerId__id__icontains=query_params["customerId"]
                ),
                many=True,
            )
        elif "technicianId" in query_params:
            serializer = AppointmentSerializer(
                Appointments.objects.filter(technicianId=query_params["technicianId"]),
                many=True,
            )
        elif "appointmentStatus" in query_params:
            serializer = AppointmentSerializer(
                Appointments.objects.filter(
                    appointmentStatus=query_params["appointmentStatus"]
                ),
                many=True,
            )
        elif "customerName" in query_params:
            serializer = AppointmentSerializer(
                Appointments.objects.filter(
                    customerId__customerName__icontains=query_params["customerName"]
                ),
                many=True,
            )
        elif "technicianName" in query_params:
            serializer = AppointmentSerializer(
                Appointments.objects.filter(
                    technicianId__technicianName__icontains=query_params[
                        "technicianName"
                    ]
                ),
                many=True,
            )
        elif "appointmentStartTime" in query_params:
            serializer = AppointmentSerializer(
                Appointments.objects.filter(
                    appointmentStartTime__gte=query_params["appointmentStartTime"]
                ),
                many=True,
            )
        elif "appointmentStatus" in query_params:
            serializer = AppointmentSerializer(
                Appointments.objects.filter(
                    appointmentStatus=query_params["appointmentStatus"]
                ),
                many=True,
            )
        elif "customerPhone" in query_params:
            serializer = AppointmentSerializer(
                Appointments.objects.filter(
                    customerId__customerPhone__icontains=query_params["customerPhone"]
                ),
                many=True,
            )
        elif "customerEmail" in query_params:
            serializer = AppointmentSerializer(
                Appointments.objects.filter(
                    customerId__customerEmail__icontains=query_params["customerEmail"]
                ),
                many=True,
            )
        elif "technicianPhone" in query_params:
            serializer = AppointmentSerializer(
                Appointments.objects.filter(
                    technicianId__technicianPhone__icontains=query_params[
                        "technicianPhone"
                    ]
                ),
                many=True,
            )
        elif "technicianPostalCode" in query_params:
            serializer = AppointmentSerializer(
                Appointments.objects.filter(
                    technicianId__technicianPostalCode__icontains=query_params[
                        "technicianPostalCode"
                    ]
                ),
                many=True,
            )
        elif "customerPostalCode" in query_params:
            serializer = AppointmentSerializer(
                Appointments.objects.filter(
                    customerId__customerPostalCode__icontains=query_params[
                        "customerPostalCode"
                    ]
                ),
                many=True,
            )
        elif request.GET:
            return Response(status=400)
        else:
            serializer = AppointmentSerializer(Appointments.objects.all(), many=True)

        serialized_data = serializer.data
        serialized_data_list = [dict(item) for item in serialized_data]
        modified_data_list = [
            include_all_info(data, request) for data in serialized_data_list
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
        aircon_brand = extract_aircon_brand(request.data.get("airconToService", []))
        nearby_technicians = get_nearby_technicians(
            request.data["customerId"],
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
        item = get_object_or_404(Appointments.objects.all(), pk=pk)
        serializer = AppointmentSerializer(item)
        serializer_data = dict(serializer.data)
        modified_data = include_all_info(serializer_data, request)
        return Response(modified_data)

    def update(self, request, pk=None):
        # TODO: verify if this is sent by the coordinator
        item = get_object_or_404(Appointments.objects.all(), pk=pk)
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
        item = get_object_or_404(Appointments.objects.all(), pk=pk)

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
            cancelled_by = request.data.get("cancelledBy", "customer")

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
                            "Changing the appointment time require reallocation of the technician."
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
                                "Increasing the number of aircon to service require reallocation of the "
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

        if serializer.is_valid():
            # Check if technician is being assigned for the first time
            if serializer.validated_data.get("technicianId") is not None:
                if item.technicianId is None:
                    # Technician being assigned to previously unassigned appointment
                    technician_newly_assigned = True
                elif (
                    item.technicianId.id
                    != serializer.validated_data.get("technicianId").id
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

            updated_appointment = serializer.save()

            # Send confirmation email if technician was newly assigned
            if technician_newly_assigned and not is_cancellation:
                try:
                    customer = Customers.objects.get(
                        id=updated_appointment.customerId.id
                    )
                    technician = updated_appointment.technicianId
                    send_appointment_confirmation(
                        updated_appointment, customer, technician
                    )
                except Exception as e:
                    logger.exception(
                        "Failed to send technician assignment confirmation: %s", e
                    )

            # Send cancellation email if this was a cancellation
            if is_cancellation:
                try:
                    customer = Customers.objects.get(
                        id=updated_appointment.customerId.id
                    )
                    technician = (
                        updated_appointment.technicianId
                        if updated_appointment.technicianId
                        else None
                    )

                    # Check and apply penalty if customer is cancelling
                    penalty_result = None
                    if cancelled_by == "customer":
                        appt_start = getattr(
                            updated_appointment, "appointmentStartTime", None
                        )
                        penalty_result = check_and_apply_penalty(
                            customer.id, appointment_start_time_unix=appt_start
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
                    logger.exception(
                        "Failed to process cancellation notification: %s", e
                    )

            serializer_data = dict(serializer.data)
            modified_data = include_all_info(serializer_data, request)
            return Response(modified_data, status=200)

        return Response(serializer.errors, status=400)

    # DELETE request
    def destroy(self, request, pk=None):
        item = get_object_or_404(Appointments.objects.all(), pk=pk)
        item.delete()
        return Response(status=204)

    @action(detail=True, methods=["post"], url_path="rate-technician")
    def rate_technician(self, request, pk=None):
        """
        Customer rates technician (1-5 stars). Call from customer context.
        Body: { rating: 1-5, customerId: uuid }
        """
        appointment = get_object_or_404(Appointments.objects.all(), pk=pk)
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
        appointment = get_object_or_404(Appointments.objects.all(), pk=pk)
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
        customer_id = request.query_params.get("customerId")
        if not customer_id:
            return Response({"error": "customerId is required"}, status=400)

        try:
            penalty_summary = get_penalty_summary(customer_id)
            return Response(penalty_summary, status=200)
        except Exception as e:
            logger.exception(
                "Failed to get penalty status for customer %s: %s", customer_id, e
            )
            return Response({"error": "Failed to retrieve penalty status"}, status=500)

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
        - airconBrand
        - airconModel (optional)
        - appointmentStartTime
        - paymentMethod
        """
        try:
            # Extract data from request
            name = request.data.get("customerName")
            phone = request.data.get("customerPhone")
            email = request.data.get("customerEmail")
            address = request.data.get("customerAddress")
            postal_code = request.data.get("customerPostalCode")
            aircon_brand = request.data.get("airconBrand")
            aircon_model = request.data.get("airconModel", "Standard")
            number_of_units = int(request.data.get("numberOfUnits", 1))
            appointment_time = request.data.get("appointmentStartTime")
            payment_method = request.data.get("paymentMethod", "cash")

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

            # Check if customer already exists by phone or email
            existing_customer = Customers.objects.filter(
                models.Q(customerPhone=phone) | models.Q(customerEmail=email)
            ).first()

            if existing_customer:
                # Use existing customer but update their details
                customer = existing_customer
                customer.customerName = name
                customer.customerPhone = phone
                customer.customerEmail = email
                customer.customerAddress = address
                customer.customerPostalCode = postal_code
                customer.customerLocation = geo_onemap.get_location_from_postal(
                    postal_code
                )
                customer.save()
            else:
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

            # Create a temporary aircon device for this booking
            # Add timestamp to make the name unique for each booking
            booking_timestamp = timezone.now().strftime("%Y%m%d%H%M%S")
            aircon_device = CustomerAirconDevices.objects.create(
                customerId=customer,
                airconName=f"{aircon_brand} - {aircon_model} (Booking {booking_timestamp})",
                numberOfUnits=number_of_units,
                airconType="split",  # Default type for guest bookings
            )

            # Get nearby technicians and find available slot (prioritize specialists for this brand)
            nearby_technicians = get_nearby_technicians(
                customer.id,
                aircon_brand=aircon_brand,
                appointment_start_time=appointment_time,
            )
            appointment_end_time = appointment_time + (
                3600 * number_of_units
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

            if not assigned_technician and nearby_technicians:
                # Assign to first technician if no one is perfectly available
                assigned_technician = Technicians.objects.get(id=nearby_technicians[0])

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

            # Link the aircon device to the appointment (airconToService is a JSONField list of IDs)
            appointment.airconToService = [str(aircon_device.id)]
            appointment.save()

            # Send email confirmation directly to guest's email
            appointment_datetime = datetime.fromtimestamp(appointment_time)
            formatted_time = appointment_datetime.strftime("%B %d, %Y at %I:%M %p")

            # Calculate costs
            service_fee = 50 * number_of_units  # $50 per unit
            travel_fee = 10
            total_cost = service_fee + travel_fee

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
Aircon: {aircon_brand} - {aircon_model}
Number of Units: {number_of_units}
Address: {address}, Singapore {postal_code}
{technician_note}
COST BREAKDOWN
==============
Service Fee ({number_of_units} unit(s) x $50):  ${service_fee:.2f}
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
Aircon: {aircon_brand} - {aircon_model}
Number of Units: {number_of_units}
Estimated Duration: {number_of_units} hour(s)

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
Aircon: {aircon_brand} - {aircon_model}
Number of Units: {number_of_units}
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
