from flask import Blueprint, jsonify, g
from app.db import get_db
from app.auth_middleware import require_auth

sustainability_bp = Blueprint("sustainability", __name__)


@sustainability_bp.route("/summary", methods=["GET"])
@require_auth
def summary():
    """GET /sustainability/summary — aggregated stats for current user."""
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT
                COUNT(DISTINCT r.id)          AS total_rides,
                COALESCE(SUM(s.distance_km),0)::FLOAT AS total_km,
                COALESCE(SUM(s.co2_saved_kg),0)::FLOAT AS total_co2_saved_kg,
                COALESCE(SUM(s.actual_co2_kg),0)::FLOAT AS total_actual_co2_kg,
                COALESCE(SUM(s.baseline_co2_kg),0)::FLOAT AS total_baseline_co2_kg
               FROM rides r
               JOIN sustainability s ON s.ride_id = r.id
               WHERE (r.rider_id = %s OR r.driver_id = %s)
                 AND r.status = 'completed'""",
            (g.user_id, g.user_id)
        )
        stats = cur.fetchone()

        # Weekly trend (last 8 weeks)
        cur.execute(
            """SELECT
                DATE_TRUNC('week', r.created_at) AS week,
                COUNT(r.id) AS rides,
                COALESCE(SUM(s.co2_saved_kg),0)::FLOAT AS co2_saved_kg
               FROM rides r
               JOIN sustainability s ON s.ride_id = r.id
               WHERE (r.rider_id = %s OR r.driver_id = %s)
                 AND r.status = 'completed'
                 AND r.created_at >= NOW() - INTERVAL '8 weeks'
               GROUP BY DATE_TRUNC('week', r.created_at)
               ORDER BY week ASC""",
            (g.user_id, g.user_id)
        )
        weekly = [
            {
                "week": row["week"].isoformat(),
                "rides": row["rides"],
                "co2_saved_kg": float(row["co2_saved_kg"]),
            }
            for row in cur.fetchall()
        ]

    co2_saved = float(stats["total_co2_saved_kg"] or 0)

    return jsonify({
        "total_rides": stats["total_rides"] or 0,
        "total_km": round(float(stats["total_km"] or 0), 2),
        "total_co2_saved_kg": round(co2_saved, 3),
        "total_actual_co2_kg": round(float(stats["total_actual_co2_kg"] or 0), 3),
        "total_baseline_co2_kg": round(float(stats["total_baseline_co2_kg"] or 0), 3),
        # Human-readable equivalents
        "equivalent_trees_hours": round(co2_saved / 0.021, 1),
        "equivalent_km_not_driven": round(co2_saved / 0.21, 1),
        "weekly_trend": weekly,
    }), 200


@sustainability_bp.route("/rides", methods=["GET"])
@require_auth
def ride_list():
    """GET /sustainability/rides — per-ride CO2 data for current user."""
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT
                r.id AS ride_id,
                r.created_at,
                r.pickup_address,
                r.dropoff_address,
                s.distance_km,
                s.co2_saved_kg,
                s.baseline_co2_kg,
                s.actual_co2_kg,
                s.passengers
               FROM rides r
               JOIN sustainability s ON s.ride_id = r.id
               WHERE (r.rider_id = %s OR r.driver_id = %s)
                 AND r.status = 'completed'
               ORDER BY r.created_at DESC
               LIMIT 50""",
            (g.user_id, g.user_id)
        )
        rides = [
            {
                "ride_id": str(row["ride_id"]),
                "created_at": row["created_at"].isoformat(),
                "pickup_address": row["pickup_address"],
                "dropoff_address": row["dropoff_address"],
                "distance_km": float(row["distance_km"]),
                "co2_saved_kg": float(row["co2_saved_kg"]),
                "baseline_co2_kg": float(row["baseline_co2_kg"]),
                "actual_co2_kg": float(row["actual_co2_kg"]),
                "passengers": row["passengers"],
            }
            for row in cur.fetchall()
        ]

    return jsonify({"rides": rides, "count": len(rides)}), 200
