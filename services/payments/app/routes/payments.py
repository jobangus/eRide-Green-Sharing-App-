import stripe
from flask import Blueprint, request, jsonify, g, current_app
from app.db import get_db
from app.auth_middleware import require_auth
from app.config import Config

payments_bp = Blueprint("payments", __name__)

stripe.api_key = Config.STRIPE_SECRET_KEY


def _dollars_to_cents(amount: float) -> int:
    """Convert AUD dollar amount to cents for Stripe."""
    return max(50, int(round(amount * 100)))  # Stripe minimum: 50 cents


# ─── Create payment intent for a ride ────────────────────────


@payments_bp.route("/create-intent", methods=["POST"])
@require_auth
def create_intent():
    """
    POST /payments/create-intent
    Body: { ride_id }
    Creates a Stripe PaymentIntent with manual capture (so we can adjust on completion).
    Returns client_secret for the mobile SDK.
    """
    data = request.get_json(silent=True) or {}
    ride_id = data.get("ride_id")
    if not ride_id:
        return jsonify({"error": "validation", "message": "ride_id required"}), 400

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT rider_id, fare_estimated, status FROM rides WHERE id=%s", (ride_id,)
        )
        ride = cur.fetchone()
        if not ride:
            return jsonify({"error": "not_found", "message": "Ride not found"}), 404
        if str(ride["rider_id"]) != g.user_id:
            return jsonify({"error": "forbidden", "message": "Not your ride"}), 403
        if ride["status"] not in ("matched", "confirmed"):
            return jsonify({"error": "invalid_state",
                            "message": "Payment can only be created for matched/confirmed rides"}), 409

        # Check no existing payment
        cur.execute("SELECT id, stripe_payment_intent_id FROM payments WHERE ride_id=%s", (ride_id,))
        existing = cur.fetchone()
        if existing and existing["stripe_payment_intent_id"]:
            # Return existing client secret
            try:
                intent = stripe.PaymentIntent.retrieve(existing["stripe_payment_intent_id"])
                return jsonify({
                    "client_secret": intent["client_secret"],
                    "payment_intent_id": intent["id"],
                    "amount_aud": float(ride["fare_estimated"]),
                }), 200
            except Exception:
                pass

        amount_cents = _dollars_to_cents(float(ride["fare_estimated"] or 5.00))

        if not Config.STRIPE_SECRET_KEY or Config.STRIPE_SECRET_KEY == "sk_test_placeholder":
            # Dev mode: return fake intent
            fake_id = f"pi_dev_{ride_id[:8]}"
            fake_secret = f"{fake_id}_secret_dev"
            cur.execute(
                """INSERT INTO payments
                   (ride_id, stripe_payment_intent_id, stripe_client_secret,
                    amount_estimated, currency, status)
                   VALUES (%s,%s,%s,%s,'aud','pending')
                   ON CONFLICT (ride_id) DO UPDATE
                   SET stripe_payment_intent_id=%s, stripe_client_secret=%s, status='pending'""",
                (ride_id, fake_id, fake_secret, float(ride["fare_estimated"] or 0),
                 fake_id, fake_secret)
            )
            return jsonify({
                "client_secret": fake_secret,
                "payment_intent_id": fake_id,
                "amount_aud": float(ride["fare_estimated"] or 0),
                "dev_mode": True,
            }), 200

        try:
            intent = stripe.PaymentIntent.create(
                amount=amount_cents,
                currency="aud",
                capture_method="manual",  # Authorize only; capture on completion
                metadata={"ride_id": ride_id, "rider_id": g.user_id},
                description=f"Mo-Ride fare for ride {ride_id[:8]}",
            )
        except stripe.error.StripeError as e:
            return jsonify({"error": "stripe_error", "message": str(e)}), 502

        cur.execute(
            """INSERT INTO payments
               (ride_id, stripe_payment_intent_id, stripe_client_secret,
                amount_estimated, currency, status)
               VALUES (%s,%s,%s,%s,'aud','pending')
               ON CONFLICT (ride_id) DO UPDATE
               SET stripe_payment_intent_id=%s, stripe_client_secret=%s""",
            (ride_id, intent["id"], intent["client_secret"],
             float(ride["fare_estimated"] or 0), intent["id"], intent["client_secret"])
        )

    return jsonify({
        "client_secret": intent["client_secret"],
        "payment_intent_id": intent["id"],
        "amount_aud": float(ride["fare_estimated"] or 0),
    }), 200


# ─── Capture payment on ride completion ──────────────────────


