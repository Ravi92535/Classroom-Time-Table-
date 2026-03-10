import { useState, useEffect } from 'react';

/**
 * EditSlotModal – lets a teacher (or admin) change the subject label of a slot.
 */
export default function EditSlotModal({ isOpen, onClose, onSave, initialSubject }) {
  const [subject, setSubject] = useState(initialSubject);

  // Sync when the parent opens with a new subject
  useEffect(() => {
    setSubject(initialSubject);
  }, [initialSubject, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!subject.trim()) return;
    onSave(subject.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm">
        <h3 className="text-lg font-bold mb-4 text-gray-900">Edit Session Details</h3>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          className="w-full p-2 border border-gray-300 rounded mb-4 text-black focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Enter subject or activity..."
          autoFocus
        />
        <div className="flex justify-end space-x-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
