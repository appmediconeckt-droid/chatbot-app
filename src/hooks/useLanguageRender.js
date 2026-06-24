import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n/index';

/**
 * Hook that forces re-render when language changes
 * Use this in any screen that has t() and isn't re-rendering on language change
 */
export const useLanguageRender = () => {
  const { t, i18n: i18nInstance } = useTranslation();
  const [, setLanguage] = useState(i18nInstance.language);

  useEffect(() => {
    const handleLanguageChange = (lng) => {
      console.log('[useLanguageRender] Language changed to:', lng);
      setLanguage(lng);
    };

    i18n.on('languageChanged', handleLanguageChange);

    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, []);

  return { t, language: i18nInstance.language };
};

export default useLanguageRender;
