"""
Ride Matching Algorithm
Based on: CS_14 Project Proposal Report (Mo-Ride)

Algorithm:
1. Query active drivers from Redis GEO index within DRIVER_SEARCH_RADIUS_KM
2. For each driver: score = (1 / distance_km) * driver_rating * availability_weight
3. Sort by score desc
4. Send ride request via WebSocket to best_driver
5. Wait DRIVER_ACCEPT_TIMEOUT_SECONDS for acceptance
6. On reject/timeout: try next driver
7. If no drivers: store in queued_requests for retry
"""

import math
import time
import threading
from typing import Optional
from app.config import Config


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance in km."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def score_driver(
    distance_km: float,
    driver_rating: float,
    is_available: bool,
) -> float:
    """
    Deterministic scoring function.
    score = (1 / distance_km) * driver_rating * availability_weight
    """
    if distance_km <= 0:
        distance_km = 0.01  # prevent division by zero
    availability_weight = 1.0 if is_available else 0.0
    return (1.0 / distance_km) * driver_rating * availability_weight


def get_active_drivers_from_redis(
    redis_client,
    pickup_lat: float,
    pickup_lng: float,
    radius_km: float,
) -> list[dict]:
    """
    Query Redis GEO index for drivers within radius.
    Returns list of dicts with: driver_id, distance_km, lat, lng
    """
    try:
        results = redis_client.geosearch(
            "driver_locations",
            longitude=pickup_lng,
            latitude=pickup_lat,
            radius=radius_km,
            unit="km",
            withcoord=True,
            withdist=True,
            sort="ASC",
            count=20,
        )
        drivers = []
        for item in results:
            # item = [driver_id, distance, (lng, lat)]
            driver_id = item[0].decode() if isinstance(item[0], bytes) else item[0]
            distance = float(item[1])
            lng, lat = float(item[2][0]), float(item[2][1])
            drivers.append({
                "driver_id": driver_id,
                "distance_km": distance,
                "lat": lat,
                "lng": lng,
            })
        return drivers
    except Exception as e:
        print(f"[matching] Redis GEO query failed: {e}")
        return []


def get_driver_metadata_from_redis(redis_client, driver_id: str) -> dict:
    """
    Retrieve driver metadata (rating, availability) from Redis hash.
    Falls back to sensible defaults if not cached.
    """
    try:
        data = redis_client.hgetall(f"driver_meta:{driver_id}")
        if data:
            return {
                "rating": float(data.get(b"rating", b"5.0")),
                "is_available": data.get(b"is_available", b"1") == b"1",
                "is_online": data.get(b"is_online", b"1") == b"1",
            }
    except Exception:
        pass
    return {"rating": 5.0, "is_available": True, "is_online": True}


def rank_drivers(candidates: list[dict]) -> list[dict]:
    """
    Sort candidates by score descending.
    Each candidate must have: driver_id, distance_km, rating, is_available
    """
    for c in candidates:
        c["score"] = score_driver(
            c.get("distance_km", 1.0),
            c.get("rating", 5.0),
            c.get("is_available", True),
        )
    return sorted(candidates, key=lambda x: x["score"], reverse=True)


class MatchingSession:
    """
    Manages the asynchronous accept/decline flow for a single ride request.
    Uses threading.Event for the accept/decline signal.
    """

    def __init__(self, ride_id: str, timeout_seconds: int = None):
        self.ride_id = ride_id
        self.timeout = timeout_seconds or Config.DRIVER_ACCEPT_TIMEOUT_SECONDS
        self._event = threading.Event()
        self._accepted = False
        self._accepted_by: Optional[str] = None

    def wait_for_response(self) -> bool:
        """Block until driver accepts or timeout expires. Returns True if accepted."""
        accepted = self._event.wait(timeout=self.timeout)
        return accepted and self._accepted

    def signal_accept(self, driver_id: str):
        self._accepted = True
        self._accepted_by = driver_id
        self._event.set()

    def signal_decline(self):
        self._accepted = False
        self._event.set()

    @property
    def accepted_by(self) -> Optional[str]:
        return self._accepted_by
