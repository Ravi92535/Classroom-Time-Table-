import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { generateId } from './utils.js';

// ─── API Configuration ─────────────────────────────────────────────────────
const API_BASE = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
  ? 'https://classroom-time-table.vercel.app'
  : 'http://localhost:3001';

// How often the public timetable / student page re-fetches fresh data (ms)
const POLL_INTERVAL = 15000; // 15 seconds

// ─── Days of the week ─────────────────────────────────────────────────────────
export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ─── Initial / Default State ──────────────────────────────────────────────────
const INITIAL_USERS = [
  { id: 'admin-ravi', name: 'Ravi (Admin)', email: 'ravi86198701@gmail.com', role: 'admin' },
];
const INITIAL_BRANCHES = [
  { id: 'b1', name: 'CS' },
  { id: 'b2', name: 'IT' },
  { id: 'b3', name: 'AI/ML' },
  { id: 'b4', name: 'Civil' },
];
const INITIAL_ROOMS = [
  { id: 'r1', name: 'R101' },
  { id: 'r2', name: 'R102' },
];
const INITIAL_SLOTS = [
  { id: 's1', startTime: '07:00', endTime: '08:00', label: '7-8 AM', period: 1 },
  { id: 's2', startTime: '08:00', endTime: '09:00', label: '8-9 AM', period: 2 },
  { id: 's3', startTime: '09:00', endTime: '10:00', label: '9-10 AM', period: 3 },
];

// ─── Per-user localStorage helpers ───────────────────────────────────────────
function orientationKey(userId) { return `room_view_orientation_${userId || 'guest'}`; }
function loadOrientation(userId) {
  try { return localStorage.getItem(orientationKey(userId)) || 'horizontal'; }
  catch { return 'horizontal'; }
}
function saveOrientation(userId, value) {
  try { localStorage.setItem(orientationKey(userId), value); } catch { }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}
function timesOverlap(s1, e1, s2, e2) {
  return toMinutes(s1) < toMinutes(e2) && toMinutes(s2) < toMinutes(e1);
}

// ─── Context ──────────────────────────────────────────────────────────────────
const StoreContext = createContext(undefined);

