import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

// English variants
import enUS from './locales/en-US.json';
import enGB from './locales/en-GB.json';
import enIN from './locales/en-IN.json';

// Indian Languages
import hiIN from './locales/hi-IN.json';
import urIN from './locales/ur-IN.json';
import taIN from './locales/ta-IN.json';
import teIN from './locales/te-IN.json';
import knIN from './locales/kn-IN.json';
import mlIN from './locales/ml-IN.json';
import bnIN from './locales/bn-IN.json';
import guIN from './locales/gu-IN.json';
import mrIN from './locales/mr-IN.json';
import paIN from './locales/pa-IN.json';
import asIN from './locales/as-IN.json';
import orIN from './locales/or-IN.json';
import neNP from './locales/ne-NP.json';
import siLK from './locales/si-LK.json';

// World Languages
import arSA from './locales/ar-SA.json';
import zhCN from './locales/zh-CN.json';
import zhTW from './locales/zh-TW.json';
import jaJP from './locales/ja-JP.json';
import koKR from './locales/ko-KR.json';
import idID from './locales/id-ID.json';
import msMY from './locales/ms-MY.json';
import thTH from './locales/th-TH.json';
import viVN from './locales/vi-VN.json';
import filPH from './locales/fil-PH.json';
import faIR from './locales/fa-IR.json';
import heIL from './locales/he-IL.json';
import trTR from './locales/tr-TR.json';
import ruRU from './locales/ru-RU.json';
import ukUA from './locales/uk-UA.json';
import plPL from './locales/pl-PL.json';
import csCZ from './locales/cs-CZ.json';
import skSK from './locales/sk-SK.json';
import huHU from './locales/hu-HU.json';
import roRO from './locales/ro-RO.json';
import bgBG from './locales/bg-BG.json';
import elGR from './locales/el-GR.json';
import deDE from './locales/de-DE.json';
import nlNL from './locales/nl-NL.json';
import frFR from './locales/fr-FR.json';
import esES from './locales/es-ES.json';
import ptPT from './locales/pt-PT.json';
import ptBR from './locales/pt-BR.json';
import itIT from './locales/it-IT.json';
import svSE from './locales/sv-SE.json';
import daDK from './locales/da-DK.json';
import fiFI from './locales/fi-FI.json';
import noNO from './locales/no-NO.json';
import afZA from './locales/af-ZA.json';
import swKE from './locales/sw-KE.json';
import amET from './locales/am-ET.json';
import haNG from './locales/ha-NG.json';
import yoNG from './locales/yo-NG.json';
import zuZA from './locales/zu-ZA.json';

// Legacy imports for backward compatibility
import en from './locales/en-US.json';
import hi from './locales/hi-IN.json';
import ar from './locales/ar-SA.json';
import zh from './locales/zh-CN.json';
import es from './locales/es-ES.json';
import fr from './locales/fr-FR.json';
import pt from './locales/pt-PT.json';
import ru from './locales/ru-RU.json';
import ja from './locales/ja-JP.json';
import de from './locales/de-DE.json';
import deCh from './locales/de-DE.json';
import th from './locales/th-TH.json';
import ko from './locales/ko-KR.json';
import mr from './locales/mr-IN.json';
import ta from './locales/ta-IN.json';
import pa from './locales/pa-IN.json';
import bn from './locales/bn-IN.json';
import gu from './locales/gu-IN.json';
import kn from './locales/kn-IN.json';
import ml from './locales/ml-IN.json';
import te from './locales/te-IN.json';
import ur from './locales/ur-IN.json';
import ne from './locales/ne-NP.json';

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

const resources = {
  // English variants
  'en-US': enUS,
  'en-GB': enGB,
  'en-IN': enIN,

  // Indian languages
  'hi-IN': hiIN,
  'ur-IN': urIN,
  'ta-IN': taIN,
  'te-IN': teIN,
  'kn-IN': knIN,
  'ml-IN': mlIN,
  'bn-IN': bnIN,
  'gu-IN': guIN,
  'mr-IN': mrIN,
  'pa-IN': paIN,
  'as-IN': asIN,
  'or-IN': orIN,
  'ne-NP': neNP,
  'si-LK': siLK,

  // World languages
  'ar-SA': arSA,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  'ja-JP': jaJP,
  'ko-KR': koKR,
  'id-ID': idID,
  'ms-MY': msMY,
  'th-TH': thTH,
  'vi-VN': viVN,
  'fil-PH': filPH,
  'fa-IR': faIR,
  'he-IL': heIL,
  'tr-TR': trTR,
  'ru-RU': ruRU,
  'uk-UA': ukUA,
  'pl-PL': plPL,
  'cs-CZ': csCZ,
  'sk-SK': skSK,
  'hu-HU': huHU,
  'ro-RO': roRO,
  'bg-BG': bgBG,
  'el-GR': elGR,
  'de-DE': deDE,
  'nl-NL': nlNL,
  'fr-FR': frFR,
  'es-ES': esES,
  'pt-PT': ptPT,
  'pt-BR': ptBR,
  'it-IT': itIT,
  'sv-SE': svSE,
  'da-DK': daDK,
  'fi-FI': fiFI,
  'no-NO': noNO,
  'af-ZA': afZA,
  'sw-KE': swKE,
  'am-ET': amET,
  'ha-NG': haNG,
  'yo-NG': yoNG,
  'zu-ZA': zuZA,

  // Legacy codes for backward compatibility
  en, hi, ar, zh, es, fr, pt, ru, ja, de, deCh, th, ko,
  mr, ta, pa, bn, gu, kn, ml, te, ur, ne
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en-US',
    fallbackLng: 'en-US',
    ns: ['common', 'auth', 'dashboard', 'counselor', 'messages', 'settings', 'lock', 'language', 'call', 'profile', 'wallet', 'appointment'],
    defaultNS: 'common',
    interpolation: { escapeValue: false },
    compatibilityJSON: 'v4',
    react: {
      useSuspense: false,
      bindI18n: 'languageChanged',
      bindI18nStore: 'added removed',
      // Force re-render on language change
      transEmptyNodeValue: '',
    },
    // Ensure proper language change detection
    detection: {
      order: ['localStorage', 'navigator'],
    },
  });

// Export translation hooks for use in components
export { useUserTranslation, useCounselorTranslation } from './useTranslations';

export default i18n;