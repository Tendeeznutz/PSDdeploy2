from django.shortcuts import get_object_or_404
from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from ..models import CustomerAirconDevices
from ..serializers import CustomerAirconDeviceSerializer


class CustomerAirconDeviceViewSet(viewsets.ModelViewSet):
    queryset = CustomerAirconDevices.objects.all()
    serializer_class = CustomerAirconDeviceSerializer

    def _get_role_and_user_id(self, request):
        if hasattr(request, "auth") and request.auth:
            return request.auth.get("role"), request.auth.get("user_id")
        return None, None

    def _assert_owner_or_coordinator(self, request, device):
        role, user_id = self._get_role_and_user_id(request)
        if role == "coordinator":
            return
        if str(device.customerId.id) != str(user_id):
            raise PermissionDenied("You can only manage your own aircon devices.")

    # GET request of all customer aircon devices data
    def list(self, request):
        role, user_id = self._get_role_and_user_id(request)

        if request.query_params.get("customerId") is not None:
            customer_id = request.query_params.get("customerId")
            # Customers can only list their own devices
            if role != "coordinator" and str(customer_id) != str(user_id):
                raise PermissionDenied("You can only view your own aircon devices.")
            queryset = CustomerAirconDevices.objects.filter(customerId=customer_id)
        elif request.query_params.get("customerName") is not None:
            if role != "coordinator":
                raise PermissionDenied("Only coordinators can search by customer name.")
            queryset = CustomerAirconDevices.objects.filter(
                customerId__customerName__icontains=request.query_params.get(
                    "customerName"
                )
            )
        elif request.GET:
            return Response(status=400)
        else:
            # No filter — only coordinators can list all
            if role != "coordinator":
                raise PermissionDenied("You can only view your own aircon devices.")
            queryset = CustomerAirconDevices.objects.all()

        serializer = self.serializer_class(queryset, many=True)
        return Response(serializer.data)

    # GET request of a customer aircon device's data
    def retrieve(self, request, pk):
        item = get_object_or_404(CustomerAirconDevices.objects.all(), pk=pk)
        self._assert_owner_or_coordinator(request, item)
        serializer = self.serializer_class(item)
        return Response(serializer.data)

    # POST request to create customer aircon device
    def create(self, request):
        role, user_id = self._get_role_and_user_id(request)
        # Customers can only create devices for themselves
        if role != "coordinator":
            customer_id = request.data.get("customerId")
            if str(customer_id) != str(user_id):
                raise PermissionDenied("You can only add devices to your own account.")
        serializer = self.serializer_class(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=201)
        return Response(serializer.errors, status=400)

    # PUT request to update customer aircon device data
    def update(self, request, pk):
        return Response(status=405)

    # PATCH request
    def partial_update(self, request, pk):
        item = get_object_or_404(CustomerAirconDevices.objects.all(), pk=pk)
        self._assert_owner_or_coordinator(request, item)
        serializer = self.serializer_class(item, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    # DELETE request to delete customer aircon device
    def destroy(self, request, pk):
        item = get_object_or_404(CustomerAirconDevices.objects.all(), pk=pk)
        self._assert_owner_or_coordinator(request, item)
        item.delete()
        return Response(status=204)
