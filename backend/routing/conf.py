"""Service configuration. Plain env vars so the services have no Django dependency."""

import os

OSRM_BASE_URL = os.environ.get(
    "OSRM_BASE_URL", "https://router.project-osrm.org"
).rstrip("/")
OPEN_METEO_URL = os.environ.get(
    "OPEN_METEO_URL", "https://api.open-meteo.com/v1/forecast"
)
GEOCODE_URL = os.environ.get(
    "GEOCODE_URL", "https://geocoding-api.open-meteo.com/v1/search"
)
NOMINATIM_URL = os.environ.get(
    "NOMINATIM_URL", "https://nominatim.openstreetmap.org/search"
)
USER_AGENT = os.environ.get(
    "HTTP_USER_AGENT",
    "WeatherAwareTruckRouting/1.0 (take-home assessment)",  # headers for API requests
)

# OSRM gives car travel times; trucks are slower, so scale them.
TRUCK_TIME_FACTOR = float(os.environ.get("TRUCK_TIME_FACTOR", "1.10"))
HTTP_TIMEOUT = float(os.environ.get("HTTP_TIMEOUT", "25"))

# Open-Meteo serves hourly forecasts for today + 15 days.
MAX_FORECAST_DAYS = 15
