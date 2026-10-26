import { useState } from "react";
import PlaceInput from "./PlaceInput.jsx";
import { userTimeZone } from "../utils.js";

function defaultDeparture() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const toPayload = (v) =>
  v.place
    ? { lat: v.place.lat, lng: v.place.lng, label: v.place.label }
    : v.text.trim();

// Dallas, Texas, US becomes Dallas on the small chips
const short = (label) => label.split(",")[0];

export default function TripForm({ onSubmit, loading, history = [] }) {
  const [origin, setOrigin] = useState({ text: "", place: null });
  const [destination, setDestination] = useState({ text: "", place: null });
  const [departure, setDeparture] = useState(defaultDeparture);
  const [load, setLoad] = useState(35000);
  const [step, setStep] = useState(25);

  function submit(e) {
    e.preventDefault();
    if (
      loading ||
      !origin.text.trim() ||
      !destination.text.trim() ||
      !departure
    )
      return;
    onSubmit({
      origin: toPayload(origin),
      destination: toPayload(destination),
      departure: new Date(departure).toISOString(),
      load_weight_lb: Number(load) || 0,
      interval_miles: step,
    });
  }

  function pickRecent(trip) {
    setOrigin({ text: trip.origin.label, place: trip.origin });
    setDestination({ text: trip.destination.label, place: trip.destination });
  }

  function fillExample() {
    setOrigin({ text: "Dallas, TX", place: null });
    setDestination({ text: "Denver, CO", place: null });
  }

  function swap() {
    setOrigin(destination);
    setDestination(origin);
  }

  return (
    <form className="trip-form" onSubmit={submit}>
      <PlaceInput
        id="origin"
        label="Origin"
        value={origin}
        onChange={setOrigin}
        placeholder="City or address"
      />
      <button className="link swap" type="button" onClick={swap}>
        ⇅ Swap origin and destination
      </button>
      <PlaceInput
        id="destination"
        label="Destination"
        value={destination}
        onChange={setDestination}
        placeholder="City or address"
      />

      {history.length > 0 && (
        <div className="recent">
          <span className="label">Recent trips</span>
          <div className="recent-list">
            {history.map((trip) => (
              <button
                key={`${trip.origin.label}|${trip.destination.label}`}
                type="button"
                className="recent-chip"
                title={`${trip.origin.label} to ${trip.destination.label}`}
                onClick={() => pickRecent(trip)}
              >
                {short(trip.origin.label)} → {short(trip.destination.label)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="row">
        <div className="field">
          <label htmlFor="departure">Departure</label>
          <input
            id="departure"
            type="datetime-local"
            value={departure}
            onChange={(e) => setDeparture(e.target.value)}
            required
          />
          <small className="hint">Your time zone: {userTimeZone}</small>
        </div>
        <div className="field">
          <label htmlFor="load">Load weight (lb)</label>
          <input
            id="load"
            type="number"
            min="0"
            max="100000"
            step="500"
            value={load}
            onChange={(e) => setLoad(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="field">
        <span className="label" id="interval-label">
          Check the weather every
        </span>
        <div
          className="segmented"
          role="group"
          aria-labelledby="interval-label"
        >
          {[10, 25, 50].map((miles) => (
            <button
              key={miles}
              type="button"
              aria-pressed={step === miles}
              onClick={() => setStep(miles)}
            >
              {miles} miles
            </button>
          ))}
        </div>
      </div>

      <button className="primary" type="submit" disabled={loading}>
        {loading ? "Checking routes and weather…" : "Find the safest route"}
      </button>
      <button className="link" type="button" onClick={fillExample}>
        Fill in an example trip (Dallas to Denver)
      </button>
    </form>
  );
}
