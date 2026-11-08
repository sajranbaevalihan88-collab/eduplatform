from rest_framework import generics, permissions, status, throttling
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate, get_user_model
from django.conf import settings
from .serializers import RegisterSerializer, UserSerializer, MeUpdateSerializer
from .permissions import IsAdmin
from .models import ParentLink

User = get_user_model()

# --- Брут-защита по аккаунту: N неудачных входов в окно → блок 15 мин (независимо от IP) ---
_LOGIN_MAX_FAILS = 10
_LOGIN_WINDOW = 15 * 60

def _lock_key(username: str) -> str:
    return 'loginfail:' + (username or '').strip().lower()

def _is_locked(username: str) -> bool:
    from django.core.cache import cache
    try:
        return cache.get(_lock_key(username), 0) >= _LOGIN_MAX_FAILS
    except Exception:
        return False

def _register_login_failure(username: str) -> None:
    from django.core.cache import cache
    try:
        k = _lock_key(username)
        cache.set(k, cache.get(k, 0) + 1, _LOGIN_WINDOW)
    except Exception:
        pass

def _clear_login_failures(username: str) -> None:
    from django.core.cache import cache
    try:
        cache.delete(_lock_key(username))
    except Exception:
        pass

_LOCKED_MSG = 'Слишком много неудачных попыток входа в этот аккаунт — подождите 15 минут'

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [throttling.AnonRateThrottle]
    throttle_scope = 'register'

class LoginThrottle(throttling.AnonRateThrottle):
    # rate НЕ задаём здесь — класс жёстко перебивал THROTTLE_RATES['login'];
    # лимит настраивается в settings (20/мин на IP: хватит классу за NAT, брут меньше)
    scope = 'login'

