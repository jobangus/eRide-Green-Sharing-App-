import uuid
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, g, current_app
from app.db import get_db
from app.auth_middleware import require_auth
from app.services.fare import calculate_fare, get_route_distance_km
from app.services.matching import (
    get_active_drivers_from_redis, get_driver_metadata_from_redis,
    rank_drivers, MatchingSession
)
from app.services.sustainability import compute_co2
import threading

rides_bp = Blueprint("rides", __name__)

# In-memory sessions: ride_id -> MatchingSession
_matching_sessions: dict[str, MatchingSession] = {}
_sessions_lock = threading.Lock()


def _get_redis():
    return current_app.extensions["redis"]


def _get_socketio():
    return current_app.extensions["socketio"]


# ─── Estimate fare (no ride created) ─────────────────────────


@rides_bp.route("/estimate", methods=["POST"])
@require_auth
def estimate():
    """
    POST /rides/estimate
    Body: { pickup_lat, pickup_lng, dropoff_lat, dropoff_lng }
    """
    data = request.get_json(silent=True) or {}
    try:
        p_lat = float(data["pickup_lat"])
        p_lng = float(data["pickup_lng"])
        d_lat = float(data["dropoff_lat"])
        d_lng = float(data["dropoff_lng"])
    except (KeyError, ValueError, TypeError):
        return jsonify({"error": "validation", "message": "pickup_lat, pickup_lng, dropoff_lat, dropoff_lng required"}), 400

    distance_km, eta_minutes = get_route_distance_km(p_lat, p_lng, d_lat, d_lng)

    redis = _get_redis()
    active_requests = redis.get("stats:active_requests") or 0
    available_drivers = redis.zcard("driver_locations") or 0

    fare = calculate_fare(
        distance_km=distance_km,
        active_requests=int(active_requests),
        available_drivers=int(available_drivers),
    )

    return jsonify({
        "distance_km": distance_km,
        "eta_minutes": eta_minutes,
        "fare": fare,
    }), 200


# ─── Request a ride ───────────────────────────────────────────


