// src/axiosInstance.js — thin re-export so new screens can import from here
import axiosInstance, { API_BASE_URL } from './axiosConfig';

export { API_BASE_URL };

export const clearApiCache = () => {};

export const handleSessionExpired = async (navigation) => {
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  await AsyncStorage.multiRemove(['accessToken', 'token', 'refreshToken', 'userData', 'userId', 'userRole']);
  navigation?.replace?.('RoleSelector');
};

export default axiosInstance;
