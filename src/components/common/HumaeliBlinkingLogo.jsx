// The Humaeli logo with blinking eyes, shared by the patient AI button, the
// AI chat header and the app's start-up splash. HumaeliIcon.png is a flat
// image, so each eye gets a lid: the face colour with a dark lash line,
// sliding down inside a box clipped to the eye.
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, View } from 'react-native';

export const HUMAELI_LOGO = require('../../image/HumaeliIcon.png');
// The same logo without the speech-bubble tail (just the round bubble); the
// eyes sit in the same place, so it blinks the same way.
export const HUMAELI_LOGO_ROUND = require('../../image/HumaeliIconRound.png');

// Where the eyes sit in HumaeliIcon.png (512×512), as fractions of its size,
// padded a little so a lid fully covers each eye. FACE is the face colour
// around them; LASH is the dark line a closed eye shows.
const EYES = [
  { x: 166 / 512, y: 259 / 512, w: 44 / 512, h: 58 / 512 },
  { x: 314 / 512, y: 258 / 512, w: 45 / 512, h: 59 / 512 },
];
const FACE = '#FDFDFD';
const LASH = '#0B4A4C';

export const useReduceMotion = () => {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.().then((on) => { if (alive) setReduceMotion(Boolean(on)); }).catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (on) => setReduceMotion(Boolean(on)));
    return () => { alive = false; sub?.remove?.(); };
  }, []);
  return reduceMotion;
};

// 0 = eyes open, 1 = closed. Paced like a person: a soft blink every 4–5
// seconds at uneven gaps, and only now and then a double one (once every
// ~15s) — frequent or doubled blinks read as twitching. Each blink closes
// quickly, holds briefly and opens a little slower, as real eyelids do.
// `firstDelay`: wait before the first blink.
export const useBlink = (enabled, { firstDelay = 2800 } = {}) => {
  const blink = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!enabled) {
      blink.setValue(0);
      return undefined;
    }
    // A fresh animation per blink — one instance shouldn't run twice in a sequence.
    const once = (hold) => Animated.sequence([
      Animated.timing(blink, { toValue: 1, duration: 110, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.delay(hold),
      Animated.timing(blink, { toValue: 0, duration: 170, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]);
    const cycle = Animated.loop(
      Animated.sequence([
        Animated.delay(4200),
        once(70),
        Animated.delay(4800),
        once(70),
        Animated.delay(5300),
        once(60),
        Animated.delay(200),
        once(60),
      ]),
    );
    const run = Animated.sequence([Animated.delay(firstDelay), once(50), cycle]);
    run.start();
    return () => run.stop();
  }, [enabled, blink, firstDelay]);
  return blink;
};

// `size`: the image's width/height in dp. `blink`: value from useBlink.
// `wink` (optional, 0–1): closes only the logo's right eye, on top of `blink`.
// `onLoad`: the logo image has loaded. `source`: another version of the logo
// with the eyes in the same place (e.g. HUMAELI_LOGO_ROUND).
export function BlinkingLogo({ size, blink, wink, style, onLoad, source = HUMAELI_LOGO }) {
  // The right eye follows blink + wink, so a wink works mid-blink too.
  const rightEye = wink
    ? Animated.add(blink, wink).interpolate({ inputRange: [0, 1], outputRange: [0, 1], extrapolate: 'clamp' })
    : blink;
  return (
    <Animated.View style={[{ width: size, height: size }, style]}>
      <Image source={source} resizeMode="contain" style={{ width: size, height: size }} onLoad={onLoad} />
      {EYES.map((eye, index) => {
        const h = eye.h * size;
        const closed = index === 1 ? rightEye : blink;
        return (
          <View
            key={index}
            pointerEvents="none"
            style={[s.eyeClip, { left: eye.x * size, top: eye.y * size, width: eye.w * size, height: h }]}
          >
            <Animated.View
              style={[
                s.lid,
                {
                  height: h,
                  borderBottomWidth: Math.max(1, size * 0.02),
                  transform: [{ translateY: closed.interpolate({ inputRange: [0, 1], outputRange: [-h - 2, 0] }) }],
                },
              ]}
            />
          </View>
        );
      })}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  eyeClip: { position: 'absolute', overflow: 'hidden' },
  lid: { width: '100%', backgroundColor: FACE, borderBottomColor: LASH },
});
