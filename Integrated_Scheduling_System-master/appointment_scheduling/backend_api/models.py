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
    customerPassword = models.CharField(max_length=128, null=False)
    customerEmail = models.CharField(max_length=50, unique=True, null=False, validators=[validate_email])
    pendingPenaltyFee = models.DecimalField(max_digits=10, decimal_places=2, default=0.00, help_text='Accumulated penalty fees for excessive cancellations')
    customerRating = models.DecimalField(max_digits=3, decimal_places=2, default=5.00, help_text='Average rating from technicians (1-5), default 5')
    ratingCount = models.IntegerField(default=0, help_text='Number of ratings received from technicians')

    class Meta:
        indexes = [
            Index(fields=['customerPhone'], name='customer_phone_idx'),
            Index(fields=['customerEmail'], name='customer_email_idx'),
        ]

    def __str__(self):
        return f'{self.customerName} ({self.customerEmail})'

class CustomerAirconDevices(TimeStampedModel):
    AIRCON_TYPE_CHOICES = (
        ('industrial', 'Industrial'),
        ('split', 'Split'),
        ('window', 'Window'),
        ('centralized', 'Centralized'),
        ('floor_mounted', 'Floor Mounted'),
        ('portable', 'Portable'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, null=False)
    airconName = models.CharField(max_length=50, null=True)
    customerId = models.ForeignKey(
        Customers, on_delete=models.CASCADE,
        db_column='customerId', related_name='aircon_devices',
        default=None, null=False
    )
    numberOfUnits = models.IntegerField(null=False, default=1)
    airconType = models.CharField(max_length=20, choices=AIRCON_TYPE_CHOICES, null=False, default='split')
    # Store as YYYY-MM format string (e.g., "2024-01")
    lastServiceMonth = models.CharField(max_length=7, null=True, blank=True, default=None)
    remarks = models.TextField(max_length=500, null=True, blank=True, default=None)

    # Legacy field - keeping for backward compatibility but no longer required
    airconCatalogId = models.ForeignKey(
        AirconCatalogs, on_delete=models.CASCADE,
        db_column='airconCatalogId', related_name='customer_devices',
        default=None, null=True, blank=True
    )
    # Legacy field - keeping for backward compatibility
    lastServiceDate = models.BigIntegerField(null=True, default=None, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['customerId', 'airconName'],
                                    name='uniq_device_name_per_customer'),
        ]
        indexes = [
            models.Index(fields=['customerId']),
            models.Index(fields=['airconType']),
        ]
        ordering = ['customerId', 'airconName']

    def __str__(self):
        return self.airconName or f'Device {self.id}'

class Technicians(models.Model):
    STATUS_CHOICES = (
        ('1', 'Available'),
        ('2', 'Unavailable')
    )

    TRAVEL_TYPE_CHOICES = (
        ('own_vehicle', 'Own Vehicle'),
        ('company_vehicle', 'Company Vehicle'),
        ('rental_van', 'Rental Van'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, unique=True, null=False)
    technicianName = models.CharField(max_length=50, null=False)
    technicianPostalCode = models.CharField(max_length=6, null=False, validators=[SG_POSTAL_VALIDATOR])
    technicianAddress = models.CharField(max_length=50, null=False)
    technicianLocation = models.CharField(max_length=32, null=True)
    technicianPhone = models.CharField(max_length=50, unique=True, null=False, validators=[SG_PHONE_VALIDATOR])
    technicianEmail = models.CharField(max_length=50, unique=True, null=True, blank=True, validators=[validate_email], help_text='Email address for notifications')
    technicianPassword = models.CharField(max_length=128, null=False)
    technicianStatus = models.CharField(default=1, choices=STATUS_CHOICES, max_length=1, null=False)
    specializations = models.JSONField(default=list, blank=True, help_text='List of AC brands the technician specializes in')
    technicianTravelType = models.CharField(max_length=20, choices=TRAVEL_TYPE_CHOICES, null=True, blank=True, default=None)
    technicianRating = models.DecimalField(max_digits=3, decimal_places=2, default=5.00, help_text='Average rating from customers (1-5), default 5')
    technicianRatingCount = models.IntegerField(default=0, help_text='Number of ratings received from customers')
    isActive = models.BooleanField(default=True, help_text='Whether technician is currently employed/active')
    deactivatedAt = models.DateTimeField(null=True, blank=True, help_text='When the technician was deactivated')
    deactivationReason = models.TextField(null=True, blank=True, help_text='Reason for deactivation')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            Index(fields=['technicianStatus']),
            Index(fields=['technicianPhone']),
            Index(fields=['technicianEmail']),
            Index(fields=['technicianPostalCode']),
            Index(fields=['isActive']),
        ]
        ordering = ['technicianName']

    def __str__(self):
        status = 'Active' if self.isActive else 'Inactive'
        return f'{self.technicianName} ({status} - {self.get_technicianStatus_display()})'
    

