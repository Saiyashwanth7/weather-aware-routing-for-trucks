from __future__ import annotations

import bisect
import math

EARTH_RADIUS_MILES = 3958.756


def haversine_miles(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Great-circle distance between two (lat, lng) points, in miles."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = p2 - p1
    dlam = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlam / 2) ** 2
    return 2 * EARTH_RADIUS_MILES * math.asin(min(1.0, math.sqrt(a)))


def cumulative_miles(coords: list[tuple[float, float]]) -> list[float]:
    """For every point: miles from the first point, following the line."""
    result = [0.0]
    for previous, current in zip(coords, coords[1:]):
        result.append(result[-1] + haversine_miles(*previous, *current))
    return result


class Path:
    def __init__(self, coords, total_miles, total_seconds, seg_seconds=None):
        if len(coords) < 2:
            raise ValueError("A route needs at least two points")
        self.coords = coords
        raw = cumulative_miles(coords)
        scale = total_miles / raw[-1] if raw[-1] > 0 else 1.0
        self.miles = [m * scale for m in raw]
        self.total_miles = self.miles[-1] if raw[-1] > 0 else total_miles
        self.total_seconds = total_seconds

        if seg_seconds and len(seg_seconds) == len(coords) - 1 and sum(seg_seconds) > 0:
            cum = [0.0]
            for s in seg_seconds:
                cum.append(cum[-1] + s)
            k = total_seconds / cum[-1]
            self.seconds = [c * k for c in cum]
        else:
            denom = self.miles[-1] or 1.0
            self.seconds = [m / denom * total_seconds for m in self.miles]

    def at(self, mile: float) -> tuple[float, float, float]:
        """Return (lat, lng, seconds_since_departure) at `mile` along the route."""
        mile = min(max(mile, 0.0), self.miles[-1])
        i = min(bisect.bisect_right(self.miles, mile) - 1, len(self.coords) - 2)
        i = max(i, 0)
        a, b = self.miles[i], self.miles[i + 1]
        f = (mile - a) / (b - a) if b > a else 0.0
        lat = self.coords[i][0] + f * (self.coords[i + 1][0] - self.coords[i][0])
        lng = self.coords[i][1] + f * (self.coords[i + 1][1] - self.coords[i][1])
        sec = self.seconds[i] + f * (self.seconds[i + 1] - self.seconds[i])
        return lat, lng, sec


# Now, let's build a function which helps us remove the unwanted coordinates in the points
# This uses Douglas–Peucker algorithm
def simplify_indices(
    points, tolerence=0.0008
):  # This returns the list indices of points not the actual corrdinates/points
    n = len(points)
    if n <= 3:
        return list(range(n))
    keep = [False] * n
    keep[0] = keep[-1] = True  # first and last must be true
    stack = [(0, n - 1)]  # first and last index of the points list
    while stack:
        s, e = stack.pop()
        ax, ay = points[s]
        bx, by = points[e]
        dx, dy = bx - ax, by - ay
        d2 = dx * dx + dy * dy  # euclidean formula but squared
        # now, find the farthest valid point from both start and end
        far, far_i = -1.0, -1
        for i in range(
            s + 1, e
        ):  # Start and end points madhya unna intermediate points ni okkokkati examine chestham.
            px, py = points[i]
            if d2 == 0:
                dist = math.hypot(px - ax, py - ay)
            else:
                t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / d2))
                dist = math.hypot(px - (ax + t * dx), py - (ay + t * dy))
            if dist > far:
                far, far_i = dist, i
        if far > tolerence:
            keep[far_i] = True
            stack.append((s, far_i))
            stack.append((far_i, e))
    return [i for i in range(n) if keep[i]]
