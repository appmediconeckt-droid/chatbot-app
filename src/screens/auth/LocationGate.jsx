import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Linking,
  Platform,
  ActivityIndicator,
  StatusBar,
  ScrollView,
} from 'react-native';
import Text from '../../components/TranslatedText';
import { PermissionsAndroid } from 'react-native';
import { captureAndSendLocation } from '../../utils/locationHelper';
import useLanguageRender from '../../hooks/useLanguageRender';

const checkLocationPermission = async () => {
  if (Platform.OS !== 'android') return 'granted';
  try {
    const fine = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );
    const coarse = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    );
    return fine || coarse ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
};

const requestLocationPermission = async () => {
  if (Platform.OS !== 'android') return 'granted';
  try {
    const result = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    ]);
    const fine = result[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
    const coarse = result[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION];

    if (
      fine === PermissionsAndroid.RESULTS.GRANTED ||
      coarse === PermissionsAndroid.RESULTS.GRANTED
    ) return 'granted';

    if (
      fine === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ||
      coarse === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
    ) return 'never_ask_again';

    return 'denied';
  } catch {
    return 'denied';
  }
};

const REASONS = [
  {
    icon: '📍',
    title: 'Match you with nearby consultants',
    body: 'We use your location to show consultants available in your area for faster, better support.',
  },
  {
    icon: '🔒',
    title: 'Keep your account secure',
    body: 'Location helps us detect suspicious logins and protect your account from unauthorised access.',
  },
  {
    icon: '🚨',
    title: 'Emergency support',
    body: 'In a crisis, your location lets us direct emergency services to you instantly.',
  },
];

