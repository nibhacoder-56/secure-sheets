'use client';

import { io, Socket } from 'socket.io-client';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:4000';

let socket: Socket | null = null;

export function getSocket(token: string): Socket {
  if (socket?.connected) return socket;

  socket = io(`${WS_URL}/sheets`, {
    auth: { token },
    transports: ['websocket', 'polling'],
    autoConnect: true,
  });

  socket.on('connect', () => {
    console.log('[WS] connected', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('[WS] disconnected', reason);
  });

  socket.on('connect_error', (err) => {
    console.error('[WS] connect error', err.message);
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
