import { useState } from 'react';
import PlaceInput from './PlaceInput.jsx';

function defaultDeparture() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const toPayload = (v) => (v.place ? { lat: v.place.lat, lng: v.place.lng, label: v.place.label } : v.text.trim());

export default function TripForm({ onSubmit, loading }) {
  const [origin, setOrigin] = useState({ text: '', place: null });
  const [destination, setDestination] = useState({ text: '', place: null });
  const [departure, setDeparture] = useState(defaultDeparture);
  const [load, setLoad] = useState(35000);
  const [step, setStep] = useState(25);

  function submit(e) {
    e.preventDefault();
    if (loading || !origin.text.trim() || !destination.text.trim() || !departure) return;
    onSubmit({
      origin: toPayload(origin),
      destination: toPayload(destination),
      departure: new Date(departure).toISOString(),
      load_weight_lb: Number(load) || 0,
      interval_miles: step,
    });
  }

  function fillExample() {
    setOrigin({ text: 'Dallas, TX', place: null });
    setDestination({ text: 'Denver, CO', place: null });
  }

  return (
    <form className="trip-form" onSubmit={submit}>
      <PlaceInput id="origin" label="Origin" value={origin} onChange={setOrigin} placeholder="City or address" />
      <PlaceInput id="destination" label="Destination" value={destination} onChange={setDestination} placeholder="City or address" />

      <div className="row">
        <div className="field">
          <label htmlFor="departure">Departure</label>
          <input id="departure" type="datetime-local" value={departure} onChange={(e) => setDeparture(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="load">Load weight (lb)</label>
          <input id="load" type="number" min="0" max="100000" step="500" value={load} onChange={(e) => setLoad(e.target.value)} required />
        </div>
      </div>

      <div className="field">
        <span className="label" id="interval-label">Check the weather every</span>
        <div className="segmented" role="group" aria-labelledby="interval-label">
          {[10, 25, 50].map((miles) => (
            <button key={miles} type="button" aria-pressed={step === miles} onClick={() => setStep(miles)}>
              {miles} miles
            </button>
          ))}
        </div>
      </div>

      <button className="primary" type="submit" disabled={loading}>
        {loading ? 'Checking routes and weather…' : 'Find the safest route'}
      </button>
      <button className="link" type="button" onClick={fillExample}>
        Fill in an example trip (Dallas to Denver)
      </button>
    </form>
  );
}
