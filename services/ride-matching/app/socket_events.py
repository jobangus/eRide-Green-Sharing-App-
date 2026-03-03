"""
Socket.IO event handlers for ride-matching service.

Events received from clients:
  - join_ride_room   { ride_id }       — rider/driver join ride-specific room
  - join_driver_room { driver_id }     — driver registers for incoming requests
  - ride_accept      { ride_id }       — driver accepts a ride request
  - ride_decline     { ride_id }       — driver declines a ride request
  - driver_location  { lat, lng }      — driver broadcasts location update
  - driver_online    { lat, lng }      — driver goes online
  - driver_offline   {}                — driver goes offline

Events emitted by server:
  - ride_request     { ride_id, pickup_lat, pickup_lng, timeout_seconds }
  - ride_status_update { ride_id, status, ... }
  - ride_cancel      { ride_id, reason, cancelled_by }
  - location_update  { driver_id, lat, lng }
"""

from flask import request
from flask_socketio import SocketIO, join_room, leave_room, emit
from app.auth_middleware import get_user_from_token
from app.routes.rides import handle_ride_accept, handle_ride_decline


def register_events(socketio: SocketIO, redis_client):
    @socketio.on("connect")
    def handle_connect():
        token = request.args.get("token", "")
        user = get_user_from_token(token)
        if not user:
            return False  # reject connection
        # Store user info in session
        request.environ["user"] = user
        print(f"[socket] Connected: {user['user_id']}")

    @socketio.on("disconnect")
    def handle_disconnect():
        user = request.environ.get("user", {})
        user_id = user.get("user_id", "unknown")
        print(f"[socket] Disconnected: {user_id}")

    @socketio.on("join_ride_room")
    def handle_join_ride(data):
        ride_id = data.get("ride_id")
        if ride_id:
            join_room(f"ride_{ride_id}")
            emit("joined", {"room": f"ride_{ride_id}"})

    @socketio.on("join_driver_room")
    def handle_join_driver(data):
        user = request.environ.get("user", {})
        driver_id = user.get("user_id")
        if driver_id:
            join_room(f"driver_{driver_id}")
            emit("joined", {"room": f"driver_{driver_id}"})

    @socketio.on("ride_accept")
    def handle_accept(data):
        ride_id = data.get("ride_id")
        user = request.environ.get("user", {})
        driver_id = user.get("user_id")
        if ride_id and driver_id:
            handle_ride_accept(ride_id, driver_id)

    @socketio.on("ride_decline")
    def handle_decline(data):
        ride_id = data.get("ride_id")
        if ride_id:
            handle_ride_decline(ride_id)

    @socketio.on("driver_location")
    def handle_driver_location(data):
        user = request.environ.get("user", {})
        driver_id = user.get("user_id")
        if not driver_id:
            return

        lat = data.get("lat")
        lng = data.get("lng")
        if lat is None or lng is None:
            return

        # Update Redis GEO
        redis_client.geoadd("driver_locations", (float(lng), float(lat), driver_id))

        # Broadcast to any ride rooms this driver is in
        ride_id = data.get("ride_id")
        if ride_id:
            socketio.emit(
                "location_update",
                {"driver_id": driver_id, "lat": lat, "lng": lng},
                to=f"ride_{ride_id}",
            )
