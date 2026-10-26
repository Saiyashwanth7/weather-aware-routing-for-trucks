from __future__ import annotations

import math
from datetime import timedelta, timezone


from ..clients.weather import ForecastGrid, fetch_grid
from ..domain.checkpoints import build_checkpoints, segment_miles
from ..domain.geometry import Path, simplify_indices
from ..domain.recommend import recommend
from ..domain.risk import assess_checkpoint
from ..domain.types import RiskLevel

HEAT_HOURS = 48  # the brief's slider: departure + 0..48 h, the least we always offer
MAX_HEAT_HOURS = (
    120  # a long trip stretches the slider to its end, but never past 5 days
)


def iso(dt):
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _heat_hours(paths):
    """Slider length: at least 48 hours, and long enough for the truck to reach the end of the longest route."""
    longest_hours = max(path.total_seconds for path in paths) / 3600
    return min(MAX_HEAT_HOURS, max(HEAT_HOURS, math.ceil(longest_hours)))


def _heat_series(forecast, checkpoint, base, load_lb, heat_hours):
    """Risk level at this checkpoint for each hour of the slider (-1 = no forecast)."""
    series = []
    for hour in range(heat_hours + 1):
        weather = forecast.at(
            checkpoint.lat, checkpoint.lng, base + timedelta(hours=hour)
        )
        series.append(
            -1 if weather is None else int(assess_checkpoint(weather, load_lb).level)
        )
    return series


def _route_result(
    idx, path, checkpoints, forecast, base, departure, load_lb, heat_hours
):

    total = path.total_miles
    seg = segment_miles([c.mile for c in checkpoints], total)
    miles_by_level = {level: 0.0 for level in RiskLevel}
    weighted = 0.0
    missing = 0
    out_cps = []

    for i, (cp, seg_mi) in enumerate(zip(checkpoints, seg)):
        wx = forecast.at(cp.lat, cp.lng, cp.eta)
        if wx is None:
            assessment = None
            missing += 1
            level = RiskLevel.LOW
        else:
            assessment = assess_checkpoint(wx, load_lb)
            level = assessment.level
        miles_by_level[level] += seg_mi
        weighted += level * seg_mi

        out_cps.append(
            {
                "index": i,
                "mile": round(cp.mile, 1),
                "segment_miles": round(seg_mi, 1),
                "lat": round(cp.lat, 5),
                "lng": round(cp.lng, 5),
                "eta": iso(cp.eta),
                "has_data": wx is not None,
                "level": int(level),
                "level_name": level.label,
                "drivers": list(assessment.drivers) if assessment else [],
                "load_rule": assessment.load_rule if assessment else None,
                "wind_mph": round(wx.wind_mph, 1) if wx is not None else None,
                "gust_mph": round(wx.gust_mph, 1) if wx is not None else None,
                "rain_in_hr": round(wx.rain_in_hr, 2) if wx is not None else None,
                "snow_in_hr": round(wx.snow_in_hr, 2) if wx is not None else None,
                "heat": _heat_series(forecast, cp, base, load_lb, heat_hours),
            }
        )

    keep = simplify_indices(path.coords)
    path_out = [
        [
            round(path.coords[i][0], 5),
            round(path.coords[i][1], 5),
            round(path.miles[i], 2),
        ]
        for i in keep
    ]
    max_level = max(c["level"] for c in out_cps)
    arrival = departure + timedelta(seconds=path.total_seconds)

    return {
        "id": f"r{idx + 1}",
        "name": f"Route {chr(65 + idx)}",
        "distance_miles": round(total, 1),
        "duration_minutes": round(path.total_seconds / 60),
        "arrival": iso(arrival),
        "path": path_out,
        "checkpoints": out_cps,
        "summary": {
            "miles_by_level": {
                level.key: round(v, 1) for level, v in miles_by_level.items()
            },
            "avg_risk": round(weighted / total, 2) if total else 0.0,
            "max_level": max_level,
            "max_level_name": RiskLevel(max_level).label,
            "blocked": max_level == RiskLevel.NO_TRAVEL,
            "checkpoints_without_forecast": missing,
        },
        "is_fastest": False,
        "is_recommended": False,
    }


def analyze_routes(routes, departure, load_lb, interval, fetch=fetch_grid):
    """routes: dicts from clients.routing.get_routes(). departure: aware datetime.

    `fetch` can be swapped for a fake in tests, so the whole pipeline runs without the network.
    """
    departure = departure.astimezone(timezone.utc)
    base = departure  # slider hour 0 is the departure moment itself

    prepared = []
    for raw in routes:
        path = Path(raw["coords"], raw["miles"], raw["seconds"], raw.get("seg_seconds"))
        prepared.append((path, build_checkpoints(path, departure, interval)))

    last_eta = max(cp.eta for _, cps in prepared for cp in cps)
    heat_hours = _heat_hours([path for path, _ in prepared])
    window_end = max(
        base + timedelta(hours=heat_hours + 1), last_eta + timedelta(hours=1)
    )
    points = [(cp.lat, cp.lng) for _, cps in prepared for cp in cps]
    forecast = ForecastGrid(fetch(points, base.date(), window_end.date()))

    results = [
        _route_result(i, path, cps, forecast, base, departure, load_lb, heat_hours)
        for i, (path, cps) in enumerate(prepared)
    ]
    recommended_id, recommendation = recommend(results)
    return {
        "heat_base": iso(base),
        "heat_hours": heat_hours,
        "recommended_route_id": recommended_id,
        "recommendation": recommendation,
        "routes": results,
    }
