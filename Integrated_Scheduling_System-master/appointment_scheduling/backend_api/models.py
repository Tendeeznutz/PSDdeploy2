import uuid

from django.core.validators import RegexValidator
from django.core.validators import validate_email
from django.db import models
from django.db.models import CheckConstraint, UniqueConstraint, Index, Q, F

SG_PHONE_VALIDATOR = RegexValidator(r'^\d{8}$', 'Phone must be exactly 8 digits.')
SG_POSTAL_VALIDATOR = RegexValidator(r'^\d{6}$', 'Postal code must be exactly 6 digits.')

# Create your models here.

class TimeStampedModel(models.Model):
    """Adds created_at/updated_at to all inheriting models."""
    created_at = models.DateTimeField(auto_now_add=True)  # set once on insert
    updated_at = models.DateTimeField(auto_now=True)      # refresh on every save

    class Meta:
        abstract = True

class AirconCatalogs(TimeStampedModel):  # was: models.Model
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, unique=True, null=False)
    airconBrand = models.CharField(max_length=50, null=False)
    airconModel = models.CharField(max_length=50, null=False)

    class Meta:
        constraints = [
            UniqueConstraint(fields=['airconBrand', 'airconModel'], name='unique_aircon_brand_model')
        ]
        indexes = [
            models.Index(fields=['airconBrand'], name='aircon_brand_idx'),
            models.Index(fields=['airconModel'], name='aircon_model_idx'),
        ]
        ordering = ['airconBrand', 'airconModel']

    def __str__(self):
        return f'{self.airconBrand} {self.airconModel}'

class Customers(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, unique=True, null=False)
    customerName = models.CharField(max_length=50, null=False)
    customerPostalCode = models.CharField(max_length=6, null=False, validators=[SG_POSTAL_VALIDATOR])
    customerLocation = models.CharField(max_length=32, null=True)
    customerAddress = models.CharField(max_length=50, null=False)
    customerPhone = models.CharField(max_length=50, unique=True, null=False, validators=[SG_PHONE_VALIDATOR])
    customerPassword = models.CharField(max_length=50, null=False)  # TODO: hash later
    customerEmail = models.CharField(max_length=50, unique=True, null=False, validators=[validate_email])

    class Meta:
        indexes = [
            Index(fields=['customerPhone'], name='customer_phone_idx'),
            Index(fields=['customerEmail'], name='customer_email_idx'),
        ]

    def __str__(self):
        return f'{self.customerName} ({self.customerEmail})'

class CustomerAirconDevices(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, null=False)
    airconName = models.CharField(max_length=50, null=True)
    airconCatalogId = models.ForeignKey(
        AirconCatalogs, on_delete=models.CASCADE,
        db_column='airconCatalogId', related_name='customer_devices',
        default=None, null=False
    )
    customerId = models.ForeignKey(
        Customers, on_delete=models.CASCADE,
        db_column='customerId', related_name='aircon_devices',
        default=None, null=False
    )
    # Use epoch seconds for now (matches your current schema)
    lastServiceDate = models.BigIntegerField(null=True, default=None)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['customerId', 'airconName'],
                                    name='uniq_device_name_per_customer'),
        ]
        indexes = [
            models.Index(fields=['customerId']),
            models.Index(fields=['airconCatalogId']),
        ]
        ordering = ['customerId', 'airconName']

    def __str__(self):
        return self.airconName or f'Device {self.id}'

class Technicians(models.Model):
    choices = (
        ('1', 'Available'),
        ('2', 'Unavailable')
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, unique=True, null=False)
    technicianName = models.CharField(max_length=50, null=False)
    technicianPostalCode = models.CharField(max_length=6, null=False, validators=[SG_POSTAL_VALIDATOR])
    technicianAddress = models.CharField(max_length=50, null=False)
    technicianLocation = models.CharField(max_length=32, null=True)
    technicianPhone = models.CharField(max_length=50, unique=True, null=False, validators=[SG_PHONE_VALIDATOR])
    technicianPassword = models.CharField(max_length=50, null=False)
    technicianStatus = models.CharField(default=1, choices=choices, max_length=1, null=False)
    # validation should be done in serializer to check each entry exist in airconCatalogs
    # technicianSupportedAircon = models.CharField(max_length=500)
    technicianTravelType = models.CharField(max_length=10, null=False, default='walk')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        indexes = [
            Index(fields=['technicianStatus']),
            Index(fields=['technicianPhone']),
            Index(fields=['technicianPostalCode']),
        ]
        ordering = ['technicianName']
    
    def __str__(self):
        return f'{self.technicianName} ({self.get_technicianStatus_display()})'
    

