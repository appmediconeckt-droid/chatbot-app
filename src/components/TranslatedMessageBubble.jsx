import React, { useState, useEffect } from 'react';
import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { translationService } from '../i18n/translationService';

const mentionRegex = /@([^.,\n]+?)(?=\s+for\b|$|[.,])/gi;
const mentionLinkStyle = { fontWeight: '900', textDecorationLine: 'underline' };

const splitMentions = (value) => {
  const source = String(value || '');
  const parts = [];
  let lastIndex = 0;
  let match;

  mentionRegex.lastIndex = 0;
  while ((match = mentionRegex.exec(source)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: source.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'mention', value: match[0], name: match[1].trim() });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < source.length) {
    parts.push({ type: 'text', value: source.slice(lastIndex) });
  }
  return parts.length ? parts : [{ type: 'text', value: source }];
};

/**
 * Auto-translating message bubble for chat
 * Usage: <TranslatedMessageBubble text={messageText} isUser={true} style={styles.messageText} />
 */
export const TranslatedMessageBubble = ({
  text,
  isUser,
  style,
  numberOfLines,
  onMentionPress,
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

  const mentionParts = onMentionPress ? splitMentions(translatedText) : null;

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {mentionParts
        ? mentionParts.map((part, index) => (
            part.type === 'mention' ? (
              <Text
                key={`${part.value}-${index}`}
                style={[style, mentionLinkStyle]}
                onPress={() => onMentionPress(part.name)}
              >
                {part.value}
              </Text>
            ) : (
              <Text key={`${part.value}-${index}`}>{part.value}</Text>
            )
          ))
        : translatedText}
    </Text>
  );
};

export default TranslatedMessageBubble;
