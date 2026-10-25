// Start-up splash drawn by React once the native splash hands over. It looks
// exactly like the native one — the round Humaeli logo, same size, on the soft
// mint gradient, with the name under it (splash_screen.xml and
// MainActivity's blinking overlay) — so the handover is invisible.
//
// Motion is kept calm and premium: the logo breathes very slightly, a faint
// halo pulses behind it and the eyes blink now and then. When `done` is set
// (and it has been up for `minMs`) the logo eases forward a touch as the whole
// splash fades into the app, then `onHidden` is called. With reduced motion it
// simply fades.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, NativeModules, StatusBar, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Svg, { Defs, LinearGradient as SvgGradient, Stop, Text as SvgText } from 'react-native-svg';
import { BlinkingLogo, HUMAELI_LOGO_ROUND, useBlink, useReduceMotion } from './HumaeliBlinkingLogo';
import { BRAND } from '../../theme/palette';

// Typography — kept identical in MainActivity's native copy: the name in the
// logo's teal → green gradient, slightly tracked.
const NAME = { size: 30, weight: '700', spacing: 1, box: 36, baseline: 28.5, width: 260 };
const NAME_GRADIENT = [BRAND.gradientFrom, BRAND.gradientTo];

// Soft mint, top to bottom — the same three colours as the native splash
// (res/values/colors.xml: splash_gradient_top, splash_background,
// splash_gradient_bottom), so nothing shifts when JS takes over.
const SPLASH_GRADIENT = ['#E3F4EF', '#EEF8F5', '#F9FCFB'];

// The native splash draws splash_icon at 288dp (the Android 12+ system splash
// size); its logo fills 254/432 of that (169dp). HumaeliIcon.png's logo fills
// 396/512 of the image, so a 219dp image shows the logo at the same size.
const LOGO_SIZE = 219;
const HALO_SIZE = 210;
// Space from the screen centre to just under the visible logo (its bottom edge
// sits at 445/512 of the image). MainActivity places its copy of the name and
// tagline at the same offset (SPLASH_TEXT_OFFSET_DP).
const TEXT_OFFSET = LOGO_SIZE * (445 / 512 - 0.5) + 16;
// Android's TextView (lineHeight) puts its first line ~4dp lower than this
// layout does; measured on device, so the JS copy is nudged to match exactly.
const NATIVE_TEXT_NUDGE = 4;
// The logo + name group is lifted so its middle sits at the screen centre (the
// logo alone at the centre left the group low). Same value as MainActivity's
// SPLASH_GROUP_LIFT_DP.
const GROUP_LIFT = 24;

const timing = (value, toValue, duration, easing) =>
  Animated.timing(value, { toValue, duration, easing, useNativeDriver: true });

