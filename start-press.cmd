@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo.
  echo No Node on this PC — that's OK for phone / quick use.
  echo Opening the web app ^(Add to Home Screen on mobile^).
  echo For a local Press install later: Node 20+ LTS, then re-run this file.
  echo.
  start "" "https://ihelpmaybe.github.io/hearts-archive/"
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo First run — installing dependencies ^(once^)…
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)

echo.
echo Heart's Archive Press — http://127.0.0.1:5177/
echo Leave this window open. Close it to stop.
echo.
start "" "http://127.0.0.1:5177/"
call npm run dev:press
pause
