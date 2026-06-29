import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../axiosConfig';

const CACHE_PREFIX = 'translation_cache_';
const CACHE_VERSION = 'v1';

// App locale code -> Google translate code (only the ones that differ).
const GOOGLE_LANG = {
  'zh-CN': 'zh-CN',
  'zh-TW': 'zh-TW',
  'pt-BR': 'pt',
  'pt-PT': 'pt-PT',
  'no-NO': 'no',
  'fil-PH': 'tl',
  'he-IL': 'iw',
};

class TranslationService {
  constructor() {
    this.cache = new Map();
    this.pending = new Map();
    this.loadCacheFromStorage();
  }

  async loadCacheFromStorage() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));

      for (const key of cacheKeys) {
        const data = JSON.parse(await AsyncStorage.getItem(key));
        this.cache.set(key, data);
      }
    } catch (err) {
      console.warn('Failed to load translation cache:', err);
    }
  }

  getCacheKey(text, targetLang, sourceLang = 'en-US') {
    const hash = this.simpleHash(text);
    return `${CACHE_PREFIX}${sourceLang}_${targetLang}_${hash}`;
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }

  async translate(text, targetLang, sourceLang = 'en-US') {
    if (!text || !text.trim()) return text;
    if (targetLang === 'en-US' || targetLang === sourceLang) return text;

    const cacheKey = this.getCacheKey(text, targetLang, sourceLang);

    // Check in-memory cache
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.translatedText) {
        return cached.translatedText;
      }
    }

    // Check AsyncStorage cache
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const data = JSON.parse(cached);
        this.cache.set(cacheKey, data);
        return data.translatedText;
      }
    } catch (err) {
      console.warn('Cache read error:', err);
    }

    // If already pending, return the pending promise
    if (this.pending.has(cacheKey)) {
      return this.pending.get(cacheKey);
    }

    // Make API call
    const promise = this._translateFromAPI(text, targetLang, sourceLang, cacheKey);
    this.pending.set(cacheKey, promise);

    try {
      const result = await promise;
      return result;
    } finally {
      this.pending.delete(cacheKey);
    }
  }

  async _translateFromAPI(text, targetLang, sourceLang, cacheKey, retryCount = 0) {
    try {
      // Translate directly via the free Google endpoint (no API key / backend
      // needed). Auto-detect source so it works for UI strings (English) AND
      // dynamic chat messages (any language). `dt=t` returns translation segments.
      const tl = GOOGLE_LANG[targetLang] || targetLang.split('-')[0];
      const url =
        `https://translate.googleapis.com/translate_a/single?client=gtx` +
        `&sl=auto&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(text)}`;

      const response = await axios.get(url, {
        timeout: 15000,
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });

      const segments = response.data?.[0];
      const translatedText = Array.isArray(segments)
        ? segments.map((s) => (s && s[0]) || '').join('')
        : text;
      const data = { translatedText: translatedText || text, timestamp: Date.now() };

      // Save to cache
      this.cache.set(cacheKey, data);
      try {
        await AsyncStorage.setItem(cacheKey, JSON.stringify(data));
      } catch (err) {
        console.warn('Cache write error:', err);
      }

      return translatedText;
    } catch (error) {
      // Retry on 429 (rate limit) with exponential backoff
      if (error.response?.status === 429 && retryCount < 3) {
        const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
        console.warn(`Rate limited. Retrying in ${delay}ms (attempt ${retryCount + 1}/3)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this._translateFromAPI(text, targetLang, sourceLang, cacheKey, retryCount + 1);
      }

      console.warn(`Translation failed for "${text}" to ${targetLang}:`, error.message);
      // Return original text on error
      return text;
    }
  }

  async clearCache() {
    try {
      this.cache.clear();
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(k => k.startsWith(CACHE_PREFIX));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (err) {
      console.warn('Cache clear error:', err);
    }
  }
}

export const translationService = new TranslationService();
