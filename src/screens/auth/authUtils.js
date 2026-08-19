import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { API_BASE_URL, TUNNEL_HEADERS } from "../../axiosConfig";

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

export const isOtpVerificationSuccessful = (response) => {
  const data = response?.data;
  const status = response?.status;

  if (status < 200 || status >= 300) return false;
  if (data?.success === false || data?.verified === false) return false;

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

  const message = String(data?.message || data?.msg || data?.status || '').toLowerCase();
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

const postWithRawXhr = async (url, payload, options = {}) => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.withCredentials = true;
    xhr.timeout = options.timeout || 30000;
    xhr.setRequestHeader('Accept', 'application/json');
    xhr.setRequestHeader('Content-Type', 'application/json');
    Object.entries(TUNNEL_HEADERS).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    xhr.onload = () => {
      const bodyText = xhr.responseText || '';
      let data = bodyText;
      if (bodyText) {
        try {
          data = JSON.parse(bodyText);
        } catch {
          data = bodyText;
        }
      } else {
        data = {};
      }

      const response = {
        data,
        status: xhr.status,
        statusText: xhr.statusText,
      };

      if (xhr.status < 200 || xhr.status >= 300) {
        reject(makeHttpError(response));
        return;
      }

      resolve(response);
    };

    xhr.onerror = () => {
      const error = new Error('Network request failed');
      error.userMessage = 'Android could not open the HTTPS connection to the backend.';
      reject(error);
    };

    xhr.ontimeout = () => {
      const error = new Error('The server took too long to respond. Please try again.');
      error.code = 'ECONNABORTED';
      reject(error);
    };

    xhr.send(JSON.stringify(payload));
  });
};

export const postPublicAuthEndpoint = async (endpoint, payload, options = {}) => {
  const url = `${API_BASE_URL}/api/auth/${endpoint}`;
  let axiosNetworkError = null;

  try {
    const response = await axios.post(url, payload, {
      timeout: options.timeout || 30000,
      withCredentials: true,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...TUNNEL_HEADERS,
      },
      validateStatus: () => true,
    });

    if (response.status < 200 || response.status >= 300) {
      throw makeHttpError(response);
    }

    return response;
  } catch (error) {
    if (error?.response || error?.code === 'ECONNABORTED') throw error;
    axiosNetworkError = error;

    try {
      return await postWithRawXhr(url, payload, options);
    } catch (xhrError) {
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
      console.log('[public-auth] request failed', {
        endpoint,
        url,
        axiosMessage: axiosNetworkError?.message,
        xhrMessage: xhrError?.message,
      });
      throw xhrError;
    }
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
