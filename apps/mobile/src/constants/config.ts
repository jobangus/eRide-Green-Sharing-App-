import Constants from 'expo-constants';

// API base URL — override via app.json extra.API_BASE_URL or env
export const API_BASE_URL: string =
  Constants.expoConfig?.extra?.API_BASE_URL ?? 'http://localhost:8000';

export const WS_RIDES_URL = `${API_BASE_URL.replace('http', 'ws')}/ws/rides`;
export const WS_LOCATION_URL = `${API_BASE_URL.replace('http', 'ws')}/ws/location`;

// Monash campus coordinates (for map default region)
export const MONASH_CLAYTON: { lat: number; lng: number } = {
  lat: -37.9105,
  lng: 145.1362,
};

export const MONASH_CAULFIELD: { lat: number; lng: number } = {
  lat: -37.8777,
  lng: 145.0452,
};

export const DEFAULT_MAP_REGION = {
  latitude: MONASH_CLAYTON.lat,
  longitude: MONASH_CLAYTON.lng,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

// Theme
export const THEME_COLORS = {
  primary: '#1B5E20',
  primaryLight: '#4CAF50',
  primaryDark: '#003300',
  secondary: '#FFC107',
  background: '#F5F5F5',
  surface: '#FFFFFF',
  error: '#B00020',
  text: '#212121',
  subtext: '#757575',
  border: '#E0E0E0',
};
