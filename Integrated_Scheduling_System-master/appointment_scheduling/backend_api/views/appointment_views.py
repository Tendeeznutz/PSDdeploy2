from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import models
from datetime import datetime, timedelta
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
import uuid

from .format_response import include_all_info
from ..scheduling_algo import *
from ..models import Appointments, Customers, Technicians, CustomerAirconDevices, Messages
from ..serializers import AppointmentSerializer
from ..utils import sendMail
from ..utils.notifications import send_appointment_confirmation, send_appointment_cancellation
from ..penalty_utils import check_and_apply_penalty, get_penalty_summary

# Pricing constants (matching frontend)
SERVICE_COST_PER_AIRCON = 50  # $50 per aircon serviced
TRAVEL_FEE = 10  # $10 standard travel fee


class AppointmentViewSet(viewsets.ModelViewSet):
    queryset = Appointments.objects.all()
    serializer_class = AppointmentSerializer

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
            formatted_time = appointment_time.strftime('%B %d, %Y at %I:%M %p')

            # Get payment method display name
            payment_methods = {
                'cash': 'Cash',
                'cheque': 'Cheque',
                'card': 'Credit/Debit Card',
                'bank_transfer': 'Bank Transfer',
                'paynow': 'PayLah/PayNow'
            }
            payment_display = payment_methods.get(appointment.paymentMethod, appointment.paymentMethod)

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
Service Fee ({num_aircons} aircon{'s' if num_aircons > 1 else ''} x ${SERVICE_COST_PER_AIRCON}):    ${service_cost}.00
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
                senderType='coordinator',
                senderId='00000000-0000-0000-0000-000000000000',  # System sender
                senderName='AirServe System',
                recipientType='customer',
                recipientId=customer.id,
                recipientName=customer.customerName,
                subject=f'Appointment Receipt - Booking #{str(appointment.id)[:8].upper()}',
                body=receipt_body,
                isRead=False,
                relatedAppointment=appointment
            )

            print(f"Receipt sent to mailbox for customer {customer.customerName}")

        except Exception as e:
            print(f"Failed to send receipt to mailbox: {e}")

    def check_monthly_cancellation_limit(self, technician_id):
        """
        Check if technician has reached monthly cancellation limit (3 per month)
        Returns (is_allowed, count) tuple
        """
        # Get the first day of current month
        now = timezone.now()
        first_day_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # Count cancellations by this technician in current month
        cancellation_count = Appointments.objects.filter(
            appointmentStatus='4',  # Cancelled status
            cancelledBy='technician',
            technicianId=technician_id,
            cancelledAt__gte=first_day_of_month
        ).count()

        return (cancellation_count < 3, cancellation_count)

    @action(detail=False, methods=['get'], url_path='unavailable')
    def unavailable(self, request, *args, **kwargs):
        # check if request contains customer id
        customer_id = request.query_params.get('customerId', None)
        if customer_id is None:
            return Response(status=400)
        else:
            nearby_technicians = get_nearby_technicians(customer_id)
            data_dict = {
                'nearby_technicians': nearby_technicians,
                'unavailable_timeslots': get_common_unavailable_time(nearby_technicians)
            }
        return Response(data_dict, status=200)

    # GET request
    def list(self, request, *args, **kwargs):
        query_params = request.query_params
        if 'customerId' in query_params:
            serializer = AppointmentSerializer(
                Appointments.objects.filter(customerId__id__icontains=query_params['customerId']), many=True)
        elif 'technicianId' in query_params:
            serializer = AppointmentSerializer(Appointments.objects.filter(technicianId=query_params['technicianId']),
                                               many=True)
        elif 'appointmentStatus' in query_params:
            serializer = AppointmentSerializer(
                Appointments.objects.filter(appointmentStatus=query_params['appointmentStatus']), many=True)
        elif 'customerName' in query_params:
            serializer = AppointmentSerializer(
                Appointments.objects.filter(customerId__customerName__icontains=query_params['customerName']),
                many=True)
        elif 'technicianName' in query_params:
            serializer = AppointmentSerializer(
                Appointments.objects.filter(technicianId__technicianName__icontains=query_params['technicianName']),
                many=True)
        elif 'appointmentStartTime' in query_params:
            serializer = AppointmentSerializer(
                Appointments.objects.filter(appointmentStartTime__gte=query_params['appointmentStartTime']), many=True)
        elif 'appointmentStatus' in query_params:
            serializer = AppointmentSerializer(
                Appointments.objects.filter(appointmentStatus=query_params['appointmentStatus']), many=True)
        elif 'customerPhone' in query_params:
            serializer = AppointmentSerializer(
                Appointments.objects.filter(customerId__customerPhone__icontains=query_params['customerPhone']),
                many=True)
        elif 'customerEmail' in query_params:
            serializer = AppointmentSerializer(
                Appointments.objects.filter(customerId__customerEmail__icontains=query_params['customerEmail']),
                many=True)
        elif 'technicianPhone' in query_params:
            serializer = AppointmentSerializer(
                Appointments.objects.filter(technicianId__technicianPhone__icontains=query_params['technicianPhone']),
                many=True)
        elif 'technicianPostalCode' in query_params:
            serializer = AppointmentSerializer(Appointments.objects.filter(
                technicianId__technicianPostalCode__icontains=query_params['technicianPostalCode']), many=True)
        elif 'customerPostalCode' in query_params:
            serializer = AppointmentSerializer(Appointments.objects.filter(
                customerId__customerPostalCode__icontains=query_params['customerPostalCode']), many=True)
        elif request.GET:
            return Response(status=400)
        else:
            serializer = AppointmentSerializer(Appointments.objects.all(), many=True)

        serialized_data = serializer.data
        serialized_data_list = [dict(item) for item in serialized_data]
        modified_data_list = [include_all_info(data) for data in serialized_data_list]

        return Response(modified_data_list, status=200)

    # Send email to customer for enquiry
    @action(detail=False, methods=['post'], url_path='sendEnquiry')
    def sendEnquiry(self, request, *args, **kwargs):
        # get all data from post request
        customerId = request.data.get('customerId', None)
        emailSubject = request.data.get('emailSubject', None)
        emailBody = request.data.get('emailBody', None)

        if not all([customerId, emailSubject, emailBody]):
            return Response({'error': 'Invalid request data.'}, status=status.HTTP_400_BAD_REQUEST)

        # get customer data from database
        customer = get_object_or_404(Customers, id=customerId)
        print(customer)

        # send email
        sendMail.send_email(emailSubject, emailBody, customer.customerEmail, 'Coordinator')
        return Response({'success': 'Email sent successfully.'}, status=status.HTTP_200_OK)

    def get_appointment_end_time(self, start_time, aircon_to_service):
        # get the appointment end time by adding an hour for each aircon to the appointment start time
        appointment_end_time = start_time
        for _ in aircon_to_service:
            appointment_end_time += 3600  # TODO: change the magic number

        return appointment_end_time

    # POST request
    def create(self, request, *args, **kwargs):
        nearby_technicians = get_nearby_technicians(request.data['customerId'])
        request.data['appointmentEndTime'] = self.get_appointment_end_time(request.data['appointmentStartTime'],
                                                                           request.data['airconToService'])
        request.data['technicianId'] = get_technician_to_assign(nearby_technicians,
                                                                request.data['appointmentStartTime'],
                                                                request.data['appointmentEndTime'])
        if request.data['technicianId'] is not None:
            request.data['appointmentStatus'] = '2'

        serializer = AppointmentSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            appointment = serializer.save()

            # Send confirmation email to customer and technician
            try:
                customer = Customers.objects.get(id=appointment.customerId.id)
                technician = appointment.technicianId if appointment.technicianId else None
                send_appointment_confirmation(appointment, customer, technician)
            except Exception as e:
                # Log error but don't fail the appointment creation
                print(f"Failed to send confirmation email: {e}")

            # Send receipt to customer's mailbox
            try:
                customer = Customers.objects.get(id=appointment.customerId.id)
                aircon_ids = request.data.get('airconToService', [])
                self.send_receipt_to_mailbox(appointment, customer, aircon_ids)
            except Exception as e:
                # Log error but don't fail the appointment creation
                print(f"Failed to send receipt to mailbox: {e}")

            serializer_data = dict(serializer.data)
            modified_data = include_all_info(serializer_data)
            return Response(modified_data, status=201)
        return Response(serializer.errors, status=400)

    # GET request with primary key
    def retrieve(self, request, pk=None):
        item = get_object_or_404(Appointments.objects.all(), pk=pk)
        serializer = AppointmentSerializer(item)
        serializer_data = dict(serializer.data)
        modified_data = include_all_info(serializer_data)
        return Response(modified_data)

    def update(self, request, pk=None):
        # TODO: verify if this is sent by the coordinator
        item = get_object_or_404(Appointments.objects.all(), pk=pk)
        serializer = AppointmentSerializer(item, data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            serializer_data = dict(serializer.data)
            modified_data = include_all_info(serializer_data)
            return Response(modified_data)
        return Response(status=400)

    # PATCH request
    def partial_update(self, request, pk=None):
        item = get_object_or_404(Appointments.objects.all(), pk=pk)

        # Debug logging
        print(f"\n{'='*80}")
        print(f"PATCH request for appointment {pk}")
        print(f"Request data: {request.data}")
        print(f"technicianId in request: {request.data.get('technicianId')}")
        print(f"Current appointment technicianId: {item.technicianId}")
        print(f"{'='*80}\n")

        # Handle empty string technicianId (convert to None for proper validation)
        if request.data.get('technicianId') == '' or request.data.get('technicianId') == 'null':
            request.data['technicianId'] = None

        # Ensure technicianId is a valid UUID string if present
        if request.data.get('technicianId') is not None:
            try:
                # Validate it's a proper UUID format
                import uuid
                tech_id = request.data.get('technicianId')
                if not isinstance(tech_id, str):
                    tech_id = str(tech_id)
                uuid.UUID(tech_id)  # This will raise ValueError if invalid
                request.data['technicianId'] = tech_id
            except (ValueError, AttributeError) as e:
                print(f"Invalid technicianId format: {e}")
                return Response({"error": f"Invalid technician ID format: {tech_id}"}, status=400)

        # Track if this is a cancellation for sending notification later
        is_cancellation = False
        cancellation_reason = None
        cancelled_by = None

        # Check if this is a cancellation request (status changing to '4' which is Cancelled)
        if request.data.get('appointmentStatus') == '4' or request.data.get('appointmentStatus') == 4:
            is_cancellation = True

            # Check if cancellation reason is provided
            cancellation_reason = request.data.get('cancellationReason')
            if not cancellation_reason or cancellation_reason.strip() == '':
                return Response({"error": "Cancellation reason is required."}, status=400)

            # Determine who is cancelling (technician or coordinator)
            cancelled_by = request.data.get('cancelledBy', 'technician')

            # Only check limit for technicians and coordinators, not customers
            if cancelled_by in ['technician', 'coordinator'] and item.technicianId:
                is_allowed, count = self.check_monthly_cancellation_limit(item.technicianId.id)
                if not is_allowed:
                    return Response({
                        "error": f"Monthly cancellation limit reached. You have already cancelled {count} appointments this month. Maximum is 3 per month."
                    }, status=400)

            # Set cancellation metadata
            request.data['cancelledAt'] = timezone.now()
            request.data['cancelledBy'] = cancelled_by
            request.data['appointmentStatus'] = '4'

        # Check if coordinator is manually assigning a technician
        manual_technician_assignment = request.data.get('technicianId') is not None

        # Track if technician was newly assigned (for sending confirmation email)
        technician_newly_assigned = False

        # Only auto-assign technician if not manually assigned and time/aircons are being changed
        if not manual_technician_assignment:
            nearby_technicians = get_nearby_technicians(item.customerId.id)

            if nearby_technicians is None:
                if request.data.get('appointmentStartTime') is not None:
                    return Response({"Changing the appointment time require reallocation of the technician."}, status=400)
                elif request.data.get('airconToService') is not None:
                    if len(request.data['airconToService']) <= len(item.airconToService):
                        request.data['appointmentEndTime'] = self.get_appointment_end_time(item.appointmentStartTime,
                                                                                           request.data['airconToService'])
                    else:
                        return Response({"Increasing the number of aircon to service require reallocation of the "
                                         "technician."},
                                        status=400)
            elif request.data.get('appointmentStartTime') is not None or request.data.get('airconToService') is not None:
                # nearby_technicians = request.data.get('nearby_technicians')
                request.data['appointmentEndTime'] = self.get_appointment_end_time(request.data['appointmentStartTime'],
                                                                                   request.data['airconToService'])
                request.data['technicianId'] = get_technician_to_assign(nearby_technicians,
                                                                        request.data['appointmentStartTime'],
                                                                        request.data['appointmentEndTime'],
                                                                        item.technicianId, item)

        serializer = AppointmentSerializer(item, data=request.data, partial=True, context={'request': request})

        print(f"Serializer is_valid: {serializer.is_valid()}")
        if not serializer.is_valid():
            print(f"Serializer errors: {serializer.errors}")
            # Return the actual validation errors to the frontend
            return Response({
                "error": "Validation failed",
                "details": serializer.errors
            }, status=400)

        if serializer.is_valid():
            # Check if technician is being assigned for the first time
            if serializer.validated_data.get('technicianId') is not None:
                if item.technicianId is None:
                    # Technician being assigned to previously unassigned appointment
                    technician_newly_assigned = True
                elif item.technicianId.id != serializer.validated_data.get('technicianId').id:
                    # Different technician being assigned
                    technician_newly_assigned = True

                # Only auto-set status if NOT a cancellation and NOT completed
                if not is_cancellation and item.appointmentStatus != '3':
                    serializer.validated_data['appointmentStatus'] = '2'
            elif serializer.validated_data.get('technicianId') is None and not is_cancellation and item.appointmentStatus != '3':
                serializer.validated_data['appointmentStatus'] = '1'

            updated_appointment = serializer.save()

            # Send confirmation email if technician was newly assigned
            if technician_newly_assigned and not is_cancellation:
                try:
                    customer = Customers.objects.get(id=updated_appointment.customerId.id)
                    technician = updated_appointment.technicianId
                    send_appointment_confirmation(updated_appointment, customer, technician)
                    print(f"Sent confirmation email for technician assignment to appointment {updated_appointment.id}")
                except Exception as e:
                    print(f"Failed to send confirmation email: {e}")

            # Send cancellation email if this was a cancellation
            if is_cancellation:
                try:
                    customer = Customers.objects.get(id=updated_appointment.customerId.id)
                    technician = updated_appointment.technicianId if updated_appointment.technicianId else None

                    # Check and apply penalty if customer is cancelling
                    penalty_result = None
                    if cancelled_by == 'customer':
                        penalty_result = check_and_apply_penalty(customer.id)
                        print(f"Penalty check result: {penalty_result}")

                    send_appointment_cancellation(
                        appointment=updated_appointment,
                        customer=customer,
                        technician=technician,
                        cancelled_by=cancelled_by,
                        cancellation_reason=cancellation_reason
                    )

                    # Send penalty notification to customer if penalty was applied
                    if penalty_result and penalty_result['penalty_applied']:
                        penalty_message = f"""
Dear {customer.customerName},

Your appointment has been cancelled. However, you have exceeded the monthly cancellation limit of 5 free cancellations.

PENALTY NOTICE:
================
Cancellations this month: {penalty_result['cancellation_count']}
Penalty fee: ${penalty_result['penalty_amount']}
Total pending penalty: ${penalty_result['total_pending_penalty']}

This penalty fee will be added to your next payment.

To avoid future penalties, please ensure you only cancel appointments when absolutely necessary.

If you have any questions, please contact us.

Best regards,
AirServe Team
"""
                        Messages.objects.create(
                            senderType='coordinator',
                            senderId='00000000-0000-0000-0000-000000000000',
                            senderName='AirServe System',
                            recipientType='customer',
                            recipientId=customer.id,
                            recipientName=customer.customerName,
                            subject='Cancellation Penalty Notice',
                            body=penalty_message,
                            isRead=False,
                            relatedAppointment=updated_appointment
                        )
                except Exception as e:
                    # Log error but don't fail the cancellation
                    print(f"Failed to send cancellation email: {e}")

            serializer_data = dict(serializer.data)
            modified_data = include_all_info(serializer_data)
            print(f"Update successful, returning data")
            return Response(modified_data, status=200)

        print(f"Update failed with errors: {serializer.errors}")
        return Response(serializer.errors, status=400)

    # DELETE request
    def destroy(self, request, pk=None):
        item = get_object_or_404(Appointments.objects.all(), pk=pk)
        item.delete()
        return Response(status=204)

    @action(detail=False, methods=['get'], url_path='penalty-status')
    def penalty_status(self, request):
        """
        Get penalty status for a customer
        Query params: customerId
        """
        customer_id = request.query_params.get('customerId')
        if not customer_id:
            return Response({"error": "customerId is required"}, status=400)

        try:
            penalty_summary = get_penalty_summary(customer_id)
            return Response(penalty_summary, status=200)
        except Exception as e:
            return Response({"error": str(e)}, status=500)

    @action(detail=False, methods=['post'], url_path='guest-booking')
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
            name = request.data.get('customerName')
            phone = request.data.get('customerPhone')
            email = request.data.get('customerEmail')
            address = request.data.get('customerAddress')
            postal_code = request.data.get('customerPostalCode')
            aircon_brand = request.data.get('airconBrand')
            aircon_model = request.data.get('airconModel', 'Standard')
            appointment_time = request.data.get('appointmentStartTime')
            payment_method = request.data.get('paymentMethod', 'cash')

            # Validate required fields
            if not all([name, phone, email, address, postal_code, aircon_brand, appointment_time]):
                return Response({
                    'error': 'Missing required fields. Please provide: name, phone, email, address, postal code, aircon brand, and appointment time.'
                }, status=400)

            # Check if customer already exists by phone or email
            existing_customer = Customers.objects.filter(
                models.Q(customerPhone=phone) | models.Q(customerEmail=email)
            ).first()

            if existing_customer:
                # Use existing customer
                customer = existing_customer
            else:
                # Create temporary guest customer with a default password
                customer = Customers.objects.create(
                    customerName=name,
                    customerPhone=phone,
                    customerEmail=email,
                    customerAddress=address,
                    customerPostalCode=postal_code,
                    customerLocation='',  # Will be populated by get_lat_long if needed
                    customerPassword='GUEST_ACCOUNT_' + str(uuid.uuid4())[:8]  # Random password for guest
                )

            # Create a temporary aircon device for this booking
            aircon_device = CustomerAirconDevices.objects.create(
                customerId=customer,
                airconName=f"{aircon_brand} - {aircon_model}",
                airconBrand=aircon_brand,
                airconModel=aircon_model,
                isActive=True
            )

            # Get nearby technicians and find available slot
            nearby_technicians = get_nearby_technicians(customer.id)
            appointment_end_time = appointment_time + 3600  # 1 hour per aircon

            # Try to assign a technician
            assigned_technician = None
            for tech_id in nearby_technicians:
                technician = Technicians.objects.get(id=tech_id)
                # Check if technician is available (simplified check)
                conflicting_appointments = Appointments.objects.filter(
                    technicianId=technician,
                    appointmentStartTime__lt=appointment_end_time,
                    appointmentEndTime__gt=appointment_time,
                    appointmentStatus__in=['1', '2']  # Pending or Upcoming
                ).exists()

                if not conflicting_appointments:
                    assigned_technician = technician
                    break

            if not assigned_technician and nearby_technicians:
                # Assign to first technician if no one is perfectly available
                assigned_technician = Technicians.objects.get(id=nearby_technicians[0])

            # Calculate travel distance
            travel_distance = 0
            if assigned_technician:
                try:
                    travel_distance = get_distance(customer.id, assigned_technician.id)
                except Exception as e:
                    print(f"Error calculating distance: {e}")
                    travel_distance = 5  # Default 5km

            # Create the appointment
            appointment = Appointments.objects.create(
                customerId=customer,
                technicianId=assigned_technician,
                appointmentStartTime=appointment_time,
                appointmentEndTime=appointment_end_time,
                appointmentStatus='1',  # Pending coordinator approval
                paymentMethod=payment_method,
                travelDistance=travel_distance
            )

            # Link the aircon device to the appointment
            appointment.airconToService.add(aircon_device)

            # Send email confirmation directly to guest's email
            appointment_datetime = datetime.fromtimestamp(appointment_time)
            formatted_time = appointment_datetime.strftime('%B %d, %Y at %I:%M %p')

            email_subject = f"Booking Confirmation - AirServe Appointment"
            email_body = f"""
Dear {name},

Thank you for booking with AirServe!

Your appointment has been confirmed and is pending coordinator approval.

APPOINTMENT DETAILS
===================
Booking Reference: {str(appointment.id)[:8].upper()}
Date & Time: {formatted_time}
Aircon: {aircon_brand} - {aircon_model}
Address: {address}, Singapore {postal_code}

COST BREAKDOWN
==============
Service Fee (1 aircon x $50):    $50.00
Travel Fee:                       $10.00
-------------------------------------------
TOTAL AMOUNT:                     $60.00

Payment Method: {payment_method.replace('_', ' ').title()}

A coordinator will review and approve your appointment shortly. You will receive further updates via email.

If you have any questions, please contact us at support@airserve.com

Thank you for choosing AirServe!

Best regards,
AirServe Team
"""

            try:
                sendMail.send_email(email_subject, email_body, email, 'AirServe System')
                print(f"Confirmation email sent to {email}")
            except Exception as e:
                print(f"Failed to send email: {e}")

            # Return appointment details
            serializer = AppointmentSerializer(appointment)
            response_data = include_all_info(dict(serializer.data))

            return Response({
                'message': 'Booking created successfully! A confirmation email has been sent.',
                'appointment': response_data,
                'customerId': str(customer.id),
                'isGuestBooking': not existing_customer
            }, status=201)

        except Exception as e:
            print(f"Error in guest booking: {e}")
            import traceback
            traceback.print_exc()
            return Response({
                'error': f'Failed to create booking: {str(e)}'
            }, status=500)
