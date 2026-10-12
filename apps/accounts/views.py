from rest_framework import generics, permissions, status, throttling
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate, get_user_model
from .serializers import RegisterSerializer, UserSerializer, MeUpdateSerializer

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
    try:
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response({'error': 'No refresh token'}, status=400)
        token = RefreshToken(refresh_token)
        token.blacklist()
        return Response({'status': 'ok'})
    except Exception as e:
        return Response({'error': str(e)}, status=400)

@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def list_users(request):
    # только для аутентифицированных, скрываем email
    if not request.user.is_authenticated:
        return Response({'error': 'Not authenticated'}, status=401)
    # не-админ видит только себя, админ — до 20
    if request.user.role != 'admin' and not request.user.is_staff:
        return Response(UserSerializer([request.user], many=True).data)
    users = User.objects.all()[:20]
    # скрываем email для списка
    data = [{'id': u.id, 'username': u.username, 'role': u.role} for u in users]
    return Response(data)
