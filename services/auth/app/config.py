import os


class Config:
    # Database
    DATABASE_URL: str = os.environ["DATABASE_URL"]

    # Redis
    REDIS_URL: str = os.environ["REDIS_URL"]

    # JWT
    JWT_SECRET: str = os.environ["JWT_SECRET"]
    JWT_ACCESS_EXPIRES_MINUTES: int = int(os.getenv("JWT_ACCESS_EXPIRES_MINUTES", "60"))
    JWT_REFRESH_EXPIRES_DAYS: int = int(os.getenv("JWT_REFRESH_EXPIRES_DAYS", "30"))

    # Email
    SMTP_HOST: str = os.getenv("SMTP_HOST", "mailhog")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "1025"))
    SMTP_FROM: str = os.getenv("SMTP_FROM", "noreply@moride.monash.edu")
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASS: str = os.getenv("SMTP_PASS", "")
    SMTP_TLS: bool = os.getenv("SMTP_TLS", "false").lower() == "true"

    # MinIO / S3
    MINIO_ENDPOINT: str = os.getenv("MINIO_ENDPOINT", "minio:9000")
    MINIO_ACCESS_KEY: str = os.getenv("MINIO_ACCESS_KEY", "")
    MINIO_SECRET_KEY: str = os.getenv("MINIO_SECRET_KEY", "")
    MINIO_BUCKET_PROFILES: str = os.getenv("MINIO_BUCKET_PROFILES", "moride-profiles")
    MINIO_USE_SSL: bool = os.getenv("MINIO_USE_SSL", "false").lower() == "true"

    # App
    MONASH_EMAIL_DOMAIN: str = "@monash.edu"
    OTP_EXPIRY_MINUTES: int = 10
    FLASK_ENV: str = os.getenv("FLASK_ENV", "production")
