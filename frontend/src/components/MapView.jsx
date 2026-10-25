import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { COLORS, NO_DATA_COLOR, ROUTE_COLORS, blendLevel, bracket, buildPieces, colorAt, esc, fmtDateTime, fmtDuration } from '../utils.js';

const HEAT_PIECES = 220; // slices per route; each slice is recoloured as the slider moves

const endpointIcon = (letter) =>
  L.divIcon({ className: '', html: `<div class="pin">${letter}</div>`, iconSize: [28, 28], iconAnchor: [14, 14] });

function popupHtml(cp) {
  const head = `<div class="pop-head"><span class="badge" data-level="${cp.level}">${esc(cp.level_name)}</span><strong>Mile ${cp.mile}</strong></div>`;
  const eta = `<div>ETA ${esc(fmtDateTime(cp.eta))}</div>`;
  if (!cp.has_data) return `<div class="pop">${head}${eta}<div>No forecast available for this time.</div></div>`;
  const why = cp.drivers.length ? `<div>Driven by ${esc(cp.drivers.join(', '))}</div>` : '';
  const rule = cp.load_rule ? `<div class="pop-note">${esc(cp.load_rule)}</div>` : '';
  return (
    `<div class="pop">${head}${eta}${why}` +
    `<div>Wind ${cp.wind_mph} mph (gusts ${cp.gust_mph})</div>` +
    `<div>Rain ${cp.rain_in_hr} in/h</div><div>Snow ${cp.snow_in_hr} in/h</div>${rule}</div>`
  );
}

const emptyState = () => ({ lines: {}, heat: [], markers: null, ends: null });

export default function MapView({ result, selectedId, onSelect, hour, showHeat, focus }) {
  const elRef = useRef(null);
  const mapRef = useRef(null);
  const state = useRef(emptyState());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  // Create the map once.
  useEffect(() => {
    const map = L.map(elRef.current, { preferCanvas: true }).setView([39.5, -98.35], 4);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    // Heatmap lives in its own pane, under the route lines. Blurring the pane softens the
    // coloured slices into a continuous corridor; pane opacity avoids dark seams where slices overlap.
    const pane = map.createPane('heat');
    pane.style.zIndex = 350;
    pane.style.filter = 'blur(9px)';
    pane.style.opacity = '0.8';
    pane.style.pointerEvents = 'none';

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

  // New analysis: rebuild route lines, heat slices and end pins.
  useEffect(() => {
    const map = mapRef.current;
    const st = state.current;
    if (!map) return;
    Object.values(st.lines).forEach((l) => l.remove());
    st.heat.forEach((p) => p.layer.remove());
    if (st.ends) st.ends.remove();
    st.lines = {};
    st.heat = [];
    st.ends = null;
    st.markers.clearLayers();
    if (!result) return;

    const bounds = L.latLngBounds([]);
    result.routes.forEach((route, i) => {
      const line = L.polyline(
        route.path.map((p) => [p[0], p[1]]),
        { color: ROUTE_COLORS[i % ROUTE_COLORS.length], weight: 5, opacity: 0.9, lineJoin: 'round' }
      ).addTo(map);
      line.bindTooltip(
        `<strong>${esc(route.name)}</strong>: ${route.distance_miles} mi, ${esc(fmtDuration(route.duration_minutes))}, average risk ${route.summary.avg_risk}`,
        { sticky: true }
      );
      line.on('click', () => onSelectRef.current(route.id));
      st.lines[route.id] = line;
      bounds.extend(line.getBounds());

      const miles = route.checkpoints.map((c) => c.mile);
      buildPieces(route.path, HEAT_PIECES).forEach((piece) => {
        const layer = L.polyline(piece.latlngs, {
          pane: 'heat',
          color: NO_DATA_COLOR,
          weight: 30,
          opacity: 1,
          lineCap: 'round',
          lineJoin: 'round',
          interactive: false,
        }).addTo(map);
        st.heat.push({ layer, route: i, color: '', ...bracket(miles, piece.mid) });
      });
    });

    const ends = L.layerGroup();
    L.marker([result.origin.lat, result.origin.lng], { icon: endpointIcon('S'), keyboard: false })
      .bindTooltip(esc(result.origin.label || 'Origin'))
      .addTo(ends);
    L.marker([result.destination.lat, result.destination.lng], { icon: endpointIcon('E'), keyboard: false })
      .bindTooltip(esc(result.destination.label || 'Destination'))
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
      line.setStyle({ weight: selected ? 7 : 4, opacity: selected ? 1 : 0.6, dashArray: selected ? null : '9 7' });
      if (selected) line.bringToFront();
    });
    st.markers.clearLayers();
    const route = result.routes.find((r) => r.id === selectedId);
    if (!route) return;
    route.checkpoints.forEach((cp) => {
      L.circleMarker([cp.lat, cp.lng], {
        radius: 7,
        weight: 2,
        color: '#ffffff',
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
    map.getPane('heat').style.display = showHeat ? '' : 'none';
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

  // Clicking a checkpoint row flies the map there.
  useEffect(() => {
    const map = mapRef.current;
    if (map && focus) map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 9), { duration: 0.6 });
  }, [focus]);

  return <div ref={elRef} className="map" />;
}
