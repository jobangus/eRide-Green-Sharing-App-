-- ============================================================
-- Mo-Ride — Migration 003: Seed Data for Development
-- WARNING: DO NOT run in production.
-- Passwords are bcrypt hashes of "Password123!"
-- ============================================================

-- Seed Users (2 riders, 2 drivers, 1 both)
INSERT INTO users (id, email, password_hash, name, phone, role, is_verified)
VALUES
    -- Driver 1: Alice
    ('11111111-1111-1111-1111-111111111111',
     'alice.driver@monash.edu',
     '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMaJqETdFvNjO3BvWyG4rMR6da',
     'Alice Chen', '+61400000001', 'driver', TRUE),

    -- Driver 2: Bob
    ('22222222-2222-2222-2222-222222222222',
     'bob.driver@monash.edu',
     '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMaJqETdFvNjO3BvWyG4rMR6da',
     'Bob Smith', '+61400000002', 'driver', TRUE),

    -- Rider 1: Carol
    ('33333333-3333-3333-3333-333333333333',
     'carol.rider@monash.edu',
     '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMaJqETdFvNjO3BvWyG4rMR6da',
     'Carol Johnson', '+61400000003', 'rider', TRUE),

    -- Rider 2: Dave
    ('44444444-4444-4444-4444-444444444444',
     'dave.rider@monash.edu',
     '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMaJqETdFvNjO3BvWyG4rMR6da',
     'Dave Wilson', '+61400000004', 'rider', TRUE),

    -- Both (can drive and ride): Eve
    ('55555555-5555-5555-5555-555555555555',
     'eve.both@monash.edu',
     '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMaJqETdFvNjO3BvWyG4rMR6da',
     'Eve Martinez', '+61400000005', 'both', TRUE)
ON CONFLICT (email) DO NOTHING;

-- Seed Driver Profiles
INSERT INTO driver_profiles (user_id, car_make, car_model, car_year, car_color, car_plate, is_verified, is_online)
VALUES
    ('11111111-1111-1111-1111-111111111111', 'Toyota', 'Camry', 2021, 'White', 'ABC123', TRUE, FALSE),
    ('22222222-2222-2222-2222-222222222222', 'Honda',  'Civic', 2022, 'Silver', 'DEF456', TRUE, FALSE),
    ('55555555-5555-5555-5555-555555555555', 'Mazda',  'CX-5', 2020, 'Red',    'GHI789', TRUE, FALSE)
ON CONFLICT (user_id) DO NOTHING;

-- Seed a completed ride (for sustainability dashboard demo)
INSERT INTO rides (
    id, rider_id, driver_id,
    pickup_lat, pickup_lng, pickup_address,
    dropoff_lat, dropoff_lng, dropoff_address,
    pickup_time, status, distance_km, eta_minutes,
    fare_estimated, fare_final
) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    '33333333-3333-3333-3333-333333333333',  -- Carol
    '11111111-1111-1111-1111-111111111111',  -- Alice
    -37.9105, 145.1362,  -- Monash Clayton
    'Monash University Clayton Campus, Wellington Rd, Clayton VIC 3168',
    -37.8777, 145.0452,  -- Monash Caulfield
    'Monash University Caulfield Campus, 900 Dandenong Rd, Caulfield East VIC 3145',
    NOW() - INTERVAL '2 days',
    'completed',
    14.3, 25,
    23.45, 23.45
) ON CONFLICT (id) DO NOTHING;

-- Seed sustainability for the completed ride
INSERT INTO sustainability (
    ride_id, distance_km, passengers,
    baseline_co2_kg, actual_co2_kg, co2_saved_kg, co2_per_km_used
) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    14.3, 1,
    ROUND((14.3 * 0.21 * 2)::NUMERIC, 4),  -- 2 people would have driven separately
    ROUND((14.3 * 0.09)::NUMERIC, 4),       -- shared ride CO2
    ROUND((14.3 * 0.21 * 2 - 14.3 * 0.09)::NUMERIC, 4),
    0.09
) ON CONFLICT (ride_id) DO NOTHING;

-- Seed a rating for the completed ride
INSERT INTO ratings (ride_id, from_user_id, to_user_id, score, comment)
VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
     '33333333-3333-3333-3333-333333333333',  -- Carol rates Alice
     '11111111-1111-1111-1111-111111111111',
     5, 'Great driver, very punctual!')
ON CONFLICT (ride_id, from_user_id) DO NOTHING;

-- Seed a payment for the completed ride
INSERT INTO payments (
    ride_id, stripe_payment_intent_id,
    amount_estimated, amount_final, currency, status
) VALUES (
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'pi_seed_test_intent_001',
    23.45, 23.45, 'aud', 'captured'
) ON CONFLICT (ride_id) DO NOTHING;

SELECT 'Seed data 003 inserted successfully.' AS status;
