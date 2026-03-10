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

// ─── Helpers ───────────────────────────────────────────────────────────────────
function readData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, JSON.stringify(INITIAL_DATA, null, 2));
      return INITIAL_DATA;
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);

    // Ensure the root admin is always present
    const rootAdmin = { id: 'admin-ravi', name: 'Ravi (Admin)', email: 'ravi86198701@gmail.com', role: 'admin' };
    const users = parsed.users ?? INITIAL_DATA.users;
    if (!users.some(u => u.email.toLowerCase() === 'ravi86198701@gmail.com')) {
      users.unshift(rootAdmin);
    }

    return {
      users,
      branches: parsed.branches ?? INITIAL_DATA.branches,
      rooms: parsed.rooms ?? INITIAL_DATA.rooms,
      timeSlots: parsed.timeSlots ?? INITIAL_DATA.timeSlots,
      allocations: parsed.allocations ?? [],
      logs: parsed.logs ?? [],
      settings: parsed.settings ?? {},
      notifications: parsed.notifications ?? [],
    };
  } catch (err) {
    console.error('[readData] Error:', err.message);
    return INITIAL_DATA;
  }
}

function writeData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('[writeData] Error:', err.message);
    throw err;
  }
}

function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ─── Routes ────────────────────────────────────────────────────────────────────

// GET /api/storage  →  return current data
app.get('/api/storage', (req, res) => {
  try {
    res.json(readData());
  } catch (err) {
    res.status(500).json({ error: 'Failed to read data' });
  }
});

// POST /api/storage  →  save data (body=null means full reset)
app.post('/api/storage', (req, res) => {
  try {
    const body = req.body;
    if (body === null || body === undefined || Object.keys(body).length === 0) {
      writeData(INITIAL_DATA);
    } else {
      writeData(body);
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to write data' });
  }
});

// POST /api/auth/google  →  verify Google access token and return role
app.post('/api/auth/google', async (req, res) => {
  try {
    const { idToken } = req.body; // idToken here is actually the access_token from useGoogleLogin
    if (!idToken) return res.status(400).json({ error: 'Token required' });

    // Verify the access token with Google's userinfo endpoint
    const googleRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${idToken}` },
    });

    if (!googleRes.ok) {
      return res.status(401).json({ error: 'Invalid or expired Google token.' });
    }

    const payload = await googleRes.json();
    const email = payload.email.toLowerCase();
    const name = payload.name;
    const picture = payload.picture;

    // Look up role from data.json
    const data = readData();
    const existingUser = data.users.find(u => u.email.toLowerCase() === email);

    if (existingUser) {
      // Update picture from Google if not set
      if (!existingUser.picture) {
        existingUser.picture = picture;
        if (!existingUser.name || existingUser.name === existingUser.email.split('@')[0]) {
          existingUser.name = name;
        }
        writeData(data);
      }
      return res.json({
        success: true,
        role: existingUser.role,
        user: { ...existingUser, picture },
      });
    }

    // Not found → give student role (transient, not persisted)
    return res.json({
      success: true,
      role: 'student',
      user: {
        id: 'student-' + generateId(),
        name,
        email,
        role: 'student',
        picture,
      },
    });
  } catch (err) {
    console.error('[/api/auth/google] Error:', err.message);
    res.status(401).json({ error: 'Authentication failed.' });
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
  // Ensure initial data file exists with root admin
  readData();
});
