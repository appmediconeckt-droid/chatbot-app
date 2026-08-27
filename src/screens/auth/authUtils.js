import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { API_BASE_URL, TUNNEL_HEADERS } from "../../axiosConfig";

<<<<<<< HEAD
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
=======
// Railway may need time to wake the service and the deployed mail provider can
// take longer than Axios' old 30s limit. Keep auth requests below the UI-level
// loading state, but do not abort a valid OTP send while the backend is still
// waiting for SMTP.
const PUBLIC_AUTH_TIMEOUT_MS = 120000;
>>>>>>> ca2caa7fb8c888e1c42693ec07c016896d795dd0

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
<<<<<<< HEAD
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
=======
  return candidates.some(
    (item) =>
      item?.success === true ||
      item?.verified === true ||
      item?.isVerified === true ||
      item?.emailVerified === true
  );
>>>>>>> ca2caa7fb8c888e1c42693ec07c016896d795dd0
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

export const isMissingOtpError = (errorOrResponse) => {
  const data = errorOrResponse?.response?.data || errorOrResponse?.data || {};
  const message = String(
    (typeof data === 'string' ? data : data?.message || data?.msg || data?.error) ||
      errorOrResponse?.message ||
      ''
  ).toLowerCase();

  return message.includes('no otp found') || message.includes('request a new otp');
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const makeHttpError = (response, fallback = 'Request failed') => {
  const data = response?.data;
  const error = new Error(
    (typeof data === 'string' ? data : data?.message || data?.error) || fallback
  );
  error.response = response;
  return error;
};

export const postPublicAuthEndpoint = async (endpoint, payload, options = {}) => {
<<<<<<< HEAD
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
=======
  const url = `${API_BASE_URL}/api/auth/${endpoint}`;

  try {
    const response = await axios.post(url, payload, {
      timeout: options.timeout || PUBLIC_AUTH_TIMEOUT_MS,
      withCredentials: true,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...TUNNEL_HEADERS,
      },
      validateStatus: () => true,
    });
>>>>>>> ca2caa7fb8c888e1c42693ec07c016896d795dd0

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
<<<<<<< HEAD
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
=======
    // Never retry an OTP POST automatically. The server may have accepted the
    // first request before its response was lost; sending it again can create a
    // second OTP and immediately invalidate the first email.
    if (!error?.response) {
      error.userMessage = error?.code === 'ECONNABORTED'
        ? 'The email server did not respond within 2 minutes. Please try again later.'
        : 'The app could not complete the connection to the deployed backend.';
    }
    console.log('[public-auth] request failed', {
      endpoint,
      url,
      code: error?.code,
      message: error?.message,
      status: error?.response?.status,
    });
    throw error;
  }
};

export const postPublicAuthEndpointWithOtpRetry = async (
  endpoint,
  payload,
  options = {},
) => {
  const attempts = options.attempts || 4;
  const retryDelayMs = options.retryDelayMs || 450;
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await postPublicAuthEndpoint(endpoint, payload, options);
    } catch (error) {
      lastError = error;
      const shouldRetry =
        endpoint === 'verify-email-otp' &&
        attempt < attempts &&
        isMissingOtpError(error);

      if (!shouldRetry) throw error;
      await wait(retryDelayMs);
>>>>>>> ca2caa7fb8c888e1c42693ec07c016896d795dd0
    }

    const networkError = new Error('Network request failed');
    networkError.userMessage =
      'Please check your internet connection and try again.';
    networkError.endpoint = endpoint;
    networkError.url = `${PUBLIC_AUTH_ORIGINS[0].baseURL.replace(/\/+$/, '')}/api/auth/${endpoint}`;
    networkError.cause = error;
    throw networkError;
  }

  throw lastError;
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
