import os
from pathlib import Path
import dj_database_url
# Для MariaDB (MySQL) как настоящей БД
try:
    import pymysql
    pymysql.install_as_MySQLdb()
except ImportError:
    pass

BASE_DIR = Path(__file__).resolve().parent.parent

# --- Security: SECRET_KEY без fallback в проде ---
_default_secret = 'dev-secret-key-change-in-production-edu-platform-2026'
SECRET_KEY = os.environ.get('DJANGO_SECRET_KEY', _default_secret)
if not os.environ.get('DJANGO_SECRET_KEY') and os.environ.get('DEBUG', 'False') == 'False':
    # В проде ключ обязателен
    raise ValueError("DJANGO_SECRET_KEY must be set in production")

DEBUG = os.environ.get('DEBUG', 'False') == 'True'

# --- ALLOWED_HOSTS без wildcard ---
_allowed_default = 'localhost,127.0.0.1,.onrender.com,testserver'
ALLOWED_HOSTS = [h.strip() for h in os.environ.get('ALLOWED_HOSTS', _allowed_default).split(',') if h.strip()]
# никогда не добавлять '*' автоматически
if DEBUG and 'testserver' not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append('testserver')

INSTALLED_APPS = [
    'daphne',  # первым: WebSocket live-запуск кода (ws/run) для редактора
    'channels',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'django.contrib.postgres',  # для SearchVector, Trigram, JSONB
    'rest_framework',
    'rest_framework_simplejwt.token_blacklist',
    'corsheaders',
    'django_filters',
    'apps.accounts',
    'apps.catalog',
    'apps.content',
    'apps.assessments',
    'apps.lessons',
    'apps.code',
    'apps.board',
    'apps.classroom',
    'apps.notes',
    'apps.word',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'backend.wsgi.application'
ASGI_APPLICATION = 'backend.asgi.application'

# Database — ТОПОВАЯ СВЯЗКА: PostgreSQL 16 + Redis + pgvector
# Приоритет: 1) DATABASE_URL (Render/Supabase/Neon Postgres — топ), 2) Локальная PostgreSQL 16 (топ), 3) MariaDB fallback, 4) SQLite только USE_SQLITE=1
# Топ-фичи: JSONB для blocks/slides, SearchVector для поиска, Trigram, HStore, pgvector для AI
DATABASE_URL = os.environ.get('DATABASE_URL')
USE_SQLITE = os.environ.get('USE_SQLITE', '0') == '1'
USE_MARIADB = os.environ.get('USE_MARIADB', '0') == '1'

if DATABASE_URL:
    # Топ: Render/Supabase/Neon Postgres 16 + pgvector + PostGIS
    DATABASES = {'default': dj_database_url.parse(DATABASE_URL, conn_max_age=600, ssl_require=True, conn_health_checks=True)}
    DATABASES['default']['ATOMIC_REQUESTS'] = True
    DATABASES['default']['CONN_MAX_AGE'] = 600
elif USE_SQLITE:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }
elif USE_MARIADB:
    # Fallback MariaDB (реальный сервер, не файл) — если Postgres нет
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.mysql',
            'NAME': os.environ.get('MARIADB_DB', 'eduplatform'),
            'USER': os.environ.get('MARIADB_USER', 'edu'),
            'PASSWORD': os.environ.get('MARIADB_PASSWORD', 'edu_password_change_me'),
            'HOST': os.environ.get('MARIADB_HOST', '127.0.0.1'),
            'PORT': os.environ.get('MARIADB_PORT', '3306'),
            'OPTIONS': {'charset': 'utf8mb4', 'init_command': "SET NAMES 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'", 'use_unicode': True},
            'CONN_MAX_AGE': 600,
        }
    }
else:
    # Топ по умолчанию: PostgreSQL 16 локально (через Docker или winget)
    # Если Postgres не запущен — автоматически попробует MariaDB, затем покажет ошибку с инструкцией
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.postgresql',
            'NAME': os.environ.get('POSTGRES_DB', 'eduplatform'),
            'USER': os.environ.get('POSTGRES_USER', 'edu'),
            'PASSWORD': os.environ.get('POSTGRES_PASSWORD', 'edu_password_change_me'),
            'HOST': os.environ.get('POSTGRES_HOST', '127.0.0.1'),
            'PORT': os.environ.get('POSTGRES_PORT', '5432'),
            'CONN_MAX_AGE': 600,
            'CONN_HEALTH_CHECKS': True,
            'OPTIONS': {
                'connect_timeout': 5,
            },
        }
    }