// phase: idle | requesting | locating | denied | never_ask_again
const LocationGate = ({ navigation, route }) => {
  const { t } = useLanguageRender();
  const { destination, destinationParams = {} } = route.params;

  // Role → theme: counselor = blue, user = green (matches the rest of the app).
  // The destination name tells us the role, so no extra param is needed.
  const isCounselor = /counsel/i.test(String(destination || ''));
  const reasons = isCounselor
    ? [
        {
          icon: '📍',
          title: 'Help nearby patients find you',
          body: 'We use your location to show your profile to patients looking for consultants in your area.',
        },
        ...REASONS.slice(1),
      ]
    : REASONS;
  const C = isCounselor
    ? { bg: '#EFF4FE', blob1: '#C3D8FB', blob2: '#A8C6F8', primary: '#004AC6', primaryDark: '#003A9B', headline: '#0B2A6B' }
    : { bg: '#F0FDF4', blob1: '#BBF7D0', blob2: '#A7F3D0', primary: '#059669', primaryDark: '#047857', headline: '#064E3B' };

  const [phase, setPhase] = useState('idle');
  const [attempt, setAttempt] = useState(0);

  const pulse = useRef(new Animated.Value(1)).current;
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (phase === 'locating' || phase === 'requesting') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.18, duration: 600, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulse.setValue(1);
    }
  }, [phase, pulse]);

  // Shake animation when user tries to skip after denial
  const triggerShake = () => {
    shakeAnim.setValue(0);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  // On mount: if permission already granted, capture & proceed silently.
  useEffect(() => {
    (async () => {
      const status = await checkLocationPermission();
      if (status === 'granted') {
        captureAndProceed();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const captureAndProceed = async () => {
    setPhase('locating');
    try {
      await captureAndSendLocation('login');
    } catch (err) {
      console.warn('[LocationGate] location capture failed:', err?.message);
    }
    navigation.replace(destination, destinationParams);
  };

  const handleAllow = async () => {
    setPhase('requesting');
    const result = await requestLocationPermission();

    if (result === 'granted') {
      await captureAndProceed();
    } else if (result === 'never_ask_again') {
      setPhase('never_ask_again');
    } else {
      setAttempt((n) => n + 1);
      setPhase('denied');
    }
  };

  // User skips — go to dashboard WITHOUT location, but only after at least one attempt.
  // On the very first idle state we don't show skip yet (give 1 persuasion round).
  const handleSkip = () => {
    navigation.replace(destination, destinationParams);
  };

  const handleOpenSettings = () => {
    Linking.openSettings();
  };

  const isWorking = phase === 'requesting' || phase === 'locating';

  // Show skip only after the user has denied at least once OR on never_ask_again
  const canSkip = attempt >= 1 || phase === 'never_ask_again';

  // ─── Render helpers ──────────────────────────────────────────────────────

  const renderReasons = () =>
    reasons.map((r, i) => (
      <View key={i} style={styles.reasonRow}>
        <Text style={styles.reasonIcon}>{r.icon}</Text>
        <View style={styles.reasonText}>
          <Text style={styles.reasonTitle}>{t(r.title)}</Text>
          <Text style={styles.reasonBody}>{r.body}</Text>
        </View>
      </View>
    ));

  const renderWarningBanner = () => {
    if (phase !== 'denied' && phase !== 'never_ask_again') return null;
    const isHard = phase === 'never_ask_again';
    return (
      <Animated.View
        style={[styles.deniedBanner, { transform: [{ translateX: shakeAnim }] }]}
      >
        <Text style={styles.deniedIcon}>⚠️</Text>
        <Text style={styles.deniedText}>
          {isHard
            ? 'Location was permanently blocked. Open Settings → enable Location for this app, then come back.'
            : isCounselor
            ? attempt === 1
              ? 'Without location access, nearby patients may not find your profile and location-based account security will be limited. Please allow it.'
              : 'Location is still blocked. Features like local profile visibility and location-based security will not work properly.'
            : attempt === 1
            ? 'Without location access you\'ll miss nearby consultants, account security alerts, and emergency support. Please allow it.'
            : 'Location is still blocked. Features like nearby consultants and emergency support won\'t work properly.'}
        </Text>
      </Animated.View>
    );
  };

  const renderPrimaryButton = () => {
    if (phase === 'never_ask_again') {
      return (
        <TouchableOpacity style={[styles.btnPrimary, { backgroundColor: C.primary, shadowColor: C.primary }]} onPress={handleOpenSettings}>
          <Text style={styles.btnPrimaryText}>{t('Open Settings')}</Text>
        </TouchableOpacity>
      );
    }
    return (
      <TouchableOpacity
        style={[styles.btnPrimary, { backgroundColor: C.primary, shadowColor: C.primary }, isWorking && styles.btnDisabled]}
        onPress={handleAllow}
        disabled={isWorking}
      >
        {isWorking ? (
          <View style={styles.btnRow}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={[styles.btnPrimaryText, { marginLeft: 10 }]}>
              {phase === 'requesting' ? 'Requesting…' : 'Getting location…'}
            </Text>
          </View>
        ) : (
          <Text style={styles.btnPrimaryText}>
            {phase === 'denied' ? t('🔄  Try Again') : t('📍  Allow Location Access')}
          </Text>
        )}
      </TouchableOpacity>
    );
  };

  const renderSkipButton = () => {
    if (!canSkip || isWorking) return null;
    return (
      <TouchableOpacity style={styles.btnSkip} onPress={handleSkip}>
        <Text style={styles.btnSkipText}>{t('Continue without location')}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: C.bg }]}>
      <StatusBar barStyle="dark-content" backgroundColor={C.bg} />

      <View style={[styles.blobTopRight, { backgroundColor: C.blob1 }]} />
      <View style={[styles.blobBottomLeft, { backgroundColor: C.blob2 }]} />

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Pulsing pin icon */}
        <Animated.View style={[styles.pinCircle, { shadowColor: C.primaryDark, transform: [{ scale: pulse }] }]}>
          <Text style={styles.pinEmoji}>📍</Text>
        </Animated.View>

        <Text style={[styles.headline, { color: C.headline }]}>
          {phase === 'denied' || phase === 'never_ask_again'
            ? t('Location Recommended') : t('Enable Location')}
        </Text>
        <Text style={styles.subheadline}>
          {phase === 'denied' || phase === 'never_ask_again'
            ? 'Some features won\'t work without location. We strongly recommend enabling it.'
            : 'For the best experience, allow location access. It helps us serve you better and keep you safe.'}
        </Text>

        {/* Why we need it */}
        <View style={styles.reasonsCard}>
          <Text style={styles.reasonsTitle}>{t('Why we need your location')}</Text>
          {renderReasons()}
        </View>

        {/* Privacy note */}
        <Text style={styles.privacy}>
          🔐 Your location is only used while you're using the app. It is never sold or shared with third parties.
        </Text>

        {renderWarningBanner()}
        {renderPrimaryButton()}
        {renderSkipButton()}

        {/* Soft nudge note — only when skip is available */}
        {canSkip && !isWorking && (
          <Text style={styles.nudgeNote}>
            Skipping will limit your experience. You can enable location anytime in Settings.
          </Text>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0fdf4',
    overflow: 'hidden',
  },
  blobTopRight: {
    position: 'absolute',
    top: -100,
    right: -80,
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: '#bbf7d0',
    opacity: 0.55,
  },
  blobBottomLeft: {
    position: 'absolute',
    bottom: -120,
    left: -90,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: '#a7f3d0',
    opacity: 0.4,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 70,
    paddingBottom: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8,
  },
  pinEmoji: {
    fontSize: 46,
  },
  headline: {
    fontSize: 28,
    fontWeight: '800',
    color: '#064e3b',
    textAlign: 'center',
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  subheadline: {
    fontSize: 15,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  reasonsCard: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  reasonsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  reasonIcon: {
    fontSize: 22,
    marginRight: 12,
    marginTop: 1,
  },
  reasonText: {
    flex: 1,
  },
  reasonTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  reasonBody: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 19,
  },
  privacy: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
    paddingHorizontal: 8,
  },
  deniedBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#fcd34d',
    gap: 10,
  },
  deniedIcon: {
    fontSize: 18,
    marginTop: 1,
  },
  deniedText: {
    flex: 1,
    fontSize: 13,
    color: '#92400e',
    lineHeight: 19,
    fontWeight: '600',
  },
  btnPrimary: {
    width: '100%',
    backgroundColor: '#059669',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
    marginBottom: 12,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  btnPrimaryText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  btnSkip: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    backgroundColor: 'transparent',
    marginBottom: 10,
  },
  btnSkipText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '600',
  },
  nudgeNote: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 17,
    paddingHorizontal: 16,
  },
});

export default LocationGate;
