import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Locale files are loaded on demand: only English (the fallback) is read at
// startup and every other language the first time it is selected — parsing
// all ~80 files (several MB) on every launch slowed the app's start.
// Metro needs static require() paths, hence one loader per file.
const LOCALE_LOADERS = {
  'en-US': () => require('./locales/en-US.json'),
  'en-GB': () => require('./locales/en-GB.json'),
  'en-IN': () => require('./locales/en-IN.json'),
  'hi-IN': () => require('./locales/hi-IN.json'),
  'ur-IN': () => require('./locales/ur-IN.json'),
  'ta-IN': () => require('./locales/ta-IN.json'),
  'te-IN': () => require('./locales/te-IN.json'),
  'kn-IN': () => require('./locales/kn-IN.json'),
  'ml-IN': () => require('./locales/ml-IN.json'),
  'bn-IN': () => require('./locales/bn-IN.json'),
  'gu-IN': () => require('./locales/gu-IN.json'),
  'mr-IN': () => require('./locales/mr-IN.json'),
  'pa-IN': () => require('./locales/pa-IN.json'),
  'as-IN': () => require('./locales/as-IN.json'),
  'or-IN': () => require('./locales/or-IN.json'),
  'ne-NP': () => require('./locales/ne-NP.json'),
  'si-LK': () => require('./locales/si-LK.json'),
  'ar-SA': () => require('./locales/ar-SA.json'),
  'zh-CN': () => require('./locales/zh-CN.json'),
  'zh-TW': () => require('./locales/zh-TW.json'),
  'ja-JP': () => require('./locales/ja-JP.json'),
  'ko-KR': () => require('./locales/ko-KR.json'),
  'id-ID': () => require('./locales/id-ID.json'),
  'ms-MY': () => require('./locales/ms-MY.json'),
  'th-TH': () => require('./locales/th-TH.json'),
  'vi-VN': () => require('./locales/vi-VN.json'),
  'fil-PH': () => require('./locales/fil-PH.json'),
  'fa-IR': () => require('./locales/fa-IR.json'),
  'he-IL': () => require('./locales/he-IL.json'),
  'tr-TR': () => require('./locales/tr-TR.json'),
  'ru-RU': () => require('./locales/ru-RU.json'),
  'uk-UA': () => require('./locales/uk-UA.json'),
  'pl-PL': () => require('./locales/pl-PL.json'),
  'cs-CZ': () => require('./locales/cs-CZ.json'),
  'sk-SK': () => require('./locales/sk-SK.json'),
  'hu-HU': () => require('./locales/hu-HU.json'),
  'ro-RO': () => require('./locales/ro-RO.json'),
  'bg-BG': () => require('./locales/bg-BG.json'),
  'el-GR': () => require('./locales/el-GR.json'),
  'de-DE': () => require('./locales/de-DE.json'),
  'nl-NL': () => require('./locales/nl-NL.json'),
  'fr-FR': () => require('./locales/fr-FR.json'),
  'es-ES': () => require('./locales/es-ES.json'),
  'pt-PT': () => require('./locales/pt-PT.json'),
  'pt-BR': () => require('./locales/pt-BR.json'),
  'it-IT': () => require('./locales/it-IT.json'),
  'sv-SE': () => require('./locales/sv-SE.json'),
  'da-DK': () => require('./locales/da-DK.json'),
  'fi-FI': () => require('./locales/fi-FI.json'),
  'no-NO': () => require('./locales/no-NO.json'),
  'af-ZA': () => require('./locales/af-ZA.json'),
  'sw-KE': () => require('./locales/sw-KE.json'),
  'am-ET': () => require('./locales/am-ET.json'),
  'ha-NG': () => require('./locales/ha-NG.json'),
  'yo-NG': () => require('./locales/yo-NG.json'),
  'zu-ZA': () => require('./locales/zu-ZA.json'),
};

export const LANG_STORAGE_KEY = 'appLanguage';
// Set when a language is picked before signing in (e.g. on the Login screen).
// The first dashboard load after sign-in adopts it for that account, so the
// choice carries through instead of being replaced by an older saved one.
export const PENDING_ACCOUNT_LANG_KEY = 'pendingAccountLanguage';

// Generate a unique key for each user
export const getUserLangStorageKey = (userId, role) => {
  if (!userId || !role) return LANG_STORAGE_KEY;
  return `userLang_${role}_${userId}`;
};

