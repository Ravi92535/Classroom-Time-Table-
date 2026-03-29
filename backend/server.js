require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();

// ─── Supabase / PostgreSQL Pool ───────────────────────────────────────────────
if (!process.env.SUPABASE_DB_URL) {
  console.error('❌  SUPABASE_DB_URL is not set.');
}

const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
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

// ─── DB Init ──────────────────────────────────────────────────────────────────
let dbReady = false;
let dbInitPromise = null;

function ensureDB() {
  if (dbReady) return Promise.resolve();
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = (async () => {
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
          updated_at TIMESTAMPTZ, branch_label TEXT, section TEXT
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

      // ─── Migrations ──────────────────────────────────────────────────────────
      // Add 'section' column if it doesn't already exist (for existing tables)
      await client.query(`
        ALTER TABLE allocations ADD COLUMN IF NOT EXISTS section TEXT;
      `);

      const { rows } = await client.query('SELECT COUNT(*) FROM users');
      if (parseInt(rows[0].count) === 0) {
        console.log('🌱  Seeding initial data...');
        await seedInitialData(client);
      }

      await client.query(`
        INSERT INTO users (id, name, email, role)
        VALUES ('admin-ravi', 'Ravi (Admin)', 'ravi86198701@gmail.com', 'admin')
        ON CONFLICT (id) DO NOTHING
      `);

      dbReady = true;
      console.log('✅  Supabase DB ready');
    } finally {
      client.release();
    }
  })().catch(err => {
    dbInitPromise = null;
    dbReady = false;
    throw err;
  });

  return dbInitPromise;
}

