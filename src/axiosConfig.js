// screens/auth/axiosConfig.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// API endpoints for different environments
const API_ENDPOINTS = {
  // Must match the SAME backend the web frontend uses (chatbot/.env.local)
  // so OTP / email / forgot-password behave identically to web.
  DEV_TUNNEL: 'https://ggr8bl1d-5001.inc1.devtunnels.ms/',
  RAILWAY: 'https://chatbot-backend-production-ea76.up.railway.app',
  LOCAL_5001: 'http://localhost:5001',
  LOCAL_5000: 'http://localhost:5000',
  LOCAL_3000: 'http://localhost:3000',
};

// Base URL for API - Change here to switch between environments
// NOTE: On a real phone / Android emulator, 'localhost' points to the device,
// NOT your PC. Use DEV_TUNNEL so the app can reach your backend.
// Options: 'RAILWAY' (cloud, always-on, all features), 'RENDER' (cloud, cold-starts),
//          'DEV_TUNNEL' (local PC tunnel), 'LOCAL_5001' (iOS sim / web only)
// NOTE: 'localhost' only works on iOS simulator or web. On a REAL PHONE or
// Android emulator, localhost = the device itself, not your PC — use DEV_TUNNEL.
// USB debugging on a real phone: `adb reverse tcp:5001 tcp:5001` maps the
// phone's localhost:5001 to the PC's backend over the cable — no internet or
// dev tunnel needed on the device. Switch to DEV_TUNNEL only for wireless/release.
export const API_BASE_URL = API_ENDPOINTS.RAILWAY;

// Create axios instance with default config
const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    // Dev tunnels serve an HTML anti-phishing interstitial to requests that look
    // like browser navigations, instead of forwarding to the backend. That HTML
    // reaches the app as a "Network Error". This header tells the relay to skip
    // the interstitial and forward straight through. Harmless on non-tunnel hosts.
    'X-Tunnel-Skip-AntiPhishing-Page': 'true',
  },
  withCredentials: true, // Important for cookies/sessions
});

// Request interceptor to add token to headers
axiosInstance.interceptors.request.use(
  async (config) => {
    try {
      const token =
        (await AsyncStorage.getItem('accessToken')) ||
        (await AsyncStorage.getItem('token'));
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
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
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/refresh-token',
  '/api/auth/google',
  '/api/auth/verify-login-otp',
];

axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const url = originalRequest?.url || '';
    const isAuthRoute = NO_REFRESH_PATHS.some((p) => url.includes(p));

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
            headers: { 'X-Tunnel-Skip-AntiPhishing-Page': 'true' },
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

        // Clear tokens and redirect to login
        await AsyncStorage.multiRemove([
          'accessToken',
          'token',
          'refreshToken',
          'userData',
          'userId',
          'userRole',
          'counsellorId',
          'counselorId',
        ]);
        
        // You can add navigation here if needed
        // navigationRef.current?.navigate('UserSignup');
        
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
