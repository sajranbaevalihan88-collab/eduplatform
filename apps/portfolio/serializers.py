from rest_framework import serializers
from .models import Achievement

IMAGE_EXTENSIONS = ('jpg', 'jpeg', 'png', 'webp', 'gif')


class AchievementSerializer(serializers.ModelSerializer):
    added_by_name = serializers.CharField(source='added_by.username', read_only=True, default='')
    is_image = serializers.SerializerMethodField()

    class Meta:
        model = Achievement
        fields = ['id', 'student', 'title', 'kind', 'description', 'event_date',
                  'file', 'is_image', 'added_by', 'added_by_name', 'created_at']
        read_only_fields = ['id', 'file', 'added_by', 'created_at']

    def get_is_image(self, obj):
        name = obj.file.name if obj.file else ''
        return name.rsplit('.', 1)[-1].lower() in IMAGE_EXTENSIONS if name else False
