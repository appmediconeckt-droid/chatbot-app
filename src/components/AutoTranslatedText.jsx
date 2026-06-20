import React, { useState, useEffect } from 'react';
import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { translationService } from '../i18n/translationService';

/**
 * Text component that auto-translates to current language via API
 * Usage: <AutoTranslatedText>{t('common:loading')}</AutoTranslatedText>
 * OR: <AutoTranslatedText>Any English text</AutoTranslatedText>
 */
export const AutoTranslatedText = ({
  children,
  style,
  numberOfLines,
  ...props
}) => {
  const { i18n } = useTranslation();
  const [translated, setTranslated] = useState(children);

  useEffect(() => {
    const doTranslate = async () => {
      if (!children || typeof children !== 'string') {
        setTranslated(children);
        return;
      }

      // If English, no need to translate
      if (i18n.language === 'en-US' || i18n.language === 'en') {
        setTranslated(children);
        return;
      }

      try {
        const result = await translationService.translate(
          children,
          i18n.language || 'en-US',
          'en-US'
        );
        setTranslated(result || children);
      } catch (error) {
        console.warn('[AutoTranslatedText] Error:', error);
        setTranslated(children);
      }
    };

    doTranslate();
  }, [children, i18n.language]);

  return (
    <Text style={style} numberOfLines={numberOfLines} {...props}>
      {translated}
    </Text>
  );
};

export default AutoTranslatedText;
