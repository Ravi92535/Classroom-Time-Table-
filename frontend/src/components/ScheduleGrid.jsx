import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { DAYS } from '../lib/store.jsx';
import { cn } from '../lib/utils.js';

/**
 * ScheduleGrid
 *
 * Props:
 *   roomId     – (optional) filter allocations to a specific room.
 *               When omitted the grid shows all rooms (student/public view).
 *   onEditSlot – (optional) callback(allocationId, currentSubject) for teacher edits.
 */
export default function ScheduleGrid({ roomId, onEditSlot }) {
  const {
    timeSlots, allocations, currentUser, branches,
    settings, setAllocation, removeAllocation,
  } = useStore();

  const [isModalOpen,   setIsModalOpen]   = useState(false);
  const [selectedCell,  setSelectedCell]  = useState(null); // { day, slotId }

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const getCellAllocation = (day, slotId) =>
    allocations.find(
      a => a.day === day && a.slotId === slotId && (roomId ? a.roomId === roomId : true)
    );

  const isEditable = (allocation) => {
    if (!currentUser || !allocation) return false;
    if (currentUser.role === 'admin') return true;
    if (currentUser.role === 'teacher') return currentUser.branchId === allocation.branchId;
    return false;
  };

  const getBranchName = (branchId) =>
    branches.find(b => b.id === branchId)?.name || branchId;

  // ── Cell click handler ────────────────────────────────────────────────────────
  const handleCellClick = (day, slotId, allocation) => {
    if (currentUser?.role === 'admin') {
      if (allocation) {
        if (window.confirm(`Remove ${getBranchName(allocation.branchId)} from this slot?`)) {
          removeAllocation(allocation.id);
        }
      } else if (roomId) {
        // Open branch-picker modal
        setSelectedCell({ day, slotId });
        setIsModalOpen(true);
      }
    } else if (currentUser?.role === 'teacher') {
      if (allocation && isEditable(allocation) && onEditSlot) {
        onEditSlot(allocation.id, allocation.subject);
      }
    }
  };

  // ── Cell content renderer ────────────────────────────────────────────────────
  const renderCell = (allocation, editable) => {
    if (!allocation) {
      return currentUser?.role === 'admin'
        ? <span className="text-blue-400 group-hover:opacity-100 opacity-0 transition">+ Add</span>
        : <span className="text-gray-300">—</span>;
    }
    return (
      <div className="flex flex-col items-center">
        <span className="font-semibold text-gray-800">{allocation.subject}</span>
        <span className="text-xs text-gray-500">({getBranchName(allocation.branchId)})</span>
        {editable && (
          <span className="mt-1 text-[10px] text-blue-600 border border-blue-200 px-1 rounded">
            {currentUser?.role === 'admin' ? 'Remove' : 'Edit'}
          </span>
        )}
      </div>
    );
  };

  // ── Table orientation: horizontal (periods as rows) ──────────────────────────
  const HorizontalTable = () => (
    <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">
            Period / Day
          </th>
          {DAYS.map(day => (
            <th key={day} className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              {day}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {timeSlots.map(slot => (
          <tr key={slot.id}>
            <td className="px-6 py-4 text-sm font-medium text-gray-900 sticky left-0 bg-white shadow-sm whitespace-nowrap">
              <div className="flex flex-col">
                <span>Period {slot.period}</span>
                <span className="text-xs text-gray-400 font-normal">{slot.label}</span>
              </div>
            </td>
            {DAYS.map(day => {
              const alloc = getCellAllocation(day, slot.id);
              const editable = isEditable(alloc);
              const clickable = currentUser?.role === 'admin' || editable;
              return (
                <td
                  key={`${day}-${slot.id}`}
                  className={cn(
                    'px-6 py-4 text-sm text-center border-l group whitespace-nowrap',
                    !alloc ? 'bg-gray-50 text-gray-400' : 'bg-white',
                    clickable ? 'cursor-pointer hover:bg-blue-50' : ''
                  )}
                  onClick={() => handleCellClick(day, slot.id, alloc)}
                >
                  {renderCell(alloc, editable)}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );

  // ── Table orientation: vertical (days as rows) ───────────────────────────────
  const VerticalTable = () => (
    <table className="min-w-full divide-y divide-gray-200 border border-gray-200">
      <thead className="bg-gray-50">
        <tr>
          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10">
            Day / Period
          </th>
          {timeSlots.map(slot => (
            <th key={slot.id} className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
              P{slot.period}<br />
              <span className="text-[10px] lowercase text-gray-400">{slot.label}</span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {DAYS.map(day => (
          <tr key={day}>
            <td className="px-6 py-4 text-sm font-medium text-gray-900 sticky left-0 bg-white whitespace-nowrap">
              {day}
            </td>
            {timeSlots.map(slot => {
              const alloc = getCellAllocation(day, slot.id);
              const editable = isEditable(alloc);
              const clickable = currentUser?.role === 'admin' || editable;
              return (
                <td
                  key={`${day}-${slot.id}`}
                  className={cn(
                    'px-6 py-4 text-sm text-center border-l group whitespace-nowrap',
                    !alloc ? 'bg-gray-50 text-gray-400' : 'bg-white',
                    clickable ? 'cursor-pointer hover:bg-blue-50' : ''
                  )}
                  onClick={() => handleCellClick(day, slot.id, alloc)}
                >
                  {renderCell(alloc, editable)}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <>
      <div className="overflow-x-auto">
        {settings.viewOrientation === 'horizontal' ? <HorizontalTable /> : <VerticalTable />}
      </div>

      {/* Branch-picker modal (admin only) */}
      {isModalOpen && selectedCell && roomId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-2">Allocate Period</h3>
            <p className="text-sm text-gray-500 mb-4">
              {selectedCell.day} — Period {timeSlots.find(s => s.id === selectedCell.slotId)?.period}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {branches.map(branch => (
                <button
                  key={branch.id}
                  onClick={() => {
                    setAllocation(selectedCell.day, selectedCell.slotId, roomId, branch.id);
                    setIsModalOpen(false);
                  }}
                  className="p-3 border rounded-md text-sm hover:bg-indigo-50 hover:border-indigo-300 transition text-left font-medium"
                >
                  {branch.name}
                </button>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
