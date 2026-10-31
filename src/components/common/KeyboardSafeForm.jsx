import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Keyboard, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import useKeyboardAwareScroll from '../../hooks/useKeyboardAwareScroll';

// Measure the actual overlap: Android may resize the window or cover it.
// Padding the outer frame shrinks its children without counting a resize twice.
// `safeTop={false}`: the screen sits under an app header that already clears
// the status bar, so no status-bar inset is added on top.
export function KeyboardSafeArea({ children, style, onLayout, safeTop = true, ...props }) {
  const frameRef = useRef(null);
  const keyboardTopRef = useRef(null);
  const [overlap, setOverlap] = useState(0);
  const insets = useSafeAreaInsets();
  const base = StyleSheet.flatten(style) || {};
  const bottom = base.paddingBottom ?? base.paddingVertical ?? base.padding ?? 0;
  const top = base.paddingTop ?? base.paddingVertical ?? base.padding ?? 0;
  const measure = useCallback(() => {
    const keyboardTop = keyboardTopRef.current ?? Keyboard.metrics?.()?.screenY;
    if (keyboardTop == null) return;
    frameRef.current?.measure((_x, _y, _width, height, _pageX, pageY) => {
      setOverlap(Math.max(0, pageY + height - keyboardTop));
    });
  }, []);

  useEffect(() => {
    const show = event => {
      keyboardTopRef.current = event.endCoordinates.screenY;
      measure();
    };
    const hide = () => { keyboardTopRef.current = null; setOverlap(0); };
    const subscriptions = [
      Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow', show),
      Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', hide),
    ];
    measure();
    return () => subscriptions.forEach(subscription => subscription.remove());
  }, [measure]);

  return (
    <View
      {...props}
      ref={frameRef}
      collapsable={false}
      style={[style, styles.area, { paddingTop: safeTop ? Math.max(top, insets.top + 8) : top, paddingBottom: bottom + overlap }]}
      onLayout={event => { measure(); onLayout?.(event); }}
    >
      {children}
    </View>
  );
}

// Leave room for the action below an OTP/password field, and preserve the
// first button tap while the keyboard is open. The surrounding area avoids it.
export const KeyboardSafeScroll = forwardRef(function KeyboardSafeScroll(
  { children, style, onFocusCapture, onScroll, onLayout, focusGap = 140, ...props }, ref,
) {
  const keyboard = useKeyboardAwareScroll({ layoutAvoidsKeyboard: true, focusGap });
  useImperativeHandle(ref, () => keyboard.scrollRef.current);
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      {...props}
      ref={keyboard.scrollRef}
      style={[styles.scroll, style]}
      scrollEventThrottle={16}
      onFocusCapture={event => { keyboard.scrollFocusedInputIntoView(event); onFocusCapture?.(event); }}
      onScroll={event => { keyboard.handleKeyboardAwareScroll(event); onScroll?.(event); }}
      onLayout={event => { keyboard.handleKeyboardAwareScrollLayout(event); onLayout?.(event); }}
    >
      {children}
    </ScrollView>
  );
});

const styles = StyleSheet.create({
  area: { minHeight: 0 },
  scroll: { flexShrink: 1, minHeight: 0 },
});
