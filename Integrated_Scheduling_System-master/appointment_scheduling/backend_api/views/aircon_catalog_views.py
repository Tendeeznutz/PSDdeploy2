import csv
from io import TextIOWrapper
from uuid import UUID

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from ..models import AirconCatalogs
from ..serializers import AirconSerializer


class AirconCatalogViewSet(viewsets.ModelViewSet):
    queryset = AirconCatalogs.objects.all()
    serializer_class = AirconSerializer

    # GET request
    def list(self, request):
        if request.query_params.get('airconBrand') is not None:
            queryset = AirconCatalogs.objects.filter(airconBrand__icontains=request.query_params.get('airconBrand'))
        elif request.query_params.get('airconModel') is not None:
            queryset = AirconCatalogs.objects.filter(airconModel__icontains=request.query_params.get('airconModel'))
        elif request.GET:
            return Response(status=400)
        else:
            queryset = AirconCatalogs.objects.all()

        serializer = AirconSerializer(queryset, many=True)
        return Response(serializer.data)

    # POST request
    def create(self, request):
        # deserialize request data
        serializer = AirconSerializer(data=request.data)
        if serializer.is_valid():
            # save data to database
            serializer.save()
            # return success response
            return Response(serializer.data, status=201)
        # return error response
        return Response(serializer.errors, status=400)

    @action(detail=False, methods=['post'], url_path='bulkCreate')
    def bulkCreate(self, request, *args, **kwargs):
        try:
            csv_file = request.FILES['csvFile']
            decoded_file = TextIOWrapper(csv_file.file, encoding='utf-8')
            # Assuming the CSV file structure has 'airconBrand' and 'airconModel' columns
            csv_reader = csv.DictReader(decoded_file)
            created_entries = []

            for row in csv_reader:
                # Remove BOM character from keys
                cleaned_row = {key.lstrip('\ufeff'): value for key, value in row.items()}
                serializer = AirconSerializer(data=cleaned_row)
                if serializer.is_valid():
                    serializer.save()
                    created_entries.append(serializer.data)
                else:
                    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

            return Response(created_entries, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    # GET request with primary key
    def retrieve(self, request, pk=None):
        if pk is None:
            return Response(status=404)
        try:
            UUID(pk)
        except ValueError:
            return Response(status=404)

        item = get_object_or_404(AirconCatalogs.objects.all(), pk=pk)
        serializer = AirconSerializer(item)
        return Response(serializer.data)

    # PUT request
    def update(self, request, pk=None):
        return Response(status=405)

    # PATCH request
    def partial_update(self, request, pk=None):
        item = get_object_or_404(AirconCatalogs.objects.all(), pk=pk)
        serializer = AirconSerializer(item, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    # DELETE request
    def destroy(self, request, pk=None):
        if pk is None:
            return Response(status=404)
        try:
            UUID(pk)
        except ValueError:
            return Response(status=404)
        item = get_object_or_404(AirconCatalogs.objects.all(), pk=pk)
        item.delete()
        return Response(status=204)