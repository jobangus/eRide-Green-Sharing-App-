-- ============================================================
-- Mo-Ride — Migration 002: Row Level Security Policies
-- NOTE: These policies are for Supabase deployments.
-- For plain Postgres (e.g. local Docker), the application
-- layer enforces these rules via JWT + query filters.
-- ============================================================

-- Enable RLS on sensitive tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE driver_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE sustainability ENABLE ROW LEVEL SECURITY;

-- ─── Helper: get current user UUID from JWT ──────────────────
-- Supabase sets auth.uid() from JWT sub claim.
-- For plain Postgres, we set app.current_user_id via SET LOCAL.

CREATE OR REPLACE FUNCTION current_user_id()
RETURNS UUID AS $$
BEGIN
    -- Try Supabase style first
    RETURN COALESCE(
        auth.uid(),
        current_setting('app.current_user_id', TRUE)::UUID
    );
EXCEPTION WHEN OTHERS THEN
    RETURN current_setting('app.current_user_id', TRUE)::UUID;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── USERS table ────────────────────────────────────────────

-- Users can read their own record only
CREATE POLICY users_select_own ON users
    FOR SELECT USING (id = current_user_id());

-- Users can update their own record (except email/role)
CREATE POLICY users_update_own ON users
    FOR UPDATE USING (id = current_user_id());

-- Insert is handled by auth service (bypass RLS via service role)
CREATE POLICY users_insert_service ON users
    FOR INSERT WITH CHECK (TRUE);

-- ─── DRIVER PROFILES ────────────────────────────────────────

-- Drivers manage their own profile
CREATE POLICY dp_select_own ON driver_profiles
    FOR SELECT USING (user_id = current_user_id());

CREATE POLICY dp_insert_own ON driver_profiles
    FOR INSERT WITH CHECK (user_id = current_user_id());

CREATE POLICY dp_update_own ON driver_profiles
    FOR UPDATE USING (user_id = current_user_id());

-- Riders can view basic driver info for their active ride
CREATE POLICY dp_select_for_rider ON driver_profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM rides
            WHERE driver_id = driver_profiles.user_id
              AND rider_id = current_user_id()
              AND status IN ('matched', 'confirmed', 'enroute', 'arrived', 'in_progress')
        )
    );

-- ─── RIDES ──────────────────────────────────────────────────

-- Rider sees their own rides; driver sees rides assigned to them
CREATE POLICY rides_select_participant ON rides
    FOR SELECT USING (
        rider_id = current_user_id()
        OR driver_id = current_user_id()
    );

-- Rider can create rides
CREATE POLICY rides_insert_rider ON rides
    FOR INSERT WITH CHECK (rider_id = current_user_id());

-- Rider and driver can update rides (application layer restricts which fields)
CREATE POLICY rides_update_participant ON rides
    FOR UPDATE USING (
        rider_id = current_user_id()
        OR driver_id = current_user_id()
    );

-- ─── RATINGS ────────────────────────────────────────────────

-- Users can see ratings involving them
CREATE POLICY ratings_select_participant ON ratings
    FOR SELECT USING (
        from_user_id = current_user_id()
        OR to_user_id = current_user_id()
    );

-- Users can only insert ratings where they are the "from" user
CREATE POLICY ratings_insert_own ON ratings
    FOR INSERT WITH CHECK (from_user_id = current_user_id());

-- ─── PAYMENTS ───────────────────────────────────────────────

-- Rider can see their own payment; driver can see payment for their rides
CREATE POLICY payments_select_participant ON payments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM rides
            WHERE rides.id = payments.ride_id
              AND (rides.rider_id = current_user_id()
                   OR rides.driver_id = current_user_id())
        )
    );

-- ─── SUSTAINABILITY ──────────────────────────────────────────

-- Anyone involved in the ride can see sustainability data
CREATE POLICY sustainability_select_participant ON sustainability
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM rides
            WHERE rides.id = sustainability.ride_id
              AND (rides.rider_id = current_user_id()
                   OR rides.driver_id = current_user_id())
        )
    );

-- Note: ride_events and queued_requests are service-internal tables;
-- application services use a service-role DB connection.

SELECT 'RLS migration 002 complete.' AS status;
