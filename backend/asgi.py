import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import OriginValidator
from django.conf import settings
from django.urls import path

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

django_asgi = get_asgi_application()

# импорт после get_asgi_application(): middleware обращается к моделям
from apps.accounts.ws_auth import JWTQueryAuthMiddleware  # noqa: E402


def _ws_patterns():
    from apps.code.consumers import RunConsumer
    from apps.assessments.live_quiz import LiveQuizConsumer
    return [
        path('ws/run/', RunConsumer.as_asgi()),
        path('ws/quiz/<str:pin>/', LiveQuizConsumer.as_asgi()),
    ]


def _allowed_ws_origins():
    """Явный список разрешённых Origin для WebSocket (без wildcard-субдоменов типа .onrender.com)."""
    origins = []
    for o in getattr(settings, 'CORS_ALLOWED_ORIGINS', []) or []:
        o = (o or '').strip().rstrip('/')
        if o and o != '*' and o not in origins:
            origins.append(o)
    for h in getattr(settings, 'ALLOWED_HOSTS', []) or []:
        h = (h or '').strip()
        if not h or h == '*' or h.startswith('.') or h == 'testserver':
            continue
        if h not in origins:
            origins.append(h)
    if getattr(settings, 'DEBUG', False):
        for dev_host in ('localhost', '127.0.0.1'):
            if dev_host not in origins:
                origins.append(dev_host)
    return origins or ['localhost', '127.0.0.1']


application = ProtocolTypeRouter({
    'http': django_asgi,
    # Origin проверяется по ALLOWED_HOSTS + CORS_ALLOWED_ORIGINS (защита от Cross-Site WebSocket Hijacking),
    # пользователь — по JWT из ?token= (без входа запуск кода закрыт)
    'websocket': OriginValidator(
        JWTQueryAuthMiddleware(URLRouter(_ws_patterns())),
        _allowed_ws_origins(),
    ),
})
