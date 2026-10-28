// Appointment payments — port of the web utils/providerPayments.js and
// utils/paymentCheckoutConfig.js (same API calls):
//   GET  /api/payments/providers/:providerId/methods      methods the provider accepts
//   POST /api/payments/appointments/:id/order { method }  Razorpay order for a booked appointment
//   POST /api/payments/appointments/:id/verify            Razorpay checkout response
//   POST /api/payments/appointments/:id/reconcile         recover a lost verification
//   POST /api/payments/appointments/:id/internal { method: 'wallet' }  pay from the wallet
//   GET  /api/wallet/data                                 patient's wallet balance
// The appointment is booked first (reserved, unpaid); an online method then
// opens Razorpay checkout, where the patient enters their card / UPI details.
// The wallet skips checkout: /internal with { method: 'wallet' } debits the
// patient's Humaeli wallet and records the payment in the doctor's earnings
// (the same call the web makes).
import { useEffect, useState } from 'react';
import { NativeModules, TurboModuleRegistry } from 'react-native';
import RazorpayCheckout from 'react-native-razorpay';
import api from '../axiosConfig';

const LABELS = {
  credit_card: ['Credit Card', 'card-outline'],
  debit_card: ['Debit Card', 'card-outline'],
  upi: ['UPI Payment', 'phone-portrait-outline'],
  wallet: ['Wallet', 'wallet-outline'],
  cash: ['Cash at Clinic', 'cash-outline'],
  insurance: ['Insurance', 'shield-checkmark-outline'],
};

const GATEWAY_METHODS = ['credit_card', 'debit_card', 'upi'];

export const isWalletPayment = (method) => method === 'wallet';

// Paid before the booking counts: in Razorpay checkout or from the wallet.
export const isOnlinePayment = (method) => GATEWAY_METHODS.includes(method) || isWalletPayment(method);

export const NOT_COMPLETED = 'Payment was not completed.';

// Shows only the chosen instrument in checkout (web paymentCheckoutDisplay).
// The card type is limited in test mode too: the server checks it after
// payment ("The card type does not match your selected payment method"), so
// checkout must refuse a card of the other type before anything is charged.
export const paymentCheckoutDisplay = (method) => {
  const names = { credit_card: 'Credit Card', debit_card: 'Debit Card', upi: 'UPI' };
  if (!names[method]) throw new Error('Select a supported online payment method.');
  // UPI lists every flow: UPI Collect (typing a UPI ID) is deprecated since
  // 28 Feb 2026, so in the Android app Razorpay mostly offers UPI apps
  // (intent); a bare { method: 'upi' } there showed "No appropriate payment
  // method found".
  const instrument = method === 'upi'
    ? { method: 'upi', flows: ['intent', 'collect', 'qr'] }
    : { method: 'card', types: [method === 'credit_card' ? 'credit' : 'debit'] };
  return {
    display: {
      blocks: { chosen: { name: names[method], instruments: [instrument] } },
      sequence: ['block.chosen'],
      preferences: { show_default_blocks: false },
    },
  };
};

// { methods: [{ id, label, icon }], unavailable: [{ id, label, reason }], loading, error }
// for one doctor. `unavailable` are methods the doctor turned on but whose
// setup isn't finished (e.g. no receiving bank account for cards yet).
export function useProviderPaymentOptions(providerId, enabled = true) {
  const [state, setState] = useState({ methods: [], unavailable: [], loading: true, error: '' });
  useEffect(() => {
    let active = true;
    setState({ methods: [], unavailable: [], loading: Boolean(providerId && enabled), error: '' });
    if (!providerId || !enabled) return undefined;
    api.get(`/api/payments/providers/${encodeURIComponent(String(providerId))}/methods`)
      .then(({ data }) => {
        if (!active) return;
        const ids = (data?.methods || []).filter((method) => LABELS[method]);
        // The wallet is the platform's own method, not a doctor setting: every
        // doctor accepts it, whatever else they take (even cash only). It goes
        // before cash unless the server already lists it.
        if (!ids.includes('wallet')) {
          const cashAt = ids.indexOf('cash');
          ids.splice(cashAt === -1 ? ids.length : cashAt, 0, 'wallet');
        }
        const methods = ids.map((method) => ({ id: method, label: LABELS[method][0], icon: LABELS[method][1] }));
        const unavailable = Object.entries(data?.unavailableMethods || {})
          .filter(([method]) => LABELS[method] && !methods.some((m) => m.id === method))
          .map(([method, reason]) => ({ id: method, label: LABELS[method][0], reason: String(reason || 'Not set up yet.') }));
        setState({ methods, unavailable, loading: false, error: '' });
      })
      .catch(() => {
        if (active) setState({ methods: [], unavailable: [], loading: false, error: 'Payment options could not be loaded. Please reopen this booking to try again.' });
      });
    return () => { active = false; };
  }, [providerId, enabled]);
  return state;
}

