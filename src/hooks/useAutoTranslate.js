import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { translationService } from '../i18n/translationService';

/**
 * Auto-translate any text based on current language
 * Usage: const translated = useAutoTranslate("Hello World");
 */
export const useAutoTranslate = (text) => {
  const { i18n } = useTranslation();
  const [translated, setTranslated] = useState(text);

  useEffect(() => {
    const doTranslate = async () => {
      if (!text || i18n.language === 'en-US' || i18n.language === 'en') {
        setTranslated(text);
        return;
      }

      try {
        const result = await translationService.translate(
          text,
          i18n.language || 'en-US',
          'en-US'
        );
        setTranslated(result);
      } catch (error) {
        setTranslated(text);
      }
    };

    doTranslate();
  }, [text, i18n.language]);

  return translated;
};
