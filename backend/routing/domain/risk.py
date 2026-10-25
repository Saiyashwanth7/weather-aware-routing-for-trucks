"""Weather risk classification, straight from the assessment's Risk Rules.

Boundary convention (the PDF's ranges overlap/leave gaps, e.g. rain
"0.10-0.25" then "0.25-0.50", wind "25-34" then "35-44"):
  * lower bound inclusive, upper bound exclusive -> 0.25 in/hr rain is High
  * the No Travel cut-offs follow the PDF literally:
      wind  >= 55  (so 55 is No Travel)
      rain  >  1.00 (so 1.00 is still Severe)
      snow  >  3.0  (so 3.0 is still Severe)
"""

from __future__ import annotations

from .types import RiskAssessment, RiskLevel, Weather

# Load rule thresholds (lb)
HEAVY_LOAD_WIND_45_LB = 30_000  # 45-54 mph and load > this  -> No Travel
HEAVY_LOAD_WIND_35_LB = 40_000  # 35-44 mph and load > this  -> Severe

LOAD_RULE_NO_TRAVEL = "Wind 45-54 mph with a load over 30,000 lb is No Travel"
LOAD_RULE_SEVERE = "Wind 35-44 mph with a load over 40,000 lb is Severe"


def classify_wind(wind_mph: float, load_lb: float) -> RiskLevel:
    """Wind level, including the load-based escalation rules."""
    if wind_mph >= 55:
        return RiskLevel.NO_TRAVEL  # any load

    if wind_mph >= 45:
        if load_lb > HEAVY_LOAD_WIND_45_LB:
            return RiskLevel.NO_TRAVEL
        return RiskLevel.SEVERE

    if wind_mph >= 35:
        if load_lb > HEAVY_LOAD_WIND_35_LB:
            return RiskLevel.SEVERE
        return RiskLevel.HIGH

    if wind_mph >= 25:
        return RiskLevel.MODERATE

    return RiskLevel.LOW


def classify_rain(rain_in_hr: float) -> RiskLevel:
    if rain_in_hr > 1.00:
        return RiskLevel.NO_TRAVEL
    if rain_in_hr >= 0.50:
        return RiskLevel.SEVERE
    if rain_in_hr >= 0.25:
        return RiskLevel.HIGH
    if rain_in_hr >= 0.10:
        return RiskLevel.MODERATE
    return RiskLevel.LOW


def classify_snow(snow_in_hr: float) -> RiskLevel:
    if snow_in_hr > 3.00:
        return RiskLevel.NO_TRAVEL
    if snow_in_hr >= 2.00:
        return RiskLevel.SEVERE
    if snow_in_hr >= 1.00:
        return RiskLevel.HIGH
    if snow_in_hr >= 0.50:
        return RiskLevel.MODERATE
    return RiskLevel.LOW


def _load_rule_message(wind_mph: float, load_lb: float) -> str | None:
    if 45 <= wind_mph < 55 and load_lb > HEAVY_LOAD_WIND_45_LB:
        return LOAD_RULE_NO_TRAVEL
    if 35 <= wind_mph < 45 and load_lb > HEAVY_LOAD_WIND_35_LB:
        return LOAD_RULE_SEVERE
    return None


def assess_checkpoint(weather: Weather, load_lb: float) -> RiskAssessment:
    # first we calculate the risk values for all 3 weather conditions
    wind = classify_wind(weather.wind_mph, load_lb)
    rain = classify_rain(weather.rain_in_hr)
    snow = classify_snow(weather.snow_in_hr)
    # store the worst risk value
    worst = max(wind, rain, snow)

    # now store all the weather names causing the risk by comparing their risk level to the worst risk level
    drivers = tuple(
        name
        for name, level in (("wind", wind), ("rain", rain), ("snow", snow))
        if level == worst and worst > RiskLevel.LOW
    )

    # now check if the risk contributed by the wind is only because of the load or not
    load_rule = None
    if "wind" in drivers and wind > classify_wind(weather.wind_mph, 0):
        load_rule = _load_rule_message(weather.wind_mph, load_lb)
    return RiskAssessment(wind, rain, snow, drivers, load_rule)
