import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
const CACHE_PREFIX = 'translation_cache_';
const CACHE_VERSION = 'v2';
const MAX_CONCURRENT_REQUESTS = 4;

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

const protectTranslationTokens = (text) => {
  const tokens = [];
  const protectedText = text.replace(/\{\{[^{}]+\}\}|\bHumaeli\b/g, (token) => {
    const marker = `__HUMAELI_${tokens.length}__`;
    tokens.push(token);
    return marker;
  });

  return {
    protectedText,
    restore: (translatedText) =>
      tokens.reduce(
        (result, token, index) => result.replace(`__HUMAELI_${index}__`, token),
        translatedText,
      ),
  };
};

const extractTranslatedText = (payload) => {
  if (typeof payload === 'string') return payload;
  if (!Array.isArray(payload)) return '';
  if (typeof payload[0] === 'string') return payload[0];

  // translate.google.com/single returns an array of translated segments.
  if (Array.isArray(payload[0])) {
    return payload[0]
      .map((segment) => (Array.isArray(segment) && typeof segment[0] === 'string' ? segment[0] : ''))
      .join('');
  }

  return '';
};

class TranslationService {
  constructor() {
    this.cache = new Map();
    this.pending = new Map();
    this.queue = [];
    this.activeRequests = 0;
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
    return `${CACHE_PREFIX}${CACHE_VERSION}_${sourceLang}_${targetLang}_${hash}`;
  }

  enqueue(request) {
    return new Promise((resolve, reject) => {
      this.queue.push({ request, resolve, reject });
      this.processQueue();
    });
  }

  processQueue() {
    while (this.activeRequests < MAX_CONCURRENT_REQUESTS && this.queue.length > 0) {
      const job = this.queue.shift();
      this.activeRequests += 1;

      Promise.resolve()
        .then(job.request)
        .then(job.resolve, job.reject)
        .finally(() => {
          this.activeRequests -= 1;
          this.processQueue();
        });
    }
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
    const promise = this.enqueue(() =>
      this._translateFromAPI(text, targetLang, sourceLang, cacheKey),
    );
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
      const tl = GOOGLE_LANG[targetLang] || targetLang.split('-')[0];
      const { protectedText, restore } = protectTranslationTokens(text);
      // The old translate.googleapis.com/gtx endpoint now frequently responds
      // with Google's automated-query block page on Android networks. The
      // Chrome dictionary endpoint returns the same translation data without
      // that failure mode and supports all locales exposed by our selector.
      const encodedLanguage = encodeURIComponent(tl);
      const encodedText = encodeURIComponent(protectedText);
      const urls = [
        `https://clients5.google.com/translate_a/t?client=dict-chrome-ex&sl=auto&tl=${encodedLanguage}&q=${encodedText}`,
        `https://translate.google.com/translate_a/single?client=at&dt=t&sl=auto&tl=${encodedLanguage}&q=${encodedText}`,
      ];

      let rawTranslatedText = '';
      let lastError;
      for (const url of urls) {
        try {
          const response = await axios.get(url, { timeout: 15000 });
          rawTranslatedText = extractTranslatedText(response.data);
          if (rawTranslatedText) break;
        } catch (endpointError) {
          lastError = endpointError;
        }
      }

      if (!rawTranslatedText && lastError) throw lastError;
      const translatedText = restore(rawTranslatedText);

      // Some universal labels/proper nouns (OK, OTP, names) are correctly the
      // same in the target language, so only an empty payload is an error.
      if (!translatedText) {
        throw new Error('Translation endpoint returned no translated text');
      }

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
      // Retry transient network/rate-limit failures with exponential backoff.
      const status = error.response?.status;
      if ((!status || status === 429 || status >= 500) && retryCount < 3) {
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