async function seedInitialData(client) {
  for (const u of INITIAL_DATA.users)
    await client.query(
      `INSERT INTO users (id,name,email,role,branch_id,picture) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
      [u.id, u.name, u.email, u.role, u.branchId || null, u.picture || null]
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

// ─── Read All (used for initial load + polling) ────────────────────────────────
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
        if (u.picture) obj.picture = u.picture;
        return obj;
      }),
      branches: branchesRes.rows.map(b => ({ id: b.id, name: b.name })),
      rooms: roomsRes.rows.map(r => ({ id: r.id, name: r.name })),
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
        if (a.section) obj.section = a.section;
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

function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Full read — used for initial load and polling
app.get('/api/storage', async (req, res) => {
  try {
    await ensureDB();
    res.json(await readData());
  } catch (err) {
    console.error('[GET /api/storage]', err.message);
    res.status(500).json({ error: 'Failed to read data', detail: err.message });
  }
});

// ─── Fast Reset ───────────────────────────────────────────────────────────────
// TRUNCATE wipes every table in ONE statement — no row-by-row deletes, no loops.
// Then re-seeds default data in a single batch transaction.
app.post('/api/reset', async (req, res) => {
  try {
    await ensureDB();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Wipe every table atomically in one shot
      await client.query(`
        TRUNCATE TABLE
          allocations, logs, notifications, settings,
          time_slots, rooms, branches, users
        RESTART IDENTITY CASCADE
      `);

      // Re-seed all defaults in batch INSERTs (one round-trip each)
      await client.query(`
        INSERT INTO users (id, name, email, role) VALUES
          ('admin-ravi', 'Ravi (Admin)', 'ravi86198701@gmail.com', 'admin')
        ON CONFLICT (id) DO NOTHING
      `);
      await client.query(`
        INSERT INTO branches (id, name) VALUES
          ('b1', 'CS'), ('b2', 'IT'), ('b3', 'AI/ML'), ('b4', 'Civil')
        ON CONFLICT (id) DO NOTHING
      `);
      await client.query(`
        INSERT INTO rooms (id, name) VALUES
          ('r1', 'R101'), ('r2', 'R102')
        ON CONFLICT (id) DO NOTHING
      `);
      await client.query(`
        INSERT INTO time_slots (id, start_time, end_time, label, period) VALUES
          ('s1', '07:00', '08:00', '7-8 AM',  1),
          ('s2', '08:00', '09:00', '8-9 AM',  2),
          ('s3', '09:00', '10:00', '9-10 AM', 3)
        ON CONFLICT (id) DO NOTHING
      `);

      await client.query('COMMIT');
      res.json({ success: true });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[POST /api/reset]', err.message);
    res.status(500).json({ error: 'Reset failed', detail: err.message });
  }
});

// ─── Granular Entity Endpoints (fast, surgical writes) ────────────────────────

// BRANCHES — upsert single
app.put('/api/branches', async (req, res) => {
  try {
    await ensureDB();
    const { id, name } = req.body;
    if (!id || !name) return res.status(400).json({ error: 'id and name required' });
    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO branches (id,name) VALUES ($1,$2)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
        [id, name]
      );
      res.json({ success: true });
    } finally { client.release(); }
  } catch (err) {
    console.error('[PUT /api/branches]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// BRANCHES — delete single (cascades allocations + clears user branch_id)
app.delete('/api/branches/:id', async (req, res) => {
  try {
    await ensureDB();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM allocations WHERE branch_id = $1', [req.params.id]);
      await client.query('UPDATE users SET branch_id = NULL WHERE branch_id = $1', [req.params.id]);
      await client.query('DELETE FROM branches WHERE id = $1', [req.params.id]);
      await client.query('COMMIT');
      res.json({ success: true });
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  } catch (err) {
    console.error('[DELETE /api/branches/:id]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ROOMS — upsert single
app.put('/api/rooms', async (req, res) => {
  try {
    await ensureDB();
    const { id, name } = req.body;
    if (!id || !name) return res.status(400).json({ error: 'id and name required' });
    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO rooms (id,name) VALUES ($1,$2)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
        [id, name]
      );
      res.json({ success: true });
    } finally { client.release(); }
  } catch (err) {
    console.error('[PUT /api/rooms]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ROOMS — delete single (cascades allocations)
app.delete('/api/rooms/:id', async (req, res) => {
  try {
    await ensureDB();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM allocations WHERE room_id = $1', [req.params.id]);
      await client.query('DELETE FROM rooms WHERE id = $1', [req.params.id]);
      await client.query('COMMIT');
      res.json({ success: true });
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  } catch (err) {
    console.error('[DELETE /api/rooms/:id]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// TIME SLOTS — upsert single
app.put('/api/timeslots', async (req, res) => {
  try {
    await ensureDB();
    const { id, startTime, endTime, label, period } = req.body;
    if (!id) return res.status(400).json({ error: 'id required' });
    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO time_slots (id,start_time,end_time,label,period) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (id) DO UPDATE SET
           start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time,
           label = EXCLUDED.label, period = EXCLUDED.period`,
        [id, startTime, endTime, label, period]
      );
      res.json({ success: true });
    } finally { client.release(); }
  } catch (err) {
    console.error('[PUT /api/timeslots]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// TIME SLOTS — delete single (cascades allocations)
app.delete('/api/timeslots/:id', async (req, res) => {
  try {
    await ensureDB();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM allocations WHERE slot_id = $1', [req.params.id]);
      await client.query('DELETE FROM time_slots WHERE id = $1', [req.params.id]);
      await client.query('COMMIT');
      res.json({ success: true });
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
  } catch (err) {
    console.error('[DELETE /api/timeslots/:id]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ALLOCATIONS — upsert single
app.put('/api/allocations', async (req, res) => {
  try {
    await ensureDB();
    const a = req.body;
    if (!a.id) return res.status(400).json({ error: 'id required' });
    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO allocations
           (id,day,slot_id,room_id,branch_id,subject,updated_by,updated_at,branch_label,section)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (id) DO UPDATE SET
           day          = EXCLUDED.day,
           slot_id      = EXCLUDED.slot_id,
           room_id      = EXCLUDED.room_id,
           branch_id    = EXCLUDED.branch_id,
           subject      = EXCLUDED.subject,
           updated_by   = EXCLUDED.updated_by,
           updated_at   = EXCLUDED.updated_at,
           branch_label = EXCLUDED.branch_label,
           section      = EXCLUDED.section`,
        [a.id, a.day, a.slotId, a.roomId, a.branchId, a.subject,
        a.updatedBy, a.updatedAt || new Date(), a.branchLabel || null, a.section || null]
      );
      res.json({ success: true });
    } finally { client.release(); }
  } catch (err) {
    console.error('[PUT /api/allocations]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ALLOCATIONS — batch upsert (with auto room creation)
app.post('/api/allocations/batch', async (req, res) => {
  try {
    await ensureDB();
    const { items, updatedBy } = req.body;
    if (!Array.isArray(items)) return res.status(400).json({ error: 'items array required' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      let created = 0;
      let skipped = 0;
      const skipReasons = [];

      // Fetch current rooms to map name -> id (for auto-creation)
      const { rows: existingRooms } = await client.query('SELECT id, name FROM rooms');
      const roomMap = new Map();
      existingRooms.forEach(r => roomMap.set(r.name.toLowerCase(), r.id));

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        if (!item.branchId || !item.slotId || !item.day) {
          skipped++;
          skipReasons.push(`Missing branch, slot, or day at index ${i}`);
          continue;
        }

        // Resolve or create room
        let roomId = null;
        if (item.roomName) {
            const rNameLower = item.roomName.toLowerCase();
            if (roomMap.has(rNameLower)) {
                roomId = roomMap.get(rNameLower);
            } else {
                roomId = 'r-' + generateId();
                await client.query(
                    'INSERT INTO rooms (id, name) VALUES ($1, $2)',
                    [roomId, item.roomName]
                );
                roomMap.set(rNameLower, roomId);
            }
        }

        // conflict check: same day, same timeslot, same room is not allowed
        if (roomId) {
          const conflictCheck = await client.query(
            'SELECT id FROM allocations WHERE day = $1 AND slot_id = $2 AND room_id = $3',
            [item.day, item.slotId, roomId]
          );

          if (conflictCheck.rows.length > 0) {
            skipped++;
            skipReasons.push(
              `Conflict: ${item.day} / slot ${item.slotId} / room ${item.roomName || 'unknown'} already allocated`
            );
            continue;
          }
        }

        const allocId = item.id || generateId();
        await client.query(
          `INSERT INTO allocations
             (id, day, slot_id, room_id, branch_id, subject, updated_by, updated_at, branch_label, section)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (id) DO UPDATE SET
             day          = EXCLUDED.day,
             slot_id      = EXCLUDED.slot_id,
             room_id      = EXCLUDED.room_id,
             branch_id    = EXCLUDED.branch_id,
             subject      = EXCLUDED.subject,
             updated_by   = EXCLUDED.updated_by,
             updated_at   = EXCLUDED.updated_at,
             branch_label = EXCLUDED.branch_label,
             section      = EXCLUDED.section`,
          [
            allocId, item.day, item.slotId, roomId, item.branchId, item.subject,
            updatedBy || 'ai-import', new Date(), item.branchLabel || null, item.section || null
          ]
        );
        created++;
      }

      await client.query('COMMIT');
      res.json({ success: true, created, skipped, skipReasons });
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[POST /api/allocations/batch]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ALLOCATIONS — delete single
app.delete('/api/allocations/:id', async (req, res) => {
  try {
    await ensureDB();
    const client = await pool.connect();
    try {
      await client.query('DELETE FROM allocations WHERE id = $1', [req.params.id]);
      res.json({ success: true });
    } finally { client.release(); }
  } catch (err) {
    console.error('[DELETE /api/allocations/:id]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// USERS — upsert single
app.put('/api/users', async (req, res) => {
  try {
    await ensureDB();
    const u = req.body;
    if (!u.id || !u.email) return res.status(400).json({ error: 'id and email required' });
    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO users (id,name,email,role,branch_id,picture) VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name, email = EXCLUDED.email, role = EXCLUDED.role,
           branch_id = EXCLUDED.branch_id, picture = EXCLUDED.picture`,
        [u.id, u.name, u.email, u.role, u.branchId || null, u.picture || null]
      );
      res.json({ success: true });
    } finally { client.release(); }
  } catch (err) {
    console.error('[PUT /api/users]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// USERS — delete single
app.delete('/api/users/:id', async (req, res) => {
  try {
    await ensureDB();
    const client = await pool.connect();
    try {
      await client.query('DELETE FROM users WHERE id = $1', [req.params.id]);
      res.json({ success: true });
    } finally { client.release(); }
  } catch (err) {
    console.error('[DELETE /api/users/:id]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// LOGS — batch insert (never overwrites, only appends)
app.post('/api/logs', async (req, res) => {
  try {
    await ensureDB();
    const { logs } = req.body;
    if (!Array.isArray(logs) || logs.length === 0)
      return res.status(400).json({ error: 'logs array required' });
    const client = await pool.connect();
    try {
      for (const l of logs)
        await client.query(
          `INSERT INTO logs (id,timestamp,message,user_id,user_name)
           VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
          [l.id, l.timestamp || new Date(), l.message, l.userId || '', l.userName || '']
        );
      res.json({ success: true });
    } finally { client.release(); }
  } catch (err) {
    console.error('[POST /api/logs]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Auth ──────────────────────────────────────────────────────────────────────
app.post('/api/auth/google', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: 'Token required' });

    const googleRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!googleRes.ok) return res.status(401).json({ error: 'Invalid or expired Google token.' });

    const { email: rawEmail, name, picture } = await googleRes.json();
    const email = rawEmail.toLowerCase();

    await ensureDB();

    const client = await pool.connect();
    try {
      const { rows } = await client.query('SELECT * FROM users WHERE LOWER(email) = $1', [email]);
      const existing = rows[0];

      if (existing) {
        if (!existing.picture)
          await client.query('UPDATE users SET picture=$1 WHERE id=$2', [picture, existing.id]);
        return res.json({
          success: true,
          role: existing.role,
          user: {
            id: existing.id, name: existing.name, email: existing.email,
            role: existing.role, branchId: existing.branch_id || undefined, picture,
          },
        });
      }

      return res.json({
        success: true, role: 'student',
        user: { id: 'student-' + generateId(), name, email, role: 'student', picture },
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[/api/auth/google]', err.message);
    res.status(500).json({ error: 'Authentication failed.', detail: err.message });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.url}` });
});

// ─── Export for Serverless & Local ──────────────────────────────────────────
if (require.main === module) {
  const PORT = process.env.PORT || 8000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running locally on port ${PORT}`);
  });
}

module.exports = app;
