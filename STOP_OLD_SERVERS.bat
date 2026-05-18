@echo off
setlocal
color 0C
title Stop TeachMe AI Servers

echo Stopping TeachMe AI / Node servers on ports 7777-8060...

for %%P in (7777 7788 7799 7800 7810 7820 7830 7840 7850 7860 7870 7880 7890 7900 7910 7920 7930 7940 7950 7960 7970 7980 7990 8000 8010 8020 8030 8040 8050 8060) do (
  for /f "tokens=5" %%A in ('netstat -ano ^| findstr :%%P ^| findstr LISTENING') do (
    echo Stopping PID %%A on port %%P
    taskkill /PID %%A /F >nul 2>nul
  )
)

echo Done.
pause