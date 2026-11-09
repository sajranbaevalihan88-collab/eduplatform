from django.conf import settings
from django.db import models


class Achievement(models.Model):
    """Достижение ученика в портфолио: грамота, кубок, благодарность, олимпиада."""
    KIND_CHOICES = [
        ('gramota', 'Грамота'),
        ('cubok', 'Кубок/место'),
        ('blagodarnost', 'Благодарность'),
        ('olimpiad', 'Олимпиада'),
        ('other', 'Другое'),
    ]
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                related_name='achievements')
    title = models.CharField(max_length=300)
    kind = models.CharField(max_length=20, choices=KIND_CHOICES, default='gramota')
    description = models.TextField(blank=True)
    # дата события (например, олимпиады), не дата внесения
    event_date = models.DateField(null=True, blank=True)
    added_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                 null=True, blank=True, related_name='achievements_added')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-event_date', '-created_at']

    def __str__(self):
        return f"{self.student.username}: {self.title}"
