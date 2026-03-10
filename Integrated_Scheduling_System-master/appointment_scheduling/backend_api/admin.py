from django.contrib import admin

from .models import (
    Appointments,
    Customers,
    Technicians,
    Coordinators,
    CustomerAirconDevices,
    AirconCatalogs,
    Messages,
    TechnicianHiringApplication,
    TechnicianAvailability,
    AppointmentRating,
    TechnicianPasswordResetToken,
    TelegramLinkToken,
)


class AppointmentsAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "customerId",
        "technicianId",
        "appointmentStatus",
        "appointmentStartTime",
        "appointmentEndTime",
    )
    list_filter = ("appointmentStatus",)
    search_fields = ("id",)


class CustomersAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "customerName",
        "customerEmail",
        "customerPhone",
        "customerPostalCode",
        "telegramChatId",
    )
    search_fields = ("customerName", "customerEmail", "customerPhone")


class TechniciansAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "technicianName",
        "technicianEmail",
        "technicianPhone",
        "technicianStatus",
        "isActive",
        "telegramChatId",
    )
    list_filter = ("technicianStatus", "isActive")
    search_fields = ("technicianName", "technicianEmail", "technicianPhone")


class CoordinatorsAdmin(admin.ModelAdmin):
    list_display = ("id", "coordinatorName", "coordinatorEmail", "coordinatorPhone")
    search_fields = ("coordinatorName", "coordinatorEmail")


class CustomerAirconDevicesAdmin(admin.ModelAdmin):
    list_display = ("id", "airconName", "customerId", "numberOfUnits", "airconType")
    list_filter = ("airconType",)
    search_fields = ("airconName",)


class AirconCatalogsAdmin(admin.ModelAdmin):
    list_display = ("id", "airconBrand", "airconModel")
    search_fields = ("airconBrand", "airconModel")


class MessagesAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "senderName",
        "recipientName",
        "subject",
        "isRead",
        "created_at",
    )
    list_filter = ("isRead", "senderType", "recipientType")
    search_fields = ("senderName", "recipientName", "subject")


class TechnicianHiringApplicationAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "applicantName",
        "applicantEmail",
        "applicationStatus",
        "applicationSource",
        "created_at",
    )
    list_filter = ("applicationStatus", "applicationSource")
    search_fields = ("applicantName", "applicantEmail", "nric")


class TechnicianAvailabilityAdmin(admin.ModelAdmin):
    list_display = (
        "technicianId",
        "dayOfWeek",
        "startTime",
        "endTime",
        "specificDate",
        "isAvailable",
    )
    list_filter = ("dayOfWeek", "isAvailable", "technicianId")
    search_fields = ("technicianId__technicianName",)


class AppointmentRatingAdmin(admin.ModelAdmin):
    list_display = ("id", "appointment", "ratedBy", "rating")
    list_filter = ("ratedBy", "rating")
    search_fields = ("appointment__id",)


class TechnicianPasswordResetTokenAdmin(admin.ModelAdmin):
    list_display = ("id", "technician", "expiresAt", "isUsed")
    list_filter = ("isUsed",)
    search_fields = ("technician__technicianName",)


admin.site.register(Appointments, AppointmentsAdmin)
admin.site.register(Customers, CustomersAdmin)
admin.site.register(Technicians, TechniciansAdmin)
admin.site.register(Coordinators, CoordinatorsAdmin)
admin.site.register(CustomerAirconDevices, CustomerAirconDevicesAdmin)
admin.site.register(AirconCatalogs, AirconCatalogsAdmin)
admin.site.register(Messages, MessagesAdmin)
admin.site.register(TechnicianHiringApplication, TechnicianHiringApplicationAdmin)
admin.site.register(TechnicianAvailability, TechnicianAvailabilityAdmin)
admin.site.register(AppointmentRating, AppointmentRatingAdmin)
admin.site.register(TechnicianPasswordResetToken, TechnicianPasswordResetTokenAdmin)


class TelegramLinkTokenAdmin(admin.ModelAdmin):
    list_display = ("token", "userType", "userId", "expiresAt", "isUsed", "created_at")
    list_filter = ("userType", "isUsed")
    search_fields = ("token", "userId")


admin.site.register(TelegramLinkToken, TelegramLinkTokenAdmin)
