@echo off
setlocal EnableDelayedExpansion
REM DineSmart Startup Script using Batch instead of PowerShell
REM This avoids encoding issues

echo Starting DineSmart...
echo.

set "REPO_ROOT=%~dp0"
set "BACKEND_PATH=%REPO_ROOT%backend"
set "FRONTEND_PATH=%REPO_ROOT%frontend"

REM Step 1: Create .env file when missing
if exist "%BACKEND_PATH%\.env" (
  echo backend\.env already exists; leaving it unchanged
) else (
echo Creating backend .env file...
for /f %%s in ('powershell -NoProfile -Command "[guid]::NewGuid().ToString('N') + [guid]::NewGuid().ToString('N')"') do set "JWT_SECRET=%%s"
(
echo NODE_ENV=development
echo PORT=3000
echo DB_HOST=localhost
echo DB_PORT=5432
echo DB_USER=postgres
echo DB_PASSWORD=
echo DB_NAME=dinesmart
echo JWT_SECRET=!JWT_SECRET!
echo FRONTEND_URL=http://localhost:5173
echo CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
) > "%BACKEND_PATH%\.env"
echo .env file created with a generated JWT secret
)
echo.

REM Step 2: Install backend dependencies
echo Installing backend dependencies...
cd /d "%BACKEND_PATH%"
call npm install
echo.

REM Step 3: Install frontend dependencies
echo Installing frontend dependencies...
cd /d "%FRONTEND_PATH%"
call npm install
echo.

REM Step 4: Start backend server
echo Starting backend server...
start "" cmd /k "cd /d ""%BACKEND_PATH%"" && npm start"
timeout /t 3 /nobreak
echo.

REM Step 5: Start frontend server
echo Starting frontend server...
start "" cmd /k "cd /d ""%FRONTEND_PATH%"" && npm run dev"
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
