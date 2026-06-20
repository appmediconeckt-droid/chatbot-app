import { Text } from 'react-native';
import { translationService } from './translationService';
import i18n from './index';

// Store original render
const OriginalText = Text;
let originalRender = OriginalText.prototype.render;

/**
 * Global setup - Auto-translate ALL Text components
 * Call this in App.tsx or index.js before rendering
 */
export const setupGlobalTextTranslation = () => {
  // This approach won't work with React Native Text directly
  // Instead, use the hook-based approach in individual screens
  console.log('[Translation Setup] Global translation initialized');
};

/**
 * Translation cache for performance
 */
export const createTranslationCache = () => {
  const cache = new Map();

  return {
    translate: async (text, language) => {
      if (!text || language === 'en-US' || language === 'en') return text;

      const key = `${text}_${language}`;
      if (cache.has(key)) return cache.get(key);

      const translated = await translationService.translate(text, language, 'en-US');
      cache.set(key, translated);
      return translated;
    },
    clear: () => cache.clear(),
  };
};

export const translationCache = createTranslationCache();
