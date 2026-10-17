from rest_framework import viewsets, permissions, throttling
from apps.accounts.permissions import TeacherWriteMixin
from .models import Board
from .serializers import BoardSerializer

MAX_BOARD_JSON = 4000000
MAX_LEGACY_IMAGE = 800000

def validate_board_data(data):
    """валидация содержимого доски: размер и запрещённые payload'ы (XSS)"""
    import json as _json
    if data is None:
        return
    try:
        blob = _json.dumps(data, ensure_ascii=False)
    except Exception:
        from rest_framework.exceptions import ValidationError
        raise ValidationError("Данные доски некорректны")
    if len(blob) > MAX_BOARD_JSON:
        from rest_framework.exceptions import ValidationError
        raise ValidationError("Доска слишком большая (макс 4MB)")
    low = blob.lower()
    if 'data:image/svg+xml' in low or '<script' in low:
        from rest_framework.exceptions import ValidationError
        raise ValidationError("SVG/script на доске запрещены из-за XSS")


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
            try:
                qs = qs.filter(lesson__id=int(lesson))
            except (TypeError, ValueError):
                from rest_framework.exceptions import ValidationError
                raise ValidationError({'lesson': 'Некорректный id урока'})
        return qs

    def perform_create(self, serializer):
        data = serializer.validated_data.get('data')
        validate_board_data(data)
        if isinstance(data, dict):
            img = data.get('image')
            if img and isinstance(img, str):
                if img.startswith('data:image/svg+xml'):
                    from rest_framework.exceptions import ValidationError
                    raise ValidationError("SVG доски запрещены из-за XSS")
                if len(img) > MAX_LEGACY_IMAGE:
                    from rest_framework.exceptions import ValidationError
                    raise ValidationError("Старое изображение доски слишком большое")
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
        validate_board_data(serializer.validated_data.get('data'))
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
