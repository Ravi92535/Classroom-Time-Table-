# 🏫 Room Allocation System

A full-stack Room Allocation app — **React** frontend + **Node.js / Express** backend.

---

## 📁 Project Structure

```
roomsystem/
├── backend/          ← Express API server
│   ├── server.js
│   ├── data.json     ← All data stored here (auto-created)
│   └── package.json
└── frontend/         ← Vite + React app
    ├── src/
    │   ├── App.jsx
    │   ├── lib/
    │   │   ├── store.jsx   ← Global state (React Context)
    │   │   └── utils.js
    │   ├── components/
    │   └── pages/
    ├── index.html
    └── package.json
```

---

## 🚀 How to Run

### 1. Backend

```bash
cd roomsystem/backend
npm install
npm run dev        # uses nodemon (auto-restart on file change)
# OR
npm start          # plain node
```

The backend runs on **http://localhost:3001**

### 2. Frontend

Open a **new terminal**:

```bash
cd roomsystem/frontend
npm install
npm run dev
```

The frontend runs on **http://localhost:5173**

> Vite automatically proxies `/api/*` → `http://localhost:3001`, so no CORS issues.

---

## 🔐 Login Credentials

| Role    | Email                | Password |
|---------|----------------------|----------|
| Admin   | admin@gmail.com      | 1234     |
| Teacher | teacher@gmail.com    | 1234     |
| Student | student@gmail.com    | 1234     |

---

## ✨ Features

- **Admin**: Manage rooms, branches, time periods, teachers. Allocate classes to rooms per slot. View system logs.
- **Teacher**: View timetable, edit subject/activity for their branch's slots.
- **Student**: Read-only view of the full timetable.
- **Public Timetable** (`/timetable`): No login needed.
- Data is **persisted** in `backend/data.json`.
- Toggle between **Horizontal / Vertical** timetable orientation.
- **Notification center** for timetable updates.

---

## 🐛 Bugs Fixed (vs original)

1. **Missing `roomId` on allocations** – all allocations now properly track which room they belong to.
2. **Missing `period` on time slots** – periods are always saved and sorted correctly.
3. **Teacher branch guard** – teachers without an assigned branch get a clear error instead of a silent failure.
4. **Duplicate rooms/branches** – prevented with a case-insensitive name check.
5. **Reset data** – properly resets to initial state both in-memory and on disk.
6. **Enter key** – pressing Enter in input fields now triggers the add action.
# Classroom-Time-Table-
