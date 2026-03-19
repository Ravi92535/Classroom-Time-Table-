import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { generateId } from './utils.js';

// ─── API ───────────────────────────────────────────────────────────────────────
const API_BASE = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
  ? 'https://classroom-time-table.vercel.app'
  : 'http://localhost:3001';

const POLL_INTERVAL = 2000; // 2 s — faster updates for other roles/tabs
const SAVE_DEBOUNCE = 150;  // 0.15 s — faster response for admin changes while still batching
const STORAGE_SYNC_KEY = 'room_system_sync_timestamp';
const BROADCAST_CHANNEL = 'room_system_sync_channel';

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ─── Defaults ─────────────────────────────────────────────────────────────────
const INITIAL_USERS    = [{ id: 'admin-ravi', name: 'Ravi (Admin)', email: 'ravi86198701@gmail.com', role: 'admin' }];
const INITIAL_BRANCHES = [{ id: 'b1', name: 'CS' }, { id: 'b2', name: 'IT' }, { id: 'b3', name: 'AI/ML' }, { id: 'b4', name: 'Civil' }];
const INITIAL_ROOMS    = [{ id: 'r1', name: 'R101' }, { id: 'r2', name: 'R102' }];
const INITIAL_SLOTS    = [
  { id: 's1', startTime: '07:00', endTime: '08:00', label: '7-8 AM', period: 1 },
  { id: 's2', startTime: '08:00', endTime: '09:00', label: '8-9 AM', period: 2 },
  { id: 's3', startTime: '09:00', endTime: '10:00', label: '9-10 AM', period: 3 },
];

// ─── localStorage helpers ─────────────────────────────────────────────────────
const orientationKey = (id) => `room_view_orientation_${id || 'guest'}`;
function loadOrientation(id)    { try { return localStorage.getItem(orientationKey(id)) || 'horizontal'; } catch { return 'horizontal'; } }
function saveOrientation(id, v) { try { localStorage.setItem(orientationKey(id), v); } catch { } }

// ─── Time helpers ─────────────────────────────────────────────────────────────
const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const overlaps = (s1, e1, s2, e2) => toMin(s1) < toMin(e2) && toMin(s2) < toMin(e1);

// ─── Context ──────────────────────────────────────────────────────────────────
const StoreContext = createContext(undefined);

