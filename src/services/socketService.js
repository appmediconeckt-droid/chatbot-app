// src/services/socketService.js
// Singleton Socket.IO client for the RN app. Mirrors web's services/socketService.js.
// One shared socket per app session — screens subscribe/unsubscribe to events
// without creating duplicate connections. Backend marks the authenticated user
// "online" when the socket connects and "offline" on disconnect, so keeping one
// long-lived socket alive is what makes presence work correctly.

import { io } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { API_BASE_URL } from '../axiosConfig';

const CONNECTION_TIMEOUT_MS = 20_000;
const MAX_RECONNECT_ATTEMPTS = 5;

class SocketService {
  constructor() {
    this._socket = null;
    this._connectionPromise = null;
    this._reconnectAttempts = 0;
    this._appStateSub = null;
  }

  async connect() {
    if (this._socket?.connected) return this._socket;
    if (this._connectionPromise) return this._connectionPromise;
    this._connectionPromise = this._establish();
    return this._connectionPromise;
  }

  getSocket() {
    return this._socket;
  }

  isConnected() {
    return this._socket?.connected === true;
  }

  disconnect() {
    this._teardownAppState();
    if (this._socket) {
      this._socket.removeAllListeners();
      this._socket.disconnect();
      this._socket = null;
    }
    this._connectionPromise = null;
    this._reconnectAttempts = 0;
  }

  async emit(event, data) {
    const socket = await this.connect();
    socket.emit(event, data);
  }

  async on(event, handler) {
    const socket = await this.connect();
    socket.on(event, handler);
    return () => socket.off(event, handler);
  }

  off(event, handler) {
    if (this._socket) {
      this._socket.off(event, handler);
    }
  }

  async _establish() {
    try {
      const token =
        (await AsyncStorage.getItem('accessToken')) ||
        (await AsyncStorage.getItem('token'));

      if (!token) {
        this._connectionPromise = null;
        throw new Error('[SocketService] No auth token — cannot connect');
      }

      if (this._socket) {
        this._socket.removeAllListeners();
        this._socket.disconnect();
        this._socket = null;
      }

      const socket = io(API_BASE_URL, {
        transports: ['polling', 'websocket'],
        auth: { token },
        reconnection: true,
        reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: CONNECTION_TIMEOUT_MS,
        path: '/socket.io/',
        forceNew: false,
        autoConnect: true,
      });

      return new Promise((resolve, reject) => {
        const cleanup = () => {
          clearTimeout(timer);
          socket.off('connect', onConnect);
          socket.off('connect_error', onError);
        };

        const timer = setTimeout(() => {
          cleanup();
          this._connectionPromise = null;
          reject(new Error('[SocketService] Connection timed out'));
        }, CONNECTION_TIMEOUT_MS + 2000);

        const onConnect = () => {
          cleanup();
          this._reconnectAttempts = 0;
          this._connectionPromise = null;
          this._socket = socket;
          this._setupPersistentListeners(socket);
          this._setupAppState(socket);
          resolve(socket);
        };

        const onError = (err) => {
          this._reconnectAttempts += 1;
          const code = err?.data?.code || err?.message || 'UNKNOWN';
          console.warn(
            `[SocketService] connect_error (attempt ${this._reconnectAttempts}) code=${code}:`,
            err?.message || err,
          );
          if (
            code === 'AUTH_TOKEN_EXPIRED' ||
            code === 'AUTH_TOKEN_INVALID' ||
            code === 'AUTH_TOKEN_MISSING' ||
            code === 'AUTH_USER_INACTIVE'
          ) {
            cleanup();
            this._connectionPromise = null;
            socket.disconnect();
            const fatal = new Error(`[SocketService] Auth failed: ${code}`);
            fatal.code = code;
            reject(fatal);
            return;
          }
          if (this._reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            cleanup();
            this._connectionPromise = null;
            reject(err);
          }
        };

        socket.once('connect', onConnect);
        socket.on('connect_error', onError);
      });
    } catch (err) {
      this._connectionPromise = null;
      throw err;
    }
  }

  _setupPersistentListeners(socket) {
    socket.on('disconnect', (reason) => {
      console.warn('[SocketService] Disconnected:', reason);
    });
    socket.on('reconnect', () => {
      this._reconnectAttempts = 0;
    });
  }

  // Reconnect when the app returns to foreground (RN equivalent of
  // browser visibilitychange).
  _setupAppState(socket) {
    this._teardownAppState();
    this._appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !socket.connected) {
        socket.connect();
      }
    });
  }

  _teardownAppState() {
    if (this._appStateSub) {
      this._appStateSub.remove?.();
      this._appStateSub = null;
    }
  }
}

export const socketService = new SocketService();
export default socketService;
