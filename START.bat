@echo off
echo.
echo  ==========================================
echo   ATS Dashboard v2.6 — Admin Truck Solutions
echo  ==========================================
echo.

:: Kill any existing node processes first
taskkill /F /IM node.exe /T >nul 2>&1
timeout /t 1 /nobreak >nul

:: Check if node_modules exists, if not run npm install
if not exist "node_modules\" (
    echo  Installing dependencies for the first time...
    echo  This will take about 30 seconds.
    echo.
    npm install
    echo.
)

echo  Starting ATS Dashboard v2.6...
echo.
echo  Once started, open your browser and go to:
echo  http://localhost:3001
echo.
echo  Press Ctrl+C to stop the server.
echo.

node api/server.js

pause