# Тот же лимит на стандартный jwt/create — иначе там обходной путь для brute force
from rest_framework_simplejwt.views import TokenObtainPairView
class ThrottledTokenObtainPairView(TokenObtainPairView):
    throttle_classes = [LoginThrottle]

    def post(self, request, *args, **kwargs):
        username = (request.data or {}).get('username') or ''
        if _is_locked(username):
            return Response({'detail': _LOCKED_MSG}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        resp = super().post(request, *args, **kwargs)
        if resp.status_code == 200:
            _clear_login_failures(username)
        else:
            _register_login_failure(username)
        return resp

class PasswordChangeThrottle(throttling.UserRateThrottle):
    scope = 'password_change'

class AnonRateThrottleBootstrap(throttling.AnonRateThrottle):
    scope = 'anon'

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@throttle_classes([LoginThrottle])
def login_view(request):
    username = request.data.get('username')
    password = request.data.get('password')
    if not username or not password:
        return Response({'error': 'Укажите username и password'}, status=status.HTTP_400_BAD_REQUEST)
    # простая защита от перебора: username длина
    if len(username) > 150 or len(password) > 128:
        return Response({'error': 'Неверные данные'}, status=status.HTTP_401_UNAUTHORIZED)
    if _is_locked(username):
        return Response({'error': _LOCKED_MSG}, status=status.HTTP_429_TOO_MANY_REQUESTS)
    user = authenticate(username=username, password=password)
    if user:
        _clear_login_failures(username)
        refresh = RefreshToken.for_user(user)
        return Response({'refresh': str(refresh), 'access': str(refresh.access_token), 'user': UserSerializer(user).data})
    _register_login_failure(username)
    return Response({'error': 'Неверные данные'}, status=status.HTTP_401_UNAUTHORIZED)

@api_view(['GET','PATCH'])
@permission_classes([permissions.IsAuthenticated])
def me_view(request):
    if request.method == 'GET':
        return Response(UserSerializer(request.user).data)
    # PATCH — только без role
    serializer = MeUpdateSerializer(request.user, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(UserSerializer(request.user).data)
    return Response(serializer.errors, status=400)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def logout_view(request):
    refresh_token = request.data.get('refresh')
    if not refresh_token:
        return Response({'error': 'No refresh token'}, status=400)
    try:
        token = RefreshToken(refresh_token)
        # нельзя ревокать ЧУЖОЙ refresh — только свой
        if str(token.payload.get('user_id')) != str(request.user.id):
            return Response({'error': 'Можно завершить только свою сессию'}, status=403)
        token.blacklist()
    except Exception:
        # невалидный/уже отозванный токен — выход идемпотентен
        pass
    return Response({'status': 'ok'})

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
@throttle_classes([PasswordChangeThrottle])
def change_password_view(request):
    """Смена своего пароля: {old_password, new_password}. Ревокает ВСЕ старые refresh-токены."""
    from django.contrib.auth.password_validation import validate_password
    from django.core.exceptions import ValidationError as _VE
    old = request.data.get('old_password') or ''
    new = request.data.get('new_password') or ''
    user = request.user
    if not user.check_password(old):
        return Response({'error': 'Текущий пароль неверный'}, status=status.HTTP_400_BAD_REQUEST)
    if old == new:
        return Response({'error': 'Новый пароль совпадает с текущим'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        validate_password(new, user=user)
    except _VE as e:
        return Response({'error': ' '.join(getattr(e, 'messages', [str(e)]))}, status=status.HTTP_400_BAD_REQUEST)
    user.set_password_with_stamp(new)
    user.save()
    # ревокация всех ранее выданных refresh: угнанная сессия умирает вместе со сменой пароля
    from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
    for t in OutstandingToken.objects.filter(user=user):
        BlacklistedToken.objects.get_or_create(token=t)
    # новая пара выдаётся ПОСЛЕ зачистки — иначе заблэклистилась бы сама
    refresh = RefreshToken.for_user(user)
    return Response({'status': 'ok', 'access': str(refresh.access_token), 'refresh': str(refresh)})

@api_view(['POST'])
@permission_classes([IsAdmin])
def create_assistant_view(request):
    """Админ создаёт аккаунты: role='teacher' (спец-акк учителя) или 'assistant' (помощник с правами админа).
    Заходят по логину и паролю на обычной странице входа — отдельного входа нет."""
    from django.contrib.auth.password_validation import validate_password
    from django.core.exceptions import ValidationError as _VE
    username = (request.data.get('username') or '').strip()
    password = request.data.get('password') or ''
    first_name = (request.data.get('first_name') or '').strip()
    kind = (request.data.get('role') or 'teacher').strip()
    if kind not in ('teacher', 'assistant'):
        return Response({'error': 'role должен быть teacher или assistant'}, status=status.HTTP_400_BAD_REQUEST)
    if len(username) < 3:
        return Response({'error': 'Ник минимум 3 символа'}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(username__iexact=username).exists():
        return Response({'error': 'Этот ник уже занят — придумай другой'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        validate_password(password)
    except _VE as e:
        return Response({'error': ' '.join(getattr(e, 'messages', [str(e)]))}, status=status.HTTP_400_BAD_REQUEST)
    role = 'admin' if kind == 'assistant' else 'teacher'
    u = User.objects.create_user(username=username, password=password, role=role, first_name=first_name)
    return Response({'status': 'ok', 'user': UserSerializer(u).data}, status=status.HTTP_201_CREATED)

@api_view(['POST'])
@permission_classes([permissions.AllowAny])
@throttle_classes([AnonRateThrottleBootstrap])
def bootstrap_admin_view(request):
    """Одноразовый bootstrap для прод-базы (где ещё нет ни одного админа).
    Активен ТОЛЬКО если в env задан BOOTSTRAP_ADMIN_KEY — без ключа отвечает 403.
    {key, username, password?}:
      username существует → повышает до admin+staff+superuser (пароль не трогаем, если не передан)
      username нет        → создаёт суперпользователя с переданным паролем (мин 8)
      username пуст       → {users:[...]} — список ников и ролей (чтобы найти свой аккаунт)"""
    from rest_framework import status as _st
    expected = getattr(settings, 'BOOTSTRAP_ADMIN_KEY', '')
    key = request.data.get('key') or ''
    if not expected or not key or key != expected:
        return Response({'error': 'bootstrap disabled'}, status=_st.HTTP_403_FORBIDDEN)
    username = (request.data.get('username') or '').strip()
    password = request.data.get('password') or ''
    if not username:
        return Response({'users': [{'username': u.username, 'role': u.role, 'staff': u.is_staff} for u in User.objects.all().order_by('id')]})
    if len(username) < 3:
        return Response({'error': 'username минимум 3 символа'}, status=_st.HTTP_400_BAD_REQUEST)
    u = User.objects.filter(username__iexact=username).first()
    if u:
        u.role = 'admin'
        u.is_staff = True
        u.is_superuser = True
        if password:
            u.set_password(password)
        u.save()
        action = 'promoted'
    else:
        if len(password) < 8:
            return Response({'error': 'Пароль минимум 8 символов (создаётся новый аккаунт)'}, status=_st.HTTP_400_BAD_REQUEST)
        u = User.objects.create_superuser(username=username, email='', password=password, role='admin')
        action = 'created'
    return Response({'status': 'ok', 'action': action, 'user': UserSerializer(u).data})

@api_view(['POST'])
@permission_classes([IsAdmin])
def set_user_password_view(request):
    """Админ задаёт новый пароль пользователю. Смотреть чужой пароль нельзя
    в принципе (хранится хешем) — можно только заменить."""
    from django.contrib.auth.password_validation import validate_password
    from django.core.exceptions import ValidationError as _VE
    username = (request.data.get('username') or '').strip()
    new = request.data.get('new_password') or ''
    u = User.objects.filter(username__iexact=username).first()
    if not u:
        return Response({'error': 'Пользователь с таким ником не найден'}, status=status.HTTP_404_NOT_FOUND)
    # сотрудники — только для суперпользователя (как при удалении)
    if (u.is_staff or u.role == 'admin' or u.is_superuser) and not request.user.is_superuser:
        return Response({'error': 'Пароль сотрудника может сменить только суперпользователь'}, status=status.HTTP_403_FORBIDDEN)
    try:
        validate_password(new, user=u)
    except _VE as e:
        return Response({'error': ' '.join(getattr(e, 'messages', [str(e)]))}, status=status.HTTP_400_BAD_REQUEST)
    u.set_password_with_stamp(new)
    u.save()
    # старые refresh-токены пользователя умирают — сессия на всех устройствах закрывается
    from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
    for t in OutstandingToken.objects.filter(user=u):
        BlacklistedToken.objects.get_or_create(token=t)
    return Response({'status': 'ok', 'username': u.username})

@api_view(['POST'])
@permission_classes([IsAdmin])
def delete_user_view(request):
    """Удаление аккаунта по нику (только админ). Нельзя удалить себя и суперпользователя."""
    username = (request.data.get('username') or '').strip()
    if not username:
        return Response({'error': 'Укажите ник'}, status=status.HTTP_400_BAD_REQUEST)
    if username.lower() == request.user.username.lower():
        return Response({'error': 'Нельзя удалить свой аккаунт'}, status=status.HTTP_400_BAD_REQUEST)
    u = User.objects.filter(username__iexact=username).first()
    if not u:
        return Response({'error': 'Пользователь с таким ником не найден'}, status=status.HTTP_404_NOT_FOUND)
    if u.is_superuser:
        return Response({'error': 'Нельзя удалить суперпользователя'}, status=status.HTTP_403_FORBIDDEN)
    # сотрудников (админов/стафф) может удалять только суперпользователь —
    # иначе помощник-админ смог бы удалить создавшего его администратора
    if (u.is_staff or getattr(u, 'role', None) == 'admin') and not request.user.is_superuser:
        return Response({'error': 'Сотрудников может удалить только суперпользователь'}, status=status.HTTP_403_FORBIDDEN)
    u.delete()
    return Response({'status': 'ok', 'deleted': username})

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def list_children_view(request):
    """Родитель: список его детей + краткая успеваемость (средний балл, классы).
    GET /api/auth/children/ -> [{id, username, first_name, classes:[{title,color,avg,graded,total}], avg, graded, total}]"""
    u = request.user
    if u.role != 'parent' and not ParentLink.objects.filter(parent=u).exists():
        return Response({'error': 'Только для родительского аккаунта'}, status=status.HTTP_403_FORBIDDEN)
    children = [l.student for l in ParentLink.objects.filter(parent=u).select_related('student').order_by('id')]
    from apps.classroom.models import Submission, Enrollment
    out = []
    for ch in children:
        subs = Submission.objects.filter(
            student=ch, status__in=['submitted', 'late'],
            assignment__kind__isnull=False,
        ).select_related('assignment__classroom')
        classes_meta = {}
        scores = []
        total = 0
        for s in subs:
            room = s.assignment.classroom
            if room.is_paid and room.owner_id != ch.id:
                e = Enrollment.objects.filter(classroom=room, student=ch).only('access_granted').first()
                if not e or not e.access_granted:
                    continue  # платный класс без доступа — прячем (согласовано с my_diary)
            total += 1
            c = classes_meta.setdefault(room.id, {'title': room.title, 'color': room.color, 'scores': [], 'total': 0})
            c['total'] += 1
            if s.score is not None:
                c['scores'].append(s.score)
                scores.append(s.score)
        classes = []
        for cid, c in classes_meta.items():
            classes.append({'classroom_id': cid, 'title': c['title'], 'color': c['color'],
                            'avg': round(sum(c['scores'])/len(c['scores']), 1) if c['scores'] else None,
                            'graded': len(c['scores']), 'total': c['total']})
        out.append({'id': ch.id, 'username': ch.username, 'first_name': ch.first_name or ch.username,
                    'total': total, 'graded': len(scores),
                    'avg': round(sum(scores)/len(scores), 1) if scores else None,
                    'classes': classes})
    return Response(out)

@api_view(['GET'])
@permission_classes([IsAdmin])
def parents_list_view(request):
    """Админ: все родители + их дети. GET /api/auth/parents/ -> [{id, username, first_name, children:[{id, username}]}]"""
    rows = []
    links = {}
    for l in ParentLink.objects.select_related('parent', 'student').order_by('id'):
        links.setdefault(l.parent_id, []).append({'id': l.student_id, 'username': l.student.username})
    for p in User.objects.filter(role='parent').order_by('id'):
        rows.append({'id': p.id, 'username': p.username, 'first_name': p.first_name,
                     'date_joined': p.date_joined, 'children': links.get(p.id, [])})
    return Response(rows)

@api_view(['POST'])
@permission_classes([IsAdmin])
def parents_create_view(request):
    """Админ создаёт родительский аккаунт: роль жёстко 'parent', ники уникальны."""
    from django.contrib.auth.password_validation import validate_password
    from django.core.exceptions import ValidationError as _VE
    username = (request.data.get('username') or '').strip()
    password = request.data.get('password') or ''
    first_name = (request.data.get('first_name') or '').strip()
    if len(username) < 3:
        return Response({'error': 'Ник минимум 3 символа'}, status=status.HTTP_400_BAD_REQUEST)
    if User.objects.filter(username__iexact=username).exists():
        return Response({'error': 'Этот ник уже занят — придумай другой'}, status=status.HTTP_400_BAD_REQUEST)
    try:
        validate_password(password)
    except _VE as e:
        return Response({'error': ' '.join(getattr(e, 'messages', [str(e)]))}, status=status.HTTP_400_BAD_REQUEST)
    u = User.objects.create_user(username=username, password=password, role='parent', first_name=first_name)
    return Response({'status': 'ok', 'user': {'id': u.id, 'username': u.username, 'role': 'parent'}}, status=status.HTTP_201_CREATED)

@api_view(['POST'])
@permission_classes([IsAdmin])
def parents_link_view(request):
    """Админ привязывает/отвязывает ребёнка к родителю.
    {parent_username, student_username, action: 'link'|'unlink'}"""
    action = (request.data.get('action') or 'link').strip()
    parent_un = (request.data.get('parent_username') or '').strip()
    student_un = (request.data.get('student_username') or '').strip()
    parent = User.objects.filter(username__iexact=parent_un).first()
    if not parent or parent.role != 'parent':
        return Response({'error': 'Родитель с таким ником не найден'}, status=status.HTTP_404_NOT_FOUND)
    student = User.objects.filter(username__iexact=student_un).first()
    if not student or student.role != 'student':
        return Response({'error': 'Ученик с таким ником не найден (привязать можно только аккаунт ученика)'}, status=status.HTTP_404_NOT_FOUND)
    if action == 'unlink':
        deleted, _ = ParentLink.objects.filter(parent=parent, student=student).delete()
        if not deleted:
            return Response({'error': 'Эта связка и так не существует'}, status=status.HTTP_400_BAD_REQUEST)
        return Response({'status': 'ok', 'action': 'unlinked'})
    link, created = ParentLink.objects.get_or_create(parent=parent, student=student)
    return Response({'status': 'ok', 'action': 'linked' if created else 'already', 'link_id': link.id})

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def list_users(request):
    # только для аутентифицированных, скрываем email
    if not request.user.is_authenticated:
        return Response({'error': 'Not authenticated'}, status=401)
    # не-админ видит только себя, админ — весь список (+поиск по нику ?q=)
    if request.user.role != 'admin' and not request.user.is_staff:
        return Response(UserSerializer([request.user], many=True).data)
    users = User.objects.all().order_by('id')
    q = (request.query_params.get('q') or '').strip()
    if q:
        users = users.filter(username__icontains=q)
    data = [{'id': u.id, 'username': u.username, 'role': u.role,
             'is_staff': u.is_staff, 'is_superuser': u.is_superuser,
             'date_joined': u.date_joined} for u in users]
    return Response(data)
    # скрываем email для списка
    data = [{'id': u.id, 'username': u.username, 'role': u.role} for u in users]
    return Response(data)
