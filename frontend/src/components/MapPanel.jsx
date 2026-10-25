import { useEffect, useMemo, useState } from "react";
import MapView from "./MapView.jsx";
import HeatControls from "./HeatControls.jsx";
import { truckState } from "../utils.js";

/** Owns the heatmap hour so dragging the slider re-renders only the map side, not the sidebar tables. */
export default function MapPanel({ result, selectedId, onSelect, focus }) {
  const [hour, setHour] = useState(0);
  const [showHeat, setShowHeat] = useState(true);

  useEffect(() => setHour(0), [result]);

  const selected = result
    ? result.routes.find((r) => r.id === selectedId)
    : null;
  const truck = useMemo(
    () => (selected ? truckState(selected, hour, result.heat_base) : null),
    [selected, hour, result],
  );

  return (
    <div className="mappanel">
      <MapView
        result={result}
        selectedId={selectedId}
        onSelect={onSelect}
        hour={hour}
        showHeat={showHeat}
        focus={focus}
        truck={truck}
      />
      <HeatControls
        result={result}
        selected={selected}
        hour={hour}
        onHour={setHour}
        showHeat={showHeat}
        onShowHeat={setShowHeat}
        truck={truck}
      />
    </div>
  );
}
