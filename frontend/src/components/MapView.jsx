import { useEffect, useRef } from "react";
import L from "leaflet";
import {
  COLORS,
  NO_DATA_COLOR,
  ROUTE_COLORS,
  blendLevel,
  bracket,
  buildPieces,
  colorAt,
  esc,
  fmtDateTime,
  fmtDuration,
} from "../utils.js";

const HEAT_PIECES = 220; // slices per route; each slice is recoloured as the slider moves

// Finish flag: 4 x 3 chequered squares inside the pin.
const CHECKER = Array.from({ length: 12 }, (_, i) => {
  const col = i % 4;
  const row = Math.floor(i / 4);
  return `<rect x="${8 + col * 5}" y="${10 + row * 5}" width="5" height="5" fill="${(col + row) % 2 ? "#111111" : "#ffffff"}"/>`;
}).join("");

const PIN_SHAPE =
  "M18 1C8.6 1 1 8.6 1 18c0 12.5 17 27 17 27s17-14.5 17-27C35 8.6 27.4 1 18 1z";

/** Map pin with a clear label: green "play" pin for the start, chequered-flag pin for the finish. */
function endpointIcon(kind) {
  const start = kind === "start";
  const glyph = start
    ? '<path d="M14 10l13 8-13 8z" fill="#ffffff"/>'
    : `${CHECKER}<rect x="8" y="10" width="20" height="15" fill="none" stroke="#ffffff" stroke-width="1"/>`;
  return L.divIcon({
    className: `endpoint ${kind}`,
    html:
      `<svg viewBox="0 0 36 46" width="36" height="46" aria-hidden="true">` +
      `<path d="${PIN_SHAPE}" fill="${start ? "#00663d" : "#111111"}" stroke="#ffffff" stroke-width="2.5"/>${glyph}</svg>` +
      `<span class="endpoint-label">${start ? "START" : "FINISH"}</span>`,
    iconSize: [60, 62],
    iconAnchor: [30, 45], // the tip of the pin sits on the exact place
  });
}

const TRUCK_SVG =
  '<svg viewBox="0 0 48 28" aria-hidden="true">' +
  '<rect x="2" y="4" width="28" height="15" rx="2" fill="#00663d" stroke="#111111" stroke-width="2.2"/>' +
  '<path d="M30 9h9l6 6v4H30z" fill="#f2c200" stroke="#111111" stroke-width="2.2" stroke-linejoin="round"/>' +
  '<circle cx="10" cy="21.5" r="3.6" fill="#111111"/><circle cx="20" cy="21.5" r="3.6" fill="#111111"/>' +
  '<circle cx="38" cy="21.5" r="3.6" fill="#111111"/></svg>';

const truckIcon = () =>
  L.divIcon({
    className: "truck-marker",
    html: `<div class="truck-body">${TRUCK_SVG}</div>`,
    iconSize: [52, 34],
    iconAnchor: [26, 17],
  });

function popupHtml(cp) {
  const head = `<div class="pop-head"><span class="badge" data-level="${cp.level}">${esc(cp.level_name)}</span><strong>Mile ${cp.mile}</strong></div>`;
  const eta = `<div>ETA ${esc(fmtDateTime(cp.eta))}</div>`;
  if (!cp.has_data)
    return `<div class="pop">${head}${eta}<div>No forecast available for this time.</div></div>`;
  const why = cp.drivers.length
    ? `<div>Driven by ${esc(cp.drivers.join(", "))}</div>`
    : "";
  const rule = cp.load_rule
    ? `<div class="pop-note">${esc(cp.load_rule)}</div>`
    : "";
  return (
    `<div class="pop">${head}${eta}${why}` +
    `<div>Wind ${cp.wind_mph} mph (gusts ${cp.gust_mph})</div>` +
    `<div>Rain ${cp.rain_in_hr} in/h</div><div>Snow ${cp.snow_in_hr} in/h</div>${rule}</div>`
  );
}

const emptyState = () => ({
  lines: {},
  heat: [],
  markers: null,
  ends: null,
  truck: null,
});

