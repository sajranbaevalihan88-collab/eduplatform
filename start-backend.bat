@echo off
title EduPlatform backend (daphne :8001)
cd /d %~dp0

set "DEBUG=True"
set "DJANGO_SECRET_KEY=dev-secret-key-change-in-production-edu-platform-2026"
rem Load .env (do not override already-set variables)
if exist .env (
  for /f "usebackq eol=# tokens=1,* delims==" %%a in (".env") do if not defined %%a set "%%a=%%b"
)

rem Free port 8001 from a previous frontend/backend
for /f "tokens=5" %%p in ('netstat -aon ^| findstr :8001 ^| findstr LISTENING') do taskkill /F /PID %%p >nul 2>&1

where python >nul 2>&1
if errorlevel 1 (
  echo ERROR: python not found in PATH. Install Python 3.12 ^(winget install Python.Python.3.12^), reopen this file.
  pause
  exit /b 1
)

echo Migrating database...
python manage.py migrate --noinput
if errorlevel 1 (
  echo ERROR: migrate failed. If there is no PostgreSQL locally, add USE_SQLITE=1 to .env, then rerun.
  pause
  exit /b 1
)

echo Backend: http://127.0.0.1:8001/api/health/
echo (this window must stay open; Ctrl+C to stop)

python -c "import daphne" >nul 2>&1
if errorlevel 1 (
  rem daphne is missing - fall back to runserver (live websocket editor launch will not be available)
  python manage.py runserver 127.0.0.1:8001 --noreload
) else (
  python -m daphne -b 127.0.0.1 -p 8001 backend.asgi:application
)

pause
