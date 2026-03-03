"""
Fare Calculation Algorithm
Based on: CS_14 Project Proposal Report (Mo-Ride)

Formula:
  base_fare      = BASE_RATE + (distance_km * RATE_PER_KM)
  demand_ratio   = active_requests / max(available_drivers, 1) within pickup radius
  surge          = 1.0 + (demand_ratio - 2.0) * 0.5  if demand_ratio > 2.0, else 1.0
  time_mult      = PEAK_MULTIPLIER if current_time in peak hours, else 1.0
  final_fare     = base_fare * surge * time_mult
"""

import math
import requests
from datetime import datetime, timezone, time
from app.config import Config


def _parse_time(t_str: str) -> time:
    """Parse HH:MM string to datetime.time."""
    h, m = t_str.split(":")
    return time(int(h), int(m))


def is_peak_hour(dt: datetime | None = None) -> bool:
    """Return True if the given time (UTC) falls in configured peak hours."""
    if dt is None:
        dt = datetime.now(timezone.utc)
    # Convert to Melbourne local time (UTC+10/+11) — simple offset, no DST handling
    # For production, use pytz/zoneinfo. Here we use UTC+10 as conservative estimate.
    local_hour = (dt.hour + 10) % 24
    local_time = time(local_hour, dt.minute)

    morning_start = _parse_time(Config.PEAK_HOURS_MORNING_START)
    morning_end = _parse_time(Config.PEAK_HOURS_MORNING_END)
    evening_start = _parse_time(Config.PEAK_HOURS_EVENING_START)
    evening_end = _parse_time(Config.PEAK_HOURS_EVENING_END)

    return (morning_start <= local_time <= morning_end) or (evening_start <= local_time <= evening_end)


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate great-circle distance in km between two lat/lon points.
    Used as fallback when Google Maps API is unavailable.
    """
    R = 6371.0  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    # Add 30% buffer vs straight-line to approximate road distance
    return round(R * c * 1.3, 3)


def get_route_distance_km(
    pickup_lat: float, pickup_lng: float,
    dropoff_lat: float, dropoff_lng: float,
) -> tuple[float, int]:
    """
    Returns (distance_km, eta_minutes).
    Uses Google Maps Distance Matrix if key configured, else haversine fallback.
    """
    if Config.GOOGLE_MAPS_API_KEY:
        try:
            url = "https://maps.googleapis.com/maps/api/distancematrix/json"
            params = {
                "origins": f"{pickup_lat},{pickup_lng}",
                "destinations": f"{dropoff_lat},{dropoff_lng}",
                "mode": "driving",
                "units": "metric",
                "key": Config.GOOGLE_MAPS_API_KEY,
            }
            resp = requests.get(url, params=params, timeout=5)
            resp.raise_for_status()
            data = resp.json()
            element = data["rows"][0]["elements"][0]
            if element["status"] == "OK":
                distance_m = element["distance"]["value"]
                duration_s = element["duration"]["value"]
                return round(distance_m / 1000, 3), max(1, round(duration_s / 60))
        except Exception as e:
            print(f"[fare] Google Maps API error, using fallback: {e}")

    # Fallback: haversine with 30% road buffer
    dist = haversine_distance(pickup_lat, pickup_lng, dropoff_lat, dropoff_lng)
    # Estimate ETA: assume avg speed 30 km/h in city
    eta = max(1, round((dist / 30) * 60))
    return dist, eta


def calculate_fare(
    distance_km: float,
    active_requests: int,
    available_drivers: int,
    current_time: datetime | None = None,
) -> dict:
    """
    Returns dict with: base_fare, surge_multiplier, time_multiplier, final_fare, demand_ratio
    """
    # Base fare
    base_fare = Config.BASE_RATE + (distance_km * Config.RATE_PER_KM)

    # Demand surge
    demand_ratio = active_requests / max(available_drivers, 1)
    if demand_ratio > 2.0:
        surge_multiplier = round(1.0 + (demand_ratio - 2.0) * 0.5, 2)
    else:
        surge_multiplier = 1.0

    # Peak hours
    time_multiplier = Config.PEAK_MULTIPLIER if is_peak_hour(current_time) else 1.0

    # Final fare
    final_fare = round(base_fare * surge_multiplier * time_multiplier, 2)

    return {
        "base_fare": round(base_fare, 2),
        "surge_multiplier": surge_multiplier,
        "time_multiplier": time_multiplier,
        "demand_ratio": round(demand_ratio, 3),
        "final_fare": final_fare,
        "currency": "aud",
        "is_peak": time_multiplier > 1.0,
    }
