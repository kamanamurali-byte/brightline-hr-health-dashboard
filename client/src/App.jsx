import { useEffect, useMemo, useState } from 'react';

function getStatusClass(status) {
  return status.toLowerCase();
}

export default function App() {
  const [filter, setFilter] = useState('ALL');
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function loadHealth() {
      setLoading(true);
      setLoadError('');

      try {
        const response = await fetch('/api/health');
        if (!response.ok) {
          throw new Error(`Health request failed with status ${response.status}`);
        }

        const data = await response.json();
        if (!data?.summary || !Array.isArray(data.services)) {
          throw new Error('Health response has an invalid format');
        }

        if (isMounted) {
          setHealth(data);
        }
      } catch {
        if (isMounted) {
          setLoadError('Unable to load integration health. Check that the API is running, then try again.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadHealth();
    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  const visibleServices = useMemo(() => {
    if (filter === 'ALL') return health?.services ?? [];
    return (health?.services ?? []).filter((service) => service.status === filter);
  }, [filter, health]);

  const summaryCards = [
    { label: 'CRITICAL', value: health?.summary?.criticalCount ?? '—', tone: 'critical' },
    { label: 'WARNING', value: health?.summary?.warningCount ?? '—', tone: 'warning' },
    { label: 'HEALTHY', value: health?.summary?.healthyCount ?? '—', tone: 'healthy' },
    { label: 'TOTAL REQUESTS', value: health?.summary?.totalRequests ?? '—', tone: 'neutral' },
  ];
  const generatedAt = health?.generatedAt
    ? new Date(health.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : 'Not available';

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-wrap">
          <div className="brand-mark" aria-hidden="true">B</div>
          <div>
            <div className="brand-title">Brightline HR</div>
            <div className="brand-subtitle">Platform Ops Diagnostics</div>
          </div>
        </div>
        <div className="topbar-actions">
          <span className="data-source" role="status">
            {health?.source === 'fallback' ? 'Seed data · database unavailable' : health ? 'SQL Server data' : 'Waiting for data'}
          </span>
          <button
            type="button"
            className="pill-button"
            onClick={() => setRefreshKey((key) => key + 1)}
            disabled={loading}
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <span className="pill-button tertiary">Updated: {generatedAt}</span>
        </div>
      </header>

      <main className="dashboard">
        <section className="header-panel">
          <div>
            <p className="eyebrow">Integration health overview</p>
            <h1>Daily API triage</h1>
          </div>
          <div className="filter-group" aria-label="Status filter">
            {['ALL', 'CRITICAL', 'WARNING', 'HEALTHY'].map((option) => (
              <button
                key={option}
                type="button"
                className={filter === option ? 'filter active' : 'filter'}
                aria-pressed={filter === option}
                onClick={() => setFilter(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </section>

        <section className="stats-grid" aria-label="Health summary">
          {summaryCards.map((card) => (
            <div key={card.label} className={`kpi-card ${card.tone}`}>
              <div className="kpi-label">{card.label}</div>
              <div className="kpi-value">{card.value}</div>
            </div>
          ))}
        </section>

        <section className="table-card">
          <div className="table-header-wrap">
            <h2>Integration telemetry</h2>
            {loading && <span className="loading-text" role="status">Loading integration data…</span>}
            {loadError && <span className="error-state" role="alert">{loadError}</span>}
          </div>

          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Status</th>
                  <th>Failure rate</th>
                  <th>p95 latency</th>
                  <th>Timeouts</th>
                  <th>429s</th>
                  <th>Diagnostics</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {visibleServices.length > 0 ? (
                  visibleServices.map((service) => (
                    <tr key={service.integration}>
                      <td className="service-name">{service.integration}</td>
                      <td>
                        <span className={`status-badge ${getStatusClass(service.status)}`}>{service.status}</span>
                      </td>
                      <td>{service.failureRatePct.toFixed(2)}%</td>
                      <td>{service.p95} ms</td>
                      <td>{service.timeoutCount}</td>
                      <td>{service.rateLimitCount}</td>
                      <td>{service.rootCause}</td>
                      <td>{service.recommendation}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className={loadError ? 'empty-state error-state' : 'empty-state'}>
                      {loading
                        ? 'Waiting for integration health data…'
                        : loadError
                          ? 'No health data is available.'
                          : 'No services match the selected health filter.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
