from ..models import (
    Appointments,
    Customers,
    Technicians,
    CustomerAirconDevices,
    AirconCatalogs,
    AppointmentRating,
)


def prefetch_related_data(serialized_data_list):
    """
    Batch-fetch all related objects for a list of serialized appointment dicts.
    Returns a dict of lookup maps that can be passed to include_all_info.
    """
    # Collect all IDs we need to look up
    appointment_ids = []
    customer_ids = set()
    technician_ids = set()
    aircon_device_ids = set()

    for data in serialized_data_list:
        if "id" in data and "customerName" not in data:
            appointment_ids.append(data["id"])
        if (
            "customerId" in data
            and data["customerId"] is not None
            and "customerName" not in data
        ):
            customer_ids.add(data["customerId"])
        if (
            "technicianId" in data
            and data["technicianId"] is not None
            and "technicianName" not in data
        ):
            technician_ids.add(data["technicianId"])
        if "airconToService" in data and data["airconToService"] is not None:
            aircon_device_ids.update(data["airconToService"])

    # Batch queries
    appointments_map = {}
    if appointment_ids:
        for appt in Appointments.objects.filter(id__in=appointment_ids):
            appointments_map[appt.id] = appt

    customers_map = {}
    if customer_ids:
        for cust in Customers.objects.filter(id__in=customer_ids):
            customers_map[cust.id] = cust

    technicians_map = {}
    if technician_ids:
        for tech in Technicians.objects.filter(id__in=technician_ids):
            technicians_map[tech.id] = tech

    aircon_devices_map = {}
    catalog_ids = set()
    if aircon_device_ids:
        for device in CustomerAirconDevices.objects.filter(
            id__in=aircon_device_ids
        ).select_related("airconCatalogId"):
            aircon_devices_map[device.id] = device
            if device.airconCatalogId:
                catalog_ids.add(device.airconCatalogId.id)

    catalogs_map = {}
    if catalog_ids:
        for cat in AirconCatalogs.objects.filter(id__in=catalog_ids):
            catalogs_map[cat.id] = cat

    # Batch-fetch ratings: get all rating entries for these appointments
    customer_ratings = set()
    technician_ratings = set()
    if appointment_ids:
        for rating in AppointmentRating.objects.filter(
            appointment_id__in=appointment_ids
        ).values_list("appointment_id", "ratedBy"):
            if rating[1] == "customer":
                customer_ratings.add(rating[0])
            elif rating[1] == "technician":
                technician_ratings.add(rating[0])

    return {
        "appointments": appointments_map,
        "customers": customers_map,
        "technicians": technicians_map,
        "aircon_devices": aircon_devices_map,
        "catalogs": catalogs_map,
        "customer_ratings": customer_ratings,
        "technician_ratings": technician_ratings,
    }


