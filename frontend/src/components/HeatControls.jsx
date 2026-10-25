import { COLORS, LEVELS, fmtDateTime } from "../utils.js";

export default function HeatControls({
  result,
  selected,
  hour,
  onHour,
  showHeat,
  onShowHeat,
  truck,
}) {
  if (!result) return null;
  const when = new Date(
    new Date(result.heat_base).getTime() + hour * 3600 * 1000,
  );
  const levels = selected
    ? selected.checkpoints.map((c) => c.heat[hour]).filter((v) => v >= 0)
    : [];
  const worst = levels.length ? Math.max(...levels) : -1;

  return (
    <div className="heat">
      <div className="heat-head">
        <label className="switch">
          <input
            type="checkbox"
            checked={showHeat}
            onChange={(e) => onShowHeat(e.target.checked)}
          />
          Weather heatmap
        </label>
        <span className="heat-time">
          {fmtDateTime(when)} <span className="offset">+{hour} h</span>
        </span>
      </div>
      <input
        type="range"
        min="0"
        max={result.heat_hours}
        step="1"
        value={hour}
        onChange={(e) => onHour(Number(e.target.value))}
        aria-label="Forecast hours after departure"
      />
      <div className="heat-scale">
        <span>Departure</span>
        <span>+{result.heat_hours} h</span>
      </div>
      <div className="legend">
        <span
          className="legend-bar"
          style={{ background: `linear-gradient(90deg, ${COLORS.join(", ")})` }}
        />
        <span className="legend-labels">
          {LEVELS.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </span>
      </div>
      {selected && (
        <p className="heat-note">
          {worst >= 0
            ? `Worst on ${selected.name} at this hour: ${LEVELS[worst]}.`
            : "No forecast for this hour."}{" "}
          Colours blend between checkpoints.
        </p>
      )}
      {truck && (
        <p className="heat-truck">
          {truck.arrived
            ? "Truck has arrived at the destination."
            : `Truck at mile ${Math.round(truck.mile)}`}
          {!truck.arrived && truck.level >= 0
            ? `, weather there: ${LEVELS[Math.round(truck.level)]}`
            : ""}
        </p>
      )}
    </div>
  );
}
