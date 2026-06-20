import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from '../i18n';
import { translationService } from '../i18n/translationService';

const LanguageContext = createContext();
const LANG_STORAGE_KEY = 'appLanguage';

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(i18n.language || 'en-US');
  const [isLoading, setIsLoading] = useState(true);

  // Initialize and load saved language on app startup
  useEffect(() => {
    const initLanguage = async () => {
      try {
        const savedLang = await AsyncStorage.getItem(LANG_STORAGE_KEY);
        const langToUse = savedLang || 'en-US';

        // Set i18n language
        await i18n.changeLanguage(langToUse);
        setLanguageState(langToUse);
      } catch (error) {
        console.error('[LanguageContext] Init error:', error);
        await i18n.changeLanguage('en-US');
        setLanguageState('en-US');
      } finally {
        setIsLoading(false);
      }
    };

    initLanguage();
  }, []);

  // Listen to i18n language changes
  useEffect(() => {
    const handleLanguageChange = (lng) => {
      console.log('[LanguageContext] Language changed to:', lng);
      setLanguageState(lng);
    };

    i18n.on('languageChanged', handleLanguageChange);

    return () => {
      i18n.off('languageChanged', handleLanguageChange);
    };
  }, []);

  const setLanguage = useCallback(async (code) => {
    try {
      console.log('[LanguageContext] 🌐 Changing language to:', code);

      if (!code || code.trim() === '') {
        console.warn('[LanguageContext] Empty language code provided');
        return;
      }

      // Change i18n language
      await new Promise((resolve) => {
        i18n.changeLanguage(code, () => {
          console.log('[LanguageContext] ✅ i18n changed to:', i18n.language);
          resolve();
        });
      });

      // Update state
      setLanguageState(code);

      // Save to AsyncStorage
      await AsyncStorage.setItem(LANG_STORAGE_KEY, code);

      console.log('[LanguageContext] ✅ Successfully changed language to:', code);
    } catch (error) {
      console.error('[LanguageContext] ❌ Failed to change language:', error);
    }
  }, []);

  const value = {
    language,
    setLanguage,
    isLoading,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguageContext = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguageContext must be used within LanguageProvider');
  }
  return context;
};
