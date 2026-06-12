import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  StatusBar,
  Vibration,
  Platform,
  Alert,
  Modal,
} from 'react-native';
import { isBiometricAvailable, authenticateWithBiometrics } from '../../utils/biometrics';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');
const PIN_LENGTH = 4;
export const PIN_STORAGE_KEY = 'appLockPin';
export const BIOMETRIC_LOCK_STORAGE_KEY = 'appLockBiometricEnabled';

// ─── Keypad layout ────────────────────────────────────────────────────────────
const KEYPAD = [
  [{ n: '1', s: '' },   { n: '2', s: 'ABC' },  { n: '3', s: 'DEF' }],
  [{ n: '4', s: 'GHI' },{ n: '5', s: 'JKL' },  { n: '6', s: 'MNO' }],
  [{ n: '7', s: 'PQRS' },{ n: '8', s: 'TUV' }, { n: '9', s: 'WXYZ' }],
];

// ─── Single PIN dot ────────────────────────────────────────────────────────────
const PinDot = ({ filled, isSuccess, scaleAnim }) => (
  <Animated.View
    style={[
      dotS.dot,
      filled && dotS.filled,
      isSuccess && filled && dotS.success,
      { transform: [{ scale: scaleAnim }] },
    ]}
  />
);

const dotS = StyleSheet.create({
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.55)',
    backgroundColor: 'transparent',
    marginHorizontal: 10,
  },
  filled: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 6,
    elevation: 4,
  },
  success: {
    backgroundColor: '#4ade80',
    borderColor: '#4ade80',
    shadowColor: '#4ade80',
  },
});

