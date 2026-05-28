@echo off
setlocal

set "ROOT=%~dp0"

echo Starting Pixora backend...
start "Pixora Backend" cmd /k "cd /d ""%ROOT%pixora-backend"" && npm run dev"

echo Starting Pixora frontend...
start "Pixora Frontend" cmd /k "cd /d ""%ROOT%pixora-frontend"" && npm run dev"

echo Both services are launching in separate windows.
exit /b 0
