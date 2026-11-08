from rest_framework import generics, permissions, status, throttling
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate, get_user_model
from .serializers import RegisterSerializer, UserSerializer, MeUpdateSerializer
from .permissions import IsAdmin

User = get_user_model()

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]
    throttle_classes = [throttling.AnonRateThrottle]
    throttle_scope = 'register'

class LoginThrottle(throttling.AnonRateThrottle):
    scope = 'login'
    rate = '5/minute'

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
    user = authenticate(username=username, password=password)
    if user:
        refresh = RefreshToken.for_user(user)
        return Response({'refresh': str(refresh), 'access': str(refresh.access_token), 'user': UserSerializer(user).data})
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
    import logging as _lg
    try:
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response({'error': 'No refresh token'}, status=400)
        token = RefreshToken(refresh_token)
        token.blacklist()
        return Response({'status': 'ok'})
    except Exception:
        _lg.getLogger(__name__).exception("logout failed")
        return Response({'error': 'Не удалось выйти'}, status=400)

@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def change_password_view(request):
    """Смена своего пароля: {old_password, new_password}."""
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
    user.set_password(new)
    user.save()
    refresh = RefreshToken.for_user(user)
    return Response({'status': 'ok', 'access': str(refresh.access_token), 'refresh': str(refresh)})

@api_view(['POST'])
@permission_classes([IsAdmin])
def create_assistant_view(request):
    """Создание аккаунта помощника администратором (role=teacher).
    Помощник заходит по логину и паролю на обычной странице входа — отдельного входа нет."""
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
    u = User.objects.create_user(username=username, password=password, role='teacher', first_name=first_name)
    return Response({'status': 'ok', 'user': UserSerializer(u).data}, status=status.HTTP_201_CREATED)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def list_users(request):
    # только для аутентифицированных, скрываем email
    if not request.user.is_authenticated:
        return Response({'error': 'Not authenticated'}, status=401)
    # не-админ видит только себя, админ — до 20
    if request.user.role != 'admin' and not request.user.is_staff:
        return Response(UserSerializer([request.user], many=True).data)
    users = User.objects.all().order_by('id')[:20]
    # скрываем email для списка
    data = [{'id': u.id, 'username': u.username, 'role': u.role} for u in users]
    return Response(data)
