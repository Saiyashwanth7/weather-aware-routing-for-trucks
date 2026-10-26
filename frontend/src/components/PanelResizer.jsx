import { useRef } from "react";
import { clamp } from "../utils.js";

const MIN = 320;
const MAX = 720;

/** Drag handle on the edge of the side panel, plus a tab to hide and show it. */
export default function PanelResizer({ width, onWidth, open, onToggle }) {
  const dragging = useRef(false);

  function down(e) {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e) {
    if (dragging.current) onWidth(clamp(e.clientX, MIN, MAX)); // the panel starts at the left edge, so x is its width
  }
  function up() {
    dragging.current = false;
  }
  function key(e) {
    if (e.key === "ArrowLeft") onWidth(clamp(width - 20, MIN, MAX));
    if (e.key === "ArrowRight") onWidth(clamp(width + 20, MIN, MAX));
  }

  return (
    <>
      {open && (
        <div
          className="resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize the side panel (arrow keys also work)"
          tabIndex={0}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onKeyDown={key}
        />
      )}
      <button
        type="button"
        className="panel-toggle"
        onClick={onToggle}
        aria-expanded={open}
        aria-label={open ? "Hide the side panel" : "Show the side panel"}
      >
        {open ? "‹" : "›"}
      </button>
    </>
  );
}
