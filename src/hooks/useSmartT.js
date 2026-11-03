import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import i18next from 'i18next';
import { translationService } from '../i18n/translationService';

// Shared across all components so a string is only fetched once per language.
const liveCache = {}; // `${lang}::${english}` -> translated
const pending = new Set(); // keys currently being fetched
const translationListeners = new Set();

// Every mounted text listens here, so re-render them once per burst of
// arriving live translations instead of once per phrase (a screen in Hindi
// can receive dozens at a time — each used to re-render every text).
let notifyTimer = null;
const notifyTranslationListeners = () => {
  if (notifyTimer) return;
  notifyTimer = setTimeout(() => {
    notifyTimer = null;
    translationListeners.forEach((listener) => listener());
  }, 60);
};

const isEnglish = (lng) =>
  !lng || lng === 'en-US' || lng === 'en' || lng === 'en-GB' || lng === 'en-IN';

// Literal UI copy is used by a number of older screens (for example
// t('Help and Support')) instead of a namespaced key. Give those phrases a
// stable local-dictionary id so they do not depend on a network translation.
const phraseKey = (value) => {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash * 33) ^ value.charCodeAt(index)) >>> 0;
  }
  return `p${hash.toString(36)}`;
};

// "waiting" / "IN_CONSULTATION" / "no-show" -> "Waiting" / "In consultation" /
// "No show"; null when the text is already in that form.
const caseVariant = (text) => {
  if (typeof text !== 'string' || text.length > 40) return null;
  const spaced = text.replace(/[_-]+/g, ' ').trim();
  if (!spaced || !/^[A-Za-z ]+$/.test(spaced)) return null;
  const lower = spaced.toLowerCase();
  const variant = lower.charAt(0).toUpperCase() + lower.slice(1);
  return variant === text ? null : variant;
};

// Runs for every text on every render: skip the six regexes when the text
// cannot contain the word, and remember results for the rest.
const consultantCache = new Map();
const applyConsultantLabel = (text) => {
  if (typeof text !== 'string' || !text || !/couns/i.test(text)) return text;
  const cached = consultantCache.get(text);
  if (cached !== undefined) return cached;

  const result = text
    .replace(/\b(Counselors|Counsellors|Counsolers)\b/g, 'Consultants')
    .replace(/\b(counselors|counsellors|counsolers)\b/g, 'consultants')
    .replace(/\b(COUNSELORS|COUNSELLORS|COUNSOLERS)\b/g, 'CONSULTANTS')
    .replace(/\b(Counselor|Counsellor|Counsoler)\b/g, 'Consultant')
    .replace(/\b(counselor|counsellor|counsoler)\b/g, 'consultant')
    .replace(/\b(COUNSELOR|COUNSELLOR|COUNSOLER)\b/g, 'CONSULTANT');
  if (consultantCache.size > 2000) consultantCache.clear();
  consultantCache.set(text, result);
  return result;
};

// The built-in dictionary's translation of a UI phrase in the current language,
// or the text unchanged. For text outside React components (native Alert
// dialogs); numbers are looked up as a template ("{{n0}} min").
export const translatePhrase = (text) => {
  const lang = i18next.language;
  if (isEnglish(lang) || typeof text !== 'string' || !/[A-Za-z]/.test(text)) return text;
  const lookup = (phrase, values) => {
    const options = { ...(values || {}), defaultValue: '', keySeparator: false };
    const value = i18next.t(`phrases:${phraseKey(phrase)}`, { ...options, lng: lang });
    const english = i18next.t(`phrases:${phraseKey(phrase)}`, { ...options, lng: 'en-US' });
    return value && english && value !== english ? value : null;
  };
  const body = text.trim();
  let count = 0;
  const values = {};
  const template = body.replace(/\d+(?:[.,:]\d+)*/g, (value) => {
    values[`n${count}`] = value;
    count += 1;
    return `{{n${count - 1}}}`;
  });
  return lookup(body) || (count ? lookup(template, values) : null) || text;
};

/**
 * Smart translation: use the static i18next value first, and fall back to the
 * live translation API for any key that isn't translated in the locale JSON yet
 * (i.e. its value still equals the English source). The component re-renders
 * when a live translation arrives and whenever the language changes.
 *
 * This makes language switching work for EVERY string immediately, even before
 * the generated static locale files are complete.
 */
