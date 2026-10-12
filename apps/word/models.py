from django.db import models
from django.conf import settings


class WordDocument(models.Model):
    title = models.CharField(max_length=300, default="Документ")
    # санитизированный HTML из редактора (p/h1-h3/ul/ol/table/img)
    body_html = models.TextField(blank=True, default="")
    source_name = models.CharField(max_length=300, blank=True, default="")
    page_size = models.CharField(max_length=3, default="A4")
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True, blank=True, related_name='word_docs',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']

    def __str__(self):
        return self.title
