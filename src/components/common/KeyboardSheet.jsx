// Keyboard handling for bottom sheets inside Modals.
//
// The app is edge-to-edge, so a Modal's window is never resized for the
// keyboard — the keyboard simply covers the bottom of the sheet. These pieces
// give every sheet the same behaviour as the Signup form:
//   • KeyboardSheetOverlay lifts the sheet to sit right above the keyboard and
//     keeps it below the status bar (the sheet must allow `flexShrink: 1`);
//   • the sheet's header/footer stay fixed while KeyboardSheetScroll holds the
//     fields and scrolls the focused input into view;
//   • useSheetBottomPadding(base) adds the navigation-bar inset only while the
//     keyboard is closed (when open, the sheet already sits above it).
import React, {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { Keyboard, Platform, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const FOCUSED_INPUT_GAP = 16;

const KeyboardSheetContext = createContext({ overlap: 0 });

// How much of a full-screen view the keyboard covers. Measured against the
// view's own height, so it is ~0 on devices that do resize the window.
export function useKeyboardOverlap() {
  const [overlap, setOverlap] = useState(0);
  const heightRef = useRef(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => {
      const keyboardTop = e?.endCoordinates?.screenY;
      const height = heightRef.current;
      setOverlap(
        height && keyboardTop
          ? Math.max(0, height - keyboardTop)
          : e?.endCoordinates?.height || 0,
      );
    });
    const hideSub = Keyboard.addListener(hideEvent, () => setOverlap(0));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const onLayout = useCallback((e) => {
    heightRef.current = e.nativeEvent.layout.height;
  }, []);

  return { overlap, onLayout };
}

// Bottom padding for a sheet: `base` plus the navigation bar, but only while
// the keyboard is closed.
export function useSheetBottomPadding(base = 16) {
  const insets = useSafeAreaInsets();
  const { overlap } = useContext(KeyboardSheetContext);
  return base + (overlap > 0 ? 0 : insets.bottom);
}

// The sheet panel itself: shrinks to the space above the keyboard and pads its
// bottom by `bottomPadding` (+ the navigation bar while the keyboard is closed).
export function KeyboardSheet({ style, bottomPadding = 16, children, ...rest }) {
  const paddingBottom = useSheetBottomPadding(bottomPadding);
  return (
    <View {...rest} style={[style, { flexShrink: 1, paddingBottom }]}>
      {children}
    </View>
  );
}

// Replaces the sheet's dim overlay View. Pass the existing overlay style
// (flex: 1, justifyContent: 'flex-end', backdrop colour).
export function KeyboardSheetOverlay({ style, children, topGap = 12, ...rest }) {
  const insets = useSafeAreaInsets();
  const { overlap, onLayout } = useKeyboardOverlap();

  return (
    <KeyboardSheetContext.Provider value={{ overlap }}>
      <View
        {...rest}
        style={[style, { paddingTop: insets.top + topGap, paddingBottom: overlap }]}
        onLayout={onLayout}
      >
        {children}
      </View>
    </KeyboardSheetContext.Provider>
  );
}

// ScrollView for a sheet's fields. Scrolls the focused input into view once
// the keyboard has opened and the sheet has shrunk to fit above it.
export const KeyboardSheetScroll = forwardRef(function KeyboardSheetScroll(
  { children, onScroll, onLayout, ...props },
  ref,
) {
  const scrollRef = useRef(null);
  const contentRef = useRef(null);
  const scrollYRef = useRef(0);
  const viewportRef = useRef(0);
  const timerRef = useRef(null);
  const { overlap } = useContext(KeyboardSheetContext);

  useImperativeHandle(ref, () => scrollRef.current);

  const scrollFocusedIntoView = useCallback(() => {
    const input = TextInput.State?.currentlyFocusedInput?.();
    const content = contentRef.current;
    if (!input || !content || !input.measureLayout) return;
    input.measureLayout(
      content,
      (_x, y, _w, h) => {
        const viewport = viewportRef.current;
        const current = scrollYRef.current;
        let next = current;
        if (y + h + FOCUSED_INPUT_GAP > current + viewport) {
          next = y + h + FOCUSED_INPUT_GAP - viewport;
        } else if (y - FOCUSED_INPUT_GAP < current) {
          next = Math.max(0, y - FOCUSED_INPUT_GAP);
        }
        if (Math.abs(next - current) > 2) {
          scrollRef.current?.scrollTo({ y: next, animated: true });
        }
      },
      () => {}, // focused input is not inside this sheet
    );
  }, []);

  const schedule = useCallback((delay = 120) => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(scrollFocusedIntoView, delay);
  }, [scrollFocusedIntoView]);

  useEffect(() => {
    if (overlap > 0) schedule();
  }, [overlap, schedule]);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      {...props}
      ref={scrollRef}
      scrollEventThrottle={16}
      onScroll={(e) => {
        scrollYRef.current = e.nativeEvent.contentOffset.y;
        onScroll?.(e);
      }}
      onLayout={(e) => {
        viewportRef.current = e.nativeEvent.layout.height;
        if (overlap > 0) schedule(60);
        onLayout?.(e);
      }}
    >
      <View
        ref={contentRef}
        collapsable={false}
        // Focus moved to another field while the keyboard stays open.
        onFocusCapture={overlap > 0 ? () => schedule(60) : undefined}
      >
        {children}
      </View>
    </ScrollView>
  );
});