class Coordinators(TimeStampedModel):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, unique=True, null=False)
    coordinatorName = models.CharField(max_length=50)
    coordinatorEmail = models.CharField(max_length=50, unique=True, null=False, validators=[validate_email])
    coordinatorPhone = models.CharField(max_length=50, unique=True, null=False,
                                        validators=[RegexValidator(r'^\d{8}$')])
    coordinatorPassword = models.CharField(max_length=128)

    class Meta:
        indexes = [
            Index(fields=['coordinatorEmail'], name='coordinator_email_idx'),
            Index(fields=['coordinatorPhone'], name='coordinator_phone_idx'),
        ]
        ordering = ['coordinatorName']

    def __str__(self):
        return f'{self.coordinatorName} ({self.coordinatorEmail})'


class Appointments(TimeStampedModel):
    STATUS_CHOICES = (
        ('1', 'Pending'),
        ('2', 'Confirmed'),
        ('3', 'Completed'),
        ('4', 'Cancelled'),
    )

    PAYMENT_METHOD_CHOICES = (
        ('cash', 'Cash'),
        ('cheque', 'Cheque'),
        ('card', 'Credit/Debit Card'),
        ('bank_transfer', 'Bank Transfer'),
        ('paynow', 'PayLah/PayNow'),
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
    appointmentStatus = models.CharField(max_length=1, default=1, choices=STATUS_CHOICES)
    paymentMethod = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES, null=False, default='cash', help_text='Customer selected payment method')
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


class AppointmentRating(TimeStampedModel):
    """
    Rating given after a completed appointment.
    - ratedBy='technician': technician rates the customer (updates customer.customerRating)
    - ratedBy='customer': customer rates the technician (updates technician.technicianRating)
    One rating per appointment per direction.
    """
    RATED_BY_CHOICES = (
        ('technician', 'Technician'),
        ('customer', 'Customer'),
    )
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, unique=True, null=False)
    appointment = models.ForeignKey(
        Appointments,
        on_delete=models.CASCADE,
        db_column='appointmentId',
        related_name='ratings',
        null=False
    )
    ratedBy = models.CharField(max_length=20, choices=RATED_BY_CHOICES, null=False)
    rating = models.IntegerField(null=False, help_text='1-5 stars')

    class Meta:
        constraints = [
            UniqueConstraint(fields=['appointment', 'ratedBy'], name='unique_rating_per_appointment_direction')
        ]
        indexes = [Index(fields=['appointment']), Index(fields=['ratedBy'])]

    def __str__(self):
        return f'Rating {self.rating} by {self.ratedBy} for Appt {self.appointment.id}'


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


