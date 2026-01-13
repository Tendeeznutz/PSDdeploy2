import time
import uuid

import randomname
from rest_framework import serializers

from .models import Appointments, AppointmentRequest, Customers, AirconCatalogs, Technicians, Coordinators, \
    CustomerAirconDevices, Messages, TechnicianHiringApplication


class AppointmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Appointments
        fields = '__all__'

    def validate_appointmentStartTime(self, value):
        # Only validate future date for NEW appointments or when appointmentStartTime is being changed
        # For partial updates where appointmentStartTime is not being modified, skip this validation
        if value is not None and value <= time.time():
            # Check if this is a partial update and the field is not being changed
            if hasattr(self, 'instance') and self.instance and self.instance.appointmentStartTime == value:
                # This is an existing appointment and the time is not being changed - allow it
                return value
            # This is a new appointment or time is being changed to past - reject it
            raise serializers.ValidationError("Appointment date must be in the future")
        return value

    def validate_airconToService(self, value):
        # For partial updates where airconToService is not being modified, skip validation
        if hasattr(self, 'instance') and self.instance and self.instance.airconToService == value:
            return value

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


class TechnicianHiringApplicationSerializer(serializers.ModelSerializer):
    coordinatorId = serializers.PrimaryKeyRelatedField(
        queryset=Coordinators.objects.all(),
        required=False,
        allow_null=True
    )
    createdTechnician = serializers.PrimaryKeyRelatedField(
        queryset=Technicians.objects.all(),
        required=False,
        allow_null=True
    )

    class Meta:
        model = TechnicianHiringApplication
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']

    def validate_nric(self, value):
        # Check if NRIC already exists in another application (excluding current instance if updating)
        instance = getattr(self, 'instance', None)
        query = TechnicianHiringApplication.objects.filter(nric=value)
        if instance:
            query = query.exclude(pk=instance.pk)
        if query.exists():
            raise serializers.ValidationError("An application with this NRIC already exists")
        return value