export function StoreProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('room_system_user');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });
  const [users,         setUsers]         = useState(INITIAL_USERS);
  const [branches,      setBranches]      = useState(INITIAL_BRANCHES);
  const [rooms,         setRooms]         = useState(INITIAL_ROOMS);
  const [timeSlots,     setTimeSlots]     = useState(INITIAL_SLOTS);
  const [allocations,   setAllocations]   = useState([]);
  const [logs,          setLogs]          = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [isLoaded,      setIsLoaded]      = useState(false);
  const [viewOrientation, setViewOrientation] = useState('horizontal');
  const settings = { viewOrientation };

  // Track whether we're currently saving so polling doesn't overwrite in-flight changes
  const isSaving = useRef(false);

  useEffect(() => {
    setViewOrientation(loadOrientation(currentUser?.id));
  }, [currentUser?.id]);

  // ── Fetch helper (used by initial load + polling) ─────────────────────────
  const fetchData = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/storage`);
      if (!res.ok) throw new Error('Failed to fetch');
      const parsed = await res.json();
      if (parsed) {
        setUsers(parsed.users               || INITIAL_USERS);
        setBranches(parsed.branches         || INITIAL_BRANCHES);
        setRooms(parsed.rooms               || INITIAL_ROOMS);
        setTimeSlots(parsed.timeSlots       || INITIAL_SLOTS);
        setAllocations(parsed.allocations   || []);
        setLogs(parsed.logs                 || []);
        setNotifications(parsed.notifications || []);
      }
    } catch (err) {
      console.error('[Store] Failed to load:', err);
    }
  };

  // ── Initial load on mount ────────────────────────────────────────────────
  useEffect(() => {
    fetchData().finally(() => setIsLoaded(true));
  }, []);

  // ── Polling: re-fetch every 15 seconds to keep timetable fresh ───────────
  useEffect(() => {
    const interval = setInterval(() => {
      // Skip poll if we're in the middle of saving to avoid overwriting
      if (!isSaving.current) {
        fetchData();
      }
    }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  // ── Auto-save to backend (debounced 500 ms) ───────────────────────────────
  useEffect(() => {
    if (!isLoaded) return;
    isSaving.current = true;
    const timer = setTimeout(() => {
      fetch(`${API_BASE}/api/storage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          users, branches, rooms, timeSlots,
          allocations, logs, settings: {}, notifications,
        }),
      })
        .catch(err => console.error('[Store] Failed to save:', err))
        .finally(() => { isSaving.current = false; });
    }, 500);
    return () => clearTimeout(timer);
  }, [users, branches, rooms, timeSlots, allocations, logs, notifications, isLoaded]);

  // ─── Log helper ───────────────────────────────────────────────────────────
  const addLog = (message) => {
    setLogs(prev => {
      if (!currentUser) return prev;
      return [{
        id: generateId(), timestamp: new Date().toISOString(),
        message, userId: currentUser.id, userName: currentUser.name,
      }, ...prev];
    });
  };

  // ─── Google Login ─────────────────────────────────────────────────────────
  const loginWithGoogle = async (idToken) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const data = await res.json();
      if (!res.ok || !data.success)
        return { success: false, error: data.error || 'Authentication failed.' };
      setCurrentUser(data.user);
      localStorage.setItem('room_system_user', JSON.stringify(data.user));
      return { success: true, role: data.role };
    } catch (err) {
      console.error('[loginWithGoogle]', err);
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('room_system_user');
  };

  // ─── Settings ─────────────────────────────────────────────────────────────
  const updateSettings = (partial) => {
    if ('viewOrientation' in partial) {
      setViewOrientation(partial.viewOrientation);
      saveOrientation(currentUser?.id, partial.viewOrientation);
    }
  };

  // ─── Notifications ────────────────────────────────────────────────────────
  const addNotification = (message, type = 'info') => {
    setNotifications(prev => [{
      id: generateId(), message, type,
      timestamp: new Date().toISOString(), isRead: false,
    }, ...prev]);
  };
  const clearNotifications = () => setNotifications([]);

  // ─── Branch CRUD ──────────────────────────────────────────────────────────
  const addBranch = (name) => {
    if (currentUser?.role !== 'admin') return;
    if (branches.some(b => b.name.toLowerCase() === name.toLowerCase())) {
      alert(`A branch named "${name}" already exists.`); return;
    }
    setBranches(prev => [...prev, { id: generateId(), name }]);
    addLog(`Added branch: ${name}`);
  };
  const removeBranch = (id) => {
    if (currentUser?.role !== 'admin') return;
    setBranches(prev => prev.filter(b => b.id !== id));
    setUsers(prev => prev.filter(u => !(u.role === 'teacher' && u.branchId === id)));
    setAllocations(prev => prev.filter(a => a.branchId !== id));
    addLog(`Removed branch ${id} and its teachers/allocations`);
  };

  // ─── Room CRUD ────────────────────────────────────────────────────────────
  const addRoom = (name) => {
    if (currentUser?.role !== 'admin') return;
    if (rooms.some(r => r.name.toLowerCase() === name.toLowerCase())) {
      alert(`A room named "${name}" already exists.`); return;
    }
    setRooms(prev => [...prev, { id: generateId(), name }]);
    addLog(`Added room: ${name}`);
  };
  const removeRoom = (id) => {
    if (currentUser?.role !== 'admin') return;
    setRooms(prev => prev.filter(r => r.id !== id));
    setAllocations(prev => prev.filter(a => a.roomId !== id));
    addLog(`Removed room ${id} and its allocations`);
  };

  // ─── TimeSlot CRUD ────────────────────────────────────────────────────────
  const addTimeSlot = (startTime, endTime, period) => {
    if (currentUser?.role !== 'admin') return { success: false, error: 'Not authorised.' };
    const periodNum = Number(period);
    if (toMinutes(startTime) >= toMinutes(endTime))
      return { success: false, error: 'Start time must be before end time.' };
    if (timeSlots.some(s => s.period === periodNum))
      return { success: false, error: `Period ${periodNum} already exists.` };
    const conflict = timeSlots.find(s => timesOverlap(startTime, endTime, s.startTime, s.endTime));
    if (conflict)
      return { success: false, error: `Time overlaps with Period ${conflict.period} (${conflict.label}).` };
    const label = `${startTime} - ${endTime}`;
    setTimeSlots(prev =>
      [...prev, { id: generateId(), startTime, endTime, label, period: periodNum }]
        .sort((a, b) => a.period - b.period)
    );
    addLog(`Added period ${periodNum}: ${label}`);
    return { success: true };
  };
  const removeTimeSlot = (id) => {
    if (currentUser?.role !== 'admin') return;
    setTimeSlots(prev => prev.filter(s => s.id !== id));
    setAllocations(prev => prev.filter(a => a.slotId !== id));
    addLog(`Removed time slot ${id}`);
  };

  // ─── Teacher CRUD ─────────────────────────────────────────────────────────
  const addTeacher = (name, email, branchId) => {
    if (currentUser?.role !== 'admin' || !email || !branchId) return;
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      alert(`A user with email "${email}" already exists.`); return;
    }
    const displayName = name || email.split('@')[0];
    setUsers(prev => [...prev, {
      id: generateId(), name: displayName, email: email.toLowerCase(), role: 'teacher', branchId,
    }]);
    addLog(`Added teacher: ${displayName} (${email})`);
  };
  const removeTeacher = (id) => {
    if (currentUser?.role !== 'admin') return;
    setUsers(prev => prev.filter(u => u.id !== id));
    addLog(`Removed teacher ${id}`);
  };

  // ─── Admin CRUD ───────────────────────────────────────────────────────────
  const addAdmin = (name, email) => {
    if (currentUser?.role !== 'admin') return;
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      alert(`A user with email "${email}" already exists.`); return;
    }
    const displayName = name || email.split('@')[0];
    setUsers(prev => [...prev, {
      id: generateId(), name: displayName, email: email.toLowerCase(), role: 'admin',
    }]);
    addLog(`Added admin: ${displayName} (${email})`);
  };
  const removeAdmin = (id) => {
    if (currentUser?.role !== 'admin') return;
    if (users.filter(u => u.role === 'admin').length <= 1) {
      alert('Cannot remove the last admin user.'); return;
    }
    setUsers(prev => prev.filter(u => u.id !== id));
    addLog(`Removed admin ${id}`);
  };

  // ─── Allocation CRUD ──────────────────────────────────────────────────────
  const setAllocation = (day, slotId, roomId, branchId) => {
    if (currentUser?.role !== 'admin') return;
    const branch = branches.find(b => b.id === branchId);
    if (!branch) return;
    setAllocations(prev => [
      ...prev.filter(a => !(a.day === day && a.slotId === slotId && a.roomId === roomId)),
      {
        id: generateId(), day, slotId, roomId, branchId, subject: branch.name,
        updatedBy: currentUser.id, updatedAt: new Date().toISOString(),
      },
    ]);
    addLog(`Allocated ${branch.name} → ${day}, slot ${slotId}, room ${roomId}`);
  };
  const removeAllocation = (allocationId) => {
    if (currentUser?.role !== 'admin') return;
    setAllocations(prev => prev.filter(a => a.id !== allocationId));
    addLog(`Removed allocation ${allocationId}`);
  };
  const updateAllocationSubject = (allocationId, newSubject, newBranchLabel) => {
    if (!currentUser) return;
    const allocation = allocations.find(a => a.id === allocationId);
    if (!allocation) return;
    if (currentUser.role === 'teacher') {
      if (!currentUser.branchId) { alert('No branch assigned. Contact admin.'); return; }
      if (currentUser.branchId !== allocation.branchId) { alert('You can only edit your own branch slots.'); return; }
    } else if (currentUser.role !== 'admin') return;
    setAllocations(prev => prev.map(a =>
      a.id === allocationId
        ? {
            ...a, subject: newSubject,
            branchLabel: newBranchLabel !== undefined ? newBranchLabel : a.branchLabel,
            updatedBy: currentUser.id, updatedAt: new Date().toISOString(),
          }
        : a
    ));
    const branch = branches.find(b => b.id === allocation.branchId);
    addLog(`Updated slot: "${newSubject}" (${newBranchLabel ?? branch?.name})`);
    addNotification(`📝 ${branch?.name} - ${allocation.day} updated: '${newSubject}'`, 'info');
  };

  // ─── Reset All Data ───────────────────────────────────────────────────────
  const resetData = async () => {
    try {
      await fetch(`${API_BASE}/api/storage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(null),
      });
      setUsers(INITIAL_USERS);
      setBranches(INITIAL_BRANCHES);
      setRooms(INITIAL_ROOMS);
      setTimeSlots(INITIAL_SLOTS);
      setAllocations([]);
      setLogs([]);
      setNotifications([]);
    } catch (err) {
      console.error('[Store] resetData failed:', err);
    }
  };

  return (
    <StoreContext.Provider value={{
      currentUser, users, branches, rooms, timeSlots, allocations, logs, settings, notifications,
      loginWithGoogle, logout,
      addBranch, removeBranch,
      addRoom, removeRoom,
      addTimeSlot, removeTimeSlot,
      addTeacher, removeTeacher,
      addAdmin, removeAdmin,
      updateSettings,
      setAllocation, removeAllocation, updateAllocationSubject,
      addNotification, clearNotifications,
      resetData,
    }}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