export function StoreProvider({ children }) {
  const [currentUser,   setCurrentUser]   = useState(() => { try { const s = localStorage.getItem('room_system_user'); return s ? JSON.parse(s) : null; } catch { return null; } });
  const [users,         setUsers]         = useState([]);
  const [branches,      setBranches]      = useState([]);
  const [rooms,         setRooms]         = useState([]);
  const [timeSlots,     setTimeSlots]     = useState([]);
  const [allocations,   setAllocations]   = useState([]);
  const [logs,          setLogs]          = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [isLoaded,      setIsLoaded]      = useState(false);
  const [viewOrientation, setViewOrientation] = useState('horizontal');
  const settings = { viewOrientation };

  // ── THE KEY FIX: always-current snapshot ref ──────────────────────────────
  // Every render updates this ref so scheduleSave ALWAYS reads fresh state,
  // never a stale closure.
  const stateRef = useRef({});
  useEffect(() => {
    stateRef.current = { users, branches, rooms, timeSlots, allocations, logs, notifications };
  });

  // Save-gate refs — prevent poll from clobbering an in-flight save
  const pendingSave  = useRef(false);
  const isSavingNow  = useRef(false);
  const saveTimer    = useRef(null);

  useEffect(() => { setViewOrientation(loadOrientation(currentUser?.id)); }, [currentUser?.id]);

  // ── fetch & apply ─────────────────────────────────────────────────────────
  const applyData = useCallback((d) => {
    if (!d) return;
    setUsers(d.users               || INITIAL_USERS);
    setBranches(d.branches         || INITIAL_BRANCHES);
    setRooms(d.rooms               || INITIAL_ROOMS);
    setTimeSlots(d.timeSlots       || INITIAL_SLOTS);
    setAllocations(d.allocations   || []);
    setLogs(d.logs                 || []);
    // ✅ Don't sync notifications - keep them in-memory only
    // setNotifications(d.notifications || []);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/storage`);
      if (!res.ok) throw new Error('bad response');
      applyData(await res.json());
    } catch (e) { console.error('[Store] fetch:', e.message); }
  }, [applyData]);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => { fetchData().finally(() => setIsLoaded(true)); }, []);

  // ── Cross-tab sync via localStorage + BroadcastChannel (instant) ─────
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key !== STORAGE_SYNC_KEY) return;
      if (pendingSave.current || isSavingNow.current) return;
      fetchData().catch(e => console.error('[Store] fetch on storage event:', e.message));
    };

    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(BROADCAST_CHANNEL) : null;
    const onBroadcast = (messageEvent) => {
      if (messageEvent.data !== 'sync') return;
      if (pendingSave.current || isSavingNow.current) return;
      fetchData().catch(e => console.error('[Store] fetch on broadcast event:', e.message));
    };

    window.addEventListener('storage', onStorage);
    if (channel) channel.addEventListener('message', onBroadcast);

    return () => {
      window.removeEventListener('storage', onStorage);
      if (channel) {
        channel.removeEventListener('message', onBroadcast);
        channel.close();
      }
    };
  }, [fetchData]);

  // ── Polling — SKIPS when admin has unsaved changes ────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      if (pendingSave.current || isSavingNow.current) return; // skip
      fetchData();
    }, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchData]);

  // ── Save helper — reads from stateRef so it's ALWAYS fresh ───────────────
  // Call this after every mutation; pass partial overrides for the fields
  // that just changed (so even the very first render gets the right values).
  const scheduleSave = useCallback((overrides = {}) => {
    pendingSave.current = true;
    if (saveTimer.current) clearTimeout(saveTimer.current);

    saveTimer.current = setTimeout(() => {
      // Merge always-current ref with the overrides from this mutation
      // ✅ Exclude notifications - keep them in-memory only
      const { notifications: _ignore, ...dataToSave } = stateRef.current;
      const snapshot = { ...dataToSave, ...overrides, settings: {} };
      isSavingNow.current = true;
      fetch(`${API_BASE}/api/storage`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(snapshot),
      })
        .then(() => {
          pendingSave.current = false;
          // Notify other tabs they should refresh, and refresh this tab too.
          try { localStorage.setItem(STORAGE_SYNC_KEY, Date.now().toString()); } catch (err) { /* ignore */ }
          if (typeof BroadcastChannel !== 'undefined') {
            try {
              const bc = new BroadcastChannel(BROADCAST_CHANNEL);
              bc.postMessage('sync');
              bc.close();
            } catch (err) { /* ignore it if broken in restrictive browsers */ }
          }
          fetchData().catch(e => console.error('[Store] fetch after save:', e.message));
        })
        .catch(e => console.error('[Store] save:', e.message))
        .finally(() => { isSavingNow.current = false; });
    }, SAVE_DEBOUNCE);
  }, [fetchData]);

  // ─── Tiny log builder (pure) ──────────────────────────────────────────────
  const buildLog = (msg) => ({
    id: generateId(), timestamp: new Date().toISOString(),
    message: msg,
    userId:   currentUser?.id   || '',
    userName: currentUser?.name || '',
  });

  // ─── Auth ─────────────────────────────────────────────────────────────────
  const loginWithGoogle = async (idToken) => {
    try {
      const res  = await fetch(`${API_BASE}/api/auth/google`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) });
      const data = await res.json();
      if (!res.ok || !data.success) return { success: false, error: data.error || 'Authentication failed.' };
      setCurrentUser(data.user);
      localStorage.setItem('room_system_user', JSON.stringify(data.user));
      return { success: true, role: data.role };
    } catch { return { success: false, error: 'Network error. Please try again.' }; }
  };
  const logout = () => { setCurrentUser(null); localStorage.removeItem('room_system_user'); };

  // ─── Settings ─────────────────────────────────────────────────────────────
  const updateSettings = (p) => {
    if ('viewOrientation' in p) { setViewOrientation(p.viewOrientation); saveOrientation(currentUser?.id, p.viewOrientation); }
  };

  // ─── Notifications ────────────────────────────────────────────────────────
  const addNotification = (message, type = 'info') =>
    setNotifications(prev => [{ id: generateId(), message, type, timestamp: new Date().toISOString(), isRead: false }, ...prev]);
  const clearNotifications = () => setNotifications([]);

  // ─── Branch CRUD ──────────────────────────────────────────────────────────
  const addBranch = (name) => {
    if (currentUser?.role !== 'admin') return;
    if (stateRef.current.branches.some(b => b.name.toLowerCase() === name.toLowerCase())) { alert(`Branch "${name}" already exists.`); return; }
    const newBranches = [...stateRef.current.branches, { id: generateId(), name }];
    const newLogs     = [buildLog(`Added branch: ${name}`), ...stateRef.current.logs];
    setBranches(newBranches);
    setLogs(newLogs);
    scheduleSave({ branches: newBranches, logs: newLogs });
  };
  const removeBranch = (id) => {
    if (currentUser?.role !== 'admin') return;
    const newBranches  = stateRef.current.branches.filter(b => b.id !== id);
    const newUsers     = stateRef.current.users.filter(u => !(u.role === 'teacher' && u.branchId === id));
    const newAllocs    = stateRef.current.allocations.filter(a => a.branchId !== id);
    const newLogs      = [buildLog(`Removed branch ${id}`), ...stateRef.current.logs];
    setBranches(newBranches); setUsers(newUsers); setAllocations(newAllocs); setLogs(newLogs);
    scheduleSave({ branches: newBranches, users: newUsers, allocations: newAllocs, logs: newLogs });
  };

  // ─── Room CRUD ────────────────────────────────────────────────────────────
  const addRoom = (name) => {
    if (currentUser?.role !== 'admin') return;
    if (stateRef.current.rooms.some(r => r.name.toLowerCase() === name.toLowerCase())) { alert(`Room "${name}" already exists.`); return; }
    const newRooms = [...stateRef.current.rooms, { id: generateId(), name }];
    const newLogs  = [buildLog(`Added room: ${name}`), ...stateRef.current.logs];
    setRooms(newRooms);
    setLogs(newLogs);
    scheduleSave({ rooms: newRooms, logs: newLogs });
  };
  const removeRoom = (id) => {
    if (currentUser?.role !== 'admin') return;
    const newRooms  = stateRef.current.rooms.filter(r => r.id !== id);
    const newAllocs = stateRef.current.allocations.filter(a => a.roomId !== id);
    const newLogs   = [buildLog(`Removed room ${id}`), ...stateRef.current.logs];
    setRooms(newRooms); setAllocations(newAllocs); setLogs(newLogs);
    scheduleSave({ rooms: newRooms, allocations: newAllocs, logs: newLogs });
  };

  // ─── TimeSlot CRUD ────────────────────────────────────────────────────────
  const addTimeSlot = (startTime, endTime, period) => {
    if (currentUser?.role !== 'admin') return { success: false, error: 'Not authorised.' };
    const p = Number(period);
    if (toMin(startTime) >= toMin(endTime))       return { success: false, error: 'Start must be before end.' };
    if (stateRef.current.timeSlots.some(s => s.period === p)) return { success: false, error: `Period ${p} already exists.` };
    const conflict = stateRef.current.timeSlots.find(s => overlaps(startTime, endTime, s.startTime, s.endTime));
    if (conflict) return { success: false, error: `Overlaps with Period ${conflict.period} (${conflict.label}).` };
    const label      = `${startTime} - ${endTime}`;
    const newSlots   = [...stateRef.current.timeSlots, { id: generateId(), startTime, endTime, label, period: p }].sort((a, b) => a.period - b.period);
    const newLogs    = [buildLog(`Added period ${p}: ${label}`), ...stateRef.current.logs];
    setTimeSlots(newSlots); setLogs(newLogs);
    scheduleSave({ timeSlots: newSlots, logs: newLogs });
    return { success: true };
  };
  const removeTimeSlot = (id) => {
    if (currentUser?.role !== 'admin') return;
    const newSlots  = stateRef.current.timeSlots.filter(s => s.id !== id);
    const newAllocs = stateRef.current.allocations.filter(a => a.slotId !== id);
    const newLogs   = [buildLog(`Removed time slot ${id}`), ...stateRef.current.logs];
    setTimeSlots(newSlots); setAllocations(newAllocs); setLogs(newLogs);
    scheduleSave({ timeSlots: newSlots, allocations: newAllocs, logs: newLogs });
  };

  // ─── Teacher CRUD ─────────────────────────────────────────────────────────
  const addTeacher = (name, email, branchId) => {
    if (currentUser?.role !== 'admin' || !email || !branchId) return;
    if (stateRef.current.users.some(u => u.email.toLowerCase() === email.toLowerCase())) { alert(`Email "${email}" already exists.`); return; }
    const displayName = name || email.split('@')[0];
    const newUsers    = [...stateRef.current.users, { id: generateId(), name: displayName, email: email.toLowerCase(), role: 'teacher', branchId }];
    const newLogs     = [buildLog(`Added teacher: ${displayName} (${email})`), ...stateRef.current.logs];
    setUsers(newUsers); setLogs(newLogs);
    scheduleSave({ users: newUsers, logs: newLogs });
  };
  const removeTeacher = (id) => {
    if (currentUser?.role !== 'admin') return;
    const newUsers = stateRef.current.users.filter(u => u.id !== id);
    const newLogs  = [buildLog(`Removed teacher ${id}`), ...stateRef.current.logs];
    setUsers(newUsers); setLogs(newLogs);
    scheduleSave({ users: newUsers, logs: newLogs });
  };

  // ─── Admin CRUD ───────────────────────────────────────────────────────────
  const addAdmin = (name, email) => {
    if (currentUser?.role !== 'admin') return;
    if (stateRef.current.users.some(u => u.email.toLowerCase() === email.toLowerCase())) { alert(`Email "${email}" already exists.`); return; }
    const displayName = name || email.split('@')[0];
    const newUsers    = [...stateRef.current.users, { id: generateId(), name: displayName, email: email.toLowerCase(), role: 'admin' }];
    const newLogs     = [buildLog(`Added admin: ${displayName} (${email})`), ...stateRef.current.logs];
    setUsers(newUsers); setLogs(newLogs);
    scheduleSave({ users: newUsers, logs: newLogs });
  };
  const removeAdmin = (id) => {
    if (currentUser?.role !== 'admin') return;
    if (stateRef.current.users.filter(u => u.role === 'admin').length <= 1) { alert('Cannot remove last admin.'); return; }
    const newUsers = stateRef.current.users.filter(u => u.id !== id);
    const newLogs  = [buildLog(`Removed admin ${id}`), ...stateRef.current.logs];
    setUsers(newUsers); setLogs(newLogs);
    scheduleSave({ users: newUsers, logs: newLogs });
  };

  // ─── Allocation CRUD ──────────────────────────────────────────────────────
  const setAllocation = (day, slotId, roomId, branchId) => {
    if (currentUser?.role !== 'admin') return;
    const branch = stateRef.current.branches.find(b => b.id === branchId);
    if (!branch) return;
    const newAllocs = [
      ...stateRef.current.allocations.filter(a => !(a.day === day && a.slotId === slotId && a.roomId === roomId)),
      { id: generateId(), day, slotId, roomId, branchId, subject: branch.name, updatedBy: currentUser.id, updatedAt: new Date().toISOString() },
    ];
    const newLogs = [buildLog(`Allocated ${branch.name} → ${day}, slot ${slotId}, room ${roomId}`), ...stateRef.current.logs];
    setAllocations(newAllocs); setLogs(newLogs);
    scheduleSave({ allocations: newAllocs, logs: newLogs });
  };

  const removeAllocation = (allocationId) => {
    if (currentUser?.role !== 'admin') return;
    const newAllocs = stateRef.current.allocations.filter(a => a.id !== allocationId);
    const newLogs   = [buildLog(`Removed allocation ${allocationId}`), ...stateRef.current.logs];
    setAllocations(newAllocs); setLogs(newLogs);
    scheduleSave({ allocations: newAllocs, logs: newLogs });
  };

  const updateAllocationSubject = (allocationId, newSubject, newBranchLabel) => {
    if (!currentUser) return;
    const allocation = stateRef.current.allocations.find(a => a.id === allocationId);
    if (!allocation) return;
    if (currentUser.role === 'teacher') {
      if (!currentUser.branchId) { alert('No branch assigned.'); return; }
      if (currentUser.branchId !== allocation.branchId) { alert('You can only edit your own branch slots.'); return; }
    } else if (currentUser.role !== 'admin') return;

    const newAllocs = stateRef.current.allocations.map(a =>
      a.id === allocationId
        ? { ...a, subject: newSubject, branchLabel: newBranchLabel !== undefined ? newBranchLabel : a.branchLabel, updatedBy: currentUser.id, updatedAt: new Date().toISOString() }
        : a
    );
    const branch   = stateRef.current.branches.find(b => b.id === allocation.branchId);
    const newLogs  = [buildLog(`Updated slot: "${newSubject}" (${newBranchLabel ?? branch?.name})`), ...stateRef.current.logs];
    const newNotifs = [
      { id: generateId(), message: `📝 ${branch?.name} - ${allocation.day} updated: '${newSubject}'`, type: 'info', timestamp: new Date().toISOString(), isRead: false },
      ...stateRef.current.notifications,
    ];
    setAllocations(newAllocs); setLogs(newLogs); setNotifications(newNotifs);
    scheduleSave({ allocations: newAllocs, logs: newLogs, notifications: newNotifs });
  };

  // ─── Reset ────────────────────────────────────────────────────────────────
  const resetData = async () => {
    try {
      pendingSave.current = false;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      await fetch(`${API_BASE}/api/storage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(null) });
      setUsers(INITIAL_USERS); setBranches(INITIAL_BRANCHES); setRooms(INITIAL_ROOMS);
      setTimeSlots(INITIAL_SLOTS); setAllocations([]); setLogs([]); setNotifications([]);
    } catch (e) { console.error('[Store] reset:', e); }
  };

  return (
    <StoreContext.Provider value={{
      currentUser, users, branches, rooms, timeSlots, allocations, logs, settings, notifications, isLoaded,
      loginWithGoogle, logout,
      addBranch, removeBranch, addRoom, removeRoom, addTimeSlot, removeTimeSlot,
      addTeacher, removeTeacher, addAdmin, removeAdmin, updateSettings,
      setAllocation, removeAllocation, updateAllocationSubject,
      addNotification, clearNotifications, resetData,
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
