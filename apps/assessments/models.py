from django.db import models
from django.conf import settings

class Test(models.Model):
    title = models.CharField(max_length=300)
    description = models.TextField(blank=True)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name='tests')
    is_public = models.BooleanField(default=True)
    is_lesson_private = models.BooleanField(default=False, help_text="Создан внутри урока — не показывать в общей ленте")
    lesson = models.ForeignKey('lessons.Lesson', on_delete=models.SET_NULL, null=True, blank=True, related_name='tests', help_text="Урок, внутри которого создан контент. Пока урок не опубликован — видит только владелец")
    pass_score = models.PositiveIntegerField(default=50, help_text="% для прохождения")
    time_limit = models.PositiveIntegerField(default=0, help_text="минуты, 0 = без лимита")
    time_per_question = models.PositiveIntegerField(default=30, help_text="секунд на вопрос при прохождении, 0 = без лимита (антиспид-чит)")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

class Question(models.Model):
    TYPE_CHOICES = [
        ('single', 'Один ответ'),
        ('multiple', 'Несколько ответов'),
        ('true_false', 'Верно/Неверно'),
    ]
    test = models.ForeignKey(Test, on_delete=models.CASCADE, related_name='questions')
    text = models.TextField()
    type = models.CharField(max_length=20, choices=TYPE_CHOICES, default='single')
    points = models.PositiveIntegerField(default=1)
    order = models.PositiveIntegerField(default=0)
    explanation = models.TextField(blank=True)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f"{self.test.title} - Q{self.order}"

class AnswerOption(models.Model):
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name='options')
    text = models.CharField(max_length=500)
    is_correct = models.BooleanField(default=False)
    order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return self.text

class TestAttempt(models.Model):
    test = models.ForeignKey(Test, on_delete=models.CASCADE, related_name='attempts')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name='attempts')
    score = models.FloatField(default=0)
    max_score = models.FloatField(default=0)
    passed = models.BooleanField(default=False)
    answers = models.JSONField(default=dict, blank=True)  # {question_id: [option_ids] or text}
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Attempt {self.id} - {self.test.title} - {self.score}%"
