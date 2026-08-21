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
const {
  postPublicAuthEndpoint,
  postPublicAuthEndpointWithOtpRetry,
} = require('../src/screens/auth/authUtils');

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
        validateStatus: expect.any(Function),
      })
    );
  });

  it('retries verify-email-otp when the live backend briefly reports no OTP store', async () => {
    axios.post
      .mockResolvedValueOnce({
        status: 400,
        data: { success: false, message: 'No OTP found. Please request a new OTP.' },
      })
      .mockResolvedValueOnce({
        status: 200,
        data: { success: true, message: 'Email verified successfully' },
      });

    const response = await postPublicAuthEndpointWithOtpRetry(
      'verify-email-otp',
      { email: 'user@example.com', otp: '123456' },
      { retryDelayMs: 1 }
    );

    expect(response.data.success).toBe(true);
    expect(axios.post).toHaveBeenCalledTimes(2);
  });
});
