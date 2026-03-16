import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useStore } from '../lib/store.jsx';
import NotificationCenter from './NotificationCenter.jsx';

export default function Navbar() {
  const { currentUser, settings, updateSettings, logout } = useStore();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const toggleOrientation = () =>
    updateSettings({
      viewOrientation: settings.viewOrientation === 'horizontal' ? 'vertical' : 'horizontal',
    });

  if (!currentUser) return null;

  // Role badge colors
  const roleBadgeClass = {
    admin: 'bg-purple-100 text-purple-700',
    teacher: 'bg-green-100 text-green-700',
    student: 'bg-blue-100 text-blue-700',
  }[currentUser.role] || 'bg-gray-100 text-gray-600';

  return (
    <nav className="bg-white border-b border-gray-200 px-4 sm:px-6">
      {/* ── Main bar ── */}
      <div className="flex justify-between items-center h-14">
        {/* Left: logo + role badge */}
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
          <h1 className="text-base sm:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 whitespace-nowrap">
            NIT KKR TIME-TABLE
          </h1>
          <span className={`px-2 py-0.5 rounded text-[10px] sm:text-xs font-medium uppercase tracking-wide whitespace-nowrap ${roleBadgeClass}`}>
            {currentUser.role}
          </span>
        </div>

        {/* Right: desktop controls */}
        <div className="hidden md:flex items-center space-x-3">
          <NotificationCenter />

          <button
            onClick={toggleOrientation}
            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs font-medium text-gray-700 transition whitespace-nowrap"
          >
            {settings.viewOrientation === 'horizontal' ? '📊 Horizontal' : '📈 Vertical'}
          </button>

          {/* Google profile picture + name */}
          <div className="flex items-center gap-2">
            {currentUser.picture ? (
              <img
                src={currentUser.picture}
                alt={currentUser.name}
                className="w-7 h-7 rounded-full border border-gray-200 object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold">
                {currentUser.name?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <span className="text-sm text-gray-700 whitespace-nowrap">
              <span className="font-semibold">{currentUser.name}</span>
            </span>
          </div>

          <button
            onClick={handleLogout}
            className="text-sm text-red-600 hover:text-red-800 font-medium whitespace-nowrap"
          >
            Logout
          </button>
        </div>

        {/* Right: mobile controls */}
        <div className="flex md:hidden items-center space-x-2">
          <NotificationCenter />
          {currentUser.picture ? (
            <img
              src={currentUser.picture}
              alt={currentUser.name}
              className="w-7 h-7 rounded-full border border-gray-200 object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-bold">
              {currentUser.name?.[0]?.toUpperCase() || '?'}
            </div>
          )}
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="p-2 rounded text-gray-600 hover:bg-gray-100"
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* ── Mobile dropdown menu ── */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-100 py-3 space-y-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-sm text-gray-700">
              Hello, <span className="font-semibold">{currentUser.name}</span>
            </span>
          </div>

          <button
            onClick={() => { toggleOrientation(); setMenuOpen(false); }}
            className="w-full text-left px-3 py-2 bg-gray-50 hover:bg-gray-100 rounded text-sm font-medium text-gray-700"
          >
            View: {settings.viewOrientation === 'horizontal' ? '📊 Horizontal' : '📈 Vertical'} (tap to toggle)
          </button>

          <button
            onClick={() => { handleLogout(); setMenuOpen(false); }}
            className="w-full text-left px-3 py-2 bg-red-50 hover:bg-red-100 rounded text-sm font-medium text-red-600"
          >
            Logout
          </button>
        </div>
      )}
    </nav>
  );
}
