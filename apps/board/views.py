from rest_framework import viewsets, permissions, throttling
from apps.accounts.permissions import TeacherWriteMixin
from .models import Board
from .serializers import BoardSerializer

class BoardViewSet(TeacherWriteMixin, viewsets.ModelViewSet):
    queryset = Board.objects.all().order_by('-updated_at')
    serializer_class = BoardSerializer
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [throttling.UserRateThrottle, throttling.AnonRateThrottle]

    def get_queryset(self):
        qs = super().get_queryset()
        # личная доска — только свои
        user = self.request.user
        if user.is_staff or getattr(user, 'role', None) == 'admin':
            qs = qs
        else:
            qs = qs.filter(owner=user)
        lesson = self.request.query_params.get('lesson')
        if lesson:
            qs = qs.filter(lesson__id=lesson)
        return qs

    def perform_create(self, serializer):
        data = serializer.validated_data.get('data')
        # валидация доски: ограничиваем размер JSON и блокируем svg с js
        if data and isinstance(data, dict):
            img = data.get('image')
            if img and isinstance(img, str):
                if img.startswith('data:image/svg+xml'):
                    from rest_framework.exceptions import ValidationError
                    raise ValidationError("SVG доски запрещены из-за XSS")
                if len(img) > 800000:
                    from rest_framework.exceptions import ValidationError
                    raise ValidationError("Доска слишком большая (макс 800KB)")
                if not img.startswith('data:image/png'):
                    # разрешаем только png
                    pass
        serializer.save(owner=self.request.user if self.request.user.is_authenticated else None)

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
        serializer.save()

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
