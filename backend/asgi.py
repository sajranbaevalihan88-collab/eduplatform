import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator
from django.urls import path

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

django_asgi = get_asgi_application()

# импорт после get_asgi_application(): middleware обращается к моделям
from apps.accounts.ws_auth import JWTQueryAuthMiddleware  # noqa: E402


def _ws_patterns():
    from apps.code.consumers import RunConsumer
    return [path('ws/run/', RunConsumer.as_asgi())]


application = ProtocolTypeRouter({
    'http': django_asgi,
    # Origin проверяется по ALLOWED_HOSTS (защита от Cross-Site WebSocket Hijacking),
    # пользователь — по JWT из ?token= (без входа запуск кода закрыт)
    'websocket': AllowedHostsOriginValidator(
        JWTQueryAuthMiddleware(URLRouter(_ws_patterns()))
    ),
})
