-- ============================================================
-- Mo-Ride — Migration 005: Demo ride data with real vehicle CO2
-- Requires 003_seed.sql and import_vehicles to be run first.
-- Run: make seed-demo
-- ============================================================

-- Link drivers to vehicles from the vehicles table
UPDATE driver_profiles SET vehicle_id = '05f083c8-46cd-4038-869f-80e31554b980'
WHERE user_id = '11111111-1111-1111-1111-111111111111'; -- Alice → Tesla Model 3 (Pure Electric, 0 g/km)

UPDATE driver_profiles SET vehicle_id = 'fe2cc7ee-3353-4bdf-b8ee-77a6646c79a4'
WHERE user_id = '22222222-2222-2222-2222-222222222222'; -- Bob → Cupra Leon (Petrol 95RON, 40 g/km)

UPDATE driver_profiles SET vehicle_id = '1cd0718d-e1ae-4a6b-afa0-b0bea8fec904'
WHERE user_id = '55555555-5555-5555-5555-555555555555'; -- Eve → Cupra Formentor (Electric/Petrol 95RON, 43 g/km)

-- ── Ride 1: Carol rides with Alice (Tesla, pure electric) ──────────────────
INSERT INTO rides (
    id, rider_id, driver_id,
    pickup_lat, pickup_lng, pickup_address,
    dropoff_lat, dropoff_lng, dropoff_address,
    pickup_time, status, distance_km, eta_minutes,
    fare_estimated, fare_final, passenger_count
) VALUES (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '33333333-3333-3333-3333-333333333333', -- Carol
    '11111111-1111-1111-1111-111111111111', -- Alice (Tesla)
    -37.9105, 145.1362, 'Monash University Clayton Campus',
    -37.8136, 144.9631, 'Flinders Street Station, Melbourne',
    NOW() - INTERVAL '5 days', 'completed', 20.4, 35,
    28.60, 28.60, 1
) ON CONFLICT (id) DO NOTHING;

-- Electric: actual CO2 = 20.4 * 0.000 = 0 kg, baseline = 20.4 * 0.21 * 2 = 8.568 kg
INSERT INTO sustainability (
    ride_id, distance_km, passengers,
    baseline_co2_kg, actual_co2_kg, co2_saved_kg, co2_per_km_used
) VALUES (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    20.4, 1,
    ROUND((20.4 * 0.21 * 2)::NUMERIC, 4),
    0.0,
    ROUND((20.4 * 0.21 * 2)::NUMERIC, 4),
    0.0
) ON CONFLICT (ride_id) DO NOTHING;

-- ── Ride 2: Dave rides with Bob (Cupra Leon, Petrol 95RON, 40 g/km) ────────
INSERT INTO rides (
    id, rider_id, driver_id,
    pickup_lat, pickup_lng, pickup_address,
    dropoff_lat, dropoff_lng, dropoff_address,
    pickup_time, status, distance_km, eta_minutes,
    fare_estimated, fare_final, passenger_count
) VALUES (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    '44444444-4444-4444-4444-444444444444', -- Dave
    '22222222-2222-2222-2222-222222222222', -- Bob (Cupra Leon)
    -37.8777, 145.0452, 'Monash University Caulfield Campus',
    -37.9105, 145.1362, 'Monash University Clayton Campus',
    NOW() - INTERVAL '3 days', 'completed', 14.3, 25,
    23.45, 23.45, 1
) ON CONFLICT (id) DO NOTHING;

-- Petrol 95RON: actual CO2 = 14.3 * 0.040 = 0.572 kg, baseline = 14.3 * 0.21 * 2 = 6.006 kg
INSERT INTO sustainability (
    ride_id, distance_km, passengers,
    baseline_co2_kg, actual_co2_kg, co2_saved_kg, co2_per_km_used
) VALUES (
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    14.3, 1,
    ROUND((14.3 * 0.21 * 2)::NUMERIC, 4),
    ROUND((14.3 * 0.040)::NUMERIC, 4),
    ROUND((14.3 * 0.21 * 2 - 14.3 * 0.040)::NUMERIC, 4),
    0.040
) ON CONFLICT (ride_id) DO NOTHING;

-- ── Ride 3: Carol + Dave ride with Eve (Cupra Formentor, Hybrid, 43 g/km) ──
INSERT INTO rides (
    id, rider_id, driver_id,
    pickup_lat, pickup_lng, pickup_address,
    dropoff_lat, dropoff_lng, dropoff_address,
    pickup_time, status, distance_km, eta_minutes,
    fare_estimated, fare_final, passenger_count
) VALUES (
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    '33333333-3333-3333-3333-333333333333', -- Carol
    '55555555-5555-5555-5555-555555555555', -- Eve (Formentor)
    -37.9105, 145.1362, 'Monash University Clayton Campus',
    -37.8777, 145.0452, 'Monash University Caulfield Campus',
    NOW() - INTERVAL '1 day', 'completed', 14.3, 25,
    23.45, 23.45, 2
) ON CONFLICT (id) DO NOTHING;

-- Hybrid: actual CO2 = 14.3 * 0.043 = 0.6149 kg, baseline = 14.3 * 0.21 * 3 = 9.009 kg (3 people)
INSERT INTO sustainability (
    ride_id, distance_km, passengers,
    baseline_co2_kg, actual_co2_kg, co2_saved_kg, co2_per_km_used
) VALUES (
    'dddddddd-dddd-dddd-dddd-dddddddddddd',
    14.3, 2,
    ROUND((14.3 * 0.21 * 3)::NUMERIC, 4),
    ROUND((14.3 * 0.043)::NUMERIC, 4),
    ROUND((14.3 * 0.21 * 3 - 14.3 * 0.043)::NUMERIC, 4),
    0.043
) ON CONFLICT (ride_id) DO NOTHING;

SELECT 'Demo ride data 005 inserted successfully.' AS status;
