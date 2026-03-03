from functools import wraps
from flask import request, jsonify, g
from app.jwt_utils import decode_token
import jwt


def require_auth(f):
    """Decorator: validates JWT access token and sets g.user_id, g.user_role."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "unauthorized", "message": "Missing or invalid Authorization header"}), 401

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
