@echo off
echo Starting AirServe Customer Frontend...
echo.

cd /d "%~dp0"

echo Checking for Node.js...
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed or not in PATH
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo Node.js found!
echo.

if not exist "node_modules" (
    echo Installing dependencies...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo ERROR: Failed to install dependencies
        pause
        exit /b 1
    )
    echo.
)

echo Starting development server...
echo.
echo The website will be available at http://localhost:3000
echo Press Ctrl+C to stop the server
echo.

call npm run dev

pause
