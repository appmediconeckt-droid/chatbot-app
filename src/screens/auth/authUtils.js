import AsyncStorage from "@react-native-async-storage/async-storage";

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
        item?.emailVerified === true ||
        item?.phoneVerified === true
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
