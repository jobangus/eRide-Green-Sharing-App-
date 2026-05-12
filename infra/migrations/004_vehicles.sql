-- ============================================================
-- Mo-Ride — Migration 004: Vehicle CO2 Database
-- Run: make migrate
-- Populate vehicles table after with: make import-vehicles CSV=<path>
-- ============================================================

CREATE TABLE IF NOT EXISTS vehicles (
    id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    make                      VARCHAR(100) NOT NULL,
    model                     VARCHAR(100) NOT NULL,
    year                      SMALLINT NOT NULL,
    variant                   VARCHAR(200),
    fuel_type                 VARCHAR(50),
    body_style                VARCHAR(50),
    transmission              VARCHAR(100),
    engine_displacement       NUMERIC(4,1),
    engine_cylinders          VARCHAR(20),
    engine_induction          VARCHAR(50),
    co2_combined_g_per_km     SMALLINT,
    co2_urban_g_per_km        SMALLINT,
    co2_extra_urban_g_per_km  SMALLINT,
    fuel_consumption_combined NUMERIC(5,2),
    seating_capacity          SMALLINT,
    created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicles_make_model_year ON vehicles(make, model, year);
CREATE INDEX IF NOT EXISTS idx_vehicles_co2 ON vehicles(co2_combined_g_per_km);

-- Link driver profiles to a specific vehicle record
ALTER TABLE driver_profiles ADD COLUMN IF NOT EXISTS vehicle_id UUID REFERENCES vehicles(id);