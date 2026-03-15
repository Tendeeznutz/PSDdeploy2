import time
import uuid

import randomname
from rest_framework import serializers

from .models import (
    Appointments,
    Customers,
    Technicians,
    Coordinators,
    CustomerAirconDevices,
    Messages,
    TechnicianHiringApplication,
    TechnicianAvailability,
    AirconCatalogs,
)

ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]
ALLOWED_DOCUMENT_TYPES = ALLOWED_IMAGE_TYPES + ["application/pdf"]
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


def validate_file_upload(file, allowed_types, max_size=MAX_FILE_SIZE):
    if file.size > max_size:
        raise serializers.ValidationError(
            f"File size must not exceed {max_size // (1024 * 1024)} MB."
        )
    if hasattr(file, "content_type") and file.content_type not in allowed_types:
        raise serializers.ValidationError(
            f"File type '{file.content_type}' is not allowed."
        )


class AppointmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Appointments
        fields = [
            "id", "customerId", "technicianId",
            "appointmentStartTime", "appointmentEndTime",
            "airconToService", "customerFeedback",
            "appointmentStatus", "paymentMethod",
            "cancellationReason", "cancelledBy", "cancelledAt",
            "created_at", "updated_at",
        ]

    def validate_appointmentStartTime(self, value):
        # Only validate future date for NEW appointments or when appointmentStartTime is being changed
        # For partial updates where appointmentStartTime is not being modified, skip this validation
        if value is not None and value <= time.time():
            # Check if this is a partial update and the field is not being changed
            if (
                hasattr(self, "instance")
                and self.instance
                and self.instance.appointmentStartTime == value
            ):
                # This is an existing appointment and the time is not being changed - allow it
                return value
            # This is a new appointment or time is being changed to past - reject it
            raise serializers.ValidationError("Appointment date must be in the future")
        return value

    def validate_airconToService(self, value):
        # For partial updates where airconToService is not being modified, skip validation
        if (
            hasattr(self, "instance")
            and self.instance
            and self.instance.airconToService == value
        ):
            return value

        # value is a list of customerAirconDeviceId, check if all exist and belong to the same customer
        for customerAirconDeviceId in value:
            if not CustomerAirconDevices.objects.filter(
                id=customerAirconDeviceId
            ).exists():
                raise serializers.ValidationError(
                    "Customer aircon device does not exist"
                )
            if self.context["request"].method == "POST":
                if CustomerAirconDevices.objects.get(
                    id=customerAirconDeviceId
                ).customerId.id != uuid.UUID(
                    self.context["request"].data.get("customerId")
                ):
                    raise serializers.ValidationError(
                        "Customer aircon device does not belong to the customer"
                    )
        return value


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customers
        # fields = '__all__'
        exclude = ["customerPassword"]


class AirconSerializer(serializers.ModelSerializer):
    class Meta:
        model = AirconCatalogs
        fields = "__all__"


class TechnicianSerializer(serializers.ModelSerializer):
    class Meta:
        model = Technicians
        # fields = '__all__'
        exclude = ["technicianPassword"]


class CoordinatorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Coordinators
        # fields = '__all__'
        exclude = ["coordinatorPassword"]


class CustomerAirconDeviceSerializer(serializers.ModelSerializer):
    customerId = serializers.PrimaryKeyRelatedField(
        queryset=Customers.objects.all(), required=True
    )

    class Meta:
        model = CustomerAirconDevices
        fields = "__all__"

    def validate_numberOfUnits(self, value):
        if value is not None and value < 1:
            raise serializers.ValidationError("Number of units must be at least 1")
        if value is not None and value > 100:
            raise serializers.ValidationError("Number of units cannot exceed 100")
        return value

    def validate_lastServiceMonth(self, value):
        if value is not None and value != "":
            # Validate YYYY-MM format
            import re
            from datetime import datetime
            from django.utils import timezone as tz

            if not re.match(r"^\d{4}-(0[1-9]|1[0-2])$", value):
                raise serializers.ValidationError(
                    "Last service month must be in YYYY-MM format"
                )
            # Check if it's not in the future
            try:
                service_date = datetime.strptime(value, "%Y-%m")
                if service_date > tz.now().replace(tzinfo=None):
                    raise serializers.ValidationError(
                        "Last service month cannot be in the future"
                    )
            except ValueError:
                raise serializers.ValidationError("Invalid date format")
        return value

    def validate_lastServiceDate(self, value):
        # Legacy field validation - kept for backward compatibility
        if value is not None and value >= time.time():
            raise serializers.ValidationError(
                "Last service date must not be a present or future date"
            )
        return value

    def validate_airconName(self, value):
        if value is None or value == "":
            return None  # Will be auto-generated in create() method
        else:
            return value

    def validate(self, data):
        """Validate that the aircon name is unique for this customer"""
        aircon_name = data.get("airconName")
        customer_id = data.get("customerId")

        # Check for duplicate name only if a name is provided
        if aircon_name and customer_id:
            # Exclude current instance if this is an update
            queryset = CustomerAirconDevices.objects.filter(
                customerId=customer_id, airconName=aircon_name
            )
            if self.instance:
                queryset = queryset.exclude(pk=self.instance.pk)

            if queryset.exists():
                raise serializers.ValidationError(
                    {
                        "airconName": f'You already have an aircon device named "{aircon_name}". Please use a different name.'
                    }
                )

        return data

    def create(self, validated_data):
        """Auto-generate unique aircon name if not provided"""
        if not validated_data.get("airconName"):
            customer = validated_data.get("customerId")
            # Generate a unique name
            base_name = randomname.get_name()
            aircon_name = base_name
            counter = 1

            # Keep generating until we find a unique name
            while CustomerAirconDevices.objects.filter(
                customerId=customer, airconName=aircon_name
            ).exists():
                aircon_name = f"{base_name} {counter}"
                counter += 1

            validated_data["airconName"] = aircon_name

        return super().create(validated_data)


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Messages
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at", "isRead", "readAt"]


