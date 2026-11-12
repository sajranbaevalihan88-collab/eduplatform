"""JWT-аутентификация для WebSocket (Channels).

Браузерный WebSocket не умеет слать заголовок Authorization, поэтому access-токен
передаётся в query-string: ws/run/?token=<access>. Проверка — та же, что у REST
(PasswordStampJWTAuthentication): подпись, срок жизни и «штамп» смены пароля.
"""
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser


@database_sync_to_async
def _user_from_token(raw_token: str):
    if not raw_token:
        return AnonymousUser()
    try:
        from .authentication import PasswordStampJWTAuthentication
        auth = PasswordStampJWTAuthentication()
        validated = auth.get_validated_token(raw_token)
        user = auth.get_user(validated)
        if user is None or not user.is_active:
            return AnonymousUser()
        return user
    except Exception:
        return AnonymousUser()


class JWTQueryAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        try:
            qs = parse_qs((scope.get('query_string') or b'').decode('utf-8', errors='ignore'))
            token = (qs.get('token') or [''])[0]
        except Exception:
            token = ''
        scope = dict(scope)
        scope['user'] = await _user_from_token(token)
        return await super().__call__(scope, receive, send)

