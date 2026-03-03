from flask import Flask
from flask_cors import CORS
from app.routes.auth import auth_bp
from app.routes.users import users_bp


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app, resources={r"/*": {"origins": "*"}})

    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(users_bp)

    @app.route("/health")
    def health():
        return {"status": "ok", "service": "auth"}, 200

    return app


# For gunicorn entrypoint
application = create_app()
