// ============================================================
// Mo-Ride Shared TypeScript Types
// ============================================================

export type UserRole = 'rider' | 'driver' | 'both' | 'admin';

export type RideStatus =
  | 'requested'
  | 'matching'
  | 'matched'
  | 'confirmed'
  | 'enroute'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type PaymentStatus =
  | 'pending'
  | 'requires_capture'
  | 'captured'
  | 'cancelled'
  | 'failed'
  | 'refunded';

// ─── Auth ────────────────────────────────────────────────────

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  phone?: string;
  role?: UserRole;
}

export interface RegisterResponse {
  message: string;
  user_id: string;
  /** Only present in development mode */
  otp?: string;
}

export interface VerifyOtpRequest {
  email: string;
  otp: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
  user: UserSummary;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface RefreshTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: 'Bearer';
}

// ─── User ────────────────────────────────────────────────────

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface UserProfile extends UserSummary {
  phone?: string;
  is_verified: boolean;
  profile_photo_url?: string;
  ratings: {
    as_driver: { average: number | null; count: number };
    as_rider: { average: number | null; count: number };
  };
  driver_profile?: DriverProfile | null;
  created_at: string;
}

export interface UpdateProfileRequest {
  name?: string;
  phone?: string;
  driver_profile?: Partial<DriverProfile>;
}

// ─── Driver ──────────────────────────────────────────────────

export interface DriverProfile {
  car_make?: string;
  car_model?: string;
  car_year?: number;
  car_color?: string;
  car_plate?: string;
  is_verified?: boolean;
  is_online?: boolean;
  last_online_at?: string;
}

export interface GoOnlineRequest {
  lat: number;
  lng: number;
}

// ─── Rides ───────────────────────────────────────────────────

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface RideEstimateRequest extends Coordinates {
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
}

export interface FareBreakdown {
  base_fare: number;
  surge_multiplier: number;
  time_multiplier: number;
  demand_ratio: number;
  final_fare: number;
  currency: string;
  is_peak: boolean;
}

export interface RideEstimateResponse {
  distance_km: number;
  eta_minutes: number;
  fare: FareBreakdown;
}

export interface RequestRideBody {
  pickup_lat: number;
  pickup_lng: number;
  pickup_address?: string;
  dropoff_lat: number;
  dropoff_lng: number;
  dropoff_address?: string;
  pickup_time?: string;
  passenger_count?: number;
  notes?: string;
}

export interface RequestRideResponse {
  ride_id: string;
  status: RideStatus;
  distance_km: number;
  eta_minutes: number;
  fare_estimated: number;
  fare_breakdown: FareBreakdown;
  message: string;
}

export interface Ride {
  id: string;
  rider_id: string;
  driver_id?: string;
  pickup_lat: number;
  pickup_lng: number;
  pickup_address?: string;
  dropoff_lat: number;
  dropoff_lng: number;
  dropoff_address?: string;
  pickup_time: string;
  status: RideStatus;
  distance_km?: number;
  eta_minutes?: number;
  fare_estimated?: number;
  fare_final?: number;
  cancel_reason?: string;
  passenger_count: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  rider_name?: string;
  driver_name?: string;
  car_make?: string;
  car_model?: string;
  car_color?: string;
  car_plate?: string;
  rating_avg_driver?: number;
}

export interface CancelRideRequest {
  reason?: string;
}

export interface UpdateRideStatusRequest {
  status: 'confirmed' | 'enroute' | 'arrived' | 'in_progress';
}

export interface RateRideRequest {
  score: 1 | 2 | 3 | 4 | 5;
  comment?: string;
}

// ─── Sustainability ───────────────────────────────────────────

export interface SustainabilitySummary {
  total_rides: number;
  total_km: number;
  total_co2_saved_kg: number;
  total_actual_co2_kg: number;
  total_baseline_co2_kg: number;
  equivalent_trees_hours: number;
  equivalent_km_not_driven: number;
  weekly_trend: WeeklyTrend[];
}

export interface WeeklyTrend {
  week: string;
  rides: number;
  co2_saved_kg: number;
}

export interface SustainabilityRideItem {
  ride_id: string;
  created_at: string;
  pickup_address?: string;
  dropoff_address?: string;
  distance_km: number;
  co2_saved_kg: number;
  baseline_co2_kg: number;
  actual_co2_kg: number;
  passengers: number;
}

// ─── Payments ────────────────────────────────────────────────

export interface CreatePaymentIntentRequest {
  ride_id: string;
}

export interface CreatePaymentIntentResponse {
  client_secret: string;
  payment_intent_id: string;
  amount_aud: number;
  dev_mode?: boolean;
}

export interface PaymentStatusResponse {
  ride_id: string;
  status: PaymentStatus;
  amount_estimated?: number;
  amount_final?: number;
  currency: string;
}

// ─── WebSocket Events ─────────────────────────────────────────

export interface WsRideRequest {
  ride_id: string;
  pickup_lat: number;
  pickup_lng: number;
  timeout_seconds: number;
}

export interface WsRideStatusUpdate {
  ride_id: string;
  status: RideStatus | 'no_drivers';
  driver_id?: string;
  message?: string;
}

export interface WsLocationUpdate {
  ride_id: string;
  driver_id: string;
  lat: number;
  lng: number;
}

export interface WsRideCancel {
  ride_id: string;
  reason: string;
  cancelled_by: string;
}

// ─── API Error ───────────────────────────────────────────────

export interface ApiError {
  error: string;
  message: string;
}
