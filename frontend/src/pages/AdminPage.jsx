import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import ScheduleGrid from '../components/ScheduleGrid.jsx';
import LogViewer from '../components/LogViewer.jsx';
import { useStore } from '../lib/store.jsx';

export default function AdminPage() {
  const navigate = useNavigate();
  const {
    currentUser,
    branches, addBranch, removeBranch,
    rooms, addRoom, removeRoom,
    timeSlots, addTimeSlot, removeTimeSlot,
    users, addTeacher, removeTeacher,
    addAdmin, removeAdmin,
    settings, updateSettings,
    resetData,
  } = useStore();

  const [newBranch, setNewBranch] = useState('');
  const [newRoom, setNewRoom] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [slotDetails, setSlotDetails] = useState({ start: '10:00', end: '11:00', period: 4 });
  const [slotError, setSlotError] = useState('');
  const [teacherForm, setTeacherForm] = useState({ name: '', email: '', branchId: '' });
  const [adminForm, setAdminForm] = useState({ name: '', email: '' });

  useEffect(() => {
    if (rooms.length > 0 && !selectedRoomId) setSelectedRoomId(rooms[0].id);
  }, [rooms, selectedRoomId]);

  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="p-8 text-center">
        Access Denied.{' '}
        <button onClick={() => navigate('/')} className="text-blue-600 underline">Go Home</button>
      </div>
    );
  }

  const handleAddPeriod = () => {
    setSlotError('');
    const result = addTimeSlot(slotDetails.start, slotDetails.end, slotDetails.period);
    if (result && !result.success) setSlotError(result.error);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      <Navbar />

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-6 sm:space-y-8">

        {/* ── Row 1: Rooms · Branches · Periods · Teachers ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">

          {/* Rooms */}
          <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col">
            <h3 className="font-semibold text-gray-800 mb-3 text-sm sm:text-base">Manage Rooms</h3>
            <div className="flex space-x-2 mb-3">
              <input
                className="flex-1 min-w-0 p-2 border rounded-lg text-sm text-black"
                placeholder="e.g. R103"
                value={newRoom}
                onChange={e => setNewRoom(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newRoom.trim()) { addRoom(newRoom.trim()); setNewRoom(''); } }}
              />
              <button
                onClick={() => { if (newRoom.trim()) { addRoom(newRoom.trim()); setNewRoom(''); } }}
                className="shrink-0 bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-indigo-700 active:bg-indigo-800"
              >Add</button>
            </div>
            <div className="flex-1 max-h-36 overflow-y-auto space-y-1">
              {rooms.map(r => (
                <div key={r.id} className="flex justify-between items-center text-sm bg-gray-50 px-2 py-1.5 rounded-lg">
                  <span className="text-gray-700">{r.name}</span>
                  <button onClick={() => removeRoom(r.id)} className="text-red-500 hover:text-red-700 text-lg leading-none ml-2 p-1">×</button>
                </div>
              ))}
            </div>
          </div>

          {/* Branches */}
          <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col">
            <h3 className="font-semibold text-gray-800 mb-3 text-sm sm:text-base">Manage Branches</h3>
            <div className="flex space-x-2 mb-3">
              <input
                className="flex-1 min-w-0 p-2 border rounded-lg text-sm text-black"
                placeholder="e.g. ECE"
                value={newBranch}
                onChange={e => setNewBranch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newBranch.trim()) { addBranch(newBranch.trim()); setNewBranch(''); } }}
              />
              <button
                onClick={() => { if (newBranch.trim()) { addBranch(newBranch.trim()); setNewBranch(''); } }}
                className="shrink-0 bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-indigo-700 active:bg-indigo-800"
              >Add</button>
            </div>
            <div className="flex-1 max-h-36 overflow-y-auto space-y-1">
              {branches.map(b => (
                <div key={b.id} className="flex justify-between items-center text-sm bg-gray-50 px-2 py-1.5 rounded-lg">
                  <span className="text-gray-700">{b.name}</span>
                  <button onClick={() => removeBranch(b.id)} className="text-red-500 hover:text-red-700 text-lg leading-none ml-2 p-1">×</button>
                </div>
              ))}
            </div>
          </div>

          {/* Periods */}
          <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col">
            <h3 className="font-semibold text-gray-800 mb-3 text-sm sm:text-base">Manage Periods</h3>

            <div className="flex items-center gap-2 mb-2">
              <label className="text-xs text-gray-500 shrink-0 w-20">Period No.</label>
              <input
                type="number" min="1"
                className="flex-1 h-9 p-1.5 border rounded-lg text-sm text-black"
                placeholder="e.g. 4"
                value={slotDetails.period}
                onChange={e => { setSlotError(''); setSlotDetails(p => ({ ...p, period: parseInt(e.target.value) || 1 })); }}
              />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-xs text-gray-500 shrink-0 w-20">Start Time</label>
              <input
                type="time"
                className="flex-1 h-9 p-1.5 border rounded-lg text-sm text-black"
                value={slotDetails.start}
                onChange={e => { setSlotError(''); setSlotDetails(p => ({ ...p, start: e.target.value })); }}
              />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-xs text-gray-500 shrink-0 w-20">End Time</label>
              <input
                type="time"
                className="flex-1 h-9 p-1.5 border rounded-lg text-sm text-black"
                value={slotDetails.end}
                onChange={e => { setSlotError(''); setSlotDetails(p => ({ ...p, end: e.target.value })); }}
              />
            </div>

            {slotError && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-2 py-1.5 mb-2 leading-snug">
                ⚠️ {slotError}
              </p>
            )}

            <button
              onClick={handleAddPeriod}
              className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm hover:bg-indigo-700 active:bg-indigo-800 mb-3"
            >
              + Add Period
            </button>

            <div className="flex-1 max-h-36 overflow-y-auto space-y-1">
              {timeSlots.map(s => (
                <div key={s.id} className="flex justify-between items-center text-sm bg-gray-50 px-2 py-1.5 rounded-lg">
                  <span className="text-gray-700 truncate mr-1">P{s.period}: {s.label}</span>
                  <button onClick={() => removeTimeSlot(s.id)} className="text-red-500 hover:text-red-700 text-lg leading-none shrink-0 p-1">×</button>
                </div>
              ))}
            </div>
          </div>

          {/* Teachers */}
          <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-gray-100 flex flex-col">
            <h3 className="font-semibold text-gray-800 mb-3 text-sm sm:text-base">Add Teacher</h3>
            <div className="flex flex-col space-y-2 mb-3">
              <input className="p-2 border rounded-lg text-sm text-black" placeholder="Name"
                value={teacherForm.name} onChange={e => setTeacherForm(f => ({ ...f, name: e.target.value }))} />
              <input className="p-2 border rounded-lg text-sm text-black" placeholder="Email"
                value={teacherForm.email} onChange={e => setTeacherForm(f => ({ ...f, email: e.target.value }))} />
              <select className="p-2 border rounded-lg text-sm text-black"
                value={teacherForm.branchId} onChange={e => setTeacherForm(f => ({ ...f, branchId: e.target.value }))}>
                <option value="">Select Branch...</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <button
                onClick={() => {
                  if (teacherForm.name.trim() && teacherForm.email.trim() && teacherForm.branchId) {
                    addTeacher(teacherForm.name.trim(), teacherForm.email.trim(), teacherForm.branchId);
                    setTeacherForm({ name: '', email: '', branchId: '' });
                  }
                }}
                className="w-full bg-indigo-600 text-white py-2 rounded-lg text-sm hover:bg-indigo-700 active:bg-indigo-800"
              >+ Add Teacher</button>
            </div>
            <div className="flex-1 max-h-28 overflow-y-auto space-y-1">
              {users.filter(u => u.role === 'teacher').map(t => (
                <div key={t.id} className="flex justify-between items-center text-sm bg-gray-50 px-2 py-1.5 rounded-lg">
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium text-gray-800 truncate">{t.name}</span>
                    <span className="text-[10px] text-gray-500">{branches.find(b => b.id === t.branchId)?.name || '—'}</span>
                  </div>
                  <button onClick={() => removeTeacher(t.id)} className="text-red-500 hover:text-red-700 text-lg leading-none ml-2 shrink-0 p-1">×</button>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* ── Admins ── */}
        <div className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4 text-sm sm:text-base">Manage Admins</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1 flex flex-col space-y-2">
              <input className="p-2 border rounded-lg text-sm text-black" placeholder="Admin Name"
                value={adminForm.name} onChange={e => setAdminForm(f => ({ ...f, name: e.target.value }))} />
              <input className="p-2 border rounded-lg text-sm text-black" placeholder="Admin Email"
                value={adminForm.email} onChange={e => setAdminForm(f => ({ ...f, email: e.target.value }))} />
              <button
                onClick={() => {
                  if (adminForm.name.trim() && adminForm.email.trim()) {
                    addAdmin(adminForm.name.trim(), adminForm.email.trim());
                    setAdminForm({ name: '', email: '' });
                  }
                }}
                className="w-full bg-purple-600 text-white py-2 rounded-lg text-sm hover:bg-purple-700 active:bg-purple-800 font-medium"
              >+ Add Admin</button>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-gray-400 mb-2 uppercase tracking-wide font-medium">Current Admins</p>
              <div className="grid grid-cols-1 xs:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {users.filter(u => u.role === 'admin').map(a => (
                  <div key={a.id} className="flex justify-between items-center bg-purple-50 border border-purple-100 px-3 py-2 rounded-xl">
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-semibold text-purple-900 truncate">{a.name}</span>
                      <span className="text-xs text-purple-500 truncate">{a.email}</span>
                    </div>
                    {a.id !== currentUser.id ? (
                      <button onClick={() => removeAdmin(a.id)} className="text-red-400 hover:text-red-600 text-lg leading-none ml-2 shrink-0 p-1">×</button>
                    ) : (
                      <span className="text-[10px] text-purple-400 ml-2 shrink-0 italic">you</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Timetable ── */}
        <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 gap-3">
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900">Room Timetable</h3>
              <p className="text-xs sm:text-sm text-gray-500">Tap a cell to allocate. Tap an allocation to remove.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="p-2 border rounded-lg text-sm text-black bg-white"
                value={selectedRoomId}
                onChange={e => setSelectedRoomId(e.target.value)}
              >
                {rooms.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <button
                onClick={() => updateSettings({ viewOrientation: settings.viewOrientation === 'horizontal' ? 'vertical' : 'horizontal' })}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium text-gray-700 whitespace-nowrap"
              >
                {settings.viewOrientation === 'horizontal' ? '📊 Horizontal' : '📈 Vertical'}
              </button>
            </div>
          </div>

          {selectedRoomId ? (
            <ScheduleGrid roomId={selectedRoomId} />
          ) : (
            <div className="py-16 text-center text-gray-500 border-2 border-dashed rounded-xl">
              Add a room first to start allocating.
            </div>
          )}
        </div>

        {/* ── Logs ── */}
        <LogViewer />

        {/* ── Danger Zone ── */}
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 sm:p-6">
          <h3 className="font-semibold text-red-800 mb-1 text-sm sm:text-base">Danger Zone</h3>
          <p className="text-sm text-red-600 mb-4">
            Resets ALL data (branches, rooms, slots, allocations) to initial defaults.
          </p>
          <button
            onClick={() => {
              if (window.confirm('Are you sure? This will erase ALL data and cannot be undone.')) {
                resetData();
              }
            }}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 active:bg-red-800 text-sm font-medium"
          >
            Reset All Data
          </button>
        </div>

      </main>
    </div>
  );
}
