import axios from 'axios';
import axiosInstance from '../src/axiosConfig';
import { forceSignOut } from '../src/utils/authSession';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));
jest.mock('../src/utils/authSession', () => ({ forceSignOut: jest.fn() }));
jest.mock('../src/utils/tokenExpiry', () => ({ isTokenExpired: jest.fn(() => false) }));

const responseErrorHandler = axiosInstance.interceptors.response.handlers[0].rejected;
const defaultAxiosErrorHandler = axios.interceptors.response.handlers.at(-1).rejected;

describe('axios session expiry handling', () => {
  beforeEach(() => jest.clearAllMocks());

  it('signs out immediately on the first protected 401 response', async () => {
    const error = {
      config: { url: '/api/appointments', headers: {} },
      response: { status: 401, data: { message: 'Unauthorized' } },
    };

    await expect(responseErrorHandler(error)).rejects.toBe(error);

    expect(forceSignOut).toHaveBeenCalledTimes(1);
  });

  it('does not sign out for an authentication endpoint 401', async () => {
    const error = {
      config: { url: '/api/auth/google', headers: {} },
      response: { status: 401, data: { message: 'Login failed' } },
    };

    await expect(responseErrorHandler(error)).rejects.toBe(error);

    expect(forceSignOut).not.toHaveBeenCalled();
  });

  it('signs out when a protected request uses the default axios export', async () => {
    const error = {
      config: { url: 'https://humaeli-backend-update-production.up.railway.app/api/chat/chats' },
      response: { status: 401, data: { message: 'Unauthorized' } },
    };

    await expect(defaultAxiosErrorHandler(error)).rejects.toBe(error);

    expect(forceSignOut).toHaveBeenCalledTimes(1);
  });

  it('ignores unrelated external 401 responses from default axios', async () => {
    const error = {
      config: { url: 'https://example.com/private' },
      response: { status: 401 },
    };

    await expect(defaultAxiosErrorHandler(error)).rejects.toBe(error);

    expect(forceSignOut).not.toHaveBeenCalled();
  });
});
