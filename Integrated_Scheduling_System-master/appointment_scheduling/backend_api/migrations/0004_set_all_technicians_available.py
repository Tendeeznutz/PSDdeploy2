"""
Data migration to set all technicians to status '1' (Available) by default.
Coordinators can override this via the dashboard toggle.
"""
from django.db import migrations


def set_all_technicians_available(apps, schema_editor):
    Technicians = apps.get_model('backend_api', 'Technicians')
    Technicians.objects.filter(technicianStatus='2').update(technicianStatus='1')


def reverse_noop(apps, schema_editor):
    pass  # No reverse needed


class Migration(migrations.Migration):

    dependencies = [
        ('backend_api', '0003_alter_technicians_techniciantraveltype'),
    ]

    operations = [
        migrations.RunPython(set_all_technicians_available, reverse_noop),
    ]
