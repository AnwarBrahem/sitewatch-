import React, { useEffect, useState } from 'react';
import type { Site, Reading, Alert } from './types';
import { fetchSites, fetchAlerts, getSocket } from './api';
import { SensorChart } from './components/SensorChart';
import { SiteMap } from './components/SiteMap';
import { AlertsFeed } from './components/AlertsFeed';

type ActiveView = 'map' | 'charts' | 'alerts';

export const App: React.FC = () => {
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [liveEventCount, setLiveEventCount] = useState(0);
  const [latestReadings, setLatestReadings] = useState<Record<number, Reading>>({});
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [activeView, setActiveView] = useState<ActiveView>('map');

  // Initial load
  useEffect(() => {
    async function init() {
      try {
        const [sitesData, alertsData] = await Promise.all([fetchSites(), fetchAlerts()]);
        setSites(sitesData);
        setAlerts(alertsData);
        if (sitesData.length > 0) setSelectedSiteId(sitesData[0].id);
      } catch (err: any) {
        setError(err.message || 'Could not connect to backend');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // Part 7: Real-time WebSocket subscriptions (replaces polling when connected)
  useEffect(() => {
    const socket = getSocket();

    const onConnect = () => setWsConnected(true);
    const onDisconnect = () => setWsConnected(false);

    const onNewReading = (reading: Reading) => {
      setLatestReadings((prev) => ({ ...prev, [reading.sensor_id]: reading }));
      setLiveEventCount((c) => c + 1);
    };

    const onNewAlert = (newAlert: Alert) => {
      setAlerts((prev) => {
        if (prev.some((a) => a.id === newAlert.id)) return prev;
        return [newAlert, ...prev];
      });
      setLiveEventCount((c) => c + 1);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('reading:new', onNewReading);
    socket.on('alert:new', onNewAlert);

    if (socket.connected) {
      setWsConnected(true);
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('reading:new', onNewReading);
      socket.off('alert:new', onNewAlert);
    };
  }, []);

  // Fallback REST polling: only active when WebSocket is disconnected
  useEffect(() => {
    if (wsConnected) return;

    const timer = setInterval(async () => {
      try {
        const alertsData = await fetchAlerts();
        setAlerts(alertsData);
      } catch { /* ignore fallback error */ }
    }, 5000);

    return () => clearInterval(timer);
  }, [wsConnected]);

  const selectedSite = sites.find((s) => s.id === selectedSiteId);

  const handleSelectSite = (siteId: number) => {
    setSelectedSiteId(siteId);
    setActiveView('charts');
  };

  const unreadAlertCount = alerts.length;

  return (
    <div className="dashboard-app">
      {/* Header */}
      <header className="dashboard-header">
        <div className="brand">
          <div className="brand-logo">📡</div>
          <div>
            <h1 className="brand-title">SiteWatch</h1>
            <p className="brand-subtitle">Simulated IoT Structural Monitoring</p>
          </div>
        </div>
        <div className="header-status">
          <span className={`live-indicator ${wsConnected ? 'ws-live' : 'ws-fallback'}`}>
            <span className={`live-dot ${wsConnected ? '' : 'fallback'}`}></span>
            {wsConnected ? 'WS LIVE PUSH' : 'POLLING (5s)'}
          </span>
          <span className="tick-counter">{liveEventCount} events</span>
        </div>
      </header>

      {/* View Toggle */}
      {!loading && !error && (
        <div className="view-toggle">
          <button
            className={`toggle-btn ${activeView === 'map' ? 'active' : ''}`}
            onClick={() => setActiveView('map')}
          >
            🗺️ Site Map
          </button>
          <button
            className={`toggle-btn ${activeView === 'charts' ? 'active' : ''}`}
            onClick={() => setActiveView('charts')}
          >
            📊 Telemetry Charts
          </button>
          <button
            className={`toggle-btn ${activeView === 'alerts' ? 'active' : ''}`}
            onClick={() => setActiveView('alerts')}
          >
            🚨 Alerts
            {unreadAlertCount > 0 && (
              <span className="nav-alert-badge">{unreadAlertCount}</span>
            )}
          </button>
        </div>
      )}

      <main className="dashboard-main">
        {loading && <div className="state-message">Loading infrastructure sites...</div>}
        {error && (
          <div className="state-message error">
            <p>⚠️ Unable to fetch sites: {error}</p>
            <p className="state-hint">Make sure the Express backend is running on http://localhost:3000</p>
          </div>
        )}

        {!loading && !error && (
          <>
            {/* Part 5 — Map View */}
            {activeView === 'map' && (
              <section className="map-section">
                <SiteMap
                  sites={sites}
                  selectedSiteId={selectedSiteId}
                  onSelectSite={handleSelectSite}
                  latestReadings={latestReadings}
                  recentAlerts={alerts}
                />
              </section>
            )}

            {/* Part 4 — Charts View */}
            {activeView === 'charts' && (
              <>
                <section className="sites-section">
                  <div className="sites-grid">
                    {sites.map((site) => (
                      <button
                        key={site.id}
                        className={`site-card ${site.id === selectedSiteId ? 'selected' : ''}`}
                        onClick={() => setSelectedSiteId(site.id)}
                      >
                        <div className="site-card-header">
                          <span className="site-id">Site #{site.id}</span>
                          <span className="sensor-count-badge">{site.sensors.length} Sensors</span>
                        </div>
                        <h3 className="site-name">{site.name}</h3>
                        <p className="site-location">
                          {site.latitude.toFixed(4)}, {site.longitude.toFixed(4)}
                        </p>
                      </button>
                    ))}
                  </div>
                </section>

                {selectedSite && (
                  <section className="telemetry-section">
                    <h2 className="section-title">{selectedSite.name} — Sensor Telemetry</h2>
                    <p className="section-desc">24-hour SQL aggregation (Min / Avg / Max) + live readings</p>
                    <div className="sensors-grid">
                      {selectedSite.sensors.map((sensor) => (
                        <SensorChart
                          key={sensor.id}
                          sensor={sensor}
                          refreshTrigger={liveEventCount}
                          onNewReading={(reading) =>
                            setLatestReadings((prev) => ({ ...prev, [sensor.id]: reading }))
                          }
                        />
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}

            {/* Part 6 — Alerts View */}
            {activeView === 'alerts' && (
              <AlertsFeed alerts={alerts} />
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default App;
