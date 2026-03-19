import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import ScheduleGrid from '../components/ScheduleGrid.jsx';
import EditSlotModal from '../components/EditSlotModal.jsx';
import { useStore } from '../lib/store.jsx';

export default function TeacherPage() {
  const { currentUser, updateAllocationSubject, branches, rooms, isLoaded } = useStore();
  const navigate = useNavigate();

  const [isModalOpen,        setIsModalOpen]        = useState(false);
  const [selectedAllocation, setSelectedAllocation] = useState(null);

  if (!currentUser || currentUser.role !== 'teacher') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 sm:p-8 bg-gray-50">
        <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg max-w-md w-full border border-red-100 text-center">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">🚫</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4 text-sm sm:text-base">This page is for Teachers only.</p>
          {currentUser?.role === 'admin' && (
            <p className="text-amber-600 text-sm mb-4">
              ⚠️ Admins don't have a personal teacher schedule. Create a separate teacher account.
            </p>
          )}
          <button
            onClick={() => navigate(currentUser?.role === 'admin' ? '/admin' : '/')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
          >
            Go to {currentUser?.role === 'admin' ? 'Admin Dashboard' : 'Home'}
          </button>
        </div>
      </div>
    );
  }

  // ✅ Receive all three: id, subject, branchLabel
  const handleEditSlot = (id, subject, branchLabel) => {
    setSelectedAllocation({ id, subject, branchLabel });
    setIsModalOpen(true);
  };

  // ✅ Pass both newSubject and newBranchLabel to the store
  const handleSaveSlot = (newSubject, newBranchLabel) => {
    if (selectedAllocation) {
      updateAllocationSubject(selectedAllocation.id, newSubject, newBranchLabel);
    }
  };

  const branchName = branches.find(b => b.id === currentUser.branchId)?.name || 'your assigned';

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-4 sm:space-y-6">

        <div className="bg-blue-50 border-l-4 border-blue-500 p-3 sm:p-4 rounded">
          <p className="text-sm text-blue-700">
            You are logged in as a <strong>Teacher</strong> for the <strong>{branchName}</strong> branch.
            Tap slots assigned to your branch to edit.
          </p>
        </div>

        {!isLoaded ? (
          <div className="py-16 text-center text-gray-500 bg-white rounded-xl border border-gray-100 shadow-sm">
            Loading room data...
          </div>
        ) : rooms.length === 0 ? (
          <div className="py-16 text-center text-gray-500 bg-white rounded-xl border border-gray-100 shadow-sm">
            No rooms have been configured yet.
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {rooms.map(room => (
              <div key={room.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-4 sm:px-6 py-3 sm:py-4 bg-blue-50 border-b border-blue-100">
                  <span className="text-base sm:text-lg font-bold text-blue-800">🏫 {room.name}</span>
                </div>
                <div className="p-2 sm:p-4">
                  <ScheduleGrid roomId={room.id} onEditSlot={handleEditSlot} />
                </div>
              </div>
            ))}
          </div>
        )}

      </main>

      {/* ✅ initialBranchLabel is now passed correctly */}
      <EditSlotModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveSlot}
        initialSubject={selectedAllocation?.subject || ''}
        initialBranchLabel={selectedAllocation?.branchLabel || ''}
      />
    </div>
  );
}
