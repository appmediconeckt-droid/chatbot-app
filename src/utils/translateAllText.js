import { translationService } from '../i18n/translationService';
import i18n from '../i18n';

/**
 * Global text translation cache and utility
 * Use this to translate any text in any screen
 */
class GlobalTranslator {
  constructor() {
    this.cache = new Map();
    this.listeners = [];
  }

  /**
   * Translate text based on current language
   */
  async translate(text, language = null) {
    if (!text) return text;

    const lang = language || i18n.language || 'en-US';

    // If English, return as-is
    if (lang === 'en-US' || lang === 'en') return text;

    const cacheKey = `${text}_${lang}`;
    if (this.cache.has(cacheKey)) return this.cache.get(cacheKey);

    try {
      const translated = await translationService.translate(text, lang, 'en-US');
      this.cache.set(cacheKey, translated);
      return translated;
    } catch (error) {
      console.warn('[GlobalTranslator] Error:', error);
      return text;
    }
  }

  /**
   * Translate multiple texts at once
   */
  async translateMultiple(texts, language = null) {
    return Promise.all(texts.map(text => this.translate(text, language)));
  }

  /**
   * Subscribe to language changes
   */
  onLanguageChange(callback) {
    this.listeners.push(callback);
    i18n.on('languageChanged', callback);
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }
}

export const globalTranslator = new GlobalTranslator();
