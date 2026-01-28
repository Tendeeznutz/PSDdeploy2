import os
import random
from collections import defaultdict
from typing import Any
from datetime import datetime, timedelta

from dotenv import load_dotenv

from .models import Appointments, Customers, Technicians, TechnicianAvailability
from .sg_geo.src import geo_onemap

load_dotenv()

# Service and travel time buffer in seconds (2.5 hours)
TIME_BUFFER_SECONDS = 2.5 * 60 * 60  # 9000 seconds

def get_search_range(travel_type) -> int:
    """
    get search range in meters based on travel type
    All technicians use vehicles (own_vehicle, company_vehicle, rental_van)
    so a fixed 30km range is used across Singapore.
    :param travel_type: vehicle type (own_vehicle, company_vehicle, rental_van)
    :return: search range in meters (30000 = 30km)
    """
    # Fixed 30km range for all vehicle-based travel types
    return 30000


def get_nearby_technicians(customer_id) -> list[Any]:
    """
    get list of available technicians that can service the customer
    :return: list of available technicianIDs, number of times the search range is increased
    """
    nearby_technicians = []
    customer = Customers.objects.get(id=customer_id)
    customer_location = customer.customerLocation

    for technician in Technicians.objects.all():
        technician_location = technician.technicianLocation
        travel_type = technician.technicianTravelType
        if geo_onemap.is_in_range(technician_location, customer_location, get_search_range(travel_type), travel_type):
            nearby_technicians.append(str(technician.id))

    if len(nearby_technicians) == 0:
        # TODO: send email to coordinator to inform that no technicians are available
        pass

    return nearby_technicians


def find_common_timerange(appointments) -> list[Any]:
    # Step 1: Retrieve time ranges
    time_ranges = [(appointment.appointmentStartTime, appointment.appointmentEndTime) for appointment in appointments]

    # Step 2: Process time ranges to find overlaps
    # This algorithm assumes that time ranges are in Unix timestamp format (integers)
    # and finds overlaps in a simplistic manner.
    time_points = defaultdict(int)
    for start, end in time_ranges:
        time_points[start] += 1
        time_points[end] -= 1

    common_ranges = []
    ongoing = 0
    current_start = None

    for time_point in sorted(time_points):
        ongoing += time_points[time_point]
        if ongoing == len(time_ranges):  # All appointments overlap at this point
            current_start = time_point
        elif current_start is not None:
            common_ranges.append([current_start, time_point])
            current_start = None

    return common_ranges


def get_common_unavailable_time(nearby_technicians) -> list[Any]:
    """
    find the timeslots that are unavailable for all the technicians in the nearby_technicians list, for filtering of the available timeslots
    :param nearby_technicians: list of available technicianIDs, obtain from get_nearby_technicians
    :return: list of unavailable timeslots for each technician
    """
    # if there exist technician with no appointments, return empty list
    for technician in nearby_technicians:
        if len(Appointments.objects.filter(technicianId=technician)) == 0:
            return []

    appointments = Appointments.objects.filter(technicianId__in=nearby_technicians)
    return find_common_timerange(appointments)


def is_technician_available_on_day(technician_id, appointment_timestamp) -> bool:
    """
    Check if technician is available on the day of the appointment based on their schedule.
    :param technician_id: UUID of the technician
    :param appointment_timestamp: Unix timestamp of the appointment
    :return: True if technician is available, False otherwise
    """
    appointment_datetime = datetime.fromtimestamp(appointment_timestamp)
    appointment_date = appointment_datetime.date()
    day_name = appointment_datetime.strftime('%A').lower()

    # Check for specific date override first
    specific_override = TechnicianAvailability.objects.filter(
        technicianId=technician_id,
        specificDate=appointment_date
    ).first()

    if specific_override:
        # If there's a specific date entry, use that availability
        if not specific_override.isAvailable:
            return False
        # Check if appointment time falls within the specific date's time range
        appointment_time = appointment_datetime.strftime('%H:%M')
        if appointment_time < specific_override.startTime or appointment_time >= specific_override.endTime:
            return False
        return True

    # Check regular weekly schedule
    weekly_schedule = TechnicianAvailability.objects.filter(
        technicianId=technician_id,
        dayOfWeek=day_name,
        specificDate__isnull=True,
        isAvailable=True
    ).first()

    if not weekly_schedule:
        # Technician doesn't work on this day
        return False

    # Check if appointment time falls within working hours
    appointment_time = appointment_datetime.strftime('%H:%M')
    if appointment_time < weekly_schedule.startTime or appointment_time >= weekly_schedule.endTime:
        return False

    return True


def is_slot_available(appointment_start_time, appointment_end_time, technician_appointments, technician_id=None) -> bool:
    """
    Check if a time slot is available for a technician, considering 2.5 hour buffer for each appointment.
    :param appointment_start_time: Unix timestamp of appointment start
    :param appointment_end_time: Unix timestamp of appointment end
    :param technician_appointments: Queryset of existing appointments for the technician
    :param technician_id: UUID of the technician (optional, for availability check)
    :return: True if slot is available, False otherwise
    """
    # Check technician availability schedule if technician_id provided
    if technician_id:
        if not is_technician_available_on_day(technician_id, appointment_start_time):
            return False

    for technician_appointment in technician_appointments:
        # Apply 2.5 hour buffer to existing appointments
        buffered_start = technician_appointment.appointmentStartTime
        buffered_end = technician_appointment.appointmentEndTime + TIME_BUFFER_SECONDS

        # Check if the new appointment (with its own buffer) conflicts with existing appointment
        new_appointment_end_with_buffer = appointment_end_time + TIME_BUFFER_SECONDS

        if (
                appointment_start_time < buffered_end and
                new_appointment_end_with_buffer > buffered_start):
            return False
    return True


