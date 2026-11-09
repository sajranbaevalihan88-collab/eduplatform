from rest_framework import serializers
from .models import Achievement


class AchievementSerializer(serializers.ModelSerializer):
    added_by_name = serializers.CharField(source='added_by.username', read_only=True, default='')

    class Meta:
        model = Achievement
        fields = ['id', 'student', 'title', 'kind', 'description', 'event_date',
                  'added_by', 'added_by_name', 'created_at']
        read_only_fields = ['id', 'added_by', 'created_at']
