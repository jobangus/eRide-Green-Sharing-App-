from flask import Blueprint, request, jsonify, g
from app.db import get_db
from app.auth_middleware import require_auth
import boto3
from botocore.client import Config as BotoConfig
from app.config import Config

users_bp = Blueprint("users", __name__)


def _get_minio_client():
    return boto3.client(
        "s3",
        endpoint_url=f"http{'s' if Config.MINIO_USE_SSL else ''}://{Config.MINIO_ENDPOINT}",
        aws_access_key_id=Config.MINIO_ACCESS_KEY,
        aws_secret_access_key=Config.MINIO_SECRET_KEY,
        config=BotoConfig(signature_version="s3v4"),
    )


@users_bp.route("/me", methods=["GET"])
@require_auth
def get_me():
    """GET /me — returns authenticated user's profile."""
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT id, email, name, phone, role, is_verified, profile_photo_url,
                      rating_avg_driver, rating_count_driver,
                      rating_avg_rider, rating_count_rider,
                      created_at
               FROM users WHERE id = %s""",
            (g.user_id,)
        )
        user = cur.fetchone()
        if not user:
            return jsonify({"error": "not_found", "message": "User not found"}), 404

        # Also fetch driver profile if applicable
        driver_profile = None
        if user["role"] in ("driver", "both"):
            cur.execute(
                """SELECT car_make, car_model, car_year, car_color, car_plate,
                          is_verified, is_online, last_online_at
                   FROM driver_profiles WHERE user_id = %s""",
                (g.user_id,)
            )
            dp = cur.fetchone()
            if dp:
                driver_profile = dict(dp)

    return jsonify({
        "id": str(user["id"]),
        "email": user["email"],
        "name": user["name"],
        "phone": user["phone"],
        "role": user["role"],
        "is_verified": user["is_verified"],
        "profile_photo_url": user["profile_photo_url"],
        "ratings": {
            "as_driver": {
                "average": float(user["rating_avg_driver"]) if user["rating_avg_driver"] else None,
                "count": user["rating_count_driver"]
            },
            "as_rider": {
                "average": float(user["rating_avg_rider"]) if user["rating_avg_rider"] else None,
                "count": user["rating_count_rider"]
            }
        },
        "driver_profile": driver_profile,
        "created_at": user["created_at"].isoformat()
    }), 200


@users_bp.route("/me", methods=["PATCH"])
@require_auth
def update_me():
    """PATCH /me — update name, phone; create/update driver profile."""
    data = request.get_json(silent=True) or {}
    allowed = ["name", "phone"]
    updates = {k: v for k, v in data.items() if k in allowed and v is not None}

    with get_db() as conn:
        cur = conn.cursor()
        if updates:
            set_clause = ", ".join(f"{k}=%s" for k in updates)
            values = list(updates.values()) + [g.user_id]
            cur.execute(f"UPDATE users SET {set_clause} WHERE id=%s", values)

        # Handle driver profile upsert
        dp_data = data.get("driver_profile")
        if dp_data:
            dp_fields = ["car_make", "car_model", "car_year", "car_color", "car_plate"]
            dp_updates = {k: dp_data[k] for k in dp_fields if k in dp_data}
            if dp_updates:
                # Check if profile exists
                cur.execute("SELECT id FROM driver_profiles WHERE user_id=%s", (g.user_id,))
                if cur.fetchone():
                    set_clause = ", ".join(f"{k}=%s" for k in dp_updates)
                    values = list(dp_updates.values()) + [g.user_id]
                    cur.execute(f"UPDATE driver_profiles SET {set_clause} WHERE user_id=%s", values)
                else:
                    dp_updates["user_id"] = g.user_id
                    cols = ", ".join(dp_updates.keys())
                    placeholders = ", ".join(["%s"] * len(dp_updates))
                    cur.execute(
                        f"INSERT INTO driver_profiles ({cols}) VALUES ({placeholders})",
                        list(dp_updates.values())
                    )

    return jsonify({"message": "Profile updated successfully"}), 200


@users_bp.route("/me/photo", methods=["POST"])
@require_auth
def upload_photo():
    """POST /me/photo — upload profile photo to MinIO."""
    if "photo" not in request.files:
        return jsonify({"error": "validation", "message": "No photo file provided"}), 400

    file = request.files["photo"]
    if not file.content_type.startswith("image/"):
        return jsonify({"error": "validation", "message": "File must be an image"}), 400

    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else "jpg"
    key = f"profiles/{g.user_id}.{ext}"

    try:
        s3 = _get_minio_client()
        # Ensure bucket exists
        try:
            s3.head_bucket(Bucket=Config.MINIO_BUCKET_PROFILES)
        except Exception:
            s3.create_bucket(Bucket=Config.MINIO_BUCKET_PROFILES)

        s3.upload_fileobj(
            file,
            Config.MINIO_BUCKET_PROFILES,
            key,
            ExtraArgs={"ContentType": file.content_type}
        )
        url = f"http://{Config.MINIO_ENDPOINT}/{Config.MINIO_BUCKET_PROFILES}/{key}"

        with get_db() as conn:
            cur = conn.cursor()
            cur.execute("UPDATE users SET profile_photo_url=%s WHERE id=%s", (url, g.user_id))

        return jsonify({"photo_url": url}), 200
    except Exception as e:
        return jsonify({"error": "upload_failed", "message": str(e)}), 500
