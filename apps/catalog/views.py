from rest_framework import viewsets, permissions
from .models import Subject, Course
from .serializers import SubjectSerializer, CourseSerializer

from django.db.models import Count
from apps.accounts.permissions import AdminWriteMixin
class SubjectViewSet(AdminWriteMixin, viewsets.ModelViewSet):
    queryset = Subject.objects.prefetch_related('courses').annotate(courses_count=Count('courses')).all()
    serializer_class = SubjectSerializer
    lookup_field = 'slug'
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    # Для деплоя: предметов 6-20, не пагинируем — фронт всегда получает полный список без ?page
    pagination_class = None

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user if self.request.user.is_authenticated else None)

    def perform_update(self, serializer):
        obj = self.get_object()
        is_admin = self.request.user.is_staff or getattr(self.request.user,'role',None)=='admin'
        if obj.owner_id is None:
            if not is_admin:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Только админ может править общие предметы")
        elif obj.owner_id != self.request.user.id and not is_admin:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Только владелец")
        serializer.save()

    def perform_destroy(self, instance):
        is_admin = self.request.user.is_staff or getattr(self.request.user,'role',None)=='admin'
        if instance.owner_id is None:
            if not is_admin:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Только админ")
        elif instance.owner_id != self.request.user.id and not is_admin:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Только владелец")
        instance.delete()

class CourseViewSet(AdminWriteMixin, viewsets.ModelViewSet):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer
    permission_classes = [permissions.IsAuthenticatedOrReadOnly]
    
    def get_queryset(self):
        qs = super().get_queryset()
        subject = self.request.query_params.get('subject')
        if subject:
            qs = qs.filter(subject__slug=subject)
        return qs
