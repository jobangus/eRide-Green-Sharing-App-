from flask import Blueprint, request, jsonify, g
from datetime import datetime, timedelta, timezone
from app.db import get_db
from app.jwt_utils import (
    hash_password, verify_password, hash_token,
    create_access_token, create_refresh_token, decode_token
)
from app.email_utils import generate_otp, send_otp_email
from app.config import Config
from app.auth_middleware import require_auth
import jwt
import re

auth_bp = Blueprint("auth", __name__)

MONASH_DOMAIN = "@monash.edu"


def _validate_monash_email(email: str) -> bool:
    """Accept only @monash.edu addresses (case-insensitive)."""
    return isinstance(email, str) and email.lower().strip().endswith(MONASH_DOMAIN)


def _validate_password(password: str) -> str | None:
    """Returns error message or None if valid."""
    if len(password) < 8:
        return "Password must be at least 8 characters"
    if not re.search(r"[A-Z]", password):
        return "Password must contain at least one uppercase letter"
    if not re.search(r"[0-9]", password):
        return "Password must contain at least one number"
    return None


@auth_bp.route("/register", methods=["POST"])
def register():
    """
    POST /auth/register
    Body: { email, password, name, phone?, role? }
    """
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").lower().strip()
    password = data.get("password", "")
    name = (data.get("name") or "").strip()
    phone = (data.get("phone") or "").strip() or None
    role = data.get("role", "rider")

    # Validate
    if not email:
        return jsonify({"error": "validation", "message": "Email is required"}), 400
    if not _validate_monash_email(email):
        return jsonify({
            "error": "invalid_email",
            "message": "Only @monash.edu email addresses are accepted"
        }), 400
    if not name:
        return jsonify({"error": "validation", "message": "Name is required"}), 400
    pw_error = _validate_password(password)
    if pw_error:
        return jsonify({"error": "validation", "message": pw_error}), 400
    if role not in ("rider", "driver", "both"):
        role = "rider"

    otp = generate_otp()
    otp_expires = datetime.now(timezone.utc) + timedelta(minutes=Config.OTP_EXPIRY_MINUTES)

    with get_db() as conn:
        cur = conn.cursor()
        # Check existing
        cur.execute("SELECT id, is_verified FROM users WHERE email = %s", (email,))
        existing = cur.fetchone()
        if existing and existing["is_verified"]:
            return jsonify({"error": "conflict", "message": "An account with this email already exists"}), 409

        pw_hash = hash_password(password)

        if existing:
            # Resend OTP for unverified account
            cur.execute(
                "UPDATE users SET otp_code=%s, otp_expires_at=%s, password_hash=%s, name=%s WHERE email=%s RETURNING id",
                (otp, otp_expires, pw_hash, name, email)
            )
            user_id = cur.fetchone()["id"]
        else:
            cur.execute(
                """INSERT INTO users (email, password_hash, name, phone, role, otp_code, otp_expires_at)
                   VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id""",
                (email, pw_hash, name, phone, role, otp, otp_expires)
            )
            user_id = cur.fetchone()["id"]

    # Send OTP email (best-effort — dev uses Mailhog)
    try:
        send_otp_email(email, otp, name)
    except Exception as e:
        print(f"[register] Email send failed (dev mode ok): {e}")

    return jsonify({
        "message": "Registration successful. Please verify your email.",
        "user_id": str(user_id),
        # In dev mode, return OTP in response for easy testing
        **({"otp": otp} if Config.FLASK_ENV == "development" else {})
    }), 201


