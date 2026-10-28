import axiosInstance from '../src/axiosConfig';
import { ensureWalletAccepted, resetWalletSync } from '../src/features/doctor/dashboard/api/doctorPaymentPreferences';
import { methodRefused } from '../src/utils/providerPayments';

jest.mock('../src/axiosConfig', () => ({ __esModule: true, default: { get: jest.fn(), put: jest.fn() } }));
jest.mock('react-native', () => ({ NativeModules: {}, TurboModuleRegistry: { get: () => null } }));
jest.mock('react-native-razorpay', () => ({ __esModule: true, default: { open: jest.fn() } }));

describe('wallet availability', () => {
  beforeEach(() => { jest.clearAllMocks(); resetWalletSync(); jest.spyOn(console, 'warn').mockImplementation(() => {}); });

  it('does not write wallet into doctor payment preferences', async () => {
    await expect(ensureWalletAccepted()).resolves.toBe(false);
    expect(axiosInstance.get).not.toHaveBeenCalled();
    expect(axiosInstance.put).not.toHaveBeenCalled();
  });

  it('recognises the server refusing the payment method', () => {
    const refusal = (message) => ({ response: { data: { message } } });
    expect(methodRefused(refusal('Payment method not supported'))).toBe(true);
    expect(methodRefused(refusal('This payment method is not accepted by the doctor'))).toBe(true);
    expect(methodRefused({ response: { data: { error: 'Unsupported payment method: wallet' } } })).toBe(true);
    expect(methodRefused(refusal('Insufficient wallet balance'))).toBe(false);
  });
});
