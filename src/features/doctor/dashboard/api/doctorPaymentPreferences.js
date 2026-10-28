// Wallet availability is platform-wide and must not be written into the
// doctor's selectable payment preferences. Kept as a no-op for older callers.
export const ensureWalletAccepted = async () => false;

export const resetWalletSync = () => {};
