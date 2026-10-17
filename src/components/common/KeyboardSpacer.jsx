import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Keyboard, Platform, View } from 'react-native';
import { getKeyboardCoverage, MIN_REAL_KEYBOARD_DP } from '../../utils/keyboardCoverage';
import { getKeyboardEventHeight, getKeyboardLift } from '../../utils/keyboardLift';

// Space under a chat composer for the Android keyboard. The app runs
// edge-to-edge, so Android does not shrink the window and the keyboard would
// cover the composer. Rendered as the last child of the column that ends in
// the composer, it pushes the composer up by exactly the keyboard.
//
// The size is measured, not derived from the navigation mode: while the
// keyboard is closed the spacer records where it sits on screen (the bottom
// of the composer), and when the keyboard opens it grows by however far that
// point is below the keyboard's top edge. That is right on any phone — 3-button
// or gesture navigation, any bar height, any Android version — without
// guessing which insets the keyboard height already includes.
//
// It keeps its height in its own state on purpose: when the height lived in
// the chat screen, every keyboard open/close re-rendered the whole chat, which
// on slow phones kept the composer under the keyboard (or left a blank strip
// after it closed) for a noticeable moment. Only this View re-renders now.

// Top of the keyboard in screen coordinates (dp) for a keyboardDidShow event.
// React Native reports it once, as the keyboard becomes visible; a report taken
// while it is still sliding in is a few dp tall and is replaced by the last
// real keyboard seen (see keyboardCoverage).
const keyboardTopOnScreen = (event) => {
  const height = event?.endCoordinates?.height || 0;
  const screenY = event?.endCoordinates?.screenY;
  if (height >= MIN_REAL_KEYBOARD_DP && Number.isFinite(screenY) && screenY > 0) return screenY;
  return Dimensions.get('screen').height - getKeyboardCoverage(event);
};

export default function KeyboardSpacer({ insetsBottom = 0 }) {
  const [height, setHeight] = useState(0);
  const viewRef = useRef(null);
  const heightRef = useRef(0);
  // Screen y of this spacer while the keyboard is closed (= composer bottom).
  const restTopRef = useRef(null);

  const measureRest = useCallback(() => {
    if (heightRef.current > 0) return;
    viewRef.current?.measure?.((x, y, w, h, pageX, pageY) => {
      if (heightRef.current === 0 && Number.isFinite(pageY) && pageY > 0) restTopRef.current = pageY;
    });
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const apply = (next) => {
      heightRef.current = next;
      setHeight(next);
    };
    const show = Keyboard.addListener('keyboardDidShow', (event) => {
      const restTop = restTopRef.current;
      if (restTop != null) {
        apply(Math.max(0, Math.round(restTop - keyboardTopOnScreen(event))));
      } else {
        // Not measured yet (keyboard opened during the very first layout).
        apply(getKeyboardLift(getKeyboardEventHeight(event, insetsBottom), insetsBottom));
      }
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => apply(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [insetsBottom]);

  return (
    <View
      ref={viewRef}
      collapsable={false}
      pointerEvents="none"
      onLayout={measureRest}
      style={{ height }}
    />
  );
}