@payments_bp.route("/capture", methods=["POST"])
@require_auth
def capture_payment():
    """
    POST /payments/capture
    Body: { ride_id, final_amount? }
    Captures the authorized payment (or adjusts amount).
    Called by ride-matching service after ride completes.
    """
    data = request.get_json(silent=True) or {}
    ride_id = data.get("ride_id")
    if not ride_id:
        return jsonify({"error": "validation", "message": "ride_id required"}), 400

    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT p.stripe_payment_intent_id, p.amount_estimated, p.status,
                      r.fare_final, r.rider_id, r.driver_id
               FROM payments p
               JOIN rides r ON r.id = p.ride_id
               WHERE p.ride_id=%s""",
            (ride_id,)
        )
        payment = cur.fetchone()
        if not payment:
            return jsonify({"error": "not_found", "message": "No payment found for this ride"}), 404

        if str(payment["rider_id"]) != g.user_id and str(payment["driver_id"]) != g.user_id:
            return jsonify({"error": "forbidden"}), 403

        final_amount = float(data.get("final_amount") or payment["fare_final"] or payment["amount_estimated"])
        intent_id = payment["stripe_payment_intent_id"]

        if not intent_id or intent_id.startswith("pi_dev_"):
            # Dev mode: just mark captured
            cur.execute(
                "UPDATE payments SET status='captured', amount_final=%s WHERE ride_id=%s",
                (final_amount, ride_id)
            )
            return jsonify({"status": "captured", "amount_aud": final_amount, "dev_mode": True}), 200

        try:
            amount_cents = _dollars_to_cents(final_amount)
            # First update amount if different
            current_intent = stripe.PaymentIntent.retrieve(intent_id)
            if current_intent["status"] == "requires_capture":
                if current_intent["amount"] != amount_cents:
                    stripe.PaymentIntent.modify(intent_id, amount=amount_cents)
                stripe.PaymentIntent.capture(intent_id)

            cur.execute(
                "UPDATE payments SET status='captured', amount_final=%s WHERE ride_id=%s",
                (final_amount, ride_id)
            )
        except stripe.error.StripeError as e:
            cur.execute(
                "UPDATE payments SET status='failed', failure_reason=%s WHERE ride_id=%s",
                (str(e), ride_id)
            )
            return jsonify({"error": "stripe_error", "message": str(e)}), 502

    return jsonify({"status": "captured", "amount_aud": final_amount}), 200


# ─── Stripe webhook ───────────────────────────────────────────


@payments_bp.route("/webhook", methods=["POST"])
def stripe_webhook():
    """Handle Stripe webhook events (payment_intent.succeeded, etc.)."""
    payload = request.get_data(as_text=True)
    sig_header = request.headers.get("Stripe-Signature", "")

    if Config.STRIPE_WEBHOOK_SECRET:
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, Config.STRIPE_WEBHOOK_SECRET
            )
        except (ValueError, stripe.error.SignatureVerificationError) as e:
            return jsonify({"error": "invalid_signature"}), 400
    else:
        import json
        try:
            event = json.loads(payload)
        except Exception:
            return jsonify({"error": "invalid_payload"}), 400

    event_type = event.get("type", "")

    if event_type == "payment_intent.succeeded":
        intent = event["data"]["object"]
        ride_id = intent.get("metadata", {}).get("ride_id")
        if ride_id:
            with get_db() as conn:
                cur = conn.cursor()
                cur.execute(
                    "UPDATE payments SET status='captured', amount_final=%s WHERE ride_id=%s",
                    (intent["amount_received"] / 100.0, ride_id)
                )
    elif event_type == "payment_intent.payment_failed":
        intent = event["data"]["object"]
        ride_id = intent.get("metadata", {}).get("ride_id")
        if ride_id:
            with get_db() as conn:
                cur = conn.cursor()
                cur.execute(
                    "UPDATE payments SET status='failed' WHERE ride_id=%s", (ride_id,)
                )

    return jsonify({"received": True}), 200


# ─── Get payment status ───────────────────────────────────────


@payments_bp.route("/status/<ride_id>", methods=["GET"])
@require_auth
def payment_status(ride_id: str):
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT p.*, r.rider_id, r.driver_id
               FROM payments p JOIN rides r ON r.id = p.ride_id
               WHERE p.ride_id=%s""",
            (ride_id,)
        )
        row = cur.fetchone()
        if not row:
            return jsonify({"error": "not_found"}), 404
        if g.user_id not in (str(row["rider_id"]), str(row["driver_id"])):
            return jsonify({"error": "forbidden"}), 403

    return jsonify({
        "ride_id": ride_id,
        "status": row["status"],
        "amount_estimated": float(row["amount_estimated"]) if row["amount_estimated"] else None,
        "amount_final": float(row["amount_final"]) if row["amount_final"] else None,
        "currency": row["currency"],
    }), 200
