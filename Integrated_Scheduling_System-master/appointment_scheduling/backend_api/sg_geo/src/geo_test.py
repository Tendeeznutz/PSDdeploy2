from appointment_scheduling.backend_api.sg_geo.src.geo_onemap import get_location_from_postal, is_in_range

# get location from postal code
start_location = get_location_from_postal('529889')
end_location = get_location_from_postal('819663')

print("start: " + start_location)
print("end: " + end_location)

# from changi hospital to changi airport, the straight line distance is < 3km
print("is in range of 3km: " + str(is_in_range(start_location, end_location, 3000, 'drive')))

# but the driving distance is about 8.1km
print("is in range of 5km: " + str(is_in_range(start_location, end_location, 5000, 'drive')))

print("is in range of 9km: " + str(is_in_range(start_location, end_location, 9000, 'drive')))
