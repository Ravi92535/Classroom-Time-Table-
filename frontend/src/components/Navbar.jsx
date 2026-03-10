import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store.jsx';
import NotificationCenter from './NotificationCenter.jsx';

export default function Navbar() {
  const { currentUser, settings, updateSettings, logout } = useStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!currentUser) return null;

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3 flex justify-between items-center">
      <div className="flex items-center space-x-4">
        <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
          Room Allocation
        </h1>
        <span className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-600 font-medium uppercase tracking-wide">
          {currentUser.role}
        </span>
      </div>

      <div className="flex items-center space-x-4">
        <NotificationCenter />

        <div className="flex items-center space-x-2 border-r pr-4">
          <span className="text-xs text-gray-600">View:</span>
          <button
            onClick={() =>
              updateSettings({
                viewOrientation: settings.viewOrientation === 'horizontal' ? 'vertical' : 'horizontal',
              })
            }
            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs font-medium text-gray-700 transition"
          >
            {settings.viewOrientation === 'horizontal' ? '📊 Horizontal' : '📈 Vertical'}
          </button>
        </div>

        <span className="text-sm text-gray-700">
          Hello, <span className="font-semibold">{currentUser.name}</span>
        </span>

        <button
          onClick={handleLogout}
          className="text-sm text-red-600 hover:text-red-800 font-medium"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}
