import React, { useMemo } from 'react';
import { Text as RNText } from 'react-native';
import { useSmartT } from '../hooks/useSmartT';

// "12 min" / "3 ahead" / "1 hr 5 min" are looked up as one template
// ("{{n0}} min") so a single dictionary entry covers every number, instead of
// a live lookup per value that stays English whenever the network call fails.
const NUMBER_PATTERN = /\d+(?:[.,:]\d+)*/g;
const toTemplate = (body) => {
  const values = {};
  let count = 0;
  const template = body.replace(NUMBER_PATTERN, (value) => {
    values[`n${count}`] = value;
    count += 1;
    return `{{n${count - 1}}}`;
  });
  return { template, values, count };
};
const translateBody = (t, body, live) => {
  if (!/\d/.test(body)) return t(body, { defaultValue: body, live });
  const { template, values } = toTemplate(body);
  if (!/[A-Za-z]{2,}/.test(template.replace(/\{\{n\d+\}\}/g, ''))) return body;
  return t(template, { defaultValue: template, live, ...values });
};
// translate={false}: the built-in dictionary only (names and user data are
// never in it, so they stay as typed); null when it has no entry.
const dictionaryBody = (dictT, body) => {
  const direct = dictT(body);
  if (direct || !/\d/.test(body)) return direct;
  const { template, values } = toTemplate(body);
  return dictT(template, values);
};

// {count} appointments / Token {n} arrive as separate children ([3, " appointments"]).
// Joined, they are looked up as one template ("{{n0}} appointments"); null when
// the children aren't plain numbers and text.
const joinedChildren = (children) => {
  if (!Array.isArray(children) || children.length < 2) return null;
  if (!children.every((child) => typeof child === 'string' || typeof child === 'number')) return null;
  if (!children.some((child) => typeof child === 'number')) return null;
  return children.join('');
};

/**
 * App text primitive.
 *
 * It behaves like React Native's Text, but literal string children are translated
 * through the shared smart translator. This lets legacy screens keep their
 * existing JSX while still reacting to the app language selected by either the
 * user or counselor.
 *
 * Text is translated from the app's built-in dictionary only, so data from the
 * API (names, addresses, server text) is shown exactly as it arrives:
 *   default / translate={false}  dictionary (UI labels translate, data doesn't)
 *   translate="live"             dictionary, then the live translator — only
 *                                for free text meant to be read in the
 *                                user's language (a doctor's bio)
 *   translate="never"            shown exactly as given
 *
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
  const { t, dictT, language, liveVersion } = useSmartT();

  const translatedChildren = useMemo(() => {
    if (i18nKey) {
      return t(i18nKey);
    }
    // translate="never": shown exactly as given, not even from the dictionary
    // (the language picker shows every language in its own name).
    if (translate === 'never') return children;

    const translateString = (node) => {
      const match = /^(\s*)([\s\S]*?)(\s*)$/.exec(node);
      const leading = match?.[1] || '';
      const body = match?.[2] || node;
      const trailing = match?.[3] || '';
      if (!body || !/[A-Za-z]/.test(body)) return node;
      if (!translate) {
        const value = dictionaryBody(dictT, body);
        return value ? `${leading}${value}${trailing}` : node;
      }
      return `${leading}${translateBody(t, body, translate === 'live')}${trailing}`;
    };

    const joined = joinedChildren(children);
    if (joined != null && /[A-Za-z]{2,}/.test(joined)) {
      const { template, values } = toTemplate(joined.trim());
      const value = dictT(template, values);
      if (value) return value;
    }

    const renderNode = (node) => {
      if (typeof node === 'string') return translateString(node);
      if (Array.isArray(node)) return node.map(renderNode);
      return node;
    };

    return renderNode(children);
  }, [children, i18nKey, language, liveVersion, t, dictT, translate]);

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
