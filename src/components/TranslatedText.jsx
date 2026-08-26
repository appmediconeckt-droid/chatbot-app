import React, { useMemo } from 'react';
import { Text as RNText } from 'react-native';
import { useSmartT } from '../hooks/useSmartT';

/**
 * App text primitive.
 *
 * It behaves like React Native's Text, but literal string children are translated
 * through the shared smart translator. This lets legacy screens keep their
 * existing JSX while still reacting to the app language selected by either the
 * user or counselor.
 *
 * Usage: <TranslatedText>Chat message or dynamic text</TranslatedText>
 * For static i18n keys: <TranslatedText i18nKey="auth:login" />
 */
export const TranslatedText = ({
  children,
  i18nKey,
  style,
  numberOfLines,
  onLayout,
  maxFontSizeMultiplier = 1.2,
  translate = true,
  ...props
}) => {
  const { t, language } = useSmartT();

  const translatedChildren = useMemo(() => {
    if (i18nKey) {
      return t(i18nKey);
    }

    if (!translate) {
      return children;
    }

    const renderNode = (node) => {
      if (typeof node === 'string') {
        const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(node);
        const leading = match?.[1] || '';
        const body = match?.[2] || node;
        const trailing = match?.[3] || '';
        if (!body || !/[A-Za-z]/.test(body)) {
          return node;
        }
        return `${leading}${t(body, body)}${trailing}`;
      }

      if (Array.isArray(node)) {
        return node.map(renderNode);
      }

      return node;
    };

    return renderNode(children);
  }, [children, i18nKey, language, t, translate]);

  return (
    <RNText
      style={style}
      numberOfLines={numberOfLines}
      onLayout={onLayout}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      {...props}
    >
      {translatedChildren}
    </RNText>
  );
};

export default TranslatedText;
