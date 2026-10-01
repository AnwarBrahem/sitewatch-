import express, { Request, Response } from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { pool } from './db';
import { checkAndProcessAlert, SENSOR_THRESHOLDS } from './alerts';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Track connected WebSocket clients
let connectedClientsCount = 0;
io.on('connection', (socket) => {
  connectedClientsCount++;
  console.log(`🔌 Client connected to WebSocket: ${socket.id} (Total: ${connectedClientsCount})`);

  socket.on('disconnect', () => {
    connectedClientsCount--;
    console.log(`🔌 Client disconnected: ${socket.id} (Remaining: ${connectedClientsCount})`);
  });
});

// GET /health - Server, database, and websocket connectivity ping
app.get('/health', async (_req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({
      status: 'ok',
      timestamp: result.rows[0].now,
      socketClients: connectedClientsCount,
      database: 'connected',
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', error: error.message });
  }
});

// GET /sites - List all sites with nested sensors (PostgreSQL JSON aggregation)
app.get('/sites', async (_req: Request, res: Response) => {
  try {
    const query = `
      SELECT 
        s.id, 
        s.name, 
        s.latitude, 
        s.longitude,
        COALESCE(
          json_agg(
            json_build_object(
              'id', sn.id,
              'type', sn.type,
              'unit', sn.unit
            ) ORDER BY sn.id
          ) FILTER (WHERE sn.id IS NOT NULL),
          '[]'
        ) AS sensors
      FROM sites s
      LEFT JOIN sensors sn ON s.id = sn.site_id
      GROUP BY s.id
      ORDER BY s.id;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error: any) {
    console.error('Error fetching sites:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /sensors/:id/readings - Latest N readings for one sensor (uses idx_readings_sensor_time)
app.get('/sensors/:id/readings', async (req: Request, res: Response) => {
  try {
    const idParam = req.params.id;
    const sensorId = parseInt(Array.isArray(idParam) ? idParam[0] : idParam, 10);
    const limit = parseInt(req.query.limit as string, 10) || 100;

    if (isNaN(sensorId)) {
      return res.status(400).json({ error: 'Invalid sensor ID' });
    }

    const query = `
      SELECT id, sensor_id, value, recorded_at
      FROM readings
      WHERE sensor_id = $1
      ORDER BY recorded_at DESC
      LIMIT $2;
    `;
    const result = await pool.query(query, [sensorId, limit]);
    res.json(result.rows);
  } catch (error: any) {
    console.error('Error fetching readings:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /sensors/:id/summary - 24-hour min/max/avg aggregation (Part 3)
app.get('/sensors/:id/summary', async (req: Request, res: Response) => {
  try {
    const idParam = req.params.id;
    const sensorId = parseInt(Array.isArray(idParam) ? idParam[0] : idParam, 10);
    if (isNaN(sensorId)) {
      return res.status(400).json({ error: 'Invalid sensor ID' });
    }

    const query = `
      SELECT 
        sensor_id,
        COUNT(*)::int AS count,
        ROUND(MIN(value)::numeric, 2) AS min,
        ROUND(MAX(value)::numeric, 2) AS max,
        ROUND(AVG(value)::numeric, 2) AS avg
      FROM readings
      WHERE sensor_id = $1
        AND recorded_at > now() - interval '24 hours'
      GROUP BY sensor_id;
    `;
    const result = await pool.query(query, [sensorId]);
    if (result.rows.length === 0) {
      return res.json({ sensor_id: sensorId, count: 0, min: null, max: null, avg: null });
    }
    res.json(result.rows[0]);
  } catch (error: any) {
    console.error('Error fetching sensor summary:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /thresholds - Expose configured safety limits
app.get('/thresholds', (_req: Request, res: Response) => {
  res.json(SENSOR_THRESHOLDS);
});

// POST /readings - Ingest a new reading (Parts 2, 6, 7)
app.post('/readings', async (req: Request, res: Response) => {
  try {
    const { sensorId, value } = req.body;

    if (sensorId === undefined || value === undefined) {
      return res.status(400).json({ error: 'sensorId and value are required' });
    }

    const parsedSensorId = parseInt(sensorId, 10);
    const parsedValue = parseFloat(value);

    const query = `
      INSERT INTO readings (sensor_id, value, recorded_at)
      VALUES ($1, $2, NOW())
      RETURNING id, sensor_id, value, recorded_at;
    `;
    const result = await pool.query(query, [parsedSensorId, parsedValue]);
    const reading = result.rows[0];

    // Part 7: Broadcast telemetry event to all connected dashboard websockets
    io.emit('reading:new', reading);

    // Part 6: Real-time threshold verification & alerting
    const alert = await checkAndProcessAlert(parsedSensorId, parsedValue);
    if (alert) {
      io.emit('alert:new', alert);
    }

    res.status(201).json({ reading, alertTriggered: !!alert });
  } catch (error: any) {
    console.error('Error saving reading:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /alerts - List recent threshold breaches (Part 6)
app.get('/alerts', async (_req: Request, res: Response) => {
  try {
    const query = `
      SELECT 
        a.id, 
        a.sensor_id, 
        a.value, 
        a.threshold, 
        a.triggered_at, 
        s.type, 
        s.unit, 
        st.name AS site_name
      FROM alerts a
      JOIN sensors s ON a.sensor_id = s.id
      JOIN sites st ON s.site_id = st.id
      ORDER BY a.triggered_at DESC
      LIMIT 50;
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error: any) {
    console.error('Error fetching alerts:', error);
    res.status(500).json({ error: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`🚀 SiteWatch API & WebSocket Server running on port ${PORT}`);
  console.log(`Endpoints available:`);
  console.log(` - GET  /health`);
  console.log(` - GET  /sites`);
  console.log(` - GET  /sensors/:id/readings?limit=100`);
  console.log(` - GET  /sensors/:id/summary`);
  console.log(` - GET  /thresholds`);
  console.log(` - POST /readings (with threshold alert check + WebSocket broadcast)`);
  console.log(` - GET  /alerts`);
  console.log(` - WS   socket.io live connection enabled`);
});

export { app, server, io };
