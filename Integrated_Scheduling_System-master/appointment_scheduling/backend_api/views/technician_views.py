import logging
import secrets
import re
from datetime import datetime, timedelta
from django.contrib.auth.hashers import make_password, check_password
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from ..scheduling_algo import *
from ..models import TechnicianPasswordResetToken, TechnicianHiringApplication
from ..serializers import TechnicianSerializer
from ..sg_geo.src import geo_onemap as geo
from ..utils import sendMail

logger = logging.getLogger(__name__)


class TechnicianViewSet(viewsets.ModelViewSet):
    queryset = Technicians.objects.all()
    serializer_class = TechnicianSerializer

    def get_permissions(self):
        if self.action in [
            "login",
            "forgot_password",
            "validate_reset_token",
            "reset_password",
        ]:
            return [AllowAny()]
        return [IsAuthenticated()]

    # GET request of all techicians data
    def list(self, request):
        if request.query_params.get("technicianName") is not None:
            queryset = Technicians.objects.filter(
                technicianName__icontains=request.query_params.get("technicianName")
            )
        elif request.query_params.get("technicianId") is not None:
            queryset = Technicians.objects.filter(
                id=request.query_params.get("technicianId")
            )
        elif request.query_params.get("technicianPostalCode") is not None:
            queryset = Technicians.objects.filter(
                technicianPostalCode__icontains=request.query_params.get(
                    "technicianPostalCode"
                )
            )
        elif request.query_params.get("technicianPhone") is not None:
            queryset = Technicians.objects.filter(
                technicianPhone__icontains=request.query_params.get("technicianPhone")
            )
        elif request.query_params.get("technicianStatus") is not None:
            queryset = Technicians.objects.filter(
                technicianStatus__icontains=request.query_params.get("technicianStatus")
            )
        elif request.query_params.get("technicianTravelType") is not None:
            queryset = Technicians.objects.filter(
                technicianTravelType__icontains=request.query_params.get(
                    "technicianTravelType"
                )
            )
        elif request.GET:
            return Response(status=400)
        else:
            queryset = Technicians.objects.all()

        serializer = self.serializer_class(queryset, many=True)
        # return response
        return Response(serializer.data)

    # GET request of a technician's data
    def retrieve(self, request, pk):
        item = get_object_or_404(Technicians.objects.all(), pk=pk)
        serializer = self.serializer_class(item)
        return Response(serializer.data)

    # POST request to create technician
    def create(self, request):
        serializer = self.serializer_class(data=request.data)
        password = request.data.get("technicianPassword")
        if serializer.is_valid():
            serializer.validated_data["technicianPassword"] = make_password(password)
            serializer.validated_data["technicianLocation"] = (
                geo.get_location_from_postal(
                    serializer.validated_data["technicianPostalCode"]
                )
            )
            serializer.save()
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)

    # PUT request to update technician data
    def update(self, request, pk):
        return Response(status=405)

    # PATCH request
    def partial_update(self, request, pk):
        item = get_object_or_404(Technicians.objects.all(), pk=pk)
        serializer = self.serializer_class(item, data=request.data, partial=True)
        if serializer.is_valid():
            # hash password
            password = request.data.get("technicianPassword")
            if password is not None:
                serializer.validated_data["technicianPassword"] = make_password(
                    password
                )
            # get location from postal code
            if serializer.validated_data.get("technicianPostalCode") is not None:
                serializer.validated_data["technicianLocation"] = (
                    geo.get_location_from_postal(
                        serializer.validated_data["technicianPostalCode"]
                    )
                )
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    @action(detail=False, methods=["post"], url_path="login")
    def login(self, request, *args, **kwargs):
        try:
            phone = request.data.get("email")
            password = request.data.get("password")

            if not phone or not password:
                return Response(
                    {"detail": "Phone and password are required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            technician = Technicians.objects.filter(technicianPhone=phone).first()

            if technician is None:
                return Response(
                    {"detail": "Invalid credentials"},
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            # Check if technician account is active
            if not technician.isActive:
                return Response(
                    {
                        "detail": "Your account has been deactivated. Please contact the coordinator."
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )

            if check_password(password, technician.technicianPassword):
                refresh = RefreshToken()
                refresh["user_id"] = str(technician.id)
                refresh["role"] = "technician"
                response_data = {
                    "technician_phone": technician.technicianPhone,
                    "technician_id": technician.id,
                    "technicianName": technician.technicianName,
                    "role": "technician",
                    "access": str(refresh.access_token),
                    "refresh": str(refresh),
                }
                return Response(response_data, status=status.HTTP_200_OK)
            return Response(
                {"detail": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED
            )

        except Exception as e:
            logger.exception("Technician login error")
            return Response(
                {"detail": "Login failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    # DELETE request to delete technician
    def destroy(self, request, pk):
        item = get_object_or_404(Technicians.objects.all(), pk=pk)
        item.delete()
        return Response(status=204)

    @action(detail=False, methods=["post"], url_path="forgot-password")
    def forgot_password(self, request):
        """
        Request password reset - sends email with reset link.
        Expects: { phone: "12345678" }
        """
        phone = request.data.get("phone")
        if not phone:
            return Response(
                {"error": "Phone number is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            technician = Technicians.objects.get(technicianPhone=phone)
        except Technicians.DoesNotExist:
            return Response(
                {"error": "No technician found with this phone number"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Find the associated hiring application to get email
        try:
            application = TechnicianHiringApplication.objects.get(
                createdTechnician=technician
            )
            email = application.applicantEmail
        except TechnicianHiringApplication.DoesNotExist:
            return Response(
                {"error": "No email associated with this technician account"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Invalidate any existing tokens
        TechnicianPasswordResetToken.objects.filter(
            technician=technician, isUsed=False
        ).update(isUsed=True)

        # Generate a secure token
        token = secrets.token_urlsafe(32)
        expires_at = timezone.now() + timedelta(hours=24)

        # Create the token
        TechnicianPasswordResetToken.objects.create(
            technician=technician, token=token, expiresAt=expires_at
        )

        # Send email with reset link
        try:
            from django.conf import settings

            frontend_base = getattr(
                settings, "FRONTEND_BASE_URL", "http://localhost:3000"
            )
            reset_url = f"{frontend_base.rstrip('/')}/reset-password?token={token}"

            subject = "Password Reset Request - AirServe"
            body = f"""Dear {technician.technicianName},

You have requested to reset your password.

Click the link below to reset your password:
{reset_url}

This link will expire in 24 hours.

If you did not request this password reset, please ignore this email.

Best regards,
AirServe Team"""

            sendMail.send_email(subject, body, email, "AirServe")
            return Response(
                {"message": "Password reset email sent successfully"},
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            return Response(
                {"error": "Failed to send password reset email"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=False, methods=["get"], url_path="validate-reset-token")
    def validate_reset_token(self, request):
        """
        Validate if a password reset token is valid and not expired.
        Query param: token
        """
        token = request.query_params.get("token")
        if not token:
            return Response(
                {"valid": False, "error": "Token is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            reset_token = TechnicianPasswordResetToken.objects.get(token=token)

            if reset_token.isUsed:
                return Response(
                    {"valid": False, "error": "Token has already been used"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if timezone.now() > reset_token.expiresAt:
                return Response(
                    {"valid": False, "error": "Token has expired"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            return Response(
                {
                    "valid": True,
                    "technicianName": reset_token.technician.technicianName,
                },
                status=status.HTTP_200_OK,
            )

        except TechnicianPasswordResetToken.DoesNotExist:
            return Response(
                {"valid": False, "error": "Invalid token"},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=False, methods=["post"], url_path="reset-password")
    def reset_password(self, request):
        """
        Reset password using token.
        Expects: { token: "xxx", newPassword: "xxx" }
        Password requirements: minimum 8 alphanumeric characters, at least 3 numbers.
        """
        token = request.data.get("token")
        new_password = request.data.get("newPassword")

        if not token or not new_password:
            return Response(
                {"error": "Token and new password are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate password requirements
        if len(new_password) < 8:
            return Response(
                {"error": "Password must be at least 8 characters long"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not re.match(r"^[a-zA-Z0-9]+$", new_password):
            return Response(
                {"error": "Password must contain only alphanumeric characters"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        digit_count = sum(1 for c in new_password if c.isdigit())
        if digit_count < 3:
            return Response(
                {"error": "Password must contain at least 3 numbers"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            reset_token = TechnicianPasswordResetToken.objects.get(token=token)

            if reset_token.isUsed:
                return Response(
                    {"error": "Token has already been used"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if timezone.now() > reset_token.expiresAt:
                return Response(
                    {"error": "Token has expired"}, status=status.HTTP_400_BAD_REQUEST
                )

            # Update password
            technician = reset_token.technician
            technician.technicianPassword = make_password(new_password)
            technician.save()

            # Mark token as used
            reset_token.isUsed = True
            reset_token.save()

            return Response(
                {"message": "Password has been reset successfully"},
                status=status.HTTP_200_OK,
            )

        except TechnicianPasswordResetToken.DoesNotExist:
            return Response(
                {"error": "Invalid token"}, status=status.HTTP_400_BAD_REQUEST
            )

    @action(detail=True, methods=["post"], url_path="coordinator-reset-password")
    def coordinator_reset_password(self, request, pk=None):
        """
        Coordinator resets technician password to a secure random temporary password.
        """
        technician = get_object_or_404(Technicians.objects.all(), pk=pk)

        default_password = secrets.token_urlsafe(12)
        technician.technicianPassword = make_password(default_password)
        technician.save()

        # Optionally send email notification
        try:
            application = TechnicianHiringApplication.objects.filter(
                createdTechnician=technician
            ).first()
            if application and application.applicantEmail:
                subject = "Password Reset - AirServe"
                body = f"""Dear {technician.technicianName},

Your password has been reset by the coordinator.

Your new temporary password is: {default_password}

Please log in and change your password.

Best regards,
AirServe Team"""
                sendMail.send_email(
                    subject, body, application.applicantEmail, "AirServe"
                )
        except Exception as e:
            logger.exception(
                "Failed to send password reset notification to technician %s: %s", pk, e
            )

        return Response(
            {
                "message": f"Password for {technician.technicianName} has been reset to default",
                "technicianName": technician.technicianName,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="toggle-active-status")
    def toggle_active_status(self, request, pk=None):
        """
        Toggle technician's active/inactive status (for firing/rehiring).
        Expects: { reason: "optional reason for deactivation" }
        """
        technician = get_object_or_404(Technicians.objects.all(), pk=pk)
        reason = request.data.get("reason", "")

        if technician.isActive:
            # Deactivating technician
            technician.isActive = False
            technician.deactivatedAt = timezone.now()
            technician.deactivationReason = reason
            technician.save()

            # Send notification email
            try:
                application = TechnicianHiringApplication.objects.filter(
                    createdTechnician=technician
                ).first()
                if application and application.applicantEmail:
                    subject = "Account Status Update - AirServe"
                    body = f"""Dear {technician.technicianName},

Your technician account has been deactivated.

If you have any questions, please contact your coordinator.

Best regards,
AirServe Team"""
                    sendMail.send_email(
                        subject, body, application.applicantEmail, "AirServe"
                    )
            except Exception as e:
                logger.exception(
                    "Failed to send deactivation notification to technician %s: %s",
                    pk,
                    e,
                )

            return Response(
                {
                    "message": f"{technician.technicianName} has been deactivated",
                    "technicianName": technician.technicianName,
                    "isActive": False,
                },
                status=status.HTTP_200_OK,
            )
        else:
            # Reactivating technician
            technician.isActive = True
            technician.deactivatedAt = None
            technician.deactivationReason = None
            technician.save()

            # Send notification email
            try:
                application = TechnicianHiringApplication.objects.filter(
                    createdTechnician=technician
                ).first()
                if application and application.applicantEmail:
                    subject = "Account Reactivated - AirServe"
                    body = f"""Dear {technician.technicianName},

Your technician account has been reactivated. You can now log in and resume work.

Best regards,
AirServe Team"""
                    sendMail.send_email(
                        subject, body, application.applicantEmail, "AirServe"
                    )
            except Exception as e:
                logger.exception(
                    "Failed to send reactivation notification to technician %s: %s",
                    pk,
                    e,
                )

            return Response(
                {
                    "message": f"{technician.technicianName} has been reactivated",
                    "technicianName": technician.technicianName,
                    "isActive": True,
                },
                status=status.HTTP_200_OK,
            )

    @action(detail=True, methods=["post"], url_path="toggle-status")
    def toggle_status(self, request, pk=None):
        """
        Toggle technician's availability status (Available/Unavailable).
        Only coordinators should use this endpoint.
        """
        technician = get_object_or_404(Technicians.objects.all(), pk=pk)

        if technician.technicianStatus == "1":
            technician.technicianStatus = "2"
            technician.save()
            return Response(
                {
                    "message": f"{technician.technicianName} is now Unavailable",
                    "technicianName": technician.technicianName,
                    "technicianStatus": "2",
                },
                status=status.HTTP_200_OK,
            )
        else:
            technician.technicianStatus = "1"
            technician.save()
            return Response(
                {
                    "message": f"{technician.technicianName} is now Available",
                    "technicianName": technician.technicianName,
                    "technicianStatus": "1",
                },
                status=status.HTTP_200_OK,
            )
