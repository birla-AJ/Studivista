/**
 * api.js  —  base HTTP + Socket client
 * Base HTTP and Socket.IO client for the Studivista server.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { io } from 'socket.io-client';

// ← Change this to your Oracle Cloud server IP
//export const SERVER_URL = 'http://13.60.95.135:3000'; // AWS EC2 instance
export const SERVER_URL = 'http://144.24.114.0:3000'; // oracle cloud instance

// ─── Socket singleton ─────────────────────────────────────────────────────
let _socket = null;

export const getSocket = () => {
  if (!_socket) {
    _socket = io(SERVER_URL, {
      transports: ['websocket'],
      autoConnect: true,
      auth: async cb => cb({ token: await AsyncStorage.getItem('sv_token') }),
    });
    _socket.on('connect',       () => console.log('✅ Socket:', _socket.id));
    _socket.on('disconnect',    () => console.log('❌ Socket disconnected'));
    _socket.on('connect_error', e  => console.warn('Socket error:', e.message));
  }
  return _socket;
};

export const disconnectSocket = () => {
  if (!_socket) return;
  _socket.removeAllListeners();
  _socket.disconnect();
  _socket = null;
};

// ─── Authenticated HTTP helper ────────────────────────────────────────────
export const apiFetch = async (path, options = {}) => {
  const token = await AsyncStorage.getItem('sv_token');
  const res   = await fetch(`${SERVER_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
};

// ─── Real-time subscription helper ───────────────────────────────────────
// Mimics Firestore onSnapshot — returns unsubscribe fn
export const subscribeChannel = (channel, event, cb) => {
  const socket = getSocket();
  socket.emit('subscribe', { channel });
  socket.on(event, cb);
  return () => {
    socket.emit('unsubscribe', { channel });
    socket.off(event, cb);
  };
};
