from ..models import Appointments, Customers, Technicians, CustomerAirconDevices, AirconCatalogs


def include_all_info(data):
    """
    Include all the information of the response
    :param data: single unit from serializer.data
    :return: formatted data
    """
    updates = {'display': {}}

    if 'appointmentStatus' in data and data['appointmentStatus'] is not None:
        appointment = Appointments.objects.get(id=data['id'])
        updates['display']['appointmentStatus'] = appointment.get_appointmentStatus_display()

    if 'customerId' in data and data['customerId'] is not None and 'customerName' not in data:
        customer = Customers.objects.get(id=data['customerId'])
        updates['display']['customerName'] = customer.customerName
        updates['display']['customerPhone'] = customer.customerPhone
        updates['display']['customerEmail'] = customer.customerEmail
        updates['display']['customerPostalCode'] = customer.customerPostalCode

    if 'technicianId' in data and data['technicianId'] is not None and 'technicianName' not in data:
        technician = Technicians.objects.get(id=data['technicianId'])
        updates['display']['technicianName'] = technician.technicianName
        updates['display']['technicianPhone'] = technician.technicianPhone
        updates['display']['technicianPostalCode'] = technician.technicianPostalCode
        updates['display']['technicianAddress'] = technician.technicianAddress

    if 'airconToService' in data and data['airconToService'] is not None:
        updates['display']['airconToService'] = []
        updates['display']['airconBrand'] = []
        updates['display']['airconModel'] = []
        for customer_aircon_device_id in data['airconToService']:
            aircon = CustomerAirconDevices.objects.get(id=customer_aircon_device_id)
            aircon_catalog = AirconCatalogs.objects.get(id=aircon.airconCatalogId.id)
            updates['display']['airconToService'].append(aircon.airconName)
            updates['display']['airconBrand'].append(aircon_catalog.airconBrand)
            updates['display']['airconModel'].append(aircon_catalog.airconModel)

    if 'customerName' in data and data['customerName'] is not None:
        updates['customerAirconDevices'] = []
        updates['display']['customerAirconDevices'] = []
        updates['display']['airconBrand'] = []
        updates['display']['airconModel'] = []
        customer_aircon_devices = CustomerAirconDevices.objects.filter(customerId=data['id'])
        for customer_aircon_device in customer_aircon_devices:
            aircon_catalog = AirconCatalogs.objects.get(id=customer_aircon_device.airconCatalogId.id)
            updates['customerAirconDevices'].append(customer_aircon_device.id)
            updates['display']['customerAirconDevices'].append(customer_aircon_device.airconName)
            updates['display']['airconBrand'].append(aircon_catalog.airconBrand)
            updates['display']['airconModel'].append(aircon_catalog.airconModel)


    data.update(updates)
    return data
