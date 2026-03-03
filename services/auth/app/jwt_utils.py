from datetime import datetime, timedelta, timezone
import jwt
import bcrypt
import hashlib
from app.config import Config


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def hash_token(token: str) -> str:
    """SHA-256 hash of token for storage (refresh tokens)."""
    return hashlib.sha256(token.encode()).hexdigest()


def create_access_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "type": "access",
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=Config.JWT_ACCESS_EXPIRES_MINUTES),
    }
    return jwt.encode(payload, Config.JWT_SECRET, algorithm="HS256")


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "type": "refresh",
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(days=Config.JWT_REFRESH_EXPIRES_DAYS),
    }
    return jwt.encode(payload, Config.JWT_SECRET, algorithm="HS256")


def decode_token(token: str) -> dict:
    """Raises jwt.ExpiredSignatureError or jwt.InvalidTokenError on failure."""
    return jwt.decode(token, Config.JWT_SECRET, algorithms=["HS256"])
