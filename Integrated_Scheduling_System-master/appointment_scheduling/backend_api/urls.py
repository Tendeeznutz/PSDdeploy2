from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import AppointmentViewSet, CustomerViewSet, TechnicianViewSet, \
    CoordinatorViewSet, CustomerAirconDeviceViewSet, MessageViewSet, \
    TechnicianHiringApplicationViewSet, TechnicianAvailabilityViewSet

router = DefaultRouter()
router.register(r'appointments', AppointmentViewSet, basename='appointments')
router.register(r'customers', CustomerViewSet, basename='customers')
router.register(r'technicians', TechnicianViewSet, basename='technicians')
router.register(r'coordinators', CoordinatorViewSet, basename='coordinators')
router.register(r'customeraircondevices', CustomerAirconDeviceViewSet, basename='customeraircondevices')
router.register(r'messages', MessageViewSet, basename='messages')
router.register(r'hiring-applications', TechnicianHiringApplicationViewSet, basename='hiring-applications')
router.register(r'technician-availability', TechnicianAvailabilityViewSet, basename='technician-availability')

urlpatterns = [
    path('', include(router.urls)),
]