def include_all_info(data, request=None, prefetched=None):
    """
    Include all the information of the response.
    :param data: single unit from serializer.data
    :param request: optional HTTP request for context
    :param prefetched: optional dict from prefetch_related_data() to avoid N+1 queries
    :return: formatted data
    """
    updates = {"display": {}}
    is_customer_context = request and "/api/customer/" in getattr(request, "path", "")

    if prefetched is None:
        prefetched = {}

    appointments_map = prefetched.get("appointments", {})
    customers_map = prefetched.get("customers", {})
    technicians_map = prefetched.get("technicians", {})
    aircon_devices_map = prefetched.get("aircon_devices", {})
    catalogs_map = prefetched.get("catalogs", {})
    customer_ratings = prefetched.get("customer_ratings", set())
    technician_ratings = prefetched.get("technician_ratings", set())

    # Only look up appointment if this is appointment data (not customer data)
    appointment = None
    if "id" in data and "customerName" not in data:
        appointment = appointments_map.get(data["id"])
        if appointment is None:
            try:
                appointment = Appointments.objects.get(id=data["id"])
            except Appointments.DoesNotExist:
                pass

    if (
        appointment
        and "appointmentStatus" in data
        and data["appointmentStatus"] is not None
    ):
        updates["display"]["appointmentStatus"] = (
            appointment.get_appointmentStatus_display()
        )
        # Include payment method display
        updates["display"]["paymentMethod"] = appointment.get_paymentMethod_display()

    # Include hasRated flags for rating UI (customer: hasRatedTechnician, technician: hasRatedCustomer)
    if appointment:
        if prefetched:
            # Use prefetched rating sets
            if is_customer_context:
                updates["display"]["hasRatedTechnician"] = (
                    appointment.id in customer_ratings
                )
            else:
                updates["display"]["hasRatedCustomer"] = (
                    appointment.id in technician_ratings
                )
        else:
            # Fallback to individual queries
            if is_customer_context:
                updates["display"]["hasRatedTechnician"] = (
                    AppointmentRating.objects.filter(
                        appointment=appointment, ratedBy="customer"
                    ).exists()
                )
            else:
                updates["display"]["hasRatedCustomer"] = (
                    AppointmentRating.objects.filter(
                        appointment=appointment, ratedBy="technician"
                    ).exists()
                )

    if (
        "customerId" in data
        and data["customerId"] is not None
        and "customerName" not in data
    ):
        customer = customers_map.get(data["customerId"])
        if customer is None:
            try:
                customer = Customers.objects.get(id=data["customerId"])
            except Customers.DoesNotExist:
                customer = None

        if customer:
            updates["display"]["customerName"] = customer.customerName
            updates["display"]["customerPhone"] = customer.customerPhone
            updates["display"]["customerEmail"] = customer.customerEmail
            updates["display"]["customerAddress"] = customer.customerAddress
            updates["display"]["customerPostalCode"] = customer.customerPostalCode
            if not is_customer_context:
                updates["display"]["customerRating"] = float(customer.customerRating)
                updates["display"]["customerRatingCount"] = customer.ratingCount

    if (
        "technicianId" in data
        and data["technicianId"] is not None
        and "technicianName" not in data
    ):
        technician = technicians_map.get(data["technicianId"])
        if technician is None:
            try:
                technician = Technicians.objects.get(id=data["technicianId"])
            except Technicians.DoesNotExist:
                technician = None

        if technician:
            updates["display"]["technicianName"] = technician.technicianName
            updates["display"]["technicianPhone"] = technician.technicianPhone
            updates["display"]["technicianPostalCode"] = technician.technicianPostalCode
            updates["display"]["technicianAddress"] = technician.technicianAddress
            updates["display"]["technicianRating"] = float(technician.technicianRating)
            updates["display"]["technicianRatingCount"] = (
                technician.technicianRatingCount
            )

    if "airconToService" in data and data["airconToService"] is not None:
        updates["display"]["airconToService"] = []
        updates["display"]["airconBrand"] = []
        updates["display"]["airconModel"] = []
        updates["display"]["airconType"] = []
        for customer_aircon_device_id in data["airconToService"]:
            aircon = aircon_devices_map.get(customer_aircon_device_id)
            if aircon is None:
                try:
                    aircon = CustomerAirconDevices.objects.get(
                        id=customer_aircon_device_id
                    )
                except CustomerAirconDevices.DoesNotExist:
                    aircon = None

            if aircon is None:
                # Handle deleted aircon devices (e.g., for cancelled appointments)
                updates["display"]["airconToService"].append("[Removed]")
                updates["display"]["airconType"].append(None)
                updates["display"]["airconBrand"].append(None)
                updates["display"]["airconModel"].append(None)
            else:
                updates["display"]["airconToService"].append(aircon.airconName)
                updates["display"]["airconType"].append(aircon.get_airconType_display())

                # Get brand/model from catalog if available, otherwise use airconType
                if aircon.airconCatalogId:
                    aircon_catalog = catalogs_map.get(aircon.airconCatalogId.id)
                    if aircon_catalog is None:
                        try:
                            aircon_catalog = AirconCatalogs.objects.get(
                                id=aircon.airconCatalogId.id
                            )
                        except AirconCatalogs.DoesNotExist:
                            aircon_catalog = None

                    if aircon_catalog:
                        updates["display"]["airconBrand"].append(
                            aircon_catalog.airconBrand
                        )
                        updates["display"]["airconModel"].append(
                            aircon_catalog.airconModel
                        )
                    else:
                        updates["display"]["airconBrand"].append(
                            aircon.get_airconType_display()
                        )
                        updates["display"]["airconModel"].append("")
                else:
                    # Use airconType as brand (e.g., 'daikin' -> 'Daikin')
                    updates["display"]["airconBrand"].append(
                        aircon.get_airconType_display()
                    )
                    updates["display"]["airconModel"].append("")

    if "customerName" in data and data["customerName"] is not None:
        updates["customerAirconDevices"] = []
        updates["display"]["customerAirconDevices"] = []
        updates["display"]["airconBrand"] = []
        updates["display"]["airconModel"] = []
        updates["display"]["airconType"] = []
        customer_aircon_devices = CustomerAirconDevices.objects.filter(
            customerId=data["id"]
        ).select_related("airconCatalogId")
        for customer_aircon_device in customer_aircon_devices:
            updates["customerAirconDevices"].append(customer_aircon_device.id)
            updates["display"]["customerAirconDevices"].append(
                customer_aircon_device.airconName
            )
            updates["display"]["airconType"].append(
                customer_aircon_device.get_airconType_display()
            )

            # Get brand/model from catalog if available, otherwise use airconType
            if customer_aircon_device.airconCatalogId:
                aircon_catalog = customer_aircon_device.airconCatalogId
                updates["display"]["airconBrand"].append(aircon_catalog.airconBrand)
                updates["display"]["airconModel"].append(aircon_catalog.airconModel)
            else:
                updates["display"]["airconBrand"].append(
                    customer_aircon_device.get_airconType_display()
                )
                updates["display"]["airconModel"].append("")

    data.update(updates)
    return data
