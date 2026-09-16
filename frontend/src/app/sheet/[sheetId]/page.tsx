'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { getSocket, disconnectSocket } from '@/lib/socket';
import SpreadsheetGrid from '@/components/spreadsheet/SpreadsheetGrid';
import HistoryPanel from '@/components/spreadsheet/HistoryPanel';
import { api } from '@/lib/api';
import { Socket } from 'socket.io-client';

export default function SheetPage() {
  const params = useParams();
  const router = useRouter();
  const sheetId = params.sheetId as string;
  const { accessToken, user } = useAuthStore();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [sheetPassword, setSheetPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [sheetName, setSheetName] = useState('Sheet');

  useEffect(() => {
    if (!accessToken) {
      router.push('/');
      return;
    }

    // Check if sheet needs password
    api(`/sheets/${sheetId}/info`, { token: accessToken })
      .then((info) => {
        setSheetName(info.name || 'Sheet');
        if (info.passwordProtected) {
          setNeedsPassword(true);
        } else {
          setUnlocked(true);
        }
      })
      .catch(() => {
        // If info fails, still try to open
        setUnlocked(true);
      });

    const s = getSocket(accessToken);
    setSocket(s);
  }, [accessToken, sheetId]);

  async function handleUnlock(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError('');
    try {
      const res = await api(`/sheets/${sheetId}/verify-password`, {
        method: 'POST',
        token: accessToken!,
        body: JSON.stringify({ password: sheetPassword }),
      });
      if (res.valid) {
        setUnlocked(true);
        setNeedsPassword(false);
      } else {
        setPasswordError('Wrong password');
      }
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to verify');
    }
  }

  async function setPassword() {
    const pwd = prompt('Set sheet password (leave empty to remove):');
    if (pwd === null) return;
    try {
      await api(`/sheets/${sheetId}/password`, {
        method: 'POST',
        token: accessToken!,
        body: JSON.stringify({ password: pwd || null }),
      });
      alert(pwd ? 'Password set' : 'Password removed');
    } catch (err: any) {
      alert(err.message);
    }
  }

  function handleBack() {
    disconnectSocket();
    router.push('/dashboard');
  }

  if (!accessToken) return null;

  if (needsPassword && !unlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <form onSubmit={handleUnlock} className="bg-white p-8 rounded-xl shadow-lg w-full max-w-sm space-y-4">
          <h1 className="text-xl font-semibold text-center">Protected Sheet</h1>
          <p className="text-sm text-slate-500 text-center">Enter the sheet password to continue</p>
          <input
            type="password"
            value={sheetPassword}
            onChange={(e) => setSheetPassword(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
            placeholder="Sheet password"
            autoFocus
          />
          {passwordError && <p className="text-sm text-red-600">{passwordError}</p>}
          <button type="submit" className="w-full py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700">
            Unlock
          </button>
          <button type="button" onClick={handleBack} className="w-full text-sm text-slate-500">
            Back to dashboard
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-100">
      <header className="flex items-center justify-between px-4 py-2 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="text-sm text-slate-600 hover:text-slate-900 px-2 py-1 rounded hover:bg-slate-100"
          >
            ← Back
          </button>
          <div className="h-5 w-px bg-slate-200" />
          <h1 className="text-sm font-semibold text-slate-900">{sheetName}</h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={setPassword}
            className="text-xs px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
          >
            Set Password
          </button>
          <button
            onClick={() => setShowHistory(true)}
            className="text-xs px-3 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
          >
            History
          </button>
          <span className="text-xs text-slate-500">{user?.email}</span>
          <div className="w-2 h-2 rounded-full bg-emerald-500" title="Connected" />
        </div>
      </header>

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