export default function MapView({
  result,
  selectedId,
  onSelect,
  hour,
  showHeat,
  focus,
  truck,
}) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const state = useRef(emptyState());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Create the map once.
  useEffect(() => {
    const map = L.map(elRef.current, { preferCanvas: true }).setView(
      [39.5, -98.35],
      4,
    );
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);

    // Heatmap lives in its own pane, under the route lines. Blurring the pane softens the
    // coloured slices into a continuous corridor; pane opacity avoids dark seams where slices overlap.
    const pane = map.createPane("heat");
    pane.style.zIndex = 350;
    pane.style.filter = "blur(9px)";
    pane.style.opacity = "0.8";
    pane.style.pointerEvents = "none";

    state.current = emptyState();
    state.current.markers = L.layerGroup().addTo(map);
    mapRef.current = map;
    requestAnimationFrame(() => map.invalidateSize());
    return () => {
      map.remove();
      mapRef.current = null;
      state.current = emptyState();
    };
  }, []);

  // Tell Leaflet when the map box changes size (side panel dragged or hidden).
  useEffect(() => {
    let frame = 0;
    const watcher = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(
        () => mapRef.current && mapRef.current.invalidateSize(),
      );
    });
    watcher.observe(elRef.current);
    return () => {
      cancelAnimationFrame(frame);
      watcher.disconnect();
    };
  }, []);

  // New analysis: rebuild route lines, heat slices and end pins.
  useEffect(() => {
    const map = mapRef.current;
    const st = state.current;
    if (!map) return;
    Object.values(st.lines).forEach((l) => l.remove());
    st.heat.forEach((p) => p.layer.remove());
    if (st.ends) st.ends.remove();
    if (st.truck) st.truck.remove();
    st.truck = null;
    st.lines = {};
    st.heat = [];
    st.ends = null;
    st.markers.clearLayers();
    if (!result) return;

    const bounds = L.latLngBounds([]);
    result.routes.forEach((route, i) => {
      const line = L.polyline(
        route.path.map((p) => [p[0], p[1]]),
        {
          color: ROUTE_COLORS[i % ROUTE_COLORS.length],
          weight: 5,
          opacity: 0.9,
          lineJoin: "round",
        },
      ).addTo(map);
      line.bindTooltip(
        `<strong>${esc(route.name)}</strong>: ${route.distance_miles} mi, ${esc(fmtDuration(route.duration_minutes))}, average risk ${route.summary.avg_risk}`,
        { sticky: true },
      );
      line.on("click", () => onSelectRef.current(route.id));
      st.lines[route.id] = line;
      bounds.extend(line.getBounds());

      const miles = route.checkpoints.map((c) => c.mile);
      buildPieces(route.path, HEAT_PIECES).forEach((piece) => {
        const layer = L.polyline(piece.latlngs, {
          pane: "heat",
          color: NO_DATA_COLOR,
          weight: 30,
          opacity: 1,
          lineCap: "round",
          lineJoin: "round",
          interactive: false,
        }).addTo(map);
        st.heat.push({
          layer,
          route: i,
          color: "",
          ...bracket(miles, piece.mid),
        });
      });
    });

    const ends = L.layerGroup();
    L.marker([result.origin.lat, result.origin.lng], {
      icon: endpointIcon("start"),
      keyboard: false,
    })
      .bindTooltip(`Start: ${esc(result.origin.label || "Origin")}`, {
        direction: "top",
        offset: [0, -44],
      })
      .addTo(ends);
    L.marker([result.destination.lat, result.destination.lng], {
      icon: endpointIcon("finish"),
      keyboard: false,
    })
      .bindTooltip(
        `Finish: ${esc(result.destination.label || "Destination")}`,
        { direction: "top", offset: [0, -44] },
      )
      .addTo(ends);
    ends.addTo(map);
    st.ends = ends;

    if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] });
  }, [result]);

  // Selected route: emphasise its line and show its checkpoints.
  useEffect(() => {
    const map = mapRef.current;
    const st = state.current;
    if (!map || !result) return;
    result.routes.forEach((route) => {
      const line = st.lines[route.id];
      if (!line) return;
      const selected = route.id === selectedId;
      line.setStyle({
        weight: selected ? 7 : 4,
        opacity: selected ? 1 : 0.6,
        dashArray: selected ? null : "9 7",
      });
      if (selected) line.bringToFront();
    });
    st.markers.clearLayers();
    const route = result.routes.find((r) => r.id === selectedId);
    if (!route) return;
    route.checkpoints.forEach((cp) => {
      L.circleMarker([cp.lat, cp.lng], {
        radius: 7,
        weight: 2,
        color: "#ffffff",
        fillColor: cp.has_data ? COLORS[cp.level] : NO_DATA_COLOR,
        fillOpacity: 1,
      })
        .bindPopup(popupHtml(cp))
        .addTo(st.markers);
    });
  }, [result, selectedId]);

  // Heatmap: recolour slices for the chosen forecast hour (only slices whose colour changed).
  useEffect(() => {
    const map = mapRef.current;
    const st = state.current;
    if (!map) return;
    map.getPane("heat").style.display = showHeat ? "" : "none";
    if (!showHeat || !result) return;
    for (const p of st.heat) {
      const cps = result.routes[p.route].checkpoints;
      const v = blendLevel(cps[p.a].heat[hour], cps[p.b].heat[hour], p.f);
      const color = v < 0 ? NO_DATA_COLOR : colorAt(v);
      if (color !== p.color) {
        p.layer.setStyle({ color });
        p.color = color;
      }
    }
  }, [result, hour, showHeat]);

  // The truck: follows the slider along the selected route, ringed in the risk colour it meets there.
  useEffect(() => {
    const map = mapRef.current;
    const st = state.current;
    if (!map) return;
    if (!truck) {
      if (st.truck) st.truck.remove();
      st.truck = null;
      return;
    }
    if (!st.truck) {
      st.truck = L.marker(truck.latlng, {
        icon: truckIcon(),
        interactive: false,
        keyboard: false,
        zIndexOffset: 1000,
      }).addTo(map);
    }
    st.truck.setLatLng(truck.latlng);
    const el = st.truck.getElement();
    if (el) {
      el.style.setProperty(
        "--ring",
        truck.level < 0 ? NO_DATA_COLOR : colorAt(truck.level),
      );
      el.querySelector(".truck-body").style.transform = truck.flipped
        ? "scaleX(-1)"
        : "";
    }
  }, [result, truck]);

  // Clicking a checkpoint row flies the map there.
  useEffect(() => {
    const map = mapRef.current;
    if (map && focus)
      map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 9), {
        duration: 0.6,
      });
  }, [focus]);

  return <div ref={elRef} className="map" />;
}
