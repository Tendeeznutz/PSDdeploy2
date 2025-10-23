import requests
from rest_framework.test import APITestCase

from ..models import Customers


class TestCustomer(APITestCase):
    @classmethod
    def setUpClass(cls):
        customer = Customers.objects.create(
            customerName="Test Customer",
            customerPostalCode="529889",
            customerAddress="Test Address",
            customerPhone="00000000"
        )
        customer.set_password("testpassword")

    def setUp(self):
        self.headers = {'Content-Type': 'application/json'}

        self.data = {
            "customerName": "Test Customer",
            "customerPostalCode": "529889",
            "customerAddress": "Test Address",
            "customerPhone": "92345678",
            "customerEmail": "test9@test.com",
            "customerPassword": "testpassword"
        }

    # Test Case 1: Create a new customer
    def test_create_customer(self):
        self.response = requests.post(self.url, headers=self.headers, json=self.data)
        print(self.response.json())

        # check if the customer is created successfully
        self.assertEqual(self.response.status_code, 201)

        # check if the location is obtained
        self.assertEqual(self.response.json()['customerLocation'], "1.34082588501333,103.949465476094")

        # test create customer with existing particulars
        response = requests.post(self.url, headers=self.headers, json=self.data)
        self.assertEqual(response.status_code, 400)

    def test_get_all_customers(self):
        response = requests.get(self.url)
        print(response.json())
        self.assertEqual(response.status_code, 200)

    def test_get_customer_by_id(self):
        self.customerID = "ed326f7b839a4e9da754c9ebb8e412c2"
        response = requests.get(self.url + str(self.customerID) + "/")
        print(response.json())
        self.assertEqual(response.status_code, 200)

    # Test Case 4: Update a customer by ID
    def test_update_customer_by_id(self):
        self.customerID = "ed326f7b839a4e9da754c9ebb8e412c2"
        data = {
            "customerName": "Test Customer",
            "customerPostalCode": "819663",
            "customerAddress": "Test Address",
            "customerPhone": "12345678",
            "customerEmail": "changed@test.com"
        }
        response = requests.patch(self.url + str(self.customerID) + "/", headers=self.headers, json=data)
        print(response.json())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['customerEmail'], "changed@test.com")
        self.assertEqual(response.json()['customerLocation'], "1.35608608319883,103.986610582558")

    # Test Case 5: Login
    def test_login(self):
        data = {
            "email": "test@test.com",
            "password": "testpassword"
        }
        response = requests.post(self.url + "login/", headers=self.headers, json=data)
        print(response.json())
        self.assertEqual(response.status_code, 200)

    def test_get_customer_by_email(self):
        self.data = {
            "customerEmail": "wrongqir@icloud.com",
            "customerName": "Test Customer",
        }
        response = requests.get(self.url + "?customerEmail=" + self.data['customerEmail'])
        for i in response.json():
            for j in i:
                print(j + ":", i[j])
        self.assertEqual(response.status_code, 200)

    # def tearDown(self):
    #     # delete the customer created in test_create_customer
    #     if hasattr(self, 'customerID'):
    #         response = requests.delete(self.url + str(self.customerID) + "/")


if __name__ == '__main__':
    unittest.main()
