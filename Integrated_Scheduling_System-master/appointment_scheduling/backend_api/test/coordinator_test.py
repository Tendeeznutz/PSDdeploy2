import unittest

import requests


class CoordinatorTest(unittest.TestCase):

    def setUp(self):
        self.url = "https://integrated-scheduling.eastasia.cloudapp.azure.com/api/coordinators/"
        self.headers = {'Content-Type': 'application/json'}

    # Test connection
    def test_connection(self):
        response = requests.get(self.url)
        self.assertEqual(response.status_code, 200)

    # Test creation
    def test_create_coordinator(self):
        data = {
            "coordinatorName": "Coordinator",
            "coordinatorPhone": "00000000",
            "coordinatorEmail": "test@test.com",
            "coordinatorPassword": "password"
        }
        response = requests.post(self.url, headers=self.headers, json=data)
        print(response.json())
        self.assertEqual(response.status_code, 201)

    def test_coordinator_login(self):
        data = {
            "email": "test@test.com",
            "password": "password"
        }
        response = requests.post(self.url + "login/", headers=self.headers, json=data)
        print(response.json())
        self.assertEqual(response.status_code, 200)