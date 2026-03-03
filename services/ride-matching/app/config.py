import os


class Config:
    DATABASE_URL: str = os.environ["DATABASE_URL"]
    REDIS_URL: str = os.environ["REDIS_URL"]
    JWT_SECRET: str = os.environ["JWT_SECRET"]

    # Google Maps (optional — stub used if key is empty)
    GOOGLE_MAPS_API_KEY: str = os.getenv("GOOGLE_MAPS_API_KEY", "")

    # Fare constants
    BASE_RATE: float = float(os.getenv("BASE_RATE", "2.00"))
    RATE_PER_KM: float = float(os.getenv("RATE_PER_KM", "1.50"))

    # Peak hours (24h HH:MM format)
    PEAK_HOURS_MORNING_START: str = os.getenv("PEAK_HOURS_MORNING_START", "07:00")
    PEAK_HOURS_MORNING_END: str = os.getenv("PEAK_HOURS_MORNING_END", "09:00")
    PEAK_HOURS_EVENING_START: str = os.getenv("PEAK_HOURS_EVENING_START", "16:00")
    PEAK_HOURS_EVENING_END: str = os.getenv("PEAK_HOURS_EVENING_END", "19:00")
    PEAK_MULTIPLIER: float = float(os.getenv("PEAK_MULTIPLIER", "1.2"))

    # CO2
    CO2_PER_KM_PETROL: float = float(os.getenv("CO2_PER_KM_PETROL", "0.21"))
    CO2_PER_KM_SHARED: float = float(os.getenv("CO2_PER_KM_SHARED", "0.09"))

    # Matching
    DRIVER_SEARCH_RADIUS_KM: float = float(os.getenv("DRIVER_SEARCH_RADIUS_KM", "5"))
    DRIVER_ACCEPT_TIMEOUT_SECONDS: int = int(os.getenv("DRIVER_ACCEPT_TIMEOUT_SECONDS", "30"))

    FLASK_ENV: str = os.getenv("FLASK_ENV", "production")
