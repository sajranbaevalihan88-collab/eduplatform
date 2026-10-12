from rest_framework import viewsets, permissions, throttling
from .models import Note
from .serializers import NoteSerializer


class NoteViewSet(viewsets.ModelViewSet):
    queryset = Note.objects.all().order_by('-updated_at')
    serializer_class = NoteSerializer
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [throttling.UserRateThrottle, throttling.AnonRateThrottle]

    def get_queryset(self):
        qs = super().get_queryset()
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
        title = (serializer.validated_data.get('title') or 'Заметка')[:200]
        text = serializer.validated_data.get('text') or ''
        # режем гигантские заметки чтобы не роняли демо на стенде
        if len(text) > 20000:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Заметка слишком большая (макс 20000 символов)")
        timer_sec = serializer.validated_data.get('timer_sec') or 0
        try:
            timer_sec = int(timer_sec)
        except Exception:
            timer_sec = 0
        timer_sec = max(0, min(24 * 3600, timer_sec))
        serializer.save(
            owner=self.request.user if self.request.user.is_authenticated else None,
            title=title, timer_sec=timer_sec,
        )

    def perform_update(self, serializer):
        obj = self.get_object()
        is_admin = self.request.user.is_staff or getattr(self.request.user, 'role', None) == 'admin'
        if obj.owner_id is None:
            if not is_admin:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Только владелец")
        elif obj.owner_id != self.request.user.id and not is_admin:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Только владелец")
        serializer.save()

    def perform_destroy(self, instance):
        is_admin = self.request.user.is_staff or getattr(self.request.user, 'role', None) == 'admin'
        if instance.owner_id is None:
            if not is_admin:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Только владелец")
        elif instance.owner_id != self.request.user.id and not is_admin:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Только владелец")
        instance.delete()