def get_technician_to_assign(nearby_technicians, appointment_start_time, appointment_end_time, current_technician_id=None, current_appointment=None) -> Technicians.id:
    # if only one technician, check if the technician is available and return the technician
    if len(nearby_technicians) == 1:
        appointment = Appointments.objects.filter(technicianId=nearby_technicians[0])
        if current_appointment is not None and current_appointment in appointment:
            appointment = [appointment for appointment in appointment if appointment != current_appointment]
        if is_slot_available(appointment_start_time, appointment_end_time, appointment, technician_id=nearby_technicians[0]):
            return nearby_technicians[0]
        else:
            # TODO: send email to coordinator to inform that no technicians are available
            return None
    else:
        # else, filter the available technicians from the nearby_technicians list, and return the technician with the least number of appointments;
        # if there are more than one technician with the least number of appointments, select by random
        available_technicians = list()
        for technician in nearby_technicians:
            technician_appointments = Appointments.objects.filter(technicianId=technician)
            if current_appointment is not None and current_appointment in technician_appointments:
                technician_appointments = [appointment for appointment in technician_appointments if
                                           appointment != current_appointment]

            if is_slot_available(appointment_start_time, appointment_end_time, technician_appointments, technician_id=technician):
                available_technicians.append(tuple((technician, len(technician_appointments))))
        if len(available_technicians) == 0:
            # TODO: send email to coordinator to inform that no technicians are available
            return None
        elif len(available_technicians) == 1:
            return available_technicians[0][0]
        elif current_technician_id is not None:
            if current_technician_id in [technician[0] for technician in available_technicians]:
                return current_technician_id
        else:
            min_appointments = min(available_technicians, key=lambda x: x[1])[1]
            available_technicians = [technician for technician in available_technicians if
                                     technician[1] == min_appointments]
            index = random.randint(0, len(available_technicians) - 1)
            return available_technicians[index][0]


def get_available_time_slots(technician_id, date_str, duration_hours=1):
    """
    Get available time slots for a technician on a specific date.
    :param technician_id: UUID of the technician
    :param date_str: Date string in YYYY-MM-DD format
    :param duration_hours: Duration of appointment in hours (default 1)
    :return: List of available time slots as tuples (start_timestamp, end_timestamp)
    """
    from datetime import datetime, timedelta

    target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    day_name = target_date.strftime('%A').lower()

    # Check for specific date override
    specific_override = TechnicianAvailability.objects.filter(
        technicianId=technician_id,
        specificDate=target_date
    ).first()

    if specific_override:
        if not specific_override.isAvailable:
            return []  # Technician is not available on this date
        start_time_str = specific_override.startTime
        end_time_str = specific_override.endTime
    else:
        # Check regular weekly schedule
        weekly_schedule = TechnicianAvailability.objects.filter(
            technicianId=technician_id,
            dayOfWeek=day_name,
            specificDate__isnull=True,
            isAvailable=True
        ).first()

        if not weekly_schedule:
            return []  # Technician doesn't work on this day

        start_time_str = weekly_schedule.startTime
        end_time_str = weekly_schedule.endTime

    # Parse working hours
    start_hour, start_minute = map(int, start_time_str.split(':'))
    end_hour, end_minute = map(int, end_time_str.split(':'))

    work_start = datetime.combine(target_date, datetime.min.time().replace(hour=start_hour, minute=start_minute))
    work_end = datetime.combine(target_date, datetime.min.time().replace(hour=end_hour, minute=end_minute))

    # Get existing appointments for this day
    day_start_timestamp = int(work_start.timestamp())
    day_end_timestamp = int(work_end.timestamp())

    existing_appointments = Appointments.objects.filter(
        technicianId=technician_id,
        appointmentStartTime__gte=day_start_timestamp,
        appointmentStartTime__lt=day_end_timestamp
    ).order_by('appointmentStartTime')

    # Generate available slots
    available_slots = []
    current_time = work_start
    duration_delta = timedelta(hours=duration_hours)
    buffer_delta = timedelta(seconds=TIME_BUFFER_SECONDS)

    for appointment in existing_appointments:
        appointment_start = datetime.fromtimestamp(appointment.appointmentStartTime)
        appointment_end = datetime.fromtimestamp(appointment.appointmentEndTime) + buffer_delta

        # Check if there's a slot before this appointment
        while current_time + duration_delta + buffer_delta <= appointment_start:
            slot_start = int(current_time.timestamp())
            slot_end = int((current_time + duration_delta).timestamp())
            available_slots.append((slot_start, slot_end))
            current_time += timedelta(minutes=30)  # 30-minute intervals

        # Move past this appointment
        current_time = max(current_time, appointment_end)

    # Check remaining time after last appointment
    while current_time + duration_delta + buffer_delta <= work_end:
        slot_start = int(current_time.timestamp())
        slot_end = int((current_time + duration_delta).timestamp())
        available_slots.append((slot_start, slot_end))
        current_time += timedelta(minutes=30)

    return available_slots