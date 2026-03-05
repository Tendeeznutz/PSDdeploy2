import logging
from collections import defaultdict
from typing import Any
from datetime import datetime, timedelta

from dotenv import load_dotenv
from geopy.distance import distance as geo_distance

from .models import Appointments, Customers, Technicians, TechnicianAvailability
from .sg_geo.src import geo_onemap

load_dotenv()

logger = logging.getLogger(__name__)

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


def _get_technician_effective_location(technician, appointment_start_time):
    """
    Get the technician's effective location at the time of the appointment.
    If the technician has a prior appointment on the same day, use that
    appointment's customer location (where the technician will be).
    Otherwise, use the technician's home/profile address.
    :param technician: Technicians model instance
    :param appointment_start_time: Unix timestamp of the new appointment (or None)
    :return: location string "lat,lng"
    """
    if appointment_start_time is None:
        return technician.technicianLocation

    appointment_datetime = datetime.fromtimestamp(appointment_start_time)
    appointment_date = appointment_datetime.date()

    # Get start-of-day timestamp
    day_start = datetime.combine(appointment_date, datetime.min.time())
    day_start_ts = int(day_start.timestamp())

    # Find the most recent appointment before the requested time on the same day
    prior_appointment = Appointments.objects.filter(
        technicianId=technician.id,
        appointmentStartTime__gte=day_start_ts,
        appointmentStartTime__lt=appointment_start_time,
        appointmentStatus__in=["1", "2", "3"],  # Not cancelled
    ).order_by("-appointmentStartTime").first()

    if prior_appointment:
        try:
            prior_customer = Customers.objects.get(id=prior_appointment.customerId.id)
            if prior_customer.customerLocation and prior_customer.customerLocation != "0,0":
                return prior_customer.customerLocation
        except Customers.DoesNotExist:
            pass

    # First appointment of the day or prior customer location unavailable
    return technician.technicianLocation


def get_nearby_technicians(customer_id, aircon_brand=None, appointment_start_time=None) -> list[Any]:
    """
    Get list of available technicians that can service the customer.
    Sorted by: specialists first (by distance), then non-specialists (by distance).
    Only considers active and available technicians.
    Proximity is based on where the technician will be at the appointment time:
    - If the technician has a prior appointment that day, uses that customer's location.
    - Otherwise, uses the technician's profile/home address.
    :param customer_id: ID of the customer
    :param aircon_brand: AC brand requested (e.g., 'Daikin'). If provided, specialists are prioritized.
    :param appointment_start_time: Unix timestamp of the requested appointment (for proximity calc)
    :return: list of available technicianIDs sorted by specialization priority then distance
    """
    nearby_technicians = []
    customer = Customers.objects.get(id=customer_id)
    customer_location = customer.customerLocation

    logger.info(
        "[DISPATCH] Finding technicians for customer %s (location: %s, brand: %s, time: %s)",
        customer_id, customer_location, aircon_brand, appointment_start_time,
    )

    if not customer_location or customer_location == "0,0":
        logger.warning("[DISPATCH] Customer %s has no valid location: '%s'", customer_id, customer_location)
        return []

    customer_coords = tuple(customer_location.split(","))

    active_technicians = Technicians.objects.filter(isActive=True, technicianStatus="1")
    logger.info("[DISPATCH] Found %d active technicians to evaluate", active_technicians.count())

    for technician in active_technicians:
        # Determine where the technician will be at the time of this appointment
        technician_location = _get_technician_effective_location(
            technician, appointment_start_time
        )
        if not technician_location or technician_location == "0,0":
            logger.info(
                "[DISPATCH] Skipping %s — invalid location: '%s'",
                technician.technicianName, technician_location,
            )
            continue

        travel_type = technician.technicianTravelType
        in_range = geo_onemap.is_in_range(
            technician_location,
            customer_location,
            get_search_range(travel_type),
            travel_type,
        )
        if not in_range:
            logger.info(
                "[DISPATCH] Skipping %s — out of range (tech: %s, cust: %s)",
                technician.technicianName, technician_location, customer_location,
            )
            continue

        # Calculate straight-line distance for sorting (fast, no API call)
        try:
            tech_coords = tuple(technician_location.split(","))
            dist_meters = geo_distance(tech_coords, customer_coords).meters
        except Exception:
            dist_meters = float("inf")

        # Check if technician specializes in the requested brand
        is_specialist = False
        if aircon_brand and technician.specializations:
            is_specialist = aircon_brand in technician.specializations

        logger.info(
            "[DISPATCH] %s is in range (%.0fm away, specialist=%s)",
            technician.technicianName, dist_meters, is_specialist,
        )
        nearby_technicians.append((str(technician.id), dist_meters, is_specialist))

    # Sort: specialists first (is_specialist=True sorts before False when negated), then by distance
    nearby_technicians.sort(key=lambda x: (not x[2], x[1]))

    if len(nearby_technicians) == 0:
        logger.warning("[DISPATCH] No available technicians found for customer %s", customer_id)
    else:
        logger.info("[DISPATCH] %d technicians in range", len(nearby_technicians))

    # Return just the IDs, sorted by specialization priority then distance
    return [tech_id for tech_id, _, _ in nearby_technicians]


