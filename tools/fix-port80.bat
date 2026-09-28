@echo off
title Fix port 80 for XAMPP Apache
:: must run as administrator
net session >nul 2>&1
if %errorlevel% neq 0 (
  echo.
  echo  Please right-click this file and choose "Run as administrator".
  echo.
  pause
  exit /b
)
echo.
echo  [1/4] Stopping Windows web service (IIS) that holds port 80 ...
net stop W3SVC /y >nul 2>&1
sc config W3SVC start= disabled >nul 2>&1
net stop WAS /y >nul 2>&1
sc config WAS start= disabled >nul 2>&1
timeout /t 3 /nobreak >nul

echo  [2/4] Checking port 80 ...
netstat -ano | findstr /r /c:"0\.0\.0\.0:80 .*LISTENING" >nul
if %errorlevel% equ 0 (
  echo.
  echo  Port 80 is STILL in use by another program.
  echo  Saving details to the Desktop: port80-report.txt
  netsh http show servicestate view=requestq > "%USERPROFILE%\Desktop\port80-report.txt"
  echo  Send a photo of that file, or use port 8080 instead.
  echo.
  pause
  exit /b
)
echo  Port 80 is free.

echo  [3/4] Starting Apache ...
net start Apache2.4 >nul 2>&1
if %errorlevel% neq 0 (
  echo  Apache service not found - start Apache from XAMPP Control Panel.
) else (
  echo  Apache started.
)

echo  [4/4] Test: open http://localhost/IT/api/api.php?a=ping
start "" "http://localhost/IT/api/api.php?a=ping"
echo.
echo  Done.
pause
