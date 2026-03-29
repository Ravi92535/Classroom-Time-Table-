import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store.jsx';

export default function RoomSearch() {
  const { rooms, currentUser } = useStore();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const searchRef = useRef(null);

  // Filter rooms based on search input
  const filteredRooms = rooms.filter(room =>
    room.name.toLowerCase().includes(searchInput.toLowerCase())
  );

  // Handle room selection
  const handleSelectRoom = (room) => {
    setSearchInput(room.name);
    setSearchOpen(false);

    // Navigate to timetable page and scroll to the room
    navigate('/timetable');

    // Scroll to room after a small delay to ensure page loads
    setTimeout(() => {
      const roomElement = document.getElementById(`room-${room.id}`);
      if (roomElement) {
        roomElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 300);
  };

  // Close search dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setSearchOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={searchRef}>
      <input
        type="text"
        placeholder="Search room..."
        value={searchInput}
        onChange={(e) => {
          setSearchInput(e.target.value);
        }}
        onFocus={() => searchInput === '' && setSearchOpen(true)}
        onClick={() => setSearchOpen(true)}
        className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-40 sm:w-48"
      />

      {/* Dropdown suggestions */}
      {searchOpen && searchInput.length > 0 && filteredRooms.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
          {filteredRooms.map(room => (
            <button
              key={room.id}
              onClick={() => handleSelectRoom(room)}
              className="w-full text-left px-4 py-2 hover:bg-indigo-50 border-b border-gray-100 last:border-b-0 text-sm text-gray-700"
            >
              {room.name}
            </button>
          ))}
        </div>
      )}

      {/* No results message */}
      {searchOpen && searchInput.length > 0 && filteredRooms.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-50 p-3">
          <p className="text-sm text-gray-500">No rooms found</p>
        </div>
      )}
    </div>
  );
}
