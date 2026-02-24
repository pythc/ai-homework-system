@echo off
setlocal
cd /d "%~dp0..\.."
echo Checking port 3789...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /r /c:":3789 .*LISTENING"') do (
  echo Killing existing process on port 3789: PID=%%P
  taskkill /PID %%P /F >nul 2>nul
)
echo Starting Test Seed Workbench...
echo Open http://127.0.0.1:3789 in your browser.
node tools\test-seed-workbench\server.js
endlocal
