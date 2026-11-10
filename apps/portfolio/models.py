from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import FileExtensionValidator
from django.db import models

FILE_MAX_MB = 8
ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf']


def validate_file_size(value):
    """Файл достижения не больше FILE_MAX_MB (MimeType закрывает расширение отдельно)."""
    if getattr(value, 'size', 0) > FILE_MAX_MB * 1024 * 1024:
        raise ValidationError(f'Файл больше {FILE_MAX_MB} МБ')


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
    # фото/скан грамоты или PDF, до 8 МБ
    file = models.FileField(upload_to='achievements/%Y/%m/', null=True, blank=True,
                            validators=[FileExtensionValidator(ALLOWED_EXTENSIONS),
                                        validate_file_size],
                            help_text='jpg/jpeg/png/webp/gif/pdf, до 8 МБ')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-event_date', '-created_at']

    def __str__(self):
        return f"{self.student.username}: {self.title}"
