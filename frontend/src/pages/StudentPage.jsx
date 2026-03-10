import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import ScheduleGrid from '../components/ScheduleGrid.jsx';
import { useStore } from '../lib/store.jsx';

export default function StudentPage() {
  const { currentUser, rooms } = useStore();
  const navigate = useNavigate();

  if (!currentUser) {
    return (
      <div className="p-8 text-center">
        Please{' '}
        <button onClick={() => navigate('/')} className="text-blue-600 underline">log in</button>
        {' '}to view the timetable.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 space-y-4 sm:space-y-6">

        <div className="bg-green-50 border-l-4 border-green-500 p-3 sm:p-4 rounded">
          <p className="text-sm text-green-700">
            You are viewing the <strong>Student</strong> timetable. All allocated classes are shown below.
          </p>
        </div>

        {rooms.length === 0 ? (
          <div className="py-16 text-center text-gray-500 bg-white rounded-xl border border-gray-100 shadow-sm">
            No rooms have been configured yet.
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {rooms.map(room => (
              <div key={room.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-4 sm:px-6 py-3 sm:py-4 bg-green-50 border-b border-green-100 flex items-center space-x-2">
                  <span className="text-base sm:text-lg font-bold text-green-800">🏫 {room.name}</span>
                </div>
                <div className="p-2 sm:p-4">
                  <ScheduleGrid roomId={room.id} />
                </div>
              </div>
            ))}
          </div>
        )}

      </main>
    </div>
  );
}
