from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('backend_api', '0006_passwordresettoken'),
    ]

    operations = [
        migrations.AlterField(
            model_name='appointments',
            name='customerId',
            field=models.ForeignKey(
                db_column='customerId',
                default=None,
                on_delete=django.db.models.deletion.PROTECT,
                related_name='appointments',
                to='backend_api.customers',
            ),
        ),
        migrations.AlterField(
            model_name='appointments',
            name='technicianId',
            field=models.ForeignKey(
                blank=True,
                db_column='technicianId',
                default=None,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='appointments',
                to='backend_api.technicians',
            ),
        ),
        migrations.AlterField(
            model_name='customers',
            name='customerLocation',
            field=models.CharField(max_length=64, null=True),
        ),
        migrations.AlterField(
            model_name='technicians',
            name='technicianLocation',
            field=models.CharField(max_length=64, null=True),
        ),
    ]
