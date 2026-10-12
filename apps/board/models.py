from django.db import models
from django.conf import settings

class Board(models.Model):
    title = models.CharField(max_length=300, default="Доска")
    data = models.JSONField(default=dict, blank=True, help_text="tldraw snapshot or fabric JSON")
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name='boards')
    lesson = models.ForeignKey('lessons.Lesson', on_delete=models.SET_NULL, null=True, blank=True, related_name='boards')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title