def find_common_timerange(appointments) -> list[Any]:
    # Step 1: Retrieve time ranges
    time_ranges = [
        (appointment.appointmentStartTime, appointment.appointmentEndTime)
        for appointment in appointments
    ]

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
    day_name = appointment_datetime.strftime("%A").lower()
    appointment_time = appointment_datetime.strftime("%H:%M")

    logger.info(
        "[AVAIL] Checking tech %s for date=%s (%s) time=%s",
        technician_id, appointment_date, day_name, appointment_time,
    )

    # Check for specific date override first
    specific_override = TechnicianAvailability.objects.filter(
        technicianId=technician_id, specificDate=appointment_date
    ).first()

    if specific_override:
        logger.info(
            "[AVAIL] Found specific date record: available=%s, hours=%s-%s",
            specific_override.isAvailable, specific_override.startTime, specific_override.endTime,
        )
        if not specific_override.isAvailable:
            logger.info("[AVAIL] -> Not available (marked unavailable)")
            return False
        if appointment_time < specific_override.startTime or appointment_time >= specific_override.endTime:
            logger.info(
                "[AVAIL] -> Not available (time %s outside %s-%s)",
                appointment_time, specific_override.startTime, specific_override.endTime,
            )
            return False
        logger.info("[AVAIL] -> Available via specific date")
        return True

    # Check regular weekly schedule
    weekly_schedule = TechnicianAvailability.objects.filter(
        technicianId=technician_id,
        dayOfWeek=day_name,
        specificDate__isnull=True,
        isAvailable=True,
    ).first()

    if not weekly_schedule:
        # If the technician has NO availability records at all, default to available
        # (they haven't configured a schedule yet, so treat them as always available)
        total_records = TechnicianAvailability.objects.filter(
            technicianId=technician_id, specificDate__isnull=True
        ).count()
        if total_records == 0:
            logger.info(
                "[AVAIL] -> Available (no schedule configured, defaulting to available)"
            )
            return True

        logger.info(
            "[AVAIL] -> Not available (has weekly schedule but not for %s)",
            day_name,
        )
        return False

    if appointment_time < weekly_schedule.startTime or appointment_time >= weekly_schedule.endTime:
        logger.info(
            "[AVAIL] -> Not available (time %s outside weekly %s-%s)",
            appointment_time, weekly_schedule.startTime, weekly_schedule.endTime,
        )
        return False

    logger.info("[AVAIL] -> Available via weekly schedule")
    return True


def is_slot_available(
    appointment_start_time,
    appointment_end_time,
    technician_appointments,
    technician_id=None,
) -> bool:
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
            appointment_start_time < buffered_end
            and new_appointment_end_with_buffer > buffered_start
        ):
            return False
    return True


