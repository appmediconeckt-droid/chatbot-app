import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { translationService } from './translationService';
import { useSmartT } from '../hooks/useSmartT';

const LANG_CODE_MAP = {
  'en': 'en-US',
  'en-GB': 'en-GB',
  'en-IN': 'en-IN',
  'hi': 'hi-IN',
  'ar': 'ar-SA',
  'zh': 'zh-CN',
  'es': 'es-ES',
  'fr': 'fr-FR',
  'pt': 'pt-PT',
  'pt-BR': 'pt-BR',
  'ru': 'ru-RU',
  'ja': 'ja-JP',
  'de': 'de-DE',
  'ko': 'ko-KR',
  'th': 'th-TH',
  'ta': 'ta-IN',
  'mr': 'mr-IN',
  'te': 'te-IN',
  'kn': 'kn-IN',
  'ml': 'ml-IN',
  'bn': 'bn-IN',
  'gu': 'gu-IN',
  'pa': 'pa-IN',
  'ur': 'ur-IN',
  'ne': 'ne-NP',
};

export const useUserTranslation = () => {
  const { i18n } = useTranslation();
  const { t } = useSmartT(); // static + live-fallback translation
  const [translatedText, setTranslatedText] = useState({});
  const [isTranslating, setIsTranslating] = useState(false);

  const translateText = useCallback(
    async (text, targetLang = null) => {
      if (!text) return text;

      const lang = targetLang || i18n.language || 'en-US';

      // If English, no need to translate
      if (lang === 'en-US' || lang === 'en') {
        return text;
      }

      try {
        setIsTranslating(true);
        const normalized = LANG_CODE_MAP[lang] || lang;
        const translated = await translationService.translate(
          text,
          normalized,
          'en-US'
        );
        setTranslatedText(prev => ({ ...prev, [text]: translated }));
        return translated;
      } catch (error) {
        console.error('Translation error:', error);
        return text;
      } finally {
        setIsTranslating(false);
      }
    },
    [i18n.language]
  );

  return {
    t,
    translateText,
    isTranslating,
    currentLanguage: i18n.language,
    translatedText,
  };
};

export const useCounselorTranslation = () => {
  const { i18n } = useTranslation();
  const { t } = useSmartT(); // static + live-fallback translation
  const [translatedText, setTranslatedText] = useState({});
  const [isTranslating, setIsTranslating] = useState(false);

  const translateText = useCallback(
    async (text, targetLang = null) => {
      if (!text) return text;

      const lang = targetLang || i18n.language || 'en-US';

      // If English, no need to translate
      if (lang === 'en-US' || lang === 'en') {
        return text;
      }

      try {
        setIsTranslating(true);
        const normalized = LANG_CODE_MAP[lang] || lang;
        const translated = await translationService.translate(
          text,
          normalized,
          'en-US'
        );
        setTranslatedText(prev => ({ ...prev, [text]: translated }));
        return translated;
      } catch (error) {
        console.error('Translation error:', error);
        return text;
      } finally {
        setIsTranslating(false);
      }
    },
    [i18n.language]
  );

  return {
    t,
    translateText,
    isTranslating,
    currentLanguage: i18n.language,
    translatedText,
  };
};
