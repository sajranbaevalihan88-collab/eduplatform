import os
from rest_framework import serializers
from .models import Achievement

IMAGE_EXTENSIONS = ('jpg', 'jpeg', 'png', 'webp', 'gif')


class AchievementSerializer(serializers.ModelSerializer):
    added_by_name = serializers.CharField(source='added_by.username', read_only=True, default='')
    is_image = serializers.SerializerMethodField()
    is_pdf = serializers.SerializerMethodField()
    file_name = serializers.SerializerMethodField()

    class Meta:
        model = Achievement
        fields = ['id', 'student', 'title', 'kind', 'description', 'event_date',
                  'file', 'file_name', 'is_image', 'is_pdf', 'added_by', 'added_by_name', 'created_at']
        read_only_fields = ['id', 'file', 'added_by', 'created_at']

    def get_is_image(self, obj):
        name = obj.file.name if obj.file else ''
        return name.rsplit('.', 1)[-1].lower() in IMAGE_EXTENSIONS if name else False

    def get_is_pdf(self, obj):
        name = obj.file.name if obj.file else ''
        return name.rsplit('.', 1)[-1].lower() == 'pdf' if name else False

    def get_file_name(self, obj):
        name = obj.file.name if obj.file else ''
        return os.path.basename(name) if name else ''
