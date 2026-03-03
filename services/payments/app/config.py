import os

class Config:
    DATABASE_URL: str = os.environ["DATABASE_URL"]
    JWT_SECRET: str = os.environ["JWT_SECRET"]
    STRIPE_SECRET_KEY: str = os.getenv("STRIPE_SECRET_KEY", "")
    STRIPE_WEBHOOK_SECRET: str = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    FLASK_ENV: str = os.getenv("FLASK_ENV", "production")
