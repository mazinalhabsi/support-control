IT System Gateway - direct link http://SERVER/IT/ on port 80
=============================================================
Why: on this server Windows (Configuration Manager) holds port 80, so Apache
cannot use it. Windows shares port 80 between programs by path, and the path
/IT/ is free. This small service reserves /IT/ on port 80 and forwards every
request to Apache on port 8080. Configuration Manager keeps working normally.

Install:   copy this folder to the server, right-click install-gateway.bat,
           choose "Run as administrator".
Remove:    right-click uninstall-gateway.bat, "Run as administrator".
Log file:  C:\xampp\it-gateway\gateway.log
Service:   "IT System Gateway (port 80 /IT/)" in services.msc (starts automatically).
