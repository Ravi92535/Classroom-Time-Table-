import { useState, useRef, useEffect } from 'react';
import { Bell, BellDot, Info, AlertTriangle } from 'lucide-react';
import { useStore } from '../lib/store.jsx';

export default function NotificationCenter() {
  const { notifications, clearNotifications } = useStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setIsOpen(o => !o)}
        className="relative p-2 text-gray-600 hover:text-blue-600 hover:bg-gray-100 rounded-full transition focus:outline-none"
        aria-label="Notifications"
      >
        {unreadCount > 0 ? (
          <>
            <BellDot className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
            <span className="absolute top-1 right-1 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse" />
          </>
        ) : (
          <Bell className="w-5 h-5 sm:w-6 sm:h-6" />
        )}
      </button>

      {/* Dropdown — anchored to right edge, capped so it never overflows screen */}
      {isOpen && (
        <div
          className="
            absolute right-0 mt-2
            w-[calc(100vw-2rem)] max-w-sm
            bg-white rounded-xl shadow-2xl border border-gray-100
            overflow-hidden z-50
          "
        >
          {/* Header */}
          <div className="p-3 sm:p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <div className="flex items-center space-x-2">
              <h3 className="font-semibold text-gray-800 text-sm sm:text-base">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={clearNotifications}
                className="text-xs text-gray-500 hover:text-red-500 font-medium"
              >
                Clear all
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-[55vh] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-400 flex flex-col items-center">
                <Bell className="w-10 h-10 text-gray-200 mb-2" />
                <p className="text-sm">No new notifications</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-50">
                {notifications.map((notif) => (
                  <li
                    key={notif.id}
                    className={`p-3 sm:p-4 hover:bg-gray-50 transition flex items-start space-x-3 ${notif.type === 'alert' ? 'bg-orange-50/50' : ''}`}
                  >
                    <div className="mt-0.5 flex-shrink-0">
                      {notif.type === 'alert'
                        ? <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500" />
                        : <Info className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs sm:text-sm break-words ${notif.type === 'alert' ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                        {notif.message}
                      </p>
                      <p className="text-[10px] sm:text-xs text-gray-400 mt-1">
                        {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
