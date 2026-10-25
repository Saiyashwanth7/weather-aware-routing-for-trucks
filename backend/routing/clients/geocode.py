"""Place lookup. Open-Meteo's geocoder (free, autocomplete-friendly) first; Nominatim as a
fallback for full street addresses when a place is submitted without picking a suggestion.
"""

from .. import conf
from ..errors import ServiceError
from .http import get_json

US_STATES = {
    "AL": "Alabama",
    "AK": "Alaska",
    "AZ": "Arizona",
    "AR": "Arkansas",
    "CA": "California",
    "CO": "Colorado",
    "CT": "Connecticut",
    "DE": "Delaware",
    "FL": "Florida",
    "GA": "Georgia",
    "HI": "Hawaii",
    "ID": "Idaho",
    "IL": "Illinois",
    "IN": "Indiana",
    "IA": "Iowa",
    "KS": "Kansas",
    "KY": "Kentucky",
    "LA": "Louisiana",
    "ME": "Maine",
    "MD": "Maryland",
    "MA": "Massachusetts",
    "MI": "Michigan",
    "MN": "Minnesota",
    "MS": "Mississippi",
    "MO": "Missouri",
    "MT": "Montana",
    "NE": "Nebraska",
    "NV": "Nevada",
    "NH": "New Hampshire",
    "NJ": "New Jersey",
    "NM": "New Mexico",
    "NY": "New York",
    "NC": "North Carolina",
    "ND": "North Dakota",
    "OH": "Ohio",
    "OK": "Oklahoma",
    "OR": "Oregon",
    "PA": "Pennsylvania",
    "RI": "Rhode Island",
    "SC": "South Carolina",
    "SD": "South Dakota",
    "TN": "Tennessee",
    "TX": "Texas",
    "UT": "Utah",
    "VT": "Vermont",
    "VA": "Virginia",
    "WA": "Washington",
    "WV": "West Virginia",
    "WI": "Wisconsin",
    "WY": "Wyoming",
    "DC": "District of Columbia",
}
_US_NAMES = {"usa", "us", "u.s.", "u.s.a.", "united states"}


def _matches(qualifier, hit):
    """Does a ", TX" / ", Texas" / ", USA" qualifier agree with this geocoder hit?"""
    q = qualifier.lower()
    region = (hit.get("admin1") or "").lower()
    country = (hit.get("country") or "").lower()
    code = (hit.get("country_code") or "").lower()
    if q in (region, country, code):
        return True
    if q.upper() in US_STATES and US_STATES[q.upper()].lower() == region:
        return True
    return q in _US_NAMES and code == "us"


def search(query, limit=6):
    """Return [{label, lat, lng}] for a free-text place such as "Dallas, TX"."""
    parts = [p.strip() for p in query.split(",") if p.strip()]
    if not parts or len(parts[0]) < 2:
        return []
    name, qualifiers = parts[0], parts[1:]
    data = get_json(
        conf.GEOCODE_URL,
        {
            "name": name,
            "count": 20 if qualifiers else limit,
            "language": "en",
            "format": "json",
        },
        what="Geocoding service",
    )
    out = []
    for hit in data.get("results") or []:
        if qualifiers and not all(_matches(q, hit) for q in qualifiers):
            continue
        label = ", ".join(
            x
            for x in (hit.get("name"), hit.get("admin1"), hit.get("country_code"))
            if x
        )
        out.append({"label": label, "lat": hit["latitude"], "lng": hit["longitude"]})
        if len(out) >= limit:
            break
    return out


def _nominatim(query):
    data = get_json(
        conf.NOMINATIM_URL,
        {"q": query, "format": "jsonv2", "limit": 1},
        what="Address lookup",
    )
    if not data:
        return None
    hit = data[0]
    return {
        "label": hit.get("display_name") or query,
        "lat": float(hit["lat"]),
        "lng": float(hit["lon"]),
    }


def resolve(place):
    """Turn {"lat","lng","label"} or {"query": "..."} into {"lat","lng","label"}."""
    if "lat" in place:
        return {
            "lat": place["lat"],
            "lng": place["lng"],
            "label": place.get("label") or "",
        }
    query = place["query"]
    hits = search(query, limit=1)
    hit = hits[0] if hits else _nominatim(query)
    if not hit:
        raise ServiceError(
            f"Couldn't find a place called '{query}'. Try the form 'City, ST'.", 422
        )
    return hit
