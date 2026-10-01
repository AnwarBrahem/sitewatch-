# SiteWatch — Simulated IoT Structural Health Monitoring Platform

![Status](https://img.shields.io/badge/Status-Complete-emerald?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat-square&logo=typescript)
![Node.js](https://img.shields.io/badge/Node.js-v24-green?style=flat-square&logo=node.js)
![Express](https://img.shields.io/badge/Express.js-Backend-black?style=flat-square&logo=express)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-336791?style=flat-square&logo=postgresql)
![React](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react)
![Vite](https://img.shields.io/badge/Vite-6-646cff?style=flat-square&logo=vite)
![Socket.IO](https://img.shields.io/badge/Socket.IO-Realtime-010101?style=flat-square&logo=socketdotio)
![Leaflet](https://img.shields.io/badge/Leaflet-GIS_Mapping-199900?style=flat-square&logo=leaflet)

A full-stack, real-time IoT structural health monitoring system simulating sensor telemetry (tilt, vibration, displacement, water level) across civil infrastructure sites (bridges, dams, highways, overpasses). Features a high-throughput Express.js REST + WebSocket ingestion engine, hand-written PostgreSQL queries with composite indexing and `EXPLAIN ANALYZE` benchmarking, interactive Leaflet GIS mapping, Recharts telemetry dashboards, and real-time threshold alert dispatch with automated email notifications.

> **Note on IoT Telemetry:** The sensor devices in this repository are **simulated via software** (`simulator/src/simulate.ts`) using physics-based random-walk drift and deliberate anomaly spikes. The backend ingestion pipeline, database schema, real-time alerting engine, email dispatch, and GIS frontend dashboard are fully operational production-grade architectures identical to those deployed with physical IoT hardware.

---

## Architecture & Data Flow

```
┌─────────────────────────────────┐
│   IoT Sensor Simulator          │
│   (Physics Drift + Spikes)      │
└────────────────┬────────────────┘
                 │ HTTP POST /readings (every 3s)
                 ▼
┌────────────────────────────────────────────────────────┐
│   Express.js + TypeScript API Gateway                  │
│   - Socket.IO WebSocket Server (Port 3000)             │
│   - Hand-written SQL with pg.Pool                      │
└───────┬────────────────────────┬───────────────────────┘
        │                        │
        │ SQL Insert & Query     │ Threshold Breached (> Limit)
        ▼                        ▼
┌──────────────────┐    ┌─────────────────────────────────┐
│  PostgreSQL      │    │  Nodemailer Email Service       │
│  (Supabase Cloud)│    │  - HTML Alert Template          │
│  - B-Tree Index  │    │  - Console simulation fallback  │
└──────────────────┘    └─────────────────────────────────┘
        ▲
        │ REST GET (Sites, Summaries, Historical Data)
        │ WebSocket Push (reading:new, alert:new)
        ▼
┌────────────────────────────────────────────────────────┐
│   React 19 + TypeScript + Vite Dashboard               │
│   - 🗺️ Leaflet GIS Site Map (CARTO Dark Tiles)         │
│   - 📊 Recharts 24h Telemetry Analytics Grid          │
│   - 🚨 Real-time Alerts Feed & Live Status Badges      │
└────────────────────────────────────────────────────────┘
```

---

## Key Features

1. **High-Throughput Ingestion & Live Push:**
   - Express.js ingestion endpoint (`POST /readings`) processing telemetry from multiple concurrent sensors.
   - Dual-mode client updates: WebSocket push (`reading:new`, `alert:new`) for instantaneous zero-latency UI updates, with intelligent fallback polling when offline.

2. **Hand-Written PostgreSQL & Index Optimization:**
   - Built with raw `pg.Pool` queries (no ORM abstraction) to maintain full control over query execution plans.
   - 24-hour analytical aggregation endpoint (`GET /sensors/:id/summary`) computing `MIN()`, `MAX()`, and `AVG()`.
   - Optimized with a composite B-Tree index:
     ```sql
     CREATE INDEX idx_readings_sensor_time ON readings (sensor_id, recorded_at DESC);
     ```
   - Benchmarked via `EXPLAIN ANALYZE`: eliminates full-table sequential scans and transitions to fast Index Condition scans ([see report](file:///c:/Users/mypc/Desktop/Project/backend/docs/INDEX_EXPLAIN_ANALYSIS.md)).

3. **Interactive GIS Site Map:**
   - Built with Leaflet & CARTO Dark matter tile layer.
   - Pulsating radar markers representing infrastructure sites:
     - 🟢 **Normal:** Healthy readings within tolerance.
     - 🔴 **Alert:** Active threshold breaches detected.
     - 🔵 **Selected:** Active site in view.
   - Rich popup overlays showing coordinates, live sensor status, and quick-navigation buttons.

4. **Real-Time Threshold Alert Engine & Email Dispatch:**
   - Threshold limits configured per sensor modality:
     - **Tilt:** `> 1.5°`
     - **Vibration:** `> 5.0 mm/s`
     - **Displacement:** `> 20.0 mm`
     - **Water Level:** `> 420.0 cm`
   - Ingested readings exceeding limits trigger an immediate database record in `alerts` and dispatch HTML incident emails via `nodemailer` (with console logging fallback).

---

## Database Schema

```sql
CREATE TABLE sites (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL
);

CREATE TABLE sensors (
  id SERIAL PRIMARY KEY,
  site_id INTEGER REFERENCES sites(id),
  type TEXT NOT NULL,        -- 'tilt', 'vibration', 'displacement', 'water_level'
  unit TEXT NOT NULL         -- 'deg', 'mm/s', 'mm', 'cm'
);

CREATE TABLE readings (
  id SERIAL PRIMARY KEY,
  sensor_id INTEGER REFERENCES sensors(id),
  value DOUBLE PRECISION NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE alerts (
  id SERIAL PRIMARY KEY,
  sensor_id INTEGER REFERENCES sensors(id),
  value DOUBLE PRECISION NOT NULL,
  threshold DOUBLE PRECISION NOT NULL,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_readings_sensor_time ON readings (sensor_id, recorded_at DESC);
```

---

## Project Structure

```
sitewatch/
├── backend/                  # Express.js + TypeScript API & WebSocket Server
│   ├── src/
│   │   ├── index.ts          # Main Express server & Socket.IO instance
│   │   ├── db.ts             # PostgreSQL connection pool (pg.Pool)
│   │   ├── alerts.ts         # Safety threshold verification engine
│   │   └── mailer.ts         # Nodemailer email alert transporter
│   ├── docs/
│   │   └── INDEX_EXPLAIN_ANALYSIS.md # EXPLAIN ANALYZE benchmark report
│   ├── .env                  # Database URL & Email credentials
│   └── package.json
├── frontend/                 # React 19 + TypeScript + Vite Dashboard
│   ├── src/
│   │   ├── App.tsx           # Main application shell with tab views & WebSocket handler
│   │   ├── api.ts            # REST client & Socket.IO client singleton
│   │   ├── types.ts          # Strongly typed domain models
│   │   └── components/
│   │       ├── SiteMap.tsx   # Leaflet GIS interactive map
│   │       ├── SensorChart.tsx # Recharts telemetry chart with 24h stats
│   │       └── AlertsFeed.tsx # Real-time threshold breach feed
│   └── package.json
├── simulator/                # Sensor Telemetry Simulator
│   ├── src/
│   │   └── simulate.ts       # Physics-based random walk & anomaly generator
│   └── package.json
└── README.md
```

---

## Getting Started Locally

### Prerequisites
- **Node.js** (v20+ or v24)
- **npm** (v10+)
- Hosted or local **PostgreSQL** instance (e.g. Supabase, Neon, or local `psql`)

---

### 1. Backend Setup

```bash
cd backend
npm install
```

Configure your environment variables in `backend/.env`:
```env
PORT=3000
DATABASE_URL=postgresql://<user>:<password>@<host>:5432/<dbname>

# Optional: Nodemailer Gmail delivery (fallback prints to console if empty)
GMAIL_USER=your-email@gmail.com
GMAIL_APP_PASSWORD=your-16-char-app-password
ALERT_EMAIL_TO=recipient@example.com
```

Start the backend API & WebSocket server:
```bash
npm run dev
```
*Server runs at `http://localhost:3000` with WebSocket live support.*

---

### 2. Frontend Dashboard Setup

In a new terminal:
```bash
cd frontend
npm install
npm run dev
```
*Dashboard opens at `http://localhost:5173`.*

---

### 3. Sensor Simulator Setup

In a third terminal:
```bash
cd simulator
npm install
npm run dev
```
*Starts generating physics-based sensor drift and transmitting readings to the API every 3 seconds.*

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Server health, DB connection check, and active WebSocket client count |
| `GET` | `/sites` | List all sites with nested sensors (Postgres JSON aggregation) |
| `POST` | `/readings` | Ingest new sensor reading; triggers alert verification and WebSocket broadcast |
| `GET` | `/sensors/:id/readings?limit=50` | Latest N readings for a sensor (Index-accelerated) |
| `GET` | `/sensors/:id/summary` | 24-hour SQL aggregation (`MIN`, `MAX`, `AVG`) |
| `GET` | `/thresholds` | Configured safety limits per sensor modality |
| `GET` | `/alerts` | Recent threshold breaches with sensor and site metadata |
| `WS` | `reading:new` | Socket.IO event: pushes ingested reading to all active dashboards |
| `WS` | `alert:new` | Socket.IO event: pushes new threshold breach to all active dashboards |

---

## Resume / CV Bullet Points

> * "Architected and built **SiteWatch**, a full-stack IoT structural-monitoring platform with **Express.js**, **TypeScript**, and **React 19**, ingesting continuous telemetry across civil infrastructure sites."
> * "Authored hand-written **PostgreSQL** aggregations (`MIN`, `MAX`, `AVG` over 24h rolling windows) and optimized queries using a composite B-Tree index (`sensor_id`, `recorded_at DESC`), verified via `EXPLAIN ANALYZE`."
> * "Implemented real-time bi-directional streaming using **Socket.IO** to eliminate polling overhead and deliver zero-latency sensor telemetry directly to **Recharts** and **Leaflet GIS** map visualizations."
> * "Constructed an automated safety threshold verification system with instant incident logging and automated HTML alert email dispatch via **Nodemailer**."
