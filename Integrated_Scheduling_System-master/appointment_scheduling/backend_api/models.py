import uuid

from django.core.validators import RegexValidator
from django.core.validators import validate_email
from django.db import models


# Create your models here.
class AirconCatalogs(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, unique=True, null=False)
    airconBrand = models.CharField(max_length=50, null=False)
    airconModel = models.CharField(max_length=50, null=False)


class Customers(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, unique=True, null=False)
    customerName = models.CharField(max_length=50, null=False)
    customerPostalCode = models.CharField(max_length=6, null=False)
    customerLocation = models.CharField(max_length=32, null=True)
    customerAddress = models.CharField(max_length=50, null=False)
    customerPhone = models.CharField(max_length=50, unique=True, null=False, validators=[RegexValidator(r'^\d{8}$')])
    # should be hashed
    customerPassword = models.CharField(max_length=50, null=False)
    customerEmail = models.CharField(max_length=50, unique=True, null=False, validators=[validate_email])


class CustomerAirconDevices(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, null=False)
    airconName = models.CharField(max_length=50, null=True)
    airconCatalogId = models.ForeignKey(AirconCatalogs, on_delete=models.CASCADE, db_column='airconCatalogId',
                                        default=None, null=False)
    customerId = models.ForeignKey(Customers, on_delete=models.CASCADE, db_column='customerId', default=None,
                                   null=False)
    # lastServiceDate = models.DateTimeField(default=None, null=True)
    lastServiceDate = models.BigIntegerField(null=True, default=None)


class Technicians(models.Model):
    choices = (
        ('1', 'Available'),
        ('2', 'Unavailable')
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, unique=True, null=False)
    technicianName = models.CharField(max_length=50, null=False)
    technicianPostalCode = models.CharField(max_length=6, null=False)
    technicianAddress = models.CharField(max_length=50, null=False)
    technicianLocation = models.CharField(max_length=32, null=True)
    technicianPhone = models.CharField(max_length=50, unique=True, null=False, validators=[RegexValidator(r'^\d{8}$')])
    technicianPassword = models.CharField(max_length=50, null=False)
    technicianStatus = models.CharField(default=1, choices=choices, max_length=1, null=False)
    # validation should be done in serializer to check each entry exist in airconCatalogs
    # technicianSupportedAircon = models.CharField(max_length=500)
    technicianTravelType = models.CharField(max_length=10, null=False, default='walk')


class Coordinators(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, unique=True, null=False)
    coordinatorName = models.CharField(max_length=50)
    coordinatorEmail = models.CharField(max_length=50, unique=True, null=False, validators=[validate_email])
    coordinatorPhone = models.CharField(max_length=50, unique=True, null=False, validators=[RegexValidator(r'^\d{8}$')])
    coordinatorPassword = models.CharField(max_length=50)


class Appointments(models.Model):
    choices = (
        ('1', 'Pending'),
        ('2', 'Confirmed'),
        ('3', 'Completed'),
        ('4', 'Cancelled'),
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, unique=True, null=False)
    customerId = models.ForeignKey(Customers, on_delete=models.CASCADE, db_column='customerId', default=None,
                                   null=False)
    # dateTime = models.DateTimeField(default=None)
    appointmentStartTime = models.BigIntegerField(default=None, null=False)
    appointmentEndTime = models.BigIntegerField(default=None, null=False)
    technicianId = models.ForeignKey(Technicians, on_delete=models.CASCADE, db_column='technicianId', default=None,
                                     null=True)
    # airconID = models.ForeignKey(airconCatalogs, on_delete=models.CASCADE, db_column='airconID', default=None, null=True)
    # validation should be done in serializer to check each entry exist in customerAirconDevices
    airconToService = models.JSONField(default=None)
    customerFeedback = models.TextField(default=None, null=True, max_length=500)
    appointmentStatus = models.CharField(max_length=1, default=1, choices=choices)

    # def get_appointmentStatus_display(self):
    #     return self.choices[int(self.appointmentStatus) - 1][1]


