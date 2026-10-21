import { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, findNodeHandle, Keyboard, Platform, TextInput, UIManager } from 'react-native';

// Handles both Android keyboard modes: older devices usually resize the window,
// while edge-to-edge Android versions may overlay it. Only reserve the portion
// that the window did not already lose, so keyboard space is never counted twice.
const FOCUSED_INPUT_GAP = 28;

// Optional `frameRef`: a view wrapping a scroll view that does not reach the
// bottom of the screen (e.g. a form scrolling inside a card). `frameInset` is
// then only the part of that frame the keyboard covers, rather than the full
// keyboard height; without `frameRef` it equals `keyboardInset`.
// `frameIsScroll: true` measures the scroll view itself instead (for a
// ScrollView that ends above the screen bottom, e.g. above a tab bar).
// `layoutAvoidsKeyboard`: the caller already ends the viewport above the
// keyboard (e.g. a Modal sized to keyboardTop), so don't subtract its inset again.
const useKeyboardAwareScroll = ({ frameRef, frameIsScroll = false, layoutAvoidsKeyboard = false, focusGap = FOCUSED_INPUT_GAP } = {}) => {
  const scrollRef = useRef(null);
  const baseHeightRef = useRef(Dimensions.get('window').height);
  const focusedInputHandleRef = useRef(null);
  // The input that was focused when focusedInputHandleRef was last set.
  const requestedByInputRef = useRef(null);
  const keyboardInsetRef = useRef(0);
  const frameInsetRef = useRef(0);
  const keyboardOpenRef = useRef(false);
  const scrollOffsetYRef = useRef(0);
  const scrollViewHeightRef = useRef(0);
  const scrollTimerRef = useRef(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  // Where the keyboard's top edge actually is, in screen coordinates (0 when
  // it is hidden). The app is edge-to-edge, so window and screen coordinates
  // match — Modals included — which makes this the one measurement that is
  // correct whether Android resized the window for the keyboard or simply
  // overlaid it. Useful for a panel that must end exactly above it.
  const [keyboardTop, setKeyboardTop] = useState(0);
  const [frameInset, setFrameInset] = useState(0);

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
      ?.scrollResponderScrollNativeHandleToKeyboard(nativeHandle, focusGap, true);
  }, [focusGap]);

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
            viewportHeight - (!layoutAvoidsKeyboard && (Platform.OS === 'android' || frameRef || frameIsScroll) ? frameInsetRef.current : 0)
          );
          const currentY = scrollOffsetYRef.current;
          const inputTop = y;
          const inputBottom = y + inputHeight;
          const visibleTop = currentY + 16;
          const visibleBottom = currentY + visibleHeight - focusGap;
          let nextY = currentY;

          if (inputTop < visibleTop) {
            nextY = Math.max(0, inputTop - 16);
          } else if (inputBottom > visibleBottom) {
            nextY = Math.max(0, inputBottom - visibleHeight + focusGap);
          }

          if (Math.abs(nextY - currentY) > 2) {
            scrollView.scrollTo?.({ y: nextY, animated });
          }
        }
      );
    } catch (_error) {
      fallbackScrollToKeyboard(inputNode, animated);
    }
  }, [fallbackScrollToKeyboard, frameRef, frameIsScroll, layoutAvoidsKeyboard, focusGap]);

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

      // Inputs inside child components (e.g. a location search box) don't call
      // scrollFocusedInputIntoView themselves — pick up whichever input
      // actually opened the keyboard so it is still scrolled into view.
      // Only when focus actually moved: if the focused input already asked
      // for a different target (e.g. password -> Login button), keep it.
      const focusedInput = TextInput.State?.currentlyFocusedInput?.();
      if (focusedInput && focusedInput !== requestedByInputRef.current) {
        focusedInputHandleRef.current = focusedInput;
        requestedByInputRef.current = focusedInput;
      }

      keyboardInsetRef.current = nextInset;
      keyboardOpenRef.current = true;
      setKeyboardInset(nextInset);
      setKeyboardTop(event?.endCoordinates?.screenY
        || Math.max(0, Dimensions.get('window').height - nextInset));
      setKeyboardOpen(true);

      const applyFrameInset = inset => {
        frameInsetRef.current = inset;
        setFrameInset(inset);
        scheduleScrollFocusedInputIntoView(false, Platform.OS === 'ios' ? 60 : 80);
      };
      const frame = frameRef?.current || (frameIsScroll ? scrollRef.current : null);
      const screenY = event?.endCoordinates?.screenY;
      if (screenY && frame?.measure) {
        // The keyboard's screenY is in screen coordinates, so measure the frame
        // in screen coordinates too (pageY). measureInWindow is relative to
        // the app window, which on some phones (vivo, Android 12 — the
        // 3-button-navigation ones here) starts below the status bar: mixing
        // the two left the overlap short by the status-bar height and the
        // focused field behind the keyboard. Where the window spans the whole
        // screen (OPPO, Android 15) pageY equals the window y, so nothing
        // changes there.
        frame.measure((_x, _y, _width, height, _pageX, pageY) => {
          applyFrameInset(Math.max(0, pageY + height - screenY));
        });
      } else if (frame?.measureInWindow) {
        frame.measureInWindow((_x, y, _width, height) => {
          applyFrameInset(screenY
            ? Math.max(0, y + height - screenY)
            : Math.max(0, Math.min(nextInset, y + height - (Dimensions.get('window').height - nextInset))));
        });
      } else {
        applyFrameInset(nextInset);
      }
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      baseHeightRef.current = Dimensions.get('window').height;
      keyboardInsetRef.current = 0;
      frameInsetRef.current = 0;
      setFrameInset(0);
      keyboardOpenRef.current = false;
      setKeyboardInset(0);
      setKeyboardTop(0);
      setKeyboardOpen(false);
    });

    return () => {
      clearScrollTimer();
      showSub.remove();
      hideSub.remove();
    };
  }, [clearScrollTimer, scheduleScrollFocusedInputIntoView, frameRef, frameIsScroll]);

  const scrollFocusedInputIntoView = useCallback(event => {
    const nativeHandle = event?.target;
    if (!nativeHandle) return;
    focusedInputHandleRef.current = nativeHandle;
    requestedByInputRef.current = TextInput.State?.currentlyFocusedInput?.() || null;

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
    keyboardTop,
    frameInset,
    scrollFocusedInputIntoView,
    handleKeyboardAwareScroll,
    handleKeyboardAwareScrollLayout,
  };
};

export default useKeyboardAwareScroll;
