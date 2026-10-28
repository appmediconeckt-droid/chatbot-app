// screens/auth/axiosConfig.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { forceSignOut } from './utils/authSession';
import { isTokenExpired } from './utils/tokenExpiry';


const API_ENDPOINTS = {
  // RAILWAY: 'https://chatbot-backend-production-82fb.up.railway.app',
  RAILWAY: 'https://humaeli-backend-update-production.up.railway.app',
  // DevTunnels: 'https://s5jl7g4z-5002.inc1.devtunnels.ms',
  // The web dashboard's backend (doctor rating, walk-in statuses, …).
  DEVTUNNEL_5006: 'https://s5jl7g4z-5006.inc1.devtunnels.ms',
  // DevTunnels: 'https://s5jl7g4z-5005.inc1.devtunnels.ms',
  // DevTunnels: 'https://m429gbrg-5003.inc1.devtunnels.ms',
  LOCAL_ADB_5002: 'http://127.0.0.1:5002',
  LOCAL_5001: 'http://localhost:5001',
  LOCAL_5000: 'http://localhost:5000',
  LOCAL_3000: 'http://localhost:3000',
};

// Dev builds use the web's backend (DevTunnels 5006): it has features Railway
// doesn't yet — doctor ratings averaged into rating/ratingCount, doctor
// payment methods. Release builds stay on Railway.
export const API_BASE_URL = __DEV__
  ? API_ENDPOINTS.RAILWAY
  : API_ENDPOINTS.RAILWAY;
export const AI_REALTIME_BASE_URL = API_BASE_URL.replace(/\/+$/, '');
export const TUNNEL_HEADERS = API_BASE_URL.includes('devtunnels.ms')
  ? { 'X-Tunnel-Skip-AntiPhishing-Page': 'true' }
  : {};
Object.assign(axios.defaults.headers.common, TUNNEL_HEADERS);
const PUBLIC_AUTH_PATHS = [
  '/api/auth/login',
  // NOT '/api/auth/logout': the backend route is behind authMiddleware, so it needs the
  // Bearer token. Listing it here stripped the header and made every logout 401.
  // logout-other-devices is public on the backend, so keep it listed explicitly.
  '/api/auth/logout-other-devices',
  '/api/auth/refresh-token',
  '/api/auth/google',
  '/api/auth/verify-login-otp',
  '/api/auth/send-email-otp',
  '/api/auth/verify-email-otp',
  '/api/auth/complete-registration',
  '/api/auth/generateOtp',
  '/api/auth/verifyOtp',
  '/api/auth/resendOtp',
  '/api/auth/set-password-by-otp',
  '/api/auth/setPassword',
  '/api/auth/changePassword',
  '/api/auth/send-forgot-password-otp',
  '/api/auth/verify-forgot-password-otp',
  '/api/auth/reset-password',
];

// Create axios instance with default config
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    ...TUNNEL_HEADERS,
  },
  withCredentials: true,
});

// sdjsdjsdjsdd
axiosInstance.interceptors.request.use(
  async (config) => {
    try {
      const url = config?.url || '';
      const isPublicAuthRoute = PUBLIC_AUTH_PATHS.some((path) => url.includes(path));
      if (isPublicAuthRoute) {
        delete config.headers.Authorization;
      } else {
        const token =
          (await AsyncStorage.getItem('accessToken')) ||
          (await AsyncStorage.getItem('token'));
        if (token && isTokenExpired(token)) {
          // Expired session = log out, not a silent refresh (the refresh token
          // never expires, so refreshing would keep the user signed in forever).
          await forceSignOut({ reason: 'expired' });
          return Promise.reject(new axios.CanceledError('Session expired'));
        }
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
    } catch (error) {
      console.log('Error getting token:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

const AUTH_RESPONSE_PATHS = [
  ...PUBLIC_AUTH_PATHS,
];

const isBackendRequest = (config = {}) => {
  const url = String(config?.url || '');
  const baseURL = String(config?.baseURL || '');
  const normalizedApiBase = API_BASE_URL.replace(/\/+$/, '');

  return (
    url.startsWith('/api/') ||
    url.startsWith(`${normalizedApiBase}/api/`) ||
    baseURL.replace(/\/+$/, '') === normalizedApiBase
  );
};

const handleUnauthorizedResponse = async (error) => {
  const url = String(error?.config?.url || '');
  const isAuthRoute = AUTH_RESPONSE_PATHS.some((path) => url.includes(path));

  if (error?.response?.status === 401 && isBackendRequest(error?.config) && !isAuthRoute) {
    await forceSignOut();
  }

  return Promise.reject(error);
};

axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    if (error.response?.status === 401) return handleUnauthorizedResponse(error);
    // Handle network errors
    if (error.message === 'Network Error') {
      console.log('Network error occurred');

    }

    return Promise.reject(error);
  }
);

// A few older screens still use Axios' default export directly. Cover those
// backend requests too, otherwise an invalidated old-device session only shows
// "Request failed with status code 401" instead of returning to Login.
axios.interceptors.response.use(
  (response) => response,
  handleUnauthorizedResponse,
);

export default axiosInstance;
