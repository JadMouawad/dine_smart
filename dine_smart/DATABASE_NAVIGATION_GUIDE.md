# DineSmart Database Navigation & Data Recording Guide

**Purpose**: Understanding how data flows through the system and how to view/manage it  
**Database**: PostgreSQL  
**Tools**: psql CLI (command-line) or DBeaver (GUI)

---

## Table of Contents

1. [Connecting to Database](#connecting-to-database)
2. [Database Structure](#database-structure)
3. [Viewing Data](#viewing-data)
4. [Recording/Inserting Data](#recordingInserting-data)
5. [Data Flow Through Application](#data-flow-through-application)
6. [Real-Time Data Tracking](#real-time-data-tracking)
7. [Common Queries](#common-queries)
8. [Troubleshooting](#troubleshooting)

---

## Connecting to Database

### Option 1: Using psql (Command Line)

#### Basic Connection
```bash
psql -U postgres -d dine_smart
```

**Parameters**:
- `-U postgres` - Username (default PostgreSQL user)
- `-d dine_smart` - Database name
- `-h localhost` - Host (optional, default is localhost)
- `-p 5432` - Port (optional, default is 5432)

#### Verify Connection
```bash
# Should show similar output:
psql (15.2 (Debian 15.2-1.pgdg120+1))
Type "help" for help.

dine_smart=#
```

#### Exit psql
```bash
\q
```

---

### Option 2: Using DBeaver (GUI)

1. **Download**: https://dbeaver.io/download/
2. **Create Connection**:
   - Click "Database" → "New Database Connection"
   - Select "PostgreSQL"
   - Configure:
     - **Server Host**: localhost
     - **Port**: 5432
     - **Database**: dine_smart
     - **Username**: postgres
     - **Password**: (your password)
   - Click "Test Connection"
   - Click "Finish"

3. **Browse Data**:
   - Expand database in left panel
   - Expand "Schemas" → "Public"
   - Click on table names
   - View data in right panel

---

## Database Structure

### Tables Overview

```
dine_smart
├── roles
│   ├── id (int, primary key)
│   ├── name (varchar) - Values: 'user', 'owner', 'admin'
│   ├── created_at (timestamp)
│   └── updated_at (timestamp)
│
├── users
│   ├── id (int, primary key)
│   ├── full_name (varchar)
│   ├── email (varchar, unique)
│   ├── password (varchar, hashed with bcrypt)
│   ├── role_id (int, foreign key → roles.id)
│   ├── created_at (timestamp)
│   └── updated_at (timestamp)
│
└── restaurants
    ├── id (int, primary key)
    ├── name (varchar)
    ├── cuisine (varchar)
    ├── description (text)
    ├── address (varchar)
    ├── phone (varchar)
    ├── rating (decimal 0.00 - 5.00)
    ├── owner_id (int, foreign key → users.id)
    ├── created_at (timestamp)
    └── updated_at (timestamp)
```

---

## Viewing Data

### View All Roles
```sql
SELECT * FROM roles;
```

**Output Example**:
```
 id |  name  |         created_at         |         updated_at
----+--------+----------------------------+----------------------------
  1 | user   | 2026-02-07 10:00:00+00     | 2026-02-07 10:00:00+00
  2 | owner  | 2026-02-07 10:00:00+00     | 2026-02-07 10:00:00+00
  3 | admin  | 2026-02-07 10:00:00+00     | 2026-02-07 10:00:00+00
```

### View All Users
```sql
SELECT id, full_name, email, role_id, created_at FROM users;
```

**What This Shows**:
- Every user registered in the system
- User's role (1=user, 2=owner, 3=admin)
- When they registered

### View All Restaurants
```sql
SELECT id, name, cuisine, address, rating FROM restaurants ORDER BY rating DESC;
```

**What This Shows**:
- All restaurants in the database
- Their cuisine type
- Average rating (highest first)

### View User Details (Specific User)
```sql
SELECT * FROM users WHERE email = 'john@example.com';
```

**What This Shows**:
- Complete user profile
- Including hashed password (for verification only)

### View Restaurant Details (Specific Restaurant)
```sql
SELECT * FROM restaurants WHERE id = 1;
```

**What This Shows**:
- Complete restaurant information
- Owner ID (relates to users table)

---

## Recording/Inserting Data

### How Data Gets Recorded Automatically

When a user registers through the frontend:

```
1. User submits form in AuthModal
   ↓
2. Frontend calls: registerUser(name, email, password)
   ↓
3. POST /api/auth/register
   ↓
4. Backend authController receives request
   ↓
5. authServices.registerUser() executes:
   - Validates email format and password strength
   - Hashes password with bcrypt
   - Inserts into users table with role_id = 3 (user role)
   - Generates JWT token
   ↓
6. Data appears in database automatically
```

### Manual Data Entry

#### Insert Test User
```sql
INSERT INTO users (full_name, email, password, role_id)
VALUES ('Test User', 'test@example.com', 'hashed_password_here', 3);
```

⚠️ **Note**: Password should be hashed with bcrypt. For testing, you can generate one:

```bash
# Terminal command to generate bcrypt hash
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('password123', 10).then(h => console.log(h));"
```

#### Insert Test Restaurant
```sql
INSERT INTO restaurants (name, cuisine, description, address, phone, rating, owner_id)
VALUES (
  'Test Italian Place',
  'Italian',
  'Authentic Italian cuisine',
  '123 Main St, City, State',
  '555-0001',
  4.5,
  1
);
```

#### Insert Multiple Restaurants
```sql
INSERT INTO restaurants (name, cuisine, description, address, phone, rating)
VALUES
  ('The Italian Place', 'Italian', 'Authentic Italian cuisine', '123 Main St', '555-0001', 4.5),
  ('Dragon Palace', 'Chinese', 'Traditional Chinese dishes', '456 Oak Ave', '555-0002', 4.2),
  ('Burger Heaven', 'American', 'Classic American burgers', '789 Pine Rd', '555-0003', 4.7),
  ('Sushi Dreams', 'Japanese', 'Fresh sushi and sashimi', '321 Elm St', '555-0004', 4.6),
  ('Taco Fiesta', 'Mexican', 'Authentic Mexican flavors', '654 Maple Dr', '555-0005', 4.3);
```

---

## Data Flow Through Application

### User Registration Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     User Registration                       │
└─────────────────────────────────────────────────────────────┘

FRONTEND (React)
├─ User enters: name, email, password in AuthModal
├─ Clicks "Create account" button
└─ Calls: authService.registerUser(name, email, password)
          ↓
API REQUEST
├─ POST /api/auth/register
├─ Body: { name, email, password }
└─ Headers: { Content-Type: application/json }
            ↓
BACKEND (Express)
├─ authController.register() receives request
├─ Validates input:
│  ├─ Email format ✓
│  ├─ Password length >= 6 ✓
│  └─ No duplicate email ✓
├─ Calls: authServices.registerUser()
│  ├─ Checks if email exists in database
│  ├─ Hashes password with bcrypt
│  ├─ Inserts into users table:
│  │  ├─ full_name → "John Doe"
│  │  ├─ email → "john@example.com"
│  │  ├─ password → "$2b$10$..." (hashed)
│  │  ├─ role_id → 3 (user role)
│  │  ├─ created_at → NOW()
│  │  └─ updated_at → NOW()
│  ├─ Generates JWT token
│  └─ Returns: { user, token }
└─ Sends response back to frontend
       ↓
DATABASE (PostgreSQL)
└─ New row in users table:
   id: 5
   full_name: John Doe
   email: john@example.com
   password: $2b$10$...
   role_id: 3
   created_at: 2026-02-07 14:30:00
   updated_at: 2026-02-07 14:30:00
       ↓
FRONTEND (React)
├─ Receives token and user data
├─ Stores token in localStorage
├─ Updates AuthContext
└─ Closes AuthModal, redirects to home
```

### View All Restaurants Flow

```
┌─────────────────────────────────────────────────┐
│           View Restaurants List                 │
└─────────────────────────────────────────────────┘

FRONTEND (React)
├─ User clicks "Discover" or visits /restaurants
├─ DiscoverCarousel component mounts
└─ Calls: restaurantService.getAllRestaurants()
           ↓
API REQUEST
├─ GET /api/restaurants
└─ No authentication needed
            ↓
BACKEND (Express)
├─ restaurantController.getRestaurants()
├─ Calls: restaurantService.getAllRestaurants()
├─ Calls: RestaurantModel.getAllRestaurants(db)
├─ Executes Query:
│  └─ SELECT id, name, cuisine, address, rating
│     FROM restaurants ORDER BY id ASC
└─ Returns: array of restaurant objects
             ↓
DATABASE (PostgreSQL)
└─ Queries restaurants table:
   Returns:
   [
     { id: 1, name: "Italian Place", cuisine: "Italian", address: "123 Main", rating: 4.5 },
     { id: 2, name: "Dragon Palace", cuisine: "Chinese", address: "456 Oak", rating: 4.2 },
     ...
   ]
           ↓
FRONTEND (React)
├─ Displays restaurants in carousel
├─ Renders RestaurantCard for each
└─ User can view details or explore more
```

---

## Real-Time Data Tracking

### Track User Login Attempts

```sql
-- Create a view to see user logins (based on timestamps)
SELECT id, email, full_name, created_at as registered_at, updated_at as last_activity
FROM users
ORDER BY updated_at DESC
LIMIT 10;
```

### Track Recently Added Restaurants

```sql
-- See restaurants added in the last 24 hours
SELECT id, name, cuisine, created_at
FROM restaurants  
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

### Track User Activity

```sql
-- See which restaurants were added by which owner
SELECT u.full_name, COUNT(r.id) as num_restaurants, MAX(r.created_at) as last_added
FROM users u
LEFT JOIN restaurants r ON u.id = r.owner_id
GROUP BY u.id, u.full_name
ORDER BY num_restaurants DESC;
```

---

## Common Queries

### 1. Find User by Email
```sql
SELECT * FROM users WHERE email = 'john@example.com';
```

### 2. Find All Restaurants by Cuisine
```sql
SELECT * FROM restaurants WHERE cuisine = 'Italian' ORDER BY rating DESC;
```

### 3. Find Restaurants Above Certain Rating
```sql
SELECT name, cuisine, address, rating 
FROM restaurants 
WHERE rating >= 4.0 
ORDER BY rating DESC;
```

### 4. Count Records in Each Table
```sql
SELECT 
  'users' as table_name, COUNT(*) as total FROM users
UNION ALL
SELECT 'restaurants', COUNT(*) FROM restaurants
UNION ALL
SELECT 'roles', COUNT(*) FROM roles;
```

### 5. Find All Users with Admin Role
```sql
SELECT u.id, u.full_name, u.email, r.name as role
FROM users u
JOIN roles r ON u.role_id = r.id
WHERE r.name = 'admin';
```

### 6. Find Restaurants with No Owner
```sql
SELECT id, name, cuisine, address 
FROM restaurants 
WHERE owner_id IS NULL;
```

### 7. Find User's Restaurants
```sql
SELECT u.full_name, COUNT(r.id) as restaurant_count
FROM users u
LEFT JOIN restaurants r ON u.id = r.owner_id  
WHERE u.email = 'owner@example.com'
GROUP BY u.id, u.full_name;
```

### 8. Search Restaurants by Name Pattern
```sql
SELECT * FROM restaurants 
WHERE name ILIKE '%pizza%' OR cuisine ILIKE '%pizza%';
```

### 9. Get Statistics
```sql
SELECT 
  COUNT(DISTINCT u.id) as total_users,
  COUNT(DISTINCT r.id) as total_restaurants,
  ROUND(AVG(r.rating), 2) as avg_rating,
  MAX(r.rating) as highest_rating,
  MIN(r.rating) as lowest_rating
FROM users u
LEFT JOIN restaurants r ON u.id = r.owner_id;
```

### 10. Find Most Popular Cuisines
```sql
SELECT cuisine, COUNT(*) as count, ROUND(AVG(rating), 2) as avg_rating
FROM restaurants
WHERE cuisine IS NOT NULL
GROUP BY cuisine  
ORDER BY count DESC, avg_rating DESC;
```

---

## Troubleshooting

### Can't Connect to Database

**Error**: `psql: error: FATAL: role "postgres" does not exist`

**Solution**: 
```bash
# Check PostgreSQL status
sudo systemctl status postgresql  # Linux
brew services list               # macOS

# Start PostgreSQL if not running
sudo systemctl start postgresql   # Linux
brew services start postgresql   # macOS
```

### Database Doesn't Exist

**Error**: `psql: error: FATAL: database "dine_smart" does not exist`

**Solution**:
```bash
# Create database
psql -U postgres -c "CREATE DATABASE dine_smart;"

# Verify
psql -U postgres -l | grep dine_smart
```

### Schema Not Initialized

**Error**: `psql: error: relation "users" does not exist`

**Solution**:
```bash
# Run schema file
psql -U postgres -d dine_smart -f database/schema.sql

# Verify tables exist
psql -U postgres -d dine_smart -c "\dt"
```

### Wrong Password

**Error**: `psql: error: FATAL: password authentication failed`

**Solution**:
```bash
# Reset PostgreSQL password
sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'newpassword';"

# Update backend/.env with new password
```

### Port Already in Use

**Error**: `could not bind socket (Address already in use)`

**Solution**:
```bash
# Find process using port 5432
lsof -i :5432  # macOS/Linux
netstat -ano | findstr :5432  # Windows

# Kill process
kill -9 <PID>  # macOS/Linux
taskkill /PID <PID> /F  # Windows
```

---

## Data Persistence

### How Data is Stored

All data is persisted to disk by PostgreSQL automatically:

```
User registers
  ↓
INSERT into database
  ↓
PostgreSQL writes to disk
  ↓
Data survives restarts
```

### Backup Data

```bash
# Backup database
pg_dump -U postgres dine_smart > dine_smart_backup.sql

# Restore from backup
psql -U postgres dine_smart < dine_smart_backup.sql
```

### Clear All Data (⚠️ Destructive)

```sql
-- Delete all data but keep schema
DELETE FROM restaurants;
DELETE FROM users;
DELETE FROM roles;

-- Reset primary key sequences
ALTER SEQUENCE restaurants_id_seq RESTART WITH 1;
ALTER SEQUENCE users_id_seq RESTART WITH 1;
ALTER SEQUENCE roles_id_seq RESTART WITH 1;
```

---

## Monitoring Data Changes

### View Logs
```bash
# Backend logs show API calls
# Check terminal where backend server is running

# Database logs (if enabled)
tail -f /var/log/postgresql/postgresql.log  # Linux
```

### Monitor in Real-Time

**Terminal 1** (Backend):
```bash
npm start
# Watch for POST /api/auth/register, POST /api/auth/login
```

**Terminal 2** (Database):
```bash
psql -U postgres -d dine_smart -c "WATCH 'SELECT * FROM users;'"
```

**Terminal 3** (Frontend):
```bash
npm run dev
# Open browser DevTools → Network tab to see API calls
```

---

## Security Considerations

### Password Storage
- All passwords are hashed with bcrypt
- Never view/modify password directly
- Cannot reverse a bcrypt hash

### Data Access
- Use proper SQL escaping (parameterized queries - already implemented)
- Never trust user input directly
- Validate all data before storing

### Audit Trail
- `created_at` shows when record was created
- `updated_at` shows when last modified
- Add audit logging for production

---

## Quick Reference Card

| Task | Command |
|------|---------|
| Connect to DB | `psql -U postgres -d dine_smart` |
| List tables | `\dt` |
| Show table schema | `\d users` |
| Backup database | `pg_dump -U postgres dine_smart > backup.sql` |
| View all users | `SELECT * FROM users;` |
| View all restaurants | `SELECT * FROM restaurants;` |
| Count records | `SELECT COUNT(*) FROM users;` |
| Exit psql | `\q` |

---

## Next Steps

1. Start backend server (`npm start`)
2. Start frontend server (`npm run dev`)
3. Open http://localhost:5173
4. Register a test user
5. Check database: `SELECT * FROM users;`
6. View added restaurant data
7. Monitor API calls in browser DevTools

**All data is automatically recorded when you use the application!**
