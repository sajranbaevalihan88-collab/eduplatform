"""JWT-аутентификация с проверкой «штампа» смены пароля.

Токены, выпущенные ДО последней смены пароля, отклоняются сразу —
украденный access умирает при смене пароля, а не через 30 минут TTL.
"""
from datetime import datetime, timezone as dt_tz

from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import AuthenticationFailed


class PasswordStampJWTAuthentication(JWTAuthentication):
    def get_user(self, validated_token):
        user = super().get_user(validated_token)
        stamp = getattr(user, 'password_changed_at', None)
        if stamp and user.is_authenticated:
            # iat в JWT — целые секунды; усекаем штамп до секунды, иначе
            # токен, выданный на 50мс позже смены, отбраковывался бы микросекундами
            stamp = stamp.replace(microsecond=0)
            iat = validated_token.payload.get('iat')
            if iat is not None:
                try:
                    iat_dt = datetime.fromtimestamp(int(iat), tz=dt_tz.utc)
                except (ValueError, TypeError, OSError, OverflowError):
                    iat_dt = None
                if iat_dt and iat_dt < stamp:
                    raise AuthenticationFailed(
                        'Пароль изменён — войдите заново со своим новым паролем',
                        code='password_changed',
                    )
        return user
