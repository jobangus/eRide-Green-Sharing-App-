import Constants from 'expo-constants';
import { MONASH_CLAYTON, MONASH_CAULFIELD } from '../constants/config';

const GOOGLE_MAPS_API_KEY = Constants.expoConfig?.extra?.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

const ROUTES_API_URL = 'https://routes.googleapis.com/directions/v2:computeRoutes';

export interface RouteRequest {
  origin: { };
  destination: {
    latitude: number;
    longitude: number;
  };
  travelMode?: 'DRIVE' | 'WALK' | 'BICYCLE' | 'TRANSIT';
  avoidTolls?: boolean;
  avoidHighways?: boolean;
  avoidFerries?: boolean;
}

export interface RouteResponse {
  distanceMeters: number;
  duration: string; // ISO 8601 duration format (e.g., "360s")
  durationSeconds: number;
  encodedPolyline: string;
}

export interface RouteError {
  error: string;
  details?: unknown;
}

/**
 * Compute a route between two locations using Google Maps Routes API v2
 */
export async function computeRoute(
  request: RouteRequest
): Promise<RouteResponse | RouteError> {
  if (!GOOGLE_MAPS_API_KEY) {
    return {
      error: 'Google Maps API key not configured',
    };
  }

  const requestBody = {
    origin: {
      location: {
        latLng: {
          latitude: request.origin.latitude,
          longitude: request.origin.longitude,
        },
      },
    },
    destination: {
      location: {
        latLng: {
          latitude: request.destination.latitude,
          longitude: request.destination.longitude,
        },
      },
    },
    travelMode: request.travelMode || 'DRIVE',
    routingPreference: 'TRAFFIC_AWARE',
    computeAlternativeRoutes: false,
    routeModifiers: {
      avoidTolls: request.avoidTolls ?? false,
      avoidHighways: request.avoidHighways ?? false,
      avoidFerries: request.avoidFerries ?? false,
    },
    languageCode: 'en-US',
    units: 'METRIC',
  };

  try {
    const response = await fetch(ROUTES_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_MAPS_API_KEY,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        error: `Google Maps API error: ${response.status}`,
        details: errorText,
      };
    }

    const data = await response.json();

    if (!data.routes || data.routes.length === 0) {
      return {
        error: 'No route found',
      };
    }

    const route = data.routes[0];
    
    // Parse duration from ISO 8601 format (e.g., "360s" -> 360)
    const durationSeconds = parseInt(route.duration.replace('s', ''), 10);

    return {
      distanceMeters: route.distanceMeters,
      duration: route.duration,
      durationSeconds,
      encodedPolyline: route.polyline.encodedPolyline,
    };
  } catch (error) {
    return {
      error: 'Failed to compute route',
      details: error,
    };
  }
}

/**
 * Compute route from Clayton to Caulfield campus
 */
export async function getClaytonToCaulfieldRoute(): Promise<RouteResponse | RouteError> {
  return computeRoute({
    origin: {
      latitude: MONASH_CLAYTON.lat,
      longitude: MONASH_CLAYTON.lng,
    },
    destination: {
      latitude: MONASH_CAULFIELD.lat,
      longitude: MONASH_CAULFIELD.lng,
    },
    travelMode: 'DRIVE',
  });
}

/**
 * Compute route from Caulfield to Clayton campus
 */
export async function getCaulfieldToClaytonRoute(): Promise<RouteResponse | RouteError> {
  return computeRoute({
    origin: {
      latitude: MONASH_CAULFIELD.lat,
      longitude: MONASH_CAULFIELD.lng,
    },
    destination: {
      latitude: MONASH_CLAYTON.lat,
      longitude: MONASH_CLAYTON.lng,
    },
    travelMode: 'DRIVE',
  });
}

/**
 * Helper function to format distance in kilometers
 */
export function formatDistance(distanceMeters: number): string {
  const kilometers = distanceMeters / 1000;
  return `${kilometers.toFixed(1)} km`;
}

/**
 * Helper function to format duration in minutes
 */
export function formatDuration(durationSeconds: number): string {
  const minutes = Math.round(durationSeconds / 60);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}
