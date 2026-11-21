@echo off
setlocal
cd /d "%~dp0"

if not exist "dist\index.html" (
  echo.
  echo This folder has no built Press ^(dist\index.html missing^).
  echo.
  echo Users: download the Press release ZIP from
  echo   https://github.com/ihelpmaybe/hearts-archive/releases
  echo then unzip and double-click START.cmd again.
  echo.
  echo Developers: npm install ^&^& npm run build
  echo.
  pause
  exit /b 1
)

echo.
echo Heart's Archive — starting local Press ^(no Node^)…
echo.

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\serve-dist.ps1"
if errorlevel 1 pause
