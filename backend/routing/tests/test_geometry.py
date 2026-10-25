import pytest

from routing.domain.geometry import Path, cumulative_miles, haversine_miles, simplify_indices


def test_one_degree_of_longitude_at_the_equator():
    assert haversine_miles(0, 0, 0, 1) == pytest.approx(69.09, rel=0.01)


def test_cumulative_miles_starts_at_zero_and_adds_up():
    result = cumulative_miles([(0, 0), (0, 1), (0, 2)])
    assert result[0] == 0.0
    assert result[1] == pytest.approx(69.09, rel=0.01)
    assert result[2] == pytest.approx(138.17, rel=0.01)


def test_path_is_rescaled_to_the_api_distance():
    path = Path([(0, 0), (0, 1), (0, 2)], total_miles=200, total_seconds=7200)
    assert path.total_miles == pytest.approx(200)
    lat, lng, seconds = path.at(100)
    assert lat == pytest.approx(0)
    assert lng == pytest.approx(1)
    assert seconds == pytest.approx(3600)


def test_path_uses_segment_durations_when_given():
    # first half takes 1000 s, second half takes 3000 s, so the middle point is at 1000 s
    path = Path([(0, 0), (0, 1), (0, 2)], 200, 4000, seg_seconds=[1000, 3000])
    _, _, seconds = path.at(100)
    assert seconds == pytest.approx(1000)


def test_path_at_clamps_outside_the_route():
    path = Path([(0, 0), (0, 1)], 100, 3600)
    assert path.at(-5)[:2] == pytest.approx((0, 0))
    assert path.at(9999)[:2] == pytest.approx((0, 1))


def test_path_needs_two_points():
    with pytest.raises(ValueError):
        Path([(0, 0)], 10, 60)


def test_straight_line_simplifies_to_its_ends():
    assert simplify_indices([(0, 0), (0, 1), (0, 2), (0, 3)]) == [0, 3]
