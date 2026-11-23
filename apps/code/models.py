from django.db import models
from django.conf import settings

class CodeTask(models.Model):
    LANG_CHOICES = [
        ('python','Python'),
        ('javascript','JavaScript'),
        ('html','HTML'),
        ('css','CSS'),
        ('sql','SQL (PostgreSQL)'),
    ]
    title = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    language = models.CharField(max_length=20, choices=LANG_CHOICES, default='python')
    starter_code = models.TextField(blank=True)
    schema_sql = models.TextField(blank=True, default='', help_text="DDL и начальные данные для SQL-задач")
    solution = models.TextField(blank=True, help_text="Эталонное решение")
    tests = models.JSONField(default=list, blank=True, help_text="[{label, input, expected, hidden, type, ...}]")
    max_score = models.PositiveIntegerField(default=100)
    classroom = models.ForeignKey('classroom.Classroom', on_delete=models.SET_NULL, null=True, blank=True, related_name='code_tasks')
    assignment = models.OneToOneField('classroom.Assignment', on_delete=models.SET_NULL, null=True, blank=True, related_name='code_task')
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name='code_tasks')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} ({self.language})"

class CodeSubmission(models.Model):
    task = models.ForeignKey(CodeTask, on_delete=models.CASCADE, related_name='submissions')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True)
    code = models.TextField()
    output = models.TextField(blank=True)
    passed = models.BooleanField(default=False)
    score = models.FloatField(default=0)
    passed_tests = models.PositiveIntegerField(default=0)
    total_tests = models.PositiveIntegerField(default=0)
    test_results = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

class SharedCode(models.Model):
    """Публичная ссылка на код (как Share у online-python): [{name, content}], срок жизни."""
    token = models.CharField(max_length=32, unique=True, db_index=True)
    title = models.CharField(max_length=300, default='Без названия')
    files = models.JSONField(default=list, blank=True)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name='shared_codes')
    expires_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} ({self.token})"

    @property
    def is_expired(self):
        from django.utils import timezone
        return self.expires_at is not None and self.expires_at <= timezone.now()
