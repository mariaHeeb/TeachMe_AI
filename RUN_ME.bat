@echo off
setlocal
cd /d "%~dp0"
title TeachMe AI Clean Pro Classroom
color 0A

echo =================================================
echo        TeachMe AI - CLEAN PRO CLASSROOM
echo =================================================
echo.
echo This version runs on: http://localhost:8060
echo.

where node >nul 2>nul
if errorlevel 1 (
  color 0C
  echo ERROR: Node.js was not found.
  echo Install Node.js, then run this file again.
  pause
  exit /b 1
)

echo [OK] Node.js found:
node --version
echo.

if not exist .gemini_key (
  echo Paste your Gemini API key below.
  echo Do NOT share the key in screenshots or chat.
  echo.
  set /p GEMINI_KEY=Gemini API Key: 
  if not "%GEMINI_KEY%"=="" (
    > .gemini_key echo %GEMINI_KEY%
    echo.
    echo [OK] Gemini key saved locally.
  ) else (
    color 0E
    echo.
    echo [WARNING] No Gemini key saved. The app will open, but AI replies will not work.
  )
)

echo.
echo Stopping old TeachMe AI servers...
for %%P in (7777 7788 7799 7800 7810 7820 7830 7840 7850 7860 7870 7880 7890 7900 7910 7920 7930 7940 7950 7960 7970 7980 7990 8000 8010 8020 8030 8040 8050 8060) do (
  for /f "tokens=5" %%A in ('netstat -ano ^| findstr :%%P ^| findstr LISTENING') do (
    taskkill /PID %%A /F >nul 2>nul
  )
)

echo.
echo Starting local server...
echo Keep this window open while using the app.
echo.
start "" "http://localhost:8060"
node server.js

echo.
echo Server stopped.
pause