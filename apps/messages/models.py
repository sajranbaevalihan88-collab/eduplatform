from django.conf import settings
from django.db import models


class Message(models.Model):
    """Сообщение учитель↔родитель (и админ). Кому писать — решает роль отправителя.

    правила:
      - родитель → учителя классов своих детей (+ админ)
      - учитель → родители учеников своих классов (+ админ)
      - админ → любой учитель/родитель
      - ученикам прямые сообщения не нужны (есть классы)
    """
    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                               related_name='sent_messages')
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE,
                                  related_name='received_messages')
    text = models.TextField()
    read_at = models.DateTimeField(null=True, blank=True, help_text='Когда получатель открыл')
    delivered_at = models.DateTimeField(null=True, blank=True, help_text='Когда получатель увидел (чат/диалоги)')
    del_for_sender = models.BooleanField(default=False, help_text='Удалено у отправителя')
    del_for_recipient = models.BooleanField(default=False, help_text='Удалено у получателя')
    is_deleted = models.BooleanField(default=False, help_text='Удалено у всех — текст затёрт')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['sender', 'recipient', 'created_at']),
        ]

    def __str__(self):
        return f"{self.sender_id}->{self.recipient_id}: {self.text[:20]}"