@rides_bp.route("", methods=["POST"])
@rides_bp.route("/request", methods=["POST"])
@require_auth
def request_ride():
    """
    POST /rides/request
    Body: {
        pickup_lat, pickup_lng, pickup_address?,
        dropoff_lat, dropoff_lng, dropoff_address?,
        pickup_time?,   # ISO string; defaults to now
        passenger_count?,
        notes?
    }
    """
    data = request.get_json(silent=True) or {}
    try:
        p_lat = float(data["pickup_lat"])
        p_lng = float(data["pickup_lng"])
        d_lat = float(data["dropoff_lat"])
        d_lng = float(data["dropoff_lng"])
    except (KeyError, ValueError, TypeError):
        return jsonify({"error": "validation", "message": "Pickup and dropoff coordinates required"}), 400

    pickup_address = data.get("pickup_address", "")
    dropoff_address = data.get("dropoff_address", "")
    passenger_count = max(1, int(data.get("passenger_count", 1)))
    notes = data.get("notes", "")
    pickup_time_raw = data.get("pickup_time")
    if pickup_time_raw:
        try:
            pickup_time = datetime.fromisoformat(pickup_time_raw)
        except ValueError:
            pickup_time = datetime.now(timezone.utc)
    else:
        pickup_time = datetime.now(timezone.utc)

    distance_km, eta_minutes = get_route_distance_km(p_lat, p_lng, d_lat, d_lng)

    redis = _get_redis()
    active_requests = int(redis.get("stats:active_requests") or 0)
    available_drivers = int(redis.zcard("driver_locations") or 0)

    fare_info = calculate_fare(
        distance_km=distance_km,
        active_requests=active_requests,
        available_drivers=available_drivers,
    )

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO rides
               (rider_id, pickup_lat, pickup_lng, pickup_address,
                dropoff_lat, dropoff_lng, dropoff_address,
                pickup_time, status, distance_km, eta_minutes,
                fare_estimated, passenger_count, notes)
               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,'matching',%s,%s,%s,%s,%s)
               RETURNING id""",
            (g.user_id, p_lat, p_lng, pickup_address,
             d_lat, d_lng, dropoff_address,
             pickup_time, distance_km, eta_minutes,
             fare_info["final_fare"], passenger_count, notes)
        )
        ride_id = str(cur.fetchone()["id"])

        cur.execute(
            "INSERT INTO ride_events (ride_id, type, actor_id) VALUES (%s,'requested',%s)",
            (ride_id, g.user_id)
        )

    # Increment active request counter
    redis.incr("stats:active_requests")
    redis.expire("stats:active_requests", 3600)

    # Kick off matching in background thread
    socketio = _get_socketio()
    threading.Thread(
        target=_run_matching,
        args=(ride_id, p_lat, p_lng, g.user_id, socketio, redis),
        daemon=True,
    ).start()

    return jsonify({
        "ride_id": ride_id,
        "status": "matching",
        "distance_km": distance_km,
        "eta_minutes": eta_minutes,
        "fare_estimated": fare_info["final_fare"],
        "fare_breakdown": fare_info,
        "message": "Ride requested. Searching for drivers..."
    }), 202


def _run_matching(ride_id: str, pickup_lat: float, pickup_lng: float,
                  rider_id: str, socketio, redis):
    """
    Background thread: iterates through ranked drivers until one accepts.
    """
    from app.config import Config
    import time

    radius = Config.DRIVER_SEARCH_RADIUS_KM
    timeout = Config.DRIVER_ACCEPT_TIMEOUT_SECONDS

    drivers_raw = get_active_drivers_from_redis(redis, pickup_lat, pickup_lng, radius)
    declined_drivers = set()

    # Enrich with metadata
    candidates = []
    for d in drivers_raw:
        meta = get_driver_metadata_from_redis(redis, d["driver_id"])
        if meta.get("is_online") and meta.get("is_available"):
            candidates.append({**d, **meta})

    ranked = rank_drivers(candidates)

    for driver in ranked:
        driver_id = driver["driver_id"]
        if driver_id in declined_drivers:
            continue

        # Create matching session
        session = MatchingSession(ride_id=ride_id, timeout_seconds=timeout)
        with _sessions_lock:
            _matching_sessions[ride_id] = session

        # Mark driver as temporarily unavailable
        redis.hset(f"driver_meta:{driver_id}", "is_available", "0")

        # Push ride request to driver via Socket.IO
        socketio.emit(
            "ride_request",
            {
                "ride_id": ride_id,
                "pickup_lat": pickup_lat,
                "pickup_lng": pickup_lng,
                "timeout_seconds": timeout,
            },
            to=f"driver_{driver_id}",
        )

        # Emit matching_started event to ride room
        socketio.emit("ride_status_update", {"ride_id": ride_id, "status": "matching"}, to=f"ride_{ride_id}")

        accepted = session.wait_for_response()

        with _sessions_lock:
            _matching_sessions.pop(ride_id, None)

        if accepted:
            # Assign driver to ride in DB
            with get_db() as conn:
                cur = conn.cursor()
                cur.execute(
                    "UPDATE rides SET driver_id=%s, status='matched' WHERE id=%s AND status='matching'",
                    (driver_id, ride_id)
                )
                cur.execute(
                    "INSERT INTO ride_events (ride_id, type, actor_id, payload) VALUES (%s,'driver_accepted',%s,%s)",
                    (ride_id, driver_id, f'{{"driver_id":"{driver_id}"}}')
                )

            # Notify rider
            socketio.emit(
                "ride_status_update",
                {"ride_id": ride_id, "status": "matched", "driver_id": driver_id},
                to=f"ride_{ride_id}",
            )
            redis.decr("stats:active_requests")
            return
        else:
            # Driver declined or timed out — restore availability and try next
            declined_drivers.add(driver_id)
            redis.hset(f"driver_meta:{driver_id}", "is_available", "1")

    # No drivers accepted — queue for retry
    _queue_retry(ride_id, rider_id, pickup_lat, pickup_lng)

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE rides SET status='requested' WHERE id=%s AND status='matching'",
            (ride_id,)
        )

    socketio.emit(
        "ride_status_update",
        {"ride_id": ride_id, "status": "no_drivers", "message": "No drivers available. We'll keep looking..."},
        to=f"ride_{ride_id}",
    )
    redis.decr("stats:active_requests")


def _queue_retry(ride_id: str, rider_id: str, pickup_lat: float, pickup_lng: float):
    import json
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """INSERT INTO queued_requests (rider_id, ride_id, payload)
               VALUES (%s, %s, %s)
               ON CONFLICT DO NOTHING""",
            (rider_id, ride_id, json.dumps({"pickup_lat": pickup_lat, "pickup_lng": pickup_lng}))
        )


# ─── Cancel a ride ────────────────────────────────────────────


@rides_bp.route("/<ride_id>/cancel", methods=["POST"])
@require_auth
def cancel_ride(ride_id: str):
    data = request.get_json(silent=True) or {}
    reason = data.get("reason", "Cancelled by user")

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT rider_id, driver_id, status FROM rides WHERE id=%s", (ride_id,)
        )
        ride = cur.fetchone()
        if not ride:
            return jsonify({"error": "not_found", "message": "Ride not found"}), 404

        if g.user_id not in (str(ride["rider_id"]), str(ride["driver_id"])):
            return jsonify({"error": "forbidden", "message": "Not your ride"}), 403

        if ride["status"] in ("completed", "cancelled"):
            return jsonify({"error": "invalid_state", "message": f"Ride is already {ride['status']}"}), 409

        cur.execute(
            """UPDATE rides
               SET status='cancelled', cancel_reason=%s, cancelled_by=%s
               WHERE id=%s""",
            (reason, g.user_id, ride_id)
        )
        cur.execute(
            "INSERT INTO ride_events (ride_id, type, actor_id, payload) VALUES (%s,'ride_cancelled',%s,%s::jsonb)",
            (ride_id, g.user_id, f'{{"reason":"{reason}"}}')
        )

    # Signal any active matching session
    with _sessions_lock:
        session = _matching_sessions.get(ride_id)
        if session:
            session.signal_decline()

    redis = _get_redis()
    redis.decr("stats:active_requests")
    socketio = _get_socketio()
    socketio.emit(
        "ride_cancel",
        {"ride_id": ride_id, "reason": reason, "cancelled_by": g.user_id},
        to=f"ride_{ride_id}",
    )

    return jsonify({"message": "Ride cancelled", "ride_id": ride_id}), 200


# ─── Update ride status (driver) ─────────────────────────────


@rides_bp.route("/<ride_id>/status", methods=["POST"])
@require_auth
def update_status(ride_id: str):
    """
    POST /rides/{rideId}/status
    Body: { status }  — driver progresses ride through states
    Valid transitions for driver:
      matched -> confirmed -> enroute -> arrived -> in_progress
    """
    data = request.get_json(silent=True) or {}
    new_status = data.get("status", "")
    valid = ["confirmed", "enroute", "arrived", "in_progress"]
    if new_status not in valid:
        return jsonify({"error": "validation", "message": f"Status must be one of: {valid}"}), 400

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute("SELECT driver_id, rider_id, status FROM rides WHERE id=%s", (ride_id,))
        ride = cur.fetchone()
        if not ride:
            return jsonify({"error": "not_found", "message": "Ride not found"}), 404
        if str(ride["driver_id"]) != g.user_id:
            return jsonify({"error": "forbidden", "message": "Only the assigned driver can update ride status"}), 403

        cur.execute("UPDATE rides SET status=%s WHERE id=%s", (new_status, ride_id))
        cur.execute(
            "INSERT INTO ride_events (ride_id, type, actor_id) VALUES (%s,%s,%s)",
            (ride_id, new_status.replace("_", "") if new_status != "in_progress" else "ride_started", g.user_id)
        )

    socketio = _get_socketio()
    socketio.emit(
        "ride_status_update",
        {"ride_id": ride_id, "status": new_status},
        to=f"ride_{ride_id}",
    )

    return jsonify({"ride_id": ride_id, "status": new_status}), 200


# ─── Complete ride ────────────────────────────────────────────


@rides_bp.route("/<ride_id>/complete", methods=["POST"])
@require_auth
def complete_ride(ride_id: str):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT driver_id, rider_id, status,
                      distance_km, fare_estimated, passenger_count
               FROM rides WHERE id=%s""",
            (ride_id,)
        )
        ride = cur.fetchone()
        if not ride:
            return jsonify({"error": "not_found", "message": "Ride not found"}), 404
        if str(ride["driver_id"]) != g.user_id:
            return jsonify({"error": "forbidden", "message": "Only the driver can complete the ride"}), 403
        if ride["status"] != "in_progress":
            return jsonify({"error": "invalid_state", "message": "Ride must be in_progress to complete"}), 409

        cur.execute(
            "UPDATE rides SET status='completed', fare_final=fare_estimated WHERE id=%s",
            (ride_id,)
        )
        cur.execute(
            "INSERT INTO ride_events (ride_id, type, actor_id) VALUES (%s,'ride_completed',%s)",
            (ride_id, g.user_id)
        )

        # Compute and store sustainability metrics
        co2 = compute_co2(
            float(ride["distance_km"] or 1),
            passengers=ride["passenger_count"] or 1,
        )
        cur.execute(
            """INSERT INTO sustainability
               (ride_id, distance_km, passengers, baseline_co2_kg, actual_co2_kg, co2_saved_kg, co2_per_km_used)
               VALUES (%s,%s,%s,%s,%s,%s,%s)
               ON CONFLICT (ride_id) DO NOTHING""",
            (ride_id, co2["distance_km"], co2["passengers"],
             co2["baseline_co2_kg"], co2["actual_co2_kg"],
             co2["co2_saved_kg"], co2["co2_per_km_used"])
        )

    socketio = _get_socketio()
    socketio.emit("ride_status_update", {"ride_id": ride_id, "status": "completed"}, to=f"ride_{ride_id}")

    return jsonify({
        "ride_id": ride_id,
        "status": "completed",
        "co2_saved_kg": co2["co2_saved_kg"],
    }), 200


