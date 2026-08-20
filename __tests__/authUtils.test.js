jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  multiRemove: jest.fn(),
}));

jest.mock('axios', () => {
  const instance = {
    defaults: { headers: { common: {} } },
    create: jest.fn(() => ({
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
      post: jest.fn(),
    })),
    post: jest.fn(),
  };

  return instance;
});

const axios = require('axios');
const { postPublicAuthEndpoint } = require('../src/screens/auth/authUtils');

describe('postPublicAuthEndpoint', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps browser-style session cookies for verification endpoints', async () => {
    axios.post.mockResolvedValue({
      status: 200,
      data: { success: true, message: 'OK' },
    });

    await postPublicAuthEndpoint('verify-email-otp', { email: 'user@example.com', otp: '123456' });

    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/verify-email-otp'),
      { email: 'user@example.com', otp: '123456' },
      expect.objectContaining({
        withCredentials: true,
        timeout: 120000,
        validateStatus: expect.any(Function),
      })
    );
  });

  it('does not repeat an OTP POST after a network failure', async () => {
    const networkError = new Error('Network Error');
    networkError.code = 'ERR_NETWORK';
    axios.post.mockRejectedValue(networkError);

    await expect(
      postPublicAuthEndpoint('send-email-otp', { email: 'user@example.com' })
    ).rejects.toMatchObject({
      userMessage: expect.stringContaining('deployed backend'),
    });

    expect(axios.post).toHaveBeenCalledTimes(1);
  });
});
