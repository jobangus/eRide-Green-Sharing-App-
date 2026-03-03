from functools import wraps
from flask import request, jsonify, g
import jwt
from app.config import Config


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "unauthorized"}), 401
        token = auth_header[7:]
        try:
            payload = jwt.decode(token, Config.JWT_SECRET, algorithms=["HS256"])
            if payload.get("type") != "access":
                return jsonify({"error": "unauthorized"}), 401
            g.user_id = payload["sub"]
            g.user_role = payload["role"]
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "token_expired"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated
