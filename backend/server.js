require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const { Pool } = require('pg');

const app  = express();
const PORT = process.env.PORT || 3001;

// ─── Supabase / PostgreSQL Pool ───────────────────────────────────────────────
if (!process.env.SUPABASE_DB_URL) {
  console.error('❌  SUPABASE_DB_URL is not set.');
}

const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '5mb' }));

// ─── Seed / Default Data ───────────────────────────────────────────────────────
const INITIAL_DATA = {
  users: [
    { id: 'admin-ravi', name: 'Ravi (Admin)', email: 'ravi86198701@gmail.com', role: 'admin' },
  ],
  branches: [
    { id: 'b1', name: 'CS' },
    { id: 'b2', name: 'IT' },
    { id: 'b3', name: 'AI/ML' },
    { id: 'b4', name: 'Civil' },
  ],
  rooms: [
    { id: 'r1', name: 'R101' },
    { id: 'r2', name: 'R102' },
  ],
  timeSlots: [
    { id: 's1', startTime: '07:00', endTime: '08:00', label: '7-8 AM', period: 1 },
    { id: 's2', startTime: '08:00', endTime: '09:00', label: '8-9 AM', period: 2 },
    { id: 's3', startTime: '09:00', endTime: '10:00', label: '9-10 AM', period: 3 },
  ],
  allocations: [],
  logs: [],
  settings: {},
  notifications: [],
};

// ─── DB Initialisation ─────────────────────────────────────────────────────────
let dbInitialised = false;

async function initDB() {
  if (dbInitialised) return;           // Only run once per serverless instance
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, name TEXT, email TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL DEFAULT 'student', branch_id TEXT, picture TEXT
      );
      CREATE TABLE IF NOT EXISTS branches (id TEXT PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS rooms    (id TEXT PRIMARY KEY, name TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS time_slots (
        id TEXT PRIMARY KEY, start_time TEXT, end_time TEXT, label TEXT, period INT
      );
      CREATE TABLE IF NOT EXISTS allocations (
        id TEXT PRIMARY KEY, day TEXT, slot_id TEXT, room_id TEXT,
        branch_id TEXT, subject TEXT, updated_by TEXT,
        updated_at TIMESTAMPTZ, branch_label TEXT
      );
      CREATE TABLE IF NOT EXISTS logs (
        id TEXT PRIMARY KEY, timestamp TIMESTAMPTZ,
        message TEXT, user_id TEXT, user_name TEXT
      );
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY, message TEXT, type TEXT,
        timestamp TIMESTAMPTZ, is_read BOOLEAN DEFAULT false
      );
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value JSONB);
    `);

    const { rows } = await client.query('SELECT COUNT(*) FROM users');
    if (parseInt(rows[0].count) === 0) {
      await seedInitialData(client);
    }

    // Always ensure root admin exists
    await client.query(`
      INSERT INTO users (id, name, email, role)
      VALUES ('admin-ravi', 'Ravi (Admin)', 'ravi86198701@gmail.com', 'admin')
      ON CONFLICT (id) DO NOTHING
    `);

    dbInitialised = true;
    console.log('✅  Supabase DB ready');
  } finally {
    client.release();
  }
}

async function seedInitialData(client) {
  for (const u of INITIAL_DATA.users)
    await client.query(
      `INSERT INTO users (id,name,email,role,branch_id,picture) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
      [u.id, u.name, u.email, u.role, u.branchId||null, u.picture||null]
    );
  for (const b of INITIAL_DATA.branches)
    await client.query('INSERT INTO branches (id,name) VALUES ($1,$2) ON CONFLICT DO NOTHING', [b.id, b.name]);
  for (const r of INITIAL_DATA.rooms)
    await client.query('INSERT INTO rooms (id,name) VALUES ($1,$2) ON CONFLICT DO NOTHING', [r.id, r.name]);
  for (const ts of INITIAL_DATA.timeSlots)
    await client.query(
      `INSERT INTO time_slots (id,start_time,end_time,label,period) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING`,
      [ts.id, ts.startTime, ts.endTime, ts.label, ts.period]
    );
}

// ─── Read All ─────────────────────────────────────────────────────────────────
async function readData() {
  const client = await pool.connect();
  try {
    const [usersRes, branchesRes, roomsRes, timeSlotsRes,
           allocationsRes, logsRes, notificationsRes, settingsRes] = await Promise.all([
      client.query('SELECT * FROM users         ORDER BY id'),
      client.query('SELECT * FROM branches      ORDER BY id'),
      client.query('SELECT * FROM rooms         ORDER BY id'),
      client.query('SELECT * FROM time_slots    ORDER BY period, id'),
      client.query('SELECT * FROM allocations   ORDER BY updated_at DESC'),
      client.query('SELECT * FROM logs          ORDER BY timestamp DESC LIMIT 500'),
      client.query('SELECT * FROM notifications ORDER BY timestamp DESC LIMIT 200'),
      client.query('SELECT key, value FROM settings'),
    ]);

    const settingsObj = {};
    for (const row of settingsRes.rows) settingsObj[row.key] = row.value;

    return {
      users: usersRes.rows.map(u => {
        const obj = { id: u.id, name: u.name, email: u.email, role: u.role };
        if (u.branch_id) obj.branchId = u.branch_id;
        if (u.picture)   obj.picture  = u.picture;
        return obj;
      }),
      branches:  branchesRes.rows.map(b  => ({ id: b.id, name: b.name })),
      rooms:     roomsRes.rows.map(r     => ({ id: r.id, name: r.name })),
      timeSlots: timeSlotsRes.rows.map(ts => ({
        id: ts.id, startTime: ts.start_time, endTime: ts.end_time,
        label: ts.label, period: ts.period,
      })),
      allocations: allocationsRes.rows.map(a => {
        const obj = {
          id: a.id, day: a.day, slotId: a.slot_id, roomId: a.room_id,
          branchId: a.branch_id, subject: a.subject,
          updatedBy: a.updated_by, updatedAt: a.updated_at,
        };
        if (a.branch_label) obj.branchLabel = a.branch_label;
        return obj;
      }),
      logs: logsRes.rows.map(l => ({
        id: l.id, timestamp: l.timestamp, message: l.message,
        userId: l.user_id, userName: l.user_name,
      })),
      notifications: notificationsRes.rows.map(n => ({
        id: n.id, message: n.message, type: n.type,
        timestamp: n.timestamp, isRead: n.is_read,
      })),
      settings: settingsObj,
    };
  } finally {
    client.release();
  }
}

// ─── Write All ────────────────────────────────────────────────────────────────
async function writeData(data) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (Array.isArray(data.users) && data.users.length > 0) {
      await client.query(`DELETE FROM users WHERE id != ALL($1::text[])`, [data.users.map(u => u.id)]);
      for (const u of data.users)
        await client.query(`
          INSERT INTO users (id,name,email,role,branch_id,picture) VALUES ($1,$2,$3,$4,$5,$6)
          ON CONFLICT (id) DO UPDATE SET
            name=EXCLUDED.name, email=EXCLUDED.email, role=EXCLUDED.role,
            branch_id=EXCLUDED.branch_id, picture=EXCLUDED.picture
        `, [u.id, u.name, u.email, u.role, u.branchId||null, u.picture||null]);
    }

    if (Array.isArray(data.branches)) {
      await client.query('DELETE FROM branches');
      for (const b of data.branches)
        await client.query('INSERT INTO branches (id,name) VALUES ($1,$2)', [b.id, b.name]);
    }

    if (Array.isArray(data.rooms)) {
      await client.query('DELETE FROM rooms');
      for (const r of data.rooms)
        await client.query('INSERT INTO rooms (id,name) VALUES ($1,$2)', [r.id, r.name]);
    }

    if (Array.isArray(data.timeSlots)) {
      await client.query('DELETE FROM time_slots');
      for (const ts of data.timeSlots)
        await client.query(
          `INSERT INTO time_slots (id,start_time,end_time,label,period) VALUES ($1,$2,$3,$4,$5)`,
          [ts.id, ts.startTime, ts.endTime, ts.label, ts.period]
        );
    }

    if (Array.isArray(data.allocations)) {
      await client.query('DELETE FROM allocations');
      for (const a of data.allocations)
        await client.query(`
          INSERT INTO allocations
            (id,day,slot_id,room_id,branch_id,subject,updated_by,updated_at,branch_label)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        `, [a.id, a.day, a.slotId, a.roomId, a.branchId, a.subject,
            a.updatedBy, a.updatedAt||new Date(), a.branchLabel||null]);
    }

    if (Array.isArray(data.logs))
      for (const l of data.logs)
        await client.query(`
          INSERT INTO logs (id,timestamp,message,user_id,user_name)
          VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING
        `, [l.id, l.timestamp||new Date(), l.message, l.userId, l.userName]);

    if (Array.isArray(data.notifications)) {
      await client.query('DELETE FROM notifications');
      for (const n of data.notifications)
        await client.query(
          `INSERT INTO notifications (id,message,type,timestamp,is_read) VALUES ($1,$2,$3,$4,$5)`,
          [n.id, n.message, n.type, n.timestamp||new Date(), n.isRead??false]
        );
    }

    if (data.settings && typeof data.settings === 'object') {
      await client.query('DELETE FROM settings');
      for (const [key, value] of Object.entries(data.settings))
        await client.query('INSERT INTO settings (key,value) VALUES ($1,$2)', [key, JSON.stringify(value)]);
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ─── Middleware: init DB before every request ──────────────────────────────────
// Vercel serverless functions have no persistent boot — we init lazily.
app.use(async (req, res, next) => {
  try {
    await initDB();
    next();
  } catch (err) {
    console.error('DB init error:', err.message);
    res.status(500).json({ error: 'Database initialisation failed', detail: err.message });
  }
});

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/api/storage', async (req, res) => {
  try { res.json(await readData()); }
  catch (err) {
    console.error('[GET /api/storage]', err.message);
    res.status(500).json({ error: 'Failed to read data', detail: err.message });
  }
});

app.post('/api/storage', async (req, res) => {
  try {
    const body = req.body;
    await writeData(!body || Object.keys(body).length === 0 ? INITIAL_DATA : body);
    res.json({ success: true });
  } catch (err) {
    console.error('[POST /api/storage]', err.message);
    res.status(500).json({ error: 'Failed to write data', detail: err.message });
  }
});

app.post('/api/auth/google', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: 'Token required' });

    const googleRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!googleRes.ok) return res.status(401).json({ error: 'Invalid or expired Google token.' });

    const { email: rawEmail, name, picture } = await googleRes.json();
    const email  = rawEmail.toLowerCase();
    const client = await pool.connect();
    try {
      const { rows } = await client.query('SELECT * FROM users WHERE LOWER(email) = $1', [email]);
      const existing = rows[0];
      if (existing) {
        if (!existing.picture)
          await client.query('UPDATE users SET picture=$1 WHERE id=$2', [picture, existing.id]);
        return res.json({
          success: true, role: existing.role,
          user: {
            id: existing.id, name: existing.name, email: existing.email,
            role: existing.role, branchId: existing.branch_id||undefined, picture,
          },
        });
      }
      return res.json({
        success: true, role: 'student',
        user: { id: 'student-' + generateId(), name, email, role: 'student', picture },
      });
    } finally { client.release(); }
  } catch (err) {
    console.error('[/api/auth/google]', err.message);
    res.status(401).json({ error: 'Authentication failed.', detail: err.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.url}` });
});

// ─── Export for Vercel (NO app.listen) ────────────────────────────────────────
// Vercel calls this file as a serverless function — never use app.listen() here.
// For local dev, run:  node localServer.js
module.exports = app;
