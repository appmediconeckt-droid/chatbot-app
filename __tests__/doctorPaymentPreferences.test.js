import axiosInstance from '../src/axiosConfig';
import { ensureWalletAccepted, resetWalletSync } from '../src/features/doctor/dashboard/api/doctorPaymentPreferences';
import { methodRefused } from '../src/utils/providerPayments';

jest.mock('../src/axiosConfig', () => ({ __esModule: true, default: { get: jest.fn(), put: jest.fn() } }));
jest.mock('react-native', () => ({ NativeModules: {}, TurboModuleRegistry: { get: () => null } }));
jest.mock('react-native-razorpay', () => ({ __esModule: true, default: { open: jest.fn() } }));

const BANK = { accountHolder: 'Vijay Kumar', bankName: 'SBI', accountNumber: '12345678901', ifscCode: 'SBIN0001234' };

describe('wallet always accepted for a doctor', () => {
  beforeEach(() => { jest.clearAllMocks(); resetWalletSync(); jest.spyOn(console, 'warn').mockImplementation(() => {}); });

  it('adds wallet to saved methods, sending everything else back unchanged', async () => {
    axiosInstance.get.mockResolvedValue({ data: { methods: ['upi', 'cash'], bankAccount: BANK, upiId: 'dr@okaxis', upiApp: 'gpay' } });
    axiosInstance.put.mockResolvedValue({ data: { success: true } });
    await expect(ensureWalletAccepted()).resolves.toBe(true);
    expect(axiosInstance.put).toHaveBeenCalledWith('/api/payments/preferences', {
      methods: ['upi', 'cash', 'wallet'], bankAccount: BANK, upiId: 'dr@okaxis', upiApp: 'gpay',
    });
    // Once per session.
    await expect(ensureWalletAccepted()).resolves.toBe(false);
    expect(axiosInstance.get).toHaveBeenCalledTimes(1);
  });

  it('leaves preferences that already include wallet alone', async () => {
    axiosInstance.get.mockResolvedValue({ data: { methods: ['Wallet', 'cash'] } });
    await expect(ensureWalletAccepted()).resolves.toBe(false);
    expect(axiosInstance.put).not.toHaveBeenCalled();
  });

  it('treats no saved list as cash only, and retries next time after a failure', async () => {
    axiosInstance.get.mockResolvedValue({ data: {} });
    axiosInstance.put.mockRejectedValueOnce({ response: { status: 500 } });
    await expect(ensureWalletAccepted()).resolves.toBe(false);
    axiosInstance.put.mockResolvedValue({ data: {} });
    await expect(ensureWalletAccepted()).resolves.toBe(true);
    expect(axiosInstance.put).toHaveBeenLastCalledWith('/api/payments/preferences', expect.objectContaining({ methods: ['cash', 'wallet'] }));
  });

  it('recognises the server refusing the payment method', () => {
    const refusal = (message) => ({ response: { data: { message } } });
    expect(methodRefused(refusal('Payment method not supported'))).toBe(true);
    expect(methodRefused(refusal('This payment method is not accepted by the doctor'))).toBe(true);
    expect(methodRefused({ response: { data: { error: 'Unsupported payment method: wallet' } } })).toBe(true);
    expect(methodRefused(refusal('Insufficient wallet balance'))).toBe(false);
  });
});
