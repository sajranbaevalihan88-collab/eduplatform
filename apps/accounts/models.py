from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    ROLE_CHOICES = [
        ('teacher', 'Учитель'),
        ('student', 'Ученик'),
        ('admin', 'Админ'),
    ]
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='student')
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    bio = models.TextField(blank=True)
    # момент последней смены пароля: JWT, выпущенный РАНЬШЕ, считается недействительным
    # (украденный access умирает при первой же проверке, а не через 30 минут)
    password_changed_at = models.DateTimeField(null=True, blank=True, db_index=True)

    def set_password_with_stamp(self, raw_password):
        self.set_password(raw_password)
        from django.utils import timezone
        self.password_changed_at = timezone.now()

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"
