import unittest

import requests

aircon_catalog_id = "dd75bab0-4198-43ad-a41a-edad3dcfa3da"
customer_id = "80185e73-9011-4074-a107-4360d8bf0103"

class AirconDeviceTest(unittest.TestCase):

    def setUp(self):
        self.url = "https://integrated-scheduling.eastasia.cloudapp.azure.com/api/customeraircondevices/"
        self.headers = {'Content-Type': 'application/json'}

    # Test Case 1: Create a new aircon device
    def test_create_aircon_device(self):
        data = {
            "airconName": "Test Aircon",
            "airconCatalogId": aircon_catalog_id,
            "customerId": customer_id,

        }
        response = requests.post(self.url, headers=self.headers, json=data)
        self.assertEqual(response.status_code, 201)

    # Test Case 2: Create a new aircon device with invalid airconCatalogId
    def test_create_aircon_device_invalid_airconCatalogId(self):
        data = {
            "airconName": "Test Aircon",
            "airconCatalogId": "invalid",
            "customerId": customer_id,

        }
        response = requests.post(self.url, headers=self.headers, json=data)
        self.assertEqual(response.status_code, 400)

    # Test Case 3: Create a new aircon device with invalid customerId
    def test_create_aircon_device_invalid_customerId(self):
        data = {
            "airconName": "Test Aircon",
            "airconCatalogId": aircon_catalog_id,
            "customerId": "invalid",

        }
        response = requests.post(self.url, headers=self.headers, json=data)
        self.assertEqual(response.status_code, 400)

    # Test Case 4: get airon by customer id
    def test_get_aircon_by_customer_id(self):
        response = requests.get(self.url + "?customerId=" + customer_id)
        for i in response.json():
            print(i)
        self.assertEqual(response.status_code, 200)

    # Test Case 5: get all aircons
    def test_get_all_aircons(self):
        response = requests.get(self.url)
        for i in response.json():
            print(i)
        self.assertEqual(response.status_code, 200)