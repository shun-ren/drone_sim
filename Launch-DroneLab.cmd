@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install Node.js 22.13 or newer, then run this launcher again.
  pause
  exit /b 1
)
if not exist node_modules (
  call npm.cmd ci
  if errorlevel 1 exit /b 1
)
echo DroneLab will print its browser URL below. Keep this window open while flying.
call npm.cmd run dev
pause
