"""
CO2 Sustainability Calculations

Baseline: what would have happened if all passengers drove separately in petrol cars.
Actual: the shared ride's CO2 emission divided by passengers.
Saved: baseline - actual.

CO2 factors (configurable via env):
  CO2_PER_KM_PETROL = 0.21 kg/km  (average ICE petrol car)
  CO2_PER_KM_SHARED = 0.09 kg/km  (per passenger in a shared ride, 2+ people in car)
"""

from app.config import Config


def compute_co2(distance_km: float, passengers: int = 1) -> dict:
    """
    Returns a dict with co2 calculation details.

    passengers: number of riders being transported (not including driver).
    Baseline assumes each passenger + the driver would have driven separately.
    """
    # Baseline: (passengers + 1 driver) each drive separately
    separate_cars = passengers + 1  # total people who would have used their own car
    baseline_co2 = round(distance_km * Config.CO2_PER_KM_PETROL * separate_cars, 4)

    # Actual: one car used; CO2 attributed to ride (driver + passengers together)
    # We attribute the ride's full emission, then compare vs baseline
    actual_co2 = round(distance_km * Config.CO2_PER_KM_PETROL, 4)  # still one car on road

    # Saved = what was avoided by sharing
    co2_saved = round(baseline_co2 - actual_co2, 4)

    # Per-passenger CO2 for awareness display
    per_passenger_co2 = round(actual_co2 / max(passengers, 1), 4)

    return {
        "distance_km": distance_km,
        "passengers": passengers,
        "baseline_co2_kg": baseline_co2,
        "actual_co2_kg": actual_co2,
        "co2_saved_kg": co2_saved,
        "per_passenger_co2_kg": per_passenger_co2,
        "co2_per_km_used": Config.CO2_PER_KM_PETROL,
        # Equivalent in human-relatable units
        "equivalent_trees_hours": round(co2_saved / 0.021, 1),  # 1 tree absorbs ~0.021 kg CO2/hr
    }
