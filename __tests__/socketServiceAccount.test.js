import AsyncStorage from '@react-native-async-storage/async-storage';
import { io } from 'socket.io-client';
import { forceSignOut } from '../src/utils/authSession';
import { socketService } from '../src/services/socketService';

const mockStore = {};
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key) => Promise.resolve(mockStore[key] ?? null)),
}));
jest.mock('react-native', () => ({ AppState: { addEventListener: () => ({ remove: () => {} }) } }));
jest.mock('../src/axiosConfig', () => ({ API_BASE_URL: 'https://api.test' }));
jest.mock('../src/utils/authSession', () => ({ forceSignOut: jest.fn(() => Promise.resolve()) }));

let mockSockets = [];
let mockConnectError = null;
jest.mock('socket.io-client', () => ({
  io: jest.fn((_url, options) => {
    const handlers = {};
    const socket = {
      id: `socket-${mockSockets.length + 1}`,
      token: options.auth.token,
      connected: false,
      io: { on: () => {} },
      on: (event, fn) => { handlers[event] = fn; },
      once: (event, fn) => { handlers[event] = fn; },
      off: () => {},
      removeAllListeners: jest.fn(),
      disconnect: jest.fn(),
    };
    mockSockets.push(socket);
    // Connects on the next tick, like a real handshake.
    setTimeout(() => {
      if (mockConnectError) handlers.connect_error?.(mockConnectError);
      else {
        socket.connected = true;
        handlers.connect?.();
      }
    }, 0);
    return socket;
  }),
}));

const signIn = (id, token) => {
  mockStore.userData = JSON.stringify({ _id: id });
  mockStore.accessToken = token;
};

describe('socket service account switch', () => {
  beforeEach(() => {
    mockSockets = [];
    mockConnectError = null;
    jest.clearAllMocks();
    socketService.disconnect();
  });

  it('keeps one socket for the same account', async () => {
    signIn('patient-1', 'patient-token');
    const first = await socketService.connect();
    const again = await socketService.connect();
    expect(again).toBe(first);
    expect(io).toHaveBeenCalledTimes(1);
  });

  it('opens a fresh socket with the new token when another account signs in', async () => {
    signIn('patient-1', 'patient-token');
    const patientSocket = await socketService.connect();
    // Logged out without closing the socket, then a doctor signed in.
    signIn('doctor-1', 'doctor-token');
    const doctorSocket = await socketService.connect();
    expect(doctorSocket).not.toBe(patientSocket);
    expect(doctorSocket.token).toBe('doctor-token');
    expect(patientSocket.disconnect).toHaveBeenCalled();
  });

  it('does not reconnect for a refreshed token of the same account', async () => {
    signIn('doctor-1', 'token-a');
    const first = await socketService.connect();
    signIn('doctor-1', 'token-b');
    expect(await socketService.connect()).toBe(first);
    expect(AsyncStorage.getItem).toHaveBeenCalled();
  });

  it('signs out when the backend rejects the old device session', async () => {
    signIn('doctor-1', 'invalidated-token');
    mockConnectError = {
      message: 'Unauthorized',
      data: { code: 'AUTH_SESSION_INACTIVE', status: 401 },
    };

    await expect(socketService.connect()).rejects.toMatchObject({
      code: 'AUTH_SESSION_INACTIVE',
    });

    expect(forceSignOut).toHaveBeenCalledWith({ reason: 'otherDevice' });
    expect(mockSockets[0].disconnect).toHaveBeenCalled();
  });
});
