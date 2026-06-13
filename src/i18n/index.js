import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Priority Languages
import en from './locales/en.json';
import hi from './locales/hi.json';

// World Languages
import zh from './locales/zh.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import ar from './locales/ar.json';
import pt from './locales/pt.json';
import ru from './locales/ru.json';
import ja from './locales/ja.json';
import de from './locales/de.json';
import deCh from './locales/de-CH.json';
import th from './locales/th.json';

// Indian Languages
import mr from './locales/mr.json';
import ta from './locales/ta.json';
import pa from './locales/pa.json';
import bn from './locales/bn.json';
import gu from './locales/gu.json';
import kn from './locales/kn.json';
import ml from './locales/ml.json';
import te from './locales/te.json';
import ur from './locales/ur.json';
import ne from './locales/ne.json';

export const LANG_STORAGE_KEY = 'appLanguage';

// Generate a unique key for each user
export const getUserLangStorageKey = (userId, role) => {
  if (!userId || !role) return LANG_STORAGE_KEY;
  return `userLang_${role}_${userId}`;
};

// Load language for a specific user
export const loadUserLanguage = async (userId, role) => {
  const key = getUserLangStorageKey(userId, role);
  const storedLang = await AsyncStorage.getItem(key);
  const langToUse = storedLang || 'en'; // default English
  await i18n.changeLanguage(langToUse);
  return langToUse;
};

// Save language for a specific user
export const saveUserLanguage = async (userId, role, languageCode) => {
  const key = getUserLangStorageKey(userId, role);
  await AsyncStorage.setItem(key, languageCode);
  await i18n.changeLanguage(languageCode);
};

export const LANGUAGES = [
  // Priority Languages
  { code: 'en', label: 'English',    native: 'English',           region: 'priority' },
  { code: 'hi', label: 'Hindi',      native: 'हिन्दी',            region: 'priority' },

  // World Languages
  { code: 'zh', label: 'Chinese',    native: '中文',              region: 'world' },
  { code: 'es', label: 'Spanish',    native: 'Español',           region: 'world' },
  { code: 'fr', label: 'French',     native: 'Français',          region: 'world' },
  { code: 'ar', label: 'Arabic',     native: 'العربية',           region: 'world' },
  { code: 'pt', label: 'Portuguese', native: 'Português',         region: 'world' },
  { code: 'ru', label: 'Russian',    native: 'Русский',           region: 'world' },
  { code: 'ja', label: 'Japanese',   native: '日本語',            region: 'world' },
  { code: 'de', label: 'German',     native: 'Deutsch',           region: 'world' },
  { code: 'th', label: 'Thai',       native: 'ไทย',               region: 'world' },
  { code: 'de-CH', label: 'German (Switzerland)', native: 'Deutsch (Schweiz)', region: 'world' },

  // Indian & South Asian Languages
  { code: 'mr', label: 'Marathi',    native: 'मराठी',             region: 'indian' },
  { code: 'ta', label: 'Tamil',      native: 'தமிழ்',             region: 'indian' },
  { code: 'pa', label: 'Punjabi',    native: 'ਪੰਜਾਬੀ',            region: 'indian' },
  { code: 'bn', label: 'Bengali',    native: 'বাংলা',             region: 'indian' },
  { code: 'gu', label: 'Gujarati',   native: 'ગુજરાતી',           region: 'indian' },
  { code: 'kn', label: 'Kannada',    native: 'ಕನ್ನಡ',             region: 'indian' },
  { code: 'ml', label: 'Malayalam',  native: 'മലയാളം',           region: 'indian' },
  { code: 'te', label: 'Telugu',     native: 'తెలుగు',            region: 'indian' },
  { code: 'ur', label: 'Urdu',       native: 'اردو',              region: 'indian' },
  { code: 'ne', label: 'Nepali',     native: 'नेपाली',            region: 'indian' },
];

const resources = {
  en, hi,
  zh, es, fr, ar, pt, ru, ja, de, deCh, th,
  mr, ta, pa, bn, gu, kn, ml, te, ur, ne
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en',
    fallbackLng: 'en',
    ns: ['common', 'auth', 'dashboard', 'counselor', 'messages', 'settings', 'lock', 'language', 'call', 'profile', 'wallet', 'appointment'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    compatibilityJSON: 'v4',
  });

export default i18n;