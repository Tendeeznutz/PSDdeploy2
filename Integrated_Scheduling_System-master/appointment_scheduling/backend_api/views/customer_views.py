from django.contrib.auth.hashers import make_password, check_password
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .format_response import include_all_info
from ..scheduling_algo import *
from ..serializers import CustomerSerializer
from ..sg_geo.src import geo_onemap as geo


class CustomerViewSet(viewsets.ModelViewSet):
    queryset = Customers.objects.all()
    serializer_class = CustomerSerializer

    # GET request
    def list(self, request):
        if request.query_params.get('customerEmail') is not None:
            queryset = Customers.objects.filter(customerEmail__icontains=request.query_params.get('customerEmail'))
        elif request.query_params.get('customerName') is not None:
            queryset = Customers.objects.filter(customerName__icontains=request.query_params.get('customerName'))
        elif request.query_params.get('customerPhone') is not None:
            queryset = Customers.objects.filter(customerPhone__icontains=request.query_params.get('customerPhone'))
        elif request.query_params.get('customerPostalCode') is not None:
            queryset = Customers.objects.filter(customerPostalCode__icontains=request.query_params.get('customerPostalCode'))
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
        serializer = CustomerSerializer(data=request.data)

        customer_password = request.data.get('customerPassword')

        existing_customer = Customers.objects.filter(customerEmail=request.data.get('customerEmail')).first()
        if existing_customer:
            return Response({"error": "Customer with this email already exists."}, status=status.HTTP_400_BAD_REQUEST)

        if serializer.is_valid():
            serializer.validated_data['customerPassword'] = make_password(customer_password)
            serializer.validated_data['customerLocation'] = geo.get_location_from_postal(
                serializer.validated_data['customerPostalCode'])
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        # Return error response
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'], url_path='login')
    def login(self, request, *args, **kwargs):
        try:
            email = request.data.get('email')
            password = request.data.get('password')

            if not email or not password:
                return Response({'error': 'Email and password are required'}, status=status.HTTP_400_BAD_REQUEST)

            customer = Customers.objects.filter(customerEmail=email).first()

            if customer is None:
                return Response({'error': 'Customer not found'}, status=status.HTTP_404_NOT_FOUND)

            if check_password(password, customer.customerPassword):
                response_data = {
                    'customer_id': customer.id,
                    'role': 'customer',
                }
                return Response(response_data, status=status.HTTP_200_OK)
            else:
                return Response({'error': 'Incorrect password'}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({'error': f'Login failed: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def retrieve(self, request, pk=None):
        item = get_object_or_404(Customers.objects.all(), pk=pk)
        serializer = CustomerSerializer(item)
        return Response(serializer.data)

    # PUT request
    def update(self, request, pk=None):
        return Response(status=405)

    # PATCH request
    def partial_update(self, request, pk=None):
        item = get_object_or_404(Customers.objects.all(), pk=pk)
        serializer = CustomerSerializer(item, data=request.data, partial=True)
        if serializer.is_valid():
            # Hash password
            password = request.data.get('customerPassword')
            if password is not None:
                serializer.validated_data['customerPassword'] = make_password(password)
            # get location from postal code
            if serializer.validated_data.get('customerPostalCode') is not None:
                serializer.validated_data['customerLocation'] = geo.get_location_from_postal(
                    serializer.validated_data['customerPostalCode'])
            # Save data to database
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    # DELETE request
    def destroy(self, request, pk=None):
        item = get_object_or_404(Customers.objects.all(), pk=pk)
        item.delete()
        return Response(status=204)