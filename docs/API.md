# Mo-Ride REST API Reference

Base URL: `http://localhost:8000/api`

All authenticated endpoints require: `Authorization: Bearer <access_token>`

---

## Authentication

### POST /auth/register
Create a new account. Only `@monash.edu` emails accepted.

**Body:**
```json
{
  "email": "jane@monash.edu",
  "password": "SecurePass1",
  "name": "Jane Smith",
  "phone": "+61400000000",
  "role": "rider"
}
```
**Response 201:**
```json
{
  "message": "Registration successful. Please verify your email.",
  "user_id": "uuid",
  "otp": "123456"  // dev mode only
}
```

---

### POST /auth/verify-otp
Verify email with OTP sent to inbox (or shown in dev response).

**Body:** `{ "email": "jane@monash.edu", "otp": "123456" }`

---

### POST /auth/login
**Body:** `{ "email": "jane@monash.edu", "password": "SecurePass1" }`

**Response 200:**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "Bearer",
  "user": { "id": "uuid", "name": "Jane", "email": "...", "role": "rider" }
}
```

---

### POST /auth/refresh
**Body:** `{ "refresh_token": "eyJ..." }`

---

### POST /auth/logout
Invalidates refresh token. Requires auth header.

---

## User

### GET /me
Returns full user profile including driver details and ratings.

### PATCH /me
Update name, phone, and/or driver_profile vehicle details.

**Body:**
```json
{
  "name": "Jane Smith",
  "phone": "+61400000001",
  "driver_profile": {
    "car_make": "Toyota",
    "car_model": "Camry",
    "car_color": "White",
    "car_plate": "ABC123"
  }
}
```

---

## Driver

### POST /driver/go-online
**Body:** `{ "lat": -37.9105, "lng": 145.1362 }`

Registers driver in Redis GEO index and marks them available.

### POST /driver/go-offline
Removes driver from Redis GEO index.

### GET /driver/status
Returns `{ "is_online": bool, "profile": {...} }`

### POST /driver/update-location
**Body:** `{ "lat": number, "lng": number }` — call every 5-10 seconds while online.

---

## Rides

### POST /rides/estimate
Get fare estimate without creating a ride.

**Body:**
```json
{
  "pickup_lat": -37.9105,
  "pickup_lng": 145.1362,
  "dropoff_lat": -37.8777,
  "dropoff_lng": 145.0452
}
```

**Response 200:**
```json
{
  "distance_km": 14.3,
  "eta_minutes": 28,
  "fare": {
    "base_fare": 23.45,
    "surge_multiplier": 1.0,
    "time_multiplier": 1.0,
    "demand_ratio": 0.5,
    "final_fare": 23.45,
    "currency": "aud",
    "is_peak": false
  }
}
```

---

### POST /rides/request
Create a ride request. Triggers matching algorithm in background.

**Body:**
```json
{
  "pickup_lat": -37.9105, "pickup_lng": 145.1362,
  "pickup_address": "Monash Clayton Campus",
  "dropoff_lat": -37.8777, "dropoff_lng": 145.0452,
  "dropoff_address": "Monash Caulfield Campus",
  "pickup_time": "2024-03-01T09:00:00Z",
  "passenger_count": 1
}
```

**Response 202:**
```json
{
  "ride_id": "uuid",
  "status": "matching",
  "distance_km": 14.3,
  "eta_minutes": 28,
  "fare_estimated": 23.45,
  "fare_breakdown": { ... },
  "message": "Ride requested. Searching for drivers..."
}
```

---

### GET /rides/{rideId}
Get full ride details. Only accessible by rider or assigned driver.

---

### POST /rides/{rideId}/cancel
**Body:** `{ "reason": "Plans changed" }`

---

### POST /rides/{rideId}/status
Driver-only. Progress the ride state.

**Body:** `{ "status": "enroute" | "arrived" | "in_progress" }`

**Valid transitions:**
```
matched → confirmed → enroute → arrived → in_progress
```

---

### POST /rides/{rideId}/complete
Driver-only. Marks ride completed and computes CO2 savings.

**Response 200:**
```json
{ "ride_id": "uuid", "status": "completed", "co2_saved_kg": 2.145 }
```

---

### POST /rides/{rideId}/rate
**Body:** `{ "score": 5, "comment": "Great driver!" }`

Score must be 1-5. Can only rate completed rides. One rating per user per ride.

---

## Sustainability

### GET /sustainability/summary
Returns aggregated CO2 stats for the authenticated user.

```json
{
  "total_rides": 5,
  "total_km": 71.5,
  "total_co2_saved_kg": 10.725,
  "equivalent_trees_hours": 510.7,
  "equivalent_km_not_driven": 51.1,
  "weekly_trend": [
    { "week": "2024-02-12T00:00:00", "rides": 2, "co2_saved_kg": 4.29 }
  ]
}
```

### GET /sustainability/rides
Returns per-ride CO2 breakdown (last 50).

---

## Payments

### POST /payments/create-intent
Creates Stripe PaymentIntent for a matched ride.

**Body:** `{ "ride_id": "uuid" }`

**Response 200:**
```json
{
  "client_secret": "pi_xxx_secret_xxx",
  "payment_intent_id": "pi_xxx",
  "amount_aud": 23.45
}
```

In dev mode (no Stripe key): returns fake intent with `"dev_mode": true`.

### GET /payments/status/{rideId}
Returns payment status for a ride.

### POST /payments/webhook
Stripe webhook endpoint. Configured in Stripe dashboard.

---

## WebSocket Events

Connect to: `ws://localhost:8000/socket.io/?token=<access_token>`

### Events to emit (client → server):
| Event | Payload | Description |
|-------|---------|-------------|
| `join_ride_room` | `{ ride_id }` | Subscribe to ride updates |
| `join_driver_room` | `{}` | Register to receive ride requests |
| `ride_accept` | `{ ride_id }` | Driver accepts a request |
| `ride_decline` | `{ ride_id }` | Driver declines |
| `driver_location` | `{ lat, lng, ride_id? }` | Driver location update |

### Events to listen for (server → client):
| Event | Payload | Description |
|-------|---------|-------------|
| `ride_request` | `{ ride_id, pickup_lat, pickup_lng, timeout_seconds }` | New request for driver |
| `ride_status_update` | `{ ride_id, status, driver_id? }` | Ride status changed |
| `location_update` | `{ ride_id, driver_id, lat, lng }` | Driver moved |
| `ride_cancel` | `{ ride_id, reason, cancelled_by }` | Ride was cancelled |

---

## Error Responses

All errors follow this format:
```json
{ "error": "error_code", "message": "Human-readable description" }
```

| HTTP Status | Error Code | Meaning |
|-------------|-----------|---------|
| 400 | `validation` | Missing or invalid input |
| 400 | `invalid_email` | Non-Monash email used |
| 401 | `unauthorized` | Missing/invalid JWT |
| 401 | `token_expired` | JWT has expired |
| 401 | `invalid_credentials` | Wrong email/password |
| 403 | `forbidden` | Authenticated but not authorised |
| 403 | `unverified` | Email not verified |
| 404 | `not_found` | Resource doesn't exist |
| 409 | `conflict` | Duplicate resource |
| 409 | `invalid_state` | Ride in wrong state |
| 429 | `rate_limited` | Too many requests |
| 502 | `stripe_error` | Stripe API failure |
| 503 | `service_unavailable` | Backend down |
