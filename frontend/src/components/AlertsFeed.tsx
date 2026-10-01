import React from 'react';
import type { Alert } from '../types';

interface AlertsFeedProps {
  alerts: Alert[];
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const SENSOR_ICONS: Record<string, string> = {
  tilt: '📐',
  vibration: '〰️',
  displacement: '↔️',
  water_level: '🌊',
};

export const AlertsFeed: React.FC<AlertsFeedProps> = ({ alerts }) => {
  return (
    <section className="alerts-section">
      <div className="alerts-header">
        <h2 className="section-title">
          🚨 Threshold Breach Alerts
          {alerts.length > 0 && (
            <span className="alerts-count-badge">{alerts.length}</span>
          )}
        </h2>
        <p className="section-desc">
          Logged when a sensor reading exceeds its configured safety threshold. Emails are dispatched automatically.
        </p>
      </div>

      {alerts.length === 0 ? (
        <div className="alerts-empty">
          <span>✅ No threshold breaches recorded yet. Run the simulator to generate data.</span>
        </div>
      ) : (
        <div className="alerts-list">
          {alerts.map((alert) => (
            <div key={alert.id} className="alert-row">
              <div className="alert-icon">
                {SENSOR_ICONS[alert.type ?? ''] ?? '⚠️'}
              </div>
              <div className="alert-body">
                <div className="alert-site">{alert.site_name ?? `Sensor #${alert.sensor_id}`}</div>
                <div className="alert-detail">
                  <span className="alert-type">{alert.type?.replace('_', ' ')}</span>
                  <span className="alert-value">{alert.value.toFixed(2)} {alert.unit}</span>
                  <span className="alert-threshold">limit: {alert.threshold} {alert.unit}</span>
                </div>
              </div>
              <div className="alert-time">{timeAgo(alert.triggered_at)}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
