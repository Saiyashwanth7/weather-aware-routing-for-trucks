import { useEffect, useRef, useState } from "react";
import { COLORS, LEVELS, clamp, fmtDateTime } from "../utils.js";

/** Forecast panel on the map. Drag the header to move it, use the arrow to shrink it to one line. */
export default function HeatControls({
  result,
  selected,
  hour,
  onHour,
  showHeat,
  onShowHeat,
  truck,
}) {
  const ref = useRef(null);
  const drag = useRef(null);
  const [pos, setPos] = useState(null); // null = default corner, otherwise { x, y } inside the map box
  const [minimized, setMinimized] = useState(false);

  const keepInside = (p) => {
    const el = ref.current;
    const box = el && el.offsetParent;
    if (!box) return p;
    return {
      x: clamp(p.x, 0, Math.max(0, box.clientWidth - el.offsetWidth)),
      y: clamp(p.y, 0, Math.max(0, box.clientHeight - el.offsetHeight)),
    };
  };

  // If the map box shrinks (side panel dragged wider) or the panel grows, pull it back into view.
  useEffect(() => {
    const box = ref.current && ref.current.offsetParent;
    if (!box) return undefined;
    const watcher = new ResizeObserver(() =>
      setPos((p) => (p ? keepInside(p) : p)),
    );
    watcher.observe(box);
    return () => watcher.disconnect();
  }, [result]);

  useEffect(() => setPos((p) => (p ? keepInside(p) : p)), [minimized]);

  function down(e) {
    if (e.target.closest("button, input, label")) return; // the checkbox and buttons keep working
    const el = ref.current;
    const rect = el.getBoundingClientRect();
    const box = el.offsetParent.getBoundingClientRect();
    drag.current = {
      grabX: e.clientX - rect.left,
      grabY: e.clientY - rect.top,
      boxLeft: box.left,
      boxTop: box.top,
    };
    setPos({ x: rect.left - box.left, y: rect.top - box.top });
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e) {
    const d = drag.current;
    if (d)
      setPos(
        keepInside({
          x: e.clientX - d.boxLeft - d.grabX,
          y: e.clientY - d.boxTop - d.grabY,
        }),
      );
  }
  function up() {
    drag.current = null;
  }

  if (!result) return null;
  const when = new Date(
    new Date(result.heat_base).getTime() + hour * 3600 * 1000,
  );
  const levels = selected
    ? selected.checkpoints.map((c) => c.heat[hour]).filter((v) => v >= 0)
    : [];
  const worst = levels.length ? Math.max(...levels) : -1;

  return (
    <div
      ref={ref}
      className={`heat${minimized ? " minimized" : ""}`}
      style={pos ? { left: pos.x, top: pos.y, bottom: "auto" } : undefined}
    >
      <div
        className="heat-head"
        title="Drag to move, double-click to put it back"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onDoubleClick={() => setPos(null)}
      >
        <span className="heat-grip" aria-hidden="true">
          ⋮⋮
        </span>
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
        <button
          type="button"
          className="heat-min"
          onClick={() => setMinimized((m) => !m)}
          aria-expanded={!minimized}
          aria-label={
            minimized
              ? "Expand the forecast panel"
              : "Shrink the forecast panel"
          }
        >
          {minimized ? "▴" : "▾"}
        </button>
      </div>

      {!minimized && (
        <>
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
              style={{
                background: `linear-gradient(90deg, ${COLORS.join(", ")})`,
              }}
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
        </>
      )}
    </div>
  );
}