# ─── Rate after ride ─────────────────────────────────────────


@rides_bp.route("/<ride_id>/rate", methods=["POST"])
@require_auth
def rate_ride(ride_id: str):
    """
    POST /rides/{rideId}/rate
    Body: { score (1-5), comment? }
    """
    data = request.get_json(silent=True) or {}
    try:
        score = int(data["score"])
        assert 1 <= score <= 5
    except (KeyError, ValueError, AssertionError):
        return jsonify({"error": "validation", "message": "score must be an integer 1-5"}), 400

    comment = data.get("comment", "")

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT rider_id, driver_id, status FROM rides WHERE id=%s", (ride_id,)
        )
        ride = cur.fetchone()
        if not ride:
            return jsonify({"error": "not_found", "message": "Ride not found"}), 404
        if ride["status"] != "completed":
            return jsonify({"error": "invalid_state", "message": "Can only rate completed rides"}), 409

        rider_id = str(ride["rider_id"])
        driver_id = str(ride["driver_id"])

        if g.user_id == rider_id:
            to_user = driver_id
        elif g.user_id == driver_id:
            to_user = rider_id
        else:
            return jsonify({"error": "forbidden", "message": "Not a participant in this ride"}), 403

        try:
            cur.execute(
                """INSERT INTO ratings (ride_id, from_user_id, to_user_id, score, comment)
                   VALUES (%s,%s,%s,%s,%s)""",
                (ride_id, g.user_id, to_user, score, comment)
            )
        except Exception:
            return jsonify({"error": "conflict", "message": "You have already rated this ride"}), 409

        cur.execute(
            "INSERT INTO ride_events (ride_id, type, actor_id) VALUES (%s,'rated',%s)",
            (ride_id, g.user_id)
        )

    return jsonify({"message": "Rating submitted", "score": score}), 201