export function useSmartT() {
  const { t: rawT, i18n: inst } = useTranslation();
  const lang = inst.language;
  // Bumped when live translations arrive; callers that memoize their text
  // depend on it, or they would keep showing the English copy.
  const [liveVersion, force] = useState(0);

  // Language changes already re-render through useTranslation (bindI18n
  // 'languageChanged'); this only adds re-renders for arriving live translations.
  useEffect(() => {
    const rerender = () => force((n) => n + 1);
    translationListeners.add(rerender);
    return () => {
      translationListeners.delete(rerender);
    };
  }, []);

  const t = useCallback(
    (key, opts) => {
      // Support t('key', 'Default text') as well as t('key', { ...options }).
      const options = typeof opts === 'string' ? { defaultValue: opts } : (opts || {});
      const isLiteralPhrase =
        typeof key === 'string' && !key.includes(':') && /[A-Za-z]/.test(key);
      const localPhraseKey = isLiteralPhrase ? `phrases:${phraseKey(key)}` : null;
      const val = localPhraseKey
        ? rawT(localPhraseKey, { ...options, defaultValue: key, keySeparator: false })
        : rawT(key, options);
      if (typeof val !== 'string' || !val) return val;
      const looksLikeKeyId =
        typeof key === 'string' && !key.includes(' ') && /[:.]/.test(key);
      // English: `val` already is the English text — no second lookup.
      if (isEnglish(lang)) return val === key && looksLikeKeyId ? val : applyConsultantLabel(val);
      const rawEn = localPhraseKey
        ? rawT(localPhraseKey, { ...options, lng: 'en-US', defaultValue: key, keySeparator: false })
        : rawT(key, { ...options, lng: 'en-US' });
      if (rawEn === key && looksLikeKeyId) return val;
      if (isEnglish(lang)) return applyConsultantLabel(val);

      // The English source for this key — used to detect "not translated yet".
      const en = applyConsultantLabel(rawEn);
      if (val !== rawEn && val !== en) return applyConsultantLabel(val); // already translated statically
      // A namespaced key may only provide an English defaultValue while its
      // locale entry is absent. Reuse the generated local phrase dictionary
      // before considering the Azure live fallback.
      if (typeof en === 'string' && /[A-Za-z]/.test(en)) {
        const phraseValue = rawT(`phrases:${phraseKey(en)}`, {
          lng: lang,
          defaultValue: en,
          keySeparator: false,
        });
        if (phraseValue !== en) return applyConsultantLabel(phraseValue);
        // Backend values arrive as "waiting", "IN_CONSULTATION", ... while the
        // dictionary holds "Waiting" / "In consultation".
        const variant = caseVariant(en);
        if (variant) {
          const variantValue = rawT(`phrases:${phraseKey(variant)}`, {
            lng: lang,
            defaultValue: variant,
            keySeparator: false,
          });
          if (variantValue !== variant) {
            return applyConsultantLabel(en === en.toUpperCase() ? variantValue.toLocaleUpperCase(lang) : variantValue);
          }
        }
      }
      // If the value equals the key AND the key looks like an i18n id
      // (e.g. "counselor:today", no spaces) it's a genuinely missing key — don't
      // send the key id to the translator. A literal phrase like "Video Call" is
      // fine to translate.

      // Not in the dictionary: the text may be data from the API (a name, an
      // address, a server message), which is shown exactly as it arrives.
      // Only text marked { live: true } (e.g. a doctor's bio) goes to the
      // live translator.
      if (!options.live) return en;

      // Number templates from TranslatedText ("{{n0}} min") are translated once
      // as a template and filled per value, not once per number.
      const isTemplate = isLiteralPhrase && options.n0 !== undefined;
      const liveSource = isTemplate ? applyConsultantLabel(key) : en;
      const fill = (text) => (isTemplate
        ? text.replace(/\{\{\s*(n\d+)\s*\}\}/g, (match, name) => options[name] ?? match)
        : text);
      const ck = `${lang}::${liveSource}`;
      if (liveCache[ck]) return fill(applyConsultantLabel(liveCache[ck]));

      // Fire a one-time live translation; re-render when it resolves.
      if (!pending.has(ck)) {
        pending.add(ck);
        translationService
          .translate(liveSource, lang, 'en-US')
          .then((res) => {
            pending.delete(ck);
            if (res && res !== liveSource) {
              liveCache[ck] = applyConsultantLabel(res);
              // A request is shared globally, so every mounted translated text
              // using that cached phrase must be notified—not only the hook
              // instance that happened to start the request.
              notifyTranslationListeners();
            }
          })
          .catch(() => pending.delete(ck));
      }
      return en; // show English until the live translation arrives
    },
    [rawT, lang],
  );

  // The built-in dictionary's translation of a UI phrase, or null when it has
  // none — never a live lookup. For text that may also be a name or user data
  // (TranslatedText translate={false}): "All statuses" is translated, "Vijay"
  // is left alone. `values` fills a number template ("{{n0}} completed").
  const dictT = useCallback(
    (text, values) => {
      if (isEnglish(lang) || typeof text !== 'string' || !/[A-Za-z]/.test(text)) return null;
      const lookup = (phrase) => {
        const value = rawT(`phrases:${phraseKey(phrase)}`, {
          ...(values || {}),
          lng: lang,
          defaultValue: '',
          keySeparator: false,
        });
        const english = rawT(`phrases:${phraseKey(phrase)}`, {
          ...(values || {}),
          lng: 'en-US',
          defaultValue: '',
          keySeparator: false,
        });
        // Missing for this language → i18next falls back to the English copy.
        return value && english && value !== english ? value : null;
      };
      const direct = lookup(text);
      if (direct) return direct;
      const variant = caseVariant(text);
      const variantValue = variant && lookup(variant);
      if (!variantValue) return null;
      return text === text.toUpperCase() ? variantValue.toLocaleUpperCase(lang) : variantValue;
    },
    [rawT, lang],
  );

  return { t, dictT, language: lang, liveVersion };
}

export default useSmartT;
