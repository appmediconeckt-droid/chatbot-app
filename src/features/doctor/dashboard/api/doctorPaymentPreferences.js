// Wallet is always on for every doctor (Payment Settings shows it locked on),
// but the server only takes a wallet payment for a doctor whose saved
// `methods` include 'wallet' — otherwise patients paying from their wallet
// get "payment method not supported". Preferences saved before Wallet existed
// lack it, so the dashboard adds it once per app session:
//   GET /api/payments/preferences → { methods, bankAccount, upiId, upiApp }
//   PUT /api/payments/preferences   the same, with 'wallet' added to methods
// Everything else is sent back unchanged, exactly as Payment Settings' Save does.
import axiosInstance from '../../../../axiosConfig';

let synced = false;

// Resolves true when 'wallet' was added, false when it was already there or
// the preferences couldn't be read / saved (tried again next session).
export const ensureWalletAccepted = async () => {
  if (synced) return false;
  try {
    const { data } = await axiosInstance.get('/api/payments/preferences', { timeout: 15000 });
    // No saved list: Payment Settings treats it as cash only.
    const methods = Array.isArray(data?.methods) ? data.methods : ['cash'];
    if (methods.some((m) => String(m).trim().toLowerCase() === 'wallet')) {
      synced = true;
      return false;
    }
    await axiosInstance.put('/api/payments/preferences', {
      methods: [...methods, 'wallet'],
      bankAccount: data?.bankAccount || {},
      upiId: String(data?.upiId || ''),
      upiApp: String(data?.upiApp || ''),
    });
    synced = true;
    return true;
  } catch (error) {
    console.warn('Wallet payment method could not be saved:', error?.response?.data || error?.message);
    return false;
  }
};

// Tests only.
export const resetWalletSync = () => { synced = false; };
