@echo off
title EduPlatform frontend (vite :5173)
cd /d %~dp0frontend

rem Free port 5173 from a previous dev server
for /f "tokens=5" %%p in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do taskkill /F /PID %%p >nul 2>&1

where npm >nul 2>&1
if errorlevel 1 (
  echo ERROR: npm not found in PATH. Install Node.js 20+ ^(winget install OpenJS.NodeJS.LTS^), reopen this file.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing dependencies...
  npm install
  if errorlevel 1 (
    echo ERROR: npm install failed.
    pause
    exit /b 1
  )
)

rem The frontend dev server proxies /api to :8001 - warn if backend is not running
netstat -aon | findstr :8001 | findstr LISTENING >nul 2>&1
if errorlevel 1 (
  echo WARNING: backend is not on :8001. Run start-backend.bat in another window first
  echo          (login and code running will not work without it).
)

echo Frontend: http://localhost:5173/
echo (this window must stay open; Ctrl+C to stop)
npm run dev

pause
