@echo off
title EduPlatform frontend (vite :5173)
set "LOG=%~dp0frontend\devrun.log"
echo [bat start %DATE% %TIME%]>"%LOG%"
cd /d %~dp0frontend
echo [cwd %CD%]>>"%LOG%"

for /f "tokens=5" %%p in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do taskkill /F /PID %%p >nul 2>&1
echo [port cleared]>>"%LOG%"

where npm
echo [where-npm rc=%ERRORLEVEL%]>>"%LOG%"

if not exist node_modules (
  echo [npm install begins %DATE% %TIME%]>>"%LOG%"
  call npm install
  echo [npm install rc=%ERRORLEVEL%]>>"%LOG%"
)

netstat -aon | findstr :8001 | findstr LISTENING >nul 2>&1
if errorlevel 1 (
  echo WARNING: backend is not on :8001. Run start-backend.bat in another window first.
)

echo Frontend: http://localhost:5173/
echo [npm run dev begins %date% %time%]>>"%LOG%"
call npm run dev
echo [npm run dev exited rc=%ERRORLEVEL%]>>"%LOG%"

pause
