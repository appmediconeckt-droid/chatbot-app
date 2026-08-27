import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { API_BASE_URL, TUNNEL_HEADERS } from "../../axiosConfig";

export const PUBLIC_AUTH_TIMEOUT_MS = 30000;
export const PUBLIC_AUTH_OTP_TIMEOUT_MS = 12000;
const PUBLIC_AUTH_ORIGINS = [
  { baseURL: API_BASE_URL, headers: TUNNEL_HEADERS },
  { baseURL: 'https://m429gbrg-5001.inc1.devtunnels.ms', headers: { 'X-Tunnel-Skip-AntiPhishing-Page': 'true' } },
];

const FAST_AUTH_ENDPOINTS = [
  'generateOtp',
  'resendOtp',
  'verifyOtp',
  'send-email-otp',
  'verify-email-otp',
  'send-forgot-password-otp',
  'verify-forgot-password-otp',
  'logout-other-devices',
  'verify-login-otp',
];

const getPublicAuthTimeout = (endpoint, timeout) => {
  if (timeout) return timeout;
  return FAST_AUTH_ENDPOINTS.includes(endpoint)
    ? PUBLIC_AUTH_OTP_TIMEOUT_MS
    : PUBLIC_AUTH_TIMEOUT_MS;
};

const isNetworkLevelError = (error) => {
  return (
    !error?.response &&
    error?.code !== 'ECONNABORTED' &&
    error?.code !== 'ERR_CANCELED'
  );
};

export const setUserEmail = async (email) => {
  await AsyncStorage.setItem("userEmail", email);
};

export const getUserEmail = async () => {
  return AsyncStorage.getItem("userEmail");
};

export const updateVerificationStatus = async (status) => {
  await AsyncStorage.setItem("isVerified", String(status));
};

export const getVerificationStatus = async () => {
  return (await AsyncStorage.getItem("isVerified")) === "true";
};

export const setAccessToken = async (token) => {
  await AsyncStorage.setItem("accessToken", token);
  await AsyncStorage.setItem("token", token);
};

export const getAccessToken = async () => {
  let token = await AsyncStorage.getItem("accessToken");
  if (!token) token = await AsyncStorage.getItem("token");
  return token;
};

export const getAuthToken = getAccessToken;

export const isOtpSessionMissingMessage = (message = '') => {
  const normalized = String(message).toLowerCase();
  return (
    /no\s*otp\s*found/.test(normalized) ||
    /otp\s*(?:not|no)\s*(?:found|available|present)/.test(normalized) ||
    /request\s+new\s+otp/.test(normalized) ||
    /resend\s+otp/.test(normalized) ||
    /otp\s*expired/.test(normalized) ||
    /verification\s+session\s+(?:missing|expired)/.test(normalized)
  );
};

export const isOtpVerificationSuccessful = (response) => {
  const data = response?.data;
  const status = response?.status;
  const message = String(data?.message || data?.msg || data?.status || '').toLowerCase();

  if (status < 200 || status >= 300) return false;
  if (data?.success === false || data?.verified === false) return false;
  if (isOtpSessionMissingMessage(message)) return false;

  const candidates = [data, data?.data, data?.result];
  if (
    candidates.some(
      (item) =>
        item?.success === true ||
        item?.verified === true ||
        item?.isVerified === true ||
        item?.emailVerified === true
    )
  ) {
    return true;
  }

  if (!message) return false;

  const hasSuccessMessage = /verified|success|valid/.test(message);
  const hasFailureMessage = /invalid|failed|failure|error|wrong|expired/.test(message);
  return hasSuccessMessage && !hasFailureMessage;
};

export const isOtpRequestSuccessful = (response) => {
  const data = response?.data;
  const status = response?.status;
  if (status < 200 || status >= 300) return false;
  if (data?.success === false || data?.sent === false || data?.otpSent === false) return false;

  const candidates = [data, data?.data, data?.result];
  if (candidates.some((item) =>
    item?.success === true || item?.sent === true || item?.otpSent === true
  )) return true;

  const message = String(data?.message || data?.msg || '').toLowerCase();
  if (/fail|error|unable|invalid/.test(message)) return false;
  return true;
};

export const getApiErrorMessage = (error, fallback) => {
  const data = error?.response?.data;
  const backendMessage =
    (typeof data === 'string' ? data : null) || data?.message || data?.msg || data?.error;
  if (backendMessage) return String(backendMessage);
  if (error?.code === 'ECONNABORTED') return 'The server took too long to respond. Please try again.';
  if (!error?.response) {
    const detail = error?.userMessage || error?.message;
    if (
      detail &&
      /network request failed|could not open the https connection|ssl|tls|socket|timed out|econnrefused|ehostunreach|network/i.test(
        String(detail).toLowerCase()
      )
    ) {
      return 'Could not reach the server. Check your internet connection and try again.';
    }
    return detail
      ? `Could not reach the server. ${detail}`
      : 'Could not reach the server. Check your internet connection and try again.';
  }
  return fallback;
};

const makeHttpError = (response, fallback = 'Request failed') => {
  const data = response?.data;
  const error = new Error(
    (typeof data === 'string' ? data : data?.message || data?.error) || fallback
  );
  error.response = response;
  return error;
};

export const postPublicAuthEndpoint = async (endpoint, payload, options = {}) => {
  const timeout = getPublicAuthTimeout(endpoint, options.timeout);

  try {
    for (const origin of PUBLIC_AUTH_ORIGINS) {
      const url = `${origin.baseURL.replace(/\/+$/, '')}/api/auth/${endpoint}`;
      let response;
      try {
      response = await axios.post(url, payload, {
          timeout,
          withCredentials: true,
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...origin.headers,
          },
          validateStatus: () => true,
        });
      } catch (error) {
        if (isNetworkLevelError(error)) {
          continue;
        }
        throw error;
      }

      if (response.status < 200 || response.status >= 300) {
        // 404 on auth routes often means the host itself is wrong for this
        // environment, so keep falling through to the next known origin.
        if (response.status === 404) {
          continue;
        }
        throw makeHttpError(response);
      }

      return response;
    }

    throw new Error('Network request failed');
  } catch (error) {
    if (error?.response || error?.code === 'ECONNABORTED') throw error;

    if (endpoint === 'complete-registration') {
      throw makeHttpError({
        data: {
          message:
            'Registration failed because the backend requires a valid email OTP verification session before complete-registration. Make sure the deployed backend matches the web auth flow.',
          success: false,
        },
        status: 400,
        statusText: 'Bad Request',
      });
    }

    const networkError = new Error('Network request failed');
    networkError.userMessage =
      'Please check your internet connection and try again.';
    networkError.endpoint = endpoint;
    networkError.url = `${PUBLIC_AUTH_ORIGINS[0].baseURL.replace(/\/+$/, '')}/api/auth/${endpoint}`;
    networkError.cause = error;
    throw networkError;
  }
};

export const getCounsellorId = async () => {
  // App historically stored both spellings; prefer the commonly used key.
  let id = await AsyncStorage.getItem("counsellorId");
  if (!id) id = await AsyncStorage.getItem("counselorId");
  return id;
};

export const clearAuthData = async () => {
  await AsyncStorage.multiRemove([
    "userEmail",
    "isVerified",
    "accessToken",
    "token",
    "refreshToken",
    "userData",
    "userRole",
    "userId",
    "counsellorId",
    "counselorId",
  ]);
};
