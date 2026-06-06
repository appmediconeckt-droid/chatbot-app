import axios from '../axiosConfig';

const setPasswordByOtp = async ({ email, password }) => {
  return axios.post('/api/auth/set-password-by-otp', { email, password });
};

const setPassword = async ({ password }) => {
  return axios.post('/api/auth/setPassword', { password });
};

const changePassword = async ({ oldPassword, newPassword }) => {
  return axios.post('/api/auth/changePassword', { oldPassword, newPassword });
};

export default {
  setPasswordByOtp,
  setPassword,
  changePassword,
};