def get_technician_to_assign(
    nearby_technicians,
    appointment_start_time,
    appointment_end_time,
    current_technician_id=None,
    current_appointment=None,
) -> Technicians.id:
    """
    Assign a technician from the nearby_technicians list (already sorted by distance, closest first).
    Picks the closest available technician for the given time slot.
    If current_technician_id is provided and still available, keeps the current assignment.
    """
    logger.info(
        "[ASSIGN] Assigning from %d nearby technicians for slot %s-%s",
        len(nearby_technicians), appointment_start_time, appointment_end_time,
    )
    if len(nearby_technicians) == 0:
        logger.warning("[ASSIGN] No nearby technicians to assign")
        return None

    # If updating an existing appointment and current technician is still available, keep them
    if (
        current_technician_id is not None
        and current_technician_id in nearby_technicians
    ):
        technician_appointments = Appointments.objects.filter(
            technicianId=current_technician_id
        )
        if (
            current_appointment is not None
            and current_appointment in technician_appointments
        ):
            technician_appointments = [
                appt for appt in technician_appointments if appt != current_appointment
            ]
        if is_slot_available(
            appointment_start_time,
            appointment_end_time,
            technician_appointments,
            technician_id=current_technician_id,
        ):
            return current_technician_id

    # Iterate through technicians in distance order (closest first) and return the first available
    for technician in nearby_technicians:
        technician_appointments = Appointments.objects.filter(technicianId=technician)
        if (
            current_appointment is not None
            and current_appointment in technician_appointments
        ):
            technician_appointments = [
                appt for appt in technician_appointments if appt != current_appointment
            ]

        if is_slot_available(
            appointment_start_time,
            appointment_end_time,
            technician_appointments,
            technician_id=technician,
        ):
            return technician

    # No technicians available for this time slot
    return None


def get_available_time_slots(technician_id, date_str, duration_hours=1):
    """
    Get available time slots for a technician on a specific date.
    :param technician_id: UUID of the technician
    :param date_str: Date string in YYYY-MM-DD format
    :param duration_hours: Duration of appointment in hours (default 1)
    :return: List of available time slots as tuples (start_timestamp, end_timestamp)
    """
    from datetime import datetime, timedelta

    target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    day_name = target_date.strftime("%A").lower()

    # Check for specific date override
    specific_override = TechnicianAvailability.objects.filter(
        technicianId=technician_id, specificDate=target_date
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
            isAvailable=True,
        ).first()

        if not weekly_schedule:
            return []  # Technician doesn't work on this day

        start_time_str = weekly_schedule.startTime
        end_time_str = weekly_schedule.endTime

    # Parse working hours
    start_hour, start_minute = map(int, start_time_str.split(":"))
    end_hour, end_minute = map(int, end_time_str.split(":"))

    work_start = datetime.combine(
        target_date, datetime.min.time().replace(hour=start_hour, minute=start_minute)
    )
    work_end = datetime.combine(
        target_date, datetime.min.time().replace(hour=end_hour, minute=end_minute)
    )

    # Get existing appointments for this day
    day_start_timestamp = int(work_start.timestamp())
    day_end_timestamp = int(work_end.timestamp())

    existing_appointments = Appointments.objects.filter(
        technicianId=technician_id,
        appointmentStartTime__gte=day_start_timestamp,
        appointmentStartTime__lt=day_end_timestamp,
    ).order_by("appointmentStartTime")

    # Generate available slots
    available_slots = []
    current_time = work_start
    duration_delta = timedelta(hours=duration_hours)
    buffer_delta = timedelta(seconds=TIME_BUFFER_SECONDS)

    for appointment in existing_appointments:
        appointment_start = datetime.fromtimestamp(appointment.appointmentStartTime)
        appointment_end = (
            datetime.fromtimestamp(appointment.appointmentEndTime) + buffer_delta
        )

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
