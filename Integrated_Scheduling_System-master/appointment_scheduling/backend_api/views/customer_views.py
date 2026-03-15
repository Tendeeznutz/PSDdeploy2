import logging
import re
import secrets
from datetime import timedelta

from django.contrib.auth.hashers import make_password, check_password
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken

from .format_response import include_all_info
from ..models import Customers, PasswordResetToken
from ..serializers import CustomerSerializer
from ..sg_geo.src import geo_onemap as geo
from ..utils import sendMail
from ..utils.jwt_cookies import set_jwt_cookies

logger = logging.getLogger(__name__)


class LoginRateThrottle(AnonRateThrottle):
    rate = "5/minute"


class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customers.objects.all()
    serializer_class = CustomerSerializer

    def get_permissions(self):
        if self.action in ["login", "create", "forgot_password", "validate_reset_token", "reset_password"]:
            return [AllowAny()]
        return [IsAuthenticated()]

    def _get_user_id_from_token(self, request):
        """Extract user_id from the JWT token on the request."""
        if hasattr(request, "auth") and request.auth:
            return request.auth.get("user_id")
        return None

    # GET request — coordinators can list/search; customers cannot browse other customers
    def list(self, request):
        role = request.auth.get("role") if request.auth else None
        if role != "coordinator":
            return Response(
                {"error": "Only coordinators can list customers."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if request.query_params.get("customerEmail") is not None:
            queryset = Customers.objects.filter(
                customerEmail__icontains=request.query_params.get("customerEmail")
            )
        elif request.query_params.get("customerName") is not None:
            queryset = Customers.objects.filter(
                customerName__icontains=request.query_params.get("customerName")
            )
        elif request.query_params.get("customerPhone") is not None:
            queryset = Customers.objects.filter(
                customerPhone__icontains=request.query_params.get("customerPhone")
            )
        elif request.query_params.get("customerPostalCode") is not None:
            queryset = Customers.objects.filter(
                customerPostalCode__icontains=request.query_params.get(
                    "customerPostalCode"
                )
            )
        elif request.GET:
            return Response(status=400)
        else:
            queryset = Customers.objects.all()

        serializer = CustomerSerializer(queryset, many=True)
        serialized_data = serializer.data
        serialized_data_list = [dict(item) for item in serialized_data]
        modified_data_list = [include_all_info(data) for data in serialized_data_list]
        return Response(modified_data_list)

    # POST request
    def create(self, request):
        try:
            serializer = CustomerSerializer(data=request.data)

            customer_password = request.data.get("customerPassword")
            if not customer_password:
                return Response(
                    {"error": "Password is required."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            existing_customer = Customers.objects.filter(
                customerEmail=request.data.get("customerEmail")
            ).first()
            if existing_customer:
                return Response(
                    {"error": "An account with these details already exists."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            existing_phone = Customers.objects.filter(
                customerPhone=request.data.get("customerPhone")
            ).first()
            if existing_phone:
                return Response(
                    {"error": "An account with these details already exists."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if serializer.is_valid():
                serializer.validated_data["customerPassword"] = make_password(
                    customer_password
                )
                serializer.validated_data["customerLocation"] = (
                    geo.get_location_from_postal(
                        serializer.validated_data["customerPostalCode"]
                    )
                )
                serializer.save()
                return Response(serializer.data, status=status.HTTP_201_CREATED)

            # Return error response
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.exception("Customer registration error: %s", e)
            return Response(
                {"error": f"Registration failed: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=False, methods=["post"], url_path="login")
    def login(self, request, *args, **kwargs):
        self.throttle_classes = [LoginRateThrottle]
        self.check_throttles(request)
        try:
            email = request.data.get("email")
            password = request.data.get("password")

            if not email or not password:
                return Response(
                    {"error": "Email and password are required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            customer = Customers.objects.filter(customerEmail=email).first()

            if customer is None:
                return Response(
                    {"error": "Invalid credentials"},
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            if check_password(password, customer.customerPassword):
                refresh = RefreshToken()
                refresh["user_id"] = str(customer.id)
                refresh["role"] = "customer"
                response_data = {
                    "customer_id": customer.id,
                    "customerName": customer.customerName,
                    "role": "customer",
                }
                response = Response(response_data, status=status.HTTP_200_OK)
                set_jwt_cookies(
                    response, str(refresh.access_token), str(refresh)
                )
                return response
            else:
                return Response(
                    {"error": "Invalid credentials"},
                    status=status.HTTP_401_UNAUTHORIZED,
                )
        except Exception as e:
            logger.exception("Customer login error")
            return Response(
                {"error": "Login failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def retrieve(self, request, pk=None):
        item = get_object_or_404(Customers.objects.all(), pk=pk)
        # Customers can only view their own profile; coordinators can view any
        token_user_id = self._get_user_id_from_token(request)
        role = request.auth.get("role") if request.auth else None
        if role != "coordinator" and str(item.id) != token_user_id:
            return Response(
                {"error": "You can only view your own profile."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = CustomerSerializer(item)
        return Response(serializer.data)

    # PUT request
    def update(self, request, pk=None):
        return Response(status=405)

    # PATCH request
    def partial_update(self, request, pk=None):
        item = get_object_or_404(Customers.objects.all(), pk=pk)
        # Customers can only update their own profile; coordinators can update any
        token_user_id = self._get_user_id_from_token(request)
        role = request.auth.get("role") if request.auth else None
        if role != "coordinator" and str(item.id) != token_user_id:
            return Response(
                {"error": "You can only update your own profile."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = CustomerSerializer(item, data=request.data, partial=True)
        if serializer.is_valid():
            # Hash password
            password = request.data.get("customerPassword")
            if password is not None:
                serializer.validated_data["customerPassword"] = make_password(password)
            # get location from postal code
            if serializer.validated_data.get("customerPostalCode") is not None:
                serializer.validated_data["customerLocation"] = (
                    geo.get_location_from_postal(
                        serializer.validated_data["customerPostalCode"]
                    )
                )
            # Save data to database
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    @action(detail=True, methods=["post"], url_path="coordinator-reset-password")
    def coordinator_reset_password(self, request, pk=None):
        """
        Coordinator sends a password reset link to the customer's email.
        """
        role = request.auth.get("role") if request.auth else None
        if role != "coordinator":
            return Response(
                {"error": "Only coordinators can reset customer passwords."},
                status=status.HTTP_403_FORBIDDEN,
            )
        customer = get_object_or_404(Customers.objects.all(), pk=pk)

        if not customer.customerEmail:
            return Response(
                {"error": "Customer does not have an email on file."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Invalidate any existing tokens
        PasswordResetToken.objects.filter(
            userType="customer", userId=customer.id, isUsed=False
        ).update(isUsed=True)

        # Generate a secure token
        token = secrets.token_urlsafe(32)
        expires_at = timezone.now() + timedelta(hours=24)

        PasswordResetToken.objects.create(
            userType="customer", userId=customer.id, token=token, expiresAt=expires_at
        )

        # Send email with reset link
        try:
            from django.conf import settings

            frontend_base = getattr(
                settings, "FRONTEND_BASE_URL", "http://localhost:3000"
            )
            reset_url = f"{frontend_base.rstrip('/')}/reset-password?token={token}&userType=customer"

            subject = "Password Reset - AirServe"
            body = f"""Dear {customer.customerName},

Your password has been reset by the coordinator.

Click the link below to set a new password:
{reset_url}

This link will expire in 24 hours.

Best regards,
AirServe Team"""
            sendMail.send_email(
                subject, body, customer.customerEmail, "AirServe"
            )
        except Exception as e:
            logger.exception(
                "Failed to send password reset notification to customer %s: %s", pk, e
            )

        return Response(
            {
                "message": f"Password reset link sent to {customer.customerName}'s email",
                "customerName": customer.customerName,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["post"], url_path="forgot-password")
    def forgot_password(self, request):
        """
        Customer requests password reset - sends email with reset link.
        Expects: { email: "customer@example.com" }
        """
        email = request.data.get("email")
        if not email:
            return Response(
                {"error": "Email is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            customer = Customers.objects.get(customerEmail=email)
        except Customers.DoesNotExist:
            # Return success even if not found to prevent email enumeration
            return Response(
                {"message": "If an account with that email exists, a reset link has been sent."},
                status=status.HTTP_200_OK,
            )

        # Invalidate any existing tokens
        PasswordResetToken.objects.filter(
            userType="customer", userId=customer.id, isUsed=False
        ).update(isUsed=True)

        # Generate a secure token
        token = secrets.token_urlsafe(32)
        expires_at = timezone.now() + timedelta(hours=24)

        PasswordResetToken.objects.create(
            userType="customer", userId=customer.id, token=token, expiresAt=expires_at
        )

        # Send email with reset link
        try:
            from django.conf import settings

            frontend_base = getattr(
                settings, "FRONTEND_BASE_URL", "http://localhost:3000"
            )
            reset_url = f"{frontend_base.rstrip('/')}/reset-password?token={token}&userType=customer"

            subject = "Password Reset Request - AirServe"
            body = f"""Dear {customer.customerName},

You have requested to reset your password.

Click the link below to reset your password:
{reset_url}

This link will expire in 24 hours.

If you did not request this password reset, please ignore this email.

Best regards,
AirServe Team"""

            sendMail.send_email(subject, body, email, "AirServe")
        except Exception as e:
            logger.exception("Failed to send password reset email to customer: %s", e)

        return Response(
            {"message": "If an account with that email exists, a reset link has been sent."},
            status=status.HTTP_200_OK,
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
            reset_token = PasswordResetToken.objects.get(token=token, userType="customer")

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

            customer = Customers.objects.get(id=reset_token.userId)
            return Response(
                {
                    "valid": True,
                    "customerName": customer.customerName,
                },
                status=status.HTTP_200_OK,
            )

        except PasswordResetToken.DoesNotExist:
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

        digit_count = sum(1 for c in new_password if c.isdigit())
        if digit_count < 3:
            return Response(
                {"error": "Password must contain at least 3 numbers"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            reset_token = PasswordResetToken.objects.get(token=token, userType="customer")

            if reset_token.isUsed:
                return Response(
                    {"error": "Token has already been used"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if timezone.now() > reset_token.expiresAt:
                return Response(
                    {"error": "Token has expired"}, status=status.HTTP_400_BAD_REQUEST
                )

            # Update password and mark token as used atomically
            with transaction.atomic():
                locked_token = PasswordResetToken.objects.select_for_update().get(pk=reset_token.pk)
                if locked_token.isUsed:
                    return Response(
                        {"error": "Token has already been used"},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                customer = Customers.objects.get(id=locked_token.userId)
                customer.customerPassword = make_password(new_password)
                customer.save()

                locked_token.isUsed = True
                locked_token.save()

            return Response(
                {"message": "Password has been reset successfully"},
                status=status.HTTP_200_OK,
            )

        except PasswordResetToken.DoesNotExist:
            return Response(
                {"error": "Invalid token"}, status=status.HTTP_400_BAD_REQUEST
            )

    # DELETE request — coordinators only
    def destroy(self, request, pk=None):
        role = request.auth.get("role") if request.auth else None
        if role != "coordinator":
            return Response(
                {"error": "Only coordinators can delete customer accounts."},
                status=status.HTTP_403_FORBIDDEN,
            )
        item = get_object_or_404(Customers.objects.all(), pk=pk)
        item.delete()
        return Response(status=204)
