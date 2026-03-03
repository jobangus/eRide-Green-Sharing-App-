import psycopg2
import psycopg2.extras
from contextlib import contextmanager
from app.config import Config


@contextmanager
def get_db():
    conn = psycopg2.connect(Config.DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
