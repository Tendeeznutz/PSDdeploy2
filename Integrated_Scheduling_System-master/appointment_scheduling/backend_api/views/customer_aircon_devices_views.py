from django.shortcuts import get_object_or_404
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from ..models import CustomerAirconDevices
from ..serializers import CustomerAirconDeviceSerializer


class CustomerAirconDeviceViewSet(viewsets.ModelViewSet):
    queryset = CustomerAirconDevices.objects.all()
    serializer_class = CustomerAirconDeviceSerializer

    def _require_role(self, request, allowed_roles):
        role = getattr(request.auth, "payload", {}).get("role") if request.auth else None
        return role in allowed_roles

    def _get_user_id(self, request):
        return getattr(request.auth, "payload", {}).get("user_id") if request.auth else None

    # GET request of all customer aircon devices data
    def list(self, request):
        if request.query_params.get("customerId") is not None:
            queryset = CustomerAirconDevices.objects.filter(
                customerId=request.query_params.get("customerId")
            )
        elif request.query_params.get("customerName") is not None:
            queryset = CustomerAirconDevices.objects.filter(
                customerId__customerName__icontains=request.query_params.get(
                    "customerName"
                )
            )
        elif request.GET:
            return Response(status=400)
        else:
            if self._require_role(request, ["coordinator"]):
                queryset = CustomerAirconDevices.objects.all()
            else:
                return Response({"error": "Coordinator access required for full list"}, status=status.HTTP_403_FORBIDDEN)

        serializer = self.serializer_class(queryset, many=True)
        return Response(serializer.data)

    # GET request of a customer aircon device's data
    def retrieve(self, request, pk):
        item = get_object_or_404(CustomerAirconDevices.objects.all(), pk=pk)
        serializer = self.serializer_class(item)
        return Response(serializer.data)

    # POST request to create customer aircon device
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

    # PUT request to update customer aircon device data
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

    # DELETE request to delete customer aircon device
    def destroy(self, request, pk):
        if not self._require_role(request, ["coordinator"]):
            return Response({"error": "Coordinator access required"}, status=status.HTTP_403_FORBIDDEN)

        item = get_object_or_404(CustomerAirconDevices.objects.all(), pk=pk)
        item.delete()
        return Response(status=204)
