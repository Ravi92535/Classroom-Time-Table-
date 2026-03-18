import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { generateId } from './utils.js';

// ─── API Configuration ─────────────────────────────────────────────────────
const API_BASE = typeof window !== 'undefined' && window.location.hostname !== 'localhost'
  ? 'https://classroom-time-table.vercel.app'
  : 'http://localhost:3001';

const POLL_INTERVAL  = 15000; // 15 seconds — re-fetch for viewers
const SAVE_DEBOUNCE  = 800;   // ms — wait after last change before saving

// ─── Days ─────────────────────────────────────────────────────────────────────
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
function orientationKey(userId) { return `room_view_orientation_${userId || 'guest'}`; }
function loadOrientation(userId) {
  try { return localStorage.getItem(orientationKey(userId)) || 'horizontal'; } catch { return 'horizontal'; }
}
function saveOrientation(userId, value) {
  try { localStorage.setItem(orientationKey(userId), value); } catch { }
}

// ─── Time helpers ─────────────────────────────────────────────────────────────
function toMinutes(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }
function timesOverlap(s1, e1, s2, e2) {
  return toMinutes(s1) < toMinutes(e2) && toMinutes(s2) < toMinutes(e1);
}

// ─── Context ──────────────────────────────────────────────────────────────────
const StoreContext = createContext(undefined);

