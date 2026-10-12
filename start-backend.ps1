# Запуск бэкенда EduPlatform AI. Использование: powershell -ExecutionPolicy Bypass -File start-backend.ps1
# При первом запуске: powershell -ExecutionPolicy Bypass -File start-backend.ps1 -Fresh
param([switch]$Fresh)
$ErrorActionPreference = 'SilentlyContinue'
$env:DEBUG = "True"
$env:DJANGO_SECRET_KEY = "dev-secret-key-change-in-production-edu-platform-2026"
Remove-Item Env:\DATABASE_URL -ErrorAction SilentlyContinue
# Подхватываем секреты из .env (файл в gitignore — ключи не утекут в GitHub).
# Уже выставленные переменные окружения имеют приоритет над .env.
$dotenv = Join-Path $PSScriptRoot ".env"
if (Test-Path $dotenv) {
  Get-Content $dotenv | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
      $k, $v = $line.Split("=", 2)
      $k = $k.Trim(); $v = $v.Trim().Trim('"').Trim("'")
      if ($k -and -not (Test-Path "Env:\$k")) {
        Set-Item -Path "Env:\$k" -Value $v
      }
    }
  }
}
$env:POSTGRES_DB = "eduplatform"
$env:POSTGRES_USER = "edu"
$env:POSTGRES_PASSWORD = "edu_password_change_me"
$env:POSTGRES_HOST = "127.0.0.1"
$env:POSTGRES_PORT = "5432"
Set-Location $PSScriptRoot
if ($Fresh) {
  Get-Process python* | Stop-Process -Force
  Start-Sleep 2
}
# Боевое окружение с Django+channels+daphne
$PY312 = "C:\Users\acer-nitro-v1\AppData\Local\Programs\Python\Python312\python.exe"
if (Test-Path $PY312) { $PY = $PY312 } else { $PY = "python" }
& $PY manage.py migrate --noinput
# Daphne (ASGI): отдаёт и HTTP, и WebSocket ws/run для живого запуска кода.
# Если daphne нет — откат на runserver (тогда live-режим редактора сам упадёт на HTTP).
& $PY -c "import daphne" 2>$null
if ($LASTEXITCODE -eq 0) {
  Start-Process -FilePath $PY -ArgumentList "-m", "daphne", "-b", "127.0.0.1", "-p", "8001", "backend.asgi:application" -WindowStyle Hidden
} else {
  Start-Process -FilePath $PY -ArgumentList "manage.py", "runserver", "127.0.0.1:8001", "--noreload" -WindowStyle Hidden
}
Write-Output "Backend: http://127.0.0.1:8001/api/health/"