export default function HumaeliLogoSplash({ done = false, minMs = 400, onHidden }) {
  const reduceMotion = useReduceMotion();
  // The native splash has just blinked (or is about to), so the first blink
  // here waits a while — otherwise the handover blinks twice in a row.
  const blink = useBlink(!reduceMotion, { firstDelay: 2600 });
  const breathe = useRef(new Animated.Value(0)).current;
  const halo = useRef(new Animated.Value(0)).current;
  const haloFade = useRef(new Animated.Value(1)).current;
  const exit = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;
  const [minElapsed, setMinElapsed] = useState(minMs <= 0);

  // The parent passes a new onHidden each render; the exit runs once and
  // onHidden is called exactly once, whatever happens to the animation.
  const onHiddenRef = useRef(onHidden);
  onHiddenRef.current = onHidden;
  const leavingRef = useRef(false);
  const hiddenRef = useRef(false);
  const hide = useCallback(() => {
    if (hiddenRef.current) return;
    hiddenRef.current = true;
    onHiddenRef.current?.();
  }, []);

  useEffect(() => {
    if (minMs <= 0) {
      setMinElapsed(true);
      return undefined;
    }
    const timer = setTimeout(() => setMinElapsed(true), minMs);
    return () => clearTimeout(timer);
  }, [minMs]);

  // Calm while waiting: a slight breath and a faint halo. They keep running
  // through the exit (the halo just fades) — stopping them mid-exit could stop
  // the exit too and leave the splash on screen.
  useEffect(() => {
    if (reduceMotion) return undefined;
    const loops = [
      Animated.loop(Animated.sequence([
        timing(breathe, 1, 1600, Easing.inOut(Easing.sin)),
        timing(breathe, 0, 1600, Easing.inOut(Easing.sin)),
      ])),
      Animated.loop(Animated.sequence([
        timing(halo, 1, 2200, Easing.out(Easing.quad)),
        timing(halo, 0, 0),
      ])),
    ];
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [reduceMotion, breathe, halo]);

  // Into the app: the logo eases forward a touch while everything fades.
  const fallbackRef = useRef(null);
  useEffect(() => () => clearTimeout(fallbackRef.current), []);
  useEffect(() => {
    if (!done || !minElapsed || leavingRef.current) return;
    leavingRef.current = true;
    // Safety net: never leave the splash up, even if an animation is cut short.
    // Kept in a ref so a later re-run of this effect can't cancel it.
    fallbackRef.current = setTimeout(hide, 900);
    if (reduceMotion) {
      timing(fade, 0, 260, Easing.out(Easing.quad)).start(hide);
      return;
    }
    Animated.parallel([
      timing(haloFade, 0, 150, Easing.out(Easing.quad)),
      timing(exit, 1, 260, Easing.inOut(Easing.cubic)),
      timing(fade, 0, 260, Easing.inOut(Easing.quad)),
    ]).start(hide);
  }, [done, minElapsed, reduceMotion, fade, exit, haloFade, hide]);

  // The native blinking overlay (Android) stays until this splash is actually
  // on screen: two frames after the logo image has loaded, or after the
  // splash has been laid out (whichever comes first). Not on a timer — after a
  // reload JS can run well before its screen shows, and a timer used to drop
  // the overlay early, leaving a bare logo for seconds. MainActivity removes
  // the overlay itself after 15s if neither ever happens.
  const hideNativeOverlay = useCallback(() => {
    requestAnimationFrame(() => requestAnimationFrame(() => NativeModules.SplashOverlay?.hide?.()));
  }, []);

  const logoScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.02] });
  const exitScale = exit.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const haloScale = halo.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.45] });
  const haloOpacity = halo.interpolate({ inputRange: [0, 0.2, 1], outputRange: [0, 0.14, 0] });

  return (
    <Animated.View style={[s.screen, { opacity: fade }]} pointerEvents={done && minElapsed ? 'none' : 'auto'}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <LinearGradient colors={SPLASH_GRADIENT} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={s.center}>
        {!reduceMotion && (
          <Animated.View
            pointerEvents="none"
            style={[s.halo, { opacity: Animated.multiply(haloOpacity, haloFade), transform: [{ scale: haloScale }] }]}
          />
        )}
        <Animated.View style={{ transform: [{ scale: exitScale }] }} onLayout={hideNativeOverlay}>
          <BlinkingLogo
            size={LOGO_SIZE}
            blink={blink}
            source={HUMAELI_LOGO_ROUND}
            onLoad={hideNativeOverlay}
            style={{ transform: [{ scale: logoScale }] }}
          />
        </Animated.View>
        {/* Below the logo without moving it off the screen centre; shown from
            the start, like the native overlay's copy. */}
        <View style={s.textBlock}>
          <Svg width={NAME.width} height={NAME.box}>
            <Defs>
              <SvgGradient id="humaeliName" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={NAME_GRADIENT[0]} />
                <Stop offset="1" stopColor={NAME_GRADIENT[1]} />
              </SvgGradient>
            </Defs>
            <SvgText
              x={NAME.width / 2}
              y={NAME.baseline}
              textAnchor="middle"
              fill="url(#humaeliName)"
              fontSize={NAME.size}
              fontWeight={NAME.weight}
              letterSpacing={NAME.spacing}
            >
              Humaeli
            </SvgText>
          </Svg>
          {/* What the app is for, at a glance — the brand line from the logo. */}
          <Text style={s.tagline} allowFontScaling={false}>Talk. Connect. Feel Supported.</Text>
        </View>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  screen: { ...StyleSheet.absoluteFillObject, backgroundColor: SPLASH_GRADIENT[1], zIndex: 10000, elevation: 10000 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', transform: [{ translateY: -GROUP_LIFT }] },
  halo: {
    position: 'absolute', width: HALO_SIZE, height: HALO_SIZE, borderRadius: HALO_SIZE / 2,
    backgroundColor: BRAND.gradientTo,
  },
  textBlock: { position: 'absolute', top: '50%', marginTop: TEXT_OFFSET + NATIVE_TEXT_NUDGE, alignItems: 'center' },
  // Same size, colour and gap as MainActivity's native copy.
  tagline: { marginTop: 4, fontSize: 13, lineHeight: 18, letterSpacing: 0.3, color: '#4B6B66', textAlign: 'center' },
});
