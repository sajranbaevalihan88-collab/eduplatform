from django.db import models
from django.conf import settings

class Subject(models.Model):
    name = models.CharField(max_length=200)
    slug = models.SlugField(unique=True, allow_unicode=True)
    description = models.TextField(blank=True)
    icon = models.CharField(max_length=50, blank=True, default='📚')
    color = models.CharField(max_length=20, default='#3B82F6')
    created_at = models.DateTimeField(auto_now_add=True)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name='subjects')

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name

class Course(models.Model):
    subject = models.ForeignKey(Subject, on_delete=models.CASCADE, related_name='courses')
    title = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    level = models.CharField(max_length=50, default='Начальный', choices=[('Начальный','Начальный'),('Средний','Средний'),('Продвинутый','Продвинутый')])
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.subject.name} - {self.title}"
