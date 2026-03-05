from ..models import (
    Appointments,
    Customers,
    Technicians,
    CustomerAirconDevices,
    AirconCatalogs,
    AppointmentRating,
)


def include_all_info(data, request=None):
    """
    Include all the information of the response
    :param data: single unit from serializer.data
    :return: formatted data
    """
    updates = {"display": {}}
    is_customer_context = request and "/api/customer/" in getattr(request, "path", "")

    # Only look up appointment if this is appointment data (not customer data)
    appointment = None
    if "id" in data and "customerName" not in data:
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
        if is_customer_context:
            updates["display"]["hasRatedTechnician"] = AppointmentRating.objects.filter(
                appointment=appointment, ratedBy="customer"
            ).exists()
        else:
            updates["display"]["hasRatedCustomer"] = AppointmentRating.objects.filter(
                appointment=appointment, ratedBy="technician"
            ).exists()

    if (
        "customerId" in data
        and data["customerId"] is not None
        and "customerName" not in data
    ):
        try:
            customer = Customers.objects.get(id=data["customerId"])
            updates["display"]["customerName"] = customer.customerName
            updates["display"]["customerPhone"] = customer.customerPhone
            updates["display"]["customerEmail"] = customer.customerEmail
            updates["display"]["customerPostalCode"] = customer.customerPostalCode
            if not is_customer_context:
                updates["display"]["customerRating"] = float(customer.customerRating)
                updates["display"]["customerRatingCount"] = customer.ratingCount
        except Customers.DoesNotExist:
            pass

    if (
        "technicianId" in data
        and data["technicianId"] is not None
        and "technicianName" not in data
    ):
        try:
            technician = Technicians.objects.get(id=data["technicianId"])
            updates["display"]["technicianName"] = technician.technicianName
            updates["display"]["technicianPhone"] = technician.technicianPhone
            updates["display"]["technicianPostalCode"] = technician.technicianPostalCode
            updates["display"]["technicianAddress"] = technician.technicianAddress
            updates["display"]["technicianRating"] = float(technician.technicianRating)
            updates["display"]["technicianRatingCount"] = (
                technician.technicianRatingCount
            )
        except Technicians.DoesNotExist:
            pass

    if "airconToService" in data and data["airconToService"] is not None:
        updates["display"]["airconToService"] = []
        updates["display"]["airconBrand"] = []
        updates["display"]["airconModel"] = []
        updates["display"]["airconType"] = []
        for customer_aircon_device_id in data["airconToService"]:
            try:
                aircon = CustomerAirconDevices.objects.get(id=customer_aircon_device_id)
                updates["display"]["airconToService"].append(aircon.airconName)
                updates["display"]["airconType"].append(aircon.get_airconType_display())

                # Get brand/model from catalog if available, otherwise use airconType
                if aircon.airconCatalogId:
                    aircon_catalog = AirconCatalogs.objects.get(
                        id=aircon.airconCatalogId.id
                    )
                    updates["display"]["airconBrand"].append(aircon_catalog.airconBrand)
                    updates["display"]["airconModel"].append(aircon_catalog.airconModel)
                else:
                    # Use airconType as brand (e.g., 'daikin' -> 'Daikin')
                    updates["display"]["airconBrand"].append(aircon.get_airconType_display())
                    updates["display"]["airconModel"].append("")
            except CustomerAirconDevices.DoesNotExist:
                # Handle deleted aircon devices (e.g., for cancelled appointments)
                updates["display"]["airconToService"].append("[Removed]")
                updates["display"]["airconType"].append(None)
                updates["display"]["airconBrand"].append(None)
                updates["display"]["airconModel"].append(None)

    if "customerName" in data and data["customerName"] is not None:
        updates["customerAirconDevices"] = []
        updates["display"]["customerAirconDevices"] = []
        updates["display"]["airconBrand"] = []
        updates["display"]["airconModel"] = []
        updates["display"]["airconType"] = []
        customer_aircon_devices = CustomerAirconDevices.objects.filter(
            customerId=data["id"]
        )
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
                aircon_catalog = AirconCatalogs.objects.get(
                    id=customer_aircon_device.airconCatalogId.id
                )
                updates["display"]["airconBrand"].append(aircon_catalog.airconBrand)
                updates["display"]["airconModel"].append(aircon_catalog.airconModel)
            else:
                updates["display"]["airconBrand"].append(customer_aircon_device.get_airconType_display())
                updates["display"]["airconModel"].append("")

    data.update(updates)
    return data
