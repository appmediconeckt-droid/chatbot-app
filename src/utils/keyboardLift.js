import { Platform } from 'react-native';

// Keyboard space on Android, for gesture and 3-button navigation alike.
//
// React Native on Android reports the keyboard height with the navigation bar
// already taken off (ReactRootView: imeInsets.bottom - systemBars.bottom). On
// gesture navigation that bar is 0 (OPPO) or a few dp, so the reported height
// is effectively the whole keyboard. With 3-button navigation the bar is
// ~42–48dp, and two kinds of screen went wrong by exactly that much:
//
//   • getKeyboardLift — an input that already sits above the navigation bar
//     (a chat composer padded by insets.bottom). Screens subtracted the bar a
//     second time, so the composer ended up behind the keyboard.
//   • getKeyboardCover — a panel that runs to the very bottom of the screen
//     (a sheet in a translucent Modal). The keyboard covers its height plus
//     the bar, but only the height was reserved.
//
// Gesture navigation keeps the exact old numbers in both; only 3-button
// navigation (an inset of at least BUTTON_NAV_MIN_INSET) is corrected.
export const BUTTON_NAV_MIN_INSET = 32;

export const isButtonNavigation = (insetsBottom) =>
  Platform.OS === 'android' && (insetsBottom || 0) >= BUTTON_NAV_MIN_INSET;

// Lift for an input already padded above the navigation bar.
export const getKeyboardLift = (keyboardHeight, insetsBottom) => {
  const height = Math.max(0, keyboardHeight || 0);
  if (isButtonNavigation(insetsBottom)) return height;
  return Math.max(0, height - (insetsBottom || 0));
};

// Space to reserve under a panel that reaches the bottom edge of the screen.
export const getKeyboardCover = (keyboardHeight, insetsBottom) => {
  const height = Math.max(0, keyboardHeight || 0);
  if (!height) return 0;
  return isButtonNavigation(insetsBottom) ? height + insetsBottom : height;
};
