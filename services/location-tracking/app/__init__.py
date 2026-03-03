import eventlet
eventlet.monkey_patch()

from flask import Flask
from flask_cors import CORS
from flask_socketio import SocketIO
import redis as redis_lib
from app.config import Config
from app.socket_events import register_events


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app, resources={r"/*": {"origins": "*"}})

    r = redis_lib.from_url(Config.REDIS_URL, decode_responses=False)
    app.extensions["redis"] = r

    socketio = SocketIO(
        app,
        cors_allowed_origins="*",
        async_mode="eventlet",
        message_queue=Config.REDIS_URL,
        logger=False,
        engineio_logger=False,
    )
    app.extensions["socketio"] = socketio

    register_events(socketio, r)

    @app.route("/health")
    def health():
        return {"status": "ok", "service": "location-tracking"}, 200

    return app


application = create_app()
