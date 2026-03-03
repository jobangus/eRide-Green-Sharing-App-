from flask import Blueprint, request, jsonify, g, current_app
from app.db import get_db
from app.auth_middleware import require_auth

driver_bp = Blueprint("driver", __name__)


def _get_redis():
    return current_app.extensions["redis"]


@driver_bp.route("/go-online", methods=["POST"])
@require_auth
def go_online():
    """
    POST /driver/go-online
    Body: { lat, lng }
    Marks driver as online and registers location in Redis GEO index.
    """
    if g.user_role not in ("driver", "both"):
        return jsonify({"error": "forbidden", "message": "Only drivers can go online"}), 403

    data = request.get_json(silent=True) or {}
    try:
        lat = float(data["lat"])
        lng = float(data["lng"])
    except (KeyError, ValueError, TypeError):
        return jsonify({"error": "validation", "message": "lat and lng required"}), 400

    redis = _get_redis()

    # Add/update driver location in Redis GEO index
    redis.geoadd("driver_locations", (lng, lat, g.user_id))

    # Set driver metadata (for scoring)
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT rating_avg_driver FROM users WHERE id=%s", (g.user_id,)
        )
        user = cur.fetchone()
        rating = float(user["rating_avg_driver"]) if user and user["rating_avg_driver"] else 5.0

        cur.execute(
            """UPDATE driver_profiles SET is_online=TRUE, last_online_at=NOW()
               WHERE user_id=%s""",
            (g.user_id,)
        )
        # Create profile if it doesn't exist
        cur.execute(
            """INSERT INTO driver_profiles (user_id, is_online, last_online_at)
               VALUES (%s, TRUE, NOW())
               ON CONFLICT (user_id) DO UPDATE
               SET is_online=TRUE, last_online_at=NOW()""",
            (g.user_id,)
        )

    redis.hset(f"driver_meta:{g.user_id}", mapping={
        "rating": str(rating),
        "is_available": "1",
        "is_online": "1",
    })
    # TTL of 2 hours — driver must ping to stay online
    redis.expire(f"driver_meta:{g.user_id}", 7200)

    return jsonify({"status": "online", "lat": lat, "lng": lng}), 200


@driver_bp.route("/go-offline", methods=["POST"])
@require_auth
def go_offline():
    """POST /driver/go-offline"""
    if g.user_role not in ("driver", "both"):
        return jsonify({"error": "forbidden", "message": "Only drivers can update availability"}), 403

    redis = _get_redis()
    redis.zrem("driver_locations", g.user_id)
    redis.hset(f"driver_meta:{g.user_id}", "is_online", "0")

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE driver_profiles SET is_online=FALSE WHERE user_id=%s",
            (g.user_id,)
        )

    return jsonify({"status": "offline"}), 200


@driver_bp.route("/status", methods=["GET"])
@require_auth
def get_status():
    """GET /driver/status"""
    if g.user_role not in ("driver", "both"):
        return jsonify({"error": "forbidden", "message": "Not a driver account"}), 403

    redis = _get_redis()
    meta = redis.hgetall(f"driver_meta:{g.user_id}")
    is_online = meta.get(b"is_online", b"0") == b"1" if meta else False

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT is_online, last_online_at, car_make, car_model, car_plate
               FROM driver_profiles WHERE user_id=%s""",
            (g.user_id,)
        )
        profile = cur.fetchone()

    return jsonify({
        "is_online": is_online,
        "profile": dict(profile) if profile else None,
    }), 200


@driver_bp.route("/update-location", methods=["POST"])
@require_auth
def update_location():
    """
    POST /driver/update-location
    Body: { lat, lng }
    Updates driver's location in Redis GEO index.
    """
    if g.user_role not in ("driver", "both"):
        return jsonify({"error": "forbidden"}), 403

    data = request.get_json(silent=True) or {}
    try:
        lat = float(data["lat"])
        lng = float(data["lng"])
    except (KeyError, ValueError, TypeError):
        return jsonify({"error": "validation", "message": "lat and lng required"}), 400

    redis = _get_redis()
    redis.geoadd("driver_locations", (lng, lat, g.user_id))
    redis.expire(f"driver_meta:{g.user_id}", 7200)

    return jsonify({"updated": True}), 200
