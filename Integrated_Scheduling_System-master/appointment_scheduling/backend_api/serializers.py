import time
import uuid

import randomname
from rest_framework import serializers

from .models import Appointments, AppointmentRequest, Customers, AirconCatalogs, Technicians, Coordinators, \
    CustomerAirconDevices, Messages


class AppointmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Appointments
        fields = '__all__'

    def validate_appointmentStartTime(self, value):
        if value is not None and value <= time.time():
            raise serializers.ValidationError("Appointment date must be in the future")
        return value

    def validate_airconToService(self, value):
        # value is a list of customerAirconDeviceId, check if all exist and belong to the same customer
        for customerAirconDeviceId in value:
            if not CustomerAirconDevices.objects.filter(id=customerAirconDeviceId).exists():
                raise serializers.ValidationError("Customer aircon device does not exist")
            if self.context['request'].method == 'POST':
                if CustomerAirconDevices.objects.get(id=customerAirconDeviceId).customerId.id != uuid.UUID(
                        self.context['request'].data.get('customerId')):
                    raise serializers.ValidationError("Customer aircon device does not belong to the customer")
        return value


class AppointmentRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = AppointmentRequest
        fields = '__all__'


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customers
        # fields = '__all__'
        exclude = ['customerPassword']


class AirconSerializer(serializers.ModelSerializer):
    class Meta:
        model = AirconCatalogs
        fields = '__all__'

    def validate(self, attrs):
        if 'airconBrand' in attrs and 'airconModel' in attrs:
            if AirconCatalogs.objects.filter(airconBrand=attrs['airconBrand'], airconModel=attrs['airconModel']).exists():
                raise serializers.ValidationError("Aircon brand and model already exists")
        return attrs


class TechnicianSerializer(serializers.ModelSerializer):
    class Meta:
        model = Technicians
        # fields = '__all__'
        exclude = ['technicianPassword']


class CoordinatorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Coordinators
        # fields = '__all__'
        exclude = ['coordinatorPassword']


class CustomerAirconDeviceSerializer(serializers.ModelSerializer):
    airconCatalogId = serializers.PrimaryKeyRelatedField(queryset=AirconCatalogs.objects.all(), required=True)
    customerId = serializers.PrimaryKeyRelatedField(queryset=Customers.objects.all(), required=True)

    class Meta:
        model = CustomerAirconDevices
        fields = '__all__'

    def validate_lastServiceDate(self, value):
        if value is not None and value >= time.time():
            raise serializers.ValidationError("Last service date must not be a present or future date")
        return value

    def validate_airconName(self, value):
        if value is None or value == '':
            return randomname.get_name()
        else:
            return value


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Messages
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']
