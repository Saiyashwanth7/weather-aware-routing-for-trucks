from __future__ import annotations

from datetime import datetime, timedelta

from .geometry import Path
from .types import Checkpoint

EARTH_RADIUS_MILES = 3958.8


# A function to divide the total miles into checkpoints required intervals
def checkpoint_miles(total_miles: float, interval_miles: float) -> list[float]:
    if interval_miles <= 0:
        raise ValueError("interval_miles must be positive")

    miles = []
    point = 0.0
    while point < total_miles:
        miles.append(point)
        point += interval_miles
    if len(miles) > 1 and total_miles - miles[-1] < interval_miles * 0.2:
        """A stop that would land within 20% of an interval from the destination is dropped,
        so we never sample two almost identical spots."""
        miles.pop()
    miles.append(total_miles)
    return miles


# ee function checkpoint miles use chesi vaati mid points ni edges[list] lo store cheskuntadhi
# and last lo edges lo ni mid points lo checkpoint lo ni weather dhi impact untundha ni thelsukovadaniki list isthundhi ee funciton
def segment_miles(miles: list[float], total_miles: float) -> list[float]:
    edges = [0.0] + [(a + b) / 2 for a, b in zip(miles, miles[1:])] + [total_miles]
    return [edges[i + 1] - edges[i] for i in range(len(miles))]


# the acutal function which we use for building the checkpoints
def build_checkpoints(
    path: Path, departure: datetime, interval_miles: float
) -> list[Checkpoint]:
    checkpoints = []
    for mile in checkpoint_miles(path.total_miles, interval_miles):
        lat, lng, seconds = path.at(mile)
        checkpoints.append(
            Checkpoint(
                mile=mile,
                lat=lat,
                lng=lng,
                seconds=seconds,
                eta=departure + timedelta(seconds=seconds),
            )
        )
    return checkpoints