export function StoreProvider({ children }) {
  const [currentUser,    setCurrentUser]    = useState(() => {
    try { const s = localStorage.getItem('room_system_user'); return s ? JSON.parse(s) : null; }
    catch { return null; }
  });
  const [users,          setUsers]          = useState(INITIAL_USERS);
  const [branches,       setBranches]       = useState(INITIAL_BRANCHES);
  const [rooms,          setRooms]          = useState(INITIAL_ROOMS);
  const [timeSlots,      setTimeSlots]      = useState(INITIAL_SLOTS);
  const [allocations,    setAllocations]    = useState([]);
  const [logs,           setLogs]           = useState([]);
  const [notifications,  setNotifications]  = useState([]);
  const [isLoaded,       setIsLoaded]       = useState(false);
  const [viewOrientation, setViewOrientation] = useState('horizontal');
  const settings = { viewOrientation };

  // ── Refs to track save state ──────────────────────────────────────────────
  // pendingSave: true when user made a change that hasn't been saved yet
  // isSavingNow: true while the fetch POST is in-flight
  // skipNextPoll: true right after a save so poll doesn't overwrite fresh data
  const pendingSave   = useRef(false);
  const isSavingNow   = useRef(false);
  const saveTimerRef  = useRef(null);

  useEffect(() => {
    setViewOrientation(loadOrientation(currentUser?.id));
  }, [currentUser?.id]);

  // ── Apply fetched data to state ───────────────────────────────────────────
  const applyFetchedData = useCallback((parsed) => {
    if (!parsed) return;
    setUsers(parsed.users               || INITIAL_USERS);
    setBranches(parsed.branches         || INITIAL_BRANCHES);
    setRooms(parsed.rooms               || INITIAL_ROOMS);
    setTimeSlots(parsed.timeSlots       || INITIAL_SLOTS);
    setAllocations(parsed.allocations   || []);
    setLogs(parsed.logs                 || []);
    setNotifications(parsed.notifications || []);
  }, []);

  // ── Fetch from backend ────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/storage`);
      if (!res.ok) throw new Error('fetch failed');
      const parsed = await res.json();
      applyFetchedData(parsed);
    } catch (err) {
      console.error('[Store] fetch error:', err.message);
    }
  }, [applyFetchedData]);

  // ── Save to backend ───────────────────────────────────────────────────────
  const saveData = useCallback((snapshot) => {
    isSavingNow.current = true;
    fetch(`${API_BASE}/api/storage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snapshot),
    })
      .then(() => { pendingSave.current = false; })
      .catch(err => console.error('[Store] save error:', err.message))
      .finally(() => { isSavingNow.current = false; });
  }, []);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetchData().finally(() => setIsLoaded(true));
  }, []);

  // ── Polling: only fetch if NO pending/in-flight save ─────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      // If admin is actively making changes, skip this poll entirely
      // to avoid overwriting their unsaved state
      if (pendingSave.current || isSavingNow.current) {
        console.log('[Poll] skipped — save pending');
        return;
      }
      fetchData();
    }, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ── Trigger save (called after every mutation) ────────────────────────────
  // We pass a snapshot of the CURRENT state instead of relying on stale closure
  const scheduleSave = useCallback((snapshot) => {
    pendingSave.current = true;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveData(snapshot);
    }, SAVE_DEBOUNCE);
  }, [saveData]);

  // ─── Log helper ───────────────────────────────────────────────────────────
  const addLog = (message, currentUserRef, currentLogsRef) => {
    if (!currentUserRef) return currentLogsRef;
    return [{
      id: generateId(), timestamp: new Date().toISOString(),
      message, userId: currentUserRef.id, userName: currentUserRef.name,
    }, ...currentLogsRef];
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
    if (branches.some(b => b.name.toLowerCase() === name.toLowerCase())) { alert(`Branch "${name}" already exists.`); return; }
    setBranches(prev => {
      const next = [...prev, { id: generateId(), name }];
      const newLogs = addLog(`Added branch: ${name}`, currentUser, logs);
      setLogs(newLogs);
      scheduleSave({ users, branches: next, rooms, timeSlots, allocations, logs: newLogs, settings: {}, notifications });
      return next;
    });
  };
  const removeBranch = (id) => {
    if (currentUser?.role !== 'admin') return;
    setBranches(prev => {
      const next = prev.filter(b => b.id !== id);
      const nextUsers = users.filter(u => !(u.role === 'teacher' && u.branchId === id));
      const nextAllocs = allocations.filter(a => a.branchId !== id);
      const newLogs = addLog(`Removed branch ${id}`, currentUser, logs);
      setUsers(nextUsers);
      setAllocations(nextAllocs);
      setLogs(newLogs);
      scheduleSave({ users: nextUsers, branches: next, rooms, timeSlots, allocations: nextAllocs, logs: newLogs, settings: {}, notifications });
      return next;
    });
  };

  // ─── Room CRUD ────────────────────────────────────────────────────────────
  const addRoom = (name) => {
    if (currentUser?.role !== 'admin') return;
    if (rooms.some(r => r.name.toLowerCase() === name.toLowerCase())) { alert(`Room "${name}" already exists.`); return; }
    setRooms(prev => {
      const next = [...prev, { id: generateId(), name }];
      const newLogs = addLog(`Added room: ${name}`, currentUser, logs);
      setLogs(newLogs);
      scheduleSave({ users, branches, rooms: next, timeSlots, allocations, logs: newLogs, settings: {}, notifications });
      return next;
    });
  };
  const removeRoom = (id) => {
    if (currentUser?.role !== 'admin') return;
    setRooms(prev => {
      const next = prev.filter(r => r.id !== id);
      const nextAllocs = allocations.filter(a => a.roomId !== id);
      const newLogs = addLog(`Removed room ${id}`, currentUser, logs);
      setAllocations(nextAllocs);
      setLogs(newLogs);
      scheduleSave({ users, branches, rooms: next, timeSlots, allocations: nextAllocs, logs: newLogs, settings: {}, notifications });
      return next;
    });
  };

  // ─── TimeSlot CRUD ────────────────────────────────────────────────────────
  const addTimeSlot = (startTime, endTime, period) => {
    if (currentUser?.role !== 'admin') return { success: false, error: 'Not authorised.' };
    const periodNum = Number(period);
    if (toMinutes(startTime) >= toMinutes(endTime)) return { success: false, error: 'Start must be before end.' };
    if (timeSlots.some(s => s.period === periodNum)) return { success: false, error: `Period ${periodNum} already exists.` };
    const conflict = timeSlots.find(s => timesOverlap(startTime, endTime, s.startTime, s.endTime));
    if (conflict) return { success: false, error: `Overlaps with Period ${conflict.period} (${conflict.label}).` };
    const label = `${startTime} - ${endTime}`;
    setTimeSlots(prev => {
      const next = [...prev, { id: generateId(), startTime, endTime, label, period: periodNum }].sort((a, b) => a.period - b.period);
      const newLogs = addLog(`Added period ${periodNum}: ${label}`, currentUser, logs);
      setLogs(newLogs);
      scheduleSave({ users, branches, rooms, timeSlots: next, allocations, logs: newLogs, settings: {}, notifications });
      return next;
    });
    return { success: true };
  };
  const removeTimeSlot = (id) => {
    if (currentUser?.role !== 'admin') return;
    setTimeSlots(prev => {
      const next = prev.filter(s => s.id !== id);
      const nextAllocs = allocations.filter(a => a.slotId !== id);
      const newLogs = addLog(`Removed time slot ${id}`, currentUser, logs);
      setAllocations(nextAllocs);
      setLogs(newLogs);
      scheduleSave({ users, branches, rooms, timeSlots: next, allocations: nextAllocs, logs: newLogs, settings: {}, notifications });
      return next;
    });
  };

  // ─── Teacher CRUD ─────────────────────────────────────────────────────────
  const addTeacher = (name, email, branchId) => {
    if (currentUser?.role !== 'admin' || !email || !branchId) return;
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) { alert(`Email "${email}" already exists.`); return; }
    const displayName = name || email.split('@')[0];
    setUsers(prev => {
      const next = [...prev, { id: generateId(), name: displayName, email: email.toLowerCase(), role: 'teacher', branchId }];
      const newLogs = addLog(`Added teacher: ${displayName} (${email})`, currentUser, logs);
      setLogs(newLogs);
      scheduleSave({ users: next, branches, rooms, timeSlots, allocations, logs: newLogs, settings: {}, notifications });
      return next;
    });
  };
  const removeTeacher = (id) => {
    if (currentUser?.role !== 'admin') return;
    setUsers(prev => {
      const next = prev.filter(u => u.id !== id);
      const newLogs = addLog(`Removed teacher ${id}`, currentUser, logs);
      setLogs(newLogs);
      scheduleSave({ users: next, branches, rooms, timeSlots, allocations, logs: newLogs, settings: {}, notifications });
      return next;
    });
  };

  // ─── Admin CRUD ───────────────────────────────────────────────────────────
  const addAdmin = (name, email) => {
    if (currentUser?.role !== 'admin') return;
    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) { alert(`Email "${email}" already exists.`); return; }
    const displayName = name || email.split('@')[0];
    setUsers(prev => {
      const next = [...prev, { id: generateId(), name: displayName, email: email.toLowerCase(), role: 'admin' }];
      const newLogs = addLog(`Added admin: ${displayName} (${email})`, currentUser, logs);
      setLogs(newLogs);
      scheduleSave({ users: next, branches, rooms, timeSlots, allocations, logs: newLogs, settings: {}, notifications });
      return next;
    });
  };
  const removeAdmin = (id) => {
    if (currentUser?.role !== 'admin') return;
    if (users.filter(u => u.role === 'admin').length <= 1) { alert('Cannot remove last admin.'); return; }
    setUsers(prev => {
      const next = prev.filter(u => u.id !== id);
      const newLogs = addLog(`Removed admin ${id}`, currentUser, logs);
      setLogs(newLogs);
      scheduleSave({ users: next, branches, rooms, timeSlots, allocations, logs: newLogs, settings: {}, notifications });
      return next;
    });
  };

  // ─── Allocation CRUD ──────────────────────────────────────────────────────
  const setAllocation = (day, slotId, roomId, branchId) => {
    if (currentUser?.role !== 'admin') return;
    const branch = branches.find(b => b.id === branchId);
    if (!branch) return;
    setAllocations(prev => {
      const next = [
        ...prev.filter(a => !(a.day === day && a.slotId === slotId && a.roomId === roomId)),
        { id: generateId(), day, slotId, roomId, branchId, subject: branch.name, updatedBy: currentUser.id, updatedAt: new Date().toISOString() },
      ];
      const newLogs = addLog(`Allocated ${branch.name} → ${day}, slot ${slotId}, room ${roomId}`, currentUser, logs);
      setLogs(newLogs);
      scheduleSave({ users, branches, rooms, timeSlots, allocations: next, logs: newLogs, settings: {}, notifications });
      return next;
    });
  };

  const removeAllocation = (allocationId) => {
    if (currentUser?.role !== 'admin') return;
    setAllocations(prev => {
      const next = prev.filter(a => a.id !== allocationId);
      const newLogs = addLog(`Removed allocation ${allocationId}`, currentUser, logs);
      setLogs(newLogs);
      scheduleSave({ users, branches, rooms, timeSlots, allocations: next, logs: newLogs, settings: {}, notifications });
      return next;
    });
  };

  const updateAllocationSubject = (allocationId, newSubject, newBranchLabel) => {
    if (!currentUser) return;
    const allocation = allocations.find(a => a.id === allocationId);
    if (!allocation) return;
    if (currentUser.role === 'teacher') {
      if (!currentUser.branchId) { alert('No branch assigned.'); return; }
      if (currentUser.branchId !== allocation.branchId) { alert('You can only edit your own branch slots.'); return; }
    } else if (currentUser.role !== 'admin') return;

    setAllocations(prev => {
      const next = prev.map(a =>
        a.id === allocationId
          ? { ...a, subject: newSubject, branchLabel: newBranchLabel !== undefined ? newBranchLabel : a.branchLabel, updatedBy: currentUser.id, updatedAt: new Date().toISOString() }
          : a
      );
      const branch = branches.find(b => b.id === allocation.branchId);
      const newLogs = addLog(`Updated slot: "${newSubject}" (${newBranchLabel ?? branch?.name})`, currentUser, logs);
      const newNotifs = [{ id: generateId(), message: `📝 ${branch?.name} - ${allocation.day} updated: '${newSubject}'`, type: 'info', timestamp: new Date().toISOString(), isRead: false }, ...notifications];
      setLogs(newLogs);
      setNotifications(newNotifs);
      scheduleSave({ users, branches, rooms, timeSlots, allocations: next, logs: newLogs, settings: {}, notifications: newNotifs });
      return next;
    });
  };

  // ─── Reset All Data ───────────────────────────────────────────────────────
  const resetData = async () => {
    try {
      pendingSave.current = false;
      isSavingNow.current = false;
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
