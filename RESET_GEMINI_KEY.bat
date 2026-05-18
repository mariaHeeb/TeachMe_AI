@echo off
setlocal
cd /d "%~dp0"
title Reset Gemini API Key
color 0B

echo ======================================
echo       Reset Gemini API Key
echo ======================================
echo.
echo Paste your NEW Gemini API key here.
echo Do NOT share this key in screenshots or chat.
echo.

set /p GEMINI_KEY=Gemini API Key: 

if "%GEMINI_KEY%"=="" (
  color 0C
  echo No key entered. Nothing changed.
  pause
  exit /b 1
)

> .gemini_key echo %GEMINI_KEY%

echo.
echo [OK] Key saved locally in .gemini_key.
echo Now run RUN_ME.bat again.
pause