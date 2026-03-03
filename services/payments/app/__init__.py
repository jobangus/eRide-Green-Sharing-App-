from flask import Flask
from flask_cors import CORS
from app.routes.payments import payments_bp
from app.config import Config
import stripe

stripe.api_key = Config.STRIPE_SECRET_KEY


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app, resources={r"/*": {"origins": "*"}})

    app.register_blueprint(payments_bp, url_prefix="/payments")

    @app.route("/health")
    def health():
        return {"status": "ok", "service": "payments"}, 200

    return app


application = create_app()
