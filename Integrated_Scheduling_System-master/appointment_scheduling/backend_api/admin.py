from django.contrib import admin

from .models import Appointments, TechnicianAvailability


class YourModelAdmin(admin.ModelAdmin):
    list_display = ('customerId','technicianId','airconToService','customerFeedback','appointmentStatus')  # Customize the displayed fields


class TechnicianAvailabilityAdmin(admin.ModelAdmin):
    list_display = ('technicianId', 'dayOfWeek', 'startTime', 'endTime', 'specificDate', 'isAvailable')
    list_filter = ('dayOfWeek', 'isAvailable', 'technicianId')
    search_fields = ('technicianId__technicianName',)


admin.site.register(Appointments, YourModelAdmin)
admin.site.register(TechnicianAvailability, TechnicianAvailabilityAdmin)