class TechnicianHiringApplicationSerializer(serializers.ModelSerializer):
    coordinatorId = serializers.PrimaryKeyRelatedField(
        queryset=Coordinators.objects.all(), required=False, allow_null=True
    )
    createdTechnician = serializers.PrimaryKeyRelatedField(
        queryset=Technicians.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = TechnicianHiringApplication
        fields = "__all__"
        read_only_fields = ["created_at", "updated_at"]

    def validate_nric(self, value):
        # Check if NRIC already exists in another application (excluding current instance if updating)
        instance = getattr(self, "instance", None)
        query = TechnicianHiringApplication.objects.filter(nric=value)
        if instance:
            query = query.exclude(pk=instance.pk)
        if query.exists():
            raise serializers.ValidationError(
                "An application with this NRIC already exists"
            )
        return value

    def validate_resumeFile(self, value):
        if value:
            validate_file_upload(value, ALLOWED_DOCUMENT_TYPES)
        return value

    def validate_profilePhoto(self, value):
        if value:
            validate_file_upload(value, ALLOWED_IMAGE_TYPES)
        return value

    def validate_nricPhotoFront(self, value):
        if value:
            validate_file_upload(value, ALLOWED_IMAGE_TYPES)
        return value

    def validate_nricPhotoBack(self, value):
        if value:
            validate_file_upload(value, ALLOWED_IMAGE_TYPES)
        return value

    def validate_drivingLicense(self, value):
        if value:
            validate_file_upload(value, ALLOWED_IMAGE_TYPES)
        return value

    def validate(self, attrs):
        # File uploads disabled for cloud deployment - fields are optional
        return attrs


class TechnicianAvailabilitySerializer(serializers.ModelSerializer):
    technicianId = serializers.PrimaryKeyRelatedField(
        queryset=Technicians.objects.all(), required=True
    )

    class Meta:
        model = TechnicianAvailability
        fields = "__all__"

    def validate_startTime(self, value):
        """Validate time format HH:MM"""
        import re

        if not re.match(r"^([0-1][0-9]|2[0-3]):[0-5][0-9]$", value):
            raise serializers.ValidationError(
                "Start time must be in HH:MM format (e.g., 09:00)"
            )
        return value

    def validate_endTime(self, value):
        """Validate time format HH:MM"""
        import re

        if not re.match(r"^([0-1][0-9]|2[0-3]):[0-5][0-9]$", value):
            raise serializers.ValidationError(
                "End time must be in HH:MM format (e.g., 17:00)"
            )
        return value

    def validate(self, data):
        """Validate that end time is after start time and check minimum working days"""
        start_time = data.get("startTime")
        end_time = data.get("endTime")

        if start_time and end_time:
            # Convert to minutes for comparison
            start_minutes = int(start_time.split(":")[0]) * 60 + int(
                start_time.split(":")[1]
            )
            end_minutes = int(end_time.split(":")[0]) * 60 + int(end_time.split(":")[1])

            if end_minutes <= start_minutes:
                raise serializers.ValidationError(
                    {"endTime": "End time must be after start time"}
                )

        # Check minimum working days requirement (only for regular schedule, not specific dates)
        technician_id = data.get("technicianId")
        specific_date = data.get("specificDate")
        is_available = data.get("isAvailable", True)

        if technician_id and not specific_date and is_available:
            # Count existing working days for this technician
            existing_days = TechnicianAvailability.objects.filter(
                technicianId=technician_id, specificDate__isnull=True, isAvailable=True
            )

            # Exclude current instance if updating
            if self.instance:
                existing_days = existing_days.exclude(pk=self.instance.pk)

            # Count unique days
            unique_days = (
                existing_days.values_list("dayOfWeek", flat=True).distinct().count()
            )

            # If this is a new day being added, increment the count
            day_of_week = data.get("dayOfWeek")
            if day_of_week and not existing_days.filter(dayOfWeek=day_of_week).exists():
                unique_days += 1

            # Technician must work at least 5 days per week
            if unique_days < 5:
                raise serializers.ValidationError(
                    {
                        "dayOfWeek": f"Technician must have at least 5 working days per week. Currently has {unique_days} days."
                    }
                )

        return data
