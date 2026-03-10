const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, 'data.json');

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json({ limit: '5mb' }));

// ─── Initial / Default Data ────────────────────────────────────────────────────
const INITIAL_DATA = {
  users: [
    { id: 'admin',   name: 'Admin User',   email: 'admin@nitkkr.ac.in',   role: 'admin' },
    { id: 'student', name: 'Student User', email: 'student@nitkkr.ac.in', role: 'student' },
    { id: 't1',      name: 'CS Teacher',   email: 'cs@nitkkr.ac.in',      role: 'teacher', branchId: 'b1' },
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
    { id: 's1', startTime: '07:00', endTime: '08:00', label: '7-8 AM',   period: 1 },
    { id: 's2', startTime: '08:00', endTime: '09:00', label: '8-9 AM',   period: 2 },
    { id: 's3', startTime: '09:00', endTime: '10:00', label: '9-10 AM',  period: 3 },
  ],
  allocations: [],
  logs: [],
  settings: { viewOrientation: 'horizontal' },
  notifications: [],
};

// ─── Helpers ───────────────────────────────────────────────────────────────────
function readData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(INITIAL_DATA, null, 2));
      return INITIAL_DATA;
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    // Merge: ensure all top-level keys exist (forward-compatibility)
    return {
      users:         parsed.users         ?? INITIAL_DATA.users,
      branches:      parsed.branches      ?? INITIAL_DATA.branches,
      rooms:         parsed.rooms         ?? INITIAL_DATA.rooms,
      timeSlots:     parsed.timeSlots     ?? INITIAL_DATA.timeSlots,
      allocations:   parsed.allocations   ?? [],
      logs:          parsed.logs          ?? [],
      settings:      parsed.settings      ?? INITIAL_DATA.settings,
      notifications: parsed.notifications ?? [],
    };
  } catch (err) {
    console.error('[readData] Error reading data.json:', err.message);
    return INITIAL_DATA;
  }
}

function writeData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('[writeData] Error writing data.json:', err.message);
    throw err;
  }
}

// ─── Routes ────────────────────────────────────────────────────────────────────

// GET /api/storage  →  return current data
app.get('/api/storage', (req, res) => {
  try {
    const data = readData();
    res.json(data);
  } catch (err) {
    console.error('GET /api/storage error:', err);
    res.status(500).json({ error: 'Failed to read data' });
  }
});

// POST /api/storage  →  save data (body=null means full reset)
app.post('/api/storage', (req, res) => {
  try {
    const body = req.body;
    if (body === null || body === undefined || Object.keys(body).length === 0) {
      // Reset to initial data
      writeData(INITIAL_DATA);
    } else {
      writeData(body);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/storage error:', err);
    res.status(500).json({ error: 'Failed to write data' });
  }
});

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', port: PORT }));

// 404 catch-all
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.url}` });
});

// ─── Start Server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅  Backend running on http://localhost:${PORT}`);
  console.log(`📂  Data stored in: ${DATA_FILE}`);
});
