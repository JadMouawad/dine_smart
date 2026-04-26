# Sprint 1 - Implementation Notes

## Overview
DineSmart is a full-stack web application built with:
- **Frontend**: React + Vite
- **Backend**: Express.js + Node.js
- **Database**: PostgreSQL

This sprint focuses on implementing the core authentication system and restaurant discovery features.

---

## Completed Items ✅

### Backend Setup
- [x] Express server listening on port 3000
- [x] PostgreSQL database connection pool configured
- [x] Environment variable configuration (dotenv)
- [x] CORS and JSON middleware setup
- [x] API routes mounted under `/api` prefix

### Database Schema
- [x] Roles table (user, owner, admin roles)
- [x] Users table with password field
- [x] Restaurants table with cuisine and rating fields
- [x] Proper relationships and constraints

### Authentication System
- [x] User registration endpoint (`POST /api/auth/register`)
- [x] User login endpoint (`POST /api/auth/login`)
- [x] Password hashing with bcrypt
- [x] JWT token generation and validation
- [x] Authentication middleware (`requireAuth`)
- [x] Get current user endpoint (`GET /api/me`)

### Restaurant Features
- [x] Get all restaurants endpoint (`GET /api/restaurants`)
- [x] Get restaurant by ID endpoint (`GET /api/restaurants/:id`)
- [x] Restaurant service layer
- [x] Restaurant model with database queries

### Frontend Integration
- [x] API client with token handling
- [x] Authentication service
- [x] Restaurant service
- [x] Auth context provider
- [x] Protected routes setup (ProtectedRoute component)

---

## Sprint 1 Implementation Details

### Story 1: User Registration
**Status**: ✅ Implemented

**Endpoint**: `POST /api/auth/register`

**Request Body**:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securePassword123"
}
```

**Response**:
```json
{
  "message": "User registered successfully",
  "user": {
    "id": 1,
    "fullName": "John Doe",
    "email": "john@example.com"
  },
  "token": "eyJhbGc..."
}
```

**Implementation**:
- Input validation (email format, password length ≥ 6 chars)
- Check for duplicate emails
- Hash password with bcrypt (10 rounds)
- Create user in database with role_id = 3 (regular user)
- Generate JWT token (expires in 7 days)

---

### Story 2: User Login
**Status**: ✅ Implemented

**Endpoint**: `POST /api/auth/login`

**Request Body**:
```json
{
  "email": "john@example.com",
  "password": "securePassword123"
}
```

**Response**:
```json
{
  "message": "Login successful",
  "user": {
    "id": 1,
    "fullName": "John Doe",
    "email": "john@example.com"
  },
  "token": "eyJhbGc..."
}
```

**Implementation**:
- Validate email and password required
- Find user by email
- Compare password with bcrypt
- Return JWT token on success
- Clear generic error messages for security

---

### Story 3: Token Verification & Protected Routes
**Status**: ✅ Implemented

**Middleware**: `requireAuth`

**How it works**:
1. Extract token from `Authorization: Bearer <token>` header
2. Verify JWT signature and expiration
3. Attach decoded user data to `req.user`
4. Proceed to next middleware/controller

**Usage**:
```javascript
router.get("/me", requireAuth, getUserProfile);
```

---

### Story 4: Get Current User
**Status**: ✅ Implemented

**Endpoint**: `GET /api/me` (Protected)

**Response**:
```json
{
  "message": "User profile retrieved",
  "user": {
    "id": 1,
    "email": "john@example.com"
  }
}
```

---

### Story 7: Browse Restaurants
**Status**: ✅ Implemented

**Endpoint**: `GET /api/restaurants`

**Response**:
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

---

### Story 8: View Restaurant Details
**Status**: ✅ Implemented

**Endpoint**: `GET /api/restaurants/:id`

**Response**:
```json
{
  "id": 1,
  "name": "The Italian Place",
  "cuisine": "Italian",
  "description": "Authentic Italian cuisine",
  "address": "123 Main St",
  "phone": "555-0001",
  "rating": 4.5
}
```

---

## Frontend Integration

### AuthContext (React Context)
The `AuthContext` provides:
- `user` - Current authenticated user or null
- `loading` - Loading state during session restoration
- `login(email, password)` - Login function
- `register(name, email, password)` - Registration function
- `logout()` - Logout function

**Usage**:
```javascript
import { useAuth } from "../auth/AuthContext";

function MyComponent() {
  const { user, login, logout, loading } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  
  if (!user) {
    return <button onClick={() => login("email", "pass")}>Login</button>;
  }
  
  return <div>Welcome, {user.fullName}</div>;
}
```

### Protected Routes
Use the `ProtectedRoute` component to protect routes:
```javascript
<ProtectedRoute>
  <RestaurantDetail />
</ProtectedRoute>
```

---

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role_id INTEGER NOT NULL REFERENCES roles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Restaurants Table
```sql
CREATE TABLE restaurants (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  cuisine VARCHAR(50),
  description TEXT,
  address VARCHAR(255),
  phone VARCHAR(30),
  rating DECIMAL(3,2) DEFAULT 0,
  owner_id INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Roles Table
```sql
CREATE TABLE roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(20) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Environment Variables

### Backend (.env)
```
NODE_ENV=development
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=yourpassword
DB_NAME=dinesmart
DB_SSL=false
JWT_SECRET=<generate-a-strong-random-secret>
```

Or use DATABASE_URL:
```
DATABASE_URL=postgresql://user:password@localhost:5432/dinesmart
JWT_SECRET=<generate-a-strong-random-secret>
```

---

## Testing the API

### Register a User
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"John","email":"john@test.com","password":"test123"}'
```

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@test.com","password":"test123"}'
```

### Get Current User (with token)
```bash
curl -X GET http://localhost:3000/api/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Get Restaurants
```bash
curl http://localhost:3000/api/restaurants
```

### Get Restaurant By ID
```bash
curl http://localhost:3000/api/restaurants/1
```

---

## Known Limitations / Future Work

- [ ] Email verification
- [ ] Password reset functionality
- [ ] Restaurant search/filter endpoints
- [ ] Restaurant ratings and reviews
- [ ] User profile management
- [ ] Admin dashboard
- [ ] Image uploads for restaurants
- [ ] Reservation system
- [ ] Payment integration

---

## Bug Fixes Applied in This Sprint

1. ✅ Fixed MongoDB-to-PostgreSQL migration in auth service
2. ✅ Added missing password field to users table
3. ✅ Added missing cuisine and rating fields to restaurants table
4. ✅ Added missing bcrypt and jsonwebtoken dependencies
5. ✅ Fixed auth routes not mounted in main router
6. ✅ Fixed middleware file path references
7. ✅ Added server.listen() call
8. ✅ Fixed API endpoint paths and base URL

---

## Next Steps (Future Sprints)

- **Sprint 2**: User profiles and restaurant owner functionality
- **Sprint 3**: Review and rating system
- **Sprint 4**: Search and advanced filtering
- **Sprint 5**: Reservations and bookings
