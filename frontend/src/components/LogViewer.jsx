import { useStore } from '../lib/store.jsx';

export default function LogViewer() {
  const { logs } = useStore();

  return (
    <div className="bg-white border rounded-lg shadow-sm p-4 h-64 overflow-y-auto">
      <h3 className="text-lg font-semibold mb-3 sticky top-0 bg-white pb-2 border-b text-gray-800">
        System Logs
      </h3>
      {logs.length === 0 ? (
        <p className="text-gray-400 text-sm">No logs yet.</p>
      ) : (
        <ul className="space-y-2">
          {logs.map((log) => (
            <li key={log.id} className="text-sm border-b border-gray-50 pb-1 last:border-0">
              <div className="flex items-start gap-2">
                {log.sequence && (
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold">
                    {log.sequence}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-gray-400 text-xs mr-2">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="font-medium text-gray-700 mr-1">{log.userName}:</span>
                  <span className="text-gray-600">{log.message}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
