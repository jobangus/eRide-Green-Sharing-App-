# Mo-Ride System Architecture

## Overview

Mo-Ride uses a microservices architecture with a lightweight nginx reverse proxy acting as an API gateway. All services communicate over an internal Docker network.

```
Mobile App (React Native / Expo)
         │
         │ HTTP + WebSocket
         ▼
┌─────────────────────────────────┐
│      API Gateway (nginx :8000)   │
│  Rate limiting · Routing · CORS  │
└────┬───────┬────────┬──────┬────┘
     │       │        │      │
     ▼       ▼        ▼      ▼
 Auth    Ride      Location  Payments
:5001   Matching  Tracking   :5004
        :5002      :5003
     │       │        │
     └───────┴────────┘
             │
    ┌────────┴────────┐
    │                 │
    ▼                 ▼
PostgreSQL          Redis
 (Supabase)      GEO + Cache
  :5432           :6379
```

## Services

### API Gateway (nginx)
- Reverse proxy routing to microservices
- Rate limiting: 10 req/min for auth, 60 req/min for API
- WebSocket upgrade handling
- JSON error pages
- No auth — handled by each service

### Auth Service (Flask)
- User registration with `@monash.edu` domain validation
- OTP email verification via SMTP (Mailhog in dev, SES in prod)
- JWT tokens: access (60 min) + refresh (30 days) with rotation
- Refresh tokens hashed (SHA-256) before storage — never stored plain
- Profile management
- Password: bcrypt hashed with salt rounds=12
- File uploads → MinIO (S3-compatible)

### Ride Matching Service (Flask + Socket.IO)
- Core business logic
- Fare calculation algorithm (distance + demand surge + peak hours)
- Driver matching via Redis GEOSEARCH
- WebSocket rooms: `driver_{id}`, `ride_{id}`
- Async matching loop in background thread
- Retry queue via `queued_requests` DB table
- CO2 sustainability computation
- Driver presence management

### Location Tracking Service (Flask + Socket.IO)
- Lightweight WebSocket relay for real-time GPS during active rides
- Caches last known position in Redis (`ride_location:{ride_id}`)
- Sends cached position to new subscribers immediately

### Payments Service (Flask + Stripe)
- Stripe PaymentIntent with manual capture
- Authorize on match → capture on completion → adjustable amount
- Webhook endpoint for payment events
- Dev mode: returns fake intent when no Stripe key configured

## Data Architecture

### PostgreSQL (Supabase-compatible)
```
users                     # Authentication + profiles + ratings
  └── driver_profiles     # Vehicle + availability info
rides                     # Core ride records (lifecycle)
  └── ride_events         # Immutable audit trail (FSM log)
  └── ratings             # Post-ride reviews (1-5)
  └── payments            # Stripe payment records
  └── sustainability      # CO2 calculations per completed ride
queued_requests           # Retry queue for unmatched rides
```

### Redis
```
driver_locations          # ZSET (sorted set) — GEO index for GEOSEARCH
driver_meta:{id}          # HASH — rating, is_available, is_online
stats:active_requests     # INT — for demand ratio calculation
ride_location:{ride_id}   # HASH — last known driver location during ride
```

## Algorithms

### Ride Matching
```
score = (1 / distance_km) * driver_rating * availability_weight
```
1. GEOSEARCH Redis for drivers within radius
2. Score each driver
3. Sort descending by score
4. Emit WebSocket request to top driver
5. Wait DRIVER_ACCEPT_TIMEOUT_SECONDS (default: 30)
6. On accept: assign in DB, notify rider
7. On decline/timeout: try next driver
8. If exhausted: insert into `queued_requests` for retry

### Fare Calculation
```
base_fare      = BASE_RATE + distance_km * RATE_PER_KM
demand_ratio   = active_requests / max(available_drivers, 1)
surge          = 1.0 + (demand_ratio - 2.0) * 0.5  if demand_ratio > 2.0 else 1.0
time_mult      = PEAK_MULTIPLIER  if current_time in peak hours  else 1.0
final_fare     = base_fare * surge * time_mult
```

Defaults (configurable via env):
- BASE_RATE = $2.00
- RATE_PER_KM = $1.50
- PEAK_MULTIPLIER = 1.2
- Peak hours: 07:00-09:00 and 16:00-19:00 (Melbourne local)

### CO2 Savings
```
baseline = distance_km * CO2_PER_KM_PETROL * (passengers + 1)  # all drive separately
actual   = distance_km * CO2_PER_KM_PETROL                      # one shared car
saved    = baseline - actual
```
- CO2_PER_KM_PETROL = 0.21 kg/km (average ICE car)
- Displayed as kg CO₂, tree-hours equivalent

## Security Model
- All tokens: JWT HS256 with configurable secret
- Passwords: bcrypt rounds=12
- Refresh tokens: SHA-256 hashed in DB (never stored plain)
- Domain enforcement: `@monash.edu` enforced at registration
- RLS policies on Supabase: users can only access their own data
- Rate limiting: nginx layer + per-service validation
- CORS: configurable allowed origins
- No secrets in code or Docker images — all via environment variables

## Mobile App Architecture
```
apps/mobile/
  app/              # expo-router file-based routing
    (auth)/         # unauthenticated screens
    (tabs)/         # main app tabs (post-login)
  src/
    store/auth.ts   # React context + SecureStore token persistence
    hooks/          # useSocketIO (WebSocket)
    components/ui/  # Button, Input, etc.
    constants/      # config, colors, map defaults
```

Token storage: `expo-secure-store` → iOS Keychain / Android Keystore
