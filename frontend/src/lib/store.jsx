import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { generateId } from './utils.js';

// ─── API ───────────────────────────────────────────────────────────────────────
const API_BASE = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
  ? 'https://classroom-time-table.vercel.app'
  : 'http://localhost:3001';

const POLL_INTERVAL     = 500;   // 0.5s polling for other tabs/roles
const QUEUE_FLUSH_DELAY = 300;   // ms of quiet before flushing the update queue
const STORAGE_SYNC_KEY  = 'room_system_sync_timestamp';
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

  // Always-current snapshot ref so mutations can read latest state synchronously
  const stateRef = useRef({});
  useEffect(() => {
    stateRef.current = { users, branches, rooms, timeSlots, allocations, logs, notifications };
  });

  // ── Update Queue ─────────────────────────────────────────────────────────────
  //
  // HOW IT WORKS:
  //   • pendingOps  — a Map keyed by "entityType:id[:del]"
  //                   Rapid changes to the SAME record just replace the pending op.
  //                   Fast typing a subject = only 1 API call when the user pauses.
  //   • pendingLogs — a plain array; all logs are batched into one POST /api/logs call.
  //   • Both are flushed together after QUEUE_FLUSH_DELAY ms of quiet (no new writes).
  //   • All ops in a flush are fired in PARALLEL — no sequential bottleneck.
  //
  const pendingOps  = useRef(new Map()); // key → { method, url, body }
  const pendingLogs = useRef([]);
  const flushTimer  = useRef(null);
  const isSavingNow = useRef(false);
  const pendingSave = useRef(false);     // blocks polling while writes are in-flight

  const lastNotifMsg = useRef('');
  const logSequence  = useRef(0);

  useEffect(() => { setViewOrientation(loadOrientation(currentUser?.id)); }, [currentUser?.id]);

  // ── Notify other tabs ────────────────────────────────────────────────────────
  const notifyOtherTabs = useCallback(() => {
    try { localStorage.setItem(STORAGE_SYNC_KEY, Date.now().toString()); } catch { /* ignore */ }
    if (typeof BroadcastChannel !== 'undefined') {
      try { const bc = new BroadcastChannel(BROADCAST_CHANNEL); bc.postMessage('sync'); bc.close(); } catch { /* ignore */ }
    }
  }, []);

  // ── Flush the queue ──────────────────────────────────────────────────────────
  const flushQueue = useCallback(async () => {
    const ops  = [...pendingOps.current.values()];
    const logs = [...pendingLogs.current];
    pendingOps.current.clear();
    pendingLogs.current = [];

    if (ops.length === 0 && logs.length === 0) {
      pendingSave.current = false;
      return;
    }

    isSavingNow.current = true;
    try {
      // Fire all entity ops in parallel
      const requests = ops.map(({ method, url, body }) =>
        fetch(`${API_BASE}${url}`, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: body ? JSON.stringify(body) : undefined,
        }).catch(e => console.error(`[Queue] ${method} ${url}:`, e.message))
      );

      // Batch all pending logs into one request
      if (logs.length > 0) {
        requests.push(
          fetch(`${API_BASE}/api/logs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ logs }),
          }).catch(e => console.error('[Queue] POST /api/logs:', e.message))
        );
      }

      await Promise.all(requests);
      notifyOtherTabs();
    } finally {
      isSavingNow.current = false;
      pendingSave.current = false;
    }
  }, [notifyOtherTabs]);

  // ── Add an op to the queue ───────────────────────────────────────────────────
  // key should be unique per record, e.g. "alloc:abc123" or "alloc:abc123:del"
  // If the same key is added again before the flush fires, the NEW op wins.
  const addToQueue = useCallback((key, method, url, body) => {
    pendingSave.current = true;
    pendingOps.current.set(key, { method, url, body });
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(flushQueue, QUEUE_FLUSH_DELAY);
  }, [flushQueue]);

  // ── Queue a log entry (batched into one POST /api/logs per flush) ────────────
  const queueLog = useCallback((log) => {
    pendingSave.current = true;
    pendingLogs.current.push(log);
    if (flushTimer.current) clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(flushQueue, QUEUE_FLUSH_DELAY);
  }, [flushQueue]);

  // ── fetch & apply ─────────────────────────────────────────────────────────
  const applyData = useCallback((d) => {
    if (!d) return;
    setUsers(d.users               || INITIAL_USERS);
    setBranches(d.branches         || INITIAL_BRANCHES);
    setRooms(d.rooms               || INITIAL_ROOMS);
    setTimeSlots(d.timeSlots       || INITIAL_SLOTS);

    const allocs = d.allocations || [];
    const deduped = Array.from(new Map(allocs.map(a => [a.id, a])).values());
    setAllocations(deduped);

    const sortedLogs = (d.logs || []).sort((a, b) => (b.sequence ?? 0) - (a.sequence ?? 0));
    setLogs(sortedLogs);

    const maxSequence = Math.max(...sortedLogs.map(l => l.sequence || 0), logSequence.current);
    logSequence.current = maxSequence;
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

  // ── Cross-tab sync ────────────────────────────────────────────────────────
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
      if (channel) { channel.removeEventListener('message', onBroadcast); channel.close(); }
    };
  }, [fetchData]);

  // ── Polling — skips when writes are in-flight ────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      if (pendingSave.current || isSavingNow.current) return;
      fetchData();
    }, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchData]);

  // ─── Log builder ──────────────────────────────────────────────────────────
  const buildLog = (msg) => {
    logSequence.current++;
    return {
      id: generateId(),
      timestamp: new Date().toISOString(),
      message: msg,
      userId:   currentUser?.id   || '',
      userName: currentUser?.name || '',
      sequence: logSequence.current,
    };
  };

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
  const addNotification = (message, type = 'info') => {
    if (lastNotifMsg.current === message) return;
    lastNotifMsg.current = message;
    setTimeout(() => { lastNotifMsg.current = ''; }, 1000);
    setNotifications(prev => [{ id: generateId(), message, type, timestamp: new Date().toISOString(), isRead: false }, ...prev]);
  };
  const clearNotifications = () => setNotifications([]);

  // ─── Branch CRUD ──────────────────────────────────────────────────────────
  const addBranch = (name) => {
    if (currentUser?.role !== 'admin') return;
    if (stateRef.current.branches.some(b => b.name.toLowerCase() === name.toLowerCase())) {
      alert(`Branch "${name}" already exists.`);
      return;
    }
    const newBranch = { id: generateId(), name };
    const newLog    = buildLog(`Added branch: ${name}`);
    setBranches(prev => [...prev, newBranch]);
    setLogs(prev => [newLog, ...prev]);
    addToQueue(`branch:${newBranch.id}`, 'PUT', '/api/branches', newBranch);
    queueLog(newLog);
  };

  const removeBranch = (id) => {
    if (currentUser?.role !== 'admin') return;
    const newLog = buildLog(`Removed branch ${id}`);
    setBranches(prev => prev.filter(b => b.id !== id));
    setUsers(prev => prev.filter(u => !(u.role === 'teacher' && u.branchId === id)));
    setAllocations(prev => prev.filter(a => a.branchId !== id));
    setLogs(prev => [newLog, ...prev]);
    // Backend cascade handles allocations + user branch_id cleanup
    addToQueue(`branch:${id}:del`, 'DELETE', `/api/branches/${id}`);
    queueLog(newLog);
  };

  // ─── Room CRUD ────────────────────────────────────────────────────────────
  const addRoom = (name) => {
    if (currentUser?.role !== 'admin') return;
    if (stateRef.current.rooms.some(r => r.name.toLowerCase() === name.toLowerCase())) {
      alert(`Room "${name}" already exists.`);
      return;
    }
    const newRoom = { id: generateId(), name };
    const newLog  = buildLog(`Added room: ${name}`);
    setRooms(prev => [...prev, newRoom]);
    setLogs(prev => [newLog, ...prev]);
    addToQueue(`room:${newRoom.id}`, 'PUT', '/api/rooms', newRoom);
    queueLog(newLog);
  };

  const removeRoom = (id) => {
    if (currentUser?.role !== 'admin') return;
    const newLog = buildLog(`Removed room ${id}`);
    setRooms(prev => prev.filter(r => r.id !== id));
    setAllocations(prev => prev.filter(a => a.roomId !== id));
    setLogs(prev => [newLog, ...prev]);
    // Backend cascade handles allocations cleanup
    addToQueue(`room:${id}:del`, 'DELETE', `/api/rooms/${id}`);
    queueLog(newLog);
  };

  // ─── TimeSlot CRUD ────────────────────────────────────────────────────────
  const addTimeSlot = (startTime, endTime, period) => {
    if (currentUser?.role !== 'admin') return { success: false, error: 'Not authorised.' };
    const p = Number(period);
    if (toMin(startTime) >= toMin(endTime))          return { success: false, error: 'Start must be before end.' };
    if (stateRef.current.timeSlots.some(s => s.period === p)) return { success: false, error: `Period ${p} already exists.` };
    const conflict = stateRef.current.timeSlots.find(s => overlaps(startTime, endTime, s.startTime, s.endTime));
    if (conflict) return { success: false, error: `Overlaps with Period ${conflict.period} (${conflict.label}).` };

    const label   = `${startTime} - ${endTime}`;
    const newSlot = { id: generateId(), startTime, endTime, label, period: p };
    const newLog  = buildLog(`Added period ${p}: ${label}`);
    setTimeSlots(prev => [...prev, newSlot].sort((a, b) => a.period - b.period));
    setLogs(prev => [newLog, ...prev]);
    addToQueue(`timeslot:${newSlot.id}`, 'PUT', '/api/timeslots', newSlot);
    queueLog(newLog);
    return { success: true };
  };

  const removeTimeSlot = (id) => {
    if (currentUser?.role !== 'admin') return;
    const newLog = buildLog(`Removed time slot ${id}`);
    setTimeSlots(prev => prev.filter(s => s.id !== id));
    setAllocations(prev => prev.filter(a => a.slotId !== id));
    setLogs(prev => [newLog, ...prev]);
    // Backend cascade handles allocations cleanup
    addToQueue(`timeslot:${id}:del`, 'DELETE', `/api/timeslots/${id}`);
    queueLog(newLog);
  };

  // ─── Teacher CRUD ─────────────────────────────────────────────────────────
  const addTeacher = (name, email, branchId) => {
    if (currentUser?.role !== 'admin' || !email || !branchId) return;
    if (stateRef.current.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      alert(`Email "${email}" already exists.`);
      return;
    }
    const displayName = name || email.split('@')[0];
    const newUser     = { id: generateId(), name: displayName, email: email.toLowerCase(), role: 'teacher', branchId };
    const newLog      = buildLog(`Added teacher: ${displayName} (${email})`);
    setUsers(prev => [...prev, newUser]);
    setLogs(prev => [newLog, ...prev]);
    addToQueue(`user:${newUser.id}`, 'PUT', '/api/users', newUser);
    queueLog(newLog);
  };

  const removeTeacher = (id) => {
    if (currentUser?.role !== 'admin') return;
    const newLog = buildLog(`Removed teacher ${id}`);
    setUsers(prev => prev.filter(u => u.id !== id));
    setLogs(prev => [newLog, ...prev]);
    addToQueue(`user:${id}:del`, 'DELETE', `/api/users/${id}`);
    queueLog(newLog);
  };

  // ─── Admin CRUD ───────────────────────────────────────────────────────────
  const addAdmin = (name, email) => {
    if (currentUser?.role !== 'admin') return;
    if (stateRef.current.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      alert(`Email "${email}" already exists.`);
      return;
    }
    const displayName = name || email.split('@')[0];
    const newUser     = { id: generateId(), name: displayName, email: email.toLowerCase(), role: 'admin' };
    const newLog      = buildLog(`Added admin: ${displayName} (${email})`);
    setUsers(prev => [...prev, newUser]);
    setLogs(prev => [newLog, ...prev]);
    addToQueue(`user:${newUser.id}`, 'PUT', '/api/users', newUser);
    queueLog(newLog);
  };

  const removeAdmin = (id) => {
    if (currentUser?.role !== 'admin') return;
    if (stateRef.current.users.filter(u => u.role === 'admin').length <= 1) {
      alert('Cannot remove last admin.');
      return;
    }
    const newLog = buildLog(`Removed admin ${id}`);
    setUsers(prev => prev.filter(u => u.id !== id));
    setLogs(prev => [newLog, ...prev]);
    addToQueue(`user:${id}:del`, 'DELETE', `/api/users/${id}`);
    queueLog(newLog);
  };

  // ─── Allocation CRUD ──────────────────────────────────────────────────────
  const setAllocation = (day, slotId, roomId, branchId) => {
    if (currentUser?.role !== 'admin') return;
    const branch = stateRef.current.branches.find(b => b.id === branchId);
    if (!branch) return;

    // Find existing allocation for this exact (day, slotId, roomId) combo
    const existing = stateRef.current.allocations.find(
      a => a.day === day && a.slotId === slotId && a.roomId === roomId
    );

    const newAlloc = {
      id: generateId(),
      day, slotId, roomId, branchId,
      subject: branch.name,
      updatedBy: currentUser.id,
      updatedAt: new Date().toISOString(),
    };
    const newLog = buildLog(`Allocated ${branch.name} → ${day}, slot ${slotId}, room ${roomId}`);

    setAllocations(prev => {
      const filtered = prev.filter(a => !(a.day === day && a.slotId === slotId && a.roomId === roomId));
      const deduped  = Array.from(new Map(filtered.map(a => [a.id, a])).values());
      return [...deduped, newAlloc];
    });
    setLogs(prev => [newLog, ...prev]);

    // Delete the old allocation record, insert the new one
    if (existing) {
      addToQueue(`alloc:${existing.id}:del`, 'DELETE', `/api/allocations/${existing.id}`);
    }
    addToQueue(`alloc:${newAlloc.id}`, 'PUT', '/api/allocations', newAlloc);
    queueLog(newLog);
  };

  const removeAllocation = (allocationId) => {
    if (currentUser?.role !== 'admin') return;
    const newLog = buildLog(`Removed allocation ${allocationId}`);
    setAllocations(prev => prev.filter(a => a.id !== allocationId));
    setLogs(prev => [newLog, ...prev]);
    addToQueue(`alloc:${allocationId}:del`, 'DELETE', `/api/allocations/${allocationId}`);
    queueLog(newLog);
  };

  const updateAllocationSubject = (allocationId, newSubject, newBranchLabel) => {
    if (!currentUser) return;
    const allocation = stateRef.current.allocations.find(a => a.id === allocationId);
    if (!allocation) return;
    if (currentUser.role === 'teacher') {
      if (!currentUser.branchId) { alert('No branch assigned.'); return; }
      if (currentUser.branchId !== allocation.branchId) { alert('You can only edit your own branch slots.'); return; }
    } else if (currentUser.role !== 'admin') return;

    const updatedAlloc = {
      ...allocation,
      subject:     newSubject,
      branchLabel: newBranchLabel !== undefined ? newBranchLabel : allocation.branchLabel,
      updatedBy:   currentUser.id,
      updatedAt:   new Date().toISOString(),
    };
    const branch  = stateRef.current.branches.find(b => b.id === allocation.branchId);
    const newLog  = buildLog(`Updated slot: "${newSubject}" (${newBranchLabel ?? branch?.name})`);
    const newNotif = {
      id: generateId(),
      message: `📝 ${branch?.name} - ${allocation.day} updated: '${newSubject}'`,
      type: 'info',
      timestamp: new Date().toISOString(),
      isRead: false,
    };

    setAllocations(prev => prev.map(a => a.id === allocationId ? updatedAlloc : a));
    setLogs(prev => [newLog, ...prev]);
    setNotifications(prev => [newNotif, ...prev]);

    // KEY PERF WIN: the queue key is "alloc:<id>" — typing fast replaces the
    // pending op with the latest value. Only 1 API call fires when user pauses.
    addToQueue(`alloc:${allocationId}`, 'PUT', '/api/allocations', updatedAlloc);
    queueLog(newLog);
  };

  // ─── Reset ────────────────────────────────────────────────────────────────
  const resetData = async () => {
    try {
      // Cancel any pending queue
      if (flushTimer.current) clearTimeout(flushTimer.current);
      pendingOps.current.clear();
      pendingLogs.current = [];
      pendingSave.current = false;

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
