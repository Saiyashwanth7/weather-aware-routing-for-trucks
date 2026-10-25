"""Hourly forecasts from Open-Meteo (free, no API key). One request carries many locations."""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

from .. import conf
from ..domain.types import Weather
from ..errors import ServiceError
from .cache import TTLCache
from .http import get_json

HOURLY = "wind_speed_10m,wind_gusts_10m,rain,showers,snowfall"
CHUNK = 40  # locations per request
_cache = TTLCache(ttl=900)


def _key(lat, lng):
    return round(lat, 2), round(lng, 2)


def _sum(a, b):
    return None if a is None and b is None else (a or 0) + (b or 0)


def _fetch_chunk(keys, start_date, end_date):
    data = get_json(
        conf.OPEN_METEO_URL,
        {
            "latitude": ",".join(f"{la:.2f}" for la, _ in keys),
            "longitude": ",".join(f"{ln:.2f}" for _, ln in keys),
            "hourly": HOURLY,
            "wind_speed_unit": "mph",
            "precipitation_unit": "inch",  # rain and snowfall then come back in inches per hour
            "timezone": "GMT",
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
        },
        what="Weather service",
    )
    locations = data if isinstance(data, list) else [data]
    if len(locations) != len(keys):
        raise ServiceError("Weather service returned an unexpected response.", 502)
    out = {}
    for key, loc in zip(keys, locations):
        hourly = loc["hourly"]
        out[key] = {
            "start": datetime.strptime(hourly["time"][0], "%Y-%m-%dT%H:%M").replace(
                tzinfo=timezone.utc
            ),
            "wind": hourly["wind_speed_10m"],
            "gust": hourly["wind_gusts_10m"],
            "rain": [_sum(a, b) for a, b in zip(hourly["rain"], hourly["showers"])],
            "snow": hourly["snowfall"],
        }
    return out


def fetch_grid(points, start_date, end_date):
    """Fetch hourly weather for (lat, lng) points. Returns {(lat2, lng2): hourly arrays}."""
    today = datetime.now(timezone.utc).date()
    end_date = min(end_date, today + timedelta(days=conf.MAX_FORECAST_DAYS))
    start_date = max(start_date, today - timedelta(days=30))
    if start_date > end_date:
        raise ServiceError(
            f"Forecasts only reach {conf.MAX_FORECAST_DAYS} days ahead. Pick an earlier departure.",
            400,
        )

    keys = sorted({_key(la, ln) for la, ln in points})
    grid, missing = {}, []
    for key in keys:
        hit = _cache.get((key, start_date, end_date))
        if hit is None:
            missing.append(key)
        else:
            grid[key] = hit

    chunks = [missing[i : i + CHUNK] for i in range(0, len(missing), CHUNK)]
    if chunks:
        with ThreadPoolExecutor(max_workers=4) as pool:
            for result in pool.map(
                lambda c: _fetch_chunk(c, start_date, end_date), chunks
            ):
                for key, rec in result.items():
                    _cache.set((key, start_date, end_date), rec)
                    grid[key] = rec
    return grid


class ForecastGrid:
    """Look up conditions at a place and time (nearest forecast hour)."""

    def __init__(self, grid):
        self.grid = grid

    def at(self, lat, lng, when) -> Weather | None:
        rec = self.grid.get(_key(lat, lng))
        if rec is None:
            return None
        idx = round((when - rec["start"]).total_seconds() / 3600)
        if idx < 0 or idx >= len(rec["wind"]) or rec["wind"][idx] is None:
            return None
        gust = rec["gust"][idx]
        return Weather(
            wind_mph=rec["wind"][idx],
            rain_in_hr=rec["rain"][idx] or 0.0,
            snow_in_hr=rec["snow"][idx] or 0.0,
            gust_mph=rec["wind"][idx] if gust is None else gust,
        )
