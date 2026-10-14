FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-writer libreoffice-impress \
    libpq-dev gcc \
    nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN python manage.py collectstatic --noinput || true

EXPOSE 8000

# Миграции гоняем при старте контейнера (не на этапе build — DATABASE_URL
# там ещё недоступен). set -e гарантирует, что если migrate упадёт,
# сервер не запустится и ошибка будет видна в логах Render, а не скрыта.
# Daphne (а не gunicorn): отдаёт и HTTP, и WebSocket ws/run — живой
# интерактивный ввод в редакторе кода работает и на проде, как локально.
CMD set -e; \
    python manage.py migrate --noinput; \
    exec python -m daphne -b 0.0.0.0 -p $PORT backend.asgi:application
