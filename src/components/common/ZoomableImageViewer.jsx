import React, { useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  Image,
  Animated,
  PanResponder,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import useLanguageRender from '../../hooks/useLanguageRender';

/**
 * Full-screen image viewer with pinch-to-zoom, drag-to-pan and double-tap zoom.
 *
 * Written against RN's built-in Animated + PanResponder on purpose: this project
 * has react-native-gesture-handler but NOT reanimated, and gesture-handler's
 * pinch alone still needs an animation layer to drive the transform.
 *
 * Props:
 *   visible — bool
 *   uri     — image URL (string, already normalised via toImageUri)
 *   onClose — () => void
 */

const MIN_SCALE = 1;
const MAX_SCALE = 5;
// The image view is laid out DETAIL_FACTOR times bigger than the window and the
// zoom transform is divided by the same amount, so on screen it still starts at
// fit size. React Native decodes a bitmap to suit the view it is laid out in, so
// this is what makes zooming show real pixels instead of upscaling a
// screen-sized texture - which is why the zoomed photo looked soft. It costs
// nothing when the source image is smaller, since RN never decodes above the
// original resolution.
const DETAIL_FACTOR = 3;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_MS = 280;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const distance = (touches) => {
  const [a, b] = touches;
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
};

const ZoomableImageViewer = ({ visible, uri, onClose }) => {
  const { t } = useLanguageRender();
  const { width, height } = Dimensions.get('window');

  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  // Animated.Value has no readable .value, and reading __getValue() is private
  // API — so the committed gesture state is mirrored in refs.
  const scaleRef = useRef(1);
  const txRef = useRef(0);
  const tyRef = useRef(0);
  // Snapshot taken when a gesture starts, so each move is relative to it.
  const startScale = useRef(1);
  const startDist = useRef(0);
  const startTx = useRef(0);
  const startTy = useRef(0);
  const lastTapAt = useRef(0);

  // How far the image may be dragged before its edge pulls inside the screen.
  const maxOffset = useCallback(
    (s) => ({ x: (Math.max(s, 1) - 1) * width * 0.5, y: (Math.max(s, 1) - 1) * height * 0.5 }),
    [width, height],
  );

  const setTransform = useCallback(
    (s, x, y) => {
      // stopAnimation first: writing to a value that still has a running
      // animation attached can leave it stuck at the animation's target.
      scale.stopAnimation();
      translateX.stopAnimation();
      translateY.stopAnimation();
      scaleRef.current = s;
      txRef.current = x;
      tyRef.current = y;
      scale.setValue(s);
      translateX.setValue(x);
      translateY.setValue(y);
    },
    [scale, translateX, translateY],
  );

  const animateTo = useCallback(
    (s, x, y) => {
      scaleRef.current = s;
      txRef.current = x;
      tyRef.current = y;
      Animated.parallel([
        Animated.spring(scale, { toValue: s, useNativeDriver: true, friction: 8, tension: 60 }),
        Animated.spring(translateX, { toValue: x, useNativeDriver: true, friction: 8, tension: 60 }),
        Animated.spring(translateY, { toValue: y, useNativeDriver: true, friction: 8, tension: 60 }),
      ]).start();
    },
    [scale, translateX, translateY],
  );

  const reset = useCallback(() => setTransform(1, 0, 0), [setTransform]);

  // A reopened viewer must start at 1x, not wherever the last image was left.
  useEffect(() => {
    if (visible) reset();
  }, [visible, reset]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (e, g) =>
        e.nativeEvent.touches.length > 1 ||
        scaleRef.current > 1 ||
        Math.abs(g.dx) > 2 ||
        Math.abs(g.dy) > 2,
      // Keep the gesture even if a parent (e.g. a ScrollView) wants it.
      onPanResponderTerminationRequest: () => false,

      onPanResponderGrant: (e) => {
        const touches = e.nativeEvent.touches;
        startScale.current = scaleRef.current;
        startTx.current = txRef.current;
        startTy.current = tyRef.current;
        startDist.current = touches.length > 1 ? distance(touches) : 0;

        if (touches.length === 1) {
          const now = Date.now();
          if (now - lastTapAt.current < DOUBLE_TAP_MS) {
            // Double tap toggles between fit and zoomed.
            lastTapAt.current = 0;
            animateTo(scaleRef.current > 1 ? 1 : DOUBLE_TAP_SCALE, 0, 0);
          } else {
            lastTapAt.current = now;
          }
        }
      },

      onPanResponderMove: (e, g) => {
        const touches = e.nativeEvent.touches;

        if (touches.length > 1) {
          if (!startDist.current) startDist.current = distance(touches);
          const next = clamp(
            startScale.current * (distance(touches) / startDist.current),
            MIN_SCALE,
            MAX_SCALE,
          );
          setTransform(next, txRef.current, tyRef.current);
          return;
        }

        // One finger only pans once zoomed in — at 1x there is nothing to pan.
        if (scaleRef.current > 1) {
          setTransform(scaleRef.current, startTx.current + g.dx, startTy.current + g.dy);
        }
      },

      onPanResponderRelease: () => {
        startDist.current = 0;
        if (scaleRef.current <= 1) {
          // Snap back so a pinch that ends below 1x can't leave the image
          // shrunken or drifted off-centre.
          animateTo(1, 0, 0);
          return;
        }
        // Pull the image back if it was dragged past its own edge.
        const lim = maxOffset(scaleRef.current);
        const x = clamp(txRef.current, -lim.x, lim.x);
        const y = clamp(tyRef.current, -lim.y, lim.y);
        if (x !== txRef.current || y !== tyRef.current) animateTo(scaleRef.current, x, y);
      },
    }),
  ).current;

  if (!uri) return null;

  return (
    <Modal visible={!!visible} transparent animationType="fade" onRequestClose={onClose}>
      <StatusBar backgroundColor="#000000" barStyle="light-content" />
      <View style={styles.overlay}>
        <View style={styles.canvas} {...pan.panHandlers}>
          <Animated.Image
            source={{ uri }}
            resizeMode="contain"
            style={[
              styles.image,
              { width: width * DETAIL_FACTOR, height: height * DETAIL_FACTOR },
              {
                // Translate is listed BEFORE scale so panning stays in screen
                // pixels. The other order multiplies the drag by the zoom level,
                // which made the image shoot away from the finger and put it
                // outside the bounds clamped on release.
                transform: [
                  { translateX },
                  { translateY },
                  { scale: Animated.divide(scale, DETAIL_FACTOR) },
                ],
              },
            ]}
          />
        </View>

        <TouchableOpacity
          style={styles.closeBtn}
          onPress={onClose}
          activeOpacity={0.8}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="close" size={26} color="#ffffff" />
        </TouchableOpacity>

        <View style={styles.hint} pointerEvents="none">
          <Text style={styles.hintText}>{t('Pinch or double-tap to zoom')}</Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#000000',
  },
  canvas: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    // Size is set inline: window size x DETAIL_FACTOR, then scaled back down in
    // the transform.
  },
  closeBtn: {
    position: 'absolute',
    top: 44,
    right: 18,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  hint: {
    position: 'absolute',
    bottom: 38,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  hintText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '500',
  },
});

export default ZoomableImageViewer;
