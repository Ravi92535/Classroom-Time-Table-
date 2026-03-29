import { useState } from 'react';
import { useStore } from '../lib/store.jsx';

const PYTHON_API =
  typeof window !== 'undefined' && window.location.hostname !== 'localhost'
    ? 'https://room-llm-service.onrender.com'
    : 'https://room-llm-service.onrender.com';

// ── tiny local generateId (avoids importing from utils if path differs) ───────
const genId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

export default function TimetableImporter() {
  const { branches, rooms, timeSlots, currentUser } = useStore();

  // ── form state ──────────────────────────────────────────────────────────────
  const [file, setFile]               = useState(null);
  const [branch, setBranch]           = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [semester, setSemester]       = useState('');

  // ── UI state ────────────────────────────────────────────────────────────────
  const [loading, setLoading]         = useState(false);
  const [progress, setProgress]       = useState('');
  const [parsedData, setParsedData]   = useState(null);   // array | null
  const [error, setError]             = useState('');
  const [assigning, setAssigning]     = useState(false);
  const [assignResult, setAssignResult] = useState('');

  // live rooms ref (needed inside handleAssign without stale closure)
  const liveRooms = rooms;

  // ── derive API base same way as store ───────────────────────────────────────
  const API_BASE =
    typeof window !== 'undefined' && window.location.hostname !== 'localhost'
      ? 'https://classroom-time-table.vercel.app'
      : 'http://localhost:3001';

  // ── Step 1: parse PDF via Python service ────────────────────────────────────
  const handleParse = async () => {
    if (!file || !branch || !searchQuery.trim() || !semester.trim()) {
      setError('All four fields are required before parsing.');
      return;
    }
    setError('');
    setParsedData(null);
    setAssignResult('');
    setLoading(true);
    setProgress('Uploading PDF to parser service…');

    try {
      const form = new FormData();
      form.append('file', file);
      form.append('branch', branch);
      form.append('search_query', searchQuery.trim());
      form.append('semester', semester.trim());

      setProgress('AI is reading the timetable — this can take a few minutes…');
      console.log(`[Importer] Sending PDF to: ${PYTHON_API}/parse-timetable`);
      const res  = await fetch(`${PYTHON_API}/parse-timetable`, { method: 'POST', body: form });
      const json = await res.json();
      console.log('[Importer] Received response:', json);

      if (!res.ok) throw new Error(json.detail || 'Parsing failed');
      if (!json.data?.length) throw new Error('No timetable entries were found. Check your search query.');

      setParsedData(json.data);
      setProgress('');
    } catch (e) {
      setError(e.message);
      setProgress('');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: push parsed entries to Node API as allocations ──────────────────
  const handleAssign = async () => {
    if (!parsedData?.length) return;
    setAssigning(true);
    setAssignResult('');

    try {
      const itemsToImport = [];
      let localSkipped = 0;
      const localSkipReasons = [];

      for (const entry of parsedData) {
        // ── 1. resolve branch ──────────────────────────────────────────────────
        const branchObj = branches.find(
          b => b.name.toLowerCase() === (entry.branch || '').toLowerCase()
        );
        if (!branchObj) {
          localSkipReasons.push(`No branch "${entry.branch}" (${entry.day})`);
          localSkipped++;
          continue;
        }

        // ── 2. resolve time slot by period number ─────────────────────────────
        const periodNum = parseInt((entry.period || '').replace(/\D/g, '') || '0', 10);
        const slot = timeSlots.find(s => s.period === periodNum);
        if (!slot) {
          localSkipReasons.push(`No period P${periodNum} configured (${entry.day})`);
          localSkipped++;
          continue;
        }

        // ── 3. build labels ───────────────────────────────────────────────────
        const subjectLabel = entry.subject || '';
        const profLabel    = entry.teacher || '';
        const sectionLabel = entry.section ? `${branchObj.name}-${entry.section}` : branchObj.name;

        itemsToImport.push({
          id:          genId(),
          day:         entry.day,
          slotId:      slot.id,
          roomName:    entry.room, // Note: passing roomName, backend will resolve/create
          branchId:    branchObj.id,
          subject:     subjectLabel,
          branchLabel: profLabel,
          section:     sectionLabel,
        });
      }

      if (itemsToImport.length === 0) {
          let msg = `0 allocations created. ${localSkipped} skipped.`;
          if (localSkipReasons.length > 0) {
            msg += '\n' + localSkipReasons.slice(0, 3).map(r => `  • ${r}`).join('\n');
            if (localSkipReasons.length > 3) msg += `\n  …and ${localSkipReasons.length - 3} more`;
          }
          setAssignResult(msg);
          setAssigning(false);
          return;
      }

      // ── 4. send batch request to backend ──────────────────────────────────
      const res = await fetch(`${API_BASE}/api/allocations/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: itemsToImport,
          updatedBy: currentUser?.id || 'ai-import'
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Batch import failed');

      const totalSkipped = localSkipped + (json.skipped || 0);
      const allSkipReasons = [...localSkipReasons, ...(json.skipReasons || [])];

      let msg = `✅ ${json.created} allocation${json.created !== 1 ? 's' : ''} created.`;
      if (totalSkipped > 0) msg += ` ${totalSkipped} skipped.`;
      if (allSkipReasons.length > 0) {
        msg += '\n' + allSkipReasons.slice(0, 3).map(r => `  • ${r}`).join('\n');
        if (allSkipReasons.length > 3) msg += `\n  …and ${allSkipReasons.length - 3} more`;
      }
      setAssignResult(msg);
    } catch (e) {
      console.error('Batch assign error:', e);
      setAssignResult(`❌ Error: ${e.message}`);
    } finally {
      setAssigning(false);
    }
  };

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <div className="bg-white p-4 sm:p-6 rounded-xl shadow-sm border border-gray-100 space-y-5">
      {/* Header */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          🤖 AI Timetable Import
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Upload a timetable PDF — the AI will extract all slots.
          Review the results then click <strong>Assign</strong> to fill the timetable automatically.
        </p>
      </div>

      {/* ── Form ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

        {/* PDF upload */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Timetable PDF <span className="text-red-400">*</span>
          </label>
          <input
            type="file"
            accept=".pdf"
            onChange={e => { setFile(e.target.files[0] || null); setError(''); }}
            className="block w-full text-sm text-gray-700
              file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0
              file:bg-indigo-50 file:text-indigo-700 file:text-sm file:font-medium
              hover:file:bg-indigo-100 cursor-pointer"
          />
          {file && <p className="text-xs text-gray-400 mt-1">📄 {file.name}</p>}
        </div>

        {/* Branch selector */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Branch <span className="text-red-400">*</span>
          </label>
          <select
            className="w-full p-2 border rounded-lg text-sm text-black bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
            value={branch}
            onChange={e => setBranch(e.target.value)}
          >
            <option value="">Select branch…</option>
            {branches.map(b => (
              <option key={b.id} value={b.name}>{b.name}</option>
            ))}
          </select>
        </div>

        {/* Semester */}
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Semester <span className="text-red-400">*</span>
          </label>
          <input
            className="w-full p-2 border rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="e.g. 6"
            value={semester}
            onChange={e => setSemester(e.target.value)}
          />
        </div>

        {/* Search query */}
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Search Query <span className="text-red-400">*</span>
            <span className="text-gray-400 font-normal ml-1">
              — text in the PDF that marks the start of this branch's section
            </span>
          </label>
          <input
            className="w-full p-2 border rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-indigo-400"
            placeholder="e.g. B.Tech (Information Technology)"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-start gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Progress */}
      {progress && (
        <div className="text-sm text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2 flex items-center gap-2">
          <span className="animate-spin">⏳</span>
          <span>{progress}</span>
        </div>
      )}

      {/* Parse button */}
      <button
        onClick={handleParse}
        disabled={loading}
        className="w-full bg-indigo-600 text-white py-2.5 rounded-lg text-sm font-medium
          hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed
          transition-colors"
      >
        {loading ? '⏳ Parsing… (may take a few minutes)' : '🔍 Parse PDF with AI'}
      </button>

      {/* ── Results Preview ── */}
      {parsedData && !loading && (
        <div className="space-y-3">

          {/* Header row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-gray-800">
                {parsedData.length} slot{parsedData.length !== 1 ? 's' : ''} extracted
              </p>
              <p className="text-xs text-gray-400">
                Review below, then click Assign to write them to the timetable.
              </p>
            </div>
            <button
              onClick={handleAssign}
              disabled={assigning}
              className="shrink-0 px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold
                hover:bg-green-700 active:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors"
            >
              {assigning ? '⏳ Assigning…' : '📥 Assign Timetable'}
            </button>
          </div>

          {/* Assign result */}
          {assignResult && (
            <pre className="text-xs text-green-800 bg-green-50 border border-green-200 rounded-lg px-3 py-2 whitespace-pre-wrap">
              {assignResult}
            </pre>
          )}

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
            <table className="min-w-full text-xs">
              <thead className="bg-gray-50 text-gray-600 uppercase tracking-wide">
                <tr>
                  {['Day', 'Period', 'Subject', 'Teacher', 'Room', 'Section'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left font-semibold border-b border-gray-200">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {parsedData.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-2 font-medium text-gray-700 whitespace-nowrap">{row.day}</td>
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{row.period}</td>
                    <td className="px-3 py-2 text-gray-900 font-semibold">{row.subject || '—'}</td>
                    <td className="px-3 py-2 text-gray-600">{row.teacher || '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="inline-block bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded font-mono text-[11px]">
                        {row.room || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-500">{row.section || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
