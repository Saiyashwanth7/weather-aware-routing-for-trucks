import pytest

from routing.domain.risk import (
    assess_checkpoint,
    classify_rain,
    classify_snow,
    classify_wind,
)
from routing.domain.types import RiskLevel as R
from routing.domain.types import Weather

LIGHT = 10_000  # lb, no load rule applies


# ---- Wind table (light load) ----
@pytest.mark.parametrize(
    "mph,expected",
    [
        (0, R.LOW),
        (24.9, R.LOW),
        (25, R.MODERATE),
        (34.9, R.MODERATE),
        (35, R.HIGH),
        (44.9, R.HIGH),
        (45, R.SEVERE),
        (54.9, R.SEVERE),
        (55, R.NO_TRAVEL),
        (80, R.NO_TRAVEL),
    ],
)
def test_wind_table_light_load(mph, expected):
    assert classify_wind(mph, LIGHT) == expected


# ---- Load rules ----
def test_55_mph_is_no_travel_for_any_load():
    assert classify_wind(55, 0) == R.NO_TRAVEL
    assert classify_wind(60, 5_000) == R.NO_TRAVEL


@pytest.mark.parametrize(
    "mph,load,expected",
    [
        (40, 40_000, R.HIGH),  # exactly 40,000 is not "over" 40,000
        (40, 40_001, R.SEVERE),
        (50, 30_000, R.SEVERE),  # exactly 30,000 is not "over" 30,000
        (50, 30_001, R.NO_TRAVEL),
        (30, 90_000, R.MODERATE),  # load rules only start at 35 mph
        (20, 90_000, R.LOW),
    ],
)
def test_load_rules(mph, load, expected):
    assert classify_wind(mph, load) == expected


# ---- Rain and snow tables ----
@pytest.mark.parametrize(
    "rain,expected",
    [
        (0.09, R.LOW),
        (0.10, R.MODERATE),
        (0.24, R.MODERATE),
        (0.25, R.HIGH),
        (0.49, R.HIGH),
        (0.50, R.SEVERE),
        (1.00, R.SEVERE),  # No Travel is strictly greater than 1.00
        (1.01, R.NO_TRAVEL),
    ],
)
def test_rain_table(rain, expected):
    assert classify_rain(rain) == expected


@pytest.mark.parametrize(
    "snow,expected",
    [
        (0.4, R.LOW),
        (0.5, R.MODERATE),
        (1.0, R.HIGH),
        (2.0, R.SEVERE),
        (3.0, R.SEVERE),  # No Travel is strictly greater than 3.0
        (3.01, R.NO_TRAVEL),
    ],
)
def test_snow_table(snow, expected):
    assert classify_snow(snow) == expected


# ---- Whole checkpoint ----
def test_worst_condition_wins():
    result = assess_checkpoint(
        Weather(wind_mph=40, rain_in_hr=0.3, snow_in_hr=0), 45_000
    )
    assert result.wind == R.SEVERE
    assert result.rain == R.HIGH
    assert result.snow == R.LOW
    assert result.level == R.SEVERE


def test_load_rule_is_reported_when_it_raises_the_level():
    result = assess_checkpoint(
        Weather(wind_mph=40, rain_in_hr=0.3, snow_in_hr=0), 45_000
    )
    assert result.drivers == ("wind",)
    assert "40,000" in result.load_rule


def test_load_rule_and_rain_both_listed():
    result = assess_checkpoint(
        Weather(wind_mph=40, rain_in_hr=0.6, snow_in_hr=0), 45_000
    )
    assert result.level == R.SEVERE
    assert result.drivers == ("wind", "rain")
    assert result.load_rule is not None


def test_light_load_leaves_rain_as_the_only_driver():
    result = assess_checkpoint(
        Weather(wind_mph=40, rain_in_hr=0.6, snow_in_hr=0), 10_000
    )
    assert result.level == R.SEVERE
    assert result.drivers == ("rain",)
    assert result.load_rule is None


def test_calm_weather_has_no_drivers():
    result = assess_checkpoint(Weather(wind_mph=5, rain_in_hr=0, snow_in_hr=0), 45_000)
    assert result.level == R.LOW
    assert result.drivers == ()
