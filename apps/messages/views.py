from django.contrib.auth import get_user_model
from django.db import models
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import viewsets, permissions, status, throttling
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.generics import get_object_or_404
from rest_framework.response import Response

from .models import Message
from .serializers import MessageSerializer


def _allowed_partners(user):
    """С кем user может переписываться (см. правила в Message)."""
    U = get_user_model()
    role = getattr(user, 'role', '')
    me = models.Q(pk=user.pk)
    if user.is_staff or role == 'admin':
        return U.objects.filter(role__in=('teacher', 'parent', 'admin')).exclude(me).distinct()
    if role == 'teacher':
        from apps.classroom.models import Enrollment
        # родители учеников моих классов + админы
        stu_ids = (Enrollment.objects.filter(classroom__owner=user)
                   .exclude(access_granted=False).values('student_id'))
        parents = U.objects.filter(parent_links__student_id__in=models.Subquery(stu_ids))
        return (parents | U.objects.filter(role='admin')).exclude(me).distinct()
    if role == 'parent':
        from apps.classroom.models import Classroom
        # учителя классов моих детей + админы
        child_ids = user.parent_links.values('student_id')
        teachers = (U.objects.filter(owned_classrooms__enrollments__student_id__in=models.Subquery(child_ids))
                    .exclude(owned_classrooms__enrollments__access_granted=False))
        return (teachers | U.objects.filter(role='admin')).exclude(me).distinct()
    return U.objects.none()


def _check_peer(user, peer_id):
    """peer в списке разрешённых? Иначе 403 с понятной ошибкой."""
    if _allowed_partners(user).filter(pk=peer_id).exists():
        return None
    if getattr(user, 'role', '') == 'student':
        raise PermissionDenied('Сообщения доступны учителям, родителям и админу')
    raise PermissionDenied('Вы не можете переписываться с этим пользователем '
                           '(родитель ↔ учитель классов ребёнка / админ)')


class MessageViewSet(viewsets.ReadOnlyModelViewSet):
    """GET /messages/?with_user=<id> — переписка; POST /messages/ — отправить;
    /messages/threads/ — список диалогов; /messages/contacts/ — кому можно писать."""
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]
    throttle_classes = [throttling.UserRateThrottle, throttling.AnonRateThrottle]

    def get_queryset(self):
        u = self.request.user
        qs = Message.objects.filter(models.Q(sender=u) | models.Q(recipient=u))
        # не показываем сообщения, удалённые «у себя» текущим пользователем
        return (qs.exclude(models.Q(sender=u, del_for_sender=True) |
                           models.Q(recipient=u, del_for_recipient=True))
                .select_related('sender', 'recipient').order_by('created_at'))

    def list(self, request, *args, **kwargs):
        peer = (request.query_params.get('with_user') or '').strip()
        if not peer or not peer.isdigit():
            raise ValidationError({'with_user': 'Укажите ?with_user=<id>'})
        peer_id = int(peer)
        _check_peer(request.user, peer_id)
        qs = self.get_queryset().filter(
            models.Q(sender_id=peer_id) | models.Q(recipient_id=peer_id))[:500]
        data = self.get_serializer(qs, many=True).data
        # открыл чат — прочитано как в WhatsApp: доставлено + прочитано
        now = timezone.now()
        (Message.objects.filter(recipient=request.user, sender_id=peer_id, read_at__isnull=True)
         .update(read_at=now,
                 delivered_at=Coalesce(models.F('delivered_at'), models.Value(now))))
        return Response(data)

    def create(self, request, *args, **kwargs):
        peer = request.data.get('recipient')
        text = (request.data.get('text') or '').strip()
        if not peer or not str(peer).isdigit():
            return Response({'recipient': 'Укажите получателя'}, status=status.HTTP_400_BAD_REQUEST)
        if not text:
            return Response({'text': 'Пустое сообщение'}, status=status.HTTP_400_BAD_REQUEST)
        if len(text) > 3000:
            return Response({'text': 'Не длиннее 3000 символов'}, status=status.HTTP_400_BAD_REQUEST)
        _check_peer(request.user, int(peer))
        peer_user = get_user_model().objects.get(pk=int(peer))
        msg = Message.objects.create(sender=request.user, recipient=peer_user, text=text)
        return Response(self.get_serializer(msg).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'])
    def threads(self, request):
        """Диалоги текущего пользователя: партнёр, последнее сообщение, непрочитанные."""
        u = request.user
        # получатель увидел список диалогов → «доставлено» (read_at не трогаем)
        Message.objects.filter(recipient=u, delivered_at__isnull=True).update(
            delivered_at=timezone.now())
        msgs = list(self.get_queryset())  # объём сообщений учителя/родителя невелик — питон проще памяти БД
        conv = {}  # partner_id -> {'last': msg, 'unread': int}
        for m in msgs:
            partner_id = m.recipient_id if m.sender_id == u.id else m.sender_id
            rec = conv.setdefault(partner_id, {'last': m, 'unread': 0})
            if m.created_at > rec['last'].created_at:
                rec['last'] = m
            # удалённые у всех сообщения непрочитанными не считаем
            if m.recipient_id == u.id and m.read_at is None and not m.is_deleted:
                rec['unread'] += 1
        partners = get_user_model().objects.in_bulk([cid for cid in conv])
        data = []
        for pid, rec in conv.items():
            p = partners.get(pid)
            if not p:
                continue
            last = rec['last']
            data.append({'user': p.id, 'username': p.username, 'role': getattr(p, 'role', ''),
                         'last_text': '' if last.is_deleted else last.text[:200],
                         'last_at': last.created_at,
                         'unread': rec['unread']})
        data.sort(key=lambda r: r['last_at'] or r['last_at'], reverse=True)
        total_unread = sum(r['unread'] for r in data)
        return Response({'threads': data, 'unread_total': total_unread})

    def destroy(self, request, pk=None):
        """DELETE /messages/<pk>/[?for_all=1] — удалить у себя или у всех (только отправитель)."""
        u = request.user
        # 404, если не участник переписки (get_queryset не вернёт чужое)
        msg = get_object_or_404(Message, models.Q(sender=u) | models.Q(recipient=u), pk=pk)
        for_all = (request.query_params.get('for_all') or '').lower() in ('1', 'true')
        if for_all:
            if msg.sender_id != u.id:
                raise PermissionDenied('Удалить у всех может только отправитель')
            msg.is_deleted = True
            msg.text = ''
            msg.save(update_fields=['is_deleted', 'text'])
        else:  # «удалить у себя»
            field = 'del_for_sender' if msg.sender_id == u.id else 'del_for_recipient'
            setattr(msg, field, True)
            msg.save(update_fields=[field])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=['get'])
    def contacts(self, request):
        """Кому мне можно написать (для выбора получателя)."""
        qs = _allowed_partners(request.user).order_by('role', 'username')
        from apps.classroom.models import Enrollment
        data = []
        for p in qs:
            item = {'id': p.id, 'username': p.username, 'role': p.role,
                    'first_name': p.first_name or ''}
            if request.user.role == 'parent' and p.role == 'teacher':
                # какие из моих детей учатся у этого учителя
                item['via_children'] = [link.student.username
                                        for link in request.user.parent_links.select_related('student')
                                        if Enrollment.objects.filter(classroom__owner=p,
                                                                     student_id=link.student_id)
                                        .exclude(access_granted=False).exists()]
            data.append(item)
        return Response(data)
