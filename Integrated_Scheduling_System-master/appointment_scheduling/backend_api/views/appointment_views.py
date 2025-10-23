from django.shortcuts import get_object_or_404
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .format_response import include_all_info
from ..scheduling_algo import *
from ..serializers import AppointmentSerializer
from ..utils import sendMail


class AppointmentViewSet(viewsets.ModelViewSet):
    serializer_class = AppointmentSerializer

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
            serializer.save()
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
        if serializer.is_valid():
            if serializer.validated_data.get('technicianId') is not None and item.appointmentStatus != '3':
                serializer.validated_data['appointmentStatus'] = '2'
            elif serializer.validated_data.get('technicianId') is None and item.appointmentStatus != '3':
                serializer.validated_data['appointmentStatus'] = '1'
            serializer.save()
            serializer_data = dict(serializer.data)
            modified_data = include_all_info(serializer_data)
            return Response(modified_data)
        return Response(serializer.errors, status=400)

    # DELETE request
    def destroy(self, request, pk=None):
        item = get_object_or_404(Appointments.objects.all(), pk=pk)
        item.delete()
        return Response(status=204)
