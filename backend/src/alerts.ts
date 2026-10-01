import { pool } from './db';
import { sendAlertEmail, AlertEmailPayload } from './mailer';

export interface AlertRecord {
  id: number;
  sensor_id: number;
  value: number;
  threshold: number;
  triggered_at: string;
  type?: string;
  unit?: string;
  site_name?: string;
}

// Configurable upper safety thresholds per sensor telemetry type
export const SENSOR_THRESHOLDS: Record<string, number> = {
  tilt: 1.5,          // degrees
  vibration: 5.0,     // mm/s
  displacement: 20.0, // mm
  water_level: 420.0, // cm
};

// Cache sensor metadata to avoid querying DB for sensor details on every reading tick
interface SensorMeta {
  id: number;
  siteId: number;
  siteName: string;
  type: string;
  unit: string;
}

let sensorMetadataCache: Map<number, SensorMeta> | null = null;

async function getSensorMetadata(sensorId: number): Promise<SensorMeta | null> {
  if (!sensorMetadataCache) {
    const query = `
      SELECT s.id, s.site_id AS "siteId", st.name AS "siteName", s.type, s.unit
      FROM sensors s
      JOIN sites st ON s.site_id = st.id;
    `;
    const res = await pool.query(query);
    sensorMetadataCache = new Map();
    for (const row of res.rows) {
      sensorMetadataCache.set(row.id, {
        id: row.id,
        siteId: row.siteId,
        siteName: row.siteName,
        type: row.type,
        unit: row.unit,
      });
    }
  }

  return sensorMetadataCache.get(sensorId) || null;
}

export async function checkAndProcessAlert(sensorId: number, value: number): Promise<AlertRecord | null> {
  const meta = await getSensorMetadata(sensorId);
  if (!meta) return null;

  const threshold = SENSOR_THRESHOLDS[meta.type];
  if (threshold === undefined) return null;

  // Breach condition: reading strictly exceeds upper threshold
  if (value > threshold) {
    console.warn(`\x1b[31m🚨 [THRESHOLD BREACH]\x1b[0m Sensor #${sensorId} (${meta.siteName} - ${meta.type}): ${value} > ${threshold} ${meta.unit}`);

    const insertQuery = `
      INSERT INTO alerts (sensor_id, value, threshold, triggered_at)
      VALUES ($1, $2, $3, NOW())
      RETURNING id, sensor_id, value, threshold, triggered_at;
    `;
    const result = await pool.query(insertQuery, [sensorId, value, threshold]);
    const alert = result.rows[0];

    const alertRecord: AlertRecord = {
      ...alert,
      type: meta.type,
      unit: meta.unit,
      site_name: meta.siteName,
    };

    // Dispatch email asynchronously without blocking the REST response
    sendAlertEmail({
      siteName: meta.siteName,
      sensorType: meta.type,
      sensorUnit: meta.unit,
      sensorId: meta.id,
      value: value,
      threshold: threshold,
      triggeredAt: new Date(alert.triggered_at),
    }).catch((err) => console.error('Alert email delivery failed:', err));

    return alertRecord;
  }

  return null;
}