# ─── Get ride details ─────────────────────────────────────────


@rides_bp.route("/<ride_id>", methods=["GET"])
@require_auth
def get_ride(ride_id: str):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT r.*,
                      u_rider.name as rider_name,
                      u_driver.name as driver_name,
                      dp.car_make, dp.car_model, dp.car_color, dp.car_plate,
                      u_driver.rating_avg_driver
               FROM rides r
               LEFT JOIN users u_rider ON u_rider.id = r.rider_id
               LEFT JOIN users u_driver ON u_driver.id = r.driver_id
               LEFT JOIN driver_profiles dp ON dp.user_id = r.driver_id
               WHERE r.id = %s""",
            (ride_id,)
        )
        ride = cur.fetchone()
        if not ride:
            return jsonify({"error": "not_found", "message": "Ride not found"}), 404
        if g.user_id not in (str(ride["rider_id"]), str(ride["driver_id"])):
            return jsonify({"error": "forbidden", "message": "Not your ride"}), 403

    return jsonify({k: str(v) if isinstance(v, uuid.UUID) else v for k, v in dict(ride).items()}), 200


# ─── Signal accept/decline from driver (internal use by socket handler) ──────


def handle_ride_accept(ride_id: str, driver_id: str):
    with _sessions_lock:
        session = _matching_sessions.get(ride_id)
    if session:
        session.signal_accept(driver_id)


def handle_ride_decline(ride_id: str):
    with _sessions_lock:
        session = _matching_sessions.get(ride_id)
    if session:
        session.signal_decline()
