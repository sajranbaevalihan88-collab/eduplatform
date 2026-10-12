# Generated for is_public fix
from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('content', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='uploadedfile',
            name='is_public',
            field=models.BooleanField(default=False, help_text='Если True — файл виден всем, иначе только владельцу'),
        ),
    ]