// { balance, loading, error, reload, setBalance } — the patient's wallet
// balance (₹), for paying an appointment from the wallet. `balance` stays
// null until it is known.
export function useWalletBalance(enabled = true) {
  const [state, setState] = useState({ balance: null, loading: Boolean(enabled), error: '' });
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    let active = true;
    if (!enabled) return undefined;
    setState((prev) => ({ ...prev, loading: true, error: '' }));
    api.get('/api/wallet/data', { params: { page: 1, limit: 1 } })
      .then(({ data }) => {
        const balance = Number(data?.balance);
        if (active) setState({ balance: Number.isFinite(balance) ? balance : 0, loading: false, error: '' });
      })
      .catch(() => {
        if (active) setState((prev) => ({ ...prev, loading: false, error: 'Wallet balance could not be loaded.' }));
      });
    return () => { active = false; };
  }, [enabled, reloadKey]);
  return {
    ...state,
    reload: () => setReloadKey((key) => key + 1),
    setBalance: (balance) => {
      if (Number.isFinite(Number(balance))) setState({ balance: Number(balance), loading: false, error: '' });
    },
  };
}

// The server refused the payment method itself (the doctor's saved methods
// don't include it), e.g. "Payment method not supported".
export const methodRefused = (error) => /method.*(not|isn't|un)\s*(supported|accepted|allowed|available)|unsupported.*method/i
  .test(String(error?.response?.data?.message || error?.response?.data?.error || ''));

const apiError = (error, fallback) => error?.response?.data?.message || error?.response?.data?.error || error?.message || fallback;

// An error from before any money moved (no order, checkout closed or
// failed): `notPaid` lets the caller release the reserved booking.
// `cancelled`: the patient closed checkout themselves.
const notPaidError = (message, cancelled = false) => Object.assign(new Error(message), { notPaid: true, cancelled });

const METHOD_NAMES = { credit_card: 'Credit card', debit_card: 'Debit card', upi: 'UPI' };

// The Android SDK reports some checkout errors as a raw JSON string, e.g.
// {"error":{"code":"BAD_REQUEST_ERROR","description":"no_payment_methods",...}}.
// Show a sentence instead of the JSON.
const checkoutErrorText = (err, method) => {
  const raw = String(err?.description || err?.message || '');
  let detail = null;
  try { detail = JSON.parse(raw)?.error; } catch { /* not JSON */ }
  const reason = String(detail?.reason || detail?.description || '');
  if (/no_payment_methods/i.test(reason)) {
    return `${METHOD_NAMES[method] || 'This payment method'} isn't available in checkout right now. Please choose another payment method.`;
  }
  if (detail) return detail.description && !/^[a-z_]+$/.test(detail.description) ? detail.description : 'Payment could not be completed.';
  return raw || 'Payment could not be completed.';
};

// Whether Razorpay offers UPI for this key (the same public preferences call
// its checkout makes). Assumes yes when it can't be read, so the real
// checkout is tried.
export async function razorpayOffersUpi(keyId) {
  try {
    const res = await fetch(`https://api.razorpay.com/v1/preferences?key_id=${encodeURIComponent(String(keyId))}&currency=INR`);
    const methods = (await res.json())?.methods;
    if (!methods) return true;
    const type = methods.upi_type || {};
    return methods.upi === true || Number(type.collect) > 0 || Number(type.intent) > 0;
  } catch {
    return true;
  }
}

// Test UPI IDs, the same as Razorpay's test mode.
export const TEST_UPI_SUCCESS = 'success@razorpay';
export const TEST_UPI_FAILURE = 'failure@razorpay';

// Pays for a booked appointment. Resolves with the server's paid record;
// rejects with a message to show — with `notPaid: true` when nothing was paid,
// so the caller can release the reserved booking.
// prefill: { name, email, contact } for the checkout form.
// askTestUpi: testing only (debug builds). When the key is a TEST key and the
// Razorpay account has UPI turned off, UPI can't be tested in checkout at all;
// this is called instead and resolves to the UPI ID typed in, or null when
// closed. Resolves `{ simulated: true }` — nothing is charged or recorded as
// paid on the server.
export async function payForAppointment(appointmentId, method, prefill = {}, { askTestUpi } = {}) {
  if (isWalletPayment(method)) return payFromWallet(appointmentId);
  let order;
  try {
    ({ data: order } = await api.post(`/api/payments/appointments/${encodeURIComponent(String(appointmentId))}/order`, { method }));
  } catch (error) {
    throw notPaidError(apiError(error, 'Payment could not start.'));
  }
  if (order?.paid) return order;
  if (!order?.order_id || !order?.key_id || !order?.amount) throw notPaidError('Payment order response is incomplete.');
  // The key is public; its prefix tells test mode (no real money) from live.
  const testMode = String(order.key_id).startsWith('rzp_test_');
  console.log('[payment] Razorpay', testMode ? 'TEST mode' : 'LIVE mode', order.method || method);

  if ((order.method || method) === 'upi' && testMode && askTestUpi && !(await razorpayOffersUpi(order.key_id))) {
    const upiId = await askTestUpi();
    if (!upiId) throw notPaidError(NOT_COMPLETED, true);
    if (String(upiId).trim().toLowerCase() === TEST_UPI_FAILURE) throw notPaidError('UPI payment failed (test UPI ID failure@razorpay).');
    return { simulated: true, method: 'upi', upiId: String(upiId).trim() };
  }

  // open() always exists in JS; without the native module it never settles.
  if (!(TurboModuleRegistry.get('RNRazorpayCheckout') || NativeModules.RNRazorpayCheckout)) {
    throw notPaidError('Payment is not available in this app build. Please update the app.');
  }

  // Razorpay hangs on empty prefill strings — only send real values.
  const cleanPrefill = Object.fromEntries(Object.entries(prefill).filter(([, v]) => v).map(([k, v]) => [k, String(v)]));
  let response;
  try {
    response = await RazorpayCheckout.open({
      // The SDK reads the publishable key from `key`, not `key_id`.
      key: order.key_id,
      order_id: order.order_id,
      amount: order.amount,
      currency: order.currency || 'INR',
      name: 'Humaeli',
      description: 'Appointment payment',
      config: paymentCheckoutDisplay(order.method || method),
      // No "Save this card" step: saving a card asks for an extra OTP by SMS
      // ("Securely saving your card") that patients mistake for the payment
      // OTP — the payment then never completes and nothing gets booked.
      remember_customer: false,
      ...(Object.keys(cleanPrefill).length ? { prefill: cleanPrefill } : {}),
      theme: { color: '#004ac6' },
    });
  } catch (err) {
    // Code 0 / "Payment Cancelled" when the patient backs out of checkout.
    const cancelled = err?.code === 0 || /cancel/i.test(String(err?.description || err?.message || ''));
    throw notPaidError(cancelled ? NOT_COMPLETED : checkoutErrorText(err, method), cancelled);
  }

  try {
    const { data } = await api.post(`/api/payments/appointments/${encodeURIComponent(String(appointmentId))}/verify`, response);
    if (!data?.paid) throw new Error('Payment confirmation is pending. Your appointment remains reserved.');
    return data;
  } catch (error) {
    // Recover a lost verification response before offering another attempt.
    try {
      const { data } = await api.post(`/api/payments/appointments/${encodeURIComponent(String(appointmentId))}/reconcile`);
      if (data?.paid) return data;
    } catch { /* Surface the original confirmation error. */ }
    // Checkout took the money; only its confirmation failed. `charged` tells
    // the caller never to release this booking on its own.
    throw Object.assign(new Error(apiError(error, 'Payment confirmation is pending.')), { charged: true });
  }
}

// Wallet: no checkout — the server debits the wallet and marks the appointment
// paid in the /internal call (web payForAppointment). An answer
// that refuses (e.g. code INSUFFICIENT_WALLET_BALANCE) means nothing was
// debited. No answer at all (timeout, dropped connection) may still have
// debited, so the booking is reconciled and otherwise kept for a retry.
async function payFromWallet(appointmentId) {
  const id = encodeURIComponent(String(appointmentId));
  let data;
  try {
    ({ data } = await api.post(`/api/payments/appointments/${id}/internal`, { method: 'wallet' }));
  } catch (error) {
    if (error?.response) {
      console.warn('[payment] wallet refused', error.response.status, JSON.stringify(error.response.data));
      const insufficient = /INSUFFICIENT/i.test(String(error.response.data?.code || ''));
      throw notPaidError(insufficient
        ? 'Your wallet balance is too low for this appointment. Add money to your wallet or choose another payment method.'
        : methodRefused(error)
          ? "This doctor can't take wallet payments yet. Please choose another payment method."
          : apiError(error, 'Wallet payment could not be completed.'));
    }
    try {
      const { data: recovered } = await api.post(`/api/payments/appointments/${id}/reconcile`);
      if (recovered?.paid) return recovered;
    } catch { /* Report the unconfirmed payment below. */ }
    throw Object.assign(new Error('Wallet payment could not be confirmed. Check your wallet history before trying again.'), { charged: true });
  }
  // The web counts any success answer as paid; only an explicit `paid: false`
  // or a Razorpay order (wallet not taken here) means nothing was debited.
  if (data?.order_id && !data?.paid) {
    throw notPaidError("Wallet payment isn't available for this booking yet. Please choose another payment method.");
  }
  if (data?.paid === false) throw notPaidError('Wallet payment could not be completed.');
  return { ...data, paid: true };
}
