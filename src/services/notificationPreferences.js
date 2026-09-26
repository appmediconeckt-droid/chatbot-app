import AsyncStorage from '@react-native-async-storage/async-storage';

// Doctor notification preferences, saved on this device. There is no backend
// preferences API, so these gate the notifications the app itself displays
// (every push while the app is open, and data-only pushes in the background).
// A push the OS draws on its own while the app is closed can't be filtered here.

export const NOTIFICATION_PREFS_KEY = 'doctorNotificationPreferences';

export const NOTIFICATION_CATEGORIES = ['appointments', 'messages', 'payments', 'system'];

export const DEFAULT_NOTIFICATION_PREFS = {
  enabled: true,
  categories: { appointments: true, messages: true, payments: true, system: true },
  quietHours: { enabled: false, from: '22:00', to: '07:00' },
};

const mergeWithDefaults = (saved) => ({
  ...DEFAULT_NOTIFICATION_PREFS,
  ...saved,
  categories: { ...DEFAULT_NOTIFICATION_PREFS.categories, ...(saved?.categories || {}) },
  quietHours: { ...DEFAULT_NOTIFICATION_PREFS.quietHours, ...(saved?.quietHours || {}) },
});

export const loadNotificationPreferences = async () => {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATION_PREFS_KEY);
    return mergeWithDefaults(raw ? JSON.parse(raw) : null);
  } catch {
    return mergeWithDefaults(null);
  }
};

export const saveNotificationPreferences = (prefs) =>
  AsyncStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(mergeWithDefaults(prefs)));

const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
};

// Handles windows that cross midnight (22:00 → 07:00).
export const isWithinQuietHours = (quietHours, date = new Date()) => {
  if (!quietHours?.enabled) return false;
  const from = toMinutes(quietHours.from);
  const to = toMinutes(quietHours.to);
  if (from === null || to === null || from === to) return false;
  const now = date.getHours() * 60 + date.getMinutes();
  return from < to ? now >= from && now < to : now >= from || now < to;
};

export const getNotificationCategory = (data = {}, { isChat = false } = {}) => {
  if (isChat) return 'messages';
  const type = String(data?.type || data?.notificationType || data?.event || '').toUpperCase();
  if (/APPOINT|BOOK|FOLLOW|QUEUE|TOKEN|WALK/.test(type)) return 'appointments';
  if (/MESSAGE|CHAT/.test(type)) return 'messages';
  if (/PAYMENT|WALLET|PAYOUT|REFUND/.test(type)) return 'payments';
  return 'system';
};

// Calls are never filtered (the caller handles them); everything else follows
// the doctor's saved preferences. Other roles have no preferences screen, so
// their notifications are left untouched.
export const shouldDeliverNotification = async (data = {}, { isChat = false } = {}) => {
  try {
    const role = String((await AsyncStorage.getItem('userRole')) || '').toLowerCase();
    if (role !== 'doctor') return true;
    const prefs = await loadNotificationPreferences();
    if (!prefs.enabled) return false;
    if (prefs.categories[getNotificationCategory(data, { isChat })] === false) return false;
    return !isWithinQuietHours(prefs.quietHours);
  } catch {
    return true;
  }
};
