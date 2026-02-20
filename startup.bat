@echo off
REM DineSmart Startup Script using Batch instead of PowerShell
REM This avoids encoding issues

echo Starting DineSmart...
echo.

REM Step 1: Create .env file
set "ROOT=%~dp0"
set "BACKEND=%ROOT%backend"
set "FRONTEND=%ROOT%frontend"

echo Creating backend .env file...
(
echo NODE_ENV=development
echo PORT=3000
echo DB_HOST=localhost
echo DB_PORT=5432
echo DB_USER=postgres
echo DB_PASSWORD=123456
echo DB_NAME=dinesmart
echo JWT_SECRET=some-secret-key-change-in-production
) > "%BACKEND%\.env"
echo .env file created
echo.

REM Step 2: Install backend dependencies
echo Installing backend dependencies...
cd /d "%BACKEND%"
call npm install
echo.

REM Step 3: Install frontend dependencies
echo Installing frontend dependencies...
cd /d "%FRONTEND%"
call npm install
echo.

REM Step 4: Start backend server
echo Starting backend server...
start cmd /k "cd /d \"%BACKEND%\" && npm start"
timeout /t 3 /nobreak
echo.

REM Step 5: Start frontend server
echo Starting frontend server...
start cmd /k "cd /d \"%FRONTEND%\" && npm run dev"
timeout /t 3 /nobreak
echo.

REM Step 6: Open browser
echo Opening browser...
timeout /t 2 /nobreak
start http://localhost:5173
echo.

echo ================================
echo DineSmart is starting!
echo ================================
echo.
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:3000/api
echo Database: postgresql://postgres@localhost:5432/dinesmart
echo.
echo Close this window when done, or press Ctrl+C to stop.
echo.
