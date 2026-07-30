import { Platform } from 'react-native';

let RNBiometrics = null;
try {
  RNBiometrics = require('react-native-biometrics').default;
} catch (_) {}

export async function isBiometricAvailable() {
  if (!RNBiometrics) return { available: false, biometryType: null };
  try {
    const rnBiometrics = new RNBiometrics({ allowDeviceCredentials: false });
    const { available, biometryType } = await rnBiometrics.isSensorAvailable();
    return { available: !!available, biometryType: biometryType || null };
  } catch {
    return { available: false, biometryType: null };
  }
}

export async function authenticateWithBiometrics(promptMessage = 'Unlock Humaeli') {
  if (!RNBiometrics) return { success: false };
  try {
    const rnBiometrics = new RNBiometrics({ allowDeviceCredentials: false });
    const result = await rnBiometrics.simplePrompt({ promptMessage });
    return { success: result?.success === true };
  } catch {
    return { success: false };
  }
}
