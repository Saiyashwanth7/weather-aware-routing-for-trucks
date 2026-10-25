"""The whole pipeline with a fake forecast, so no network is needed."""
from datetime import datetime, timezone

import pytest

from routing.services.trip_planner import HEAT_HOURS, analyze_routes


def fake_fetch(points, start_date, end_date):
    """Calm weather south of lat 30.5, a 40 mph wind north of it."""
    start = datetime(start_date.year, start_date.month, start_date.day, tzinfo=timezone.utc)
    hours = ((end_date - start_date).days + 1) * 24
    grid = {}
    for lat, lng in points:
        wind = 40.0 if lat >= 30.5 else 5.0
        grid[(round(lat, 2), round(lng, 2))] = {
            "start": start,
            "wind": [wind] * hours,
            "gust": [wind + 5] * hours,
            "rain": [0.0] * hours,
            "snow": [0.0] * hours,
        }
    return grid


CALM_ROUTE = {"coords": [(30.0, -97.0), (30.0, -96.0)], "miles": 60, "seconds": 3600, "seg_seconds": None}
WINDY_ROUTE = {"coords": [(31.0, -97.0), (31.0, -96.0)], "miles": 62, "seconds": 3700, "seg_seconds": None}
DEPARTURE = datetime(2026, 10, 25, 12, 30, tzinfo=timezone.utc)


def test_calm_route_is_recommended_over_the_windy_one():
    result = analyze_routes([CALM_ROUTE, WINDY_ROUTE], DEPARTURE, 45_000, 10, fetch=fake_fetch)

    assert result["recommended_route_id"] == "r1"
    calm, windy = result["routes"]
    assert calm["summary"]["miles_by_level"]["severe"] == 0
    assert windy["summary"]["miles_by_level"]["severe"] == pytest.approx(62)
    assert "fewer Severe miles" in result["recommendation"]["reason"]


def test_payload_shape_the_frontend_relies_on():
    result = analyze_routes([CALM_ROUTE], DEPARTURE, 10_000, 10, fetch=fake_fetch)
    route = result["routes"][0]
    first = route["checkpoints"][0]

    assert result["heat_hours"] == HEAT_HOURS
    assert result["heat_base"] == "2026-10-25T12:30:00Z"  # slider starts at departure
    assert len(first["heat"]) == HEAT_HOURS + 1
    assert first["eta"] == "2026-10-25T12:30:00Z"
    assert first["level_name"] == "Low"
    assert first["has_data"] is True
    assert [c["mile"] for c in route["checkpoints"]] == [0, 10, 20, 30, 40, 50, 60]
    assert route["is_recommended"] is True


def test_load_rule_shows_up_on_the_checkpoint():
    result = analyze_routes([WINDY_ROUTE], DEPARTURE, 45_000, 25, fetch=fake_fetch)
    checkpoint = result["routes"][0]["checkpoints"][0]
    assert checkpoint["level_name"] == "Severe"
    assert checkpoint["drivers"] == ["wind"]
    assert "40,000" in checkpoint["load_rule"]
