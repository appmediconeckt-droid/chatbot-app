import { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, Keyboard, Platform } from 'react-native';

// Handles both Android keyboard modes: older devices usually resize the window,
// while edge-to-edge Android versions may overlay it. Only reserve the portion
// that the window did not already lose, so keyboard space is never counted twice.
const useKeyboardAwareScroll = () => {
  const scrollRef = useRef(null);
  const baseHeightRef = useRef(Dimensions.get('window').height);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, event => {
      const keyboardHeight = event?.endCoordinates?.height || 0;
      const currentHeight = Dimensions.get('window').height;
      const alreadyResizedBy = Math.max(0, baseHeightRef.current - currentHeight);

      setKeyboardInset(Math.max(0, keyboardHeight - alreadyResizedBy));
      setKeyboardOpen(true);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      baseHeightRef.current = Dimensions.get('window').height;
      setKeyboardInset(0);
      setKeyboardOpen(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const scrollFocusedInputIntoView = useCallback(event => {
    const nativeHandle = event?.target;
    if (!nativeHandle) return;

    // Wait for the keyboard/inset relayout before calculating the destination.
    setTimeout(() => {
      scrollRef.current
        ?.getScrollResponder?.()
        ?.scrollResponderScrollNativeHandleToKeyboard(nativeHandle, 28, true);
    }, Platform.OS === 'ios' ? 80 : 140);
  }, []);

  return { scrollRef, keyboardOpen, keyboardInset, scrollFocusedInputIntoView };
};

export default useKeyboardAwareScroll;
