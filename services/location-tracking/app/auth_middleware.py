from functools import wraps
from flask import request, jsonify, g
import jwt
from app.config import Config


def get_user_from_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, Config.JWT_SECRET, algorithms=["HS256"])
        if payload.get("type") != "access":
            return None
        return {"user_id": payload["sub"], "role": payload["role"]}
    except Exception:
        return None


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "unauthorized"}), 401
        token = auth_header[7:]
        user = get_user_from_token(token)
        if not user:
            return jsonify({"error": "unauthorized"}), 401
        g.user_id = user["user_id"]
        g.user_role = user["role"]
        return f(*args, **kwargs)
    return decorated
