import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './locales/en.json';
import hi from './locales/hi.json';
import mr from './locales/mr.json';
import ta from './locales/ta.json';
import pa from './locales/pa.json';
import bn from './locales/bn.json';
import gu from './locales/gu.json';
import kn from './locales/kn.json';
import ml from './locales/ml.json';
import te from './locales/te.json';
import ur from './locales/ur.json';

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
  { code: 'en', label: 'English',    native: 'English' },
  { code: 'hi', label: 'Hindi',      native: 'हिन्दी' },
  { code: 'mr', label: 'Marathi',    native: 'मराठी' },
  { code: 'ta', label: 'Tamil',      native: 'தமிழ்' },
  { code: 'pa', label: 'Punjabi',    native: 'ਪੰਜਾਬੀ' },
  { code: 'bn', label: 'Bengali',    native: 'বাংলা' },
  { code: 'gu', label: 'Gujarati',   native: 'ગુજરાતી' },
  { code: 'kn', label: 'Kannada',    native: 'ಕನ್ನಡ' },
  { code: 'ml', label: 'Malayalam',  native: 'മലയാളം' },
  { code: 'te', label: 'Telugu',     native: 'తెలుగు' },
  { code: 'ur', label: 'Urdu',       native: 'اردو' },
];

const resources = { en, hi, mr, ta, pa, bn, gu, kn, ml, te, ur };

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