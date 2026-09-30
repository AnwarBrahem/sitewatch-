-- 1. Create Tables
CREATE TABLE IF NOT EXISTS sites (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS sensors (
  id SERIAL PRIMARY KEY,
  site_id INTEGER REFERENCES sites(id) ON DELETE CASCADE,
  type TEXT NOT NULL,        -- 'tilt', 'vibration', 'displacement', 'water_level'
  unit TEXT NOT NULL         -- 'deg', 'mm/s', 'mm', 'cm'
);

CREATE TABLE IF NOT EXISTS readings (
  id SERIAL PRIMARY KEY,
  sensor_id INTEGER REFERENCES sensors(id) ON DELETE CASCADE,
  value DOUBLE PRECISION NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alerts (
  id SERIAL PRIMARY KEY,
  sensor_id INTEGER REFERENCES sensors(id) ON DELETE CASCADE,
  value DOUBLE PRECISION NOT NULL,
  threshold DOUBLE PRECISION NOT NULL,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Performance Index (for fast time-series queries)
CREATE INDEX IF NOT EXISTS idx_readings_sensor_time ON readings (sensor_id, recorded_at DESC);

-- 3. Seed Realistic Initial Sites & Sensors
INSERT INTO sites (name, latitude, longitude) VALUES
  ('Riverside Suspension Bridge', 51.5055, -0.0754),   -- London
  ('Harbor Observation Tower', 40.7061, -73.9969),     -- New York
  ('Metro Transit Tunnel - East', 37.7749, -122.4194), -- San Francisco
  ('Alpine Reservoir Dam', 46.5197, 6.6323)            -- Switzerland
ON CONFLICT DO NOTHING;

INSERT INTO sensors (site_id, type, unit) VALUES
  -- Riverside Suspension Bridge
  (1, 'tilt', 'deg'),
  (1, 'vibration', 'mm/s'),
  (1, 'displacement', 'mm'),
  -- Harbor Observation Tower
  (2, 'tilt', 'deg'),
  (2, 'vibration', 'mm/s'),
  -- Metro Transit Tunnel - East
  (3, 'displacement', 'mm'),
  (3, 'vibration', 'mm/s'),
  -- Alpine Reservoir Dam
  (4, 'water_level', 'cm'),
  (4, 'tilt', 'deg')
ON CONFLICT DO NOTHING;
