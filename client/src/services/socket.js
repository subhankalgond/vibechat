import { io } from 'socket.io-client';
import { API_BASE, getToken } from './api';

let socket = null;

export function getSocket() {
  return socket;
}

export function connectSocket() {
  const token = getToken();
  if (!token) return null;
  if (socket && socket.connected) return socket;
  if (socket) socket.disconnect();

  socket = io(import.meta.env.VITE_SOCKET_URL || API_BASE || window.location.origin, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnectionAttempts: Infinity,
  });
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
