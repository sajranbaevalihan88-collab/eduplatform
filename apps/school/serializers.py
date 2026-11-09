from rest_framework import serializers
from .models import Topic, Attendance, LessonSlot, Substitution


class TopicSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True, default='')
    subject_icon = serializers.CharField(source='subject.icon', read_only=True, default='')

    class Meta:
        model = Topic
        fields = ['id', 'subject', 'subject_name', 'subject_icon', 'grade', 'num',
                  'title', 'description', 'created_at']
        read_only_fields = ['id', 'created_at', 'created_by']

    def create(self, validated_data):
        validated_data['created_by'] = self.context['request'].user
        return super().create(validated_data)


class AttendanceSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.username', read_only=True, default='')

    class Meta:
        model = Attendance
        fields = ['id', 'classroom', 'student', 'student_name', 'date', 'lesson_num',
                  'status', 'note']
        read_only_fields = ['id']


class LessonSlotSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True, default='')

    class Meta:
        model = LessonSlot
        fields = ['id', 'classroom', 'weekday', 'num', 'subject', 'subject_name', 'room']


class SubstitutionSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True, default='')

    class Meta:
        model = Substitution
        fields = ['id', 'classroom', 'date', 'num', 'subject', 'subject_name', 'note',
                  'created_at']
        read_only_fields = ['id', 'created_at']
