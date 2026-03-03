-- ============================================================
-- Mo-Ride Database Schema — Migration 001: Initial Schema
-- Compatible with: PostgreSQL 15+ / Supabase
-- Run order: this file must be run first.
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- Enable pg_trgm for future text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ─── ENUMS ──────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM ('rider', 'driver', 'both', 'admin');

CREATE TYPE ride_status AS ENUM (
    'requested',
    'matching',
    'matched',
    'confirmed',
    'enroute',       -- driver heading to pickup
    'arrived',       -- driver at pickup location
    'in_progress',   -- ride underway
    'completed',
    'cancelled'
);

CREATE TYPE ride_event_type AS ENUM (
    'requested',
    'matching_started',
    'driver_assigned',
    'driver_accepted',
    'driver_declined',
    'driver_arrived',
    'ride_started',
    'ride_completed',
    'ride_cancelled',
    'payment_created',
    'payment_captured',
    'rated'
);

CREATE TYPE payment_status AS ENUM (
    'pending',
    'requires_capture',
    'captured',
    'cancelled',
    'failed',
    'refunded'
);

-- ─── USERS ──────────────────────────────────────────────────

CREATE TABLE users (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email               VARCHAR(255) NOT NULL UNIQUE,
    password_hash       VARCHAR(255) NOT NULL,
    name                VARCHAR(100) NOT NULL,
    phone               VARCHAR(20),
    role                user_role NOT NULL DEFAULT 'rider',
    is_verified         BOOLEAN NOT NULL DEFAULT FALSE,
    otp_code            VARCHAR(6),
    otp_expires_at      TIMESTAMPTZ,
    profile_photo_url   TEXT,
    rating_avg_driver   NUMERIC(3,2) DEFAULT 5.00,
    rating_count_driver INTEGER NOT NULL DEFAULT 0,
    rating_avg_rider    NUMERIC(3,2) DEFAULT 5.00,
    rating_count_rider  INTEGER NOT NULL DEFAULT 0,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    refresh_token_hash  TEXT,
    last_login_at       TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- ─── DRIVER PROFILES ────────────────────────────────────────

CREATE TABLE driver_profiles (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    car_make        VARCHAR(50),
    car_model       VARCHAR(50),
    car_year        SMALLINT,
    car_color       VARCHAR(30),
    car_plate       VARCHAR(20),
    is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
    is_online       BOOLEAN NOT NULL DEFAULT FALSE,
    last_online_at  TIMESTAMPTZ,
    license_doc_url TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_driver_profiles_user_id ON driver_profiles(user_id);
CREATE INDEX idx_driver_profiles_is_online ON driver_profiles(is_online);

-- ─── RIDES ──────────────────────────────────────────────────

CREATE TABLE rides (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rider_id            UUID NOT NULL REFERENCES users(id),
    driver_id           UUID REFERENCES users(id),           -- null until matched
    pickup_lat          DOUBLE PRECISION NOT NULL,
    pickup_lng          DOUBLE PRECISION NOT NULL,
    pickup_address      TEXT,
    dropoff_lat         DOUBLE PRECISION NOT NULL,
    dropoff_lng         DOUBLE PRECISION NOT NULL,
    dropoff_address     TEXT,
    pickup_time         TIMESTAMPTZ NOT NULL DEFAULT NOW(),   -- scheduled or immediate
    status              ride_status NOT NULL DEFAULT 'requested',
    distance_km         NUMERIC(8,3),
    eta_minutes         INTEGER,
    fare_estimated      NUMERIC(8,2),
    fare_final          NUMERIC(8,2),
    cancel_reason       TEXT,
    cancelled_by        UUID REFERENCES users(id),
    passenger_count     SMALLINT NOT NULL DEFAULT 1,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rides_rider_id ON rides(rider_id);
CREATE INDEX idx_rides_driver_id ON rides(driver_id);
CREATE INDEX idx_rides_status ON rides(status);
CREATE INDEX idx_rides_pickup_time ON rides(pickup_time);
CREATE INDEX idx_rides_created_at ON rides(created_at DESC);

-- ─── RIDE EVENTS (Audit Trail) ──────────────────────────────

CREATE TABLE ride_events (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ride_id         UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
    type            ride_event_type NOT NULL,
    actor_id        UUID REFERENCES users(id),              -- who triggered this event
    payload         JSONB,                                   -- extra context
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ride_events_ride_id ON ride_events(ride_id);
CREATE INDEX idx_ride_events_type ON ride_events(type);
CREATE INDEX idx_ride_events_created_at ON ride_events(created_at DESC);

-- ─── RATINGS ────────────────────────────────────────────────

CREATE TABLE ratings (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ride_id         UUID NOT NULL REFERENCES rides(id),
    from_user_id    UUID NOT NULL REFERENCES users(id),
    to_user_id      UUID NOT NULL REFERENCES users(id),
    score           SMALLINT NOT NULL CHECK (score >= 1 AND score <= 5),
    comment         TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (ride_id, from_user_id)   -- one rating per ride per user
);

CREATE INDEX idx_ratings_ride_id ON ratings(ride_id);
CREATE INDEX idx_ratings_to_user_id ON ratings(to_user_id);

-- ─── PAYMENTS ───────────────────────────────────────────────

CREATE TABLE payments (
    id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ride_id                     UUID NOT NULL UNIQUE REFERENCES rides(id),
    stripe_payment_intent_id    VARCHAR(255) UNIQUE,
    stripe_client_secret        TEXT,
    amount_estimated            NUMERIC(8,2) NOT NULL,
    amount_final                NUMERIC(8,2),
    currency                    CHAR(3) NOT NULL DEFAULT 'aud',
    status                      payment_status NOT NULL DEFAULT 'pending',
    failure_reason              TEXT,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_ride_id ON payments(ride_id);
CREATE INDEX idx_payments_stripe_intent ON payments(stripe_payment_intent_id);

-- ─── SUSTAINABILITY ──────────────────────────────────────────

CREATE TABLE sustainability (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ride_id             UUID NOT NULL UNIQUE REFERENCES rides(id),
    distance_km         NUMERIC(8,3) NOT NULL,
    passengers          SMALLINT NOT NULL DEFAULT 1,
    -- CO2 baseline: what passengers would have emitted in separate cars
    baseline_co2_kg     NUMERIC(8,4) NOT NULL,
    -- CO2 actual: what the shared ride emitted (split per passenger)
    actual_co2_kg       NUMERIC(8,4) NOT NULL,
    -- CO2 saved = baseline - actual
    co2_saved_kg        NUMERIC(8,4) NOT NULL,
    co2_per_km_used     NUMERIC(6,4) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sustainability_ride_id ON sustainability(ride_id);
CREATE INDEX idx_sustainability_created_at ON sustainability(created_at DESC);

-- ─── QUEUED REQUESTS (retry queue for unmatched rides) ──────

CREATE TABLE queued_requests (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rider_id        UUID NOT NULL REFERENCES users(id),
    ride_id         UUID REFERENCES rides(id),
    payload         JSONB NOT NULL,
    attempts        INTEGER NOT NULL DEFAULT 0,
    max_attempts    INTEGER NOT NULL DEFAULT 5,
    next_retry_at   TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 seconds',
    last_error      TEXT,
    is_processed    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_queued_requests_next_retry ON queued_requests(next_retry_at)
    WHERE is_processed = FALSE;
CREATE INDEX idx_queued_requests_rider_id ON queued_requests(rider_id);

-- ─── AUTOMATIC updated_at TRIGGER ───────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_driver_profiles_updated_at
    BEFORE UPDATE ON driver_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rides_updated_at
    BEFORE UPDATE ON rides
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── HELPER: Update driver rating average ───────────────────

CREATE OR REPLACE FUNCTION recalculate_driver_rating(target_user_id UUID)
RETURNS VOID AS $$
DECLARE
    avg_score   NUMERIC(3,2);
    total_count INTEGER;
BEGIN
    SELECT
        ROUND(AVG(score)::NUMERIC, 2),
        COUNT(*)
    INTO avg_score, total_count
    FROM ratings r
    JOIN rides ri ON ri.id = r.ride_id
    WHERE r.to_user_id = target_user_id
      AND ri.driver_id = target_user_id;

    UPDATE users
    SET rating_avg_driver = COALESCE(avg_score, 5.00),
        rating_count_driver = total_count
    WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION recalculate_rider_rating(target_user_id UUID)
RETURNS VOID AS $$
DECLARE
    avg_score   NUMERIC(3,2);
    total_count INTEGER;
BEGIN
    SELECT
        ROUND(AVG(score)::NUMERIC, 2),
        COUNT(*)
    INTO avg_score, total_count
    FROM ratings r
    JOIN rides ri ON ri.id = r.ride_id
    WHERE r.to_user_id = target_user_id
      AND ri.rider_id = target_user_id;

    UPDATE users
    SET rating_avg_rider = COALESCE(avg_score, 5.00),
        rating_count_rider = total_count
    WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger: recalculate ratings after insert
CREATE OR REPLACE FUNCTION after_rating_insert()
RETURNS TRIGGER AS $$
DECLARE
    ride_record RECORD;
BEGIN
    SELECT rider_id, driver_id INTO ride_record
    FROM rides WHERE id = NEW.ride_id;

    IF NEW.to_user_id = ride_record.driver_id THEN
        PERFORM recalculate_driver_rating(NEW.to_user_id);
    ELSE
        PERFORM recalculate_rider_rating(NEW.to_user_id);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_after_rating_insert
    AFTER INSERT ON ratings
    FOR EACH ROW EXECUTE FUNCTION after_rating_insert();

-- Done.
SELECT 'Schema migration 001 complete.' AS status;
