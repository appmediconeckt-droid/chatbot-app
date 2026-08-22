// screens/auth/axiosConfig.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { forceSignOut } from './utils/authSession';

// API endpoints for different environments
// NOTE: no trailing slash — callers append `/api/...`, so a trailing slash here
// would produce a double slash (`...ms//api/...`) and break routing.
const API_ENDPOINTS = {
  // Must match the SAME backend the web frontend uses (chatbot/.env.local)
  // so OTP / email / forgot-password behave identically to web.
  
  DEV_TUNNEL: 'https://s5jl7g4z-5001.inc1.devtunnels.ms',
  RAILWAY: 'https://chatbot-backend-production-82fb.up.railway.app',
  LOCAL_ADB_5002: 'http://127.0.0.1:5002',
  LOCAL_5001: 'http://localhost:5001',
  LOCAL_5000: 'http://localhost:5000',
  LOCAL_3000: 'http://localhost:3000',
};

export const API_BASE_URL = API_ENDPOINTS.RAILWAY;
export const AI_REALTIME_BASE_URL = API_ENDPOINTS.RAILWAY.replace(/\/+$/, '');
export const TUNNEL_HEADERS = API_BASE_URL.includes('devtunnels.ms')
  ? { 'X-Tunnel-Skip-AntiPhishing-Page': 'true' }
  : {};

Object.assign(axios.defaults.headers.common, TUNNEL_HEADERS);

// Public auth endpoints should not carry a stale mobile session token. Web can
// often get away with this, but React Native/XHR can surface a closed/rejected
// request as a generic "Network Error" with no response body.
const PUBLIC_AUTH_PATHS = [
  '/api/auth/login',
  '/api/auth/logout',
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

// Request interceptor to add token to headers
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

// Response interceptor to handle token refresh
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

// Endpoints where a 401 means "wrong credentials / not logged in" rather than
// "session expired" — refreshing for these would loop or surface confusing
// errors during logout flows.
const NO_REFRESH_PATHS = [
  ...PUBLIC_AUTH_PATHS,
  // OTP + password routes: a 401 here means "wrong OTP / wrong password", not a
  // dead session. Without them the interceptor would treat a mistyped OTP as an
  // expired session and sign the user out mid-flow.
];

axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const url = originalRequest?.url || '';
    const isAuthRoute = NO_REFRESH_PATHS.some((p) => url.includes(p));

    // This backend returns 404 (instead of 401) when a session has been
    // invalidated by a logout/sign-in on another device. If this device still
    // has credentials, treat that response as an ended session and leave the
    // protected screen immediately. Auth routes are excluded because a 404
    // there is a genuine endpoint/account error and must remain visible.
    if (error.response?.status === 404 && !isAuthRoute) {
      const [accessToken, legacyToken] = await Promise.all([
        AsyncStorage.getItem('accessToken'),
        AsyncStorage.getItem('token'),
      ]);

      if (accessToken || legacyToken) {
        await forceSignOut({ silent: true });
        return Promise.reject(error);
      }
    }

    // Handle 401 errors (unauthorized)
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !isAuthRoute
    ) {
      // Skip refresh entirely if no token exists — propagate the original 401
      // so the caller sees "Unauthorized", not a fabricated
      // "No refresh token available" message.
      const refreshToken = await AsyncStorage.getItem('refreshToken');
      if (!refreshToken) {
        // No refresh token but we still hold an access token means this device
        // thought it was logged in and the server disagrees — another device
        // signed in and took the session. Bounce to login instead of leaving
        // the user on a dashboard that 401s on every request.
        const hadSession = await AsyncStorage.getItem('accessToken');
        if (hadSession) await forceSignOut();
        return Promise.reject(error);
      }

      console.log('🔥 401 Interceptor triggered');

      if (isRefreshing) {
        // If already refreshing, queue the request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return axiosInstance(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        console.log('🔄 Calling refresh-token API');

        const response = await axios.post(
          `${API_BASE_URL}/api/auth/refresh-token`,
          { refreshToken },
          {
            withCredentials: true,
            headers: TUNNEL_HEADERS,
          }
        );

        const { accessToken, refreshToken: newRefreshToken } = response.data;

        if (!accessToken) throw new Error('No access token received');

        // Save new tokens
        await AsyncStorage.setItem('accessToken', accessToken);
        if (newRefreshToken) {
          await AsyncStorage.setItem('refreshToken', newRefreshToken);
        }

        console.log('✅ Token refreshed successfully');

        // Process queued requests
        processQueue(null, accessToken);

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        console.log('❌ Refresh failed:', refreshError);

        // Process queue with error
        processQueue(refreshError, null);

        // Clears the stored session AND resets navigation to Login. Clearing
        // alone was the old behaviour, and it left the app sitting on a
        // dashboard it could no longer load.
        await forceSignOut();

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Handle network errors
    if (error.message === 'Network Error') {
      console.log('Network error occurred');
      // You can show a network error message here
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