// ─── Number / icon key ────────────────────────────────────────────────────────
const Key = ({ num, sub, iconName, onPress, disabled }) => {
  const pressScale = useRef(new Animated.Value(1)).current;
  const pressOpacity = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    if (disabled) return;
    Animated.parallel([
      Animated.sequence([
        Animated.timing(pressScale, { toValue: 0.85, duration: 70, useNativeDriver: true }),
        Animated.spring(pressScale, { toValue: 1, tension: 240, friction: 7, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(pressOpacity, { toValue: 0.55, duration: 70, useNativeDriver: true }),
        Animated.timing(pressOpacity, { toValue: 1, duration: 100, useNativeDriver: true }),
      ]),
    ]).start();
    onPress?.();
  };

  if (!num && !iconName) return <View style={keyS.ghost} />;

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={1} disabled={disabled}>
      <Animated.View
        style={[keyS.key, { transform: [{ scale: pressScale }], opacity: pressOpacity }]}
      >
        {iconName ? (
          <Ionicons name={iconName} size={27} color="rgba(255,255,255,0.8)" />
        ) : (
          <>
            <Text style={keyS.num}>{num}</Text>
            {!!sub && <Text style={keyS.sub}>{sub}</Text>}
          </>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

const keyS = StyleSheet.create({
  ghost: { width: 72, height: 72, marginHorizontal: 13 },
  key: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 13,
  },
  num: {
    fontSize: 30,
    fontWeight: '300',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    lineHeight: 34,
  },
  sub: {
    fontSize: 8,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 1.8,
    marginTop: -2,
  },
});

// ─── AppLockScreen ────────────────────────────────────────────────────────────
/**
 * mode:
 *   'unlock'  – verify existing PIN (default)
 *   'setup'   – first-step of PIN creation  → onSuccess(pin) called with the entered pin
 *   'confirm' – second-step               → onSuccess() called after saving
 *
 * Props:
 *   onSuccess   — () => void  |  (pin: string) => void
 *   onCancel    — () => void  (shown in setup/confirm modes)
 *   confirmPin  — string       (required in confirm mode)
 */
const AppLockScreen = ({
  mode = 'unlock',
  onSuccess,
  onCancel = undefined,
  confirmPin = undefined,
}) => {
  const { t } = useTranslation();
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  // ── Animation refs ──────────────────────────────────────────────────────────
  const slideAnim  = useRef(new Animated.Value(height * 0.06)).current;
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const shakeAnim  = useRef(new Animated.Value(0)).current;
  const errorFade  = useRef(new Animated.Value(0)).current;
  const checkScale = useRef(new Animated.Value(0)).current;
  const checkFade  = useRef(new Animated.Value(0)).current;
  const dotScales  = useRef(
    Array.from({ length: PIN_LENGTH }, () => new Animated.Value(1))
  ).current;

  // ── Entry animation ─────────────────────────────────────────────────────────
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 70, friction: 12, useNativeDriver: true }),
    ]).start();
  }, []);

  // ── Auto-prompt biometrics on mount (unlock mode) ───────────────────────────
  useEffect(() => {
    if (mode !== 'unlock') return;
    const timer = setTimeout(async () => {
      const { available } = await isBiometricAvailable();
      if (available) {
        const { success } = await authenticateWithBiometrics('Unlock Mediconect');
        if (success) triggerSuccess();
      }
    }, 350); // slight delay so the screen finishes sliding in
    return () => clearTimeout(timer);
  }, [mode]);

  // ── Helpers ─────────────────────────────────────────────────────────────────
  const resetDots = useCallback((keepFilled = false) => {
    if (!keepFilled) {
      dotScales.forEach(s =>
        Animated.timing(s, { toValue: 1, duration: 80, useNativeDriver: true }).start()
      );
    }
  }, [dotScales]);

  const triggerError = useCallback((msg) => {
    setErrorMsg(msg);
    setPin('');
    resetDots();

    // Fade in error
    errorFade.setValue(0);
    Animated.timing(errorFade, { toValue: 1, duration: 180, useNativeDriver: true }).start();

    // Vibrate
    if (Platform.OS === 'android') {
      Vibration.vibrate([0, 80, 60, 80]);
    } else {
      Vibration.vibrate(400);
    }

    // Shake the dots row
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: -13, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  13, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:  -9, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:   9, duration: 55, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue:   0, duration: 55, useNativeDriver: true }),
    ]).start();
  }, [shakeAnim, errorFade, resetDots]);

  const triggerSuccess = useCallback(() => {
    setIsSuccess(true);
    Animated.parallel([
      Animated.spring(checkScale, { toValue: 1, tension: 55, friction: 5, useNativeDriver: true }),
      Animated.timing(checkFade, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start(() => {
      setTimeout(() => onSuccess?.(), 380);
    });
  }, [checkScale, checkFade, onSuccess]);

  // ── PIN completion ──────────────────────────────────────────────────────────
  const handleComplete = useCallback(async (fullPin) => {
    if (mode === 'setup') {
      // Pass the entered PIN to the parent (which moves to confirm step)
      setTimeout(() => {
        setPin('');
        resetDots();
        onSuccess?.(fullPin);
      }, 100);
      return;
    }

    if (mode === 'confirm') {
      if (fullPin === confirmPin) {
        await AsyncStorage.setItem(PIN_STORAGE_KEY, fullPin);
        triggerSuccess();
      } else {
        triggerError(t('lock:pinsDoNotMatch'));
      }
      return;
    }

    // unlock
    const stored = await AsyncStorage.getItem(PIN_STORAGE_KEY);
    if (fullPin === stored) {
      triggerSuccess();
    } else {
      triggerError(t('lock:incorrectPin'));
    }
  }, [mode, confirmPin, onSuccess, resetDots, triggerError, triggerSuccess]);

  // ── Key press ───────────────────────────────────────────────────────────────
  const handlePress = useCallback(async (digit) => {
    if (isSuccess || pin.length >= PIN_LENGTH) return;

    const idx = pin.length;
    const newPin = pin + digit;

    setErrorMsg('');
    errorFade.setValue(0);
    setPin(newPin);

    // Bounce the dot
    Animated.sequence([
      Animated.spring(dotScales[idx], { toValue: 1.45, tension: 280, friction: 5, useNativeDriver: true }),
      Animated.spring(dotScales[idx], { toValue: 1,    tension: 220, friction: 8, useNativeDriver: true }),
    ]).start();

    if (newPin.length === PIN_LENGTH) {
      await handleComplete(newPin);
    }
  }, [pin, isSuccess, dotScales, errorFade, handleComplete]);

  const handleDelete = useCallback(() => {
    if (isSuccess || pin.length === 0) return;
    const idx = pin.length - 1;
    Animated.timing(dotScales[idx], { toValue: 1, duration: 90, useNativeDriver: true }).start();
    setPin(prev => prev.slice(0, -1));
    setErrorMsg('');
    errorFade.setValue(0);
  }, [pin, isSuccess, dotScales, errorFade]);

  const handleBiometric = useCallback(async () => {
    const { available, biometryType } = await isBiometricAvailable();
    if (!available) {
      Alert.alert(
        t('lock:biometricsUnavailable'),
        t('lock:setupBiometrics'),
        [{ text: t('common:ok') }]
      );
      return;
    }
    const label = biometryType === 'FaceID' ? 'Face ID' : biometryType === 'TouchID' ? 'Touch ID' : 'Fingerprint';
    const { success } = await authenticateWithBiometrics(`Use ${label} to unlock Mediconect`);
    if (success) triggerSuccess();
  }, [triggerSuccess]);

  // ── Labels ──────────────────────────────────────────────────────────────────
  const TITLES = {
    unlock:  t('lock:welcomeBack'),
    setup:   t('lock:createPin'),
    confirm: t('lock:confirmPin'),
  };
  const SUBS = {
    unlock:  t('lock:enterPin'),
    setup:   t('lock:choosePin'),
    confirm: t('lock:reenterPin'),
  };

  return (
    <Modal
      visible={true}
      animationType="none"
      presentationStyle="fullScreen"
      statusBarTranslucent
    >
    <Animated.View style={[s.overlay, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <LinearGradient
        colors={['#0b0f1a', '#1a1040', '#1e1b4b']}
        locations={[0, 0.45, 1]}
        style={s.bg}
        start={{ x: 0.3, y: 0 }}
        end={{ x: 0.7, y: 1 }}
      >
        {/* Ambient glow blobs */}
        <View style={s.glowTR} />
        <View style={s.glowBL} />

        <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
          <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

          {/* ── Logo ──────────────────────────────────────────────────────── */}
          <View style={s.logoWrap}>
            <View style={s.logoRing}>
              <LinearGradient colors={['#6366f1', '#8b5cf6']} style={s.logoCircle}>
                <Ionicons name="shield-checkmark" size={33} color="#fff" />
              </LinearGradient>
            </View>
            <Text style={s.appLabel}>MEDICONECT</Text>
          </View>

          {/* ── Title ─────────────────────────────────────────────────────── */}
          <View style={s.titleWrap}>
            <Text style={s.title}>{TITLES[mode]}</Text>
            <Text style={s.subtitle}>{SUBS[mode]}</Text>
          </View>

          {/* ── PIN dots ──────────────────────────────────────────────────── */}
          <Animated.View
            style={[s.dotsRow, { transform: [{ translateX: shakeAnim }] }]}
          >
            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
              <PinDot
                key={i}
                filled={i < pin.length}
                isSuccess={isSuccess}
                scaleAnim={dotScales[i]}
              />
            ))}
          </Animated.View>

          {/* Success checkmark */}
          <Animated.View
            pointerEvents="none"
            style={[s.checkWrap, { opacity: checkFade, transform: [{ scale: checkScale }] }]}
          >
            <Ionicons name="checkmark-circle" size={54} color="#4ade80" />
          </Animated.View>

          {/* Error text */}
          <Animated.Text style={[s.error, { opacity: errorFade }]}>
            {errorMsg}
          </Animated.Text>

          {/* ── Keypad ────────────────────────────────────────────────────── */}
          <View style={s.pad}>
            {KEYPAD.map((row, ri) => (
              <View key={ri} style={s.padRow}>
                {row.map(({ n, s: sub }) => (
                  <Key
                    key={n}
                    num={n}
                    sub={sub}
                    onPress={() => handlePress(n)}
                    disabled={isSuccess}
                  />
                ))}
              </View>
            ))}

            {/* Bottom row: biometric | 0 | delete */}
            <View style={s.padRow}>
              {mode === 'unlock' ? (
                <Key iconName="finger-print-outline" onPress={handleBiometric} disabled={isSuccess} />
              ) : (
                <View style={keyS.ghost} />
              )}
              <Key num="0" sub="" onPress={() => handlePress('0')} disabled={isSuccess} />
              <Key iconName="backspace-outline" onPress={handleDelete} disabled={isSuccess} />
            </View>
          </View>

          {/* Cancel (setup / confirm modes only) */}
          {mode !== 'unlock' && onCancel ? (
            <TouchableOpacity style={s.cancelBtn} onPress={onCancel} activeOpacity={0.6}>
              <Text style={s.cancelText}>Cancel</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ height: 40 }} />
          )}
        </SafeAreaView>
      </LinearGradient>
    </Animated.View>
    </Modal>
  );
};

