"""Core data types. Pure Python: no Django, no HTTP."""

from __future__ import annotations

from dataclasses import dataclass
from enum import IntEnum
from datetime import datetime


# Enums
class RiskLevel(IntEnum):
    """Ordered so max() gives the worst level and averages are meaningful."""

    LOW = 0
    MODERATE = 1
    HIGH = 2
    SEVERE = 3
    NO_TRAVEL = 4

    @property
    def label(self) -> str:  # Text for the UI.
        return self.name.replace("_", " ").title()

    @property
    def key(self) -> str:  # Text for the JSON
        return self.name.lower()


# Data structures for Weather conditions, Risk Assessment, Checkpoint and Route
@dataclass(frozen=True)
class Weather:
    """Weather at one place and time, in the units the assessment uses."""

    wind_mph: float
    rain_in_hr: float
    snow_in_hr: float
    gust_mph: float | None = None  # Shown only in the UI. Not used for risk calculation


@dataclass(frozen=True)
class RiskAssessment:
    """Result for one checkpoint: the overall level plus how we got there."""

    wind: RiskLevel
    rain: RiskLevel
    snow: RiskLevel
    drivers: tuple[str, ...] = ()  # Protects the immutability for this froxen class
    load_rule: str | None = None

    @property
    def level(self) -> RiskLevel:
        return max(self.wind, self.rain, self.snow)


@dataclass(frozen=True)
class Checkpoint:
    mile: float  # miles from the start of the route
    lat: float
    lng: float
    seconds: float  # driving time from departure to this point
    eta: datetime  # departure + seconds


@dataclass(frozen=True)
class Route:
    id: str
    summary: str
    distance_miles: float
    duration_seconds: float
    coordinates: list[tuple[float, float]]  # (lat, lon) points, routing API nundi
