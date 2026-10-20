from django.db import models
from django.conf import settings
import random
import string

CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'


def gen_code():
    return ''.join(random.choice(CODE_ALPHABET) for _ in range(6))


class Classroom(models.Model):
    title = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    subject = models.ForeignKey('catalog.Subject', on_delete=models.SET_NULL, null=True, blank=True, related_name='classrooms')
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='owned_classrooms')
    invite_code = models.CharField(max_length=12, unique=True, blank=True)
    color = models.CharField(max_length=20, default='#3B82F6')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.invite_code:
            for _ in range(20):
                code = gen_code()
                if not Classroom.objects.filter(invite_code=code).exists():
                    self.invite_code = code
                    break
        super().save(*args, **kwargs)

    def is_member(self, user):
        if not user or not user.is_authenticated:
            return False
        if user.is_staff or getattr(user, 'role', None) == 'admin':
            return True
        if self.owner_id == user.id:
            return True
        return self.enrollments.filter(student=user).exists()

    def __str__(self):
        return self.title


class Enrollment(models.Model):
    classroom = models.ForeignKey(Classroom, on_delete=models.CASCADE, related_name='enrollments')
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='enrollments')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        constraints = [
            models.UniqueConstraint(fields=['classroom', 'student'], name='uniq_enrollment'),
        ]

    def __str__(self):
        return f"{self.student} @ {self.classroom}"


class Assignment(models.Model):
    KIND_CHOICES = [('lesson', 'Урок'), ('test', 'Тест'), ('manual', 'Ручная колонка')]
    classroom = models.ForeignKey(Classroom, on_delete=models.CASCADE, related_name='assignments')
    kind = models.CharField(max_length=10, choices=KIND_CHOICES)
    lesson = models.ForeignKey('lessons.Lesson', on_delete=models.SET_NULL, null=True, blank=True, related_name='assignments')
    test = models.ForeignKey('assessments.Test', on_delete=models.SET_NULL, null=True, blank=True, related_name='assignments')
    instructions = models.TextField(blank=True)
    deadline = models.DateTimeField(null=True, blank=True)
    max_score = models.PositiveIntegerField(default=100)
    manual_title = models.CharField(max_length=300, blank=True, help_text="Название ручной колонки журнала")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['deadline', '-created_at']

    @property
    def title(self):
        if self.kind == 'manual':
            return self.manual_title or 'Оценка'
        if self.kind == 'lesson' and self.lesson:
            return self.lesson.title
        if self.kind == 'test' and self.test:
            return self.test.title
        return 'Задание'

    def __str__(self):
        return f"{self.classroom} — {self.title}"


class Submission(models.Model):
    STATUS_CHOICES = [('submitted', 'Сдано'), ('late', 'Просрочено')]
    assignment = models.ForeignKey(Assignment, on_delete=models.CASCADE, related_name='submissions')
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='submissions')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='submitted')
    score = models.FloatField(null=True, blank=True)
    attempt = models.ForeignKey('assessments.TestAttempt', on_delete=models.SET_NULL, null=True, blank=True, related_name='submissions')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        constraints = [
            models.UniqueConstraint(fields=['assignment', 'student'], name='uniq_submission'),
        ]

    def __str__(self):
        return f"{self.student} — {self.assignment}: {self.score}"


class Announcement(models.Model):
    classroom = models.ForeignKey(Classroom, on_delete=models.CASCADE, related_name='announcements')
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='announcements')
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.classroom}: {self.text[:50]}"


class AnnouncementComment(models.Model):
    """Комментарий к объявлению — как в Google Classroom."""
    announcement = models.ForeignKey(Announcement, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='announcement_comments')
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']

    def __str__(self):
        return f"{self.author}: {self.text[:40]}"
