"""
Location Tracking Service — Socket.IO Events

Dedicated service for real-time location streaming during an active ride.
Lighter-weight than the main ride-matching service.

Events received:
  - subscribe_ride { ride_id, token }   — subscribe to live location for a ride
  - location_ping  { ride_id, lat, lng } — driver sends current location

Events emitted:
  - location_update { driver_id, lat, lng, ride_id }
"""

from flask import request
from flask_socketio import SocketIO, join_room, emit
from app.auth_middleware import get_user_from_token


def register_events(socketio: SocketIO, redis_client):

    @socketio.on("connect")
    def on_connect():
        token = request.args.get("token", "")
        user = get_user_from_token(token)
        if not user:
            return False
        request.environ["_lt_user"] = user

    @socketio.on("subscribe_ride")
    def on_subscribe(data):
        ride_id = data.get("ride_id")
        token = data.get("token", request.args.get("token", ""))
        user = get_user_from_token(token) or request.environ.get("_lt_user", {})
        if not user or not ride_id:
            return
        join_room(f"ride_{ride_id}")
        emit("subscribed", {"ride_id": ride_id})

        # Send last known location immediately if available
        cached = redis_client.hgetall(f"ride_location:{ride_id}")
        if cached:
            emit("location_update", {
                "ride_id": ride_id,
                "lat": float(cached.get(b"lat", 0)),
                "lng": float(cached.get(b"lng", 0)),
                "driver_id": cached.get(b"driver_id", b"").decode(),
            })

    @socketio.on("location_ping")
    def on_location_ping(data):
        user = request.environ.get("_lt_user", {})
        driver_id = user.get("user_id")
        role = user.get("role")

        if not driver_id or role not in ("driver", "both"):
            return

        ride_id = data.get("ride_id")
        lat = data.get("lat")
        lng = data.get("lng")

        if not all([ride_id, lat is not None, lng is not None]):
            return

        # Cache latest location in Redis
        redis_client.hset(f"ride_location:{ride_id}", mapping={
            "lat": str(lat),
            "lng": str(lng),
            "driver_id": driver_id,
        })
        redis_client.expire(f"ride_location:{ride_id}", 3600)

        # Update GEO index
        redis_client.geoadd("driver_locations", (float(lng), float(lat), driver_id))

        # Broadcast to ride room
        socketio.emit(
            "location_update",
            {"ride_id": ride_id, "driver_id": driver_id, "lat": lat, "lng": lng},
            to=f"ride_{ride_id}",
        )
