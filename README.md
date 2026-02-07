# DineSmart - Restaurant Discovery Platform

A full-stack web application for discovering and managing restaurants. Built with React (frontend), Express (backend), and PostgreSQL (database).

## Table of Contents

- [Project Overview](#project-overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Database Guide](#database-guide)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)

---

## Project Overview

DineSmart allows users to:
- Register and log in securely
- Browse available restaurants
- View detailed restaurant information
- Discover restaurants by cuisine type

**Features**:
- JWT-based authentication
- Secure password hashing with bcrypt
- Real-time restaurant discovery
- Responsive frontend with React

---

## Architecture

```
┌─────────────────────┐
│   Frontend (React)  │
│   Port: 5173        │
└──────────┬──────────┘
           │ HTTP/JSON
           │
┌──────────▼──────────┐
│ Backend (Express)   │
│ Port: 3000          │
│ /api/auth           │
│ /api/restaurants    │
│ /api/me             │
└──────────┬──────────┘
           │ TCP
           │
┌──────────▼──────────────┐
│ PostgreSQL Database     │
│ Port: 5432              │
│ users, restaurants,     │
│ roles tables            │
└─────────────────────────┘
```

---

## Prerequisites

### Required
- **Node.js** (v18+)
- **PostgreSQL** (v12+)
- **npm** or **yarn**

### Optional
- **Git** (for cloning)
- **curl** or **Postman** (for API testing)

---

## Installation

### 1. Clone the Repository
```bash
git clone <repository-url>
cd dine_smart
```

### 2. Install Backend Dependencies
```bash
cd backend
npm install
```

### 3. Install Frontend Dependencies
```bash
cd frontend
npm install
```

---

## Configuration

### 1. Create PostgreSQL Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE dine_smart;

# Exit psql
\q
```

### 2. Initialize Database Schema

```bash
# Connect to the database
psql -U postgres -d dine_smart

# Run schema.sql
\i ../database/schema.sql

# Insert default roles
INSERT INTO roles (name) VALUES ('user'), ('owner'), ('admin');

# Verify tables were created
\dt

# Exit
\q
```

### 3. Create Backend Environment File

Create `backend/.env`:

```env
# Server Configuration
NODE_ENV=development
PORT=3000

# Database Configuration (choose one approach)

# Option A: Using individual credentials
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=yourpassword
DB_NAME=dine_smart
DB_SSL=false

# OR Option B: Using connection string
# DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/dine_smart

# JWT Configuration
JWT_SECRET=your-super-secret-key-change-in-production-12345
```

### 4. Create Frontend Environment File (if needed)

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:3000/api
```

---

## Running the Application

### Terminal 1: Start Backend Server

```bash
cd backend
npm start
# OR with development watch mode
npm run dev
```

**Expected output**:
```
🚀 Server running on http://localhost:3000
📡 API available at http://localhost:3000/api
```

### Terminal 2: Start Frontend Development Server

```bash
cd frontend
npm run dev
```

**Expected output**:
```
VITE v7.2.4  ready in 123 ms

➜  Local:   http://localhost:5173/
```

### Access the Application

- **Frontend**: Open browser to `http://localhost:5173`
- **Backend API**: `http://localhost:3000/api`

---

## API Documentation

### Authentication Endpoints

#### Register User
```
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securePassword123"
}
```

**Response** (201 Created):
```json
{
  "message": "User registered successfully",
  "user": {
    "id": 1,
    "fullName": "John Doe",
    "email": "john@example.com"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Login User
```
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "securePassword123"
}
```

**Response** (200 OK):
```json
{
  "message": "Login successful",
  "user": {
    "id": 1,
    "fullName": "John Doe",
    "email": "john@example.com"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Get Current User
```
GET /api/me
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "message": "User profile retrieved",
  "user": {
    "id": 1,
    "email": "john@example.com"
  }
}
```

### Restaurant Endpoints

#### Get All Restaurants
```
GET /api/restaurants
```

**Response** (200 OK):
```json
[
  {
    "id": 1,
    "name": "The Italian Place",
    "cuisine": "Italian",
    "address": "123 Main St",
    "rating": 4.5
  },
  {
    "id": 2,
    "name": "Dragon Palace",
    "cuisine": "Chinese",
    "address": "456 Oak Ave",
    "rating": 4.2
  }
]
```

#### Get Restaurant by ID
```
GET /api/restaurants/:id
```

**Response** (200 OK):
```json
{
  "id": 1,
  "name": "The Italian Place",
  "cuisine": "Italian",
  "description": "Authentic Italian cuisine since 1995",
  "address": "123 Main St, City, State",
  "phone": "555-0001",
  "rating": 4.5
}
```

---

## Database Guide

### Connecting to Database

#### Using psql
```bash
# Connect to database
psql -U postgres -d dine_smart

# List all tables
\dt

# Exit
\q
```

#### Using GUI Tool
- **DBeaver**: Download from https://dbeaver.io
- **pgAdmin**: Download from https://www.pgadmin.org
- **VS Code Extension**: Install "PostgreSQL" extension

### Viewing Data

#### See All Users
```sql
SELECT id, full_name, email, role_id, created_at FROM users;
```

#### See All Restaurants
```sql
SELECT id, name, cuisine, address, rating, created_at FROM restaurants;
```

#### See All Roles
```sql
SELECT * FROM roles;
```

#### See User with Restaurants (as Owner)
```sql
SELECT u.id, u.full_name, u.email, r.name as restaurant_name
FROM users u
LEFT JOIN restaurants r ON u.id = r.owner_id;
```

#### Count Records by Table
```sql
SELECT
  'users' as table_name, COUNT(*) as total FROM users
UNION ALL
SELECT 'restaurants', COUNT(*) FROM restaurants
UNION ALL
SELECT 'roles', COUNT(*) FROM roles;
```

### Inserting Test Data

#### Insert Test Restaurants
```sql
INSERT INTO restaurants (name, cuisine, description, address, phone, rating)
VALUES
  ('The Italian Place', 'Italian', 'Authentic Italian cuisine', '123 Main St', '555-0001', 4.5),
  ('Dragon Palace', 'Chinese', 'Traditional Chinese dishes', '456 Oak Ave', '555-0002', 4.2),
  ('Burger Heaven', 'American', 'Classic American burgers', '789 Pine Rd', '555-0003', 4.7),
  ('Sushi Dreams', 'Japanese', 'Fresh sushi and sashimi', '321 Elm St', '555-0004', 4.6);
```

#### Clear All Data (Warning: Destructive)
```sql
-- Delete all restaurants
DELETE FROM restaurants;

-- Delete all users
DELETE FROM users;

-- Reset ID sequences
ALTER SEQUENCE restaurants_id_seq RESTART WITH 1;
ALTER SEQUENCE users_id_seq RESTART WITH 1;
```

---

## Project Structure

```
dine_smart/
├── backend/
│   ├── package.json
│   ├── server.js
│   ├── src/
│   │   ├── app.js                          # Express app setup
│   │   ├── config/
│   │   │   ├── db.js                       # PostgreSQL pool
│   │   │   └── env.js                      # Environment config
│   │   ├── controllers/
│   │   │   ├── authController.js           # Auth request handlers
│   │   │   └── restaurant.controller.js    # Restaurant handlers
│   │   ├── middleware/
│   │   │   └── requireAuth.js              # JWT verification
│   │   ├── models/
│   │   │   ├── User.js                     # User database queries
│   │   │   ├── Restaurant.js               # Restaurant schema
│   │   │   └── restaurant.model.js         # Restaurant queries
│   │   ├── routes/
│   │   │   ├── index.js                    # Main router
│   │   │   ├── authRoutes.js               # Auth routes
│   │   │   ├── user.routes.js              # User routes
│   │   │   └── restaurant.routes.js        # Restaurant routes
│   │   ├── services/
│   │   │   ├── authServices.js             # Auth business logic
│   │   │   └── restaurantService.js        # Restaurant logic
│   │   └── validation/
│   │       └── authValidation.js           # Input validation
│   └── .env                                 # Environment variables
│
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── style.css
│   │   ├── auth/
│   │   │   └── AuthContext.jsx             # Auth state management
│   │   ├── components/
│   │   │   ├── Navbar.jsx
│   │   │   ├── AuthModal.jsx
│   │   │   ├── RestaurantCard.jsx
│   │   │   └── ...
│   │   ├── pages/
│   │   │   └── RestaurantDetail.jsx
│   │   ├── routes/
│   │   │   ├── AppRoutes.jsx
│   │   │   └── ProtectedRoute.jsx
│   │   └── services/
│   │       ├── apiClient.js                # HTTP client
│   │       ├── authService.js              # Auth API calls
│   │       └── restaurantService.js        # Restaurant API calls
│   └── .env                                 # Environment variables
│
├── database/
│   └── schema.sql                           # PostgreSQL schema
│
└── docs/
    ├── api-spec.md                         # API specification
    └── sprint-1-notes.md                   # Implementation notes
```

---

## Troubleshooting

### Backend Won't Start

**Error**: `Error: connect ECONNREFUSED 127.0.0.1:5432`

**Solution**: PostgreSQL is not running
```bash
# macOS
brew services start postgresql

# Ubuntu/Linux
sudo systemctl start postgresql

# Windows
# Start PostgreSQL from Services or use pgAdmin
```

### Database Connection Error

**Error**: `error: FATAL: role "postgres" does not exist`

**Solution**: Check PostgreSQL user exists
```bash
# Login as default user
psql -U postgres
```

### Frontend Can't Connect to Backend

**Error**: `CORS error` or `Failed to fetch`

**Solution**: Make sure backend is running on port 3000
```bash
# Check if port 3000 is in use
netstat -tlnp | grep 3000  # Linux/macOS
netstat -ano | findstr :3000  # Windows
```

### JWT Token Expired

**Error**: `Invalid or expired token`

**Solution**: Login again to get a new token
```javascript
// Frontend will automatically handle this
logout();
```

### Database Schema Issues

**Error**: `relation "users" does not exist`

**Solution**: Re-run the schema initialization
```bash
psql -U postgres -d dine_smart -f database/schema.sql
```

### Port Already in Use

**Error**: `Error: listen EADDRINUSE :::3000`

**Solution**: Kill the process using the port or change the PORT in .env
```bash
# macOS/Linux - Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

---

## Security Considerations

⚠️ **Important**: The following are for development only:

1. **JWT_SECRET**: Change to a strong random string in production
2. **Database Password**: Use a secure password, don't share in code
3. **HTTPS**: Use HTTPS in production (not just HTTP)
4. **CORS**: Configure CORS properly for production domain
5. **Environment Variables**: Never commit `.env` files to Git
6. **Rate Limiting**: Implement rate limiting on auth endpoints
7. **Input Validation**: Additional validation should be added
8. **SQL Injection**: Always use parameterized queries (already done)

---

## Development Tips

### Hot Reload
- Frontend automatically reloads on file changes (Vite)
- Backend requires manual restart or use `nodemon`

### Add nodemon for Backend Development
```bash
npm install --save-dev nodemon
```

Update `package.json` scripts:
```json
"dev": "nodemon server.js"
```

### Testing API with cURL

```bash
# Register
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@test.com","password":"test123"}'

# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}'

# Get current user (replace TOKEN with actual token)
curl http://localhost:3000/api/me \
  -H "Authorization: Bearer TOKEN"
```

---

## Next Steps

1. ✅ Install dependencies (`npm install`)
2. ✅ Set up PostgreSQL database
3. ✅ Create `.env` file with database credentials
4. ✅ Run database schema (`schema.sql`)
5. ✅ Start backend server (`npm start`)
6. ✅ Start frontend server (`npm run dev`)
7. ✅ Open `http://localhost:5173` in browser
8. ✅ Test registration and login flows

---

## Support & Contributing

For issues, bugs, or feature requests, please contact the development team.

---

## License

MIT License - See LICENSE file for details