const s = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  bg: {
    flex: 1,
  },
  glowTR: {
    position: 'absolute',
    top: -70,
    right: -70,
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: 'rgba(99,102,241,0.16)',
  },
  glowBL: {
    position: 'absolute',
    bottom: -90,
    left: -90,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(139,92,246,0.13)',
  },
  safe: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  // Logo
  logoWrap: { alignItems: 'center', marginTop: 10 },
  logoRing: {
    padding: 3,
    borderRadius: 38,
    borderWidth: 1.5,
    borderColor: 'rgba(139,92,246,0.45)',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 14,
    elevation: 10,
  },
  logoCircle: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appLabel: {
    marginTop: 11,
    color: 'rgba(226,232,240,0.85)',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 3.5,
  },
  // Title
  titleWrap: { alignItems: 'center' },
  title: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '700',
    letterSpacing: 0.2,
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 7,
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 32,
  },
  // Dots
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 36,
  },
  checkWrap: {
    position: 'absolute',
    alignSelf: 'center',
    // vertically centered between subtitle and keypad - fine as absolute
    top: '44%',
  },
  error: {
    color: '#f87171',
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    height: 18,
  },
  // Keypad
  pad: { width: '100%', alignItems: 'center' },
  padRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 7,
  },
  // Cancel
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 30,
    marginBottom: 4,
  },
  cancelText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 15,
    fontWeight: '500',
  },
});

export default AppLockScreen;
