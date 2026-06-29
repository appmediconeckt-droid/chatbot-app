import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { translationService } from '../i18n/translationService';

// Shared across all components so a string is only fetched once per language.
const liveCache = {}; // `${lang}::${english}` -> translated
const pending = new Set(); // keys currently being fetched

const isEnglish = (lng) =>
  !lng || lng === 'en-US' || lng === 'en' || lng === 'en-GB' || lng === 'en-IN';

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
    return () => inst.off('languageChanged', rerender);
  }, [inst]);

  const t = useCallback(
    (key, opts) => {
      // Support t('key', 'Default text') as well as t('key', { ...options }).
      const options = typeof opts === 'string' ? { defaultValue: opts } : (opts || {});
      const val = rawT(key, options);
      if (typeof val !== 'string' || !val) return val;
      if (isEnglish(lang)) return val;

      // The English source for this key — used to detect "not translated yet".
      const en = rawT(key, { ...options, lng: 'en-US' });
      if (val !== en) return val; // already translated statically
      // If the value equals the key AND the key looks like an i18n id
      // (e.g. "counselor:today", no spaces) it's a genuinely missing key — don't
      // send the key id to the translator. A literal phrase like "Video Call" is
      // fine to translate.
      const looksLikeKeyId =
        typeof key === 'string' && !key.includes(' ') && /[:.]/.test(key);
      if (en === key && looksLikeKeyId) return val;

      const ck = `${lang}::${en}`;
      if (liveCache[ck]) return liveCache[ck];

      // Fire a one-time live translation; re-render when it resolves.
      if (!pending.has(ck)) {
        pending.add(ck);
        translationService
          .translate(en, lang, 'en-US')
          .then((res) => {
            pending.delete(ck);
            if (res && res !== en) {
              liveCache[ck] = res;
              force((n) => n + 1);
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
