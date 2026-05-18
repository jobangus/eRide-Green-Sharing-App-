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


def compute_co2(distance_km: float, passengers: int = 1, co2_per_km_kg: float | None = None) -> dict:
    """
    Returns a dict with co2 calculation details.

    passengers: number of riders being transported (not including driver).
    co2_per_km_kg: actual vehicle CO2 in kg/km from the vehicles table
                   (CSV column CO2EmissionsCombined is in g/km — divide by 1000).
                   Falls back to Config.CO2_PER_KM_PETROL if not provided.
    Baseline assumes each passenger + the driver would have driven separately
    in an average petrol car.
    """
    actual_rate = co2_per_km_kg if co2_per_km_kg is not None else Config.CO2_PER_KM_PETROL

    # Baseline: (passengers + 1 driver) each drive separately in average petrol cars
    separate_cars = passengers + 1
    baseline_co2 = round(distance_km * Config.CO2_PER_KM_PETROL * separate_cars, 4)

    # Actual: one car (the driver's real vehicle) used for the shared ride
    actual_co2 = round(distance_km * actual_rate, 4)

    co2_saved = round(baseline_co2 - actual_co2, 4)
    per_passenger_co2 = round(actual_co2 / max(passengers, 1), 4)

    return {
        "distance_km": distance_km,
        "passengers": passengers,
        "baseline_co2_kg": baseline_co2,
        "actual_co2_kg": actual_co2,
        "co2_saved_kg": co2_saved,
        "per_passenger_co2_kg": per_passenger_co2,
        "co2_per_km_used": actual_rate,
        "equivalent_trees_hours": round(co2_saved / 0.021, 1),
    }
