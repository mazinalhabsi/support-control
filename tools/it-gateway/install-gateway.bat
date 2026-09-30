@echo off
setlocal EnableExtensions
title IT System - direct link http://SERVER/IT/
net session >nul 2>&1
if errorlevel 1 (
  echo.
  echo   Right-click this file and choose "Run as administrator".
  echo.
  pause
  exit /b 1
)

set "SRC=%~dp0"
set "XAMPP=C:\xampp"
if not exist "%XAMPP%\apache\conf\httpd.conf" set /p "XAMPP=  XAMPP folder (example D:\xampp): "
if not exist "%XAMPP%\apache\conf\httpd.conf" (
  echo   XAMPP was not found. & pause & exit /b 1
)
if not exist "%SRC%Gateway.cs" (
  echo   Gateway.cs and Service.cs must be in the same folder as this file. & pause & exit /b 1
)
set "DEST=%XAMPP%\it-gateway"
set "CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist "%CSC%" set "CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe"
if not exist "%CSC%" (
  echo   .NET Framework 4 compiler was not found on this computer. & pause & exit /b 1
)

echo.
echo  [1/5] Moving Apache to port 8080 (port 80 is shared by Windows) ...
powershell -NoProfile -Command "$f='%XAMPP%\apache\conf\httpd.conf'; $t=[IO.File]::ReadAllText($f); if ($t -match '(?m)^\s*Listen\s+80\s*$') { Copy-Item $f ($f + '.before-gateway') -Force; $t = $t -replace '(?m)^(\s*)Listen\s+80\s*$','${1}Listen 8080' -replace '(?m)^(\s*)ServerName\s+localhost:80\s*$','${1}ServerName localhost:8080'; [IO.File]::WriteAllText($f, $t); '        httpd.conf updated (backup: httpd.conf.before-gateway)' } else { '        Apache already uses another port - not changed' }"
powershell -NoProfile -Command "$f='%XAMPP%\xampp-control.ini'; if (Test-Path $f) { $t=[IO.File]::ReadAllText($f); if ($t -match '(?m)^Apache=80\s*$') { [IO.File]::WriteAllText($f, ($t -replace '(?m)^Apache=80\s*$','Apache=8080')); '        XAMPP Control Panel port set to 8080' } }"

echo  [2/5] Restarting Apache ...
sc query Apache2.4 >nul 2>&1
if errorlevel 1 (
  echo         Apache is not installed as a service: in XAMPP Control Panel press Stop then Start for Apache.
) else (
  net stop Apache2.4 >nul 2>&1
  net start Apache2.4 >nul 2>&1
  echo         Apache restarted on port 8080.
)

echo  [3/5] Building the gateway ...
if not exist "%DEST%" mkdir "%DEST%"
sc query ITGateway >nul 2>&1
if not errorlevel 1 net stop ITGateway >nul 2>&1
"%CSC%" /nologo /codepage:65001 /optimize /target:exe /out:"%DEST%\it-gateway.exe" /r:System.Net.Http.dll /r:System.ServiceProcess.dll "%SRC%Gateway.cs" "%SRC%Service.cs"
if errorlevel 1 (
  echo   Build failed - send a photo of this window. & pause & exit /b 1
)

echo  [4/5] Installing the Windows service "ITGateway" (starts automatically) ...
sc query ITGateway >nul 2>&1
if errorlevel 1 sc create ITGateway binPath= "\"%DEST%\it-gateway.exe\" --service" start= auto DisplayName= "IT System Gateway (port 80 /IT/)" >nul
sc description ITGateway "Direct link http://SERVER/IT/ for the IT system. Shares port 80 with Windows and forwards to Apache on port 8080." >nul
sc failure ITGateway reset= 86400 actions= restart/5000/restart/5000/restart/10000 >nul
net start ITGateway >nul 2>&1

echo  [5/5] Allowing port 80 in Windows Firewall ...
netsh advfirewall firewall delete rule name="IT System HTTP 80" >nul 2>&1
netsh advfirewall firewall add rule name="IT System HTTP 80" dir=in action=allow protocol=TCP localport=80 >nul

echo.
echo  Test:
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing 'http://localhost/IT/api/api.php?a=ping' -TimeoutSec 15; if ($r.Content -like '*ok*true*') { '   OK - the system answers on http://localhost/IT/' } else { '   Unexpected answer: ' + $r.Content.Substring(0, [Math]::Min(120, $r.Content.Length)) } } catch { '   FAILED: ' + $_.Exception.Message + '   (see ' + '%DEST%\gateway.log' + ')' }"
echo.
echo  Link for all devices:   http://%COMPUTERNAME%/IT/
echo.
start "" "http://localhost/IT/"
pause
