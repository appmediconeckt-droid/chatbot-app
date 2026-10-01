import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { forceSignOut } from './authSession';

// How often the watcher re-reads the stored token. The token is re-read each
// tick (rather than scheduling one timer at login) because login screens write
// it straight to AsyncStorage without telling anyone.
const CHECK_INTERVAL_MS = 30 * 1000;

const decodeBase64Url = (input) => {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return atob(padded);
};

/** Expiry of a JWT in epoch ms, or null if it has no `exp` / can't be read. */
export const getTokenExpiryMs = (token) => {
  try {
    const payload = String(token || '').split('.')[1];
    if (!payload) return null;
    const { exp } = JSON.parse(decodeBase64Url(payload));
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
};

export const isTokenExpired = (token) => {
  const expiresAt = getTokenExpiryMs(token);
  return expiresAt !== null && Date.now() >= expiresAt;
};

export const getStoredAccessToken = async () =>
  (await AsyncStorage.getItem('accessToken')) || (await AsyncStorage.getItem('token'));

export const signOutIfTokenExpired = async () => {
  const token = await getStoredAccessToken();
  if (token && isTokenExpired(token)) {
    await forceSignOut({ reason: 'expired' });
    return true;
  }
  return false;
};

let watcherStarted = false;

/**
 * Signs the user out and drops them on the login screen the moment their
 * access token expires — checked on start, every CHECK_INTERVAL_MS, and each
 * time the app comes back to the foreground. Call once the NavigationContainer
 * is ready, otherwise forceSignOut has nowhere to navigate.
 */
export const startTokenExpiryWatcher = () => {
  if (watcherStarted) return;
  watcherStarted = true;

  const check = () => {
    signOutIfTokenExpired().catch((error) => {
      console.warn('[TokenExpiry] check failed:', error?.message || error);
    });
  };

  check();
  setInterval(check, CHECK_INTERVAL_MS);
  AppState.addEventListener('change', (state) => {
    if (state === 'active') check();
  });
};
