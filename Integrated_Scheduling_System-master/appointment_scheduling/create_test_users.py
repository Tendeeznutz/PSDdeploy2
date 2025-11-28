#!/usr/bin/env python
"""
Script to create test users for the PSD AirServe application.
All users use password: password123
"""

import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'appointment_scheduling.settings')
django.setup()

from backend_api.models import Customers, Technicians, Coordinators, AirconCatalogs

def create_test_data():
    print("Creating test users...")

    # Create Coordinators
    print("\n=== Creating Coordinators ===")
    coordinator1, created = Coordinators.objects.get_or_create(
        coordinatorEmail="admin@airserve.com",
        defaults={
            "coordinatorName": "Admin Coordinator",
            "coordinatorPhone": "91111111",
            "coordinatorPassword": "password123"
        }
    )
    print(f"[OK] {'Created' if created else 'Already exists'}: {coordinator1.coordinatorName} - {coordinator1.coordinatorEmail}")

    coordinator2 = Coordinators.objects.create(
        coordinatorName="John Admin",
        coordinatorEmail="john.admin@airserve.com",
        coordinatorPhone="91111112",
        coordinatorPassword="password123"
    )
    print(f"[OK] Created: {coordinator2.coordinatorName} - {coordinator2.coordinatorEmail}")

    # Create Technicians
    print("\n=== Creating Technicians ===")
    technician1 = Technicians.objects.create(
        technicianName="Benjamin Loh",
        technicianEmail="benjamin.tech@airserve.com",
        technicianPhone="92222221",
        technicianPassword="password123",
        technicianPostalCode="520123",
        technicianLocation="1.3521,103.8198",  # Sample Singapore coordinates
        technicianStatus="Available",
        technicianTravelType="drive"
    )
    print(f"[OK] Created: {technician1.technicianName} - {technician1.technicianEmail}")

    technician2 = Technicians.objects.create(
        technicianName="Wang Richie",
        technicianEmail="richie.tech@airserve.com",
        technicianPhone="92222222",
        technicianPassword="password123",
        technicianPostalCode="560123",
        technicianLocation="1.3500,103.8500",
        technicianStatus="Available",
        technicianTravelType="cycle"
    )
    print(f"[OK] Created: {technician2.technicianName} - {technician2.technicianEmail}")

    technician3 = Technicians.objects.create(
        technicianName="Timothy Neam",
        technicianEmail="timothy.tech@airserve.com",
        technicianPhone="92222223",
        technicianPassword="password123",
        technicianPostalCode="640123",
        technicianLocation="1.3400,103.8400",
        technicianStatus="Available",
        technicianTravelType="walk"
    )
    print(f"[OK] Created: {technician3.technicianName} - {technician3.technicianEmail}")

    # Create Customers
    print("\n=== Creating Customers ===")
    customer1 = Customers.objects.create(
        customerName="Alice Tan",
        customerEmail="alice.tan@email.com",
        customerPhone="93333331",
        customerPassword="password123",
        customerAddress="Block 123 Ang Mo Kio Avenue 3",
        customerPostalCode="560123",
        customerLocation="1.3500,103.8500"
    )
    print(f"[OK] Created: {customer1.customerName} - {customer1.customerEmail}")

    customer2 = Customers.objects.create(
        customerName="Bob Lee",
        customerEmail="bob.lee@email.com",
        customerPhone="93333332",
        customerPassword="password123",
        customerAddress="Block 456 Bedok North Street 1",
        customerPostalCode="460456",
        customerLocation="1.3300,103.9300"
    )
    print(f"[OK] Created: {customer2.customerName} - {customer2.customerEmail}")

    customer3 = Customers.objects.create(
        customerName="Charlie Wong",
        customerEmail="charlie.wong@email.com",
        customerPhone="93333333",
        customerPassword="password123",
        customerAddress="Block 789 Jurong West Street 65",
        customerPostalCode="640789",
        customerLocation="1.3400,103.7000"
    )
    print(f"[OK] Created: {customer3.customerName} - {customer3.customerEmail}")

    customer4 = Customers.objects.create(
        customerName="Diana Lim",
        customerEmail="diana.lim@email.com",
        customerPhone="93333334",
        customerPassword="password123",
        customerAddress="Block 101 Tampines Street 11",
        customerPostalCode="521101",
        customerLocation="1.3550,103.9450"
    )
    print(f"[OK] Created: {customer4.customerName} - {customer4.customerEmail}")

    # Create Aircon Catalog
    print("\n=== Creating Aircon Catalog ===")
    brands = [
        ("Daikin", ["System 1", "System 2", "System 3"]),
        ("Mitsubishi", ["MSY-GE10VA", "MSY-GE13VA", "MSY-JP13VF"]),
        ("Panasonic", ["CS-PU9WKH", "CS-PU12WKH", "CS-S10VKH"]),
        ("LG", ["S3-M09JA2FA", "S3-W09JA3AA", "Dual Inverter"]),
        ("Samsung", ["AR09TXHQASINEU", "Wind-Free", "Digital Inverter"])
    ]

    for brand, models in brands:
        for model in models:
            aircon = AirconCatalogs.objects.create(
                airconBrand=brand,
                airconModel=model
            )
            print(f"[OK] Created: {brand} - {model}")

    print("\n" + "="*60)
    print("[SUCCESS] Test data creation complete!")
    print("="*60)

if __name__ == "__main__":
    create_test_data()
