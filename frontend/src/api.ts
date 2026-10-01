import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type { Site, Reading, SensorSummary, Alert, ThresholdMap } from './types';

export const API_BASE = 'http://localhost:3000';

export async function fetchSites(): Promise<Site[]> {
  const res = await fetch(`${API_BASE}/sites`);
  if (!res.ok) throw new Error(`Failed to fetch sites: ${res.statusText}`);
  return res.json();
}

export async function fetchSensorReadings(sensorId: number, limit = 50): Promise<Reading[]> {
  const res = await fetch(`${API_BASE}/sensors/${sensorId}/readings?limit=${limit}`);
  if (!res.ok) throw new Error(`Failed to fetch readings: ${res.statusText}`);
  return res.json();
}

export async function fetchSensorSummary(sensorId: number): Promise<SensorSummary> {
  const res = await fetch(`${API_BASE}/sensors/${sensorId}/summary`);
  if (!res.ok) throw new Error(`Failed to fetch summary: ${res.statusText}`);
  return res.json();
}

export async function fetchAlerts(): Promise<Alert[]> {
  const res = await fetch(`${API_BASE}/alerts`);
  if (!res.ok) throw new Error(`Failed to fetch alerts: ${res.statusText}`);
  return res.json();
}

export async function fetchThresholds(): Promise<ThresholdMap> {
  const res = await fetch(`${API_BASE}/thresholds`);
  if (!res.ok) throw new Error(`Failed to fetch thresholds: ${res.statusText}`);
  return res.json();
}

let socketInstance: Socket | null = null;

export function getSocket(): Socket {
  if (!socketInstance) {
    socketInstance = io(API_BASE, {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
  }
  return socketInstance;
}
