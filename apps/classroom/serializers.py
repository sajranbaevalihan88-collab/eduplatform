from rest_framework import serializers
from .models import Classroom, Enrollment, Assignment, Submission, Announcement


class ClassroomSerializer(serializers.ModelSerializer):
    owner_name = serializers.CharField(source='owner.username', read_only=True, default='')
    subject_name = serializers.CharField(source='subject.name', read_only=True, default='')
    members_count = serializers.IntegerField(source='enrollments.count', read_only=True)
    assignments_count = serializers.IntegerField(source='assignments.count', read_only=True)

    class Meta:
        model = Classroom
        fields = ['id', 'title', 'description', 'subject', 'subject_name', 'owner', 'owner_name',
                  'invite_code', 'color', 'created_at', 'members_count', 'assignments_count']
        read_only_fields = ['id', 'owner', 'invite_code', 'created_at']


class EnrollmentSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.username', read_only=True, default='')

    class Meta:
        model = Enrollment
        fields = ['id', 'classroom', 'student', 'student_name', 'created_at']
        read_only_fields = ['id', 'created_at']


class AssignmentSerializer(serializers.ModelSerializer):
    title = serializers.CharField(read_only=True)
    object_id = serializers.SerializerMethodField()

    class Meta:
        model = Assignment
        fields = ['id', 'classroom', 'kind', 'lesson', 'test', 'title', 'object_id',
                  'instructions', 'deadline', 'max_score', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_object_id(self, obj):
        if obj.kind == 'lesson' and obj.lesson_id:
            return obj.lesson_id
        if obj.kind == 'test' and obj.test_id:
            return obj.test_id
        return None

    def validate(self, attrs):
        kind = attrs.get('kind', getattr(self.instance, 'kind', None))
        lesson = attrs.get('lesson', getattr(self.instance, 'lesson', None))
        test = attrs.get('test', getattr(self.instance, 'test', None))
        if kind == 'lesson' and not lesson:
            raise serializers.ValidationError({'lesson': 'Выбери урок для задания'})
        if kind == 'test' and not test:
            raise serializers.ValidationError({'test': 'Выбери тест для задания'})
        if kind not in ('lesson', 'test'):
            raise serializers.ValidationError({'kind': 'kind должен быть lesson или test'})
        return attrs


class SubmissionSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.username', read_only=True, default='')
    assignment_title = serializers.CharField(source='assignment.title', read_only=True, default='')

    class Meta:
        model = Submission
        fields = ['id', 'assignment', 'student', 'student_name', 'assignment_title',
                  'status', 'score', 'attempt', 'created_at', 'updated_at']
        read_only_fields = ['id', 'student', 'status', 'score', 'attempt', 'created_at', 'updated_at']


class AnnouncementSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source='author.username', read_only=True, default='')

    class Meta:
        model = Announcement
        fields = ['id', 'classroom', 'author', 'author_name', 'text', 'created_at']
        read_only_fields = ['id', 'author', 'created_at']
