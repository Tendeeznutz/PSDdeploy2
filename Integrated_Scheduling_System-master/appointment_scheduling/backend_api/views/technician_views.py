from django.contrib.auth.hashers import make_password, check_password
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from ..scheduling_algo import *
from ..serializers import TechnicianSerializer
from ..sg_geo.src import geo_onemap as geo


class TechnicianViewSet(viewsets.ModelViewSet):
    queryset = Technicians.objects.all()
    serializer_class = TechnicianSerializer

    # GET request of all techicians data
    def list(self, request):
        if request.query_params.get('technicianName') is not None:
            queryset = Technicians.objects.filter(technicianName__icontains=request.query_params.get('technicianName'))
        elif request.query_params.get('technicianId') is not None:
            queryset = Technicians.objects.filter(id=request.query_params.get('technicianId'))
        elif request.query_params.get('technicianPostalCode') is not None:
            queryset = Technicians.objects.filter(
                technicianPostalCode__icontains=request.query_params.get('technicianPostalCode'))
        elif request.query_params.get('technicianPhone') is not None:
            queryset = Technicians.objects.filter(technicianPhone__icontains=request.query_params.get('technicianPhone'))
        elif request.query_params.get('technicianStatus') is not None:
            queryset = Technicians.objects.filter(technicianStatus__icontains=request.query_params.get('technicianStatus'))
        elif request.query_params.get('technicianTravelType') is not None:
            queryset = Technicians.objects.filter(
                technicianTravelType__icontains=request.query_params.get('technicianTravelType'))
        elif request.GET:
            return Response(status=400)
        else:
            queryset = Technicians.objects.all()

        serializer = self.serializer_class(queryset, many=True)
        # return response
        return Response(serializer.data)

    # GET request of a technician's data
    def retrieve(self, request, pk):
        # print("GET: Retrieve technician")
        item = get_object_or_404(Technicians.objects.all(), pk=pk)
        serializer = self.serializer_class(item)
        return Response(serializer.data)

    # POST request to create technician
    def create(self, request):
        serializer = self.serializer_class(data=request.data)
        password = request.data.get('technicianPassword')
        if serializer.is_valid():
            serializer.validated_data['technicianPassword'] = make_password(password)
            serializer.validated_data['technicianLocation'] = geo.get_location_from_postal(
                serializer.validated_data['technicianPostalCode'])
            serializer.save()
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)

    # PUT request to update technician data
    def update(self, request, pk):
        return Response(status=405)

    # PATCH request
    def partial_update(self, request, pk):
        print("PATCH: Partial update technician")
        item = get_object_or_404(Technicians.objects.all(), pk=pk)
        serializer = self.serializer_class(item, data=request.data, partial=True)
        if serializer.is_valid():
            # hash password
            password = request.data.get('technicianPassword')
            if password is not None:
                serializer.validated_data['technicianPassword'] = make_password(password)
            # get location from postal code
            if serializer.validated_data.get('technicianPostalCode') is not None:
                serializer.validated_data['technicianLocation'] = geo.get_location_from_postal(
                    serializer.validated_data['technicianPostalCode'])
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    @action(detail=False, methods=['post'], url_path='login')
    def login(self, request, *args, **kwargs):
        try:
            phone = request.data['email']
            password = request.data['password']
            technician = Technicians.objects.get(technicianPhone=phone)
            if check_password(password, technician.technicianPassword):
                response_data = {
                    'technician_phone': technician.technicianPhone,
                    'technician_id' : technician.id,
                    'technicianName': technician.technicianName,
                    'role': 'technician',
                }
                return Response(response_data, status=status.HTTP_200_OK)
            return Response({'detail': 'Incorrect password'}, status=status.HTTP_400_BAD_REQUEST)

        except Technicians.DoesNotExist:
            return Response({'detail': 'Technician not found'}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({'detail': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # DELETE request to delete technician
    def destroy(self, request, pk):
        print("DELETE: Delete technician")
        item = get_object_or_404(Technicians.objects.all(), pk=pk)
        item.delete()
        return Response(status=204)