class Coordinators(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, unique=True, null=False)
    coordinatorName = models.CharField(max_length=50)
    coordinatorEmail = models.CharField(max_length=50, unique=True, null=False, validators=[validate_email])
    coordinatorPhone = models.CharField(max_length=50, unique=True, null=False,
                                        validators=[RegexValidator(r'^\d{8}$')])
    coordinatorPassword = models.CharField(max_length=50)

    class Meta:
        indexes = [
            Index(fields=['coordinatorEmail'], name='coordinator_email_idx'),
            Index(fields=['coordinatorPhone'], name='coordinator_phone_idx'),
        ]
        ordering = ['coordinatorName']

    def __str__(self):
        return f'{self.coordinatorName} ({self.coordinatorEmail})'


class Appointments(TimeStampedModel):
    choices = (
        ('1', 'Pending'),
        ('2', 'Confirmed'),
        ('3', 'Completed'),
        ('4', 'Cancelled'),
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, unique=True, null=False)
    customerId = models.ForeignKey(
        Customers, 
        on_delete=models.CASCADE, 
        db_column='customerId', 
        related_name='appointments',
        default=None,
        null=False
    )
    # dateTime = models.DateTimeField(default=None)
    appointmentStartTime = models.BigIntegerField(help_text='Unix epoch seconds')
    appointmentEndTime = models.BigIntegerField(help_text='Unix epoch seconds')
    #appointmentStartTime = models.BigIntegerField(default=None, null=False)
    #appointmentEndTime = models.BigIntegerField(default=None, null=False)
    technicianId = models.ForeignKey(
        Technicians, 
        on_delete=models.CASCADE, 
        db_column='technicianId',
        related_name='appointments', 
        default=None,
        null=True,
        blank=True
        )
    # airconID = models.ForeignKey(airconCatalogs, on_delete=models.CASCADE, db_column='airconID', default=None, null=True)
    # validation should be done in serializer to check each entry exist in customerAirconDevices
    airconToService = models.JSONField(default=list, help_text='List of customerAirconDevices IDs')
    customerFeedback = models.TextField(default=None, null=True, max_length=500)
    appointmentStatus = models.CharField(max_length=1, default=1, choices=choices)
    cancellationReason = models.TextField(default=None, null=True, blank=True, max_length=500, help_text='Reason for cancellation')
    cancelledBy = models.CharField(max_length=50, null=True, blank=True, help_text='Role of person who cancelled (technician/coordinator)')
    cancelledAt = models.DateTimeField(null=True, blank=True, help_text='Timestamp of cancellation')

    # def get_appointmentStatus_display(self):
    #     return self.choices[int(self.appointmentStatus) - 1][1]

    class Meta:
        constraints = [
            CheckConstraint(check=Q(appointmentEndTime__gt=models.F('appointmentStartTime')),
                            name='appt_end_after_start')
        ]
    def __str__(self):
        return f'Appt {self.id} ({self.appointmentStatus})'
    
class AppointmentRequest(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    class Meta:
        managed = True

class Messages(TimeStampedModel):
    """
    Internal messaging system for communication between customers, coordinators, and technicians
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, unique=True, null=False)

    # Who sent the message
    senderType = models.CharField(max_length=20, null=False, help_text='customer, coordinator, or technician')
    senderId = models.UUIDField(null=False, help_text='ID of the sender')
    senderName = models.CharField(max_length=50, null=False, help_text='Name of sender')

    # Who receives the message
    recipientType = models.CharField(max_length=20, null=False, help_text='customer, coordinator, or technician')
    recipientId = models.UUIDField(null=False, help_text='ID of the recipient')
    recipientName = models.CharField(max_length=50, null=False, help_text='Name of recipient')

    # Message content
    subject = models.CharField(max_length=200, null=False)
    body = models.TextField(max_length=2000, null=False)

    # Message metadata
    isRead = models.BooleanField(default=False, help_text='Whether the recipient has read the message')
    readAt = models.DateTimeField(null=True, blank=True, help_text='When the message was read')

    # Optional reference to related appointment
    relatedAppointment = models.ForeignKey(
        Appointments,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='messages',
        help_text='Optional related appointment'
    )

    class Meta:
        indexes = [
            Index(fields=['senderId', 'senderType']),
            Index(fields=['recipientId', 'recipientType']),
            Index(fields=['isRead']),
            Index(fields=['-created_at']),  # For ordering by newest first
        ]
        ordering = ['-created_at']  # Newest first

    def __str__(self):
        return f'Message from {self.senderName} to {self.recipientName}: {self.subject}'