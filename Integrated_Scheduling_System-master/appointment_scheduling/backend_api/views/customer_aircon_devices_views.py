from django.shortcuts import get_object_or_404
from rest_framework import viewsets
from rest_framework.response import Response

from ..models import CustomerAirconDevices
from ..serializers import CustomerAirconDeviceSerializer


class CustomerAirconDeviceViewSet(viewsets.ModelViewSet):
    queryset = CustomerAirconDevices.objects.all()
    serializer_class = CustomerAirconDeviceSerializer

    # GET request of all techicians data
    def list(self, request):
        if request.query_params.get('customerId') is not None:
            queryset = CustomerAirconDevices.objects.filter(customerId=request.query_params.get('customerId'))
        elif request.query_params.get('customerName') is not None:
            queryset = CustomerAirconDevices.objects.filter(customerId__customerName__icontains=request.query_params.get('customerName'))
        elif request.GET:
            return Response(status=400)
        else:
            queryset = CustomerAirconDevices.objects.all()

        serializer = self.serializer_class(queryset, many=True)
        return Response(serializer.data)

    # GET request of a technician's data
    def retrieve(self, request, pk):
        item = get_object_or_404(CustomerAirconDevices.objects.all(), pk=pk)
        serializer = self.serializer_class(item)
        return Response(serializer.data)

    # POST request to create technician
    def create(self, request):
        # deserialize request data
        serializer = self.serializer_class(data=request.data)
        if serializer.is_valid():
            # save data to database
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
        item = get_object_or_404(CustomerAirconDevices.objects.all(), pk=pk)
        serializer = self.serializer_class(item, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    # DELETE request to delete technician
    def destroy(self, request, pk):
        item = get_object_or_404(CustomerAirconDevices.objects.all(), pk=pk)
        item.delete()
        return Response(status=204)
