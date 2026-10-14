from rest_framework import serializers
from .models import Note


class NoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Note
        fields = [
            'id', 'title', 'text', 'lesson',
            'remind_at', 'reminded', 'timer_sec',
            'done', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_text(self, value):
        if value and len(value) > 20000:
            raise serializers.ValidationError("Заметка слишком большая (макс 20000 символов)")
        return value

    def validate_timer_sec(self, value):
        if value is None:
            return 0
        try:
            iv = int(value)
        except (TypeError, ValueError):
            raise serializers.ValidationError("timer_sec должен быть числом")
        if iv < 0 or iv > 24 * 3600:
            raise serializers.ValidationError("timer_sec от 0 до 86400")
        return iv
