"""
pytest coverage for R5, R6, R7 — Mo-Ride payments service.

R5: Automated cost-splitting payment between riders (Payment, FR)
R6: User profile/payment data not accessible by other users (Profile Management, FR)
R7: Simple intuitive interface — tested via API error format and response completeness (Usability, NFR)
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

os.environ.setdefault('DATABASE_URL', 'postgresql://test:test@localhost/test')
os.environ.setdefault('JWT_SECRET', 'test_secret')
os.environ.setdefault('STRIPE_SECRET_KEY', '')        # empty → dev mode throughout
os.environ.setdefault('STRIPE_WEBHOOK_SECRET', '')
os.environ.setdefault('FLASK_ENV', 'development')

import pytest
from datetime import datetime, timedelta, timezone
from contextlib import contextmanager
from unittest.mock import MagicMock, patch
import jwt as _jwt

from app.routes.payments import _dollars_to_cents
from app import create_app

TEST_RIDER_ID = "aaaa1111-2222-3333-4444-555566667777"
TEST_DRIVER_ID = "bbbb1111-2222-3333-4444-555566667777"
TEST_THIRD_ID = "cccc1111-2222-3333-4444-555566667777"
TEST_RIDE_ID = "ride1111-2222-3333-4444-555566667777"


# ─── DB mock helper ───────────────────────────────────────────────────────────

def make_db_mock(fetchone_return=None, fetchall_return=None):
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


def _auth_header(user_id: str = TEST_RIDER_ID, role: str = 'rider') -> dict:
    payload = {
        "sub": user_id,
        "email": "test@monash.edu",
        "role": role,
        "type": "access",
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=30),
    }
    token = _jwt.encode(payload, "test_secret", algorithm="HS256")
    return {'Authorization': f'Bearer {token}'}


# ─── R5: AUD to cents conversion ─────────────────────────────────────────────

class TestDollarsToCents:
    """R5 — Correct fare conversion for Stripe payment intent (AUD → cents)."""

    def test_standard_10_dollars_to_1000_cents(self):
        assert _dollars_to_cents(10.00) == 1000

    def test_minimum_50_cents_enforced(self):
        # Stripe floor: amounts below 50 cents must be raised to 50
        assert _dollars_to_cents(0.10) == 50

    def test_large_fare_converts_correctly(self):
        assert _dollars_to_cents(25.50) == 2550

    def test_rounding_correct(self):
        # $14.995 rounds to $15.00 → 1500 cents
        assert _dollars_to_cents(14.995) == 1500


# ─── R5: Create payment intent (dev mode) ────────────────────────────────────

class TestCreateIntentRoute:
    """R5 — Payment intent creation; R7 — error response format."""

    def test_unauthenticated_returns_401(self, client):
        resp = client.post('/payments/create-intent', json={"ride_id": TEST_RIDE_ID})
        assert resp.status_code == 401

    def test_ride_not_found_returns_404(self, client):
        mock_db, mock_cur = make_db_mock()
        mock_cur.fetchone.return_value = None
        with patch('app.routes.payments.get_db', mock_db):
            resp = client.post('/payments/create-intent',
                               json={"ride_id": TEST_RIDE_ID},
                               headers=_auth_header())
        assert resp.status_code == 404

    def test_wrong_ride_status_returns_409(self, client):
        mock_db, mock_cur = make_db_mock()
        mock_cur.fetchone.return_value = {
            "rider_id": TEST_RIDER_ID, "fare_estimated": 15.00, "status": "requested"
        }
        with patch('app.routes.payments.get_db', mock_db):
            resp = client.post('/payments/create-intent',
                               json={"ride_id": TEST_RIDE_ID},
                               headers=_auth_header())
        assert resp.status_code == 409

    def test_dev_mode_returns_fake_intent_pi_dev_prefix(self, client):
        """R5: Dev mode returns a fake intent ID starting with pi_dev_."""
        mock_db, mock_cur = make_db_mock()
        # ride check → matched ride; existing payment check → None
        mock_cur.fetchone.side_effect = [
            {"rider_id": TEST_RIDER_ID, "fare_estimated": 15.00, "status": "matched"},
            None,
        ]
        with patch('app.routes.payments.get_db', mock_db):
            resp = client.post('/payments/create-intent',
                               json={"ride_id": TEST_RIDE_ID},
                               headers=_auth_header())
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["payment_intent_id"].startswith("pi_dev_")

    def test_dev_mode_sets_dev_mode_true_in_response(self, client):
        mock_db, mock_cur = make_db_mock()
        mock_cur.fetchone.side_effect = [
            {"rider_id": TEST_RIDER_ID, "fare_estimated": 15.00, "status": "confirmed"},
            None,
        ]
        with patch('app.routes.payments.get_db', mock_db):
            resp = client.post('/payments/create-intent',
                               json={"ride_id": TEST_RIDE_ID},
                               headers=_auth_header())
        assert resp.get_json().get("dev_mode") is True

    def test_error_response_has_error_and_message_keys(self, client):
        """R7: All errors must include 'error' and human-readable 'message'."""
        mock_db, mock_cur = make_db_mock()
        mock_cur.fetchone.return_value = None
        with patch('app.routes.payments.get_db', mock_db):
            resp = client.post('/payments/create-intent',
                               json={"ride_id": TEST_RIDE_ID},
                               headers=_auth_header())
        body = resp.get_json()
        assert "error" in body
        assert "message" in body
        assert isinstance(body["message"], str) and len(body["message"]) > 0


# ─── R5: Capture payment (dev mode) ──────────────────────────────────────────

class TestCaptureRoute:
    """R5 — Payment capture on ride completion."""

    def test_unauthenticated_returns_401(self, client):
        resp = client.post('/payments/capture', json={"ride_id": TEST_RIDE_ID})
        assert resp.status_code == 401

    def test_payment_not_found_returns_404(self, client):
        mock_db, mock_cur = make_db_mock()
        mock_cur.fetchone.return_value = None
        with patch('app.routes.payments.get_db', mock_db):
            resp = client.post('/payments/capture',
                               json={"ride_id": TEST_RIDE_ID},
                               headers=_auth_header())
        assert resp.status_code == 404

    def test_dev_mode_capture_returns_captured_status(self, client):
        """R5: Dev-mode capture (pi_dev_ intent) marks ride as captured."""
        mock_db, mock_cur = make_db_mock()
        mock_cur.fetchone.return_value = {
            "stripe_payment_intent_id": f"pi_dev_{TEST_RIDE_ID[:8]}",
            "amount_estimated": 15.00,
            "status": "pending",
            "fare_final": 15.00,
            "rider_id": TEST_RIDER_ID,
            "driver_id": TEST_DRIVER_ID,
        }
        with patch('app.routes.payments.get_db', mock_db):
            resp = client.post('/payments/capture',
                               json={"ride_id": TEST_RIDE_ID},
                               headers=_auth_header())
        assert resp.status_code == 200
        body = resp.get_json()
        assert body["status"] == "captured"
        assert body.get("dev_mode") is True


# ─── R5 / R6: Payment status ──────────────────────────────────────────────────

class TestPaymentStatusRoute:
    """R5 — Payment status retrieval; R6 — data is private to ride participants."""

    def test_unauthenticated_returns_401(self, client):
        resp = client.get(f'/payments/status/{TEST_RIDE_ID}')
        assert resp.status_code == 401

    def test_payment_not_found_returns_404(self, client):
        mock_db, mock_cur = make_db_mock()
        mock_cur.fetchone.return_value = None
        with patch('app.routes.payments.get_db', mock_db):
            resp = client.get(f'/payments/status/{TEST_RIDE_ID}',
                              headers=_auth_header())
        assert resp.status_code == 404

    def test_third_party_cannot_read_others_payment_status(self, client):
        """R6: Payment data is only visible to the rider and driver of that ride."""
        mock_db, mock_cur = make_db_mock()
        mock_cur.fetchone.return_value = {
            "status": "pending", "amount_estimated": 15.00, "amount_final": None,
            "currency": "aud", "rider_id": TEST_RIDER_ID, "driver_id": TEST_DRIVER_ID,
        }
        with patch('app.routes.payments.get_db', mock_db):
            # Third party (neither rider nor driver) tries to read
            resp = client.get(f'/payments/status/{TEST_RIDE_ID}',
                              headers=_auth_header(user_id=TEST_THIRD_ID))
        assert resp.status_code == 403

    def test_rider_can_read_own_payment_status(self, client):
        mock_db, mock_cur = make_db_mock()
        mock_cur.fetchone.return_value = {
            "status": "pending", "amount_estimated": 15.00, "amount_final": None,
            "currency": "aud", "rider_id": TEST_RIDER_ID, "driver_id": TEST_DRIVER_ID,
        }
        with patch('app.routes.payments.get_db', mock_db):
            resp = client.get(f'/payments/status/{TEST_RIDE_ID}',
                              headers=_auth_header(user_id=TEST_RIDER_ID))
        assert resp.status_code == 200

    def test_response_contains_required_fields(self, client):
        """R7: Status response must include all fields needed by the app."""
        mock_db, mock_cur = make_db_mock()
        mock_cur.fetchone.return_value = {
            "status": "captured", "amount_estimated": 15.00, "amount_final": 15.00,
            "currency": "aud", "rider_id": TEST_RIDER_ID, "driver_id": TEST_DRIVER_ID,
        }
        with patch('app.routes.payments.get_db', mock_db):
            resp = client.get(f'/payments/status/{TEST_RIDE_ID}',
                              headers=_auth_header(user_id=TEST_RIDER_ID))
        body = resp.get_json()
        for field in ("status", "amount_estimated", "currency"):
            assert field in body, f"Missing required field: {field}"
