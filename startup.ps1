# DineSmart Complete Startup Script - Simplified Version
# This script sets up and starts both backend and frontend

Write-Host "DineSmart Startup Script" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

$repoRoot = $PSScriptRoot
$backendPath = Join-Path $repoRoot "backend"
$frontendPath = Join-Path $repoRoot "frontend"

# Step 1: Create backend .env file when missing
$envPath = Join-Path $backendPath ".env"
if (-not (Test-Path $envPath)) {
  Write-Host "Creating backend .env file..." -ForegroundColor Yellow
  [byte[]]$secretBytes = New-Object byte[] 32
  [System.Security.Cryptography.RandomNumberGenerator]::Fill($secretBytes)
  $jwtSecret = [Convert]::ToBase64String($secretBytes)
  $backendEnv = @"
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=
DB_NAME=dinesmart
JWT_SECRET=$jwtSecret
FRONTEND_URL=http://localhost:5173
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
"@
  Set-Content -Path $envPath -Value $backendEnv -NoNewline
  Write-Host ".env file created with a generated JWT secret" -ForegroundColor Green
} else {
  Write-Host "backend/.env already exists; leaving it unchanged" -ForegroundColor Green
}
Write-Host ""

# Step 2: Backend setup
Write-Host "Setting up backend..." -ForegroundColor Yellow
Push-Location $backendPath
Write-Host "Installing dependencies..." -ForegroundColor Gray
npm install --silent
Write-Host "Backend dependencies installed" -ForegroundColor Green
Write-Host ""

# Step 3: Frontend setup
Write-Host "Setting up frontend..." -ForegroundColor Yellow
Push-Location $frontendPath
Write-Host "Installing dependencies..." -ForegroundColor Gray
npm install --silent
Write-Host "Frontend dependencies installed" -ForegroundColor Green
Write-Host ""

# Step 4: Start backend in background
Write-Host "Starting backend server..." -ForegroundColor Yellow
Push-Location $backendPath
$backendProcess = Start-Process -PassThru -WindowStyle Normal -FilePath "cmd.exe" -ArgumentList "/k npm start"
Write-Host ("Backend started (PID: {0})" -f $backendProcess.Id) -ForegroundColor Green
Start-Sleep -Seconds 3
Write-Host ""

# Step 5: Start frontend in background
Write-Host "Starting frontend server..." -ForegroundColor Yellow
Push-Location $frontendPath
$frontendProcess = Start-Process -PassThru -WindowStyle Normal -FilePath "cmd.exe" -ArgumentList "/k npm run dev"
Write-Host ("Frontend started (PID: {0})" -f $frontendProcess.Id) -ForegroundColor Green
Start-Sleep -Seconds 3
Write-Host ""

# Step 6: Open browser
Write-Host "Opening browser..." -ForegroundColor Yellow
Start-Sleep -Seconds 2
Start-Process "http://localhost:5173"
Write-Host "Browser opened at http://localhost:5173" -ForegroundColor Green
Write-Host ""

# Final message
Write-Host "================================" -ForegroundColor Cyan
Write-Host "DineSmart is ready!" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Frontend:  http://localhost:5173" -ForegroundColor Green
Write-Host "Backend:   http://localhost:3000/api" -ForegroundColor Green
Write-Host "Database:  postgresql://postgres@localhost:5432/dinesmart" -ForegroundColor Green
Write-Host ""
Write-Host "Tips:" -ForegroundColor Cyan
Write-Host "  - Sign up to test the app" -ForegroundColor Gray
Write-Host "  - Check browser console for logs" -ForegroundColor Gray
Write-Host "  - Backend logs appear in the backend terminal" -ForegroundColor Gray
Write-Host "  - Press Ctrl+C in terminal windows to stop servers" -ForegroundColor Gray
Write-Host ""
