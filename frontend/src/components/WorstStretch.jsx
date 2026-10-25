import { LEVELS, fmtDateTime, worstStretch } from '../utils.js';

/** A warning sign for the most dangerous stretch of the selected route. Click it to fly the map there. */
export default function WorstStretch({ route, onFocus }) {
  const w = worstStretch(route);

  if (!w) return <p className="stretch-none">No forecast is available for {route.name} yet.</p>;
  if (w.level === 0) return <p className="stretch-clear">{route.name}: no weather risk along the whole route.</p>;

  const cause = w.drivers.length ? ` ${w.drivers.join(' and ')}` : '';
  const when = w.from === w.to ? `around ${fmtDateTime(w.from)}` : `${fmtDateTime(w.from)} to ${fmtDateTime(w.to)}`;

  return (
    <button type="button" className={`stretch stretch-level-${w.level}`} onClick={() => onFocus(w.focus)}>
      <span className="stretch-label">Worst stretch on {route.name}</span>
      <strong>
        {LEVELS[w.level]}
        {cause}, miles {Math.round(w.startMile)} to {Math.round(w.endMile)}
      </strong>
      <span>
        About {Math.round(w.miles)} miles, {when}. Click to see it on the map.
      </span>
    </button>
  );
}
