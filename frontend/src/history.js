// The last few trips, kept in this browser only (localStorage).
const KEY = 'clearhaul.recent';
const MAX = 4;

export function loadHistory() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(list) ? list.slice(0, MAX) : [];
  } catch {
    return []; // storage blocked, empty, or not valid JSON
  }
}

/** Put a trip at the top, drop an older copy of the same trip, keep only the newest MAX. */
export function addHistory(trip) {
  const same = (t) => t.origin.label === trip.origin.label && t.destination.label === trip.destination.label;
  const next = [trip, ...loadHistory().filter((t) => !same(t))].slice(0, MAX);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage full or blocked: the list still works for this visit */
  }
  return next;
}
