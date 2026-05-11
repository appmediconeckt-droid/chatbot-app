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
