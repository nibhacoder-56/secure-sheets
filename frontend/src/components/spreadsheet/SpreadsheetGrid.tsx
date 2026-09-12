'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';

export type CellData = {
  value: string;
  // future: format, formula, etc.
};

type Props = {
  sheetId: string;
  socket: Socket | null;
  userId?: string;
  userName?: string;
  rows?: number;
  cols?: number;
  readOnly?: boolean;
};

function colLabel(index: number): string {
  let label = '';
  let n = index;
  while (n >= 0) {
    label = String.fromCharCode((n % 26) + 65) + label;
    n = Math.floor(n / 26) - 1;
  }
  return label;
}

function cellRef(row: number, col: number): string {
  return `${colLabel(col)}${row + 1}`;
}

export default function SpreadsheetGrid({
  sheetId,
  socket,
  userId,
  userName = 'User',
  rows = 40,
  cols = 15,
  readOnly = false,
}: Props) {
  const [data, setData] = useState<Record<string, CellData>>({});
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [cursors, setCursors] = useState<
    Record<string, { cellRef?: string; name?: string; userId?: string }>
  >({});
  const inputRef = useRef<HTMLInputElement>(null);
  const isEditing = activeCell !== null;

  // Join sheet room
  useEffect(() => {
    if (!socket || !sheetId) return;

    socket.emit('sheet:join', { sheetId }, (res: any) => {
      if (res?.error) {
        console.error('Failed to join sheet:', res.error);
      } else {
        console.log('Joined sheet', sheetId, res);
      }
    });

    const onYjsUpdate = (payload: { sheetId: string; update: any; from: string }) => {
      if (payload.sheetId !== sheetId || payload.from === userId) return;
      // For now we treat update as a simple cell patch
      if (payload.update?.type === 'cell') {
        const { ref, value } = payload.update;
        setData((prev) => ({
          ...prev,
          [ref]: { value: value ?? '' },
        }));
      }
    };

    const onCursor = (payload: {
      socketId: string;
      userId?: string;
      cellRef?: string;
      name?: string;
    }) => {
      if (payload.userId === userId) return;
      setCursors((prev) => ({
        ...prev,
        [payload.socketId]: {
          cellRef: payload.cellRef,
          name: payload.name,
          userId: payload.userId,
        },
      }));
    };

    const onLeave = (payload: { socketId: string }) => {
      setCursors((prev) => {
        const next = { ...prev };
        delete next[payload.socketId];
        return next;
      });
    };

    const onForceLeave = (payload: { sheetId: string; reason: string }) => {
      if (payload.sheetId === sheetId) {
        alert('You no longer have access to this sheet.');
        window.location.href = '/dashboard';
      }
    };

    socket.on('yjs:update', onYjsUpdate);
    socket.on('presence:cursor', onCursor);
    socket.on('presence:leave', onLeave);
    socket.on('sheet:force-leave', onForceLeave);

    return () => {
      socket.emit('sheet:leave', { sheetId });
      socket.off('yjs:update', onYjsUpdate);
      socket.off('presence:cursor', onCursor);
      socket.off('presence:leave', onLeave);
      socket.off('sheet:force-leave', onForceLeave);
    };
  }, [socket, sheetId, userId]);

  // Focus input when editing
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing, activeCell]);

  const broadcastCell = useCallback(
    (ref: string, value: string) => {
      if (!socket) return;
      socket.emit('yjs:update', {
        sheetId,
        update: { type: 'cell', ref, value },
      });
    },
    [socket, sheetId],
  );

  const broadcastCursor = useCallback(
    (ref?: string) => {
      if (!socket) return;
      socket.emit('presence:cursor', {
        sheetId,
        cellRef: ref,
        name: userName,
      });
    },
    [socket, sheetId, userName],
  );

  function startEdit(row: number, col: number) {
    if (readOnly) return;
    const ref = cellRef(row, col);
    setActiveCell({ row, col });
    setEditValue(data[ref]?.value ?? '');
    broadcastCursor(ref);
  }

  function commitEdit() {
    if (!activeCell) return;
    const ref = cellRef(activeCell.row, activeCell.col);
    const newValue = editValue;

    setData((prev) => ({
      ...prev,
      [ref]: { value: newValue },
    }));
    broadcastCell(ref, newValue);
    setActiveCell(null);
    setEditValue('');
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!activeCell) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
      // move down
      const nextRow = Math.min(activeCell.row + 1, rows - 1);
      startEdit(nextRow, activeCell.col);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      commitEdit();
      const nextCol = e.shiftKey
        ? Math.max(activeCell.col - 1, 0)
        : Math.min(activeCell.col + 1, cols - 1);
      startEdit(activeCell.row, nextCol);
    } else if (e.key === 'Escape') {
      setActiveCell(null);
      setEditValue('');
    }
  }

  // Find which remote cursors are on a given cell
  function getCursorsOnCell(ref: string) {
    return Object.entries(cursors).filter(([, c]) => c.cellRef === ref);
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white border border-slate-200 rounded-lg shadow-sm">
      {/* Formula bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 bg-slate-50">
        <span className="text-xs font-mono text-slate-500 w-12">
          {activeCell ? cellRef(activeCell.row, activeCell.col) : ''}
        </span>
        <input
          ref={inputRef}
          className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-sky-500"
          value={isEditing ? editValue : ''}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitEdit}
          placeholder="Enter value..."
          disabled={readOnly || !activeCell}
        />
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto">
        <table className="border-collapse min-w-full">
          <thead>
            <tr>
              <th className="sticky top-0 left-0 z-20 w-10 h-7 bg-slate-100 border border-slate-200 text-[10px] text-slate-400" />
              {Array.from({ length: cols }).map((_, col) => (
                <th
                  key={col}
                  className="sticky top-0 z-10 min-w-[100px] h-7 bg-slate-100 border border-slate-200 text-xs font-medium text-slate-500"
                >
                  {colLabel(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, row) => (
              <tr key={row}>
                <td className="sticky left-0 z-10 w-10 h-7 bg-slate-50 border border-slate-200 text-center text-[10px] text-slate-400 font-medium">
                  {row + 1}
                </td>
                {Array.from({ length: cols }).map((_, col) => {
                  const ref = cellRef(row, col);
                  const cell = data[ref];
                  const isActive =
                    activeCell?.row === row && activeCell?.col === col;
                  const remoteCursors = getCursorsOnCell(ref);

                  return (
                    <td
                      key={col}
                      onClick={() => startEdit(row, col)}
                      className={`relative h-7 min-w-[100px] border border-slate-200 px-1.5 text-sm cursor-cell transition-colors ${
                        isActive
                          ? 'ring-2 ring-sky-500 ring-inset bg-sky-50'
                          : remoteCursors.length > 0
                            ? 'bg-amber-50'
                            : 'hover:bg-slate-50'
                      }`}
                    >
                      {isActive ? (
                        <span className="text-transparent select-none">
                          {editValue || ' '}
                        </span>
                      ) : (
                        <span className="truncate block">{cell?.value}</span>
                      )}

                      {/* Remote cursor indicators */}
                      {remoteCursors.map(([sid, c]) => (
                        <div
                          key={sid}
                          className="absolute -top-5 left-0 z-30 px-1.5 py-0.5 text-[10px] font-medium text-white bg-amber-500 rounded shadow-sm whitespace-nowrap"
                        >
                          {c.name || 'User'}
                        </div>
                      ))}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-500">
        <span>
          {Object.keys(cursors).length > 0
            ? `${Object.keys(cursors).length} other user(s) viewing`
            : 'Only you'}
        </span>
        <span className="font-mono">{sheetId.slice(0, 8)}…</span>
      </div>
    </div>
  );
}
