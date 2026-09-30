# SiteWatch — Simulated Structural Monitoring Platform

A software-only portfolio project that simulates an IoT structural-monitoring
platform (sensors → API → database → map + dashboard → real-time alerts),
built to close specific gaps for full-stack internship applications
(Express.js, TypeScript, real SQL work, lightweight GIS, real-time alerting).

Rename the project however you like — "SiteWatch" is just a placeholder.

---

## 1. What this project proves

| Skill (from job postings) | Where it comes from in this project |
|---|---|
| Node.js + Express.js | The backend API (Part 2) |
| TypeScript | Backend and frontend both written in TS |
| PostgreSQL (design, queries, optimization) | Schema design, aggregate queries, an index (Part 3) |
| REST APIs | All backend endpoints |
| GIS / mapping | Leaflet map of sites (Part 5) |
| Real-time alerting (email/SMS) | Threshold-based email alerts (Part 6) |
| React | Dashboard frontend (Part 4) |
| Git/GitHub | Version control throughout — commit after each part |
| (Bonus) WebSockets / async | Optional live-push part (Part 7) |

Be upfront in interviews that the sensors are **simulated**, not physical
hardware. That's a normal, respected way to build and test an IoT platform —
don't imply otherwise.

---

## 2. Tools to install before starting

- **Node.js** (LTS, v20 or newer) — [nodejs.org](https://nodejs.org)
- **npm** (comes with Node) — or `pnpm` if you prefer
- **PostgreSQL** — either:
  - Install locally ([postgresql.org/download](https://www.postgresql.org/download/)), or
  - Use a free hosted instance (Supabase, Neon, or Railway all have free tiers) — easiest if you don't want to manage a local DB server
- **VS Code** (or your usual editor), with extensions:
  - ESLint
  - Prettier
  - PostgreSQL (by Chris Kolkman, for browsing tables from the editor)
- **Postman** or **Thunder Client** (VS Code extension) — for testing API endpoints by hand before the frontend exists
- **Git** — you already know this
- A **Gmail account** (a spare one, not your main one) with an
  [App Password](https://support.google.com/accounts/answer/185833) generated,
  for sending alert emails via Nodemailer
- **Docker Desktop** — optional, only if you'd rather run Postgres in a
  container than install it natively

### Key npm packages (install as you reach each part)

- Backend: `express`, `typescript`, `ts-node-dev`, `pg`, `@types/express`, `@types/pg`, `cors`, `dotenv`
- Simulator: `axios` (or just `node-fetch`), `typescript`
- Frontend: created via `npm create vite@latest` (React + TypeScript template), plus `recharts`, `leaflet`, `react-leaflet`, `@types/leaflet`
- Alerts: `nodemailer`, `@types/nodemailer`
- Optional real-time: `socket.io`, `socket.io-client`
- Convenience: `concurrently` (run backend + frontend with one command)

> Use plain `pg` with hand-written SQL, not an ORM like Prisma, for this
> project. The whole point is to prove you can write real, optimized SQL —
> an ORM would hide exactly the skill you're trying to demonstrate.

---

## 3. Architecture at a glance

```
[Simulator script] --HTTP POST--> [Express API] --SQL--> [PostgreSQL]
                                          |
                                          |--(threshold breached)--> [Nodemailer] --> email
                                          |
                              [React dashboard] <--REST GET-- [Express API]
                                    |
                              [Leaflet map] + [Recharts charts]
```

---

## 4. Suggested folder structure

```
sitewatch/
├── simulator/         # Part 1
│   ├── package.json
│   └── src/simulate.ts
├── backend/           # Parts 2, 3, 6, 7
│   ├── package.json
│   ├── .env
│   └── src/
│       ├── index.ts
│       ├── db.ts
│       ├── routes/
│       ├── alerts.ts
│       └── mailer.ts
├── frontend/          # Parts 4, 5
│   ├── package.json
│   └── src/
│       ├── App.tsx
│       ├── components/
│       │   ├── SiteMap.tsx
│       │   └── SensorChart.tsx
│       └── api.ts
└── README.md
```

Three separate `package.json` files is intentional — it mirrors how a real
simulator/backend/frontend split would be deployed separately.

---

## 5. Data model (PostgreSQL)

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

-- The index that makes your "optimization" claim real:
CREATE INDEX idx_readings_sensor_time ON readings (sensor_id, recorded_at DESC);
```

Pick 3-4 real-sounding site names and coordinates (real cities are fine — you
don't need real construction sites, just real coordinates so the map looks
legitimate).

---

## 6. Part-by-part build plan

Work through these in order. Commit to Git after each part — you want a
commit history that shows steady, real progress, which is itself something
worth having on GitHub.

### Part 0 — Environment setup
- [X] Install Node, PostgreSQL (or create a free hosted instance), VS Code extensions
- [ ] Create the database and run the schema from Section 5
- [X] Create the folder structure from Section 4
- [X] Initialize a Git repo at the root, add a `.gitignore` (node_modules, .env)
- **Done when:** you can connect to your database from `psql` or a GUI tool and see the 4 empty tables.

### Part 1 — Sensor simulator
- [X] New TypeScript script (`simulator/src/simulate.ts`)
- [X] Hardcode 3-4 sites and 2-3 sensors per site (matching what you inserted into `sites`/`sensors`)
- [X] Every few seconds, generate a plausible random value per sensor (small random walk, not pure random noise, so charts look realistic) and `POST` it to your backend's `/readings` endpoint
- [X] Occasionally (e.g., every ~50th reading) generate a deliberately out-of-range value, to give yourself something to test alerts with later
- **Done when:** running the script logs successful POSTs every few seconds (even before the backend can store them properly).

### Part 2 — Express + TypeScript API
- [ ] `backend/src/index.ts`: Express app, JSON body parsing, CORS enabled
- [ ] `backend/src/db.ts`: a `pg.Pool` connected using a `DATABASE_URL` from `.env`
- [ ] Endpoints:
  - `POST /readings` — body: `{ sensorId, value }`; inserts a row into `readings`
  - `GET /sites` — list all sites with their sensors
  - `GET /sensors/:id/readings?limit=100` — latest N readings for one sensor
- **Done when:** Postman can hit all three endpoints and you can see rows land in Postgres.

### Part 3 — Real SQL: aggregation and indexing
- [ ] `GET /sensors/:id/summary` — returns min/max/avg for the last 24 hours, using SQL `MIN()`, `MAX()`, `AVG()` and a `WHERE recorded_at > now() - interval '24 hours'`
- [ ] Confirm the index from Section 5 exists; use `EXPLAIN ANALYZE` on your summary query before and after adding it, and save both outputs somewhere (a comment or a note) — this is your proof you understand what the index is doing, not just that you pasted a `CREATE INDEX` line
- **Done when:** `/summary` returns correct numbers, and you can explain in one sentence what the index changed.

### Part 4 — React dashboard shell
- [ ] `npm create vite@latest frontend -- --template react-ts`
- [ ] A page that fetches `GET /sites`, lists them, and on selecting one, fetches and charts its sensors' recent readings with `recharts`
- **Done when:** you can see a live-ish line chart update as the simulator keeps posting data (refresh or poll every few seconds).

### Part 5 — Site map (lightweight GIS)
- [ ] `SiteMap.tsx` using `react-leaflet`: render an OpenStreetMap tile layer, one marker per site at its real lat/long
- [ ] Clicking a marker shows the site's name and its sensors' latest values (a popup or a side panel)
- **Done when:** the map renders with correctly placed markers and clicking one shows real data.

### Part 6 — Real-time threshold alerts
- [ ] `backend/src/alerts.ts`: after each `POST /readings`, check the value against a per-sensor-type threshold (hardcode reasonable thresholds per type)
- [ ] If breached: insert a row into `alerts`, and send an email via `nodemailer` (using your Gmail + App Password) with the site, sensor, and value
- [ ] `GET /alerts` — list recent alerts, and show them in the frontend somewhere (a simple list is enough)
- **Done when:** letting the simulator run long enough (or lowering a threshold temporarily) results in a real email landing in your inbox.

### Part 7 — Optional: live push instead of polling
- [ ] Add `socket.io` to the backend; emit an event on every new reading and on every new alert
- [ ] Frontend subscribes and updates charts/alerts without polling
- **Done when:** opening the dashboard in two browser tabs shows both updating instantly and simultaneously.

### Part 8 — Wrap-up
- [ ] Write a proper `README.md`: what it is, the architecture diagram from Section 3, how to run all three parts locally, and a note that sensor data is simulated
- [ ] Push to GitHub, public repo
- [ ] Update your CV bullet to describe exactly what you built — Express + TypeScript, PostgreSQL with aggregation and indexing, a Leaflet map, and real-time email alerts

---

## 7. Rough timeline (part-time, evenings/weekends)

| Part | Estimated time |
|---|---|
| 0 — Setup | 1-2 hours |
| 1 — Simulator | 2-3 hours |
| 2 — Express API | 3-4 hours |
| 3 — SQL/indexing | 2-3 hours |
| 4 — Dashboard shell | 3-4 hours |
| 5 — Map | 2-3 hours |
| 6 — Alerts | 2-3 hours |
| 7 — Optional real-time | 2-3 hours |
| 8 — Wrap-up | 1-2 hours |
| **Total (without Part 7)** | **~16-24 hours**, spread over 1-2 weeks |

---

## 8. Interview talking points once it's built

- "I simulated the sensors since I no longer had my embedded hardware
  available, but the backend, database, alerting, and map are all real and
  working the same way they would with physical devices."
- Be ready to explain the index in Part 3 in your own words — this is the
  single most likely thing to be probed on, since it's the concrete proof of
  "database optimization."
- Be ready to walk through what happens end-to-end when one reading comes in
  and triggers an alert — simulator → API → DB insert → threshold check →
  email. That flow is the real spine of the project.
