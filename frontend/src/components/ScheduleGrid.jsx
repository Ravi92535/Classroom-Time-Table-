import { useState } from 'react';
import { useStore } from '../lib/store.jsx';
import { DAYS } from '../lib/store.jsx';
import { cn } from '../lib/utils.js';

export default function ScheduleGrid({ roomId, onEditSlot }) {
  const {
    timeSlots, allocations, currentUser, branches,
    settings, setAllocation, removeAllocation,
  } = useStore();

  const [isModalOpen,  setIsModalOpen]  = useState(false);
  const [selectedCell, setSelectedCell] = useState(null);
  const [quickBranchId, setQuickBranchId] = useState('');

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

  const handleCellClick = (event, day, slotId, allocation) => {
    if (currentUser?.role === 'admin') {
      if (allocation) {
        if (window.confirm(`Remove ${getBranchName(allocation.branchId)} from this slot?`)) {
          removeAllocation(allocation.id);
        }
      } else if (roomId) {
        if (quickBranchId) {
          setAllocation(day, slotId, roomId, quickBranchId);
          return;
        }

        setSelectedCell({ day, slotId });
        setIsModalOpen(true);
      }
    } else if (currentUser?.role === 'teacher') {
      if (allocation && isEditable(allocation) && onEditSlot) {
        // ✅ Pass branchLabel too (custom label if set, else the branch name)
        const currentBranchLabel = allocation.branchLabel !== undefined
          ? allocation.branchLabel
          : getBranchName(allocation.branchId);
        onEditSlot(allocation.id, allocation.subject, currentBranchLabel);
      }
    }
  };

  const renderCell = (allocation, editable) => {
    if (!allocation) {
      return currentUser?.role === 'admin'
        ? <span className="text-blue-400 group-hover:opacity-100 opacity-0 transition text-xs">+ Add</span>
        : <span className="text-gray-300 text-xs">—</span>;
    }

    // ✅ Use custom branchLabel if teacher set one, otherwise fall back to branch name
    const displayBranchLabel = allocation.branchLabel !== undefined
      ? allocation.branchLabel
      : getBranchName(allocation.branchId);

    return (
      <div className="flex flex-col items-center gap-0.5">
        <span className="font-semibold text-gray-800 text-xs sm:text-sm leading-tight text-center break-words max-w-[80px] sm:max-w-none">
          {allocation.subject}
        </span>
        {displayBranchLabel && (
          <span className="text-[10px] sm:text-xs text-gray-500 leading-tight">
            ({displayBranchLabel})
          </span>
        )}
        {editable && (
          <span className="mt-0.5 text-[9px] sm:text-[10px] text-blue-600 border border-blue-200 px-1 rounded leading-tight">
            {currentUser?.role === 'admin' ? 'Remove' : 'Edit'}
          </span>
        )}
      </div>
    );
  };

  const cellBase = 'py-2 px-1 sm:px-3 md:px-5 text-xs text-center border-l group align-middle';
  const thBase   = 'py-2 px-1 sm:px-3 md:px-5 text-center text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider';

  const HorizontalTable = () => (
    <table className="min-w-full divide-y divide-gray-200 border border-gray-200 table-fixed">
      <thead className="bg-gray-50">
        <tr>
          <th className="py-2 px-2 sm:px-4 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 w-20 sm:w-28 md:w-36">
            <span className="hidden sm:inline">Period / Day</span>
            <span className="sm:hidden">Pd</span>
          </th>
          {DAYS.map(day => (
            <th key={day} className={thBase}>
              <span className="hidden md:inline">{day}</span>
              <span className="md:hidden">{day.slice(0, 3)}</span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {timeSlots.map(slot => (
          <tr key={slot.id}>
            <td className="py-2 px-2 sm:px-4 text-xs font-medium text-gray-900 sticky left-0 bg-white z-10 w-20 sm:w-28 md:w-36">
              <div className="flex flex-col">
                <span className="font-semibold">P{slot.period}</span>
                <span className="text-[10px] text-gray-400 font-normal leading-tight hidden sm:block">{slot.label}</span>
              </div>
            </td>
            {DAYS.map(day => {
              const alloc    = getCellAllocation(day, slot.id);
              const editable = isEditable(alloc);
              const clickable = currentUser?.role === 'admin' || editable;
              return (
                <td
                  key={`${day}-${slot.id}`}
                  className={cn(
                    cellBase,
                    !alloc ? 'bg-gray-50 text-gray-400' : 'bg-white',
                    clickable ? 'cursor-pointer hover:bg-blue-50 active:bg-blue-100' : ''
                  )}
                  onClick={(e) => handleCellClick(e, day, slot.id, alloc)}
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

  const VerticalTable = () => (
    <table className="min-w-full divide-y divide-gray-200 border border-gray-200 table-fixed">
      <thead className="bg-gray-50">
        <tr>
          <th className="py-2 px-2 sm:px-4 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase tracking-wider sticky left-0 bg-gray-50 z-10 w-16 sm:w-24">
            Day
          </th>
          {timeSlots.map(slot => (
            <th key={slot.id} className={thBase}>
              <span>P{slot.period}</span>
              <br />
              <span className="text-[9px] sm:text-[10px] lowercase text-gray-400 hidden sm:block">{slot.label}</span>
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {DAYS.map(day => (
          <tr key={day}>
            <td className="py-2 px-2 sm:px-4 text-xs font-medium text-gray-900 sticky left-0 bg-white z-10 w-16 sm:w-24">
              <span className="hidden sm:inline">{day}</span>
              <span className="sm:hidden">{day.slice(0, 3)}</span>
            </td>
            {timeSlots.map(slot => {
              const alloc    = getCellAllocation(day, slot.id);
              const editable = isEditable(alloc);
              const clickable = currentUser?.role === 'admin' || editable;
              return (
                <td
                  key={`${day}-${slot.id}`}
                  className={cn(
                    cellBase,
                    !alloc ? 'bg-gray-50 text-gray-400' : 'bg-white',
                    clickable ? 'cursor-pointer hover:bg-blue-50 active:bg-blue-100' : ''
                  )}
                  onClick={(e) => handleCellClick(e, day, slot.id, alloc)}
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
      {currentUser?.role === 'admin' && (
        <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-2 flex flex-wrap items-center gap-2">
          <label className="text-xs font-medium text-gray-600">Quick Allocate</label>
          <select
            className="p-1 border border-gray-300 rounded text-xs"
            value={quickBranchId}
            onChange={e => setQuickBranchId(e.target.value)}
          >
            <option value="">Select branch (manual modal fallback)</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          {quickBranchId && (
            <button
              onClick={() => setQuickBranchId('')}
              className="text-xs px-2 py-1 bg-red-100 border border-red-200 rounded text-red-600"
            >Clear branch</button>
          )}
          <span className="text-xs text-gray-500">
            {quickBranchId ? `Using ${branches.find(b => b.id === quickBranchId)?.name} for clicks` : 'No quick branch selected'}
          </span>
        </div>
      )}

      <p className="sm:hidden text-[10px] text-gray-400 mb-1 text-right">← scroll to see all days →</p>

      <div className="overflow-x-auto -mx-1">
        {settings.viewOrientation === 'horizontal' ? <HorizontalTable /> : <VerticalTable />}
      </div>

      {/* Branch-picker modal (admin only) */}
      {isModalOpen && selectedCell && roomId && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="bg-white w-full sm:rounded-lg sm:max-w-md shadow-xl p-5 rounded-t-2xl">
            <h3 className="text-base font-bold mb-1">Allocate Period</h3>
            <p className="text-sm text-gray-500 mb-4">
              {selectedCell.day} — Period {timeSlots.find(s => s.id === selectedCell.slotId)?.period}
            </p>
            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
              {branches.map(branch => (
                <button
                  key={branch.id}
                  onClick={() => {
                    setAllocation(selectedCell.day, selectedCell.slotId, roomId, branch.id);
                    setIsModalOpen(false);
                  }}
                  className="p-3 border rounded-md text-sm hover:bg-indigo-50 hover:border-indigo-300 active:bg-indigo-100 transition font-medium text-left"
                >
                  {branch.name}
                </button>
              ))}
            </div>
            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-5 py-2 text-sm text-gray-600 hover:text-gray-800 bg-gray-100 rounded-md"
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
