from django.db import models
from django.conf import settings
import os

import uuid
from django.core.validators import FileExtensionValidator

def upload_path(instance, filename):
    # безопасное имя: uuid + санитизированное расширение
    ext = os.path.splitext(filename)[1].lower()
    # только разрешенные расширения
    allowed = ['.pptx','.ppt','.docx','.doc','.pdf','.png','.jpg','.jpeg','.gif','.webp']
    if ext not in allowed:
        ext = '.bin'
    safe_name = f"{uuid.uuid4().hex}{ext}"
    owner_id = instance.owner.id if instance.owner else 'anon'
    return f"uploads/{owner_id}/{safe_name}"

class UploadedFile(models.Model):
    FILE_TYPES = [
        ('presentation', 'Презентация'),
        ('document', 'Документ'),
        ('pdf', 'PDF'),
        ('image', 'Изображение'),
        ('other', 'Другое'),
    ]
    title = models.CharField(max_length=300)
    file = models.FileField(upload_to=upload_path)
    file_type = models.CharField(max_length=20, choices=FILE_TYPES, default='other')
    mime_type = models.CharField(max_length=100, blank=True)
    size = models.PositiveIntegerField(default=0)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name='files')
    is_public = models.BooleanField(default=False, help_text="Если True — файл виден всем, иначе только владельцу")
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if self.file:
            ext = os.path.splitext(self.file.name)[1].lower()
            if ext in ['.pptx','.ppt']: self.file_type='presentation'
            elif ext in ['.docx','.doc']: self.file_type='document'
            elif ext in ['.pdf']: self.file_type='pdf'
            elif ext in ['.png','.jpg','.jpeg','.gif','.webp']: self.file_type='image'
            try: self.size = self.file.size
            except: pass
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title

class MediaBlob(models.Model):
    """Бинарные данные загруженных медиа (картинки слайдов, PDF-двойники).
    Render free = эфемерный диск: файлы пропадают при редеплое.
    БД переживает редеплои — раздаём с диска, при промахе — из БД (и кэшируем обратно на диск)."""
    key = models.CharField(max_length=300, unique=True, help_text="Относительный путь, напр. pptx_images/abc123.jpg")
    data = models.BinaryField()
    mime = models.CharField(max_length=100, default='application/octet-stream')
    size = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.key

class Presentation(models.Model):
    title = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name='presentations')
    subject = models.ForeignKey('catalog.Subject', on_delete=models.SET_NULL, null=True, blank=True, related_name='presentations')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_public = models.BooleanField(default=True)
    is_lesson_private = models.BooleanField(default=False, help_text="Создана внутри урока — не показывать в общей ленте, видна только в уроке")
    lesson = models.ForeignKey('lessons.Lesson', on_delete=models.SET_NULL, null=True, blank=True, related_name='presentations', help_text="Урок, внутри которого создан контент. Пока урок не опубликован — видит только владелец")
    # PDF-двойник оригинала (LibreOffice-конверт): просмотр «как в PowerPoint» попиксельно
    pdf_file = models.FileField(upload_to='pptx_pdf/', blank=True, null=True)
    pdf_pages = models.PositiveIntegerField(default=0)

    def __str__(self):
        return self.title

class Slide(models.Model):
    presentation = models.ForeignKey(Presentation, on_delete=models.CASCADE, related_name='slides')
    order = models.PositiveIntegerField(default=0)
    background = models.TextField(default='#ffffff')
    background_type = models.CharField(max_length=20, default='solid', choices=[('solid','Solid'),('gradient','Gradient'),('image','Image')])
    gradient = models.TextField(blank=True, default='')
    bg_image = models.TextField(blank=True, default='')
    layout = models.CharField(max_length=30, default='blank')
    transition = models.CharField(max_length=30, default='fade')
    width = models.IntegerField(default=0)
    height = models.IntegerField(default=0)
    # content JSON: {"blocks": [{"type":"text","content":"...","style":{x,y,w,h,unit,rotation,zIndex, fontSize,bold,color,align,background,runs,paragraphs}, "paragraphs": [...]} , {"type":"image","src":"...","style":{x,y,w,h}}, {"type":"shape","shape":"rect"}, {"type":"table","table":{rows,cols,cells}}]}
    content = models.JSONField(default=dict, blank=True)
    notes = models.TextField(blank=True)
    preview_image = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"Slide {self.order} - {self.presentation.title}"
