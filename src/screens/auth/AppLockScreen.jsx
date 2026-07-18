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
  ScrollView,
  Linking,
} from 'react-native';

// India's national mental-health helpline (Tele-MANAS). Change to your own
// support line or a local crisis number as needed.
const CRISIS_HELPLINE = '14416';
const SUPPORT_EMAIL = 'support@mediconeckt.com';
import { isBiometricAvailable, authenticateWithBiometrics } from '../../utils/biometrics';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PATIENT, DOCTOR } from '../../theme/palette';
import AuthBackground from '../../theme/AuthBackground';

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
const PinDot = ({ filled, isSuccess, scaleAnim, accent }) => (
  <Animated.View
    style={[
      dotS.dot,
      filled && { backgroundColor: accent, borderColor: accent },
      isSuccess && filled && dotS.success,
      { transform: [{ scale: scaleAnim }] },
    ]}
  />
);

const dotS = StyleSheet.create({
  dot: {
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 1.6,
    borderColor: '#CBD5E1',
    backgroundColor: 'transparent',
    marginHorizontal: 9,
  },
  success: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
});

// ─── Number / icon key ────────────────────────────────────────────────────────
const Key = ({ num, sub, iconName, onPress, disabled, accent }) => {
  const pressScale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    if (disabled) return;
    Animated.sequence([
      Animated.timing(pressScale, { toValue: 0.9, duration: 70, useNativeDriver: true }),
      Animated.spring(pressScale, { toValue: 1, tension: 240, friction: 7, useNativeDriver: true }),
    ]).start();
    onPress?.();
  };

  if (!num && !iconName) return <View style={keyS.ghost} />;

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.7} disabled={disabled} style={keyS.tap}>
      <Animated.View style={{ transform: [{ scale: pressScale }], alignItems: 'center', justifyContent: 'center' }}>
        {iconName ? (
          <Ionicons name={iconName} size={26} color={accent || '#334155'} />
        ) : (
          <Text style={keyS.num}>{num}</Text>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
};

const keyS = StyleSheet.create({
  ghost: { width: 76, height: 60, marginHorizontal: 8 },
  tap: {
    width: 76,
    height: 60,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
  },
  num: {
    fontSize: 28,
    fontWeight: '500',
    color: '#0F172A',
    letterSpacing: 0.5,
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
  forced = false,
}) => {
  const { t } = useTranslation();
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  // Role → palette: counselor = blue, everyone else = green.
  const [C, setC] = useState(PATIENT);
  const [role, setRole] = useState('user');
  // Unlock mode opens on the Face-ID landing view; the keypad is revealed via
  // "Use PIN instead". Setup/confirm always show the keypad.
  const [showKeypad, setShowKeypad] = useState(mode !== 'unlock');
  const [showEmergency, setShowEmergency] = useState(false);
  const [emergency, setEmergency] = useState(null);

  useEffect(() => {
    (async () => {
      // Blue ONLY when a role field explicitly says counselor. Every other
      // value (user, patient, empty, unknown) → green. Checking all the fields
      // the app writes avoids a stale single key flipping the theme.
      const [userRole, roleKey, userType] = await Promise.all([
        AsyncStorage.getItem('userRole'),
        AsyncStorage.getItem('role'),
        AsyncStorage.getItem('userType'),
      ]);
      const norm = (v) => String(v || '').trim().toLowerCase();
      const isCounselor = [userRole, roleKey, userType]
        .map(norm)
        .some((v) => v === 'counselor' || v === 'counsellor');
      setRole(isCounselor ? 'counselor' : 'user');
      setC(isCounselor ? DOCTOR : PATIENT);
    })();
  }, []);

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

  // Bottom "Unlock" button on the keypad view: submit a complete PIN, else
  // fall back to biometrics (unlock mode) so the button is never a dead tap.
  const handleKeypadUnlock = useCallback(() => {
    if (isSuccess) return;
    if (pin.length === PIN_LENGTH) {
      handleComplete(pin);
    } else if (mode === 'unlock') {
      handleBiometric();
    } else {
      triggerError(t('lock:enterPin', 'Enter your PIN'));
    }
  }, [isSuccess, pin, mode, handleComplete, handleBiometric, triggerError, t]);

  const dial = (num) => Linking.openURL(`tel:${num}`).catch(() => {});

  // Load the saved emergency contact (cached in userData at login) and open the
  // themed sheet, so a person in crisis can reach help without unlocking.
  const emergencyContact = useCallback(async () => {
    let ec = null;
    try {
      const raw = await AsyncStorage.getItem('userData');
      const u = raw ? JSON.parse(raw) : null;
      ec = u?.emergencyContact || u?.personalInfo?.emergencyContact || null;
    } catch { /* ignore */ }
    setEmergency(ec && (ec.phone || ec.phoneNumber) ? ec : null);
    setShowEmergency(true);
  }, []);

  return (
    <Modal
      visible={true}
      animationType="none"
      presentationStyle="fullScreen"
      statusBarTranslucent
    >
    <AuthBackground role={role}>
      <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

        {/* Scrolls when the (tall PIN) card can't fit, so all 4 corners always
            stay on-screen instead of the bottom being clipped. */}
        <ScrollView
          style={s.scroll}
          contentContainerStyle={s.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
        <Animated.View style={[s.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          {/* ── Header ────────────────────────────────────────────────────── */}
          <View style={s.header}>
            <Ionicons name="shield-checkmark" size={20} color={C.primary} />
            <Text style={[s.brand, { color: C.primary }]}>Mediconeckt</Text>
          </View>
          <Text style={s.secureLabel}>SECURE ACCESS REQUIRED</Text>

          {mode === 'unlock' && !showKeypad ? (
            /* ═══ Face-ID landing view ═══ */
            <>
              <View style={[s.faceRing, { borderColor: C.border }]}>
                <View style={[s.faceInner, { backgroundColor: C.secondaryTint }]}>
                  <Ionicons name="happy-outline" size={40} color={C.primary} />
                </View>
              </View>

              <Text style={s.title}>{t('lock:welcomeBack', 'Unlock Mediconeckt')}</Text>
              <Text style={s.subtitle}>Face ID or passcode</Text>

              <TouchableOpacity activeOpacity={0.88} onPress={handleBiometric} style={s.primaryBtnWrap}>
                <LinearGradient
                  colors={[C.gradientFrom, C.gradientTo]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.primaryBtn}
                >
                  <Ionicons name="lock-open" size={17} color="#fff" />
                  <Text style={s.primaryBtnText}>Unlock</Text>
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={s.secondaryBtn} activeOpacity={0.8} onPress={() => setShowKeypad(true)}>
                <Text style={s.secondaryBtnText}>Use PIN instead</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={emergencyContact} activeOpacity={0.7} style={s.emergencyBtn}>
                <Text style={[s.emergencyText, { color: C.primary }]}>EMERGENCY CONTACT</Text>
              </TouchableOpacity>
            </>
          ) : (
            /* ═══ PIN keypad view ═══ */
            <>
              <Text style={s.title}>{TITLES[mode]}</Text>
              <Text style={s.subtitle}>{SUBS[mode]}</Text>

              <Animated.View style={[s.dotsRow, { transform: [{ translateX: shakeAnim }] }]}>
                {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                  <PinDot
                    key={i}
                    filled={i < pin.length}
                    isSuccess={isSuccess}
                    scaleAnim={dotScales[i]}
                    accent={C.primary}
                  />
                ))}
              </Animated.View>

              <Animated.Text style={[s.error, { opacity: errorFade }]}>
                {errorMsg}
              </Animated.Text>

              <View style={s.pad}>
                {KEYPAD.map((row, ri) => (
                  <View key={ri} style={s.padRow}>
                    {row.map(({ n }) => (
                      <Key key={n} num={n} onPress={() => handlePress(n)} disabled={isSuccess} />
                    ))}
                  </View>
                ))}
                <View style={s.padRow}>
                  {mode === 'unlock' ? (
                    <Key iconName="finger-print-outline" onPress={handleBiometric} disabled={isSuccess} accent={C.primary} />
                  ) : (
                    <View style={keyS.ghost} />
                  )}
                  <Key num="0" onPress={() => handlePress('0')} disabled={isSuccess} />
                  <Key iconName="backspace-outline" onPress={handleDelete} disabled={isSuccess} accent="#64748B" />
                </View>
              </View>

              {/* Gradient action button (role palette) */}
              <TouchableOpacity activeOpacity={0.88} onPress={handleKeypadUnlock} style={s.primaryBtnWrap} disabled={isSuccess}>
                <LinearGradient
                  colors={[C.gradientFrom, C.gradientTo]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={s.primaryBtn}
                >
                  <Ionicons name="lock-open" size={17} color="#fff" />
                  <Text style={s.primaryBtnText}>
                    {mode === 'setup' ? t('common:continue', 'Continue')
                      : mode === 'confirm' ? t('lock:confirmPin', 'Confirm')
                      : 'Unlock'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>

              {mode === 'unlock' ? (
                <TouchableOpacity style={s.textLink} activeOpacity={0.7} onPress={() => setShowKeypad(false)}>
                  <Text style={s.textLinkLabel}>Use Face ID instead</Text>
                </TouchableOpacity>
              ) : onCancel && !(forced && mode === 'setup') ? (
                <TouchableOpacity style={s.textLink} activeOpacity={0.7} onPress={onCancel}>
                  <Text style={s.textLinkLabel}>{forced ? 'Back' : 'Cancel'}</Text>
                </TouchableOpacity>
              ) : (
                <View style={{ height: 16 }} />
              )}
            </>
          )}

          {/* Success checkmark overlay */}
          <Animated.View
            pointerEvents="none"
            style={[s.checkWrap, { opacity: checkFade, transform: [{ scale: checkScale }] }]}
          >
            <Ionicons name="checkmark-circle" size={64} color="#22C55E" />
          </Animated.View>
        </Animated.View>
        </ScrollView>

        {/* ── Emergency help sheet (role-themed) ────────────────────────────── */}
        {showEmergency && (
          <View style={s.emgOverlay}>
            <TouchableOpacity style={s.emgBackdrop} activeOpacity={1} onPress={() => setShowEmergency(false)} />
            <View style={s.emgSheet}>
              <View style={s.emgHandle} />

              <View style={[s.emgIcon, { backgroundColor: C.secondaryTint }]}>
                <Ionicons name="medical" size={24} color={C.primary} />
              </View>
              <Text style={s.emgTitle}>Need help right now?</Text>
              <Text style={s.emgSub}>Reach help immediately — no unlock needed.</Text>

              <View style={s.emgList}>
                {emergency ? (
                  <TouchableOpacity
                    style={s.emgRow}
                    activeOpacity={0.8}
                    onPress={() => { setShowEmergency(false); dial(emergency.phone || emergency.phoneNumber); }}
                  >
                    <View style={[s.emgRowIcon, { backgroundColor: C.secondaryTint }]}>
                      <Ionicons name="call" size={19} color={C.primary} />
                    </View>
                    <View style={s.emgRowText}>
                      <Text style={s.emgRowTitle}>Call {emergency.name || 'emergency contact'}</Text>
                      <Text style={s.emgRowSub} numberOfLines={1}>
                        {(emergency.relation ? `${emergency.relation} · ` : '') + (emergency.phone || emergency.phoneNumber)}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  style={s.emgRow}
                  activeOpacity={0.8}
                  onPress={() => { setShowEmergency(false); dial(CRISIS_HELPLINE); }}
                >
                  <View style={[s.emgRowIcon, { backgroundColor: '#FEECEC' }]}>
                    <Ionicons name="pulse" size={19} color="#EF4444" />
                  </View>
                  <View style={s.emgRowText}>
                    <Text style={s.emgRowTitle}>Crisis helpline</Text>
                    <Text style={s.emgRowSub}>Tele-MANAS · {CRISIS_HELPLINE}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={s.emgRow}
                  activeOpacity={0.8}
                  onPress={() => { setShowEmergency(false); Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {}); }}
                >
                  <View style={[s.emgRowIcon, { backgroundColor: '#EEF1FA' }]}>
                    <Ionicons name="mail" size={19} color="#64748B" />
                  </View>
                  <View style={s.emgRowText}>
                    <Text style={s.emgRowTitle}>Email support</Text>
                    <Text style={s.emgRowSub} numberOfLines={1}>{SUPPORT_EMAIL}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={s.emgCancel} activeOpacity={0.8} onPress={() => setShowEmergency(false)}>
                <Text style={s.emgCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </SafeAreaView>
    </AuthBackground>
    </Modal>
  );
};

const s = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 24,
  },
  card: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    alignItems: 'center',
    // Solid white — a translucent card let the mesh tint it, so inner buttons
    // (also near-white) read as a second colour.
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 22,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.10,
    shadowRadius: 28,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  brand: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  secureLabel: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: '#94A3B8',
  },
  // Face-ID landing
  faceRing: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 26,
    marginBottom: 6,
  },
  faceInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.1,
    textAlign: 'center',
    marginTop: 18,
  },
  subtitle: {
    marginTop: 6,
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  primaryBtnWrap: {
    width: '100%',
    marginTop: 18,
  },
  textLink: {
    paddingVertical: 10,
    marginTop: 4,
  },
  textLinkLabel: {
    color: '#64748B',
    fontSize: 13.5,
    fontWeight: '600',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 12,
  },
  primaryBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryBtn: {
    width: '100%',
    height: 46,
    borderRadius: 12,
    backgroundColor: '#F4F6FA',
    borderWidth: 1,
    borderColor: '#E7EAF1',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  secondaryBtnText: {
    color: '#64748B',
    fontSize: 13.5,
    fontWeight: '600',
  },
  emergencyBtn: {
    marginTop: 18,
    paddingVertical: 4,
  },
  emergencyText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  // Keypad
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 34,
    marginTop: 18,
  },
  error: {
    color: '#ef4444',
    fontSize: 12.5,
    fontWeight: '500',
    textAlign: 'center',
    height: 16,
  },
  pad: { width: '100%', alignItems: 'center', marginTop: 6 },
  padRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 4,
  },
  checkWrap: {
    position: 'absolute',
    alignSelf: 'center',
    top: '42%',
  },
  // Emergency sheet
  emgOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  emgBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,23,42,0.45)',
  },
  emgSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 26,
    alignItems: 'center',
  },
  emgHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    marginBottom: 16,
  },
  emgIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emgTitle: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  emgSub: {
    marginTop: 4,
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
  },
  emgList: {
    width: '100%',
    marginTop: 18,
    gap: 10,
  },
  emgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#EEF1F5',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  emgRowIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emgRowText: { flex: 1 },
  emgRowTitle: { fontSize: 14.5, fontWeight: '700', color: '#0F172A' },
  emgRowSub: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  emgCancel: {
    marginTop: 16,
    width: '100%',
    height: 46,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emgCancelText: { fontSize: 14.5, fontWeight: '700', color: '#64748B' },
});

export default AppLockScreen;
