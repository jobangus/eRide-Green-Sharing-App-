"""
pytest coverage for R1, R2, R6, R7, R8 — Mo-Ride auth service.

R1: Monash-only email registration and rejection of non-Monash domains (Security, FR)
R2: Secure login/logout functionality for authenticated users (User Authentication, FR)
R6: User profile data not accessible by other users/drivers (Profile Management, FR)
R7: Simple intuitive interface — tested via consistent API error response format (Usability, NFR)
R8: Encrypted credential storage — bcrypt passwords, SHA-256 token hashes, JWT (Security, NFR)
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

os.environ.setdefault('DATABASE_URL', 'postgresql://test:test@localhost/test')
os.environ.setdefault('REDIS_URL', 'redis://localhost:6379/0')
os.environ.setdefault('JWT_SECRET', 'test_secret')
os.environ.setdefault('FLASK_ENV', 'development')
os.environ.setdefault('MINIO_ENDPOINT', 'localhost:9000')
os.environ.setdefault('MINIO_ACCESS_KEY', 'minioadmin')
os.environ.setdefault('MINIO_SECRET_KEY', 'minioadmin')
os.environ.setdefault('MINIO_BUCKET_PROFILES', 'profiles')
os.environ.setdefault('SMTP_HOST', 'localhost')
os.environ.setdefault('SMTP_PORT', '1025')
os.environ.setdefault('SMTP_FROM', 'test@monash.edu')

import pytest
from datetime import datetime, timedelta, timezone
from contextlib import contextmanager
from unittest.mock import MagicMock, patch
import jwt as _jwt

from app.routes.auth import _validate_monash_email, _validate_password
from app.jwt_utils import (
    hash_password, verify_password, hash_token,
    create_access_token, create_refresh_token, decode_token,
)
from app.config import Config
from app import create_app

# Pre-compute bcrypt hash once to avoid 12-round cost per test
BCRYPT_HASH = hash_password("Password123!")
TEST_USER_ID = "11111111-1111-1111-1111-111111111111"
TEST_EMAIL = "nicolas@monash.edu"


# ─── DB mock helper ───────────────────────────────────────────────────────────

def make_db_mock(fetchone_return=None, fetchall_return=None):
    """Return (mock_get_db, mock_cursor) for patching get_db in routes."""
    mock_cursor = MagicMock()
    mock_cursor.fetchone.return_value = fetchone_return
    mock_cursor.fetchall.return_value = fetchall_return or []
    mock_conn = MagicMock()
    mock_conn.cursor.return_value = mock_cursor

    @contextmanager
    def _mock():
        yield mock_conn

    return _mock, mock_cursor


@pytest.fixture
def client():
    app = create_app()
    app.config['TESTING'] = True
    return app.test_client()


def _auth_header():
    token = create_access_token(TEST_USER_ID, TEST_EMAIL, 'rider')
    return {'Authorization': f'Bearer {token}'}


# ─── R1: Monash email domain validation ──────────────────────────────────────

class TestMonashEmailValidation:
    """R1 — Only @monash.edu addresses are accepted for registration."""

    def test_valid_monash_email_accepted(self):
        assert _validate_monash_email("student@monash.edu") is True

    def test_gmail_rejected(self):
        assert _validate_monash_email("student@gmail.com") is False

    def test_uppercase_monash_accepted(self):
        # Route lowercases on line 21 of auth.py: email.lower().strip().endswith(...)
        assert _validate_monash_email("NICOLAS@MONASH.EDU") is True

    def test_empty_string_rejected(self):
        assert _validate_monash_email("") is False

    def test_no_at_symbol_rejected(self):
        assert _validate_monash_email("studentmonash.edu") is False

    def test_subdomain_rejected(self):
        # user@cs.monash.edu does NOT end with @monash.edu
        assert _validate_monash_email("user@cs.monash.edu") is False

    def test_non_string_rejected(self):
        assert _validate_monash_email(None) is False


# ─── R1 / R8: Password strength requirements ─────────────────────────────────

class TestPasswordValidation:
    """R1/R8 — Password must be 8+ chars, 1 uppercase, 1 digit."""

    def test_valid_password_returns_none(self):
        assert _validate_password("Password1") is None

    def test_too_short_returns_error(self):
        result = _validate_password("Ab1")
        assert result is not None
        assert "8" in result

    def test_no_uppercase_returns_error(self):
        result = _validate_password("password1")
        assert result is not None

    def test_no_digit_returns_error(self):
        result = _validate_password("Passwordx")
        assert result is not None

    def test_exactly_8_chars_valid(self):
        assert _validate_password("Passwrd1") is None


# ─── R8: Encrypted credential storage ────────────────────────────────────────

class TestEncryption:
    """R8 — bcrypt password hashing, SHA-256 token hashing, JWT generation/validation."""

    def test_hash_password_produces_bcrypt_prefix(self):
        h = hash_password("Secret99")
        assert h.startswith("$2b$") or h.startswith("$2a$")

    def test_verify_password_correct(self):
        assert verify_password("Password123!", BCRYPT_HASH) is True

    def test_verify_password_wrong_returns_false(self):
        assert verify_password("wrongpassword", BCRYPT_HASH) is False

    def test_hash_token_is_64_char_hex(self):
        # SHA-256 produces a 64-character hex digest
        h = hash_token("some_refresh_token_value")
        assert len(h) == 64
        assert all(c in "0123456789abcdef" for c in h)

    def test_hash_token_deterministic(self):
        assert hash_token("abc") == hash_token("abc")

    def test_create_access_token_contains_sub_email_role(self):
        token = create_access_token("user-1", "a@monash.edu", "rider")
        payload = decode_token(token)
        assert payload["sub"] == "user-1"
        assert payload["email"] == "a@monash.edu"
        assert payload["role"] == "rider"

    def test_access_token_type_claim_is_access(self):
        token = create_access_token("user-1", "a@monash.edu", "rider")
        assert decode_token(token)["type"] == "access"

    def test_create_refresh_token_type_claim_is_refresh(self):
        token = create_refresh_token("user-1")
        payload = decode_token(token)
        assert payload["type"] == "refresh"
        assert payload["sub"] == "user-1"

    def test_decode_token_roundtrip(self):
        token = create_access_token("uid-42", "b@monash.edu", "driver")
        assert decode_token(token)["sub"] == "uid-42"

    def test_expired_token_raises_ExpiredSignatureError(self):
        expired_payload = {
            "sub": "user-1",
            "type": "access",
            "iat": datetime.now(timezone.utc) - timedelta(seconds=2),
            "exp": datetime.now(timezone.utc) - timedelta(seconds=1),
        }
        token = _jwt.encode(expired_payload, Config.JWT_SECRET, algorithm="HS256")
        with pytest.raises(_jwt.ExpiredSignatureError):
            decode_token(token)


# ─── R1: Register route (Monash enforcement end-to-end) ──────────────────────

class TestRegisterRoute:
    """R1 (domain enforcement via HTTP) and R7 (error response format)."""

    def test_non_monash_email_returns_400_invalid_email(self, client):
        mock_db, _ = make_db_mock()
        with patch('app.routes.auth.get_db', mock_db), \
             patch('app.routes.auth.send_otp_email'):
            resp = client.post('/auth/register', json={
                "email": "student@gmail.com", "password": "Password1", "name": "Test"
            })
        assert resp.status_code == 400
        assert resp.get_json()["error"] == "invalid_email"

    def test_missing_email_returns_400(self, client):
        resp = client.post('/auth/register', json={"password": "Password1", "name": "Test"})
        assert resp.status_code == 400

    def test_missing_name_returns_400(self, client):
        mock_db, _ = make_db_mock()
        with patch('app.routes.auth.get_db', mock_db), \
             patch('app.routes.auth.send_otp_email'):
            resp = client.post('/auth/register', json={
                "email": "test@monash.edu", "password": "Password1", "name": ""
            })
        assert resp.status_code == 400

    def test_weak_password_returns_400(self, client):
        mock_db, _ = make_db_mock()
        with patch('app.routes.auth.get_db', mock_db), \
             patch('app.routes.auth.send_otp_email'):
            resp = client.post('/auth/register', json={
                "email": "test@monash.edu", "password": "weak", "name": "Test"
            })
        assert resp.status_code == 400

    def test_duplicate_verified_returns_409(self, client):
        mock_db, mock_cur = make_db_mock()
        mock_cur.fetchone.return_value = {"id": TEST_USER_ID, "is_verified": True}
        with patch('app.routes.auth.get_db', mock_db), \
             patch('app.routes.auth.send_otp_email'):
            resp = client.post('/auth/register', json={
                "email": "test@monash.edu", "password": "Password1", "name": "Test"
            })
        assert resp.status_code == 409

    def test_successful_register_returns_201(self, client):
        mock_db, mock_cur = make_db_mock()
        # register calls fetchone twice: existing-check (None) + INSERT RETURNING id
        mock_cur.fetchone.side_effect = [None, {"id": TEST_USER_ID}]
        with patch('app.routes.auth.get_db', mock_db), \
             patch('app.routes.auth.send_otp_email'):
            resp = client.post('/auth/register', json={
                "email": "new@monash.edu", "password": "Password1", "name": "New User"
            })
        assert resp.status_code == 201

    def test_error_response_always_has_error_and_message_keys(self, client):
        """R7: Every error must carry both 'error' (machine code) and 'message' (human text)."""
        resp = client.post('/auth/register', json={
            "email": "bad@gmail.com", "password": "x", "name": "T"
        })
        body = resp.get_json()
        assert "error" in body
        assert "message" in body
        assert isinstance(body["message"], str) and len(body["message"]) > 0


# ─── R2: Login route ─────────────────────────────────────────────────────────

class TestLoginRoute:
    """R2 — Secure login and R7 — consistent error format."""

    def test_missing_fields_returns_400(self, client):
        resp = client.post('/auth/login', json={})
        assert resp.status_code == 400

    def test_wrong_password_returns_401(self, client):
        mock_db, mock_cur = make_db_mock()
        mock_cur.fetchone.return_value = {
            "id": TEST_USER_ID, "password_hash": BCRYPT_HASH,
            "name": "Test", "role": "rider", "is_verified": True, "is_active": True,
        }
        with patch('app.routes.auth.get_db', mock_db):
            resp = client.post('/auth/login', json={
                "email": TEST_EMAIL, "password": "WrongPass99"
            })
        assert resp.status_code == 401

    def test_unverified_user_returns_403(self, client):
        mock_db, mock_cur = make_db_mock()
        mock_cur.fetchone.return_value = {
            "id": TEST_USER_ID, "password_hash": BCRYPT_HASH,
            "name": "Test", "role": "rider", "is_verified": False, "is_active": True,
        }
        with patch('app.routes.auth.get_db', mock_db):
            resp = client.post('/auth/login', json={
                "email": TEST_EMAIL, "password": "Password123!"
            })
        assert resp.status_code == 403

    def test_inactive_user_returns_403(self, client):
        mock_db, mock_cur = make_db_mock()
        mock_cur.fetchone.return_value = {
            "id": TEST_USER_ID, "password_hash": BCRYPT_HASH,
            "name": "Test", "role": "rider", "is_verified": True, "is_active": False,
        }
        with patch('app.routes.auth.get_db', mock_db):
            resp = client.post('/auth/login', json={
                "email": TEST_EMAIL, "password": "Password123!"
            })
        assert resp.status_code == 403

    def test_success_returns_access_and_refresh_tokens(self, client):
        mock_db, mock_cur = make_db_mock()
        mock_cur.fetchone.return_value = {
            "id": TEST_USER_ID, "password_hash": BCRYPT_HASH,
            "name": "Nicolas", "role": "rider", "is_verified": True, "is_active": True,
        }
        with patch('app.routes.auth.get_db', mock_db):
            resp = client.post('/auth/login', json={
                "email": TEST_EMAIL, "password": "Password123!"
            })
        assert resp.status_code == 200
        body = resp.get_json()
        assert "access_token" in body
        assert "refresh_token" in body
        assert body["token_type"] == "Bearer"

    def test_success_response_contains_user_object(self, client):
        mock_db, mock_cur = make_db_mock()
        mock_cur.fetchone.return_value = {
            "id": TEST_USER_ID, "password_hash": BCRYPT_HASH,
            "name": "Nicolas", "role": "rider", "is_verified": True, "is_active": True,
        }
        with patch('app.routes.auth.get_db', mock_db):
            resp = client.post('/auth/login', json={
                "email": TEST_EMAIL, "password": "Password123!"
            })
        user = resp.get_json()["user"]
        assert user["email"] == TEST_EMAIL
        assert user["role"] == "rider"

    def test_error_response_has_error_and_message_keys(self, client):
        """R7: Login errors must include 'error' and human-readable 'message'."""
        resp = client.post('/auth/login', json={})
        body = resp.get_json()
        assert "error" in body
        assert "message" in body


# ─── R2: Logout route ────────────────────────────────────────────────────────

class TestLogoutRoute:
    """R2 — Secure logout revokes the refresh token."""

    def test_logout_without_auth_returns_401(self, client):
        resp = client.post('/auth/logout')
        assert resp.status_code == 401

    def test_logout_with_valid_token_returns_200(self, client):
        mock_db, _ = make_db_mock()
        with patch('app.routes.auth.get_db', mock_db):
            resp = client.post('/auth/logout', headers=_auth_header())
        assert resp.status_code == 200

    def test_logout_clears_refresh_token_in_db(self, client):
        mock_db, mock_cur = make_db_mock()
        with patch('app.routes.auth.get_db', mock_db):
            client.post('/auth/logout', headers=_auth_header())
        sql_calls = [str(c) for c in mock_cur.execute.call_args_list]
        assert any("refresh_token_hash" in s for s in sql_calls)


# ─── R6: Profile privacy ──────────────────────────────────────────────────────

class TestProfilePrivacy:
    """R6 — Profile data is only accessible to the authenticated user themselves."""

    def test_get_me_without_auth_returns_401(self, client):
        resp = client.get('/me')
        assert resp.status_code == 401

    def test_get_me_with_valid_token_returns_own_profile_only(self, client):
        """R6: /me is scoped to g.user_id from JWT — no user_id parameter in URL."""
        mock_db, mock_cur = make_db_mock()
        mock_cur.fetchone.return_value = {
            "id": TEST_USER_ID, "email": TEST_EMAIL, "name": "Nicolas",
            "phone": None, "role": "rider", "is_verified": True,
            "profile_photo_url": None,
            "rating_avg_driver": None, "rating_count_driver": 0,
            "rating_avg_rider": None, "rating_count_rider": 0,
            "created_at": datetime.now(timezone.utc),
        }
        with patch('app.routes.users.get_db', mock_db):
            resp = client.get('/me', headers=_auth_header())
        assert resp.status_code == 200
        assert resp.get_json()["id"] == TEST_USER_ID

    def test_update_me_without_auth_returns_401(self, client):
        resp = client.patch('/me', json={"name": "Attacker"})
        assert resp.status_code == 401
