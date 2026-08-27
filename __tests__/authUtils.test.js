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
<<<<<<< HEAD
  PUBLIC_AUTH_OTP_TIMEOUT_MS,
  PUBLIC_AUTH_TIMEOUT_MS,
  getApiErrorMessage,
  postPublicAuthEndpoint,
=======
  isOtpVerificationSuccessful,
  postPublicAuthEndpoint,
  postPublicAuthEndpointWithOtpRetry,
>>>>>>> ca2caa7fb8c888e1c42693ec07c016896d795dd0
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
        timeout: PUBLIC_AUTH_OTP_TIMEOUT_MS,
        withCredentials: true,
        timeout: 120000,
        validateStatus: expect.any(Function),
      })
    );
  });

<<<<<<< HEAD
  it('keeps non-OTP public auth endpoints on the normal timeout', async () => {
    axios.post.mockResolvedValue({
      status: 200,
      data: { success: true, message: 'OK' },
    });

    await postPublicAuthEndpoint('complete-registration', { email: 'user@example.com' });

    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/complete-registration'),
      { email: 'user@example.com' },
      expect.objectContaining({
        timeout: PUBLIC_AUTH_TIMEOUT_MS,
      })
    );
  });

  it('sanitizes low-level network failures into a generic message', () => {
    const message = getApiErrorMessage(
      { message: 'Android could not open the HTTPS connection to the backend.' },
      'Failed to send OTP'
    );

    expect(message).toBe(
      'Could not reach the server. Check your internet connection and try again.'
    );
  });

  it('falls back to the dev tunnel when the primary host cannot be reached', async () => {
    axios.post
      .mockRejectedValueOnce({ message: 'Network Error' })
      .mockResolvedValueOnce({
        status: 200,
        data: { success: true, message: 'OTP sent' },
      });

    const response = await postPublicAuthEndpoint('send-email-otp', {
      email: 'user@example.com',
    });

    expect(response.status).toBe(200);
    expect(axios.post).toHaveBeenCalledTimes(2);
    expect(axios.post.mock.calls[0][0]).toContain('railway.app/api/auth/send-email-otp');
    expect(axios.post.mock.calls[1][0]).toContain('devtunnels.ms/api/auth/send-email-otp');
=======
<<<<<<< HEAD
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
=======
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
>>>>>>> b3fce7d1132e69c969e7635c631705bab3f7da0c
  });
});

describe('isOtpVerificationSuccessful', () => {
  it('requires an explicit success flag from the server', () => {
    expect(
      isOtpVerificationSuccessful({
        status: 200,
        data: { message: 'Email verified successfully' },
      })
    ).toBe(false);

    expect(
      isOtpVerificationSuccessful({
        status: 200,
        data: { success: true, message: 'Email verified successfully' },
      })
    ).toBe(true);
  });

  it('rejects failed OTP responses even if the message contains success words', () => {
    expect(
      isOtpVerificationSuccessful({
        status: 400,
        data: { success: false, message: 'Invalid OTP' },
      })
    ).toBe(false);
>>>>>>> ca2caa7fb8c888e1c42693ec07c016896d795dd0
  });
});
