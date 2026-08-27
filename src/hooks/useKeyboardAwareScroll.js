import { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, findNodeHandle, Keyboard, Platform, UIManager } from 'react-native';

// Handles both Android keyboard modes: older devices usually resize the window,
// while edge-to-edge Android versions may overlay it. Only reserve the portion
// that the window did not already lose, so keyboard space is never counted twice.
const FOCUSED_INPUT_GAP = 28;

const useKeyboardAwareScroll = () => {
  const scrollRef = useRef(null);
  const baseHeightRef = useRef(Dimensions.get('window').height);
  const focusedInputHandleRef = useRef(null);
  const keyboardInsetRef = useRef(0);
  const keyboardOpenRef = useRef(false);
  const scrollOffsetYRef = useRef(0);
  const scrollViewHeightRef = useRef(0);
  const scrollTimerRef = useRef(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);

  const clearScrollTimer = useCallback(() => {
    if (scrollTimerRef.current) {
      clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = null;
    }
  }, []);

  const fallbackScrollToKeyboard = useCallback((nativeHandle, animated) => {
    if (!nativeHandle) return;
    scrollRef.current
      ?.getScrollResponder?.()
      ?.scrollResponderScrollNativeHandleToKeyboard(nativeHandle, FOCUSED_INPUT_GAP, true);
  }, []);

  const scrollFocusedInputIntoViewNow = useCallback((animated = true) => {
    const focusedInputHandle = focusedInputHandleRef.current;
    const scrollView = scrollRef.current;
    if (!focusedInputHandle || !scrollView) return;

    const inputNode = findNodeHandle(focusedInputHandle) || focusedInputHandle;
    const innerViewNode = scrollView?.getInnerViewNode?.();
    const scrollContentNode = findNodeHandle(innerViewNode || scrollView);

    if (!inputNode || !scrollContentNode || !UIManager.measureLayout) {
      fallbackScrollToKeyboard(inputNode, animated);
      return;
    }

    try {
      UIManager.measureLayout(
        inputNode,
        scrollContentNode,
        () => fallbackScrollToKeyboard(inputNode, animated),
        (_x, y, _width, inputHeight) => {
          const viewportHeight = scrollViewHeightRef.current || Dimensions.get('window').height;
          const visibleHeight = Math.max(
            80,
            viewportHeight - (Platform.OS === 'android' ? keyboardInsetRef.current : 0)
          );
          const currentY = scrollOffsetYRef.current;
          const inputTop = y;
          const inputBottom = y + inputHeight;
          const visibleTop = currentY + 16;
          const visibleBottom = currentY + visibleHeight - FOCUSED_INPUT_GAP;
          let nextY = currentY;

          if (inputTop < visibleTop) {
            nextY = Math.max(0, inputTop - 16);
          } else if (inputBottom > visibleBottom) {
            nextY = Math.max(0, inputBottom - visibleHeight + FOCUSED_INPUT_GAP);
          }

          if (Math.abs(nextY - currentY) > 2) {
            scrollView.scrollTo?.({ y: nextY, animated });
          }
        }
      );
    } catch (_error) {
      fallbackScrollToKeyboard(inputNode, animated);
    }
  }, [fallbackScrollToKeyboard]);

  const scheduleScrollFocusedInputIntoView = useCallback((animated = true, delay) => {
    clearScrollTimer();
    scrollTimerRef.current = setTimeout(() => {
      scrollTimerRef.current = null;
      scrollFocusedInputIntoViewNow(animated);
    }, delay ?? (Platform.OS === 'ios' ? 80 : 140));
  }, [clearScrollTimer, scrollFocusedInputIntoViewNow]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, event => {
      const keyboardHeight = event?.endCoordinates?.height || 0;
      const currentHeight = Dimensions.get('window').height;
      const alreadyResizedBy = Math.max(0, baseHeightRef.current - currentHeight);
      const nextInset = Math.max(0, keyboardHeight - alreadyResizedBy);

      keyboardInsetRef.current = nextInset;
      keyboardOpenRef.current = true;
      setKeyboardInset(nextInset);
      setKeyboardOpen(true);
      scheduleScrollFocusedInputIntoView(false, Platform.OS === 'ios' ? 60 : 80);
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      baseHeightRef.current = Dimensions.get('window').height;
      keyboardInsetRef.current = 0;
      keyboardOpenRef.current = false;
      setKeyboardInset(0);
      setKeyboardOpen(false);
    });

    return () => {
      clearScrollTimer();
      showSub.remove();
      hideSub.remove();
    };
  }, [clearScrollTimer, scheduleScrollFocusedInputIntoView]);

  const scrollFocusedInputIntoView = useCallback(event => {
    const nativeHandle = event?.target;
    if (!nativeHandle) return;
    focusedInputHandleRef.current = nativeHandle;

    // Wait for the keyboard/inset relayout before calculating the destination.
    scheduleScrollFocusedInputIntoView(true);
  }, [scheduleScrollFocusedInputIntoView]);

  const handleKeyboardAwareScroll = useCallback(event => {
    scrollOffsetYRef.current = event?.nativeEvent?.contentOffset?.y || 0;
  }, []);

  const handleKeyboardAwareScrollLayout = useCallback(event => {
    scrollViewHeightRef.current = event?.nativeEvent?.layout?.height || 0;
    if (keyboardOpenRef.current) {
      scheduleScrollFocusedInputIntoView(false, 40);
    }
  }, [scheduleScrollFocusedInputIntoView]);

  return {
    scrollRef,
    keyboardOpen,
    keyboardInset,
    scrollFocusedInputIntoView,
    handleKeyboardAwareScroll,
    handleKeyboardAwareScrollLayout,
  };
};

export default useKeyboardAwareScroll;
