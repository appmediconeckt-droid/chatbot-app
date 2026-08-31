import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { translationService } from '../i18n/translationService';

// Shared across all components so a string is only fetched once per language.
const liveCache = {}; // `${lang}::${english}` -> translated
const pending = new Set(); // keys currently being fetched
const translationListeners = new Set();

const notifyTranslationListeners = () => {
  translationListeners.forEach((listener) => listener());
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

const applyConsultantLabel = (text) => {
  if (typeof text !== 'string' || !text) return text;

  return text
    .replace(/\b(Counselors|Counsellors|Counsolers)\b/g, 'Consultants')
    .replace(/\b(counselors|counsellors|counsolers)\b/g, 'consultants')
    .replace(/\b(COUNSELORS|COUNSELLORS|COUNSOLERS)\b/g, 'CONSULTANTS')
    .replace(/\b(Counselor|Counsellor|Counsoler)\b/g, 'Consultant')
    .replace(/\b(counselor|counsellor|counsoler)\b/g, 'consultant')
    .replace(/\b(COUNSELOR|COUNSELLOR|COUNSOLER)\b/g, 'CONSULTANT');
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
  const [, force] = useState(0);

  useEffect(() => {
    const rerender = () => force((n) => n + 1);
    inst.on('languageChanged', rerender);
    translationListeners.add(rerender);

    return () => {
      inst.off('languageChanged', rerender);
      translationListeners.delete(rerender);
    };
  }, [inst]);

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
      }
      // If the value equals the key AND the key looks like an i18n id
      // (e.g. "counselor:today", no spaces) it's a genuinely missing key — don't
      // send the key id to the translator. A literal phrase like "Video Call" is
      // fine to translate.

      const ck = `${lang}::${en}`;
      if (liveCache[ck]) return applyConsultantLabel(liveCache[ck]);

      // Fire a one-time live translation; re-render when it resolves.
      if (!pending.has(ck)) {
        pending.add(ck);
        translationService
          .translate(en, lang, 'en-US')
          .then((res) => {
            pending.delete(ck);
            if (res && res !== en) {
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

  return { t, language: lang };
}

export default useSmartT;