@auth_bp.route("/verify-otp", methods=["POST"])
def verify_otp():
    """
    POST /auth/verify-otp
    Body: { email, otp }
    """
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").lower().strip()
    otp = (data.get("otp") or "").strip()

    if not email or not otp:
        return jsonify({"error": "validation", "message": "Email and OTP are required"}), 400

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, otp_code, otp_expires_at, is_verified, role FROM users WHERE email = %s",
            (email,)
        )
        user = cur.fetchone()
        if not user:
            return jsonify({"error": "not_found", "message": "No account found for this email"}), 404
        if user["is_verified"]:
            return jsonify({"message": "Account already verified"}), 200
        if user["otp_code"] != otp:
            return jsonify({"error": "invalid_otp", "message": "Incorrect verification code"}), 400
        if user["otp_expires_at"].replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
            return jsonify({"error": "otp_expired", "message": "Verification code has expired. Please register again."}), 400

        cur.execute(
            "UPDATE users SET is_verified=TRUE, otp_code=NULL, otp_expires_at=NULL WHERE id=%s",
            (str(user["id"]),)
        )

    return jsonify({"message": "Email verified successfully. You can now log in."}), 200


@auth_bp.route("/login", methods=["POST"])
def login():
    """
    POST /auth/login
    Body: { email, password }
    """
    data = request.get_json(silent=True) or {}
    email = (data.get("email") or "").lower().strip()
    password = data.get("password", "")

    if not email or not password:
        return jsonify({"error": "validation", "message": "Email and password are required"}), 400

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, password_hash, name, role, is_verified, is_active FROM users WHERE email = %s",
            (email,)
        )
        user = cur.fetchone()

        if not user or not verify_password(password, user["password_hash"]):
            return jsonify({"error": "invalid_credentials", "message": "Invalid email or password"}), 401
        if not user["is_verified"]:
            return jsonify({"error": "unverified", "message": "Please verify your email before logging in"}), 403
        if not user["is_active"]:
            return jsonify({"error": "inactive", "message": "Account is deactivated"}), 403

        user_id = str(user["id"])
        access_token = create_access_token(user_id, email, user["role"])
        refresh_token = create_refresh_token(user_id)
        rt_hash = hash_token(refresh_token)

        cur.execute(
            "UPDATE users SET refresh_token_hash=%s, last_login_at=NOW() WHERE id=%s",
            (rt_hash, user_id)
        )

    return jsonify({
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "Bearer",
        "user": {"id": user_id, "name": user["name"], "email": email, "role": user["role"]}
    }), 200


@auth_bp.route("/refresh", methods=["POST"])
def refresh():
    """
    POST /auth/refresh
    Body: { refresh_token }
    """
    data = request.get_json(silent=True) or {}
    raw_refresh = data.get("refresh_token", "")

    if not raw_refresh:
        return jsonify({"error": "validation", "message": "refresh_token is required"}), 400

    try:
        payload = decode_token(raw_refresh)
    except jwt.ExpiredSignatureError:
        return jsonify({"error": "token_expired", "message": "Refresh token has expired"}), 401
    except jwt.InvalidTokenError:
        return jsonify({"error": "unauthorized", "message": "Invalid refresh token"}), 401

    if payload.get("type") != "refresh":
        return jsonify({"error": "unauthorized", "message": "Invalid token type"}), 401

    user_id = payload["sub"]
    token_hash = hash_token(raw_refresh)

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT id, email, role, refresh_token_hash, is_active FROM users WHERE id=%s",
            (user_id,)
        )
        user = cur.fetchone()
        if not user or user["refresh_token_hash"] != token_hash:
            return jsonify({"error": "unauthorized", "message": "Refresh token is no longer valid"}), 401
        if not user["is_active"]:
            return jsonify({"error": "inactive", "message": "Account is deactivated"}), 403

        new_access = create_access_token(user_id, user["email"], user["role"])
        new_refresh = create_refresh_token(user_id)
        cur.execute(
            "UPDATE users SET refresh_token_hash=%s WHERE id=%s",
            (hash_token(new_refresh), user_id)
        )

    return jsonify({
        "access_token": new_access,
        "refresh_token": new_refresh,
        "token_type": "Bearer"
    }), 200


@auth_bp.route("/logout", methods=["POST"])
@require_auth
def logout():
    """
    POST /auth/logout
    Header: Authorization: Bearer <access_token>
    """
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "UPDATE users SET refresh_token_hash=NULL WHERE id=%s",
            (g.user_id,)
        )
    return jsonify({"message": "Logged out successfully"}), 200
