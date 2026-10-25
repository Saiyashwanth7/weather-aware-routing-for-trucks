from datetime import datetime, timedelta, timezone

import pytest

from routing.domain.checkpoints import build_checkpoints, checkpoint_miles, segment_miles
from routing.domain.geometry import Path


def test_47_miles_every_10():
    assert checkpoint_miles(47, 10) == [0, 10, 20, 30, 40, 47]


def test_50_miles_every_10_has_no_duplicate_end():
    assert checkpoint_miles(50, 10) == [0, 10, 20, 30, 40, 50]


def test_a_stop_very_close_to_the_end_is_dropped():
    assert checkpoint_miles(41, 10) == [0, 10, 20, 30, 41]


def test_interval_must_be_positive():
    with pytest.raises(ValueError):
        checkpoint_miles(100, 0)


def test_segment_miles_add_up_to_the_whole_route():
    miles = checkpoint_miles(47, 10)
    segments = segment_miles(miles, 47)
    assert sum(segments) == pytest.approx(47)
    assert segments[0] == pytest.approx(5)   # origin speaks for half of the first gap
    assert segments[1] == pytest.approx(10)


def test_build_checkpoints_gives_increasing_etas():
    departure = datetime(2026, 10, 25, 12, 0, tzinfo=timezone.utc)
    path = Path([(0, 0), (0, 1)], total_miles=100, total_seconds=7200)
    checkpoints = build_checkpoints(path, departure, 25)
    assert [c.mile for c in checkpoints] == [0, 25, 50, 75, 100]
    assert checkpoints[0].eta == departure
    assert checkpoints[-1].eta == departure + timedelta(seconds=7200)
