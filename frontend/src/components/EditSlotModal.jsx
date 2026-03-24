import { useState, useEffect } from 'react';

export default function EditSlotModal({ isOpen, onClose, onSave, initialSubject, initialBranchLabel, initialSection }) {
  const [subject,     setSubject]     = useState(initialSubject     || '');
  const [branchLabel, setBranchLabel] = useState(initialBranchLabel || '');
  const [section,     setSection]     = useState(initialSection     || '');

  useEffect(() => {
    setSubject(initialSubject       || '');
    setBranchLabel(initialBranchLabel || '');
    setSection(initialSection       || '');
  }, [initialSubject, initialBranchLabel, initialSection, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!subject.trim()) return;
    onSave(subject.trim(), branchLabel.trim(), section.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
      <div className="bg-white w-full sm:max-w-sm sm:rounded-xl rounded-t-2xl shadow-xl p-5 sm:p-6">
        <h3 className="text-base sm:text-lg font-bold mb-4 text-gray-900">Edit Session Details</h3>

        {/* Subject */}
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Subject / Title
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          className="w-full p-3 border border-gray-300 rounded-lg mb-4 text-black focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          placeholder="e.g. DBMS"
          autoFocus
        />

        {/* Branch label — the text shown in parentheses */}
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Professor Name <span className="normal-case font-normal text-gray-400">(shown in parentheses)</span>
        </label>
        <input
          type="text"
          value={branchLabel}
          onChange={(e) => setBranchLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          className="w-full p-3 border border-gray-300 rounded-lg mb-4 text-black focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          placeholder="e.g. Prof Lov Kumar"
        />

        {/* Section */}
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Section <span className="normal-case font-normal text-gray-400">(e.g. 1, 2, A, B)</span>
        </label>
        <input
          type="text"
          value={section}
          onChange={(e) => setSection(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          className="w-full p-3 border border-gray-300 rounded-lg mb-5 text-black focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          placeholder="e.g. IT-1 or 1"
        />

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-gray-600 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 rounded-lg text-sm font-medium"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 active:bg-blue-800 text-sm font-medium"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
