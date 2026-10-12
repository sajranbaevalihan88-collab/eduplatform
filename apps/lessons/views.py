from rest_framework import viewsets, permissions, throttling
from apps.accounts.permissions import TeacherWriteMixin
from django.db.models import Q
from .models import Lesson
from .serializers import LessonSerializer, LessonListSerializer

class LessonViewSet(TeacherWriteMixin, viewsets.ModelViewSet):
    queryset = Lesson.objects.select_related('subject','course','owner').all()
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    throttle_classes = [throttling.UserRateThrottle, throttling.AnonRateThrottle]

    def get_serializer_class(self):
        if self.action == 'list':
            return LessonListSerializer
        return LessonSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        from django.db.models import Q
        # гость: только опубликованные; зарегистрированный: + свои черновики
        if not user.is_authenticated:
            qs = qs.filter(is_published=True)
        elif not (user.is_staff or getattr(user, 'role', None) == 'admin'):
            qs = qs.filter(Q(owner=user) | Q(is_published=True))
        subject = self.request.query_params.get('subject')
        course = self.request.query_params.get('course')
        owner = self.request.query_params.get('owner')
        if subject:
            qs = qs.filter(subject__slug=subject)
        if course:
            qs = qs.filter(course__id=course)
        if owner == 'me' and user.is_authenticated:
            qs = qs.filter(owner=user)
        return qs

    def _link_lesson_content(self, lesson):
        # привязываем СВОИ презентации/тесты из блоков к уроку (чужое не трогаем,
        # уже привязанное к другому уроку не перепривязываем)
        try:
            blocks = lesson.blocks or []
            pres_ids, test_ids = set(), set()
            for b in blocks:
                if not isinstance(b, dict):
                    continue
                data = b.get('data') or {}
                if b.get('type') == 'presentation' and data.get('presentation_id'):
                    try:
                        pres_ids.add(int(data['presentation_id']))
                    except (TypeError, ValueError):
                        pass
                if b.get('type') == 'test' and data.get('test_id'):
                    try:
                        test_ids.add(int(data['test_id']))
                    except (TypeError, ValueError):
                        pass
            if pres_ids:
                from apps.content.models import Presentation
                Presentation.objects.filter(
                    id__in=pres_ids, owner=lesson.owner, lesson__isnull=True
                ).update(lesson=lesson)
            if test_ids:
                from apps.assessments.models import Test
                Test.objects.filter(
                    id__in=test_ids, owner=lesson.owner, lesson__isnull=True
                ).update(lesson=lesson)
        except Exception:
            pass

    def perform_create(self, serializer):
        lesson = serializer.save(owner=self.request.user if self.request.user.is_authenticated else None)
        self._link_lesson_content(lesson)

    def perform_update(self, serializer):
        obj = self.get_object()
        is_admin = self.request.user.is_staff or getattr(self.request.user,'role',None)=='admin'
        if obj.owner_id is None:
            if not is_admin:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Только владелец")
        elif obj.owner_id != self.request.user.id and not is_admin:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Только владелец")
        lesson = serializer.save()
        self._link_lesson_content(lesson)

    def perform_destroy(self, instance):
        is_admin = self.request.user.is_staff or getattr(self.request.user,'role',None)=='admin'
        if instance.owner_id is None:
            if not is_admin:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Только владелец")
        elif instance.owner_id != self.request.user.id and not is_admin:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Только владелец")
        instance.delete()