// Load language for a specific user
export const loadUserLanguage = async (userId, role) => {
  const key = getUserLangStorageKey(userId, role);
  const pendingLang = await AsyncStorage.getItem(PENDING_ACCOUNT_LANG_KEY);
  if (pendingLang && userId && role) {
    await AsyncStorage.multiRemove([PENDING_ACCOUNT_LANG_KEY]);
    await AsyncStorage.setItem(key, pendingLang);
    await i18n.changeLanguage(pendingLang);
    return pendingLang;
  }
  const storedLang = await AsyncStorage.getItem(key);
  // Fall back to the global app language, then to en-US
  const globalLang = await AsyncStorage.getItem(LANG_STORAGE_KEY);
  const langToUse = storedLang || globalLang || 'en-US';
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
  // ──── TOP PRIORITY ────
  { code: 'en-US', label: 'English', name: 'English' },
  { code: 'hi-IN', label: 'Hindi', name: 'हिंदी' },

  // ──── ALL OTHER LANGUAGES (ALPHABETICAL) ────
  { code: 'af-ZA', label: 'Afrikaans', name: 'Afrikaans' },
  { code: 'am-ET', label: 'Amharic', name: 'አማርኛ' },
  { code: 'ar-SA', label: 'Arabic', name: 'العربية' },
  { code: 'as-IN', label: 'Assamese', name: 'অসমীয়া' },
  { code: 'bg-BG', label: 'Bulgarian', name: 'Български' },
  { code: 'bn-IN', label: 'Bengali', name: 'বাংলা' },
  { code: 'cs-CZ', label: 'Czech', name: 'Čeština' },
  { code: 'da-DK', label: 'Danish', name: 'Dansk' },
  { code: 'de-DE', label: 'German', name: 'Deutsch' },
  { code: 'el-GR', label: 'Greek', name: 'Ελληνικά' },
  { code: 'en-GB', label: 'English (UK)', name: 'English (UK)' },
  { code: 'en-IN', label: 'English (India)', name: 'English (India)' },
  { code: 'es-ES', label: 'Spanish', name: 'Español' },
  { code: 'fa-IR', label: 'Persian', name: 'فارسی' },
  { code: 'fil-PH', label: 'Filipino', name: 'Filipino' },
  { code: 'fi-FI', label: 'Finnish', name: 'Suomi' },
  { code: 'fr-FR', label: 'French', name: 'Français' },
  { code: 'gu-IN', label: 'Gujarati', name: 'ગુજરાતી' },
  { code: 'ha-NG', label: 'Hausa', name: 'Hausa' },
  { code: 'he-IL', label: 'Hebrew', name: 'עברית' },
  { code: 'hu-HU', label: 'Hungarian', name: 'Magyar' },
  { code: 'id-ID', label: 'Indonesian', name: 'Bahasa Indonesia' },
  { code: 'it-IT', label: 'Italian', name: 'Italiano' },
  { code: 'ja-JP', label: 'Japanese', name: '日本語' },
  { code: 'kn-IN', label: 'Kannada', name: 'ಕನ್ನಡ' },
  { code: 'ko-KR', label: 'Korean', name: '한국어' },
  { code: 'ml-IN', label: 'Malayalam', name: 'മലയാളം' },
  { code: 'mr-IN', label: 'Marathi', name: 'मराठी' },
  { code: 'ms-MY', label: 'Malay', name: 'Bahasa Melayu' },
  { code: 'ne-NP', label: 'Nepali', name: 'नेपाली' },
  { code: 'nl-NL', label: 'Dutch', name: 'Nederlands' },
  { code: 'no-NO', label: 'Norwegian', name: 'Norsk' },
  { code: 'or-IN', label: 'Odia', name: 'ଓଡ଼ିଆ' },
  { code: 'pa-IN', label: 'Punjabi', name: 'ਪੰਜਾਬੀ' },
  { code: 'pl-PL', label: 'Polish', name: 'Polski' },
  { code: 'pt-BR', label: 'Portuguese (Brazil)', name: 'Português (Brasil)' },
  { code: 'pt-PT', label: 'Portuguese', name: 'Português' },
  { code: 'ro-RO', label: 'Romanian', name: 'Română' },
  { code: 'ru-RU', label: 'Russian', name: 'Русский' },
  { code: 'si-LK', label: 'Sinhala', name: 'සිංහල' },
  { code: 'sk-SK', label: 'Slovak', name: 'Slovenčina' },
  { code: 'sv-SE', label: 'Swedish', name: 'Svenska' },
  { code: 'sw-KE', label: 'Swahili', name: 'Kiswahili' },
  { code: 'ta-IN', label: 'Tamil', name: 'தமிழ்' },
  { code: 'te-IN', label: 'Telugu', name: 'తెలుగు' },
  { code: 'th-TH', label: 'Thai', name: 'ไทย' },
  { code: 'tr-TR', label: 'Turkish', name: 'Türkçe' },
  { code: 'uk-UA', label: 'Ukrainian', name: 'Українська' },
  { code: 'ur-IN', label: 'Urdu', name: 'اردو' },
  { code: 'vi-VN', label: 'Vietnamese', name: 'Tiếng Việt' },
  { code: 'yo-NG', label: 'Yoruba', name: 'Yorùbá' },
  { code: 'zh-CN', label: 'Chinese (Simplified)', name: '简体中文' },
  { code: 'zh-TW', label: 'Chinese (Traditional)', name: '繁體中文' },
  { code: 'zu-ZA', label: 'Zulu', name: 'isiZulu' },
];

