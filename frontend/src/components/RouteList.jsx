import { COLORS, LEVELS, ROUTE_COLORS, fmtDateTime, fmtDuration } from '../utils.js';

const KEYS = ['low', 'moderate', 'high', 'severe', 'no_travel'];

export default function RouteList({ routes, selectedId, onSelect }) {
  return (
    <div className="routes">
      {routes.map((route, i) => {
        const { miles_by_level: miles, avg_risk, blocked } = route.summary;
        const selected = route.id === selectedId;
        return (
          <button
            key={route.id}
            type="button"
            className={`route-card${selected ? ' selected' : ''}`}
            aria-pressed={selected}
            onClick={() => onSelect(route.id)}
          >
            <span className="route-top">
              <span className="chip" style={{ background: ROUTE_COLORS[i % ROUTE_COLORS.length] }} />
              <strong>{route.name}</strong>
              {route.is_recommended && <span className="tag tag-best">Recommended</span>}
              {route.is_fastest && <span className="tag">Fastest</span>}
              {blocked && <span className="tag tag-blocked">No Travel stretch</span>}
            </span>
            <span className="route-facts">
              <span>{route.distance_miles} mi</span>
              <span>{fmtDuration(route.duration_minutes)} driving</span>
              <span>Arrive {fmtDateTime(route.arrival)}</span>
            </span>
            <span className="mix" aria-hidden="true">
              {KEYS.map((k, level) =>
                miles[k] > 0 ? (
                  <span key={k} style={{ width: `${(miles[k] / route.distance_miles) * 100}%`, background: COLORS[level] }} title={`${LEVELS[level]}: ${miles[k]} mi`} />
                ) : null
              )}
            </span>
            <span className="route-risk">
              <span>Severe {miles.severe} mi</span>
              <span>High {miles.high} mi</span>
              <span>Average risk {avg_risk} of 4</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
