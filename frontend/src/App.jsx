import { useState, useEffect } from "react";
import { analyzeTrip, wakeServer } from "./api.js";
import TripForm from "./components/TripForm.jsx";
import RouteList from "./components/RouteList.jsx";
import CheckpointTable from "./components/CheckpointTable.jsx";
import MapPanel from "./components/MapPanel.jsx";

export default function App() {
  const [result, setResult] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [focus, setFocus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    wakeServer();
  }, []);
  async function run(payload) {
    setLoading(true);
    setError("");
    try {
      const data = await analyzeTrip(payload);
      setResult(data);
      setSelectedId(data.recommended_route_id);
      setFocus(null);
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
    <div className="app">
      <aside className="panel">
        <header className="brand">
          <h1>Weather-aware truck routing</h1>
          <p>
            Compare three routes by the weather your truck will actually meet,
            hour by hour.
          </p>
        </header>

        <TripForm onSubmit={run} loading={loading} />

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
              <CheckpointTable
                route={selected}
                interval={result.interval_miles}
                onFocus={(cp) =>
                  setFocus({ lat: cp.lat, lng: cp.lng, key: Date.now() })
                }
              />
            )}
          </>
        )}
      </aside>

      <main className="stage">
        <MapPanel
          result={result}
          selectedId={selectedId}
          onSelect={setSelectedId}
          focus={focus}
        />
        {loading && (
          <div className="busy">
            Fetching routes and forecasts… the first request can take up to 30
            seconds if the server was asleep.
          </div>
        )}
      </main>
    </div>
  );
}
