import os
import random
from collections import defaultdict
from typing import Any

from dotenv import load_dotenv

from .models import Appointments, Customers, Technicians
from .sg_geo.src import geo_onemap

load_dotenv()

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


def is_slot_available(appointment_start_time, appointment_end_time, technician_appointments) -> bool:
    for technician_appointment in technician_appointments:
        # Check if the new appointment starts before an existing appointment ends
        # and ends after an existing appointment starts.
        # This allows for an appointment to end exactly when the next one starts.
        if (
                appointment_start_time < technician_appointment.appointmentEndTime and
                appointment_end_time > technician_appointment.appointmentStartTime):
            return False
    return True


def get_technician_to_assign(nearby_technicians, appointment_start_time, appointment_end_time, current_technician_id=None, current_appointment=None) -> Technicians.id:
    # if only one technician, check if the technician is available and return the technician
    if len(nearby_technicians) == 1:
        appointment = Appointments.objects.filter(technicianId=nearby_technicians[0])
        if current_appointment is not None and current_appointment in appointment:
            appointment = [appointment for appointment in appointment if appointment != current_appointment]
        if is_slot_available(appointment_start_time, appointment_end_time, appointment):
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

            if is_slot_available(appointment_start_time, appointment_end_time, technician_appointments):
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