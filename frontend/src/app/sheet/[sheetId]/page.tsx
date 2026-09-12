'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { getSocket, disconnectSocket } from '@/lib/socket';
import SpreadsheetGrid from '@/components/spreadsheet/SpreadsheetGrid';
import HistoryPanel from '@/components/spreadsheet/HistoryPanel';
import { Socket } from 'socket.io-client';

export default function SheetPage() {
  const params = useParams();
  const router = useRouter();
  const sheetId = params.sheetId as string;
  const { accessToken, user } = useAuthStore();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!accessToken) {
      router.push('/');
      return;
    }

    const s = getSocket(accessToken);
    setSocket(s);
  }, [accessToken, sheetId]);

  function handleBack() {
    disconnectSocket();
    router.push('/dashboard');
  }

  if (!accessToken) return null;

  return (
    <div className="h-screen flex flex-col bg-slate-100">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="text-sm text-slate-600 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-100"
          >
            ← Back
          </button>
          <div className="h-5 w-px bg-slate-200" />
          <h1 className="text-sm font-semibold text-slate-900">Spreadsheet</h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowHistory(true)}
            className="text-xs px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
          >
            History
          </button>
          <span className="text-xs text-slate-500">{user?.email}</span>
          <div className="w-2 h-2 rounded-full bg-emerald-500" title="Connected" />
        </div>
      </header>

      {error && (
        <div className="px-4 py-2 bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      {/* Spreadsheet */}
      <div className="flex-1 p-3 min-h-0">
        <SpreadsheetGrid
          sheetId={sheetId}
          socket={socket}
          userId={user?.id}
          userName={user?.name || user?.email || 'User'}
          rows={50}
          cols={20}
        />
      </div>

      <HistoryPanel
        sheetId={sheetId}
        open={showHistory}
        onClose={() => setShowHistory(false)}
      />
    </div>
  );
}
