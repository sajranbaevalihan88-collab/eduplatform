# Запуск фронта EduPlatform AI. Использование: powershell -ExecutionPolicy Bypass -File start-frontend.ps1
$ErrorActionPreference = 'SilentlyContinue'
Set-Location (Join-Path $PSScriptRoot 'frontend')
Get-Process node | Stop-Process -Force
Start-Process -FilePath "npm.cmd" -ArgumentList "run", "dev" -WindowStyle Hidden
Write-Output "Frontend: http://localhost:5173/ (только localhost, не 127.0.0.1)"
