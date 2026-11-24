from rest_framework import serializers
from .models import Topic, Attendance, LessonSlot, Substitution


class TopicSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source='subject.name', read_only=True, default='')
    subject_slug = serializers.CharField(source='subject.slug', read_only=True, default='')
    subject_icon = serializers.CharField(source='subject.icon', read_only=True, default='')

    class Meta:
        model = Topic
        fields = ['id', 'subject', 'subject_name', 'subject_slug', 'subject_icon', 'grade', 'num',
                  'title', 'description', 'created_by', 'created_at']
        read_only_fields = ['id', 'created_at', 'created_by']
        # Отключаем автоматический UniqueTogetherValidator, чтобы при совпадении номера темы (num)
        # бэкенд автоматически сдвигал или присваивал следующий свободный номер вместо ошибки 400.
        validators = []

    def create(self, validated_data):
        from django.db.models import Max
        req = self.context.get('request')
        if req and getattr(req, 'user', None) and req.user.is_authenticated:
            validated_data['created_by'] = req.user
        subj = validated_data.get('subject')
        grade = str(validated_data.get('grade') or '').strip()
        validated_data['grade'] = grade
        num = int(validated_data.get('num') or 1)
        if Topic.objects.filter(subject=subj, grade=grade, num=num).exists():
            max_num = Topic.objects.filter(subject=subj, grade=grade).aggregate(m=Max('num'))['m'] or 0
            num = max_num + 1
        validated_data['num'] = max(1, num)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        from django.db.models import Max
        subj = validated_data.get('subject', instance.subject)
        grade = str(validated_data.get('grade', instance.grade) or '').strip()
        validated_data['grade'] = grade
        num = int(validated_data.get('num', instance.num) or instance.num or 1)
        if Topic.objects.filter(subject=subj, grade=grade, num=num).exclude(pk=instance.pk).exists():
            max_num = Topic.objects.filter(subject=subj, grade=grade).exclude(pk=instance.pk).aggregate(m=Max('num'))['m'] or 0
            num = max_num + 1
        validated_data['num'] = max(1, num)
        return super().update(instance, validated_data)


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
