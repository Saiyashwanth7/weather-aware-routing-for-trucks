const BASE = import.meta.env.VITE_API_BASE || "";

async function request(path, options) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, options);
  } catch {
    throw new Error(
      "Cannot reach the server. Check your connection and try again.",
    );
  }
  let body = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON error page */
  }
  if (!res.ok)
    throw new Error((body && body.error) || `Request failed (${res.status}).`);
  return body;
}

export function analyzeTrip(payload) {
  return request("/api/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export async function searchPlaces(query) {
  const data = await request(`/api/geocode?q=${encodeURIComponent(query)}`);
  return data.results;
}

export function wakeServer() {
  return fetch(`${BASE}/api/health`).catch(() => {});
}