# Fallback на MariaDB если Postgres недоступен локально (без Docker)
if not DATABASE_URL and not USE_SQLITE and not USE_MARIADB:
    # проверяем доступность Postgres
    import socket
    def _is_port_open(host, port):
        try:
            with socket.create_connection((host, int(port)), timeout=1):
                return True
        except:
            return False
    pg_host = os.environ.get('POSTGRES_HOST', '127.0.0.1')
    pg_port = os.environ.get('POSTGRES_PORT', '5432')
    if not _is_port_open(pg_host, pg_port):
        # Postgres нет — используем реальный MariaDB как fallback (тоже не файл)
        DATABASES = {
            'default': {
                'ENGINE': 'django.db.backends.mysql',
                'NAME': os.environ.get('MARIADB_DB', 'eduplatform'),
                'USER': os.environ.get('MARIADB_USER', 'edu'),
                'PASSWORD': os.environ.get('MARIADB_PASSWORD', 'edu_password_change_me'),
                'HOST': os.environ.get('MARIADB_HOST', '127.0.0.1'),
                'PORT': os.environ.get('MARIADB_PORT', '3306'),
                'OPTIONS': {'charset': 'utf8mb4', 'init_command': "SET NAMES 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'", 'use_unicode': True},
                'CONN_MAX_AGE': 600,
            }
        }

# Крутилки нагрузки через env (для замеров и продакшена).
# PG_CONN_MAX_AGE=0 — закрывать коннект после каждого запроса: при сотнях
# потоков не упираемся в max_connections Postgres (см. нагрузочные тесты).
DATABASES['default']['CONN_MAX_AGE'] = int(os.environ.get(
    'PG_CONN_MAX_AGE', DATABASES['default'].get('CONN_MAX_AGE', 600) or 600))

# Cache — Redis для топа (если REDIS_URL задан и Redis доступен), иначе LocMem
REDIS_URL = os.environ.get('REDIS_URL')
if REDIS_URL:
    try:
        import django_redis  # noqa
        # пробуем подключиться, если нет — fallback
        import socket
        from urllib.parse import urlparse
        _parsed = urlparse(REDIS_URL)
        _host = _parsed.hostname or '127.0.0.1'
        _port = _parsed.port or 6379
        _can_connect = False
        try:
            with socket.create_connection((_host, int(_port)), timeout=1):
                _can_connect = True
        except:
            _can_connect = False
        if _can_connect:
            CACHES = {
                'default': {
                    'BACKEND': 'django_redis.cache.RedisCache',
                    'LOCATION': REDIS_URL,
                    'OPTIONS': {
                        'CLIENT_CLASS': 'django_redis.client.DefaultClient',
                        'CONNECTION_POOL_KWARGS': {'max_connections': 50, 'retry_on_timeout': True},
                        'SOCKET_CONNECT_TIMEOUT': 2,
                        'SOCKET_TIMEOUT': 2,
                    },
                    'KEY_PREFIX': 'edu',
                }
            }
            SESSION_ENGINE = 'django.contrib.sessions.backends.cache'
            SESSION_CACHE_ALIAS = 'default'
        else:
            raise ImportError("Redis not reachable")
    except ImportError:
        CACHES = {
            'default': {
                'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
                'LOCATION': 'edu-local',
            }
        }
else:
    CACHES = {
        'default': {
            'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
            'LOCATION': 'edu-local',
        }
    }

# Channels — Redis только если REDIS_URL задан
if REDIS_URL:
    try:
        import channels_redis  # noqa
        CHANNEL_LAYERS = {
            'default': {
                'BACKEND': 'channels_redis.core.RedisChannelLayer',
                'CONFIG': {'hosts': [REDIS_URL]},
            }
        }
    except ImportError:
        CHANNEL_LAYERS = {
            'default': {'BACKEND': 'channels.layers.InMemoryChannelLayer'}
        }
else:
    CHANNEL_LAYERS = {
        'default': {'BACKEND': 'channels.layers.InMemoryChannelLayer'}
    }

