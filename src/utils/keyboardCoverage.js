// How much of the screen (dp, measured up from the bottom edge) the Android
// keyboard covers, robust to React Native's first-open bug.
//
// RN (ReactRootView.checkForKeyboardEvents) emits keyboardDidShow only when
// the IME *becomes visible*, with the height at that instant. The first time
// the keyboard opens after app start the IME window is still sliding in, so
// the one event says height ≈ 2 / screenY ≈ bottom of the screen, and no
// second event follows when it reaches full height. Screens that trust that
// event leave their input under the keyboard — only on the first open.
//
// Every plausible keyboardDidShow anywhere in the app is remembered (and
// persisted), and an implausible one falls back to that remembered value —
// or, before the keyboard has ever been seen, a typical phone keyboard size.
import { Dimensions, Keyboard, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'keyboardCoverageDp';
// Any real soft keyboard is taller than this; smaller reports are mid-slide.
export const MIN_REAL_KEYBOARD_DP = 120;
// Typical keyboard + nav bar share of the screen (measured 328 / 780 dp on a
// 3-button-nav phone), used only until a real keyboard has been seen.
const DEFAULT_COVERAGE_SHARE = 0.42;

let remembered = null;

const coverageFromEvent = (event) => {
  const height = event?.endCoordinates?.height || 0;
  const screenY = event?.endCoordinates?.screenY;
  if (height < MIN_REAL_KEYBOARD_DP || !Number.isFinite(screenY) || screenY <= 0) return null;
  return Math.max(0, Dimensions.get('screen').height - screenY);
};

if (Platform.OS === 'android') {
  AsyncStorage.getItem(STORAGE_KEY)
    .then((value) => {
      const stored = Number(value);
      if (remembered == null && stored > 0) remembered = stored;
    })
    .catch(() => {});
  Keyboard.addListener('keyboardDidShow', (event) => {
    const coverage = coverageFromEvent(event);
    if (coverage == null || coverage === remembered) return;
    remembered = coverage;
    AsyncStorage.setItem(STORAGE_KEY, String(Math.round(coverage))).catch(() => {});
  });
}

/** Keyboard coverage (dp from the screen's bottom edge) for a keyboardDidShow event. */
export const getKeyboardCoverage = (event) =>
  coverageFromEvent(event)
  ?? remembered
  ?? Math.round(Dimensions.get('screen').height * DEFAULT_COVERAGE_SHARE);
