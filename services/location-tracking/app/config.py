import os

class Config:
    DATABASE_URL: str = os.environ["DATABASE_URL"]
    REDIS_URL: str = os.environ["REDIS_URL"]
    JWT_SECRET: str = os.environ["JWT_SECRET"]
    FLASK_ENV: str = os.getenv("FLASK_ENV", "production")
