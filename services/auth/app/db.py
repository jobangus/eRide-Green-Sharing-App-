import psycopg2
import psycopg2.extras
from contextlib import contextmanager
from app.config import Config


def get_connection():
    """Return a new psycopg2 connection. Caller is responsible for closing."""
    return psycopg2.connect(
        Config.DATABASE_URL,
        cursor_factory=psycopg2.extras.RealDictCursor,
    )


@contextmanager
def get_db():
    """Context manager yielding a connection and auto-committing/rolling back."""
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
