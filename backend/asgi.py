import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.auth import AuthMiddlewareStack
from django.urls import path

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

django_asgi = get_asgi_application()


def _ws_patterns():
    from apps.code.consumers import RunConsumer
    return [path('ws/run/', RunConsumer.as_asgi())]


application = ProtocolTypeRouter({
    'http': django_asgi,
    'websocket': AuthMiddlewareStack(URLRouter(_ws_patterns())),
})
