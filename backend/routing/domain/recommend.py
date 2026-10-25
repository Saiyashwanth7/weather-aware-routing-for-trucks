from __future__ import annotations

# this is the actual recommendation engine
""" The order of comparion of routes:
1) Fewest Severe miles.
2) Fewest High miles.
3) Lowest average risk.
4) Shortest travel time."""


# based on this order, we will define a ranking key (which will be later used to sort the routes)
def rank_key(route: dict) -> tuple:
    s = route["summary"]
    m = s["miles_by_level"]
    return (
        m["no_travel"],
        m["severe"],
        m["high"],
        s["avg_risk"],
        route["duration_minutes"],
    )


# removes trailing zeroes from a float and converts the float into a string
def _fmt(x: float) -> str:
    return f"{x:g}"


def recommend(
    routes: list[dict],
) -> tuple[str, dict]:  # (recommended_route_id, explanation_dict)
    ranked = sorted(routes, key=rank_key)
    best = ranked[0]
    best["is_recommended"] = True
    min(routes, key=lambda r: r["duration_minutes"])["is_fastest"] = True
    all_booked = all(r["summary"]["blocked"] for r in routes)

    # reasoning about the route choice
    if len(ranked) == 1:  # if there is only one route available
        reason = f"{best['name']} is the only route available."
    elif all_booked:  # if none of the routes are available or all routes are blocked
        reason = (
            f"Every route hits No Travel conditions at this departure time. {best['name']} has the "
            f"least ({_fmt(best['summary']['miles_by_level']['no_travel'])} mi). Consider leaving later."
        )
    else:  # now, if len(ranked)>1, we will compare the best route and the second best route for reasoning
        other = ranked[1]
        b, o = best["summary"]["miles_by_level"], other["summary"]["miles_by_level"]
        checks = [
            ("fewer No Travel miles", b["no_travel"], o["no_travel"], "mi"),
            ("fewer Severe miles", b["severe"], o["severe"], "mi"),
            ("fewer High miles", b["high"], o["high"], "mi"),
            (
                "a lower average risk",
                best["summary"]["avg_risk"],
                other["summary"]["avg_risk"],
                "",
            ),
        ]
        reason = f"{best['name']} and {other['name']} carry the same weather risk; {best['name']} is quicker."
        for label, mine, their, unit in checks:
            if mine < their:
                unit = f"{unit}" if unit else ""
                reason = (
                    f"{best['name']} has {label} than {other['name']} "
                    f"({_fmt(mine)}{unit} vs {_fmt(their)}{unit})."
                )
                break
    return best["id"], {"reason": reason, "all_blocked": all_booked}
