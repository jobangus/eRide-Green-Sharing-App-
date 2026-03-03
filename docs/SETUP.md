# Mo-Ride — Local Development Setup

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Docker | ≥ 24 | Required for all backend services |
| Docker Compose | ≥ 2.20 | Bundled with Docker Desktop |
| Node.js | ≥ 18 | For mobile app only |
| npm | ≥ 9 | For mobile app only |
| iOS Simulator | Xcode ≥ 15 | macOS only |
| Android Emulator | Android Studio | Optional |

---

## 1. Clone & Configure

```bash
git clone <repo-url> eRide-Green-Sharing-App-
cd eRide-Green-Sharing-App-

# Copy environment template
make setup-env
# → Creates .env from infra/.env.example
```

Open `.env` and configure at minimum:
- `JWT_SECRET` — generate with `openssl rand -hex 32`
- `STRIPE_SECRET_KEY` — get from https://dashboard.stripe.com/test/apikeys (use test keys)
- `GOOGLE_MAPS_API_KEY` — optional; leave blank to use fallback distance calculation

---

## 2. Start All Backend Services

```bash
make dev
# Equivalent: docker compose -f infra/docker-compose.yml --env-file .env up --build
```

This starts:
| Service | URL | Description |
|---------|-----|-------------|
| API Gateway (nginx) | http://localhost:8000 | Single entry point |
| Auth Service | http://localhost:5001 | JWT, OTP, user management |
| Ride Matching | http://localhost:5002 | Matching, fare, sustainability |
| Location Tracking | http://localhost:5003 | Real-time driver location |
| Payments | http://localhost:5004 | Stripe integration |
| PostgreSQL | localhost:5432 | Database (auto-migrated) |
| Redis | localhost:6379 | GEO cache + sessions |
| MinIO | http://localhost:9001 | S3 dashboard (file storage) |
| Mailhog | http://localhost:8025 | Dev email UI (view OTPs!) |

**Database migrations run automatically** on first postgres startup (files in `infra/migrations/`).

---

## 3. Verify Services are Running

```bash
curl http://localhost:8000/health
# {"status":"ok","service":"api-gateway"}

curl http://localhost:5001/health
# {"status":"ok","service":"auth"}
```

---

## 4. Load Seed Data

```bash
make seed
```

This creates 5 test users (password for all: `Password123!`):

| Email | Role |
|-------|------|
| alice.driver@monash.edu | Driver |
| bob.driver@monash.edu | Driver |
| carol.rider@monash.edu | Rider |
| dave.rider@monash.edu | Rider |
| eve.both@monash.edu | Both |

---

## 5. Run Backend Tests

```bash
make test
```

Or run locally (without Docker):
```bash
cd services/ride-matching
pip install -r requirements.txt
pytest tests/ -v
```

---

## 6. Start the Mobile App

```bash
cd apps/mobile
npm install
npx expo start
```

**iOS Simulator** (macOS only):
```bash
npx expo run:ios
```

**Android Emulator**:
```bash
npx expo run:android
```

**Physical Device**: Install [Expo Go](https://expo.dev/client) app and scan the QR code from `npx expo start`.

### Configure API URL

Edit `apps/mobile/app.json`:
```json
{
  "expo": {
    "extra": {
      "API_BASE_URL": "http://YOUR_MACHINE_IP:8000"
    }
  }
}
```
> ⚠️ For physical devices, replace `localhost` with your Mac's local IP address (e.g. `192.168.1.x`).

---

## 7. End-to-End Test Flow

### Rider Side (use carol.rider@monash.edu)
1. Log in → Home tab
2. Go to **Ride** tab
3. Select Pickup: Clayton Campus
4. Select Dropoff: Caulfield Campus
5. Tap "Get Fare Estimate"
6. Tap "Request Ride"
7. Wait for matching...

### Driver Side (use alice.driver@monash.edu — second device or browser)
1. Log in → **Drive** tab
2. Tap "Go Online" (grant location permission)
3. Receive the ride request notification (30s timer)
4. Tap "Accept"
5. Progress: Enroute → Arrived → In Progress → Complete
6. Rate the rider

---

## 8. View Dev Email (OTPs)

Open http://localhost:8025 in your browser. All emails sent by the auth service appear here (Mailhog).

In **development mode**, the OTP is also returned in the registration API response and auto-filled in the verify-otp screen.

---

## 9. MinIO (File Storage)

Open http://localhost:9001
- Username: `minio_access_key`
- Password: `minio_secret_key`

Profile photos and documents are stored here.

---

## 10. Stop Everything

```bash
make down
```

**Destructive reset** (deletes all data):
```bash
make clean
```

---

## AWS Deployment Notes (Optional)

For production deployment on AWS:

1. **Database**: Use Supabase (free tier) or AWS RDS PostgreSQL. Update `DATABASE_URL` in each service.
2. **Redis**: AWS ElastiCache (Redis mode). Update `REDIS_URL`.
3. **S3**: Replace MinIO with real AWS S3. Update `MINIO_*` variables with AWS credentials.
4. **Email**: Replace Mailhog SMTP with AWS SES or SendGrid. Update `SMTP_*` variables.
5. **Services**: Deploy each Flask service as a Docker container on AWS ECS/EC2.
6. **API Gateway**: Replace nginx with AWS API Gateway (HTTP APIs) pointing to each service's ALB.
7. **Secrets**: Use AWS Secrets Manager or Parameter Store instead of .env files.
8. **SQS** (for retry queue): Implement the `SQS_QUEUE_URL` adapter in `services/ride-matching/app/routes/rides.py`.

Minimum AWS setup:
```
Route 53 → CloudFront/ALB → API Gateway → ECS Services → RDS + ElastiCache + S3
```