class TechnicianHiringApplication(TimeStampedModel):
    """
    Manages the technician hiring process with three stages:
    1. Personal details and qualifications
    2. Bank account information
    3. Coordinator approval and pay rate
    """
    APPLICATION_STATUS_CHOICES = (
        ('personal_details', 'Personal Details Pending'),
        ('bank_info', 'Bank Information Pending'),
        ('coordinator_review', 'Awaiting Coordinator Approval'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    )

    APPLICATION_SOURCE_CHOICES = (
        ('coordinator_invited', 'Coordinator Invited'),
        ('self_applied', 'Self Applied'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, unique=True, null=False)

    # How the application was initiated
    applicationSource = models.CharField(
        max_length=30,
        choices=APPLICATION_SOURCE_CHOICES,
        default='coordinator_invited',
        help_text='Whether coordinator invited or technician self-applied'
    )

    # Stage 1: Personal Details
    applicantName = models.CharField(max_length=100, null=False, help_text='Full name of applicant')
    nric = models.CharField(max_length=9, unique=True, null=False, help_text='NRIC number', validators=[
        RegexValidator(r'^[STFG]\d{7}[A-Z]$', 'NRIC must be in valid Singapore format (e.g., S1234567A)')
    ])
    citizenship = models.CharField(max_length=50, null=False, help_text='Citizenship status')
    applicantAddress = models.CharField(max_length=200, null=False, help_text='Full residential address')
    applicantPostalCode = models.CharField(max_length=6, null=False, validators=[SG_POSTAL_VALIDATOR])
    applicantPhone = models.CharField(max_length=8, null=False, validators=[SG_PHONE_VALIDATOR])
    applicantEmail = models.CharField(max_length=100, null=False, validators=[validate_email])
    workExperience = models.TextField(max_length=2000, null=False, help_text='Work experience details')
    resumeFile = models.FileField(upload_to='resumes/', null=True, blank=True, help_text='Resume upload')
    resumeFileName = models.CharField(max_length=255, null=True, blank=True, help_text='Original resume filename')
    hasCriminalRecord = models.BooleanField(default=False, help_text='Criminal record declaration')
    criminalRecordDetails = models.TextField(max_length=1000, null=True, blank=True, help_text='Details if criminal record exists')

    # Race and Language
    race = models.CharField(max_length=50, null=False, default='', help_text='Race of applicant')
    languagesSpoken = models.CharField(max_length=200, null=False, default='', help_text='Languages spoken (comma-separated)')

    # Previous Employment Information
    previousEmployer = models.CharField(max_length=200, null=True, blank=True, help_text='Name of previous employer(s)')
    lastEmployedYear = models.IntegerField(null=True, blank=True, help_text='Year when last employed')
    lastDrawnSalary = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text='Last drawn monthly salary in SGD')

    # Next of Kin Information
    nextOfKinName = models.CharField(max_length=100, null=False, default='', help_text='Name of next of kin')
    nextOfKinContact = models.CharField(max_length=8, null=False, default='', validators=[SG_PHONE_VALIDATOR], help_text='Contact number of next of kin')
    nextOfKinRelationship = models.CharField(max_length=50, null=False, default='', help_text='Relationship with next of kin')

    # Medical Fitness Declaration
    isMedicallyFit = models.BooleanField(default=False, help_text='Declaration of medical fitness to work')
    medicalFitnessConfirmedAt = models.DateTimeField(null=True, blank=True)

    # Profile Photo
    profilePhoto = models.ImageField(upload_to='profile_photos/', null=True, blank=True, help_text='Profile photo of applicant')
    profilePhotoFileName = models.CharField(max_length=255, null=True, blank=True, help_text='Original profile photo filename')

    # NRIC Photos (compulsory for identity verification - enforced in serializer)
    nricPhotoFront = models.ImageField(upload_to='nric_photos/', null=True, blank=True, help_text='NRIC front photo')
    nricPhotoBack = models.ImageField(upload_to='nric_photos/', null=True, blank=True, help_text='NRIC back photo')

    # Driving License (required for new applications - validated at serializer level)
    drivingLicense = models.ImageField(upload_to='driving_licenses/', null=True, blank=True, help_text='Driving license photo')
    drivingLicenseFileName = models.CharField(max_length=255, null=True, blank=True, help_text='Original driving license filename')

    # AC Brand Specializations
    specializations = models.JSONField(default=list, blank=True, help_text='AC brands the applicant specializes in')

    personalDetailsConfirmed = models.BooleanField(default=False, help_text='Applicant confirmed personal details')
    personalDetailsConfirmedAt = models.DateTimeField(null=True, blank=True)

    # Stage 2: Bank Account Information
    bankName = models.CharField(max_length=100, null=True, blank=True, help_text='Bank name')
    bankAccountNumber = models.CharField(max_length=50, null=True, blank=True, help_text='Bank account number')
    bankAccountHolderName = models.CharField(max_length=100, null=True, blank=True, help_text='Account holder name')
    bankInfoConfirmed = models.BooleanField(default=False, help_text='Applicant confirmed bank information')
    bankInfoConfirmedAt = models.DateTimeField(null=True, blank=True)

    # Stage 3: Coordinator Approval
    payRate = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, help_text='Hourly pay rate in SGD')
    coordinatorId = models.ForeignKey(
        Coordinators,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='hiring_applications',
        help_text='Coordinator who reviewed the application'
    )
    coordinatorNotes = models.TextField(max_length=1000, null=True, blank=True, help_text='Coordinator notes on application')
    coordinatorApproved = models.BooleanField(default=False, help_text='Coordinator approval confirmation')
    coordinatorApprovedAt = models.DateTimeField(null=True, blank=True)

    # Application Status
    applicationStatus = models.CharField(
        max_length=30,
        choices=APPLICATION_STATUS_CHOICES,
        default='personal_details',
        help_text='Current stage of application'
    )

    # Created Technician (once approved)
    createdTechnician = models.ForeignKey(
        Technicians,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='hiring_application',
        help_text='The technician account created from this application'
    )

    class Meta:
        indexes = [
            Index(fields=['nric']),
            Index(fields=['applicationStatus']),
            Index(fields=['-created_at']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f'Application: {self.applicantName} ({self.get_applicationStatus_display()})'


class TechnicianAvailability(TimeStampedModel):
    """
    Tracks technician working days and time availability.
    Ensures minimum 10 working days per technician.
    """
    DAY_CHOICES = (
        ('monday', 'Monday'),
        ('tuesday', 'Tuesday'),
        ('wednesday', 'Wednesday'),
        ('thursday', 'Thursday'),
        ('friday', 'Friday'),
        ('saturday', 'Saturday'),
        ('sunday', 'Sunday'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, unique=True, null=False)
    technicianId = models.ForeignKey(
        Technicians,
        on_delete=models.CASCADE,
        db_column='technicianId',
        related_name='availability_schedule',
        null=False
    )

    # Day of the week
    dayOfWeek = models.CharField(max_length=10, choices=DAY_CHOICES, null=False, help_text='Day of the week')

    # Time range in 24-hour format (stored as strings like "09:00", "17:00")
    startTime = models.CharField(max_length=5, null=False, help_text='Start time in HH:MM format (e.g., 09:00)')
    endTime = models.CharField(max_length=5, null=False, help_text='End time in HH:MM format (e.g., 17:00)')

    # Allow technicians to mark specific dates as unavailable
    specificDate = models.DateField(null=True, blank=True, help_text='Specific date override (e.g., leave day)')
    isAvailable = models.BooleanField(default=True, help_text='False for leave/unavailable days')

    class Meta:
        indexes = [
            Index(fields=['technicianId', 'dayOfWeek']),
            Index(fields=['technicianId', 'specificDate']),
            Index(fields=['isAvailable']),
        ]
        constraints = [
            # Ensure a technician doesn't have duplicate day entries without specific date
            UniqueConstraint(
                fields=['technicianId', 'dayOfWeek'],
                condition=Q(specificDate__isnull=True),
                name='unique_tech_day_schedule'
            ),
            # Ensure a technician doesn't have duplicate specific date entries
            UniqueConstraint(
                fields=['technicianId', 'specificDate'],
                condition=Q(specificDate__isnull=False),
                name='unique_tech_specific_date'
            ),
        ]
        ordering = ['technicianId', 'dayOfWeek', 'specificDate']

    def __str__(self):
        if self.specificDate:
            return f'{self.technicianId.technicianName} - {self.specificDate} ({"Available" if self.isAvailable else "Unavailable"})'
        return f'{self.technicianId.technicianName} - {self.get_dayOfWeek_display()}: {self.startTime}-{self.endTime}'


class TechnicianPasswordResetToken(TimeStampedModel):
    """
    Token for technician password reset.
    Tokens expire after 24 hours.
    """
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, unique=True, null=False)
    technician = models.ForeignKey(
        Technicians,
        on_delete=models.CASCADE,
        related_name='password_reset_tokens',
        null=False
    )
    token = models.CharField(max_length=100, unique=True, null=False)
    expiresAt = models.DateTimeField(null=False, help_text='Token expiration time')
    isUsed = models.BooleanField(default=False, help_text='Whether token has been used')

    class Meta:
        indexes = [
            Index(fields=['token']),
            Index(fields=['technician']),
            Index(fields=['expiresAt']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f'Password reset token for {self.technician.technicianName}'