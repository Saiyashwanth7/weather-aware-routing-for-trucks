import { useState, useEffect } from "react";
import { analyzeTrip, wakeServer } from "./api.js";
import TripForm from "./components/TripForm.jsx";
import RouteList from "./components/RouteList.jsx";
import CheckpointTable from "./components/CheckpointTable.jsx";
import MapPanel from "./components/MapPanel.jsx";
import { addHistory, loadHistory } from "./history.js";
import WorstStretch from "./components/WorstStretch.jsx";
import PanelResizer from "./components/PanelResizer.jsx";

export default function App() {
  const [result, setResult] = useState(null);
  const focusOn = (p) => setFocus({ lat: p.lat, lng: p.lng, key: Date.now() });
  const [selectedId, setSelectedId] = useState(null);
  const [focus, setFocus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [slow, setSlow] = useState(false);
  const [history, setHistory] = useState(loadHistory);
  const [panelWidth, setPanelWidth] = useState(420);
  const [panelOpen, setPanelOpen] = useState(true);

  useEffect(() => {
    wakeServer();
  }, []);
  useEffect(() => {
    if (!loading) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(timer);
  }, [loading]);
  async function run(payload) {
    setLoading(true);
    setError("");
    setResult(null);
    setSelectedId(null);
    setFocus(null);
    try {
      const data = await analyzeTrip(payload);
      setResult(data);
      setSelectedId(data.recommended_route_id);
      setFocus(null);
      setHistory(
        addHistory({ origin: data.origin, destination: data.destination }),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const selected = result
    ? result.routes.find((r) => r.id === selectedId)
    : null;
  const best = result
    ? result.routes.find((r) => r.id === result.recommended_route_id)
    : null;

  return (
    <div
      className={`app${panelOpen ? "" : " collapsed"}`}
      style={{ "--panel-w": panelOpen ? `${panelWidth}px` : "0px" }}
    >
      <aside className="panel">
        <header className="brand">
          <h1>Weather-aware truck routing</h1>
          <p>
            Compare three routes by the weather your truck will actually meet,
            hour by hour.
          </p>
        </header>

        <TripForm onSubmit={run} loading={loading} history={history} />

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        {!result && !error && (
          <p className="empty">
            Enter a trip to see three route options ranked by weather risk.
          </p>
        )}

        {result && (
          <>
            <section
              className={`verdict${result.recommendation.all_blocked ? " blocked" : ""}`}
            >
              <h2>Recommended: {best.name}</h2>
              <p>{result.recommendation.reason}</p>
              {result.warnings.map((w) => (
                <p key={w} className="warn">
                  {w}
                </p>
              ))}
            </section>
            <RouteList
              routes={result.routes}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
            {selected && (
              <>
                <WorstStretch route={selected} onFocus={focusOn} />
                <CheckpointTable
                  route={selected}
                  interval={result.interval_miles}
                  onFocus={focusOn}
                />
              </>
            )}
          </>
        )}
      </aside>

      <main className="stage">
        <PanelResizer
          width={panelWidth}
          onWidth={setPanelWidth}
          open={panelOpen}
          onToggle={() => setPanelOpen((o) => !o)}
        />
        <MapPanel
          result={result}
          selectedId={selectedId}
          onSelect={setSelectedId}
          focus={focus}
        />
        {loading && (
          <div className="busy">
            {slow
              ? "Still working. The server may have been asleep, so this can take up to 30 seconds."
              : "Fetching routes and forecasts…"}
          </div>
        )}
      </main>
    </div>
  );
}
