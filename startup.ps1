# DineSmart Complete Startup Script - Simplified Version
# This script sets up and starts both backend and frontend

Write-Host "🚀 DineSmart Startup Script" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Create backend .env file
Write-Host "📝 Creating backend .env file..." -ForegroundColor Yellow

$backendEnv = "NODE_ENV=development`nPORT=3000`nDB_HOST=localhost`nDB_PORT=5432`nDB_USER=postgres`nDB_PASSWORD=982503`nDB_NAME=dine_smart`nJWT_SECRET=some-secret-key-change-in-production"

$envPath = "C:\Users\User\Downloads\DineSmart\dine_smart\backend\.env"
New-Item -Path "C:\Users\User\Downloads\DineSmart\dine_smart\backend" -Name ".env" -ItemType File -Force | Out-Null
Set-Content -Path $envPath -Value $backendEnv -Force
Write-Host "✅ .env file created" -ForegroundColor Green
Write-Host ""

# Step 2: Backend setup
Write-Host "📦 Setting up backend..." -ForegroundColor Yellow
Push-Location "C:\Users\User\Downloads\DineSmart\dine_smart\backend"
Write-Host "Installing dependencies..." -ForegroundColor Gray
npm install --silent
Write-Host "✅ Backend dependencies installed" -ForegroundColor Green
Write-Host ""

# Step 3: Frontend setup
Write-Host "📦 Setting up frontend..." -ForegroundColor Yellow
Push-Location "C:\Users\User\Downloads\DineSmart\dine_smart\frontend"
Write-Host "Installing dependencies..." -ForegroundColor Gray
npm install --silent
Write-Host "✅ Frontend dependencies installed" -ForegroundColor Green
Write-Host ""

# Step 4: Start backend in background
Write-Host "🎬 Starting backend server..." -ForegroundColor Yellow
Push-Location "C:\Users\User\Downloads\DineSmart\dine_smart\backend"
$backendProcess = Start-Process -PassThru -WindowStyle Normal -FilePath "cmd.exe" -ArgumentList "/k npm start"
Write-Host "✅ Backend started (PID: $($backendProcess.Id))" -ForegroundColor Green
Start-Sleep -Seconds 3
Write-Host ""

# Step 5: Start frontend in background
Write-Host "🎬 Starting frontend server..." -ForegroundColor Yellow
Push-Location "C:\Users\User\Downloads\DineSmart\dine_smart\frontend"
$frontendProcess = Start-Process -PassThru -WindowStyle Normal -FilePath "cmd.exe" -ArgumentList "/k npm run dev"
Write-Host "✅ Frontend started (PID: $($frontendProcess.Id))" -ForegroundColor Green
Start-Sleep -Seconds 3
Write-Host ""

# Step 6: Open browser
Write-Host "🌐 Opening browser..." -ForegroundColor Yellow
Start-Sleep -Seconds 2
Start-Process "http://localhost:5173"
Write-Host "✅ Browser opened at http://localhost:5173" -ForegroundColor Green
Write-Host ""

# Final message
Write-Host "================================" -ForegroundColor Cyan
Write-Host "✨ DineSmart is ready!" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "📍 Frontend:  http://localhost:5173" -ForegroundColor Green
Write-Host "📍 Backend:   http://localhost:3000/api" -ForegroundColor Green
Write-Host "📍 Database:  postgresql://postgres@localhost:5432/dine_smart" -ForegroundColor Green
Write-Host ""
Write-Host "💡 Tips:" -ForegroundColor Cyan
Write-Host "  • Sign up to test the app" -ForegroundColor Gray
Write-Host "  • Check browser console for logs" -ForegroundColor Gray
Write-Host "  • Backend logs appear in the backend terminal" -ForegroundColor Gray
Write-Host "  • Press Ctrl+C in terminal windows to stop servers" -ForegroundColor Gray
Write-Host ""