import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import type { Sensor, Reading, SensorSummary } from '../types';
import { fetchSensorReadings, fetchSensorSummary, getSocket } from '../api';

interface SensorChartProps {
  sensor: Sensor;
  refreshTrigger?: number;
  onNewReading?: (reading: Reading) => void;
}

export const SensorChart: React.FC<SensorChartProps> = ({ sensor, refreshTrigger, onNewReading }) => {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [summary, setSummary] = useState<SensorSummary | null>(null);
  const [loading, setLoading] = useState(true);

  // Real-time WebSocket push updates
  useEffect(() => {
    const socket = getSocket();

    const handleNewReading = (reading: Reading) => {
      if (reading.sensor_id === sensor.id) {
        setReadings((prev) => {
          if (prev.some((r) => r.id === reading.id)) return prev;
          const updated = [...prev, reading];
          return updated.length > 30 ? updated.slice(-30) : updated;
        });
        if (onNewReading) {
          onNewReading(reading);
        }
      }
    };

    socket.on('reading:new', handleNewReading);
    return () => {
      socket.off('reading:new', handleNewReading);
    };
  }, [sensor.id, onNewReading]);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [data, sum] = await Promise.all([
          fetchSensorReadings(sensor.id, 30),
          fetchSensorSummary(sensor.id),
        ]);
        if (isMounted) {
          const reversed = [...data].reverse();
          setReadings(reversed);
          setSummary(sum);
          setLoading(false);
          // Report latest reading to parent (for map popups)
          if (reversed.length > 0 && onNewReading) {
            onNewReading(reversed[reversed.length - 1]);
          }
        }
      } catch (err) {
        console.error(`Error loading data for sensor ${sensor.id}:`, err);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [sensor.id, refreshTrigger]);

  const latestValue = readings.length > 0 ? readings[readings.length - 1].value : null;

  const chartData = readings.map((r) => ({
    time: new Date(r.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    value: r.value,
  }));

  return (
    <div className="sensor-card">
      <div className="sensor-card-header">
        <div>
          <span className="sensor-type-badge">{sensor.type.toUpperCase()}</span>
          <h3 className="sensor-title">Sensor #{sensor.id}</h3>
        </div>
        <div className="sensor-current-val">
          {latestValue !== null ? (
            <>
              <span className="current-number">{latestValue.toFixed(2)}</span>
              <span className="unit-label">{sensor.unit}</span>
            </>
          ) : (
            <span className="no-data">No data</span>
          )}
        </div>
      </div>

      {summary && (
        <div className="sensor-stats-bar">
          <div className="stat-item">
            <span className="stat-label">24h Min</span>
            <span className="stat-value">{summary.min !== null ? `${summary.min} ${sensor.unit}` : '—'}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">24h Avg</span>
            <span className="stat-value">{summary.avg !== null ? `${summary.avg} ${sensor.unit}` : '—'}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">24h Max</span>
            <span className="stat-value">{summary.max !== null ? `${summary.max} ${sensor.unit}` : '—'}</span>
          </div>
        </div>
      )}

      <div className="chart-container">
        {loading ? (
          <div className="chart-loading">Loading telemetry...</div>
        ) : chartData.length === 0 ? (
          <div className="chart-empty">No telemetry recorded yet</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.5} />
              <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={11} domain={['auto', 'auto']} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '8px',
                  color: '#f8fafc',
                  fontSize: '12px',
                }}
                formatter={(val: any) => [`${val} ${sensor.unit}`, 'Value']}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#38bdf8"
                strokeWidth={2}
                dot={{ r: 2, fill: '#38bdf8' }}
                activeDot={{ r: 5, fill: '#0ea5e9' }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};
