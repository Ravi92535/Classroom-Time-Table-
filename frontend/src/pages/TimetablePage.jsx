import { useNavigate } from 'react-router-dom';
import ScheduleGrid from '../components/ScheduleGrid.jsx';
import Navbar from '../components/Navbar.jsx';
import { useStore } from '../lib/store.jsx';

export default function TimetablePage() {
  const { rooms, settings, updateSettings, currentUser } = useStore();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {currentUser ? <Navbar /> : (
        <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex justify-between items-center">
          <h1 className="text-base sm:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
            NIT KKR Time-Table
          </h1>
          <button
            onClick={() => navigate('/')}
            className="text-sm text-blue-600 hover:underline font-medium"
          >
            Login →
          </button>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 ">Class Timetable</h1>
            <p className="text-gray-500 mt-1 text-sm">Schedule for all rooms.</p>
          </div>
          <button
            onClick={() => updateSettings({ viewOrientation: settings.viewOrientation === 'horizontal' ? 'vertical' : 'horizontal' })}
            className="self-start sm:self-auto px-4 py-2 bg-white border border-gray-200 rounded-lg shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition whitespace-nowrap"
          >
            {settings.viewOrientation === 'horizontal' ? '📊 Horizontal View' : '📈 Vertical View'}
          </button>
        </div>

        {rooms.length === 0 ? (
          <div className="py-20 text-center text-gray-500 bg-white rounded-xl border border-gray-100 shadow-sm">
            No rooms have been configured yet.
          </div>
        ) : (
          <div className="space-y-6 sm:space-y-8">
            {rooms.map(room => (
              <div key={room.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-4 sm:px-6 py-3 sm:py-4 bg-indigo-50 border-b border-indigo-100 flex items-center space-x-2">
                  <span className="text-base sm:text-lg font-bold text-indigo-800">🏫 {room.name}</span>
                </div>
                <div className="p-2 sm:p-4">
                  <ScheduleGrid roomId={room.id} />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="max-w-7xl mx-auto px-4 text-center text-gray-400 text-xs py-6 border-t border-gray-100 mt-6">
        © {new Date().getFullYear()} Room Allocation System · All Rights Reserved
      </footer>
    </div>
  );
}