# Топ-фичи Postgres
# - JSONB уже используется для blocks/slides
# - Для поиска: SearchVector, TrigramSimilarity
# - Для AI: pgvector (расширение, ставится миграцией)
# - Для реплик: DATABASES['replica'] можно добавить
POSTGRES_EXTENSIONS = ['pg_trgm', 'btree_gin', 'vector']  # ставятся через CREATE EXTENSION

AUTH_USER_MODEL = 'accounts.User'

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 8}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'ru-ru'
TIME_ZONE = 'Europe/Moscow'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticatedOrReadOnly',
    ],
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        # класс 30+ человек жмёт одновременно (игры, тесты) — 120/мин душили даже 10 потоков
        'anon': os.environ.get('THROTTLE_ANON', '60/minute'),
        'user': os.environ.get('THROTTLE_USER', '600/minute'),
        'login': '10/minute',
        'register': '10/minute',
    },
}

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': __import__('datetime').timedelta(minutes=30),
    'REFRESH_TOKEN_LIFETIME': __import__('datetime').timedelta(days=7),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# CORS — для прода укажи VITE_API_URL origin через env CORS_ALLOWED_ORIGINS (через запятую).
# По умолчанию разрешаем localhost для дев + любой https-origin не блокируем жёстко на уровне кода —
# продовая проверка всё равно через ALLOWED_HOSTS / JWT. Для Render/Вашего домена добавь env:
# CORS_ALLOWED_ORIGINS=https://your-frontend.onrender.com,https://your-api.onrender.com
CORS_ALLOW_ALL_ORIGINS = False
_default_cors = 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173,http://localhost:3000'
CORS_ALLOWED_ORIGINS = [o.strip() for o in os.environ.get('CORS_ALLOWED_ORIGINS', _default_cors).split(',') if o.strip()]
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_HEADERS = [
    'authorization',
    'content-type',
    'x-csrftoken',
    'x-requested-with',
]

# Security headers
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = 'DENY'
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
SESSION_COOKIE_HTTPONLY = True
CSRF_COOKIE_HTTPONLY = False
SECURE_HSTS_SECONDS = 31536000 if not DEBUG else 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = not DEBUG
SECURE_HSTS_PRELOAD = not DEBUG

# File upload limits — 100MB для презентаций
FILE_UPLOAD_MAX_MEMORY_SIZE = 100 * 1024 * 1024
DATA_UPLOAD_MAX_MEMORY_SIZE = 100 * 1024 * 1024
# Allowed extensions
ALLOWED_UPLOAD_EXTENSIONS = ['.pptx','.ppt','.docx','.doc','.pdf','.png','.jpg','.jpeg','.gif','.webp']
ALLOWED_UPLOAD_MIMES = ['application/vnd.openxmlformats-officedocument.presentationml.presentation','application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/msword','application/pdf','image/png','image/jpeg','image/gif','image/webp']

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {'console': {'class': 'logging.StreamHandler'}},
    'root': {'handlers': ['console'], 'level': 'INFO'},
}

# Piston / Judge0 — внешний раннер для C/C++/Go/Rust и т.д.
# Для прод — поднимите свой инстанс: docker run -p 2000:2000 ghcr.io/engineer-man/piston
PISTON_URL = os.environ.get('PISTON_URL', 'https://emkc.org/api/v2/piston/execute')
PISTON_DAILY_LIMIT = int(os.environ.get('PISTON_DAILY_LIMIT', '500'))
PISTON_TIMEOUT = 6
# Для прод — полностью отключить локальный subprocess и гнать всё через Piston/Judge0 (изоляция из коробки)
# Включите в Render/Railway: CODE_USE_PISTON_ONLY=True
CODE_USE_PISTON_ONLY = os.environ.get('CODE_USE_PISTON_ONLY', 'False') == 'True'
# Для Docker-изоляции каждого прогона (будущее): CODE_USE_DOCKER=True + DOCKER_IMAGE=python:3.11-slim
CODE_USE_DOCKER = os.environ.get('CODE_USE_DOCKER', 'False') == 'True'

# Google Gemini — настоящая нейросеть для генерации вопросов (/api/tests/generate/).
# Ключ взять: https://aistudio.google.com/apikey (бесплатный тариф).
# Без ключа generate честно падает на офлайн-генератор и отвечает source='offline'.
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')
GEMINI_MODEL = os.environ.get('GEMINI_MODEL', 'gemini-2.5-flash')
