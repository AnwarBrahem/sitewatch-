import { pool } from './db';

async function seedHistoricalReadings() {
  console.log('🌱 Seeding historical readings for the past 24 hours...');
  
  // Clean existing test readings
  await pool.query('DELETE FROM alerts');
  await pool.query('DELETE FROM readings');

  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const intervalMs = 15 * 60 * 1000; // reading every 15 mins for 24h = 96 readings per sensor

  const sensorBaselines: Record<number, { min: number; max: number; base: number }> = {
    1: { min: 0.05, max: 0.8, base: 0.15 }, // Bridge tilt
    2: { min: 0.5, max: 3.5, base: 1.8 },   // Bridge vibration
    3: { min: 5.0, max: 18.0, base: 11.2 }, // Bridge displacement
    4: { min: 0.1, max: 0.9, base: 0.25 },  // Tower tilt
    5: { min: 0.3, max: 2.8, base: 1.2 },   // Tower vibration
    6: { min: 4.0, max: 14.0, base: 8.5 },  // Tunnel displacement
    7: { min: 0.8, max: 4.5, base: 2.4 },   // Tunnel vibration
    8: { min: 290.0, max: 410.0, base: 340.0 }, // Dam water level
    9: { min: 0.02, max: 0.5, base: 0.08 }, // Dam tilt
  };

  const values: string[] = [];

  for (let sensorId = 1; sensorId <= 9; sensorId++) {
    const config = sensorBaselines[sensorId];
    let currentVal = config.base;

    for (let t = oneDayAgo; t <= now; t += intervalMs) {
      const delta = (Math.random() - 0.49) * (config.max - config.min) * 0.08;
      currentVal = Math.max(config.min, Math.min(config.max, currentVal + delta));
      const rounded = parseFloat(currentVal.toFixed(2));
      const timestamp = new Date(t).toISOString();
      values.push(`(${sensorId}, ${rounded}, '${timestamp}')`);
    }
  }

  // Insert in batches of 300
  const batchSize = 300;
  for (let i = 0; i < values.length; i += batchSize) {
    const batch = values.slice(i, i + batchSize).join(',\n');
    await pool.query(`INSERT INTO readings (sensor_id, value, recorded_at) VALUES ${batch}`);
  }

  const countRes = await pool.query('SELECT count(*) FROM readings');
  console.log(`✅ Seeded ${countRes.rows[0].count} historical readings across 9 sensors.`);
  process.exit(0);
}

seedHistoricalReadings().catch((err) => {
  console.error('❌ Failed to seed readings:', err);
  process.exit(1);
});
