# Mo-Ride — Monash Green Ride Sharing App

> A ride-sharing platform exclusively for Monash University students and staff.
> Built with Python Flask microservices, React Native (Expo), and Docker.

---

## Quick Start

### Prerequisites

| Tool | Version |
|------|---------|
| Docker Desktop | 24+ |
| Node.js | 20+ |
| Python | 3.11+ |
| Expo Go (mobile) | latest |

### 1. Clone & configure

```bash
git clone <repo-url>
cd eRide-Green-Sharing-App-
make setup-env        # copies infra/.env.example → infra/.env
```

Edit `infra/.env` and fill in any secrets (Stripe, Google Maps). For local dev the defaults work out of the box.

### 2. Start all services

```bash
make dev
```

This builds and starts:
- PostgreSQL 15 (port 5432)
- Redis 7 (port 6379)
- MinIO (port 9000 / 9001)
- Mailhog (port 1025 / 8025)
- Auth Service (port 5001)
- Ride Matching Service (port 5002)
- Location Tracking Service (port 5003)
- Payments Service (port 5004)
- API Gateway / nginx (port 8000)

### 3. Seed the database

```bash
make seed
```

Creates 5 test accounts (password: `Password123!`):

| Email | Role |
|-------|------|
| `alice.driver@monash.edu` | driver |
| `bob.driver@monash.edu` | driver |
| `carol.rider@monash.edu` | rider |
| `dan.both@monash.edu` | rider + driver |
| `eve.admin@monash.edu` | admin |

### 4. Start the mobile app

```bash
cd apps/mobile
npm install
npx expo start
```

Scan the QR code with **Expo Go** on your phone, or press `i` (iOS Simulator) / `a` (Android Emulator).

---

## Service URLs

| Service | URL |
|---------|-----|
| API Gateway | http://localhost:8000 |
| Auth Service | http://localhost:5001 |
| Ride Matching | http://localhost:5002 |
| Location Tracking | http://localhost:5003 |
| Payments | http://localhost:5004 |
| Mailhog (email UI) | http://localhost:8025 |
| MinIO Console | http://localhost:9001 |

---

## Development Commands

```bash
make dev          # Start all Docker services
make down         # Stop all services
make test         # Run pytest test suite
make seed         # Seed database with test data
make clean        # Stop services + remove volumes
make setup-env    # Create infra/.env from template
make logs         # Tail logs from all services
```

---

## Architecture

```
┌─────────────────────────────────────────────┐
│              React Native App               │
│          (Expo / expo-router / TS)          │
└─────────────────┬───────────────────────────┘
                  │ HTTP + WebSocket
┌─────────────────▼───────────────────────────┐
│           API Gateway (nginx)               │
│              localhost:8000                 │
└──┬──────────────┬──────────────┬────────────┘
   │              │              │
   ▼              ▼              ▼
Auth :5001   Matching :5002  Payments :5004
   │              │
   └──────────────┴──► PostgreSQL + Redis
```

Full architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

---

## API Reference

See [docs/API.md](docs/API.md) for the complete REST API documentation.

Import [docs/Mo-Ride.postman_collection.json](docs/Mo-Ride.postman_collection.json) into Postman for a ready-to-run collection.

---

## Testing

```bash
make test
# or directly:
cd services/ride-matching
python -m pytest tests/ -v
```

Tests cover:
- Fare calculation algorithm (base fare, surge, peak hours)
- Driver matching scoring and ranking
- CO₂ sustainability calculation
- Redis driver discovery (mocked)
- MatchingSession accept/decline/timeout

---

## Key Features

- **Monash-only access** — `@monash.edu` email domain enforcement
- **OTP email verification** — 6-digit code via Mailhog (dev) or SES (prod)
- **Real-time ride matching** — Redis GEO queries + Socket.IO events
- **Driver scoring** — distance × rating × availability
- **Surge pricing** — demand-based fare multiplier
- **CO₂ sustainability tracking** — per-ride emissions savings dashboard
- **Stripe payments** — manual capture (authorize on match, capture on completion)
- **JWT auth** — access + refresh token rotation, bcrypt passwords

---

## Environment Variables

See [infra/.env.example](infra/.env.example) for all configuration options with inline documentation.

---

## Project Structure

```
eRide-Green-Sharing-App-/
├── apps/
│   └── mobile/               # React Native (Expo) app
├── services/
│   ├── api-gateway/          # nginx reverse proxy
│   ├── auth/                 # Flask auth microservice
│   ├── ride-matching/        # Flask matching + fare + sustainability
│   ├── location-tracking/    # Flask Socket.IO location service
│   └── payments/             # Flask Stripe payments service
├── packages/
│   └── shared/               # TypeScript types + API client
├── infra/
│   ├── docker-compose.yml
│   ├── .env.example
│   └── migrations/           # SQL migration files
└── docs/
    ├── SETUP.md
    ├── API.md
    ├── ARCHITECTURE.md
    └── Mo-Ride.postman_collection.json
```

---

## Setup Guide

For detailed setup instructions including production deployment notes, see [docs/SETUP.md](docs/SETUP.md).

## To run the project:

# 1. Configure environment
make setup-env     # creates infra/.env from template

# 2. Start all backend services
make dev

# 3. Seed test data
make seed

# 4. Start mobile app
cd apps/mobile
npm install
npx expo start
Test login: carol.rider@monash.edu / Password123!