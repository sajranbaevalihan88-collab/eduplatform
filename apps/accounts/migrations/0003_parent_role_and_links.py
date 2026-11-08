from django.db import migrations, models
import django.db.models.deletion

class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_user_password_changed_at_alter_user_role'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='role',
            field=models.CharField(choices=[('teacher', 'Учитель'), ('student', 'Ученик'), ('admin', 'Админ'), ('parent', 'Родитель')], default='student', max_length=20),
        ),
        migrations.CreateModel(
            name='ParentLink',
            fields=[
                ('id', models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('parent', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='parent_links', to='accounts.user')),
                ('student', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='child_links', to='accounts.user')),
            ],
            options={
                'unique_together': {('parent', 'student')},
            },
        ),
    ]
