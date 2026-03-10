import React, { createContext, useContext, useEffect, useState } from 'react';
import { generateId } from './utils.js';

// ─── Hardcoded Login Credentials (password is always "1234") ─────────────────
// email → role
const CREDENTIALS = {
  'admin@gmail.com':   'admin',
  'teacher@gmail.com': 'teacher',
  'student@gmail.com': 'student',
};

// ─── Days of the week ─────────────────────────────────────────────────────────
export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ─── Initial / Default State ──────────────────────────────────────────────────
const INITIAL_USERS = [
  { id: 'admin',   name: 'Admin User',   email: 'admin@nitkkr.ac.in',   role: 'admin' },
  { id: 'student', name: 'Student User', email: 'student@nitkkr.ac.in', role: 'student' },
  { id: 't1',      name: 'CS Teacher',   email: 'cs@nitkkr.ac.in',      role: 'teacher', branchId: 'b1' },
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
  { id: 's1', startTime: '07:00', endTime: '08:00', label: '7-8 AM',  period: 1 },
  { id: 's2', startTime: '08:00', endTime: '09:00', label: '8-9 AM',  period: 2 },
  { id: 's3', startTime: '09:00', endTime: '10:00', label: '9-10 AM', period: 3 },
];

const INITIAL_SETTINGS = { viewOrientation: 'horizontal' };

// ─── Context ──────────────────────────────────────────────────────────────────
const StoreContext = createContext(undefined);

