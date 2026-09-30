import axios from 'axios';

interface SensorConfig {
  id: number;
  siteId: number;
  siteName: string;
  type: string;
  unit: string;
  currentValue: number;
  minNormal: number;
  maxNormal: number;
  stepRange: number;
  spikeValue: number;
}

const SENSORS: SensorConfig[] = [
  // Riverside Suspension Bridge (site 1)
  { id: 1, siteId: 1, siteName: 'Riverside Suspension Bridge', type: 'tilt', unit: 'deg', currentValue: 0.15, minNormal: 0.05, maxNormal: 0.8, stepRange: 0.02, spikeValue: 2.5 },
  { id: 2, siteId: 1, siteName: 'Riverside Suspension Bridge', type: 'vibration', unit: 'mm/s', currentValue: 1.8, minNormal: 0.5, maxNormal: 3.5, stepRange: 0.15, spikeValue: 8.0 },
  { id: 3, siteId: 1, siteName: 'Riverside Suspension Bridge', type: 'displacement', unit: 'mm', currentValue: 11.2, minNormal: 5.0, maxNormal: 18.0, stepRange: 0.3, spikeValue: 30.0 },

  // Harbor Observation Tower (site 2)
  { id: 4, siteId: 2, siteName: 'Harbor Observation Tower', type: 'tilt', unit: 'deg', currentValue: 0.25, minNormal: 0.1, maxNormal: 0.9, stepRange: 0.03, spikeValue: 2.8 },
  { id: 5, siteId: 2, siteName: 'Harbor Observation Tower', type: 'vibration', unit: 'mm/s', currentValue: 1.2, minNormal: 0.3, maxNormal: 2.8, stepRange: 0.1, spikeValue: 6.5 },

  // Metro Transit Tunnel - East (site 3)
  { id: 6, siteId: 3, siteName: 'Metro Transit Tunnel - East', type: 'displacement', unit: 'mm', currentValue: 8.5, minNormal: 4.0, maxNormal: 14.0, stepRange: 0.2, spikeValue: 26.0 },
  { id: 7, siteId: 3, siteName: 'Metro Transit Tunnel - East', type: 'vibration', unit: 'mm/s', currentValue: 2.4, minNormal: 0.8, maxNormal: 4.5, stepRange: 0.2, spikeValue: 9.0 },

  // Alpine Reservoir Dam (site 4)
  { id: 8, siteId: 4, siteName: 'Alpine Reservoir Dam', type: 'water_level', unit: 'cm', currentValue: 340.0, minNormal: 290.0, maxNormal: 410.0, stepRange: 0.6, spikeValue: 460.0 },
  { id: 9, siteId: 4, siteName: 'Alpine Reservoir Dam', type: 'tilt', unit: 'deg', currentValue: 0.08, minNormal: 0.02, maxNormal: 0.5, stepRange: 0.015, spikeValue: 1.9 },
];

const API_BASE_URL = process.env.API_URL || 'http://localhost:3000';
const TICK_INTERVAL_MS = 3000; // Emit every 3 seconds
let tickCount = 0;

function getNextSensorValue(sensor: SensorConfig): number {
  tickCount++;
  // Every ~50th global tick, inject a deliberately out-of-range value for alert testing
  const shouldSpike = tickCount % 50 === 0 && Math.random() < 0.8;
  if (shouldSpike) {
    console.warn(`\x1b[33m⚠️ [SIMULATOR ALERT SPIKE] Injecting anomaly for sensor #${sensor.id} (${sensor.type} at ${sensor.siteName})\x1b[0m`);
    return parseFloat(sensor.spikeValue.toFixed(2));
  }

  // Random walk: previous value + random change within [-stepRange, +stepRange]
  const delta = (Math.random() * 2 - 1) * sensor.stepRange;
  let nextValue = sensor.currentValue + delta;

  // Gently pull back if value drifts outside normal bounds
  if (nextValue < sensor.minNormal) {
    nextValue = sensor.minNormal + Math.random() * sensor.stepRange;
  } else if (nextValue > sensor.maxNormal) {
    nextValue = sensor.maxNormal - Math.random() * sensor.stepRange;
  }

  sensor.currentValue = nextValue;
  return parseFloat(nextValue.toFixed(2));
}

async function sendReading(sensor: SensorConfig, value: number): Promise<void> {
  try {
    const payload = {
      sensorId: sensor.id,
      value: value,
    };
    const response = await axios.post(`${API_BASE_URL}/readings`, payload, {
      timeout: 2500,
    });
    console.log(
      `\x1b[32m✔ [POST /readings]\x1b[0m Sensor #${sensor.id} (${sensor.siteName} - ${sensor.type}): ${value} ${sensor.unit} (Status: ${response.status})`
    );
  } catch (error: any) {
    if (error.response) {
      console.error(`\x1b[31m✖ [POST /readings Error]\x1b[0m Sensor #${sensor.id} (${error.response.status}): ${JSON.stringify(error.response.data)}`);
    } else {
      console.warn(`\x1b[33mℹ [POST /readings Pending]\x1b[0m Backend offline or unreachable at ${API_BASE_URL}. Reading for sensor #${sensor.id}: ${value} ${sensor.unit}`);
    }
  }
}

async function runSimulatorCycle() {
  console.log(`\n--- Sensor Tick Cycle (Interval: ${TICK_INTERVAL_MS / 1000}s) ---`);
  for (const sensor of SENSORS) {
    const nextVal = getNextSensorValue(sensor);
    await sendReading(sensor, nextVal);
  }
}

console.log('🚀 Starting SiteWatch Sensor Telemetry Simulator...');
console.log(`Target API: ${API_BASE_URL}/readings`);
console.log(`Active Sensors: ${SENSORS.length} sensors across 4 sites`);
console.log('Simulating realistic random walk with occasional alert threshold spikes...\n');

// Start simulation loop
runSimulatorCycle();
setInterval(runSimulatorCycle, TICK_INTERVAL_MS);
