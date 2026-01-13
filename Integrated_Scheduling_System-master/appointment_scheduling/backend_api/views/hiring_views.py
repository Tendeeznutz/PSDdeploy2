from datetime import datetime
from django.contrib.auth.hashers import make_password
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from ..models import TechnicianHiringApplication, Technicians
from ..serializers import TechnicianHiringApplicationSerializer
from ..sg_geo.src import geo_onemap as geo


class TechnicianHiringApplicationViewSet(viewsets.ModelViewSet):
    queryset = TechnicianHiringApplication.objects.all()
    serializer_class = TechnicianHiringApplicationSerializer

    def list(self, request):
        """Get all hiring applications with optional filtering"""
        queryset = TechnicianHiringApplication.objects.all()

        # Filter by application status
        if request.query_params.get('applicationStatus'):
            queryset = queryset.filter(applicationStatus=request.query_params.get('applicationStatus'))

        # Filter by applicant name
        if request.query_params.get('applicantName'):
            queryset = queryset.filter(applicantName__icontains=request.query_params.get('applicantName'))

        # Filter by NRIC
        if request.query_params.get('nric'):
            queryset = queryset.filter(nric=request.query_params.get('nric'))

        serializer = self.serializer_class(queryset, many=True)
        return Response(serializer.data)

    def retrieve(self, request, pk):
        """Get a specific hiring application"""
        application = get_object_or_404(TechnicianHiringApplication.objects.all(), pk=pk)
        serializer = self.serializer_class(application)
        return Response(serializer.data)

    def create(self, request):
        """Create a new hiring application (Stage 1: Personal Details)"""
        print("POST: Create hiring application")
        print(request.data)

        serializer = self.serializer_class(data=request.data)
        if serializer.is_valid():
            # Set initial status to personal_details
            serializer.validated_data['applicationStatus'] = 'personal_details'
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        print("Validation errors:", serializer.errors)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def partial_update(self, request, pk):
        """Update a hiring application"""
        print(f"PATCH: Update hiring application {pk}")
        application = get_object_or_404(TechnicianHiringApplication.objects.all(), pk=pk)
        serializer = self.serializer_class(application, data=request.data, partial=True)

        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, pk):
        """Delete a hiring application"""
        print(f"DELETE: Delete hiring application {pk}")
        application = get_object_or_404(TechnicianHiringApplication.objects.all(), pk=pk)
        application.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'], url_path='confirm-personal-details')
    def confirm_personal_details(self, request, pk=None):
        """Confirm Stage 1 (Personal Details) and move to Stage 2 (Bank Info)"""
        print(f"POST: Confirm personal details for application {pk}")
        application = get_object_or_404(TechnicianHiringApplication.objects.all(), pk=pk)

        # Update confirmation status
        application.personalDetailsConfirmed = True
        application.personalDetailsConfirmedAt = datetime.now()
        application.applicationStatus = 'bank_info'
        application.save()

        serializer = self.serializer_class(application)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='submit-bank-info')
    def submit_bank_info(self, request, pk=None):
        """Submit Stage 2 (Bank Info) and move to Stage 3 (Coordinator Review)"""
        print(f"POST: Submit bank info for application {pk}")
        application = get_object_or_404(TechnicianHiringApplication.objects.all(), pk=pk)

        # Validate that personal details were confirmed
        if not application.personalDetailsConfirmed:
            return Response(
                {'error': 'Personal details must be confirmed first'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Update bank information
        application.bankName = request.data.get('bankName')
        application.bankAccountNumber = request.data.get('bankAccountNumber')
        application.bankAccountHolderName = request.data.get('bankAccountHolderName')
        application.bankInfoConfirmed = request.data.get('bankInfoConfirmed', False)
        application.bankInfoConfirmedAt = datetime.now()
        application.applicationStatus = 'coordinator_review'
        application.save()

        serializer = self.serializer_class(application)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='coordinator-approve')
    def coordinator_approve(self, request, pk=None):
        """
        Stage 3: Coordinator approves application and creates technician account
        """
        print(f"POST: Coordinator approve application {pk}")
        application = get_object_or_404(TechnicianHiringApplication.objects.all(), pk=pk)

        # Validate that bank info was submitted
        if not application.bankInfoConfirmed:
            return Response(
                {'error': 'Bank information must be confirmed first'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get coordinator details and pay rate from request
        coordinator_id = request.data.get('coordinatorId')
        pay_rate = request.data.get('payRate')
        coordinator_notes = request.data.get('coordinatorNotes', '')
        coordinator_approved = request.data.get('coordinatorApproved', False)

        if not coordinator_approved:
            return Response(
                {'error': 'Coordinator must confirm approval'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Update application with coordinator details
        application.coordinatorId_id = coordinator_id
        application.payRate = pay_rate
        application.coordinatorNotes = coordinator_notes
        application.coordinatorApproved = True
        application.coordinatorApprovedAt = datetime.now()
        application.applicationStatus = 'approved'

        # Create the technician account
        try:
            # Generate a temporary password (should be sent to technician's email)
            temp_password = f"temp{application.nric[-4:]}"

            technician = Technicians.objects.create(
                technicianName=application.applicantName,
                technicianPostalCode=application.applicantPostalCode,
                technicianAddress=application.applicantAddress,
                technicianLocation=geo.get_location_from_postal(application.applicantPostalCode),
                technicianPhone=application.applicantPhone,
                technicianPassword=make_password(temp_password),
                technicianStatus='1',  # Available
                technicianTravelType='walk'  # Default
            )

            # Link the created technician to the application
            application.createdTechnician = technician
            application.save()

            serializer = self.serializer_class(application)
            response_data = serializer.data
            response_data['technicianId'] = str(technician.id)
            response_data['temporaryPassword'] = temp_password

            return Response(response_data, status=status.HTTP_200_OK)

        except Exception as e:
            return Response(
                {'error': f'Failed to create technician account: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'], url_path='coordinator-reject')
    def coordinator_reject(self, request, pk=None):
        """Coordinator rejects application"""
        print(f"POST: Coordinator reject application {pk}")
        application = get_object_or_404(TechnicianHiringApplication.objects.all(), pk=pk)

        coordinator_id = request.data.get('coordinatorId')
        coordinator_notes = request.data.get('coordinatorNotes', '')

        application.coordinatorId_id = coordinator_id
        application.coordinatorNotes = coordinator_notes
        application.coordinatorApproved = False
        application.coordinatorApprovedAt = datetime.now()
        application.applicationStatus = 'rejected'
        application.save()

        serializer = self.serializer_class(application)
        return Response(serializer.data)
