export interface Sensor {
  id: number;
  type: 'tilt' | 'vibration' | 'displacement' | 'water_level' | string;
  unit: string;
}

export interface Site {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  sensors: Sensor[];
}

export interface Reading {
  id: number;
  sensor_id: number;
  value: number;
  recorded_at: string;
}

export interface SensorSummary {
  sensor_id: number;
  count: number;
  min: number | null;
  max: number | null;
  avg: number | null;
}

export interface Alert {
  id: number;
  sensor_id: number;
  value: number;
  threshold: number;
  triggered_at: string;
  type?: string;
  unit?: string;
  site_name?: string;
}

export type ThresholdMap = Record<string, number>;
