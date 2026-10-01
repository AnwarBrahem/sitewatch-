# 🏗️ SiteWatch — How the System Works (Plain English Guide)

Welcome to **SiteWatch**! If you opened the dashboard and saw maps, numbers, graphs, and flashing alert badges and wondered **"What does all of this actually mean?"**, this guide explains everything in simple, everyday language.

---

## 1. What is this App in the Real World?

Imagine you are a civil engineer responsible for the safety of huge structures:
* A massive **suspension bridge** carrying thousands of cars every hour.
* A giant **hydroelectric dam** holding back millions of gallons of water.
* A deep **highway tunnel** through a mountain.
* A 50-story **office skyscraper**.

If a bridge starts leaning, or vibrating violently, or cracking at a joint, you cannot wait for it to collapse before doing something. 

In real life, engineers attach **electronic sensors** to the concrete and steel. These sensors measure the structure's health 24/7. 

**SiteWatch is the software platform that collects, stores, visualizes, and watches those sensors.** If something reaches a dangerous level, the system sounds the alarm immediately.

---

## 2. The 3 Pieces of the App (How they talk to each other)

```
┌────────────────────────┐
│  1. Simulator          │  --> Acts like physical hardware out in the field.
│  (The "Sensors")       │      Generates realistic readings every 3 seconds.
└───────────┬────────────┘
            │  (Transmits readings over HTTP)
            ▼
┌────────────────────────┐
│  2. Express Backend    │  --> The "Brain". Saves data to PostgreSQL database,
│  & PostgreSQL Database │      calculates statistics, and checks safety limits.
└───────────┬────────────┘
            │  (Streams data instantly via WebSockets)
            ▼
┌────────────────────────┐
│  3. React Dashboard    │  --> The "Control Room". The screen you look at with
│  (Map, Charts, Alerts) │      the map, live graphs, and emergency warnings.
└────────────────────────┘
```

---

## 3. What are the 4 Types of Sensors? (The Figures Explained)

On your dashboard you will see 4 different kinds of sensor measurements. Here is what each one means in plain English:

### 📐 1. Tilt (`deg` — Degrees)
* **What it measures:** How much a pillar, tower, or wall is leaning away from being straight up and down.
* **Normal reading:** Around `0.10°` to `0.50°` (structures sway a tiny bit in the wind).
* **Danger threshold:** **`> 1.50°`**
* **Real-world meaning:** If a bridge tower tilts more than 1.5 degrees, its foundation might be sinking or sliding!

---

### 〰️ 2. Vibration (`mm/s` — Millimeters per second)
* **What it measures:** How fast the structure is shaking back and forth (velocity of movement).
* **Normal reading:** Around `0.5` to `2.5 mm/s` (normal traffic or gentle wind).
* **Danger threshold:** **`> 5.00 mm/s`**
* **Real-world meaning:** High vibration means an earthquake, heavy storm resonance, or damaged shock dampers. Too much vibration causes concrete to crack and steel bolts to snap.

---

### ↔️ 3. Displacement (`mm` — Millimeters)
* **What it measures:** How much an expansion joint or crack has widened or shifted.
* **Normal reading:** `5.0 mm` to `15.0 mm` (bridges expand in the summer heat and shrink in winter).
* **Danger threshold:** **`> 20.00 mm`**
* **Real-world meaning:** If a joint separates by more than 20 millimeters, the roadway is pulling apart!

---

### 🌊 4. Water Level (`cm` — Centimeters)
* **What it measures:** The height of water beneath a bridge or behind a dam wall.
* **Normal reading:** `250 cm` to `380 cm` (normal river or reservoir levels).
* **Danger threshold:** **`> 420.00 cm`**
* **Real-world meaning:** If the water hits 420 cm, the river is overflowing and flooding the bridge piers or overtopping the dam!

---

## 4. Understanding the Dashboard Screens

When you open `http://localhost:5173`, you have 3 tabs at the top:

### 🗺️ Tab 1: Site Map (GIS)
* **Pulsating Green Dot 🟢:** The site is healthy. All sensors are within safe limits.
* **Pulsating Red Dot 🔴:** Danger! One of the sensors at this site recently breached its safety limit.
* **Blue Dot 🔵:** The site you currently have selected.
* **Clicking any marker:** A popup opens showing the site's real-world GPS coordinates and the latest live sensor readings.

---

### 📊 Tab 2: Telemetry Charts
* **The Graph Line:** Shows the last 30 readings collected from that specific sensor. As the simulator runs, new points appear automatically without needing to refresh.
* **The 3 Numbers at the top of each chart:**
  * **24h Min:** The lowest value this sensor recorded in the last 24 hours (calculated by PostgreSQL).
  * **24h Avg:** The average normal operating level.
  * **24h Max:** The highest peak recorded in the last 24 hours.
* **The Big White Number:** The exact value right now this second.

---

### 🚨 Tab 3: Alerts Feed
* Every time a sensor records a value higher than its safety limit, the backend:
  1. Records an incident row in the PostgreSQL `alerts` table.
  2. Dispatches an incident alert (and sends an HTML email if configured).
  3. Pushes the alert immediately to your screen via WebSocket.
* You will see the site name, which sensor failed, the measured value in red, the safety limit, and how many minutes ago it happened.

---

## 5. Why do Alerts appear if everything is simulated?

In [`simulator/src/simulate.ts`](file:///c:/Users/mypc/Desktop/Project/simulator/src/simulate.ts), we programmed the sensors to behave like real physics:
* 98% of the time, the numbers drift up and down gently (a "random walk").
* Every ~50 ticks (roughly every 2–3 minutes), the simulator deliberately injects an **anomaly spike** (e.g. vibration jumps to `6.8 mm/s` or tilt jumps to `1.9°`).
* **Why?** Because an alerting system is useless if you can never test it! The deliberate spikes prove that your database, your WebSocket engine, your email notifications, and your UI badges all react instantly when a real emergency happens.

---

## 6. How to Explain This Project in an Interview (60-Second Pitch)

If an interviewer asks: *"Tell me about SiteWatch"*, here is the exact story to tell:

> *"SiteWatch is a full-stack IoT structural-monitoring platform I built using Express, TypeScript, PostgreSQL, and React. 
> 
> Because physical bridge sensors are expensive and require hardware lab setups, I built a physics-based telemetry simulator that posts real-time readings like tilt, vibration, and water levels every 3 seconds.
> 
> On the backend, I wrote raw SQL with composite B-Tree indexing and verified performance using `EXPLAIN ANALYZE` to eliminate table scans on time-series queries. 
> 
> On the frontend, I used Socket.IO for zero-latency push updates, Leaflet for interactive GIS map status indicators, and built an automated threshold alerting pipeline that logs safety breaches and triggers email notifications."*

---

## 7. Quick Summary of Safety Limits Cheat Sheet

| Sensor Type | Safe Range | Alert Threshold | What it Means |
|---|---|---|---|
| **Tilt** | `0.1° – 1.4°` | `> 1.5°` | Structure is leaning too far |
| **Vibration** | `0.5 – 4.9 mm/s` | `> 5.0 mm/s` | Dangerous shaking or impact |
| **Displacement** | `5.0 – 19.9 mm` | `> 20.0 mm` | Joint or crack expanding dangerously |
| **Water Level** | `250 – 419 cm` | `> 420.0 cm` | Rising flood risk under the structure |
