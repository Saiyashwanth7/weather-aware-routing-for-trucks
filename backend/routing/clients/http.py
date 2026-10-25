import time

import requests

from .. import conf
from ..errors import ServiceError

# shared session
_session = requests.Session()
_session.headers["User-Agent"] = conf.USER_AGENT

_RETRY_STATUSES = (429, 500, 502, 503, 504)


def _reason(resp):
    try:
        body = resp.json()
        if isinstance(body, dict):
            return str(
                body.get("reason")
                or body.get("message")
                or body.get("error")
                or resp.status_code
            )
    except ValueError:
        pass
    return f"HTTP {resp.status_code}"


def get_json(url, params=None, what="Service", accept=(200,), retries=2):
    last = f"{what} did not respond"
    for attempt in range(retries + 1):
        try:
            resp = _session.get(url, params, timeout=conf.HTTP_TIMEOUT)
        except requests.RequestException as exc:
            last = f"{what} is unreachable ({exc.__class__.__name__})"
        else:
            if resp.status_code in accept:
                try:
                    return resp.json()
                except ValueError:
                    last = f"{what} returned an invalid response"
            elif resp.status_code in _RETRY_STATUSES:
                last = f"{what} is busy right now (HTTP {resp.status_code}). Try again in a moment."
            else:
                raise ServiceError(f"{what} rejected the request: {_reason(resp)}", 502)
        if attempt < retries:
            time.sleep(0.6 * (attempt + 1))
    raise ServiceError(last, 502)
