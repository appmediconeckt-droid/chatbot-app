// src/axiosInstance.js — thin re-export so new screens can import from here
import axiosInstance, { API_BASE_URL } from './axiosConfig';

export { API_BASE_URL };

export const clearApiCache = () => {};

export const handleSessionExpired = async () => {
  // Never clear credentials from an automatic 401 helper. Explicit logout and
  // delete-account flows own session cleanup.
};

export default axiosInstance;
