from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    ROLE_CHOICES = [
        ('teacher', 'Учитель'),
        ('student', 'Ученик'),
        ('admin', 'Админ'),
        ('parent', 'Родитель'),
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

class ParentLink(models.Model):
    """Связка «родитель — ребёнок»: создаёт и управляет только админ.
    Родитель видит дневник/успеваемость только тех детей, что здесь привязаны."""
    parent = models.ForeignKey(User, on_delete=models.CASCADE, related_name='parent_links')
    student = models.ForeignKey(User, on_delete=models.CASCADE, related_name='child_links')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [['parent', 'student']]

    def __str__(self):
        return f"{self.parent.username} -> {self.student.username}"
