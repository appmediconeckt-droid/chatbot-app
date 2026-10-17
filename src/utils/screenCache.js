// WhatsApp-style lists: a screen shows its last saved copy straight away,
// then refreshes from the API in the background and saves the new copy.
// Copies are kept per signed-in account (so another login on the same phone
// never sees them) and are wiped on logout (clearAccountLocalData).
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SCREEN_CACHE_PREFIX = 'screencache_v1:';

const accountId = async () => {
  try {
    return (await AsyncStorage.getItem('userId'))
      || (await AsyncStorage.getItem('counsellorId'))
      || (await AsyncStorage.getItem('userEmail'))
      || '';
  } catch {
    return '';
  }
};

const keyFor = async (name) => {
  const id = await accountId();
  return id ? `${SCREEN_CACHE_PREFIX}${id}:${name}` : null;
};

const sameLocalDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

// The saved copy, or null when there is none (or it cannot be read).
// `sameDay`: only a copy saved today (for day-specific lists like a queue).
export const readScreenCache = async (name, { sameDay = false } = {}) => {
  try {
    const key = await keyFor(name);
    if (!key) return null;
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !('data' in parsed)) return null;
    if (sameDay && !sameLocalDay(parsed.savedAt, Date.now())) return null;
    return parsed.data;
  } catch {
    return null;
  }
};

// Saves the latest copy; failures are ignored (the cache is best-effort).
export const writeScreenCache = async (name, data) => {
  try {
    const key = await keyFor(name);
    if (!key || data === undefined) return;
    await AsyncStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {
    /* best-effort */
  }
};
