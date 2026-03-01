# DineSmart API Specification (V0)

This document describes how the frontend (React) communicates with the backend.
All endpoints return JSON.

Standard error format:
{
  "error": "message"
}

Authentication uses JWT tokens sent in the Authorization header.

---

## Authentication

### POST /auth/register
Creates a new user account.

Request body:
{
  "name": "string",
  "email": "string",
  "password": "string"
}

Response (201):
{
  "token": "string",
  "user": {
    "id": 1,
    "name": "string",
    "email": "string",
    "role": "user"
  }
}

---

### POST /auth/login
Logs in an existing user.

Request body:
{
  "email": "string",
  "password": "string"
}

Response (200):
{
  "token": "string",
  "user": {
    "id": 1,
    "name": "string",
    "email": "string",
    "role": "user"
  }
}

---

### GET /me
Returns the currently logged-in user.

Headers:
Authorization: Bearer <token>

Response (200):
{
  "user": {
    "id": 1,
    "name": "string",
    "email": "string",
    "role": "user"
  }
}

---

## Restaurants (User)

### GET /restaurants
Returns a list of restaurants.

Optional query parameters:
- q (search)
- cuisine
- minRating

Response (200):
{
  "restaurants": [
    {
      "id": 1,
      "name": "string",
      "cuisine": "string",
      "rating": 4.2,
      "verified_status": "verified"
    }
  ]
}

---

### GET /restaurants/:id
Returns details for a single restaurant.

Response (200):
{
  "restaurant": {
    "id": 1,
    "name": "string",
    "cuisine": "string",
    "address": "string",
    "verified_status": "verified"
  }
}

---

## Reservations

### POST /reservations
Creates a reservation.

Request body:
{
  "restaurantId": 1,
  "datetime": "ISO_DATE",
  "partySize": 2
}

Response (201):
{
  "reservation": {
    "id": 1,
    "restaurantId": 1,
    "datetime": "ISO_DATE",
    "partySize": 2,
    "status": "booked"
  }
}

---

### GET /reservations/me
Returns reservations for the logged-in user.

Response (200):
{
  "reservations": [
    {
      "id": 1,
      "restaurantId": 1,
      "datetime": "ISO_DATE",
      "partySize": 2,
      "status": "booked"
    }
  ]
}

---

### DELETE /reservations/:id
Cancels a reservation.

Response (200):
{
  "ok": true
}

---

## Owner

### POST /owner/restaurants
Creates a restaurant (owner only).

### PUT /owner/restaurants/:id
Updates restaurant details.

---

## Admin

### GET /admin/restaurants/pending
Returns restaurants awaiting verification.

### PUT /admin/restaurants/:id/verify
Approves or rejects a restaurant.

Request body:
{
  "status": "verified" | "rejected"
}

Response (200):
{
  "ok": true
}