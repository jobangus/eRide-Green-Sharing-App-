from functools import wraps
from flask import request, jsonify, g
import jwt
from app.config import Config


def decode_token(token: str) -> dict:
    return jwt.decode(token, Config.JWT_SECRET, algorithms=["HS256"])


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "unauthorized", "message": "Missing Authorization header"}), 401
        token = auth_header[7:]
        try:
            payload = decode_token(token)
            if payload.get("type") != "access":
                return jsonify({"error": "unauthorized", "message": "Invalid token type"}), 401
            g.user_id = payload["sub"]
            g.user_email = payload["email"]
            g.user_role = payload["role"]
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "token_expired", "message": "Access token has expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "unauthorized", "message": "Invalid token"}), 401
        return f(*args, **kwargs)
    return decorated


def get_user_from_token(token: str) -> dict | None:
    """Used by Socket.IO to authenticate connections."""
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            return None
        return {"user_id": payload["sub"], "role": payload["role"], "email": payload["email"]}
    except Exception:
        return None
