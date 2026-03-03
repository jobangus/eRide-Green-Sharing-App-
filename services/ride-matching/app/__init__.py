import eventlet
eventlet.monkey_patch()

from flask import Flask
from flask_cors import CORS
from flask_socketio import SocketIO
import redis as redis_lib

from app.config import Config
from app.routes.rides import rides_bp
from app.routes.driver import driver_bp
from app.routes.sustainability import sustainability_bp
from app.socket_events import register_events


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app, resources={r"/*": {"origins": "*"}})

    # Redis client
    r = redis_lib.from_url(Config.REDIS_URL, decode_responses=False)
    app.extensions["redis"] = r

    # Socket.IO
    socketio = SocketIO(
        app,
        cors_allowed_origins="*",
        async_mode="eventlet",
        message_queue=Config.REDIS_URL,
        logger=False,
        engineio_logger=False,
    )
    app.extensions["socketio"] = socketio

    # Register blueprints
    app.register_blueprint(rides_bp, url_prefix="/rides")
    app.register_blueprint(driver_bp, url_prefix="/driver")
    app.register_blueprint(sustainability_bp, url_prefix="/sustainability")

    # Register Socket.IO events
    register_events(socketio, r)

    @app.route("/health")
    def health():
        return {"status": "ok", "service": "ride-matching"}, 200

    return app


application = create_app()
