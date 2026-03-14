import logging

from django.contrib.auth.hashers import make_password, check_password
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken

from ..models import Coordinators
from ..serializers import CoordinatorSerializer
from ..utils.jwt_cookies import set_jwt_cookies

logger = logging.getLogger(__name__)


class LoginRateThrottle(AnonRateThrottle):
    rate = "5/minute"


class CoordinatorViewSet(viewsets.ModelViewSet):
    queryset = Coordinators.objects.all()
    serializer_class = CoordinatorSerializer

    def get_permissions(self):
        if self.action == "login":
            return [AllowAny()]
        return [IsAuthenticated()]

    def _get_role(self, request):
        if hasattr(request, "auth") and request.auth:
            return request.auth.get("role")
        return None

    # GET request — coordinators only
    def list(self, request):
        if self._get_role(request) != "coordinator":
            return Response(
                {"error": "Only coordinators can list coordinator accounts."},
                status=status.HTTP_403_FORBIDDEN,
            )
        queryset = Coordinators.objects.all()
        serializer = self.serializer_class(queryset, many=True)
        return Response(serializer.data)

    # GET request — coordinators only
    def retrieve(self, request, pk):
        if self._get_role(request) != "coordinator":
            return Response(
                {"error": "Only coordinators can view coordinator accounts."},
                status=status.HTTP_403_FORBIDDEN,
            )
        item = get_object_or_404(Coordinators.objects.all(), pk=pk)
        serializer = self.serializer_class(item)
        return Response(serializer.data)

    # POST request — coordinators only
    def create(self, request):
        if self._get_role(request) != "coordinator":
            return Response(
                {"error": "Only coordinators can create coordinator accounts."},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = self.serializer_class(data=request.data)
        password = request.data.get("coordinatorPassword")
        if serializer.is_valid():
            serializer.validated_data["coordinatorPassword"] = make_password(password)
            serializer.save()
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)

    # PUT request
    def update(self, request, pk):
        return Response(status=405)

    # PATCH request — coordinators can only update their own account
    def partial_update(self, request, pk):
        if self._get_role(request) != "coordinator":
            return Response(
                {"error": "Only coordinators can update coordinator accounts."},
                status=status.HTTP_403_FORBIDDEN,
            )
        user_id = request.auth.get("user_id") if request.auth else None
        if str(pk) != str(user_id):
            return Response(
                {"error": "You can only update your own coordinator account."},
                status=status.HTTP_403_FORBIDDEN,
            )
        item = get_object_or_404(Coordinators.objects.all(), pk=pk)
        serializer = self.serializer_class(item, data=request.data, partial=True)
        if serializer.is_valid():
            password = request.data.get("coordinatorPassword")
            if password is not None:
                serializer.validated_data["coordinatorPassword"] = make_password(
                    password
                )
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    # DELETE request — coordinators can only delete their own account, cannot delete the last one
    def destroy(self, request, pk):
        if self._get_role(request) != "coordinator":
            return Response(
                {"error": "Only coordinators can delete coordinator accounts."},
                status=status.HTTP_403_FORBIDDEN,
            )
        user_id = request.auth.get("user_id") if request.auth else None
        if str(pk) != str(user_id):
            return Response(
                {"error": "You can only delete your own coordinator account."},
                status=status.HTTP_403_FORBIDDEN,
            )
        with transaction.atomic():
            if Coordinators.objects.select_for_update().count() <= 1:
                return Response(
                    {"error": "Cannot delete the last coordinator account."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            item = get_object_or_404(Coordinators.objects.all(), pk=pk)
            item.delete()
        return Response(status=204)

    @action(detail=False, methods=["post"], url_path="login")
    def login(self, request, *args, **kwargs):
        self.throttle_classes = [LoginRateThrottle]
        self.check_throttles(request)
        try:
            email = request.data.get("email")
            password = request.data.get("password")

            if not email or not password:
                return Response(
                    {"detail": "Email and password are required"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            coordinator = Coordinators.objects.filter(coordinatorEmail=email).first()

            if coordinator is None:
                return Response(
                    {"detail": "Invalid credentials"},
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            if check_password(password, coordinator.coordinatorPassword):
                refresh = RefreshToken()
                refresh["user_id"] = str(coordinator.id)
                refresh["role"] = "coordinator"
                response_data = {
                    "coordinator_id": coordinator.id,
                    "coordinatorEmail": coordinator.coordinatorEmail,
                    "coordinatorName": coordinator.coordinatorName,
                    "role": "coordinator",
                }
                response = Response(response_data, status=status.HTTP_200_OK)
                set_jwt_cookies(
                    response, str(refresh.access_token), str(refresh)
                )
                return response
            return Response(
                {"detail": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED
            )

        except Exception as e:
            logger.exception("Coordinator login error")
            return Response(
                {"detail": "Login failed"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
