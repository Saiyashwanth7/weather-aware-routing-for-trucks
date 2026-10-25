import { fmtDateTime } from '../utils.js';

export default function CheckpointTable({ route, interval, onFocus }) {
  return (
    <section className="checkpoints">
      <h2>
        {route.name} checkpoints <span className="count">every {interval} mi, {route.checkpoints.length} stops</span>
      </h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Mile</th>
              <th>ETA</th>
              <th>Risk</th>
              <th>Wind</th>
              <th>Rain</th>
              <th>Snow</th>
            </tr>
          </thead>
          <tbody>
            {route.checkpoints.map((cp) => (
              <tr key={cp.index} tabIndex={0} onClick={() => onFocus(cp)} onKeyDown={(e) => e.key === 'Enter' && onFocus(cp)}>
                <td>{cp.mile}</td>
                <td>{fmtDateTime(cp.eta)}</td>
                <td title={cp.load_rule || undefined}>
                  {cp.has_data ? (
                    <>
                      <span className="badge" data-level={cp.level}>{cp.level_name}</span>
                      {cp.drivers.length > 0 && <span className="why">{cp.drivers.join(', ')}</span>}
                    </>
                  ) : (
                    <span className="why">No forecast</span>
                  )}
                </td>
                <td>{cp.has_data ? `${cp.wind_mph} mph` : '–'}</td>
                <td>{cp.has_data ? `${cp.rain_in_hr} in/h` : '–'}</td>
                <td>{cp.has_data ? `${cp.snow_in_hr} in/h` : '–'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
