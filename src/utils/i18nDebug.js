import i18n from '../i18n';
import { LANGUAGES } from '../i18n';

export const debugI18n = () => {
  console.log('=== i18n Debug Info ===');
  console.log('Current language:', i18n.language);
  console.log('Available languages:', LANGUAGES.length);
  console.log('Ready:', i18n.isInitialized);
  console.log('Has resources:', !!i18n.hasResourceBundle(i18n.language, 'common'));

  // Test translation
  try {
    const testKey = i18n.t('common:loading');
    console.log('Test translation (common:loading):', testKey);
  } catch (error) {
    console.error('Translation error:', error.message);
  }
};

export const logAllLanguages = () => {
  console.log('=== Available Languages ===');
  LANGUAGES.forEach((lang, idx) => {
    const hasBundle = i18n.hasResourceBundle(lang.code, 'common');
    console.log(`${idx + 1}. ${lang.code} - ${lang.name} - ${hasBundle ? '✅' : '❌'}`);
  });
};

export const testLanguageSwitch = async (langCode) => {
  console.log(`🔄 Testing language switch to: ${langCode}`);
  try {
    const result = await i18n.changeLanguage(langCode);
    console.log(`✅ Switched to ${langCode}:`, result);
    console.log(`Current i18n.language: ${i18n.language}`);
    console.log(`Test translation: ${i18n.t('common:loading')}`);
  } catch (error) {
    console.error(`❌ Failed to switch to ${langCode}:`, error.message);
  }
};
