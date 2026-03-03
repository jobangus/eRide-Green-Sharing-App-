"""
Tests for fare calculation algorithm.
Tests the exact algorithm described in the Mo-Ride proposal.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Set required environment variables before importing config
os.environ.setdefault('DATABASE_URL', 'postgresql://test:test@localhost/test')
os.environ.setdefault('REDIS_URL', 'redis://localhost:6379/0')
os.environ.setdefault('JWT_SECRET', 'test_secret')

import pytest
from datetime import datetime, timezone
from unittest.mock import patch
from app.services.fare import (
    calculate_fare, is_peak_hour, haversine_distance, get_route_distance_km
)
from app.config import Config


class TestHaversineDistance:
    def test_same_point_is_zero(self):
        # Two identical points should be ~0 distance
        d = haversine_distance(-37.9105, 145.1362, -37.9105, 145.1362)
        assert d < 0.1

    def test_clayton_to_caulfield_reasonable(self):
        # Clayton to Caulfield is approximately 14km by road
        # Haversine gives ~10km straight line, * 1.3 buffer = ~13km
        d = haversine_distance(-37.9105, 145.1362, -37.8777, 145.0452)
        assert 10 <= d <= 20, f"Expected 10-20 km, got {d}"

    def test_short_distance(self):
        # Points ~1km apart
        d = haversine_distance(-37.9105, 145.1362, -37.9195, 145.1362)
        assert 0.5 <= d <= 5.0

    def test_direction_agnostic(self):
        d1 = haversine_distance(-37.9105, 145.1362, -37.8777, 145.0452)
        d2 = haversine_distance(-37.8777, 145.0452, -37.9105, 145.1362)
        assert abs(d1 - d2) < 0.01


class TestIsPeakHour:
    def _utc_at_melbourne_hour(self, hour: int) -> datetime:
        """Melbourne is UTC+10 (simplification). Return UTC datetime."""
        utc_hour = (hour - 10) % 24
        return datetime(2024, 1, 15, utc_hour, 0, 0, tzinfo=timezone.utc)

    def test_morning_peak(self):
        # 8:00 AM Melbourne
        dt = self._utc_at_melbourne_hour(8)
        assert is_peak_hour(dt) is True

    def test_morning_before_peak(self):
        # 6:00 AM Melbourne
        dt = self._utc_at_melbourne_hour(6)
        assert is_peak_hour(dt) is False

    def test_evening_peak(self):
        # 5:30 PM Melbourne
        dt = datetime(2024, 1, 15, 7, 30, 0, tzinfo=timezone.utc)  # 5:30 PM local
        assert is_peak_hour(dt) is True

    def test_midday_not_peak(self):
        # 12:00 PM Melbourne
        dt = self._utc_at_melbourne_hour(12)
        assert is_peak_hour(dt) is False


class TestCalculateFare:
    """Tests for the proposal's exact fare formula:
    base_fare = BASE_RATE + (distance_km * RATE_PER_KM)
    surge = 1.0 + (demand_ratio - 2.0) * 0.5  if demand_ratio > 2.0
    final_fare = base_fare * surge * time_multiplier
    """

    def test_basic_fare_no_surge_no_peak(self):
        # 10 km, no surge, no peak
        result = calculate_fare(
            distance_km=10.0,
            active_requests=1,
            available_drivers=5,
            current_time=datetime(2024, 1, 15, 2, 0, 0, tzinfo=timezone.utc),  # 12 PM Melbourne
        )
        expected_base = Config.BASE_RATE + 10.0 * Config.RATE_PER_KM
        assert result['base_fare'] == round(expected_base, 2)
        assert result['surge_multiplier'] == 1.0
        assert result['time_multiplier'] == 1.0
        assert result['final_fare'] == round(expected_base, 2)
        assert result['demand_ratio'] < 2.0

    def test_fare_formula_consistency(self):
        # Verify: final_fare = base_fare * surge * time_multiplier
        result = calculate_fare(
            distance_km=5.0,
            active_requests=2,
            available_drivers=3,
            current_time=datetime(2024, 1, 15, 2, 0, 0, tzinfo=timezone.utc),
        )
        expected_final = round(
            result['base_fare'] * result['surge_multiplier'] * result['time_multiplier'],
            2
        )
        assert result['final_fare'] == expected_final

    def test_surge_kicks_in_above_ratio_2(self):
        # demand_ratio = 6/1 = 6.0 > 2.0
        result = calculate_fare(
            distance_km=5.0,
            active_requests=6,
            available_drivers=1,
        )
        assert result['demand_ratio'] == pytest.approx(6.0)
        expected_surge = 1.0 + (6.0 - 2.0) * 0.5  # = 3.0
        assert result['surge_multiplier'] == pytest.approx(expected_surge, rel=0.01)

    def test_no_surge_below_ratio_2(self):
        # demand_ratio = 2/2 = 1.0
        result = calculate_fare(
            distance_km=5.0,
            active_requests=2,
            available_drivers=2,
        )
        assert result['surge_multiplier'] == 1.0

    def test_surge_boundary_exactly_2(self):
        # demand_ratio = exactly 2.0 should NOT trigger surge
        result = calculate_fare(
            distance_km=5.0,
            active_requests=2,
            available_drivers=1,
        )
        assert result['surge_multiplier'] == 1.0  # ratio = 2.0, not > 2.0

    def test_peak_multiplier_applied(self):
        # Peak hour (8 AM Melbourne = UTC 22:00 prev day)
        peak_time = datetime(2024, 1, 14, 22, 0, 0, tzinfo=timezone.utc)
        off_peak_time = datetime(2024, 1, 15, 2, 0, 0, tzinfo=timezone.utc)

        peak_result = calculate_fare(5.0, 1, 5, current_time=peak_time)
        off_peak_result = calculate_fare(5.0, 1, 5, current_time=off_peak_time)

        assert peak_result['time_multiplier'] == Config.PEAK_MULTIPLIER
        assert off_peak_result['time_multiplier'] == 1.0
        assert peak_result['final_fare'] > off_peak_result['final_fare']

    def test_no_drivers_denominator(self):
        # If no drivers, demand_ratio = active_requests / max(0, 1) = requests
        result = calculate_fare(5.0, 3, 0)
        # max(available_drivers, 1) = 1
        assert result['demand_ratio'] == pytest.approx(3.0)

    def test_zero_distance(self):
        # Minimum fare scenario
        result = calculate_fare(0.0, 0, 1)
        assert result['base_fare'] == pytest.approx(Config.BASE_RATE, rel=0.01)
        assert result['final_fare'] >= Config.BASE_RATE

    def test_long_distance(self):
        # 50 km ride
        result = calculate_fare(50.0, 1, 5)
        expected = Config.BASE_RATE + 50.0 * Config.RATE_PER_KM
        assert result['base_fare'] == pytest.approx(expected, rel=0.01)
        assert result['final_fare'] == pytest.approx(expected, rel=0.01)

    def test_currency_is_aud(self):
        result = calculate_fare(10.0, 1, 5)
        assert result['currency'] == 'aud'

    def test_returns_all_required_fields(self):
        result = calculate_fare(10.0, 2, 5)
        required = ['base_fare', 'surge_multiplier', 'time_multiplier', 'demand_ratio', 'final_fare', 'currency', 'is_peak']
        for field in required:
            assert field in result, f"Missing field: {field}"


class TestGetRouteDistance:
    def test_fallback_when_no_api_key(self):
        """Should use haversine fallback when API key is empty."""
        with patch.object(Config, 'GOOGLE_MAPS_API_KEY', ''):
            dist, eta = get_route_distance_km(-37.9105, 145.1362, -37.8777, 145.0452)
            assert dist > 0
            assert eta > 0
            assert isinstance(dist, float)
            assert isinstance(eta, int)

    def test_fallback_returns_positive_eta(self):
        with patch.object(Config, 'GOOGLE_MAPS_API_KEY', ''):
            _, eta = get_route_distance_km(-37.9105, 145.1362, -37.8777, 145.0452)
            assert eta >= 1
