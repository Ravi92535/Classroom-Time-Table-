/**
 * migrate.js  —  One-time migration: data.json → Supabase (PostgreSQL)
 *
 * Usage (run once, from your terminal):
 *   SUPABASE_DB_URL="postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres" node migrate.js
 *
 * Fully idempotent — safe to run multiple times.
 */

const { Pool } = require('pg');
const fs       = require('fs');
const path     = require('path');

if (!process.env.SUPABASE_DB_URL) {
  console.error('❌  Set SUPABASE_DB_URL before running this script.');
  console.error('    Example:');
  console.error('    SUPABASE_DB_URL="postgresql://postgres:password@db.xxxx.supabase.co:5432/postgres" node migrate.js');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL,
  ssl: { rejectUnauthorized: false }, // Required for Supabase
});

const DATA_FILE = path.join(__dirname, 'data.json');

async function migrate() {
  if (!fs.existsSync(DATA_FILE)) {
    console.error('❌  data.json not found at', DATA_FILE);
    process.exit(1);
  }

  console.log('📂  Reading data.json...');
  const data   = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ── Create tables ──────────────────────────────────────────────────────────
    console.log('🏗️   Creating tables (if they don\'t exist)...');
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

    // ── Migrate each collection ────────────────────────────────────────────────
    let count;

    count = 0;
    for (const u of (data.users || [])) {
      await client.query(`
        INSERT INTO users (id,name,email,role,branch_id,picture)
        VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT (id) DO UPDATE SET
          name=EXCLUDED.name, email=EXCLUDED.email, role=EXCLUDED.role,
          branch_id=EXCLUDED.branch_id, picture=EXCLUDED.picture
      `, [u.id, u.name, u.email, u.role, u.branchId||null, u.picture||null]);
      count++;
    }
    console.log(`  ✔ users         : ${count}`);

    count = 0;
    for (const b of (data.branches || [])) {
      await client.query(
        'INSERT INTO branches (id,name) VALUES ($1,$2) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name',
        [b.id, b.name]
      );
      count++;
    }
    console.log(`  ✔ branches      : ${count}`);

    count = 0;
    for (const r of (data.rooms || [])) {
      await client.query(
        'INSERT INTO rooms (id,name) VALUES ($1,$2) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name',
        [r.id, r.name]
      );
      count++;
    }
    console.log(`  ✔ rooms         : ${count}`);

    count = 0;
    for (const ts of (data.timeSlots || [])) {
      await client.query(`
        INSERT INTO time_slots (id,start_time,end_time,label,period)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (id) DO UPDATE SET
          start_time=EXCLUDED.start_time, end_time=EXCLUDED.end_time,
          label=EXCLUDED.label, period=EXCLUDED.period
      `, [ts.id, ts.startTime, ts.endTime, ts.label, ts.period]);
      count++;
    }
    console.log(`  ✔ timeSlots     : ${count}`);

    count = 0;
    for (const a of (data.allocations || [])) {
      await client.query(`
        INSERT INTO allocations (id,day,slot_id,room_id,branch_id,subject,updated_by,updated_at,branch_label)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        ON CONFLICT (id) DO UPDATE SET
          day=EXCLUDED.day, slot_id=EXCLUDED.slot_id, room_id=EXCLUDED.room_id,
          branch_id=EXCLUDED.branch_id, subject=EXCLUDED.subject,
          updated_by=EXCLUDED.updated_by, updated_at=EXCLUDED.updated_at,
          branch_label=EXCLUDED.branch_label
      `, [a.id, a.day, a.slotId, a.roomId, a.branchId, a.subject,
          a.updatedBy, a.updatedAt||new Date(), a.branchLabel||null]);
      count++;
    }
    console.log(`  ✔ allocations   : ${count}`);

    count = 0;
    for (const l of (data.logs || [])) {
      await client.query(`
        INSERT INTO logs (id,timestamp,message,user_id,user_name)
        VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING
      `, [l.id, l.timestamp||new Date(), l.message, l.userId, l.userName]);
      count++;
    }
    console.log(`  ✔ logs          : ${count}`);

    count = 0;
    for (const n of (data.notifications || [])) {
      await client.query(`
        INSERT INTO notifications (id,message,type,timestamp,is_read)
        VALUES ($1,$2,$3,$4,$5)
        ON CONFLICT (id) DO UPDATE SET
          message=EXCLUDED.message, type=EXCLUDED.type,
          timestamp=EXCLUDED.timestamp, is_read=EXCLUDED.is_read
      `, [n.id, n.message, n.type, n.timestamp||new Date(), n.isRead??false]);
      count++;
    }
    console.log(`  ✔ notifications : ${count}`);

    await client.query('COMMIT');
    console.log('\n✅  Migration complete! Your data is now in Supabase.');
    console.log('    You can now delete data.json from the project.\n');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌  Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
