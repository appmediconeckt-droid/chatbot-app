import React, { useState, useEffect } from 'react';
import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { translationService } from '../i18n/translationService';

/**
 * Auto-translating Text component
 * Usage: <TranslatedText>Chat message or dynamic text</TranslatedText>
 * For static i18n keys: <TranslatedText i18nKey="auth:login" />
 */
export const TranslatedText = ({
  children,
  i18nKey,
  style,
  numberOfLines,
  onLayout,
  ...props
}) => {
  const { t, i18n } = useTranslation();
  const [translatedText, setTranslatedText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);

  // If it's an i18n key, use t() function
  if (i18nKey) {
    const displayText = t(i18nKey);
    return (
      <Text style={style} numberOfLines={numberOfLines} onLayout={onLayout} {...props}>
        {displayText}
      </Text>
    );
  }

  // For dynamic text, translate via API
  useEffect(() => {
    const translate = async () => {
      if (!children || typeof children !== 'string') {
        setTranslatedText(children);
        return;
      }

      // If English, no need to translate
      if (i18n.language === 'en-US' || i18n.language === 'en') {
        setTranslatedText(children);
        return;
      }

      try {
        setIsTranslating(true);
        const translated = await translationService.translate(
          children,
          i18n.language || 'en-US',
          'en-US'
        );
        setTranslatedText(translated);
      } catch (error) {
        console.warn('Translation error:', error);
        setTranslatedText(children);
      } finally {
        setIsTranslating(false);
      }
    };

    translate();
  }, [children, i18n.language]);

  return (
    <Text style={style} numberOfLines={numberOfLines} onLayout={onLayout} {...props}>
      {translatedText || children}
    </Text>
  );
};

export default TranslatedText;
