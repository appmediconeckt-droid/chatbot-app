<<<<<<< HEAD
import useSmartT from './useSmartT';
=======
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../i18n/index';
>>>>>>> a2b2b39c3c781d6b6126b6afbb6fd38b08c91196

/**
 * Hook that re-renders a screen on language change AND provides a translation
 * function with a live API fallback (see useSmartT). Use this in any screen
 * that has t() so every string switches language — keyed strings come from the
 * static locale JSON, anything not yet translated is translated live.
 */
export const useLanguageRender = () => useSmartT();

export default useLanguageRender;
