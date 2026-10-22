// Floating "Ask Humaelio" button on the patient dashboard: the Humaeli app
// icon in a white disc with a green gradient ring and a soft glow, a pulse
// spreading behind it, a gently breathing logo and blinking eyes. Every time
// the app opens it says hello Duolingo-style: a hop with the logo doing a full
// spin, a squashy landing and a wink. Motion stops when the phone asks for
// reduced motion.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { BlinkingLogo, HUMAELI_LOGO as LOGO, useBlink, useReduceMotion } from '../../../../../components/common/HumaeliBlinkingLogo';

const RING = ['#006B2C', '#01CE54'];
const SIZE = 60;

const timing = (value, toValue, duration, easing) =>
  Animated.timing(value, { toValue, duration, easing, useNativeDriver: true });

// The hello animation plays each time the button mounts, i.e. whenever the
// app is opened or reloaded on the dashboard.
export default function HumaeliAiButton({ style, onPress, unreadCount = 0, showBadge = true }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;
  const press = useRef(new Animated.Value(1)).current;
  const jump = useRef(new Animated.Value(0)).current;
  const squashX = useRef(new Animated.Value(1)).current;
  const squashY = useRef(new Animated.Value(1)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const wink = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReduceMotion();
  const blink = useBlink(!reduceMotion);
  const [introPlaying, setIntroPlaying] = useState(false);

  // Hello on every app open: hop + full spin, squashy landing, then a wink.
  useEffect(() => {
    if (reduceMotion) return undefined;
    let cancelled = false;
    setIntroPlaying(true);
    spin.setValue(0);
    const intro = Animated.sequence([
      Animated.delay(600),
      // Crouch before the hop.
      Animated.parallel([
        timing(squashY, 0.84, 120, Easing.out(Easing.quad)),
        timing(squashX, 1.12, 120, Easing.out(Easing.quad)),
      ]),
      // Hop up (stretching) while the logo spins all the way round.
      Animated.parallel([
        timing(spin, 1, 640, Easing.inOut(Easing.cubic)),
        Animated.sequence([
          Animated.parallel([
            timing(jump, -30, 300, Easing.out(Easing.quad)),
            timing(squashY, 1.1, 300, Easing.out(Easing.quad)),
            timing(squashX, 0.92, 300, Easing.out(Easing.quad)),
          ]),
          Animated.parallel([
            timing(jump, 0, 260, Easing.in(Easing.quad)),
            timing(squashY, 1, 260, Easing.in(Easing.quad)),
            timing(squashX, 1, 260, Easing.in(Easing.quad)),
          ]),
        ]),
      ]),
      // Squashy landing that springs back.
      Animated.parallel([
        timing(squashY, 0.86, 80, Easing.out(Easing.quad)),
        timing(squashX, 1.12, 80, Easing.out(Easing.quad)),
      ]),
      Animated.parallel([
        Animated.spring(squashY, { toValue: 1, friction: 3.5, tension: 180, useNativeDriver: true }),
        Animated.spring(squashX, { toValue: 1, friction: 3.5, tension: 180, useNativeDriver: true }),
      ]),
      // Wink.
      Animated.delay(80),
      timing(wink, 1, 110, Easing.in(Easing.quad)),
      Animated.delay(280),
      timing(wink, 0, 150, Easing.out(Easing.quad)),
    ]);
    intro.start(() => { if (!cancelled) setIntroPlaying(false); });
    return () => { cancelled = true; intro.stop(); };
  }, [reduceMotion, jump, squashX, squashY, spin, wink]);

  useEffect(() => {
    if (reduceMotion || introPlaying) {
      pulse.setValue(0);
      breathe.setValue(0);
      return undefined;
    }
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.delay(500),
      ]),
    );
    const breatheLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    pulseLoop.start();
    breatheLoop.start();
    return () => { pulseLoop.stop(); breatheLoop.stop(); };
  }, [reduceMotion, introPlaying, pulse, breathe]);

  const springTo = (toValue) =>
    Animated.spring(press, { toValue, friction: 5, tension: 120, useNativeDriver: true }).start();

  const haloScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
  const haloOpacity = pulse.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.45, 0] });
  const logoScale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] });
  const logoSpin = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={[s.wrap, style]} pointerEvents="box-none">
      {!reduceMotion && (
        <Animated.View
          pointerEvents="none"
          style={[s.halo, { opacity: haloOpacity, transform: [{ scale: haloScale }] }]}
        />
      )}
      <Pressable
        onPress={onPress}
        onPressIn={() => springTo(0.92)}
        onPressOut={() => springTo(1)}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Open Humaelio AI assistant"
      >
        <Animated.View
          style={[
            s.glow,
            { transform: [{ translateY: jump }, { scale: press }, { scaleX: squashX }, { scaleY: squashY }] },
          ]}
        >
          <View style={s.shadow}>
            <LinearGradient colors={RING} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.ring}>
              <View style={s.disc}>
                <BlinkingLogo
                  size={42}
                  blink={blink}
                  wink={wink}
                  // Mirrored like the chat avatars: the bubble's tail on the right.
                  style={{ transform: [{ rotate: logoSpin }, { scale: logoScale }, { scaleX: -1 }] }}
                />
              </View>
            </LinearGradient>
          </View>
        </Animated.View>
      </Pressable>
      {showBadge && unreadCount > 0 && (
        <View pointerEvents="none" style={s.badge}>
          <Text style={s.badgeText} allowFontScaling={false}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
        </View>
      )}
    </View>
  );
}

// Small round Humaeli mark for the AI chat (header, message and typing avatars).
// `blink`: the eyes blink too (used for the header).
// Mirrored: the logo is a speech bubble with its tail bottom-left; in the chat
// the avatar sits left of the AI's message, so the tail points right, at it.
export function HumaeliAiAvatar({ size = 32, style, blink: blinking = false }) {
  const reduceMotion = useReduceMotion();
  const blink = useBlink(blinking && !reduceMotion);
  return (
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2 }, style]}>
      {blinking ? (
        <BlinkingLogo size={size * 0.76} blink={blink} style={s.mirror} />
      ) : (
        <Image source={LOGO} resizeMode="contain" style={[{ width: size * 0.76, height: size * 0.76 }, s.mirror]} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  halo: { position: 'absolute', width: SIZE, height: SIZE, borderRadius: SIZE / 2, backgroundColor: '#01CE54' },
  // Soft light-green rim around the button.
  glow: {
    width: SIZE, height: SIZE, borderRadius: SIZE / 2, padding: 3,
    backgroundColor: '#D9F7E4',
  },
  shadow: {
    flex: 1, borderRadius: SIZE / 2, backgroundColor: '#FFFFFF',
    shadowColor: '#006B2C', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 12,
  },
  ring: { flex: 1, borderRadius: SIZE / 2, padding: 2.5 },
  disc: { flex: 1, borderRadius: SIZE / 2, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  badge: {
    position: 'absolute', top: -5, right: -5, minWidth: 20, height: 20, borderRadius: 10,
    paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#EF4444', borderWidth: 2, borderColor: '#FFFFFF', elevation: 13,
  },
  badgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '700' },
  mirror: { transform: [{ scaleX: -1 }] },
  avatar: {
    backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#CDEFD9',
    shadowColor: '#006B2C', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 4, elevation: 2,
  },
});
