from datetime import datetime, timedelta
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from ..models import TechnicianAvailability, Technicians
from ..serializers import TechnicianAvailabilitySerializer
from ..scheduling_algo import get_available_time_slots


class TechnicianAvailabilityViewSet(viewsets.ModelViewSet):
    queryset = TechnicianAvailability.objects.all()
    serializer_class = TechnicianAvailabilitySerializer

    def list(self, request):
        """Get availability records, optionally filtered by technician"""
        technician_id = request.query_params.get('technicianId')
        specific_date = request.query_params.get('specificDate')
        day_of_week = request.query_params.get('dayOfWeek')

        queryset = TechnicianAvailability.objects.all()

        if technician_id:
            queryset = queryset.filter(technicianId=technician_id)

        if specific_date:
            queryset = queryset.filter(specificDate=specific_date)

        if day_of_week:
            queryset = queryset.filter(dayOfWeek=day_of_week)

        serializer = self.serializer_class(queryset, many=True)
        return Response(serializer.data)

    def retrieve(self, request, pk):
        """Get a specific availability record"""
        item = get_object_or_404(TechnicianAvailability.objects.all(), pk=pk)
        serializer = self.serializer_class(item)
        return Response(serializer.data)

    def create(self, request):
        """Create a new availability record"""
        serializer = self.serializer_class(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def update(self, request, pk):
        """Full update of availability record"""
        item = get_object_or_404(TechnicianAvailability.objects.all(), pk=pk)
        serializer = self.serializer_class(item, data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def partial_update(self, request, pk):
        """Partial update of availability record"""
        item = get_object_or_404(TechnicianAvailability.objects.all(), pk=pk)
        serializer = self.serializer_class(item, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def destroy(self, request, pk):
        """Delete an availability record"""
        item = get_object_or_404(TechnicianAvailability.objects.all(), pk=pk)

        # Check if deleting this would violate minimum working days
        technician_id = item.technicianId
        if not item.specificDate and item.isAvailable:
            # Count remaining working days after deletion
            remaining_days = TechnicianAvailability.objects.filter(
                technicianId=technician_id,
                specificDate__isnull=True,
                isAvailable=True
            ).exclude(pk=pk).values_list('dayOfWeek', flat=True).distinct().count()

            if remaining_days < 5:
                return Response(
                    {"error": f"Cannot delete. Technician must have at least 5 working days. Would have {remaining_days} days remaining."},
                    status=status.HTTP_400_BAD_REQUEST
                )

        item.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['post'], url_path='bulk-create')
    def bulk_create(self, request):
        """
        Create multiple availability records at once for a technician.
        Useful for setting up weekly schedules.

        Expected format:
        {
            "technicianId": "uuid",
            "schedules": [
                {"dayOfWeek": "monday", "startTime": "09:00", "endTime": "17:00"},
                {"dayOfWeek": "tuesday", "startTime": "09:00", "endTime": "17:00"},
                ...
            ]
        }
        """
        technician_id = request.data.get('technicianId')
        schedules = request.data.get('schedules', [])

        if not technician_id:
            return Response(
                {"error": "technicianId is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not schedules or len(schedules) < 5:
            return Response(
                {"error": "At least 5 working days are required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate technician exists
        try:
            technician = Technicians.objects.get(id=technician_id)
        except Technicians.DoesNotExist:
            return Response(
                {"error": "Technician not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        created_records = []
        errors = []

        for schedule in schedules:
            schedule_data = {
                'technicianId': technician_id,
                'dayOfWeek': schedule.get('dayOfWeek'),
                'startTime': schedule.get('startTime'),
                'endTime': schedule.get('endTime'),
                'isAvailable': True
            }

            serializer = self.serializer_class(data=schedule_data)
            if serializer.is_valid():
                serializer.save()
                created_records.append(serializer.data)
            else:
                errors.append({
                    'schedule': schedule,
                    'errors': serializer.errors
                })

        if errors:
            return Response(
                {
                    "created": created_records,
                    "errors": errors
                },
                status=status.HTTP_207_MULTI_STATUS
            )

        return Response(created_records, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='available-slots')
    def available_slots(self, request):
        """
        Get available time slots for a technician on a specific date.

        Query parameters:
        - technicianId (required): UUID of the technician
        - date (required): Date in YYYY-MM-DD format
        - durationHours (optional): Duration in hours (default 1)
        """
        technician_id = request.query_params.get('technicianId')
        date_str = request.query_params.get('date')
        duration_hours = float(request.query_params.get('durationHours', 1))

        if not technician_id or not date_str:
            return Response(
                {"error": "technicianId and date are required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate technician exists
        try:
            technician = Technicians.objects.get(id=technician_id)
        except Technicians.DoesNotExist:
            return Response(
                {"error": "Technician not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        # Validate date format
        try:
            datetime.strptime(date_str, '%Y-%m-%d')
        except ValueError:
            return Response(
                {"error": "Invalid date format. Use YYYY-MM-DD"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Get available slots
        slots = get_available_time_slots(technician_id, date_str, duration_hours)

        # Format response
        formatted_slots = []
        for start_ts, end_ts in slots:
            start_dt = datetime.fromtimestamp(start_ts)
            end_dt = datetime.fromtimestamp(end_ts)
            formatted_slots.append({
                'startTime': start_ts,
                'endTime': end_ts,
                'startTimeFormatted': start_dt.strftime('%Y-%m-%d %H:%M'),
                'endTimeFormatted': end_dt.strftime('%Y-%m-%d %H:%M')
            })

        return Response({
            'technicianId': str(technician_id),
            'technicianName': technician.technicianName,
            'date': date_str,
            'durationHours': duration_hours,
            'availableSlots': formatted_slots,
            'totalSlots': len(formatted_slots)
        })

    @action(detail=False, methods=['get'], url_path='working-days')
    def working_days(self, request):
        """
        Get all working days for a technician.

        Query parameters:
        - technicianId (required): UUID of the technician
        - startDate (optional): Start date in YYYY-MM-DD format
        - endDate (optional): End date in YYYY-MM-DD format
        """
        technician_id = request.query_params.get('technicianId')
        start_date_str = request.query_params.get('startDate')
        end_date_str = request.query_params.get('endDate')

        if not technician_id:
            return Response(
                {"error": "technicianId is required"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Validate technician exists
        try:
            technician = Technicians.objects.get(id=technician_id)
        except Technicians.DoesNotExist:
            return Response(
                {"error": "Technician not found"},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get weekly schedule
        weekly_schedule = TechnicianAvailability.objects.filter(
            technicianId=technician_id,
            specificDate__isnull=True,
            isAvailable=True
        ).values_list('dayOfWeek', flat=True)

        working_days = list(weekly_schedule)

        # Get specific date overrides if date range provided
        specific_dates = {}
        if start_date_str and end_date_str:
            try:
                start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
                end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()

                specific_overrides = TechnicianAvailability.objects.filter(
                    technicianId=technician_id,
                    specificDate__gte=start_date,
                    specificDate__lte=end_date,
                    specificDate__isnull=False
                )

                for override in specific_overrides:
                    specific_dates[override.specificDate.strftime('%Y-%m-%d')] = {
                        'isAvailable': override.isAvailable,
                        'startTime': override.startTime,
                        'endTime': override.endTime
                    }

            except ValueError:
                return Response(
                    {"error": "Invalid date format. Use YYYY-MM-DD"},
                    status=status.HTTP_400_BAD_REQUEST
                )

        return Response({
            'technicianId': str(technician_id),
            'technicianName': technician.technicianName,
            'weeklyWorkingDays': working_days,
            'totalWeeklyDays': len(working_days),
            'specificDateOverrides': specific_dates,
            'meetsMinimumRequirement': len(working_days) >= 5
        })
