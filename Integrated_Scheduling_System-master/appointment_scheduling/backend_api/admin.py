from django.contrib import admin

from .models import Appointments


class YourModelAdmin(admin.ModelAdmin):
    list_display = ('customerId','technicianId','airconToService','customerFeedback','appointmentStatus')  # Customize the displayed fields

admin.site.register(Appointments, YourModelAdmin)
