from routing.domain.recommend import recommend


def make(route_id, name, minutes, severe=0.0, high=0.0, avg=0.0, no_travel=0.0):
    return {
        "id": route_id,
        "name": name,
        "duration_minutes": minutes,
        "summary": {
            "miles_by_level": {"low": 0, "moderate": 0, "high": high, "severe": severe, "no_travel": no_travel},
            "avg_risk": avg,
            "blocked": no_travel > 0,
        },
        "is_fastest": False,
        "is_recommended": False,
    }


def test_fewer_severe_miles_beats_a_faster_route():
    fast = make("r1", "Route A", 100, severe=50)
    safe = make("r2", "Route B", 200, severe=0)
    best_id, info = recommend([fast, safe])
    assert best_id == "r2"
    assert "fewer Severe miles" in info["reason"]
    assert fast["is_fastest"] and not fast["is_recommended"]
    assert safe["is_recommended"]


def test_high_miles_break_a_severe_tie():
    a = make("r1", "Route A", 100, high=30)
    b = make("r2", "Route B", 200, high=10)
    assert recommend([a, b])[0] == "r2"


def test_average_risk_breaks_a_tie_after_that():
    a = make("r1", "Route A", 100, avg=0.5)
    b = make("r2", "Route B", 200, avg=0.1)
    assert recommend([a, b])[0] == "r2"


def test_same_risk_means_the_quicker_route_wins():
    a = make("r1", "Route A", 200)
    b = make("r2", "Route B", 100)
    best_id, info = recommend([a, b])
    assert best_id == "r2"
    assert "quicker" in info["reason"]


def test_a_blocked_route_never_beats_a_drivable_one():
    blocked = make("r1", "Route A", 100, no_travel=10)
    drivable = make("r2", "Route B", 200, severe=100)
    assert recommend([blocked, drivable])[0] == "r2"


def test_all_blocked_suggests_leaving_later():
    a = make("r1", "Route A", 100, no_travel=10)
    b = make("r2", "Route B", 200, no_travel=40)
    best_id, info = recommend([a, b])
    assert best_id == "r1"
    assert info["all_blocked"] is True
    assert "Consider leaving later" in info["reason"]