export function StoreProvider({ children }) {
  const [currentUser,    setCurrentUser]    = useState(null);
  const [users,          setUsers]          = useState(INITIAL_USERS);
  const [branches,       setBranches]       = useState(INITIAL_BRANCHES);
  const [rooms,          setRooms]          = useState(INITIAL_ROOMS);
  const [timeSlots,      setTimeSlots]      = useState(INITIAL_SLOTS);
  const [allocations,    setAllocations]    = useState([]);
  const [logs,           setLogs]           = useState([]);
  const [settings,       setSettings]       = useState(INITIAL_SETTINGS);
  const [notifications,  setNotifications]  = useState([]);
  const [isLoaded,       setIsLoaded]       = useState(false);

  // ── Load data from backend on mount ──────────────────────────────────────────
  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await fetch('/api/storage');
        if (!res.ok) throw new Error('Failed to fetch from backend');
        const parsed = await res.json();
        if (parsed) {
          setUsers(parsed.users               || INITIAL_USERS);
          setBranches(parsed.branches         || INITIAL_BRANCHES);
          setRooms(parsed.rooms               || INITIAL_ROOMS);
          setTimeSlots(parsed.timeSlots       || INITIAL_SLOTS);
          setAllocations(parsed.allocations   || []);
          setLogs(parsed.logs                 || []);
          setSettings(parsed.settings         || INITIAL_SETTINGS);
          setNotifications(parsed.notifications || []);
        }
      } catch (err) {
        console.error('[Store] Failed to load from backend:', err);
      } finally {
        setIsLoaded(true);
      }
    };
    loadData();
  }, []);

  // ── Auto-save data to backend (debounced 500ms) ───────────────────────────
  useEffect(() => {
    if (!isLoaded) return;
    const timer = setTimeout(() => {
      const data = { users, branches, rooms, timeSlots, allocations, logs, settings, notifications };
      fetch('/api/storage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).catch(err => console.error('[Store] Failed to save to backend:', err));
    }, 500);
    return () => clearTimeout(timer);
  }, [users, branches, rooms, timeSlots, allocations, logs, settings, notifications, isLoaded]);

  // ─── Internal helper to add a log entry ──────────────────────────────────
  const addLog = (message) => {
    // We use a functional setState so we always work on the latest state,
    // even if currentUser state hasn't propagated yet.
    setLogs(prev => {
      // currentUser is captured via closure — safe here
      if (!currentUser) return prev;
      const newLog = {
        id: generateId(),
        timestamp: new Date().toISOString(),
        message,
        userId: currentUser.id,
        userName: currentUser.name,
      };
      return [newLog, ...prev];
    });
  };

  // ─── Login ────────────────────────────────────────────────────────────────
  const login = (email, password) => {
    if (password !== '1234') return { success: false, error: 'Invalid password.' };
    const role = CREDENTIALS[email.toLowerCase().trim()];
    if (!role) return { success: false, error: 'Email not recognised.' };
    // Find corresponding user from state (supports dynamically added teachers/admins)
    const user = users.find(u => u.role === role) || INITIAL_USERS.find(u => u.role === role);
    if (!user) return { success: false, error: 'User record not found.' };
    setCurrentUser(user);
    return { success: true, role };
  };

  const logout = () => setCurrentUser(null);

  // ─── Notifications ────────────────────────────────────────────────────────
  const addNotification = (message, type = 'info') => {
    const notif = {
      id: generateId(),
      message,
      type,
      timestamp: new Date().toISOString(),
      isRead: false,
    };
    setNotifications(prev => [notif, ...prev]);
  };

  const clearNotifications = () => setNotifications([]);

  // ─── Branch CRUD ──────────────────────────────────────────────────────────
  const addBranch = (name) => {
    if (currentUser?.role !== 'admin') return;
    if (branches.some(b => b.name.toLowerCase() === name.toLowerCase())) {
      alert(`A branch named "${name}" already exists.`);
      return;
    }
    const newBranch = { id: generateId(), name };
    setBranches(prev => [...prev, newBranch]);
    addLog(`Added branch: ${name}`);
  };

  const removeBranch = (id) => {
    if (currentUser?.role !== 'admin') return;
    setBranches(prev => prev.filter(b => b.id !== id));
    // Cascade: remove associated teachers and allocations
    setUsers(prev => prev.filter(u => !(u.role === 'teacher' && u.branchId === id)));
    setAllocations(prev => prev.filter(a => a.branchId !== id));
    addLog(`Removed branch ${id} and its teachers/allocations`);
  };

  // ─── Room CRUD ────────────────────────────────────────────────────────────
  const addRoom = (name) => {
    if (currentUser?.role !== 'admin') return;
    if (rooms.some(r => r.name.toLowerCase() === name.toLowerCase())) {
      alert(`A room named "${name}" already exists.`);
      return;
    }
    const newRoom = { id: generateId(), name };
    setRooms(prev => [...prev, newRoom]);
    addLog(`Added room: ${name}`);
  };

  const removeRoom = (id) => {
    if (currentUser?.role !== 'admin') return;
    setRooms(prev => prev.filter(r => r.id !== id));
    // Cascade: remove all allocations in this room
    setAllocations(prev => prev.filter(a => a.roomId !== id));
    addLog(`Removed room ${id} and its allocations`);
  };

  // ─── TimeSlot CRUD ────────────────────────────────────────────────────────
  const addTimeSlot = (startTime, endTime, period) => {
    if (currentUser?.role !== 'admin') return;
    // Build a readable label: "7:00-8:00 AM" style
    const label = `${startTime} - ${endTime}`;
    const newSlot = { id: generateId(), startTime, endTime, label, period: Number(period) };
    setTimeSlots(prev => [...prev, newSlot].sort((a, b) => a.period - b.period));
    addLog(`Added period ${period}: ${label}`);
  };

  const removeTimeSlot = (id) => {
    if (currentUser?.role !== 'admin') return;
    setTimeSlots(prev => prev.filter(s => s.id !== id));
    // Cascade: remove all allocations using this slot
    setAllocations(prev => prev.filter(a => a.slotId !== id));
    addLog(`Removed time slot ${id}`);
  };

  // ─── Teacher CRUD ─────────────────────────────────────────────────────────
  const addTeacher = (name, email, branchId) => {
    if (currentUser?.role !== 'admin') return;
    if (!name || !email || !branchId) return;
    const newTeacher = { id: generateId(), name, email, role: 'teacher', branchId };
    setUsers(prev => [...prev, newTeacher]);
    addLog(`Added teacher: ${name}`);
  };

  const removeTeacher = (id) => {
    if (currentUser?.role !== 'admin') return;
    setUsers(prev => prev.filter(u => u.id !== id));
    addLog(`Removed teacher ${id}`);
  };

  // ─── Admin CRUD ───────────────────────────────────────────────────────────
  const addAdmin = (name, email) => {
    if (currentUser?.role !== 'admin') return;
    const newAdmin = { id: generateId(), name, email, role: 'admin' };
    setUsers(prev => [...prev, newAdmin]);
    addLog(`Added admin: ${name}`);
  };

  const removeAdmin = (id) => {
    if (currentUser?.role !== 'admin') return;
    const adminCount = users.filter(u => u.role === 'admin').length;
    if (adminCount <= 1) {
      alert('Cannot remove the last admin user.');
      return;
    }
    setUsers(prev => prev.filter(u => u.id !== id));
    addLog(`Removed admin ${id}`);
  };

  // ─── Settings ────────────────────────────────────────────────────────────
  const updateSettings = (partial) => {
    setSettings(prev => ({ ...prev, ...partial }));
    addLog(`Updated settings: ${JSON.stringify(partial)}`);
  };

  // ─── Allocation CRUD ──────────────────────────────────────────────────────
  const setAllocation = (day, slotId, roomId, branchId) => {
    if (currentUser?.role !== 'admin') return;
    const branch = branches.find(b => b.id === branchId);
    if (!branch) return;

    setAllocations(prev => {
      // Remove any existing allocation for the same cell (day + slot + room)
      const filtered = prev.filter(
        a => !(a.day === day && a.slotId === slotId && a.roomId === roomId)
      );
      const newAlloc = {
        id: generateId(),
        day,
        slotId,
        roomId,
        branchId,
        subject: branch.name,
        updatedBy: currentUser.id,
        updatedAt: new Date().toISOString(),
      };
      return [...filtered, newAlloc];
    });

    addLog(`Allocated ${branch.name} → ${day}, slot ${slotId}, room ${roomId}`);
  };

  const removeAllocation = (allocationId) => {
    if (currentUser?.role !== 'admin') return;
    setAllocations(prev => prev.filter(a => a.id !== allocationId));
    addLog(`Removed allocation ${allocationId}`);
  };

  const updateAllocationSubject = (allocationId, newSubject) => {
    if (!currentUser) return;

    const allocation = allocations.find(a => a.id === allocationId);
    if (!allocation) return;

    if (currentUser.role === 'teacher') {
      // Bug-fix: guard against teacher with no branch assigned
      if (!currentUser.branchId) {
        alert('Your account has no branch assigned. Contact the admin.');
        return;
      }
      if (currentUser.branchId !== allocation.branchId) {
        alert('You can only edit slots assigned to your own branch.');
        return;
      }
    } else if (currentUser.role !== 'admin') {
      // Students cannot edit
      return;
    }

    setAllocations(prev =>
      prev.map(a =>
        a.id === allocationId
          ? { ...a, subject: newSubject, updatedBy: currentUser.id, updatedAt: new Date().toISOString() }
          : a
      )
    );

    const branch = branches.find(b => b.id === allocation.branchId);
    addLog(`Updated subject to: "${newSubject}"`);
    addNotification(`📝 ${branch?.name} - ${allocation.day} updated: Now '${newSubject}'`, 'info');
  };

  // ─── Reset All Data ───────────────────────────────────────────────────────
  const resetData = async () => {
    try {
      // Send null so the backend resets to its initial data
      await fetch('/api/storage', {
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
      setSettings(INITIAL_SETTINGS);
      setNotifications([]);
    } catch (err) {
      console.error('[Store] resetData failed:', err);
    }
  };

  return (
    <StoreContext.Provider
      value={{
        currentUser, users, branches, rooms, timeSlots, allocations, logs, settings, notifications,
        login, logout,
        addBranch, removeBranch,
        addRoom, removeRoom,
        addTimeSlot, removeTimeSlot,
        addTeacher, removeTeacher,
        addAdmin, removeAdmin,
        updateSettings,
        setAllocation, removeAllocation, updateAllocationSubject,
        addNotification, clearNotifications,
        resetData,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}
