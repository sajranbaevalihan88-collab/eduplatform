from rest_framework import serializers
from .models import Classroom, Enrollment, Assignment, Submission, Announcement, AnnouncementComment


class ClassroomSerializer(serializers.ModelSerializer):
    owner_name = serializers.CharField(source='owner.username', read_only=True, default='')
    subject_name = serializers.CharField(source='subject.name', read_only=True, default='')
    members_count = serializers.IntegerField(source='enrollments.count', read_only=True)
    assignments_count = serializers.IntegerField(source='assignments.count', read_only=True)
    my_status = serializers.SerializerMethodField()
    pending_count = serializers.SerializerMethodField()

    class Meta:
        model = Classroom
        fields = ['id', 'title', 'description', 'subject', 'subject_name', 'owner', 'owner_name',
                  'invite_code', 'code_fmt', 'color', 'created_at', 'members_count', 'assignments_count',
                  'is_paid', 'price', 'payment_details', 'payment_qr', 'my_status', 'pending_count']
        read_only_fields = ['id', 'owner', 'invite_code', 'created_at']

    def get_my_status(self, obj):
        """owner | active | pending | None — статус текущего пользователя в классе.
        pending = платный класс и оплата ещё не подтверждена владельцем."""
        u = self.context.get('request').user if self.context.get('request') else None
        if not u or not u.is_authenticated:
            return None
        if obj.owner_id == u.id:
            return 'owner'
        e = obj.enrollments.filter(student=u).first()
        if not e:
            return None
        if obj.is_paid and not e.access_granted:
            return 'pending'
        return 'active'

    def get_pending_count(self, obj):
        return obj.enrollments.filter(status='pending').count()


class EnrollmentSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.username', read_only=True, default='')
    # статус под платный класс адаптирован: не оплатил -> 'pending' независимо от legacy-поля
    status = serializers.SerializerMethodField()

    class Meta:
        model = Enrollment
        fields = ['id', 'classroom', 'student', 'student_name', 'status', 'access_granted',
                  'paid_requested_at', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_status(self, obj):
        if obj.classroom.is_paid and not obj.access_granted:
            return 'pending'
        return obj.status if obj.status == 'active' else 'active'


class AssignmentSerializer(serializers.ModelSerializer):
    title = serializers.CharField(read_only=True)
    object_id = serializers.SerializerMethodField()
    submitted_count = serializers.IntegerField(read_only=True, default=0)
    graded_count = serializers.IntegerField(read_only=True, default=0)

    class Meta:
        model = Assignment
        fields = ['id', 'classroom', 'kind', 'lesson', 'test', 'title', 'object_id', 'manual_title', 'url',
                  'instructions', 'deadline', 'max_score', 'created_at', 'submitted_count', 'graded_count']
        read_only_fields = ['id', 'created_at']

    def get_object_id(self, obj):
        if obj.kind == 'lesson' and obj.lesson_id:
            return obj.lesson_id
        if obj.kind == 'test' and obj.test_id:
            return obj.test_id
        return None

    def _field(self, attrs, name, default=''):
        """значение поля: из данных, иначе с существующего объекта (update), иначе default"""
        v = attrs.get(name)
        if v is None and self.instance is not None:
            v = getattr(self.instance, name, default)
        return v if v is not None else default

    def validate(self, attrs):
        kind = attrs.get('kind', getattr(self.instance, 'kind', None))
        if kind == 'manual':
            title = str(self._field(attrs, 'manual_title') or '').strip()
            if not title:
                raise serializers.ValidationError({'manual_title': 'Назови колонку журнала'})
            return attrs
        if kind == 'link':
            if not str(self._field(attrs, 'manual_title') or '').strip():
                attrs['manual_title'] = 'Видео/ссылка'
            if not str(self._field(attrs, 'url') or '').strip():
                raise serializers.ValidationError({'url': 'Вставь ссылку на видео или материал'})
            return attrs
        if kind == 'write':
            if not str(self._field(attrs, 'manual_title') or '').strip():
                raise serializers.ValidationError({'manual_title': 'Назови задание'})
            return attrs
        lesson = attrs.get('lesson') or (self.instance.lesson if self.instance else None)
        test = attrs.get('test') or (self.instance.test if self.instance else None)
        if kind == 'lesson' and not lesson:
            raise serializers.ValidationError({'lesson': 'Выбери урок для задания'})
        if kind == 'test' and not test:
            raise serializers.ValidationError({'test': 'Выбери тест для задания'})
        if kind not in ('lesson', 'test'):
            raise serializers.ValidationError({'kind': 'kind: lesson, test, manual, link или write'})
        return attrs


class SubmissionSerializer(serializers.ModelSerializer):
    student_name = serializers.CharField(source='student.username', read_only=True, default='')
    assignment_title = serializers.CharField(source='assignment.title', read_only=True, default='')

    class Meta:
        model = Submission
        fields = ['id', 'assignment', 'student', 'student_name', 'assignment_title',
                  'status', 'score', 'mark', 'answer', 'attempt', 'created_at', 'updated_at']
        read_only_fields = ['id', 'student', 'status', 'score', 'attempt', 'created_at', 'updated_at']


class AnnouncementSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source='author.username', read_only=True, default='')
    comments_count = serializers.IntegerField(source='comments.count', read_only=True)

    class Meta:
        model = Announcement
        fields = ['id', 'classroom', 'author', 'author_name', 'text', 'created_at', 'comments_count']
        read_only_fields = ['id', 'author', 'created_at']


class AnnouncementCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source='author.username', read_only=True, default='')

    class Meta:
        model = AnnouncementComment
        fields = ['id', 'announcement', 'author', 'author_name', 'text', 'created_at']
        read_only_fields = ['id', 'author', 'created_at']
