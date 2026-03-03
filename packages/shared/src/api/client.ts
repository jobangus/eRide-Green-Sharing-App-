/**
 * Mo-Ride API Client
 * Type-safe wrapper around the REST API.
 * Stores tokens in memory; mobile app should persist via SecureStore.
 */

import type {
  RegisterRequest, RegisterResponse,
  VerifyOtpRequest,
  LoginRequest, LoginResponse,
  RefreshTokenResponse,
  UserProfile, UpdateProfileRequest,
  GoOnlineRequest,
  RideEstimateRequest, RideEstimateResponse,
  RequestRideBody, RequestRideResponse,
  Ride,
  CancelRideRequest,
  UpdateRideStatusRequest,
  RateRideRequest,
  SustainabilitySummary, SustainabilityRideItem,
  CreatePaymentIntentRequest, CreatePaymentIntentResponse,
  PaymentStatusResponse,
} from '../types';

export class MoRideApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'MoRideApiError';
  }
}

export class MoRideApiClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private onTokenRefreshed?: (accessToken: string, refreshToken: string) => void;
  private onAuthError?: () => void;

  constructor(baseUrl: string) {
    // Strip trailing slash
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  setTokens(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
  }

  onTokenRefresh(handler: (a: string, r: string) => void) {
    this.onTokenRefreshed = handler;
  }

  onAuthFailure(handler: () => void) {
    this.onAuthError = handler;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    retryOnExpiry = true,
  ): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.accessToken) {
      headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (response.status === 401 && retryOnExpiry && this.refreshToken) {
      // Try to refresh token
      const refreshed = await this._refresh();
      if (refreshed) {
        return this.request<T>(method, path, body, false);
      } else {
        this.onAuthError?.();
        throw new MoRideApiError(401, 'unauthorized', 'Session expired. Please log in again.');
      }
    }

    if (!response.ok) {
      let errorBody: { error?: string; message?: string } = {};
      try { errorBody = await response.json(); } catch {}
      throw new MoRideApiError(
        response.status,
        errorBody.error || 'api_error',
        errorBody.message || `HTTP ${response.status}`,
      );
    }

    return response.json() as Promise<T>;
  }

  private async _refresh(): Promise<boolean> {
    if (!this.refreshToken) return false;
    try {
      const resp = await fetch(`${this.baseUrl}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: this.refreshToken }),
      });
      if (!resp.ok) return false;
      const data: RefreshTokenResponse = await resp.json();
      this.accessToken = data.access_token;
      this.refreshToken = data.refresh_token;
      this.onTokenRefreshed?.(data.access_token, data.refresh_token);
      return true;
    } catch {
      return false;
    }
  }

  // ─── Auth ────────────────────────────────────────────────

  register(body: RegisterRequest) {
    return this.request<RegisterResponse>('POST', '/api/auth/register', body, false);
  }

  verifyOtp(body: VerifyOtpRequest) {
    return this.request<{ message: string }>('POST', '/api/auth/verify-otp', body, false);
  }

  async login(body: LoginRequest): Promise<LoginResponse> {
    const data = await this.request<LoginResponse>('POST', '/api/auth/login', body, false);
    this.setTokens(data.access_token, data.refresh_token);
    return data;
  }

  logout() {
    return this.request<{ message: string }>('POST', '/api/auth/logout');
  }

  // ─── User ────────────────────────────────────────────────

  getMe() {
    return this.request<UserProfile>('GET', '/api/me');
  }

  updateMe(body: UpdateProfileRequest) {
    return this.request<{ message: string }>('PATCH', '/api/me', body);
  }

  // ─── Driver ──────────────────────────────────────────────

  goOnline(body: GoOnlineRequest) {
    return this.request<{ status: string; lat: number; lng: number }>('POST', '/api/driver/go-online', body);
  }

  goOffline() {
    return this.request<{ status: string }>('POST', '/api/driver/go-offline');
  }

  getDriverStatus() {
    return this.request<{ is_online: boolean; profile: object | null }>('GET', '/api/driver/status');
  }

  updateDriverLocation(lat: number, lng: number) {
    return this.request<{ updated: boolean }>('POST', '/api/driver/update-location', { lat, lng });
  }

  // ─── Rides ───────────────────────────────────────────────

  estimateRide(body: RideEstimateRequest) {
    return this.request<RideEstimateResponse>('POST', '/api/rides/estimate', body);
  }

  requestRide(body: RequestRideBody) {
    return this.request<RequestRideResponse>('POST', '/api/rides/request', body);
  }

  getRide(rideId: string) {
    return this.request<Ride>('GET', `/api/rides/${rideId}`);
  }

  cancelRide(rideId: string, body?: CancelRideRequest) {
    return this.request<{ message: string; ride_id: string }>('POST', `/api/rides/${rideId}/cancel`, body);
  }

  updateRideStatus(rideId: string, body: UpdateRideStatusRequest) {
    return this.request<{ ride_id: string; status: string }>('POST', `/api/rides/${rideId}/status`, body);
  }

  completeRide(rideId: string) {
    return this.request<{ ride_id: string; status: string; co2_saved_kg: number }>('POST', `/api/rides/${rideId}/complete`);
  }

  rateRide(rideId: string, body: RateRideRequest) {
    return this.request<{ message: string; score: number }>('POST', `/api/rides/${rideId}/rate`, body);
  }

  // ─── Sustainability ──────────────────────────────────────

  getSustainabilitySummary() {
    return this.request<SustainabilitySummary>('GET', '/api/sustainability/summary');
  }

  getSustainabilityRides() {
    return this.request<{ rides: SustainabilityRideItem[]; count: number }>('GET', '/api/sustainability/rides');
  }

  // ─── Payments ────────────────────────────────────────────

  createPaymentIntent(body: CreatePaymentIntentRequest) {
    return this.request<CreatePaymentIntentResponse>('POST', '/api/payments/create-intent', body);
  }

  getPaymentStatus(rideId: string) {
    return this.request<PaymentStatusResponse>('GET', `/api/payments/status/${rideId}`);
  }
}

// Singleton for use across the app
export let apiClient: MoRideApiClient;

export function initApiClient(baseUrl: string): MoRideApiClient {
  apiClient = new MoRideApiClient(baseUrl);
  return apiClient;
}
