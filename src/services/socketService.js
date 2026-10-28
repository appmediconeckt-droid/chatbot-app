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
const AUTH_FAILURE_CODES = new Set([
  'AUTH_TOKEN_EXPIRED',
  'AUTH_TOKEN_INVALID',
  'AUTH_TOKEN_MISSING',
  'AUTH_SESSION_INACTIVE',
  'AUTH_USER_INACTIVE',
]);

class SocketService {
  constructor() {
    this._socket = null;
    this._connectionPromise = null;
    this._reconnectAttempts = 0;
    this._appStateSub = null;
    // The account the socket was opened for (its token's user).
    this._accountId = null;
    // Registered up front, not only after a first successful connect: a resume
    // has to be able to recover a session whose very first connect failed
    // (no network at launch, token not written yet, server briefly down).
    this._setupAppState();
  }

  async connect() {
    // Another account signed in since this socket opened (e.g. a patient
    // logged out without closing it, then a doctor logged in): the socket still
    // carries the old token, so the server sees the wrong user on it and
    // refuses its id for calls ("Your call connection changed. Reconnect and
    // retry."). Open a fresh socket for the signed-in account.
    const account = await this._getAccountId();
    if (this._accountId && account && account !== this._accountId) this._dropSocket();
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
    this._dropSocket();
  }

  _dropSocket() {
    if (this._socket) {
      this._socket.removeAllListeners();
      this._socket.disconnect();
      this._socket = null;
    }
    this._connectionPromise = null;
    this._reconnectAttempts = 0;
    this._accountId = null;
  }

  async emit(event, data) {
    const socket = await this.connect();
    socket.emit(event, data);
  }

  async _getToken() {
    return (
      (await AsyncStorage.getItem('accessToken')) ||
      (await AsyncStorage.getItem('token'))
    );
  }

  async _getAccountId() {
    try {
      const user = JSON.parse((await AsyncStorage.getItem('userData')) || 'null');
      const id = user?._id || user?.id || user?.user?._id || user?.user?.id;
      if (id) return String(id);
    } catch { /* fall back to the plain id key */ }
    const stored = await AsyncStorage.getItem('userId');
    return stored ? String(stored) : null;
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
      const token = await this._getToken();
      const account = await this._getAccountId();

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
        upgrade: true,
        auth: { token },
        // Skip the dev tunnel anti-phishing interstitial on the XHR polling
        // handshake — otherwise the relay returns HTML and socket.io reports
        // "xhr poll error". Applied to the polling transport's requests.
        extraHeaders: { 'X-Tunnel-Skip-AntiPhishing-Page': 'true' },
        transportOptions: {
          polling: {
            extraHeaders: { 'X-Tunnel-Skip-AntiPhishing-Page': 'true' },
          },
        },
        reconnection: true,
        reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: CONNECTION_TIMEOUT_MS,
        path: '/socket.io/',
        withCredentials: true,
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
          this._accountId = account;
          this._setupPersistentListeners(socket);
          this._setupAppState();
          resolve(socket);
        };

        const onError = (err) => {
          this._reconnectAttempts += 1;
          const code = err?.data?.code || err?.message || 'UNKNOWN';
          console.warn(
            `[SocketService] connect_error (attempt ${this._reconnectAttempts}) code=${code}:`,
            err?.message || err,
          );
          if (AUTH_FAILURE_CODES.has(code)) {
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
    socket.io.on('reconnect_attempt', async () => {
      const token = await this._getToken();
      if (token) socket.auth = { token };
    });
    socket.on('connect_error', (err) => {
      const code = err?.data?.code || err?.message || 'UNKNOWN';
      if (AUTH_FAILURE_CODES.has(code)) {
        console.warn(`[SocketService] Auth connect_error after session start: ${code}`);
        socket.disconnect();
      }
    });
    socket.on('reconnect', () => {
      this._reconnectAttempts = 0;
    });
  }

  // Reconnect when the app returns to foreground (RN equivalent of
  // browser visibilitychange).
  // Presence is "socket is connected", so coming back to the foreground without
  // a live socket means the user silently shows as offline to everyone else.
  // This used to call connect() on the socket instance captured at setup time,
  // and was only ever registered AFTER a successful connect — so a socket that
  // died, or one that never connected at all, could never recover on resume.
  // Re-establishing through this.connect() builds a fresh socket with a fresh
  // token instead.
  _setupAppState() {
    this._teardownAppState();
    this._appStateSub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      if (this._socket?.connected) return;
      this.connect().catch(() => { /* offline until the next resume/screen */ });
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
