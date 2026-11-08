from rest_framework import generics, permissions, status, throttling
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate, get_user_model
from django.conf import settings
from .serializers import RegisterSerializer, UserSerializer, MeUpdateSerializer
from .permissions import IsAdmin

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
