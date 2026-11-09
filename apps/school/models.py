"""Школьный слой: учебная программа (темы), посещаемость, расписание и замены.

Темы привязываются к предмету (+ опционально номеру класса «8», «9», ...).
Задания класса могут ссылаться на тему → оценки автоматически агрегируются по темам.
Посещаемость: учитель отмечает класс за дату; родитель видит пропуски ребёнка.
Расписание: недельная сетка класса + замены на конкретную дату.
"""
from django.db import models
from django.conf import settings


class Topic(models.Model):
    """Тема учебной программы КР: предмет + класс + номер по порядку."""
    subject = models.ForeignKey('catalog.Subject', on_delete=models.CASCADE, related_name='topics')
    grade = models.CharField(max_length=10, blank=True, default='',
                             help_text='Класс: «8», «9», «10» … (пусто — общая для предмета)')
    num = models.PositiveIntegerField(default=1, help_text='Номер темы по порядку в программе')
    title = models.CharField(max_length=500)
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                   null=True, blank=True, related_name='topics_created')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['subject__name', 'num', 'id']
        constraints = [
            models.UniqueConstraint(fields=['subject', 'grade', 'num'], name='uniq_topic_num'),
        ]

    def __str__(self):
        g = f' ({self.grade})' if self.grade else ''
        return f'{self.subject.name}{g} — {self.num}. {self.title}'


class Attendance(models.Model):
    """Отметка посещаемости за один учебный день (lesson_num=0 — за весь день)."""
    STATUS_CHOICES = [('present', 'Был'), ('absent', 'Не был'), ('late', 'Опоздал'),
                      ('excused', 'Освобождён')]
    classroom = models.ForeignKey('classroom.Classroom', on_delete=models.CASCADE, related_name='attendance')
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='attendance')
    date = models.DateField()
    lesson_num = models.PositiveSmallIntegerField(default=0, help_text='0 — за весь день, 1..9 — конкретный урок')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES)
    note = models.CharField(max_length=200, blank=True, default='')
    marked_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                  null=True, blank=True, related_name='attendance_marks')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date', 'student_id']
        constraints = [
            models.UniqueConstraint(fields=['classroom', 'student', 'date', 'lesson_num'],
                                    name='uniq_attendance_day'),
        ]

    def __str__(self):
        return f'{self.student} @ {self.classroom} {self.date}: {self.status}'


class LessonSlot(models.Model):
    """Слот недельной сетки расписания класса."""
    classroom = models.ForeignKey('classroom.Classroom', on_delete=models.CASCADE, related_name='schedule_slots')
    weekday = models.PositiveSmallIntegerField(help_text='1=Пн … 5=Пт (6=Сб)')
    num = models.PositiveSmallIntegerField(help_text='Номер урока в дне, 1..9')
    subject = models.ForeignKey('catalog.Subject', on_delete=models.SET_NULL, null=True, blank=True,
                                related_name='slots')
    room = models.CharField(max_length=50, blank=True, default='')

    class Meta:
        ordering = ['weekday', 'num']
        constraints = [
            models.UniqueConstraint(fields=['classroom', 'weekday', 'num'], name='uniq_slot'),
        ]

    def __str__(self):
        s = self.subject.name if self.subject else '—'
        return f'{self.classroom} д{self.weekday} у{self.num}: {s}'


class Substitution(models.Model):
    """Замена урока на конкретную дату (перекрывает недельную сетку)."""
    classroom = models.ForeignKey('classroom.Classroom', on_delete=models.CASCADE, related_name='substitutions')
    date = models.DateField()
    num = models.PositiveSmallIntegerField(help_text='Номер урока 1..9')
    subject = models.ForeignKey('catalog.Subject', on_delete=models.SET_NULL, null=True, blank=True,
                                related_name='substitutions')
    note = models.CharField(max_length=200, blank=True, default='')
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
                                   null=True, blank=True, related_name='substitutions_created')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['date', 'num']
        constraints = [
            models.UniqueConstraint(fields=['classroom', 'date', 'num'], name='uniq_substitution_slot'),
        ]

    def __str__(self):
        s = self.subject.name if self.subject else 'отмена'
        return f'{self.classroom} {self.date} у{self.num}: {s}'
