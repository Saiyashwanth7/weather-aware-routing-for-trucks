"""Route options from OSRM (open-source routing, public demo server by default).

The brief wants three routes. OSRM's `alternatives` often returns only one or two on long
trips, so if we come up short we ask for routes through "via" points pushed sideways from the
midpoint and keep the ones that are genuinely different from what we already have.
"""

import math

from .. import conf
from ..domain.geometry import haversine_miles
from ..errors import ServiceError
from .http import get_json

M_TO_MI = 0.000621371
WANTED_ROUTES = 3
VIA_OFFSETS = (
    0.12,
    -0.12,
    0.22,
    -0.22,
    0.35,
    -0.35,
)  # sideways push, as a share of trip length
MAX_DETOUR = 1.6  # ignore via routes more than 60% longer/slower than the best route
_CELL = 0.02  # degrees, roughly 2 km


def _parse(route):
    coords = [(lat, lng) for lng, lat in route["geometry"]["coordinates"]]
    seg = []
    for leg in route.get("legs", []):
        seg.extend((leg.get("annotation") or {}).get("duration") or [])
    return {
        "coords": coords,
        "miles": route["distance"] * M_TO_MI,
        "seconds": route["duration"] * conf.TRUCK_TIME_FACTOR,
        "seg_seconds": seg if len(seg) == len(coords) - 1 else None,
    }


def _osrm(waypoints, alternatives):
    coords = ";".join(f"{lng:.6f},{lat:.6f}" for lat, lng in waypoints)
    data = get_json(
        f"{conf.OSRM_BASE_URL}/route/v1/driving/{coords}",
        {
            "overview": "full",
            "geometries": "geojson",
            "annotations": "duration",
            "steps": "false",
            "alternatives": "3" if alternatives else "false",
        },
        what="Routing service",
        accept=(200, 400),
    )
    if data.get("code") != "Ok":
        raise ServiceError(
            data.get("message") or "No drivable route found between those places.", 422
        )
    return [_parse(r) for r in data.get("routes", [])]


def _cells(coords):
    """Grid cells touched by a route (densified so long straight stretches leave no gaps)."""
    cells = set()
    prev = None
    for lat, lng in coords:
        if prev is not None:
            steps = int(max(abs(lat - prev[0]), abs(lng - prev[1])) / (_CELL / 2))
            for k in range(1, steps):
                f = k / steps
                cells.add(
                    (
                        math.floor((prev[0] + (lat - prev[0]) * f) / _CELL),
                        math.floor((prev[1] + (lng - prev[1]) * f) / _CELL),
                    )
                )
        cells.add((math.floor(lat / _CELL), math.floor(lng / _CELL)))
        prev = (lat, lng)
    return cells


def _middle_overlap(candidate, other_cells):
    """Share of the candidate's middle 60% that runs along `other` (within ~2 km)."""
    pts = candidate["coords"]
    n = 60
    sample = [pts[round(i * (len(pts) - 1) / (n - 1))] for i in range(n)][
        int(n * 0.2) : int(n * 0.8)
    ]
    hit = 0
    for lat, lng in sample:
        ci, cj = math.floor(lat / _CELL), math.floor(lng / _CELL)
        if any(
            (ci + di, cj + dj) in other_cells for di in (-1, 0, 1) for dj in (-1, 0, 1)
        ):
            hit += 1
    return hit / len(sample)


def _via_point(origin, dest, offset):
    """Point pushed sideways (perpendicular) from the midpoint of origin->destination."""
    mid_lat = (origin["lat"] + dest["lat"]) / 2
    mid_lng = (origin["lng"] + dest["lng"]) / 2
    cos_lat = math.cos(math.radians(mid_lat)) or 1e-6
    dx = (dest["lng"] - origin["lng"]) * cos_lat
    dy = dest["lat"] - origin["lat"]
    length = math.hypot(dx, dy)
    px, py = -dy / length, dx / length
    return mid_lat + py * offset * length, mid_lng + (px * offset * length) / cos_lat


def get_routes(origin, dest):
    """Return (routes sorted fastest-first, warnings)."""
    if haversine_miles(origin["lat"], origin["lng"], dest["lat"], dest["lng"]) < 0.5:
        raise ServiceError("Origin and destination are the same place.", 400)

    found = _osrm(
        [(origin["lat"], origin["lng"]), (dest["lat"], dest["lng"])], alternatives=True
    )
    if not found:
        raise ServiceError("No drivable route found between those places.", 422)
    routes = found[:WANTED_ROUTES]
    best = min(r["seconds"] for r in routes)
    cells = [_cells(r["coords"]) for r in routes]

    for offset in VIA_OFFSETS:
        if len(routes) >= WANTED_ROUTES:
            break
        via = _via_point(origin, dest, offset)
        try:
            candidates = _osrm(
                [(origin["lat"], origin["lng"]), via, (dest["lat"], dest["lng"])], False
            )
        except ServiceError:
            continue
        for cand in candidates[:1]:
            if cand["seconds"] > best * MAX_DETOUR:
                continue
            if any(_middle_overlap(cand, c) >= 0.8 for c in cells):
                continue
            routes.append(cand)
            cells.append(_cells(cand["coords"]))

    routes.sort(key=lambda r: r["seconds"])
    warnings = []
    if len(routes) < WANTED_ROUTES:
        warnings.append(
            f"Only {len(routes)} distinct route(s) could be found for this trip."
        )
    return routes, warnings
