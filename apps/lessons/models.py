from django.db import models
from django.conf import settings

class Lesson(models.Model):
    title = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    subject = models.ForeignKey('catalog.Subject', on_delete=models.SET_NULL, null=True, blank=True, related_name='lessons')
    course = models.ForeignKey('catalog.Course', on_delete=models.SET_NULL, null=True, blank=True, related_name='lessons')
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name='lessons')
    is_published = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    # blocks JSON for lesson composer: ordered list of blocks
    # each block: {id, type: 'text'|'file'|'presentation'|'test'|'code'|'board'|'video', data: {...}, order}
    blocks = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title
