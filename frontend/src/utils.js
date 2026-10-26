export const LEVELS = ["Low", "Moderate", "High", "Severe", "No Travel"];
export const COLORS = ["#2f9e5b", "#e3b505", "#ef8a1f", "#d7372b", "#6b21a8"];
export const ROUTE_COLORS = ["#1d4ed8", "#0e7490", "#374151"];
export const NO_DATA_COLOR = "#9aa5ad";

const RGB = COLORS.map((hex) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)),
);

/** Smooth colour for a fractional risk level (0 = Low ... 4 = No Travel). */
export function colorAt(v) {
  const x = Math.min(Math.max(v, 0), RGB.length - 1);
  const i = Math.min(Math.floor(x), RGB.length - 2);
  const t = x - i;
  const c = RGB[i].map((a, k) => Math.round(a + (RGB[i + 1][k] - a) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export function esc(s) {
  return String(s).replace(
    /[&<>"']/g,
    (ch) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        ch
      ],
  );
}

export function fmtDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

export function fmtDateTime(value) {
  return new Date(value).toLocaleString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function fmtTime(value) {
  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** [lat, lng] at `mile` along a path of [lat, lng, mile] vertices. */
export function pointAt(path, mile) {
  const last = path.length - 1;
  if (mile <= path[0][2]) return [path[0][0], path[0][1]];
  if (mile >= path[last][2]) return [path[last][0], path[last][1]];
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (path[mid][2] <= mile) lo = mid;
    else hi = mid;
  }
  const [la, lna, ma] = path[lo];
  const [lb, lnb, mb] = path[hi];
  const f = mb > ma ? (mile - ma) / (mb - ma) : 0;
  return [la + (lb - la) * f, lna + (lnb - lna) * f];
}

/** Cut a path into `count` equal-mileage pieces that follow the road. Each has latlngs and its midpoint mile. */
export function buildPieces(path, count) {
  const total = path[path.length - 1][2];
  const step = total / count;
  const pieces = [];
  let prev = [path[0][0], path[0][1]];
  let prevMile = 0;
  let idx = 1;
  for (let s = 1; s <= count; s++) {
    const target = s === count ? total : s * step;
    const pts = [prev];
    while (idx < path.length && path[idx][2] < target) {
      pts.push([path[idx][0], path[idx][1]]);
      idx++;
    }
    const end = pointAt(path, target);
    pts.push(end);
    pieces.push({ latlngs: pts, mid: (prevMile + target) / 2 });
    prev = end;
    prevMile = target;
  }
  return pieces;
}

/** Which two checkpoints (a, b) surround `mile`, and how far between them (f, 0..1). */
export function bracket(miles, mile) {
  const last = miles.length - 1;
  if (mile <= miles[0]) return { a: 0, b: 0, f: 0 };
  if (mile >= miles[last]) return { a: last, b: last, f: 0 };
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (miles[mid] <= mile) lo = mid;
    else hi = mid;
  }
  return { a: lo, b: hi, f: (mile - miles[lo]) / (miles[hi] - miles[lo]) };
}

/** Risk level to paint at a point between two checkpoints, given their levels (-1 = no forecast). */
export function blendLevel(va, vb, f) {
  if (va < 0 && vb < 0) return -1;
  if (va < 0) return vb;
  if (vb < 0) return va;
  return va + (vb - va) * f;
}

/** Miles travelled at a given time (ms), by interpolating between checkpoint ETAs. */
export function mileAtTime(checkpoints, whenMs) {
  const times = checkpoints.map((c) => new Date(c.eta).getTime());
  const last = checkpoints.length - 1;
  if (whenMs <= times[0]) return checkpoints[0].mile;
  if (whenMs >= times[last]) return checkpoints[last].mile;
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= whenMs) lo = mid;
    else hi = mid;
  }
  const span = times[hi] - times[lo];
  const f = span > 0 ? (whenMs - times[lo]) / span : 0;
  return (
    checkpoints[lo].mile + f * (checkpoints[hi].mile - checkpoints[lo].mile)
  );
}

/**
 * Where the truck is on `route` at slider hour `hour`, and the weather it meets there.
 * Returns { mile, latlng, flipped, level, arrived }. level is fractional (-1 = no forecast).
 */
export function truckState(route, hour, heatBaseIso) {
  const cps = route.checkpoints;
  const when = new Date(heatBaseIso).getTime() + hour * 3600 * 1000;
  const mile = mileAtTime(cps, when);
  const latlng = pointAt(route.path, mile);
  const ahead = pointAt(route.path, mile + 2);
  const { a, b, f } = bracket(
    cps.map((c) => c.mile),
    mile,
  );
  return {
    mile,
    latlng,
    flipped: ahead[1] < latlng[1] - 1e-6, // heading west: mirror the truck icon
    level: blendLevel(cps[a].heat[hour], cps[b].heat[hour], f),
    arrived: when >= new Date(cps[cps.length - 1].eta).getTime(),
  };
}

/**
 * The most dangerous part of a route: the longest run of neighbouring checkpoints that share the
 * route's highest risk level. Miles use the same "halfway to the neighbours" idea as the backend,
 * so they agree with the Severe/High miles on the route cards.
 * Returns null when no checkpoint has a forecast.
 */
export function worstStretch(route) {
  const cps = route.checkpoints;
  const levels = cps.map((c) => (c.has_data ? c.level : -1));
  const top = Math.max(...levels);
  if (top < 0) return null;

  const last = cps.length - 1;
  const startEdge = (i) => (i === 0 ? 0 : (cps[i - 1].mile + cps[i].mile) / 2);
  const endEdge = (i) =>
    i === last ? route.distance_miles : (cps[i].mile + cps[i + 1].mile) / 2;

  let best = null;
  let i = 0;
  while (i <= last) {
    if (levels[i] !== top) {
      i++;
      continue;
    }
    let j = i;
    while (j < last && levels[j + 1] === top) j++;
    const miles = endEdge(j) - startEdge(i);
    if (!best || miles > best.miles) best = { first: i, last: j, miles };
    i = j + 1;
  }

  const run = cps.slice(best.first, best.last + 1);
  const middle = run[Math.floor(run.length / 2)];
  return {
    level: top,
    startMile: startEdge(best.first),
    endMile: endEdge(best.last),
    miles: best.miles,
    from: run[0].eta,
    to: run[run.length - 1].eta,
    drivers: [...new Set(run.flatMap((c) => c.drivers))],
    focus: { lat: middle.lat, lng: middle.lng },
  };
}

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/** The time zone this browser uses, for example "Asia/Kolkata". Every time on screen is shown in it. */
export const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
