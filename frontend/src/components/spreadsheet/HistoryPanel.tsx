'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth';

type Props = {
  sheetId: string;
  open: boolean;
  onClose: () => void;
};

export default function HistoryPanel({ sheetId, open, onClose }: Props) {
  const { accessToken } = useAuthStore();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !accessToken || !sheetId) return;

    setLoading(true);
    api(`/audit/sheets/${sheetId}`, { token: accessToken })
      .then((data) => setLogs(Array.isArray(data) ? data : []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [open, sheetId, accessToken]);

  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-white border-l border-slate-200 shadow-xl z-50 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <h2 className="font-semibold text-slate-900 text-sm">Change History</h2>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 text-lg leading-none"
        >
          ×
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading && <p className="text-xs text-slate-400">Loading...</p>}
        {!loading && logs.length === 0 && (
          <p className="text-xs text-slate-400">No history yet</p>
        )}
        {logs.map((log) => (
          <div
            key={log.id}
            className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-slate-700">
                {log.actor?.name || log.actor?.email || 'Someone'}
              </span>
              <span className="text-slate-400">
                {new Date(log.createdAt).toLocaleString()}
              </span>
            </div>
            <p className="text-slate-500">
              {log.action.replace(/_/g, ' ').toLowerCase()}
              {log.resourceId && (
                <span className="ml-1 font-mono text-[10px] text-slate-400">
                  {log.resourceId}
                </span>
              )}
            </p>
            {log.after && (
              <pre className="mt-1 text-[10px] text-slate-400 overflow-x-auto">
                {JSON.stringify(log.after, null, 0).slice(0, 120)}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
