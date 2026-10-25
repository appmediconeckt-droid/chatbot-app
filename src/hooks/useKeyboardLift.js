import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, LayoutAnimation, Platform } from 'react-native';

const ease = () => LayoutAnimation.configureNext({ duration: 180, update: { type: LayoutAnimation.Types.easeInEaseOut } });

// Full-screen forms in edge-to-edge Modals: the window does not resize for the
// keyboard, so the screen is shortened by the part the keyboard covers and its
// footer stays visible above it. Returns [ref for the screen view, lift px].
// `keyboardOpen` / `keyboardTop` come from useKeyboardAwareScroll.
export default function useKeyboardLift(keyboardOpen, keyboardTop) {
  const screenRef = useRef(null);
  const [lift, setLift] = useState(0);
  const liftRef = useRef(0);

  const apply = useCallback((next) => {
    if (next === liftRef.current) return;
    liftRef.current = next;
    ease();
    setLift(next);
  }, []);

  // Drop the space in the hide event itself (one render, no effect hop), and
  // animate it, so the layout follows the keyboard down instead of lagging.
  useEffect(() => {
    const sub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => apply(0));
    return () => sub.remove();
  }, [apply]);

  useEffect(() => {
    if (!keyboardOpen || !keyboardTop) return;
    // Screen coordinates on both sides (keyboardTop is the keyboard's screenY);
    // 0 when the window already resized and the screen ends above it. The lift
    // is padding, so it never changes the measured height.
    screenRef.current?.measure((_x, _y, _w, height, _pageX, pageY) => {
      apply(Math.max(0, Math.round(pageY + height - keyboardTop)));
    });
  }, [apply, keyboardOpen, keyboardTop]);

  return [screenRef, lift];
}