// Create mapping for legacy codes
export const LEGACY_LANGUAGES = [
  { code: 'en', label: 'English', native: 'English', region: 'priority' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी', region: 'priority' },
  { code: 'ar', label: 'Arabic', native: 'العربية', region: 'world' },
  { code: 'zh', label: 'Chinese', native: '中文', region: 'world' },
  { code: 'fr', label: 'French', native: 'Français', region: 'world' },
  { code: 'de', label: 'German', native: 'Deutsch', region: 'world' },
  { code: 'de-CH', label: 'German (Switzerland)', native: 'Deutsch (Schweiz)', region: 'world' },
  { code: 'ja', label: 'Japanese', native: '日本語', region: 'world' },
  { code: 'ko', label: 'Korean', native: '한국어', region: 'world' },
  { code: 'pt', label: 'Portuguese', native: 'Português', region: 'world' },
  { code: 'ru', label: 'Russian', native: 'Русский', region: 'world' },
  { code: 'es', label: 'Spanish', native: 'Español', region: 'world' },
  { code: 'th', label: 'Thai', native: 'ไทย', region: 'world' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা', region: 'indian' },
  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી', region: 'indian' },
  { code: 'kn', label: 'Kannada', native: 'ಕನ್ನಡ', region: 'indian' },
  { code: 'ml', label: 'Malayalam', native: 'മലയാളം', region: 'indian' },
  { code: 'mr', label: 'Marathi', native: 'मराठी', region: 'indian' },
  { code: 'ne', label: 'Nepali', native: 'नेपाली', region: 'indian' },
  { code: 'pa', label: 'Punjabi', native: 'ਪੰਜਾਬੀ', region: 'indian' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்', region: 'indian' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు', region: 'indian' },
  { code: 'ur', label: 'Urdu', native: 'اردو', region: 'indian' },
];

// Each JSON file has all namespaces nested inside it, e.g. { "common": {...}, "dashboard": {...} }
// i18next resources are { locale: { ns: translations } }, so a file's
// top-level keys are the namespaces for that locale.

// Legacy short codes read the same file as their full code.
const LOCALE_ALIASES = {
  en: 'en-US',
  hi: 'hi-IN',
  ar: 'ar-SA',
  zh: 'zh-CN',
  es: 'es-ES',
  fr: 'fr-FR',
  pt: 'pt-PT',
  ru: 'ru-RU',
  ja: 'ja-JP',
  de: 'de-DE',
  'de-CH': 'de-DE',
  th: 'th-TH',
  ko: 'ko-KR',
  mr: 'mr-IN',
  ta: 'ta-IN',
  pa: 'pa-IN',
  bn: 'bn-IN',
  gu: 'gu-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  te: 'te-IN',
  ur: 'ur-IN',
  ne: 'ne-NP',
};

// Adds a language's translations to i18next if they are not loaded yet.
export const ensureLanguageLoaded = (code) => {
  if (!code || typeof code !== 'string' || i18n.hasResourceBundle(code, 'common')) return;
  const load = LOCALE_LOADERS[code] || LOCALE_LOADERS[LOCALE_ALIASES[code]];
  if (!load) return;
  const json = load();
  Object.entries(json || {}).forEach(([ns, data]) => {
    if (data && typeof data === 'object') i18n.addResourceBundle(code, ns, data, true, true);
  });
};

const resources = { 'en-US': { ...LOCALE_LOADERS['en-US']() } };

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en-US',
    fallbackLng: 'en-US',
    ns: ['common', 'auth', 'dashboard', 'counselor', 'messages', 'settings', 'lock', 'language', 'call', 'profile', 'wallet', 'appointment', 'helpPage', 'privacyPage'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    compatibilityJSON: 'v4',
    react: {
      useSuspense: false,
      bindI18n: 'languageChanged loaded',
      bindI18nStore: 'added removed',
      transEmptyNodeValue: '',
    },
  });

// Every language switch (context, per-user loaders, selector) goes through
// changeLanguage, so the file is loaded right before it is needed.
const changeLanguage = i18n.changeLanguage.bind(i18n);
i18n.changeLanguage = (lng, ...rest) => {
  ensureLanguageLoaded(lng);
  return changeLanguage(lng, ...rest);
};

// Export translation hooks for use in components
export { useUserTranslation, useCounselorTranslation } from './useTranslations';

export default i18n;
