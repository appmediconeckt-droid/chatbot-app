import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { resetToLogin } from '../navigationRef';

// Everything written at login. `rememberedUserId` is deliberately NOT here — it
// is the remember-me convenience, not a credential, and clearing it would make
// the user retype their id after every sign-out.
const SESSION_KEYS = [
  'accessToken', 'token', 'refreshToken',
  'userData', 'userId', 'userRole',
  'counsellorId', 'counselorId',
  'isAuthenticated',
];

export const clearStoredSession = async () => {
  await AsyncStorage.multiRemove(SESSION_KEYS);
};

export const resetToRoleSelector = (navigation) => {
  navigation?.replace?.('RoleSelector');
};

// Guards against a burst of failing requests each firing their own sign-out.
let signingOut = false;

/**
 * The session is gone server-side — most often because the account was signed
 * in on another device, which invalidates this device's refresh token.
 *
 * The interceptor used to only clear the tokens and let the 401 propagate, so
 * the user sat on a dashboard that showed no data and threw "Request failed
 * with status code 401" on every screen. Now the app drops to the login screen
 * the way it would after a normal sign-out.
 */
export const forceSignOut = async ({ silent = false } = {}) => {
  if (signingOut) return;
  signingOut = true;
  try {
    // Read the role BEFORE clearing, so the login screen keeps the right theme
    // (green for a user, blue for a counselor).
    const role = await AsyncStorage.getItem('userRole');
    await clearStoredSession();

    const navigated = resetToLogin(role);
    if (!silent && navigated) {
      Alert.alert(
        'Signed out',
        'Your account was signed in on another device, so this device has been signed out. Please log in again.',
      );
    }
  } finally {
    // Long enough for the reset to settle, short enough that a genuine second
    // expiry later in the session still bounces the user out.
    setTimeout(() => {
      signingOut = false;
    }, 2000);
  }
};
