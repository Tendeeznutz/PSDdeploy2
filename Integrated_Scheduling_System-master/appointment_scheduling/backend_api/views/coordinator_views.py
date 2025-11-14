from django.contrib.auth.hashers import make_password, check_password
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from ..models import Coordinators
from ..serializers import CoordinatorSerializer


class CoordinatorViewSet(viewsets.ModelViewSet):
    queryset = Coordinators.objects.all()
    serializer_class = CoordinatorSerializer

    # GET request of all techicians data
    def list(self, request):
        print("GET: List all coordinators")
        queryset = Coordinators.objects.all()
        # print all data
        print(queryset)
        # serialize queryset
        serializer = self.serializer_class(queryset, many=True)
        # return response
        return Response(serializer.data)

    # GET request of a technician's data
    def retrieve(self, request, pk):
        print("GET: Retrieve coordinator")
        item = get_object_or_404(Coordinators.objects.all(), pk=pk)
        serializer = self.serializer_class(item)
        return Response(serializer.data)

    # POST request to create technician
    def create(self, request):
        print("POST: Create coordinator")
        # deserialize request data
        serializer = self.serializer_class(data=request.data)
        password = request.data.get('coordinatorPassword')
        # print data
        print(request.data)
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
        print("PATCH: Partial update coordinator")
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
            email = request.data['email']
            password = request.data['password']
            coordinator = Coordinators.objects.get(coordinatorEmail=email)
            print(coordinator.coordinatorPassword)
            if check_password(password, coordinator.coordinatorPassword):
                response_data = {
                    'coordinator_id': coordinator.id,
                    'coordinatorEmail': coordinator.coordinatorEmail,
                    'coordinatorName': coordinator.coordinatorName,
                    'role': 'coordinator',
                }
                return Response(response_data, status=status.HTTP_200_OK)
            return Response({'detail': 'Incorrect password'}, status=status.HTTP_400_BAD_REQUEST)

        except Coordinators.DoesNotExist:
            return Response({'detail': 'Coordinator not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)