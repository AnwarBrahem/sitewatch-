# SiteWatch — Session Progress & Implementation Summary

**Date:** September 30, 2026  
**Status:** In Progress (Parts 0 & 1 Completed, Part 2 Code Complete)

---

## 1. Project Architecture & Decisions
- **Core Vision:** Portfolio IoT structural-monitoring platform (Simulated Sensors → Express API → PostgreSQL → React Dashboard + Leaflet GIS → Real-Time Alerts).
- **Hosting Strategy:** Avoided local PostgreSQL and Docker overhead; selected **Supabase** cloud PostgreSQL for database hosting.

---

## 2. Completed Milestones

### Part 0 — Environment Setup
- [X] **Runtime Verified:** Node.js (v24.21.0) and npm (v11.19.0).
- [X] **Version Control:** Git repository initialized at workspace root.
- [X] **Git Configuration:** `.gitignore` configured to exclude `node_modules/`, `.env`, build artifacts (`dist/`, `build/`), and OS files.
- [X] **Folder Structure:** Created modular project directories:
  - `simulator/`: Telemetry generation service.
  - `backend/`: Express.js REST API + PostgreSQL driver.
  - `frontend/`: React dashboard & GIS mapping.
- [X] **Database Schema Script:** Generated [`schema.sql`](file:///c:/Users/mypc/Desktop/Project/schema.sql) with tables:
  - `sites` (id, name, latitude, longitude)
  - `sensors` (id, site_id, type, unit)
  - `readings` (id, sensor_id, value, recorded_at)
  - `alerts` (id, sensor_id, value, threshold, triggered_at)
  - Composite performance index: `idx_readings_sensor_time ON readings (sensor_id, recorded_at DESC)`.
  - Realistic seed data for 4 infrastructure sites and 9 sensors.

---

### Part 1 — Sensor Telemetry Simulator
- [X] **Project Manifest:** Configured [`simulator/package.json`](file:///c:/Users/mypc/Desktop/Project/simulator/package.json) and [`simulator/tsconfig.json`](file:///c:/Users/mypc/Desktop/Project/simulator/tsconfig.json) with `axios`, `typescript`, `ts-node`.
- [X] **Dependencies Installed:** `npm install` executed cleanly.
- [X] **Simulator Logic ([`simulator/src/simulate.ts`](file:///c:/Users/mypc/Desktop/Project/simulator/src/simulate.ts)):**
  - Modeled 4 real-world structures:
    1. *Riverside Suspension Bridge* (tilt, vibration, displacement)
    2. *Harbor Observation Tower* (tilt, vibration)
    3. *Metro Transit Tunnel - East* (displacement, vibration)
    4. *Alpine Reservoir Dam* (water level, tilt)
  - **Random-Walk Algorithm:** Implemented realistic incremental physics-based drift bounded by physical constraints.
  - **Anomaly Spikes:** Injected intentional threshold breach values every ~50 ticks for alert testing.
  - **Batch Ingestion:** Emits telemetry every 3 seconds to `POST http://localhost:3000/readings`.
- [X] **Validation:** Live execution tested; logs show successful tick cycles with realistic values.

---

### Part 2 — Express + TypeScript Backend API
- [X] **Project Manifest:** Configured [`backend/package.json`](file:///c:/Users/mypc/Desktop/Project/backend/package.json) and [`backend/tsconfig.json`](file:///c:/Users/mypc/Desktop/Project/backend/tsconfig.json) with `express`, `pg`, `cors`, `dotenv`, `ts-node-dev`.
- [X] **Dependencies Installed:** All packages installed cleanly.
- [X] **Database Client ([`backend/src/db.ts`](file:///c:/Users/mypc/Desktop/Project/backend/src/db.ts)):**
  - Connected using `pg.Pool`.
  - Configured with SSL (`rejectUnauthorized: false`) for cloud database connectivity.
- [X] **REST API Endpoints ([`backend/src/index.ts`](file:///c:/Users/mypc/Desktop/Project/backend/src/index.ts)):**
  - `GET /health`: Server and DB connection ping.
  - `GET /sites`: Retrieves all sites with nested sensors via PostgreSQL JSON aggregation (`json_agg`).
  - `POST /readings`: Ingests reading `{ sensorId, value }` and writes to `readings` table.
  - `GET /sensors/:id/readings?limit=100`: Reads recent time-series data using composite index.
  - `GET /sensors/:id/summary`: 24-hour SQL aggregation (`MIN`, `MAX`, `AVG`).
  - `GET /alerts`: Queries recent threshold alerts.

---

## 3. Current Working State & Next Step

```
[Simulator] (Ready)  -->  POST /readings  -->  [Express Backend] (Ready)  -->  [Supabase DB] (Awaiting IPv4 pooler connection)
```

1. **Pending Input:** Update `DATABASE_URL` in [`backend/.env`](file:///c:/Users/mypc/Desktop/Project/backend/.env) with the Supabase **IPv4 Session Pooler URI**:
   ```text
   postgresql://postgres.sdpkktxpsmnxrpqcntrp:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres
   ```
2. **Next Immediate Milestone:** Boot backend (`npm run dev`), run the database migration check, and start streaming live telemetry from the simulator into Supabase!
