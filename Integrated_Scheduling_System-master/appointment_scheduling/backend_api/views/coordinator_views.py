from django.contrib.auth.hashers import make_password, check_password
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from ..models import Coordinators
from ..serializers import CoordinatorSerializer


class CoordinatorViewSet(viewsets.ModelViewSet):
    queryset = Coordinators.objects.all()
    serializer_class = CoordinatorSerializer

    def get_permissions(self):
        if self.action == 'login':
            return [AllowAny()]
        return [IsAuthenticated()]

    # GET request of all techicians data
    def list(self, request):
        queryset = Coordinators.objects.all()
        # serialize queryset
        serializer = self.serializer_class(queryset, many=True)
        # return response
        return Response(serializer.data)

    # GET request of a technician's data
    def retrieve(self, request, pk):
        item = get_object_or_404(Coordinators.objects.all(), pk=pk)
        serializer = self.serializer_class(item)
        return Response(serializer.data)

    # POST request to create technician
    def create(self, request):
        # deserialize request data
        serializer = self.serializer_class(data=request.data)
        password = request.data.get('coordinatorPassword')
        if serializer.is_valid():
            # save data to database
            serializer.validated_data['coordinatorPassword'] = make_password(password)
            serializer.save()
            # return success response
            return Response(serializer.data, status=201)
        # return error response
        return Response(serializer.errors, status=400)

    # PUT request to update technician data
    def update(self, request, pk):
        return Response(status=405)

    # PATCH request
    def partial_update(self, request, pk):
        item = get_object_or_404(Coordinators.objects.all(), pk=pk)
        serializer = self.serializer_class(item, data=request.data, partial=True)
        if serializer.is_valid():
            password = request.data.get('coordinatorPassword')
            if password is not None:
                serializer.validated_data['coordinatorPassword'] = make_password(password)
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    # DELETE request to delete technician
    def destroy(self, request, pk):
        pass

    @action(detail=False, methods=['post'], url_path='login')
    def login(self, request, *args, **kwargs):
        try:
            email = request.data.get('email')
            password = request.data.get('password')

            if not email or not password:
                return Response({'detail': 'Email and password are required'}, status=status.HTTP_400_BAD_REQUEST)

            coordinator = Coordinators.objects.filter(coordinatorEmail=email).first()

            if coordinator is None:
                return Response({'detail': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

            if check_password(password, coordinator.coordinatorPassword):
                refresh = RefreshToken()
                refresh['user_id'] = str(coordinator.id)
                refresh['role'] = 'coordinator'
                response_data = {
                    'coordinator_id': coordinator.id,
                    'coordinatorEmail': coordinator.coordinatorEmail,
                    'coordinatorName': coordinator.coordinatorName,
                    'role': 'coordinator',
                    'access': str(refresh.access_token),
                    'refresh': str(refresh),
                }
                return Response(response_data, status=status.HTTP_200_OK)
            return Response({'detail': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)

        except Exception as e:
            return Response({'detail': 'Login failed'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
