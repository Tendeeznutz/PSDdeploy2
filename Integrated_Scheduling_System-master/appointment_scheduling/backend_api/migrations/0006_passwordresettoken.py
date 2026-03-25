# Custom migration: replaces TechnicianPasswordResetToken with generic PasswordResetToken,
# preserving existing token data.

from django.db import migrations, models
import uuid


def migrate_tokens_forward(apps, schema_editor):
    """Copy existing TechnicianPasswordResetToken rows into PasswordResetToken."""
    OldToken = apps.get_model('backend_api', 'TechnicianPasswordResetToken')
    NewToken = apps.get_model('backend_api', 'PasswordResetToken')
    for old in OldToken.objects.all():
        NewToken.objects.create(
            id=old.id,
            userType='technician',
            userId=old.technician_id,
            token=old.token,
            expiresAt=old.expiresAt,
            isUsed=old.isUsed,
        )


class Migration(migrations.Migration):

    dependencies = [
        ('backend_api', '0005_customers_telegramchatid_technicians_telegramchatid_and_more'),
    ]

    operations = [
        # 1. Create the new generic table
        migrations.CreateModel(
            name='PasswordResetToken',
            fields=[
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False, unique=True)),
                ('userType', models.CharField(help_text='customer or technician', max_length=20)),
                ('userId', models.UUIDField(help_text='ID of the customer or technician')),
                ('token', models.CharField(max_length=100, unique=True)),
                ('expiresAt', models.DateTimeField(help_text='Token expiration time')),
                ('isUsed', models.BooleanField(default=False, help_text='Whether token has been used')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
        # 2. Copy data from old table to new table
        migrations.RunPython(migrate_tokens_forward, migrations.RunPython.noop),
        # 3. Drop the old table
        migrations.DeleteModel(
            name='TechnicianPasswordResetToken',
        ),
        # 4. Add indexes
        migrations.AddIndex(
            model_name='passwordresettoken',
            index=models.Index(fields=['token'], name='backend_api_token_idx'),
        ),
        migrations.AddIndex(
            model_name='passwordresettoken',
            index=models.Index(fields=['userId', 'userType'], name='backend_api_userid_type_idx'),
        ),
        migrations.AddIndex(
            model_name='passwordresettoken',
            index=models.Index(fields=['expiresAt'], name='backend_api_expires_idx'),
        ),
    ]
