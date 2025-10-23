import csv
from io import StringIO

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase, APIClient

from ..models import AirconCatalogs


def create_csv_file(data):
    """
    Helper method to create a CSV file-like object from given data.
    """
    file = StringIO()
    writer = csv.writer(file)
    writer.writerow(data[0].keys())  # Writing headers
    for row in data:
        writer.writerow(row.values())
    file.seek(0)  # Rewind the file to the beginning
    return file


class AiconCatalogTest(APITestCase):
    def setUp(self):
        self.client = APIClient()
        self.itemA = AirconCatalogs.objects.create(airconBrand="BrandA", airconModel="ModelA")
        self.itemB = AirconCatalogs.objects.create(airconBrand="BrandB", airconModel="ModelB")

    def test_create_aircon_catalog(self):
        data = {
            "airconBrand": "Test Brand 2",
            "airconModel": "Test Model 2"
        }
        response = self.client.post(reverse("airconcatalogs-list"), data=data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    # Test Case 2: Get all aircon catalogs
    def test_get_all_aircon_catalogs(self):
        response = self.client.get(reverse("airconcatalogs-list"))
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_filter_by_airconBrand(self):
        url = reverse('airconcatalogs-list')  # Adjust based on your URL name
        response = self.client.get(url, {'airconBrand': 'BrandA'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['airconBrand'], 'BrandA')

    def test_filter_by_airconModel(self):
        url = reverse('airconcatalogs-list')
        response = self.client.get(url, {'airconModel': 'ModelB'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['airconModel'], 'ModelB')

    def test_unexpected_query_params(self):
        url = reverse('airconcatalogs-list')
        response = self.client.get(url, {'unexpectedParam': 'value'})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_return_all_objects(self):
        url = reverse('airconcatalogs-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), AirconCatalogs.objects.count())

    def test_bulk_create_success(self):
        url = reverse('airconcatalogs-bulkCreate')  # Adjust based on your URL name
        data = [
            {'airconBrand': 'BrandC', 'airconModel': 'ModelC'},
            {'airconBrand': 'BrandD', 'airconModel': 'ModelD'},
        ]
        csv_file = create_csv_file(data)
        response = self.client.post(url, {'csvFile': csv_file}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.data), len(data))

    def test_bulk_create_invalid_data(self):
        url = reverse('airconcatalogs-bulkCreate')
        # Example of invalid data; adjust based on your validation logic
        data = [
            {'airconBrand': '', 'airconModel': 'ModelA'},  # Missing brand
            {'airconBrand': 'BrandB', 'airconModel': ''},  # Missing model
        ]
        csv_file = create_csv_file(data)
        response = self.client.post(url, {'csvFile': csv_file}, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_retrieve_success(self):
        url = reverse('airconcatalogs-detail', args=[self.itemA.pk])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['airconBrand'], self.itemA.airconBrand)
        self.assertEqual(response.data['airconModel'], self.itemA.airconModel)

    def test_retrieve_not_found(self):
        url = reverse('airconcatalogs-detail', args=[999])  # Assuming 999 does not exist
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_update_method_not_allowed(self):
        url = reverse('airconcatalogs-detail', args=[1])  # Use a valid pk if your logic requires
        response = self.client.put(url, {'airconBrand': 'NewBrand'})
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_partial_update_success(self):
        url = reverse('airconcatalogs-detail', args=[self.itemA.pk])
        response = self.client.patch(url, {'airconModel': 'NewModel'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['airconModel'], 'NewModel')

    def test_partial_update_invalid_data(self):
        item = AirconCatalogs.objects.create(airconBrand="BrandA", airconModel="ModelA")
        url = reverse('airconcatalogs-detail', args=[item.pk])
        response = self.client.patch(url, {'airconBrand': ''})  # Assuming empty brand is invalid
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_destroy_success(self):
        item = AirconCatalogs.objects.create(airconBrand="BrandA", airconModel="ModelA")
        url = reverse('airconcatalogs-detail', args=[item.pk])
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(AirconCatalogs.objects.filter(pk=item.pk).exists())

    def test_destroy_not_found(self):
        url = reverse('airconcatalogs-detail', args=[999])  # Assuming 999 does not exist
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)