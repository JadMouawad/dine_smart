# DineSmart - Restaurant Discovery Platform

A full-stack web application for discovering, reviewing, and managing restaurants. Built with React 19 + Vite (frontend), Express 4 (backend), and PostgreSQL (database).

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [Roles & Features](#roles--features)
- [Frontend Routes](#frontend-routes)
- [API Endpoints](#api-endpoints)
- [Database Schema](#database-schema)
- [Project Structure](#project-structure)
- [Troubleshooting](#troubleshooting)

---

## Overview

DineSmart is a multi-role restaurant platform with three distinct dashboards:

- **Users** — discover restaurants, search with filters, make reservations, write reviews, flag inappropriate content
- **Owners** — manage their restaurant profile, menu, events, table configuration, reservations, and respond to reviews
- **Admins** — approve/reject restaurant registrations, manage users, moderate flagged reviews, and view audit logs

Authentication supports both local email/password (with email verification) and Google OAuth.

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
│ /api/*              │
└──────────┬──────────┘
           │ TCP
           │
┌──────────▼──────────────┐
│ PostgreSQL Database     │
│ Port: 5432              │
└─────────────────────────┘
```

---

## Tech Stack

### Frontend
| Package | Version | Purpose |
|---------|---------|---------|
| React | 19 | UI framework |
| Vite | 7 | Build tool / dev server |
| React Router | 7 | Client-side routing |
| Framer Motion | 12 | Animations |
| Leaflet + react-leaflet | 1.9 / 5.0 | Interactive maps |
| @react-oauth/google | 0.13 | Google OAuth |
| react-datepicker | 9 | Date selection |
| react-icons | 5 | Icon library |

### Backend
| Package | Version | Purpose |
|---------|---------|---------|
| Express | 4 | HTTP server |
| pg | 8 | PostgreSQL client |
| jsonwebtoken | 9 | JWT auth |
| bcrypt | 5 | Password hashing |
| nodemailer | 8 | Email verification |
| google-auth-library | 10 | Google OAuth verification |
| dotenv | 16 | Environment config |

---

## Prerequisites

- **Node.js** v18+
- **PostgreSQL** v12+
- **npm**
- A Google OAuth client (for Google login) — optional but recommended
- An SMTP server or email service (for email verification) — optional

---

## Installation

```bash
# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

---

## Configuration

### 1. Create the PostgreSQL Database

```bash
psql -U postgres -c "CREATE DATABASE dine_smart;"
psql -U postgres -d dine_smart -f database/schema.sql
```

### 2. Backend Environment — `backend/.env`

```env
# Server
NODE_ENV=development
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=yourpassword
DB_NAME=dine_smart
DB_SSL=false

# JWT
JWT_SECRET=your-super-secret-key

# Email verification (nodemailer)
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USER=your-email@example.com
EMAIL_PASS=your-email-password
EMAIL_FROM=noreply@dinesmart.com
FRONTEND_URL=http://localhost:5173

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### 3. Frontend Environment — `frontend/.env`

```env
VITE_API_URL=http://localhost:3000/api
VITE_GOOGLE_CLIENT_ID=your-google-client-id
```

---

## Running the Application

**Terminal 1 — Backend:**
```bash
cd backend
npm start        # production
npm run dev      # development
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3000/api`

---

## Roles & Features

### User
- Browse the landing page with a discover carousel (by cuisine)
- Search restaurants with filters: cuisine, price range, dietary support, location radius, rating
- Save searches for quick re-use
- View restaurant detail pages (info, reviews, map, events)
- Make and manage reservations
- Write, edit, and delete reviews
- Flag inappropriate reviews
- Manage profile (name, phone, location, profile picture)

### Owner
- Register a restaurant (submitted for admin approval)
- Manage restaurant info, logo, cover image, opening hours, price range, dietary tags
- Configure table setup (2/4/6-person tables, indoor/outdoor capacity)
- Manage events (title, description, image, date range)
- View and manage incoming reservations (accept / reject / mark no-show / complete)
- View reviews and post owner responses
- Manage profile

### Admin
- Secure admin login (`/admin/auth`)
- Dashboard with platform-wide stats
- Approve or reject pending restaurant registrations (with rejection reason)
- Manage users: view all, suspend / unsuspend accounts
- Moderate flagged reviews: resolve or dismiss flags, optionally delete reviews
- View admin audit logs

---

## Frontend Routes

| Path | Component | Access |
|------|-----------|--------|
| `/` | Landing (Hero + Discover + Search) | Public |
| `/verify-email` | Email verification | Public |
| `/explore` | Restaurant exploration | Public |
| `/owner/*` | Owner dashboard shell | Owner |
| `/admin/auth` | Admin login | Public |
| `/admin/dashboard` | Admin dashboard | Admin only |
| `/admin/*` | Admin shell | Admin only |
| `/user/*` | User dashboard shell | User |

---

## API Endpoints

| Prefix | Description |
|--------|-------------|
| `POST /api/auth/register` | Register (local) |
| `POST /api/auth/login` | Login (local) |
| `POST /api/auth/google` | Login / register with Google |
| `GET  /api/me` | Get current user profile |
| `GET/PUT /api/profile` | Profile management |
| `GET /api/search` | Search restaurants with filters |
| `GET /api/discover` | Discover carousel data |
| `GET /api/restaurants/:id` | Restaurant detail |
| `GET/POST /api/reservations` | Reservation management |
| `POST /api/reviews` | Submit a review |
| `POST /api/reviews/:id/flag` | Flag a review |
| `GET /api/events` | Restaurant events |
| `GET/PUT /api/owner/*` | Owner management routes |
| `GET/PUT/POST /api/admin/*` | Admin management routes |

---

## Database Schema

| Table | Description |
|-------|-------------|
| `roles` | `user`, `owner`, `admin` |
| `users` | Accounts with local/Google auth, suspension, geo-location |
| `email_verification_tokens` | Tokens for local email verification |
| `restaurants` | Listings with approval workflow (`pending/approved/rejected`), geo, price range, dietary support |
| `reviews` | User reviews with owner response support |
| `flagged_reviews` | Review flags with admin moderation status |
| `reservations` | Bookings with status lifecycle (`pending → accepted/rejected → completed/no-show/cancelled`) |
| `restaurant_table_configs` | Per-restaurant table capacity breakdown |
| `events` | Restaurant events with date range |
| `saved_searches` | User-saved search filter sets |
| `admin_audit_logs` | Immutable log of admin actions |

---

## Project Structure

```
CMPS-271/
├── backend/
│   ├── server.js
│   └── src/
│       ├── app.js
│       ├── config/          db.js, env.js
│       ├── controllers/     auth, admin, discover, emailVerification,
│       │                    event, profile, reservation, restaurant,
│       │                    review, search
│       ├── middleware/      requireAuth.js, role guards
│       ├── models/          User, Role, Restaurant, Review, Reservation,
│       │                    EmailVerificationToken
│       ├── repositories/    data access layer
│       ├── routes/          per-resource route files + index.js
│       ├── services/        business logic layer
│       ├── utils/
│       └── validation/
│
├── frontend/
│   └── src/
│       ├── App.jsx          root router
│       ├── auth/            AuthContext.jsx
│       ├── components/      Nav, Navbar, AuthModal, RestaurantCard,
│       │                    ReservationForm, ReviewSection, Hero,
│       │                    DiscoverCarousel, Footer, …
│       ├── pages/
│       │   ├── admin/       AdminShell, Dashboard, UserManagement,
│       │   │                PendingRestaurants, FlaggedReviews, Profile
│       │   ├── owner/       OwnerShell, Menu, Reservations, Reviews,
│       │   │                Events, TableConfig, Profile
│       │   └── user/        UserShell, Discover, Explore, Search,
│       │                    Reservations, Profile
│       ├── routes/          AppRoutes, ProtectedRoute, AdminRoute
│       └── services/        apiClient, authService, restaurantService, …
│
├── database/
│   └── schema.sql
│
└── docs/
```

---

## Troubleshooting

**PostgreSQL not running**
```bash
brew services start postgresql   # macOS
sudo systemctl start postgresql  # Linux
```

**Port 3000 in use**
```bash
lsof -ti:3000 | xargs kill -9    # macOS/Linux
```

**`relation "users" does not exist`** — re-run the schema:
```bash
psql -U postgres -d dine_smart -f database/schema.sql
```

**Frontend can't reach backend** — confirm `VITE_API_URL` in `frontend/.env` and that the backend is running on port 3000.

**JWT expired** — log out and log back in; the frontend handles this automatically.

---

## Security Notes

- Change `JWT_SECRET` to a strong random string before deploying
- Never commit `.env` files
- Use HTTPS in production
- Configure CORS to your production domain
- All database queries use parameterized statements (SQL injection safe)
