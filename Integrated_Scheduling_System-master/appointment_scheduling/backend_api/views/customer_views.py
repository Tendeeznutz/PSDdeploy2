import logging
import secrets
import re
from datetime import timedelta

from django.contrib.auth.hashers import make_password, check_password
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken

from .format_response import include_all_info, prefetch_related_data
from ..models import PasswordResetToken
from ..scheduling_algo import *
from ..serializers import CustomerSerializer
from ..sg_geo.src import geo_onemap as geo
from ..utils import sendMail
from ..utils.audit_log import log_admin_action
from ..utils.jwt_cookies import set_jwt_cookies

logger = logging.getLogger(__name__)


class LoginRateThrottle(AnonRateThrottle):
    scope = "login"


class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customers.objects.all()
    serializer_class = CustomerSerializer

    def get_permissions(self):
        if self.action in ["login", "create", "forgot_password", "validate_reset_token", "reset_password"]:
            return [AllowAny()]
        return [IsAuthenticated()]

    def _require_role(self, request, allowed_roles):
        """Check that the JWT carries one of the allowed roles."""
        role = getattr(request.auth, "payload", {}).get("role") if request.auth else None
        return role in allowed_roles

    def _get_user_id(self, request):
        """Extract user_id from the JWT payload."""
        return getattr(request.auth, "payload", {}).get("user_id") if request.auth else None

    # GET request — coordinator only
    def list(self, request):
        if not self._require_role(request, ["coordinator"]):
            return Response({"error": "Coordinator access required"}, status=status.HTTP_403_FORBIDDEN)

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
        prefetched = prefetch_related_data(serialized_data_list)
        modified_data_list = [include_all_info(data, prefetched=prefetched) for data in serialized_data_list]
        return Response(modified_data_list)

    # POST request
    def create(self, request):
        serializer = CustomerSerializer(data=request.data)

        customer_password = request.data.get("customerPassword")

        existing_customer = Customers.objects.filter(
            customerEmail=request.data.get("customerEmail")
        ).first()
        if existing_customer:
            return Response(
                {"error": "Customer with this email already exists."},
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
                    "customerEmail": customer.customerEmail,
                    "role": "customer",
                }
                response = Response(response_data, status=status.HTTP_200_OK)
                set_jwt_cookies(response, str(refresh.access_token), str(refresh))
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
        # Customers can view own profile; coordinators can view any
        user_id = self._get_user_id(request)
        if not self._require_role(request, ["coordinator"]) and str(pk) != user_id:
            return Response({"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN)

        item = get_object_or_404(Customers.objects.all(), pk=pk)
        serializer = CustomerSerializer(item)
        return Response(serializer.data)

    # PUT request
    def update(self, request, pk=None):
        return Response(status=405)

    # PATCH request — own profile or coordinator
    def partial_update(self, request, pk=None):
        user_id = self._get_user_id(request)
        is_coordinator = self._require_role(request, ["coordinator"])
        if not is_coordinator and str(pk) != user_id:
            return Response({"error": "Access denied"}, status=status.HTTP_403_FORBIDDEN)

        item = get_object_or_404(Customers.objects.all(), pk=pk)
        request_data = request.data.copy()
        current_password = request.data.get("currentPassword")
        new_password = request_data.get("newPassword")

        if new_password is not None and request_data.get("customerPassword") is None:
            request_data["customerPassword"] = new_password
        if "newPassword" in request_data:
            del request_data["newPassword"]
        if "currentPassword" in request_data:
            del request_data["currentPassword"]

        serializer = CustomerSerializer(item, data=request_data, partial=True)
        if serializer.is_valid():
            # Hash password
            password = request_data.get("customerPassword")
            if password is not None:
                if not is_coordinator:
                    if not current_password:
                        return Response({"error": "Current password is required"}, status=status.HTTP_400_BAD_REQUEST)
                    if not check_password(current_password, item.customerPassword):
                        return Response({"error": "Current password is incorrect"}, status=status.HTTP_400_BAD_REQUEST)
                try:
                    validate_password(password)
                except ValidationError as e:
                    return Response({"error": list(e.messages)}, status=status.HTTP_400_BAD_REQUEST)
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
        Coordinator resets customer password to a secure random temporary password.
        Sends email notification to the customer.
        """
        if not self._require_role(request, ["coordinator"]):
            return Response({"error": "Coordinator access required"}, status=status.HTTP_403_FORBIDDEN)

        customer = get_object_or_404(Customers.objects.all(), pk=pk)

        temp_password = secrets.token_urlsafe(12)
        customer.customerPassword = make_password(temp_password)
        customer.save()

        log_admin_action(request, "password_reset", "customer", str(pk), f"Reset password for {customer.customerName}")

        # Send email notification to customer
        try:
            if customer.customerEmail:
                subject = "Password Reset - AirServe"
                body = f"""Dear {customer.customerName},

Your password has been reset by the coordinator.

Your new temporary password is: {temp_password}

Please log in and change your password as soon as possible.

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
                "message": f"Password for {customer.customerName} has been reset",
                "customerName": customer.customerName,
            },
            status=status.HTTP_200_OK,
        )

    # DELETE request — coordinator only
    def destroy(self, request, pk=None):
        if not self._require_role(request, ["coordinator"]):
            return Response({"error": "Coordinator access required"}, status=status.HTTP_403_FORBIDDEN)

        item = get_object_or_404(Customers.objects.all(), pk=pk)
        item.delete()
        log_admin_action(request, "account_delete", "customer", str(pk))
        return Response(status=204)

    # ── Forgot password flow (mirrors technician flow) ──────────────────

    @action(detail=False, methods=["post"], url_path="forgot-password")
    def forgot_password(self, request):
        """
        Request password reset — sends email with reset link.
        Always returns success to prevent account enumeration.
        """
        self.throttle_classes = [LoginRateThrottle]
        self.check_throttles(request)

        email = request.data.get("email")
        if not email:
            return Response(
                {"error": "Email is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Always return success to prevent enumeration
        success_msg = {"message": "If an account with that email exists, a reset link has been sent."}

        customer = Customers.objects.filter(customerEmail=email).first()
        if not customer:
            return Response(success_msg, status=status.HTTP_200_OK)

        # Invalidate existing tokens
        PasswordResetToken.objects.filter(
            userType="customer", userId=customer.id, isUsed=False
        ).update(isUsed=True)

        # Generate secure token
        token = secrets.token_urlsafe(32)
        expires_at = timezone.now() + timedelta(hours=24)
        PasswordResetToken.objects.create(
            userType="customer", userId=customer.id, token=token, expiresAt=expires_at
        )

        # Send email
        try:
            from django.conf import settings as django_settings
            frontend_base = getattr(django_settings, "FRONTEND_BASE_URL", "http://localhost:3000")
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
            sendMail.send_email(subject, body, customer.customerEmail, "AirServe")
        except Exception as e:
            logger.exception("Failed to send password reset email to customer: %s", e)

        return Response(success_msg, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="validate-reset-token")
    def validate_reset_token(self, request):
        """Validate if a password reset token is valid and not expired."""
        token = request.data.get("token")
        if not token:
            return Response({"valid": False, "error": "Token is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            reset_token = PasswordResetToken.objects.get(token=token, userType="customer")
            if reset_token.isUsed:
                return Response({"valid": False, "error": "Token has already been used"}, status=status.HTTP_400_BAD_REQUEST)
            if timezone.now() > reset_token.expiresAt:
                return Response({"valid": False, "error": "Token has expired"}, status=status.HTTP_400_BAD_REQUEST)

            customer = Customers.objects.get(id=reset_token.userId)
            return Response({"valid": True, "customerName": customer.customerName}, status=status.HTTP_200_OK)
        except (PasswordResetToken.DoesNotExist, Customers.DoesNotExist):
            return Response({"valid": False, "error": "Invalid token"}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["post"], url_path="reset-password")
    def reset_password(self, request):
        """
        Reset password using token.
        Password requirements: minimum 8 alphanumeric characters, at least 3 numbers.
        """
        token = request.data.get("token")
        new_password = request.data.get("newPassword")

        if not token or not new_password:
            return Response({"error": "Token and new password are required"}, status=status.HTTP_400_BAD_REQUEST)

        if len(new_password) < 8:
            return Response({"error": "Password must be at least 8 characters long"}, status=status.HTTP_400_BAD_REQUEST)

        if not re.search(r"[a-zA-Z]", new_password):
            return Response({"error": "Password must contain at least one letter"}, status=status.HTTP_400_BAD_REQUEST)

        digit_count = sum(1 for c in new_password if c.isdigit())
        if digit_count < 3:
            return Response({"error": "Password must contain at least 3 numbers"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            reset_token = PasswordResetToken.objects.get(token=token, userType="customer")
            if reset_token.isUsed:
                return Response({"error": "Token has already been used"}, status=status.HTTP_400_BAD_REQUEST)
            if timezone.now() > reset_token.expiresAt:
                return Response({"error": "Token has expired"}, status=status.HTTP_400_BAD_REQUEST)

            customer = Customers.objects.get(id=reset_token.userId)
            customer.customerPassword = make_password(new_password)
            customer.save()

            reset_token.isUsed = True
            reset_token.save()

            return Response({"message": "Password has been reset successfully"}, status=status.HTTP_200_OK)
        except (PasswordResetToken.DoesNotExist, Customers.DoesNotExist):
            return Response({"error": "Invalid token"}, status=status.HTTP_400_BAD_REQUEST)
