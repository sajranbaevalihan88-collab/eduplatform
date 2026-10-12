from django.db import models
from django.conf import settings


class Note(models.Model):
    title = models.CharField(max_length=200, default="Заметка")
    text = models.TextField(blank=True, default="")
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True, blank=True, related_name='notes',
    )
    lesson = models.ForeignKey(
        'lessons.Lesson', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='notes',
    )
    # напоминание по дате: когда напомнить (null = без напоминания)
    remind_at = models.DateTimeField(null=True, blank=True)
    reminded = models.BooleanField(default=False)
    # таймер с отсчётом в секундах (0 = без таймера), длительность для фронта
    timer_sec = models.IntegerField(default=0)
    done = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return self.title
