import unittest

import requests


class TestTechnician(unittest.TestCase):
    def setUp(self):
        self.url = "https://integrated-scheduling.eastasia.cloudapp.azure.com/api/technicians/"
        self.headers = {'Content-Type': 'application/json'}

        self.data = {
            "technicianName": "Test Technician",
            "technicianPostalCode": "529889",
            "technicianAddress": "Test Address",
            "technicianPhone": "32345678",
            "technicianEmail": "test@tech.com",
            "technicianPassword": "techpassword",
        }

    # Test Case 1: Create a new customer
    def test_create_technician(self):
        self.response = requests.post(self.url, headers=self.headers, json=self.data)
        print(self.response.json())
        self.technicianID = self.response.json()['id']

        # check if the customer is created successfully
        self.assertEqual(self.response.status_code, 201)

        # check if the location is obtained
        self.assertEqual(self.response.json()['technicianLocation'], "1.34082588501333,103.949465476094")

        # test create customer with existing particulars
        response = requests.post(self.url, headers=self.headers, json=self.data)
        self.assertEqual(response.status_code, 400)

    # Test Case 2: Get all technicians
    def test_get_all_technicians(self):
        response = requests.get(self.url)
        print(response.json())
        self.assertEqual(response.status_code, 200)

    # Test Case 3: Get a customer by ID
    # def test_get_technician_by_id(self):
    #     response = requests.get(self.url + str(self.technicianID) + "/")
    #     print(response.json())
    #     self.assertEqual(response.status_code, 200)
    #
    # # Test Case 4: Update a customer by ID
    # def test_update_technician_by_id(self):
    #     self.technicianID = "252b6fe3eac9414487d1af4b613532da"
    #     data = {
    #         "technicianPostalCode": "819663",
    #         "technicianAddress": "Test Address",
    #         "technicianPassword": "techpassword123",
    #     }
    #     response = requests.patch(self.url + str(self.technicianID) + "/", headers=self.headers, json=data)
    #     self.assertEqual(response.status_code, 200)
    #     self.assertEqual(response.json()['technicianLocation'], "1.35608608319883,103.986610582558")
    #     self.assertNotEqual(response.json()['technicianPassword'], self.data['technicianPassword'])

    # def tearDown(self):
    #     # delete the customer created in test_create_customer
    #     if hasattr(self, 'technicianID'):
    #         response = requests.delete(self.url + str(self.technicianID) + "/")


if __name__ == '__main__':
    unittest.main()