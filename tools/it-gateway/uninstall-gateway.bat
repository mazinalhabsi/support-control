@echo off
setlocal EnableExtensions
title IT System - remove direct link gateway
net session >nul 2>&1
if errorlevel 1 (
  echo   Right-click this file and choose "Run as administrator". & pause & exit /b 1
)
set "XAMPP=C:\xampp"
if not exist "%XAMPP%\apache\conf\httpd.conf" set /p "XAMPP=  XAMPP folder (example D:\xampp): "

echo  Removing the ITGateway service ...
net stop ITGateway >nul 2>&1
sc delete ITGateway >nul 2>&1
netsh advfirewall firewall delete rule name="IT System HTTP 80" >nul 2>&1

if exist "%XAMPP%\apache\conf\httpd.conf.before-gateway" (
  choice /M "  Restore Apache to port 80 (old settings)"
  if not errorlevel 2 (
    copy /Y "%XAMPP%\apache\conf\httpd.conf.before-gateway" "%XAMPP%\apache\conf\httpd.conf" >nul
    powershell -NoProfile -Command "$f='%XAMPP%\xampp-control.ini'; if (Test-Path $f) { $t=[IO.File]::ReadAllText($f); [IO.File]::WriteAllText($f, ($t -replace '(?m)^Apache=8080\s*$','Apache=80')) }"
    echo  Apache settings restored. Restart Apache from XAMPP Control Panel.
  )
)
echo  Done.
pause
