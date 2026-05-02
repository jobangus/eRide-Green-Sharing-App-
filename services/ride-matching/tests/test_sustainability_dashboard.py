"""
pytest coverage for R9, R10 — Mo-Ride sustainability and scalability.

R9: Scalability — system should handle growing numbers of drivers (Scalability, NFR)
    Tested via rank_drivers performance bounds at 1000 and 5000 drivers.
R10: CO2 dashboard — encourage ride-sharing by displaying emissions savings (Sustainability, FR/NFR)
     Tested via compute_co2 math correctness and complete dashboard payload.
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

os.environ.setdefault('DATABASE_URL', 'postgresql://test:test@localhost/test')
os.environ.setdefault('REDIS_URL', 'redis://localhost:6379/0')
os.environ.setdefault('JWT_SECRET', 'test_secret')
os.environ.setdefault('CO2_PER_KM_PETROL', '0.21')

import time
import pytest
from app.services.sustainability import compute_co2
from app.services.matching import rank_drivers
from app.config import Config


# ─── R10: CO2 / sustainability calculation math ───────────────────────────────

class TestComputeCo2Math:
    """R10 — CO2 savings displayed to users after each ride and on the dashboard."""

    CO2 = Config.CO2_PER_KM_PETROL  # 0.21 kg/km

    def test_baseline_equals_n_plus_1_cars(self):
        # Baseline: (passengers + 1 driver) each driving separately
        result = compute_co2(10.0, 2)
        expected = (2 + 1) * 10.0 * self.CO2
        assert result['baseline_co2_kg'] == pytest.approx(expected, rel=0.001)

    def test_actual_is_always_one_car(self):
        # Actual: only one car on the road regardless of passenger count
        for passengers in (1, 2, 4):
            result = compute_co2(10.0, passengers)
            assert result['actual_co2_kg'] == pytest.approx(10.0 * self.CO2, rel=0.001)

    def test_co2_saved_equals_baseline_minus_actual(self):
        result = compute_co2(15.0, 2)
        assert result['co2_saved_kg'] == pytest.approx(
            result['baseline_co2_kg'] - result['actual_co2_kg'], rel=0.001
        )

    def test_single_passenger_saved_equals_one_car_trip(self):
        # 1 passenger: baseline=2 cars, actual=1 car → saved=1 car trip
        result = compute_co2(10.0, 1)
        assert result['co2_saved_kg'] == pytest.approx(10.0 * self.CO2, rel=0.001)

    def test_more_passengers_saves_proportionally_more(self):
        r1 = compute_co2(10.0, 1)
        r2 = compute_co2(10.0, 2)
        r3 = compute_co2(10.0, 3)
        assert r2['co2_saved_kg'] > r1['co2_saved_kg']
        assert r3['co2_saved_kg'] > r2['co2_saved_kg']

    def test_equivalent_trees_hours_formula(self):
        # 1 tree absorbs ~0.021 kg CO2/hr → trees_hours = saved / 0.021
        result = compute_co2(10.0, 1)
        expected_trees = round(result['co2_saved_kg'] / 0.021, 1)
        assert result['equivalent_trees_hours'] == pytest.approx(expected_trees, rel=0.001)

    def test_all_dashboard_keys_present(self):
        """R10: Dashboard payload must include all keys needed to display savings."""
        result = compute_co2(10.0, 1)
        required_keys = [
            'distance_km', 'passengers', 'baseline_co2_kg', 'actual_co2_kg',
            'co2_saved_kg', 'per_passenger_co2_kg', 'equivalent_trees_hours',
        ]
        for key in required_keys:
            assert key in result, f"Missing dashboard key: {key}"

    def test_large_distance_scales_linearly(self):
        # 100 km should produce exactly 10× the savings of 10 km
        r10 = compute_co2(10.0, 1)
        r100 = compute_co2(100.0, 1)
        assert r100['co2_saved_kg'] == pytest.approx(r10['co2_saved_kg'] * 10, rel=0.001)

    def test_zero_distance_gives_zero_emissions(self):
        result = compute_co2(0.0, 1)
        assert result['baseline_co2_kg'] == 0.0
        assert result['actual_co2_kg'] == 0.0
        assert result['co2_saved_kg'] == 0.0

    def test_zero_passengers_does_not_crash(self):
        # passengers=0 → max(passengers, 1) guard prevents ZeroDivisionError
        result = compute_co2(10.0, 0)
        assert result['per_passenger_co2_kg'] >= 0


# ─── R9: Scalability — rank_drivers performance ───────────────────────────────

class TestRankDriversScalability:
    """R9 — System must scale beyond Clayton/Caulfield to more campuses and users.
    rank_drivers is the core hotspot: it must stay fast as driver pool grows."""

    @staticmethod
    def _make_candidates(n: int) -> list:
        return [
            {
                "driver_id": f"driver-{i:05d}",
                "distance_km": float(i % 10 + 0.1),
                "rating": 4.0 + (i % 10) * 0.1,
                "is_available": i % 5 != 0,
            }
            for i in range(n)
        ]

    def test_rank_1000_drivers_under_100ms(self):
        candidates = self._make_candidates(1000)
        start = time.perf_counter()
        result = rank_drivers(candidates)
        elapsed = time.perf_counter() - start
        assert elapsed < 0.1, f"rank_drivers too slow for 1000 drivers: {elapsed:.3f}s"
        assert len(result) == 1000

    def test_rank_5000_drivers_under_500ms(self):
        candidates = self._make_candidates(5000)
        start = time.perf_counter()
        result = rank_drivers(candidates)
        elapsed = time.perf_counter() - start
        assert elapsed < 0.5, f"rank_drivers too slow for 5000 drivers: {elapsed:.3f}s"
        assert len(result) == 5000

    def test_rank_preserves_all_drivers_at_scale(self):
        candidates = self._make_candidates(2000)
        result = rank_drivers(candidates)
        assert len(result) == 2000
        result_ids = {c["driver_id"] for c in result}
        input_ids = {c["driver_id"] for c in candidates}
        assert result_ids == input_ids

    def test_rank_output_sorted_descending_at_scale(self):
        candidates = self._make_candidates(500)
        result = rank_drivers(candidates)
        scores = [c["score"] for c in result]
        assert scores == sorted(scores, reverse=True)

    def test_rank_handles_mixed_availability_at_scale(self):
        # Unavailable drivers (score=0) must sink to the bottom
        candidates = self._make_candidates(200)
        result = rank_drivers(candidates)
        unavailable = [c for c in result if not c["is_available"]]
        available = [c for c in result if c["is_available"]]
        if unavailable and available:
            # All unavailable drivers should have lower scores than any available driver
            max_unavailable_score = max(c["score"] for c in unavailable)
            min_available_score = min(c["score"] for c in available)
            assert max_unavailable_score <= min_available_score
