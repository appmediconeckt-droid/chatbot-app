import React, { useState, useEffect } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { translationService } from '../i18n/translationService';

/**
 * Auto-translating message bubble for chat
 * Usage: <TranslatedMessageBubble text={messageText} isUser={true} style={styles.messageText} />
 */
export const TranslatedMessageBubble = ({
  text,
  isUser,
  style,
  numberOfLines,
}) => {
  const { i18n } = useTranslation();
  const [translatedText, setTranslatedText] = useState(text);
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => {
    const translate = async () => {
      if (!text) {
        setTranslatedText(text);
        return;
      }

      // If English, no need to translate
      if (i18n.language === 'en-US' || i18n.language === 'en') {
        setTranslatedText(text);
        return;
      }

      try {
        setIsTranslating(true);
        console.log(`[TranslatedMessageBubble] Translating "${text}" to ${i18n.language}`);
        const translated = await translationService.translate(
          text,
          i18n.language || 'en-US',
          'en-US'
        );
        console.log(`[TranslatedMessageBubble] Result: "${translated}"`);
        setTranslatedText(translated);
      } catch (error) {
        console.error('[TranslatedMessageBubble] Translation error:', error);
        setTranslatedText(text);
      } finally {
        setIsTranslating(false);
      }
    };

    translate();
  }, [text, i18n.language]);

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {translatedText}
    </Text>
  );
};

export default TranslatedMessageBubble;
