import React, { forwardRef, useMemo } from 'react';
import { TextInput as RNTextInput } from 'react-native';
import { useSmartT } from '../hooks/useSmartT';

const TranslatedTextInput = forwardRef(({
  placeholder,
  translatePlaceholder = true,
  maxFontSizeMultiplier = 1.2,
  ...props
}, ref) => {
  const { t, language } = useSmartT();

  const translatedPlaceholder = useMemo(() => {
    if (!translatePlaceholder || typeof placeholder !== 'string' || !/[A-Za-z]/.test(placeholder)) {
      return placeholder;
    }

    return t(placeholder, placeholder);
  }, [language, placeholder, t, translatePlaceholder]);

  return (
    <RNTextInput
      ref={ref}
      placeholder={translatedPlaceholder}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      {...props}
    />
  );
});

TranslatedTextInput.displayName = 'TranslatedTextInput';

export default TranslatedTextInput;
