import React from 'react';
import { act, create } from 'react-test-renderer';
import RazorpayCheckout from 'react-native-razorpay';
import api from '../src/axiosConfig';
import {
  NOT_COMPLETED,
  TEST_UPI_FAILURE,
  TEST_UPI_SUCCESS,
  razorpayOffersUpi,
  isOnlinePayment,
  isWalletPayment,
  payForAppointment,
  paymentCheckoutDisplay,
  useProviderPaymentOptions,
  useWalletBalance,
} from '../src/utils/providerPayments';

jest.mock('react-native', () => ({
  NativeModules: { RNRazorpayCheckout: {} },
  TurboModuleRegistry: { get: () => null },
}));
jest.mock('react-native-razorpay', () => ({ __esModule: true, default: { open: jest.fn() } }));
jest.mock('../src/axiosConfig', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn() } }));

const order = { key_id: 'rzp_live_key', order_id: 'order_1', amount: 50000, currency: 'INR', method: 'credit_card' };
const checkoutResponse = { razorpay_payment_id: 'pay_1', razorpay_order_id: 'order_1', razorpay_signature: 'sig' };

describe('appointment payments (web providerPayments port)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('treats card, UPI and the wallet as online (paid before booking) payments', () => {
    expect(['credit_card', 'debit_card', 'upi', 'wallet'].every(isOnlinePayment)).toBe(true);
    expect(isWalletPayment('wallet')).toBe(true);
    expect(isWalletPayment('upi')).toBe(false);
    expect(isOnlinePayment('cash')).toBe(false);
    expect(isOnlinePayment('insurance')).toBe(false);
    expect(paymentCheckoutDisplay('debit_card').display.blocks.chosen.instruments).toEqual([{ method: 'card', types: ['debit'] }]);
    expect(paymentCheckoutDisplay('upi').display.blocks.chosen.instruments).toEqual([{ method: 'upi', flows: ['intent', 'collect', 'qr'] }]);
  });

  it('loads the methods the doctor accepts', async () => {
    api.get.mockResolvedValue({ data: { methods: ['credit_card', 'upi', 'cash', 'bitcoin'] } });
    let state;
    function Probe() { state = useProviderPaymentOptions('doc-1'); return null; }
    await act(async () => { create(<Probe />); });
    expect(api.get).toHaveBeenCalledWith('/api/payments/providers/doc-1/methods');
    expect(state.loading).toBe(false);
    // The wallet is offered next to the doctor's online methods, before cash.
    expect(state.methods.map((m) => m.id)).toEqual(['credit_card', 'upi', 'wallet', 'cash']);
  });

  it('always offers the wallet, for every doctor', async () => {
    let state;
    function Probe() { state = useProviderPaymentOptions('doc-1'); return null; }
    api.get.mockResolvedValue({ data: { methods: ['cash'] } });
    await act(async () => { create(<Probe />); });
    expect(state.methods.map((m) => m.id)).toEqual(['wallet', 'cash']);

    api.get.mockResolvedValue({ data: { methods: [] } });
    await act(async () => { create(<Probe />); });
    expect(state.methods.map((m) => m.id)).toEqual(['wallet']);

    api.get.mockResolvedValue({ data: { methods: ['upi'], walletEnabled: false } });
    await act(async () => { create(<Probe />); });
    expect(state.methods.map((m) => m.id)).toEqual(['upi', 'wallet']);

    api.get.mockResolvedValue({ data: { methods: ['wallet', 'upi'] } });
    await act(async () => { create(<Probe />); });
    expect(state.methods.map((m) => m.id)).toEqual(['wallet', 'upi']);
  });

  it('reports methods the doctor turned on but has not finished setting up', async () => {
    // What the server answers for a doctor whose card switch is on but who has
    // no receiving bank account on the server yet.
    api.get.mockResolvedValue({ data: {
      success: true,
      methods: [],
      configuredMethods: ['credit_card', 'debit_card'],
      unavailableMethods: { credit_card: 'The provider needs to complete card payment setup.', debit_card: 'The provider needs to complete card payment setup.' },
    } });
    let state;
    function Probe() { state = useProviderPaymentOptions('doc-1'); return null; }
    await act(async () => { create(<Probe />); });
    // Cards aren't ready, but the wallet still is.
    expect(state.methods.map((m) => m.id)).toEqual(['wallet']);
    expect(state.unavailable).toEqual([
      { id: 'credit_card', label: 'Credit Card', reason: 'The provider needs to complete card payment setup.' },
      { id: 'debit_card', label: 'Debit Card', reason: 'The provider needs to complete card payment setup.' },
    ]);
  });

  it('books the payment through Razorpay checkout and verifies it', async () => {
    api.post.mockImplementation((url) => Promise.resolve({ data: url.endsWith('/order') ? order : { paid: true, status: 'paid' } }));
    RazorpayCheckout.open.mockResolvedValue(checkoutResponse);

    await expect(payForAppointment('apt-1', 'credit_card', { name: 'Asha', email: '', contact: '9999999999' })).resolves.toMatchObject({ paid: true });

    expect(api.post).toHaveBeenNthCalledWith(1, '/api/payments/appointments/apt-1/order', { method: 'credit_card' });
    const options = RazorpayCheckout.open.mock.calls[0][0];
    expect(options).toMatchObject({ key: 'rzp_live_key', order_id: 'order_1', amount: 50000, currency: 'INR' });
    expect(options.prefill).toEqual({ name: 'Asha', contact: '9999999999' });
    // No card-saving step (its SMS OTP was mistaken for the payment OTP).
    expect(options.remember_customer).toBe(false);
    expect(options.config.display.blocks.chosen.instruments).toEqual([{ method: 'card', types: ['credit'] }]);
    expect(api.post).toHaveBeenNthCalledWith(2, '/api/payments/appointments/apt-1/verify', checkoutResponse);
  });

  it('marks a closed checkout as not paid, so the booking can be released', async () => {
    api.post.mockResolvedValue({ data: order });
    RazorpayCheckout.open.mockRejectedValue({ code: 0, description: 'Payment Cancelled' });
    await expect(payForAppointment('apt-1', 'credit_card')).rejects.toMatchObject({ message: NOT_COMPLETED, notPaid: true, cancelled: true });
    expect(api.post).toHaveBeenCalledTimes(1);

    RazorpayCheckout.open.mockRejectedValue({ code: 2, description: 'Card declined' });
    await expect(payForAppointment('apt-1', 'credit_card')).rejects.toMatchObject({ message: 'Card declined', notPaid: true, cancelled: false });
  });

  it('turns the raw no_payment_methods JSON from Razorpay into a sentence', async () => {
    api.post.mockResolvedValue({ data: { ...order, method: 'upi' } });
    RazorpayCheckout.open.mockRejectedValue({ code: 1, description: '{"error":{"code":"BAD_REQUEST_ERROR","description":"no_payment_methods","source":"razorpay","step":"checkout_load","reason":"no_payment_methods"}}' });
    await expect(payForAppointment('apt-1', 'upi')).rejects.toMatchObject({
      message: "UPI isn't available in checkout right now. Please choose another payment method.", notPaid: true,
    });
  });

  it('does not mark a payment whose confirmation is pending as not paid', async () => {
    api.post.mockImplementation((url) => Promise.reject(url.endsWith('/order') ? null : new Error('Network Error'))
      .catch((e) => (url.endsWith('/order') ? { data: order } : Promise.reject(e))));
    RazorpayCheckout.open.mockResolvedValue(checkoutResponse);
    const error = await payForAppointment('apt-1', 'credit_card').catch((e) => e);
    expect(error.message).toBe('Network Error');
    expect(error.notPaid).toBeUndefined();
  });

  it('recovers a lost verification through reconcile', async () => {
    api.post.mockImplementation((url) => {
      if (url.endsWith('/order')) return Promise.resolve({ data: order });
      if (url.endsWith('/verify')) return Promise.reject(new Error('Network Error'));
      return Promise.resolve({ data: { paid: true } });
    });
    RazorpayCheckout.open.mockResolvedValue(checkoutResponse);
    await expect(payForAppointment('apt-1', 'upi')).resolves.toMatchObject({ paid: true });
    expect(api.post).toHaveBeenLastCalledWith('/api/payments/appointments/apt-1/reconcile');
  });

  it('limits checkout to the chosen card type in test mode too (the server checks it after payment)', async () => {
    api.post.mockImplementation((url) => Promise.resolve({ data: url.endsWith('/order')
      ? { ...order, key_id: 'rzp_test_abc', method: 'debit_card' } : { paid: true } }));
    RazorpayCheckout.open.mockResolvedValue(checkoutResponse);
    await payForAppointment('apt-1', 'debit_card');
    expect(RazorpayCheckout.open.mock.calls[0][0].config.display.blocks.chosen.instruments).toEqual([{ method: 'card', types: ['debit'] }]);
  });

  it('marks a refused confirmation after checkout as charged', async () => {
    api.post.mockImplementation((url) => {
      if (url.endsWith('/order')) return Promise.resolve({ data: order });
      if (url.endsWith('/verify')) return Promise.reject({ response: { data: { message: 'The card type does not match your selected payment method.' } } });
      return Promise.resolve({ data: { paid: false } });
    });
    RazorpayCheckout.open.mockResolvedValue(checkoutResponse);
    await expect(payForAppointment('apt-1', 'debit_card')).rejects.toMatchObject({
      message: 'The card type does not match your selected payment method.', charged: true,
    });
  });

  describe('test UPI (Razorpay TEST account with UPI turned off)', () => {
    const testOrder = { ...order, key_id: 'rzp_test_abc', method: 'upi' };
    const preferences = (upi) => Promise.resolve({ json: () => Promise.resolve({ methods: { upi, upi_type: { collect: 0, intent: 0 } } }) });
    beforeEach(() => { global.fetch = jest.fn(() => preferences(false)); api.post.mockResolvedValue({ data: testOrder }); });

    it('books with success@razorpay without opening checkout or charging', async () => {
      const askTestUpi = jest.fn(async () => TEST_UPI_SUCCESS);
      await expect(payForAppointment('apt-1', 'upi', {}, { askTestUpi })).resolves.toEqual({ simulated: true, method: 'upi', upiId: TEST_UPI_SUCCESS });
      expect(global.fetch).toHaveBeenCalledWith('https://api.razorpay.com/v1/preferences?key_id=rzp_test_abc&currency=INR');
      expect(RazorpayCheckout.open).not.toHaveBeenCalled();
      expect(api.post).toHaveBeenCalledTimes(1);
    });

    it('fails with failure@razorpay and when the box is closed, so the booking is released', async () => {
      await expect(payForAppointment('apt-1', 'upi', {}, { askTestUpi: async () => TEST_UPI_FAILURE }))
        .rejects.toMatchObject({ notPaid: true, cancelled: false });
      await expect(payForAppointment('apt-1', 'upi', {}, { askTestUpi: async () => null }))
        .rejects.toMatchObject({ message: NOT_COMPLETED, notPaid: true, cancelled: true });
    });

    it('uses the real checkout when Razorpay offers UPI, for a live key, or without askTestUpi', async () => {
      RazorpayCheckout.open.mockRejectedValue({ code: 0, description: 'Payment Cancelled' });
      const askTestUpi = jest.fn(async () => TEST_UPI_SUCCESS);

      global.fetch = jest.fn(() => preferences(true));
      await payForAppointment('apt-1', 'upi', {}, { askTestUpi }).catch(() => {});
      api.post.mockResolvedValue({ data: { ...testOrder, key_id: 'rzp_live_abc' } });
      global.fetch = jest.fn(() => preferences(false));
      await payForAppointment('apt-1', 'upi', {}, { askTestUpi }).catch(() => {});
      api.post.mockResolvedValue({ data: testOrder });
      await payForAppointment('apt-1', 'upi').catch(() => {});

      expect(askTestUpi).not.toHaveBeenCalled();
      expect(RazorpayCheckout.open).toHaveBeenCalledTimes(3);
    });

    it('reads UPI availability from Razorpay preferences, assuming yes when unreadable', async () => {
      global.fetch = jest.fn(() => preferences(false));
      await expect(razorpayOffersUpi('rzp_test_abc')).resolves.toBe(false);
      global.fetch = jest.fn(() => Promise.resolve({ json: () => Promise.resolve({ methods: { upi: false, upi_type: { intent: 1 } } }) }));
      await expect(razorpayOffersUpi('rzp_test_abc')).resolves.toBe(true);
      global.fetch = jest.fn(() => Promise.reject(new Error('offline')));
      await expect(razorpayOffersUpi('rzp_test_abc')).resolves.toBe(true);
    });
  });

  it('skips checkout when the order is already paid', async () => {
    api.post.mockResolvedValue({ data: { paid: true } });
    await expect(payForAppointment('apt-1', 'upi')).resolves.toMatchObject({ paid: true });
    expect(RazorpayCheckout.open).not.toHaveBeenCalled();
  });

  describe('wallet', () => {
    it('pays from the wallet in the internal call, without checkout', async () => {
      api.post.mockResolvedValue({ data: { paid: true, walletBalance: 250 } });
      await expect(payForAppointment('apt-1', 'wallet')).resolves.toEqual({ paid: true, walletBalance: 250 });
      expect(api.post).toHaveBeenCalledTimes(1);
      expect(api.post).toHaveBeenCalledWith('/api/payments/appointments/apt-1/internal', { method: 'wallet' });
      expect(RazorpayCheckout.open).not.toHaveBeenCalled();
    });

    it('reports a too-low balance as not paid, so the booking is released', async () => {
      api.post.mockRejectedValue({ response: { status: 400, data: { code: 'INSUFFICIENT_WALLET_BALANCE', message: 'Insufficient balance' } } });
      await expect(payForAppointment('apt-1', 'wallet')).rejects.toMatchObject({
        notPaid: true,
        message: 'Your wallet balance is too low for this appointment. Add money to your wallet or choose another payment method.',
      });
    });

    it('counts a success answer without `paid` as paid, like the web', async () => {
      api.post.mockResolvedValue({ data: { status: 'paid', walletBalance: 80 } });
      await expect(payForAppointment('apt-1', 'wallet')).resolves.toMatchObject({ paid: true, walletBalance: 80 });
    });

    it('treats a Razorpay order answer as wallet not supported (nothing debited)', async () => {
      api.post.mockResolvedValue({ data: order });
      await expect(payForAppointment('apt-1', 'wallet')).rejects.toMatchObject({ notPaid: true });
      expect(RazorpayCheckout.open).not.toHaveBeenCalled();
    });

    it('reconciles a lost answer and otherwise keeps the booking (may have been debited)', async () => {
      api.post.mockImplementation((url) => (url.endsWith('/internal') ? Promise.reject(new Error('Network Error')) : Promise.resolve({ data: { paid: true } })));
      await expect(payForAppointment('apt-1', 'wallet')).resolves.toMatchObject({ paid: true });
      expect(api.post).toHaveBeenLastCalledWith('/api/payments/appointments/apt-1/reconcile');

      api.post.mockImplementation((url) => (url.endsWith('/internal') ? Promise.reject(new Error('Network Error')) : Promise.resolve({ data: { paid: false } })));
      const error = await payForAppointment('apt-1', 'wallet').catch((e) => e);
      expect(error.charged).toBe(true);
      expect(error.notPaid).toBeUndefined();
    });

    it('loads the wallet balance', async () => {
      api.get.mockResolvedValue({ data: { balance: '420.5', transactions: [] } });
      let state;
      function Probe() { state = useWalletBalance(true); return null; }
      await act(async () => { create(<Probe />); });
      expect(api.get).toHaveBeenCalledWith('/api/wallet/data', { params: { page: 1, limit: 1 } });
      expect(state).toMatchObject({ balance: 420.5, loading: false, error: '' });
      await act(async () => { state.setBalance(100); });
      expect(state.balance).toBe(100);
    });
  });
});
