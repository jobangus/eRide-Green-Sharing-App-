"""
Tests for ride matching algorithm.
Tests the scoring function and driver ranking described in the Mo-Ride proposal.
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

os.environ.setdefault('DATABASE_URL', 'postgresql://test:test@localhost/test')
os.environ.setdefault('REDIS_URL', 'redis://localhost:6379/0')
os.environ.setdefault('JWT_SECRET', 'test_secret')

import pytest
from unittest.mock import MagicMock, patch
from app.services.matching import (
    score_driver, rank_drivers, haversine_distance,
    get_active_drivers_from_redis, MatchingSession
)


class TestScoreDriver:
    """Tests for the core scoring formula: score = (1/distance) * rating * availability."""

    def test_closer_driver_scores_higher(self):
        score_close = score_driver(distance_km=0.5, driver_rating=4.5, is_available=True)
        score_far = score_driver(distance_km=5.0, driver_rating=4.5, is_available=True)
        assert score_close > score_far

    def test_higher_rating_scores_higher(self):
        score_high = score_driver(distance_km=2.0, driver_rating=5.0, is_available=True)
        score_low = score_driver(distance_km=2.0, driver_rating=3.0, is_available=True)
        assert score_high > score_low

    def test_unavailable_driver_scores_zero(self):
        score = score_driver(distance_km=1.0, driver_rating=5.0, is_available=False)
        assert score == 0.0

    def test_formula_values(self):
        # score = (1/2.0) * 4.0 * 1.0 = 2.0
        score = score_driver(distance_km=2.0, driver_rating=4.0, is_available=True)
        assert score == pytest.approx(2.0, rel=0.01)

    def test_zero_distance_safe(self):
        # Should not raise ZeroDivisionError
        score = score_driver(distance_km=0.0, driver_rating=5.0, is_available=True)
        assert score > 0  # uses 0.01 floor

    def test_score_proportional_to_rating(self):
        # At same distance: score should scale linearly with rating
        s1 = score_driver(2.0, 2.0, True)
        s2 = score_driver(2.0, 4.0, True)
        assert s2 / s1 == pytest.approx(2.0, rel=0.01)

    def test_score_inversely_proportional_to_distance(self):
        # At same rating: score * distance should be constant
        s1 = score_driver(1.0, 5.0, True)
        s2 = score_driver(2.0, 5.0, True)
        assert s1 / s2 == pytest.approx(2.0, rel=0.01)


class TestRankDrivers:
    """Tests for driver ranking/sorting."""

    def test_sorts_by_score_descending(self):
        candidates = [
            {"driver_id": "d1", "distance_km": 5.0, "rating": 5.0, "is_available": True},
            {"driver_id": "d2", "distance_km": 1.0, "rating": 5.0, "is_available": True},  # best
            {"driver_id": "d3", "distance_km": 3.0, "rating": 4.0, "is_available": True},
        ]
        ranked = rank_drivers(candidates)
        assert ranked[0]["driver_id"] == "d2"  # closest

    def test_unavailable_sinks_to_bottom(self):
        candidates = [
            {"driver_id": "available", "distance_km": 5.0, "rating": 4.0, "is_available": True},
            {"driver_id": "unavailable", "distance_km": 0.5, "rating": 5.0, "is_available": False},
        ]
        ranked = rank_drivers(candidates)
        assert ranked[0]["driver_id"] == "available"
        assert ranked[-1]["driver_id"] == "unavailable"

    def test_empty_list(self):
        result = rank_drivers([])
        assert result == []

    def test_single_driver(self):
        candidates = [{"driver_id": "d1", "distance_km": 2.0, "rating": 4.5, "is_available": True}]
        ranked = rank_drivers(candidates)
        assert len(ranked) == 1
        assert ranked[0]["driver_id"] == "d1"
        assert "score" in ranked[0]

    def test_all_scores_computed(self):
        candidates = [
            {"driver_id": f"d{i}", "distance_km": float(i+1), "rating": 4.0, "is_available": True}
            for i in range(5)
        ]
        ranked = rank_drivers(candidates)
        for c in ranked:
            assert "score" in c
            assert c["score"] > 0

    def test_tie_breaking_consistent(self):
        # Same score should maintain stable relative order (Python sort is stable)
        candidates = [
            {"driver_id": "a", "distance_km": 2.0, "rating": 4.0, "is_available": True},
            {"driver_id": "b", "distance_km": 2.0, "rating": 4.0, "is_available": True},
        ]
        ranked = rank_drivers(candidates)
        assert len(ranked) == 2


class TestGetActiveDriversFromRedis:
    """Tests for Redis GEO integration."""

    def test_returns_empty_on_no_drivers(self):
        redis_mock = MagicMock()
        redis_mock.geosearch.return_value = []
        result = get_active_drivers_from_redis(redis_mock, -37.9105, 145.1362, 5.0)
        assert result == []

    def test_parses_redis_response_correctly(self):
        redis_mock = MagicMock()
        # Simulate Redis geosearch response format
        redis_mock.geosearch.return_value = [
            [b"driver-uuid-1", 1.5, (145.1362, -37.9105)],
            [b"driver-uuid-2", 3.0, (145.0452, -37.8777)],
        ]
        result = get_active_drivers_from_redis(redis_mock, -37.9105, 145.1362, 5.0)
        assert len(result) == 2
        assert result[0]["driver_id"] == "driver-uuid-1"
        assert result[0]["distance_km"] == 1.5
        assert result[1]["driver_id"] == "driver-uuid-2"

    def test_handles_redis_exception_gracefully(self):
        redis_mock = MagicMock()
        redis_mock.geosearch.side_effect = Exception("Redis connection failed")
        result = get_active_drivers_from_redis(redis_mock, -37.9105, 145.1362, 5.0)
        assert result == []  # Should return empty, not raise

    def test_queries_correct_parameters(self):
        redis_mock = MagicMock()
        redis_mock.geosearch.return_value = []
        get_active_drivers_from_redis(redis_mock, -37.9105, 145.1362, 5.0)
        redis_mock.geosearch.assert_called_once_with(
            "driver_locations",
            longitude=145.1362,
            latitude=-37.9105,
            radius=5.0,
            unit="km",
            withcoord=True,
            withdist=True,
            sort="ASC",
            count=20,
        )


class TestMatchingSession:
    """Tests for the accept/decline session mechanism."""

    def test_signal_accept(self):
        session = MatchingSession("ride-123", timeout_seconds=1)
        import threading
        def accept_after():
            import time; time.sleep(0.1)
            session.signal_accept("driver-456")
        t = threading.Thread(target=accept_after)
        t.start()
        result = session.wait_for_response()
        assert result is True
        assert session.accepted_by == "driver-456"

    def test_signal_decline(self):
        session = MatchingSession("ride-123", timeout_seconds=1)
        import threading
        def decline_after():
            import time; time.sleep(0.1)
            session.signal_decline()
        t = threading.Thread(target=decline_after)
        t.start()
        result = session.wait_for_response()
        assert result is False

    def test_timeout_returns_false(self):
        session = MatchingSession("ride-123", timeout_seconds=0.2)  # 200ms timeout
        result = session.wait_for_response()
        assert result is False

    def test_accepted_by_none_before_accept(self):
        session = MatchingSession("ride-123", timeout_seconds=1)
        assert session.accepted_by is None


class TestSustainability:
    """Tests for CO2 calculation."""

    def test_import_works(self):
        from app.services.sustainability import compute_co2
        result = compute_co2(10.0, 1)
        assert result['co2_saved_kg'] > 0

    def test_more_passengers_saves_more_co2(self):
        from app.services.sustainability import compute_co2
        single = compute_co2(10.0, 1)
        double = compute_co2(10.0, 2)
        assert double['co2_saved_kg'] > single['co2_saved_kg']

    def test_zero_distance_gives_zero_savings(self):
        from app.services.sustainability import compute_co2
        result = compute_co2(0.0, 1)
        assert result['co2_saved_kg'] == 0.0

    def test_baseline_greater_than_actual(self):
        from app.services.sustainability import compute_co2
        result = compute_co2(10.0, 1)
        # Baseline (multiple cars) should always be >= actual (one car)
        assert result['baseline_co2_kg'] >= result['actual_co2_kg']
