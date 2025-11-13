import os
from urllib.parse import urlencode

import requests
from dotenv import load_dotenv, find_dotenv
from geopy.distance import distance

from .get_api_key import update_api_key


def search_address_from_postal(postal_code) -> requests.Response:
    """
    api call to search for address from postal code
    :param postal_code: Singapore postal code
    :return: response from api call
    """
    url = "https://www.onemap.gov.sg/api/common/elastic/search?searchVal={}&returnGeom=Y&getAddrDetails=Y".format(
        postal_code)
    response = requests.request("GET", url)
    if response.status_code == 200:
        return response
    else:
        raise Exception('Error in search_address_from_postal')


def get_address_from_postal(postal_code) -> str:
    """
    extract the human-readable address from the response of search_address_from_postal
    :param postal_code: Singapore postal code
    :return: human-readable address
    """
    response = search_address_from_postal(postal_code)
    return response.json()['results'][0]['ADDRESS']


def get_location_from_postal(postal_code) -> str:
    """
    extract the location from the response of search_address_from_postal
    :param postal_code: Singapore postal code
    :return: location in string with format 'latitude,longitude'
    """
    try:
        response = search_address_from_postal(postal_code)
        results = response.json().get('results', [])
        if results and len(results) > 0:
            return str(results[0]['LATITUDE']) + ',' + str(results[0]['LONGITUDE'])
        else:
            # Return null island coordinates if no results found
            return '0,0'
    except Exception as e:
        print(f"Error getting location for postal code {postal_code}: {e}")
        # Return default coordinates on error
        return '0,0'


def get_route(start_location, end_location, travel_type='walk') -> requests.Response:
    """
    get the route from start location to end location from onemap api
    :param start_location: obtain from get_location_from_postal, in string with format 'latitude,longitude'
    :param end_location: obtain from get_location_from_postal, in string with format 'latitude,longitude'
    :param travel_type: 'walk', 'drive' or 'cycle', default is 'walk'
    :return: response from api call
    """
    env = find_dotenv()
    load_dotenv(env, override=True)
    api_key = os.getenv('ONEMAP_API_KEY')
    headers = {"Authorization": api_key}

    params = {
        'start': start_location,
        'end': end_location,
        'routeType': travel_type
    }
    url = "https://www.onemap.gov.sg/api/public/routingsvc/route?{}".format(urlencode(params))
    response = requests.request("GET", url, headers=headers)
    if response.status_code == 200:
        return response
    else:
        print("Error:", response.json())

        api_key = update_api_key()
        headers = {"Authorization": api_key}

        response = requests.request("GET", url, headers=headers)
        if response.status_code == 200:
            return response
        else:
            raise Exception('Error in get_route')


def get_travel_distance(start_location, end_location, travel_type='walk') -> int:
    """
    extract the travel distance from the response of get_route
    :param start_location: obtain from get_location_from_postal, in string with format 'latitude,longitude'
    :param end_location: obtain from get_location_from_postal, in string with format 'latitude,longitude'
    :param travel_type: 'walk', 'drive' or 'cycle', default is 'walk'
    :return: travel distance in meters
    """
    response = get_route(start_location, end_location, travel_type)
    return response.json()['route_summary']['total_distance']


def is_in_range(start_location, end_location, search_range, travel_type='walk') -> bool:
    """
    check if the travel distance is within the range; if the straight line distance is not within the range, it will
    not call the api and simply return False, otherwise it will call the api to get the travel distance and compare
    with the range.
    :param start_location: obtain from get_location_from_postal, in string with format 'latitude,longitude'
    :param end_location: obtain from get_location_from_postal, in string with format 'latitude,longitude'
    :param search_range: range in meters
    :param travel_type: 'walk', 'drive' or 'cycle', default is 'walk'
    :return: True if the travel distance is within the range, False otherwise
    """
    try:
        start = tuple(start_location.split(','))
        end = tuple(end_location.split(','))
        straight_line_distance = distance(start, end).meters

        if search_range < straight_line_distance:  # straight line distance not in range
            return False

        # Try to get travel distance from API, but fall back to straight-line distance if API fails
        try:
            travel_distance = get_travel_distance(start_location, end_location, travel_type)
            if search_range < travel_distance:  # travel distance not in range
                return False
        except Exception as e:
            print(f"Warning: Could not get travel distance from OneMap API, using straight-line distance instead: {e}")
            # If API call fails, use straight-line distance (already checked above, so we're OK)
            pass

        return True
    except Exception as e:
        print(f"Error in is_in_range: {e}")
        return False
