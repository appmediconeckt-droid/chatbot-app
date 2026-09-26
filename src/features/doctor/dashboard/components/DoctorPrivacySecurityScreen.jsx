// Doctor Privacy & Security. Every row does something real:
//   Change Password  → DoctorChangePasswordScreen (signs out after a change)
//   App Lock         → the shared AppLockSettings screen (PIN + biometrics),
//                      which App.tsx enforces on launch / resume for every role
//   Privacy Policy   → the Humaeli privacy policy
//   Data requests    → email draft to support (there is no export API)
//   This Device      → the backend allows one signed-in device per account,
//                      so the only session to manage is this one.
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppIcon from '../icons/AppIcon';
import { useToast } from '../../../../components/common/ToastProvider';
import { createDoctorStyles } from '../theme';
import { CLINICIAN } from '../../../../theme/palette';
import { APP_VERSION } from '../../../../constants/appInfo';
import { DOCTOR_PRIVACY_CONTENT } from '../doctorPrivacyContent';
import { useDoctorBack } from '../useDoctorBack';
import DoctorChangePasswordScreen from './DoctorChangePasswordScreen';
import CounselorPrivacyPolicy from '../../../counselor/screens/CounselorPrivacyPolicy';
import { isBiometricAvailable } from '../../../../utils/biometrics';

const SUPPORT_EMAIL = 'support@humaeli.com';
// Same keys AppLockSettings / AppLockScreen use.
const PIN_STORAGE_KEY = 'appLockPin';
const BIOMETRIC_ENABLED_KEY = 'appLockBiometricEnabled';

const deviceLabel = Platform.OS === 'ios' ? 'This iPhone' : Platform.OS === 'android' ? 'This Android phone' : 'This device';

export default function DoctorPrivacySecurityScreen({ onBack, navigation, onLogout, onForceLogout }) {
  const { showToast } = useToast();
  const [view, setView] = useState('list');
  const [lockStatus, setLockStatus] = useState({ pin: false, biometric: false, biometricAvailable: false });

  const refreshLockStatus = useCallback(async () => {
    try {
      const [pin, bio, availability] = await Promise.all([
        AsyncStorage.getItem(PIN_STORAGE_KEY),
        AsyncStorage.getItem(BIOMETRIC_ENABLED_KEY),
        isBiometricAvailable().catch(() => ({ available: false })),
      ]);
      setLockStatus({ pin: Boolean(pin), biometric: bio === 'true', biometricAvailable: Boolean(availability?.available) });
    } catch {
      // Leave the last known status.
    }
  }, []);

  // App Lock is a stack screen above the dashboard — re-read when we're back.
  useEffect(() => {
    refreshLockStatus();
    const unsubscribe = navigation?.addListener?.('focus', refreshLockStatus);
    return () => unsubscribe?.();
  }, [navigation, refreshLockStatus]);

  useDoctorBack(() => {
    if (view === 'list') return false;
    setView('list');
    return true;
  });

  if (view === 'changePassword') {
    return (
      <DoctorChangePasswordScreen
        onBack={() => setView('list')}
        onPasswordChanged={() => {
          Alert.alert('Password changed', 'Password changed successfully. Please sign in again.');
          onForceLogout?.();
        }}
      />
    );
  }

  if (view === 'privacyPolicy') {
    return (
      <CounselorPrivacyPolicy
        onClose={() => setView('list')}
        palette={CLINICIAN}
        // The dashboard already wraps this screen in a SafeAreaView.
        safeAreaEdges={[]}
        footerLabel={`Humaeli Doctor · Version ${APP_VERSION}`}
        emailSubject="Privacy question - Humaeli Doctor"
        content={DOCTOR_PRIVACY_CONTENT}
      />
    );
  }

  const openAppLock = () => {
    if (!navigation?.navigate) return showToast('App Lock is not available here');
    return navigation.navigate('AppLockSettings');
  };

  const emailSupport = async (subject, body) => {
    const email = (await AsyncStorage.getItem('userEmail').catch(() => null)) || '';
    const fullBody = `${body}\n\nAccount email: ${email || '(not available)'}`;
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(fullBody)}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('No email app', `Please email ${SUPPORT_EMAIL} with the subject "${subject}".`);
    });
  };

  const requestDataExport = () => {
    Alert.alert(
      'Request Data Export',
      'This opens an email to Humaeli support asking for a copy of your account data. Support will reply to your account email.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => emailSupport('Data export request', 'Hello, please send me a copy of the data associated with my doctor account.'),
        },
      ],
    );
  };

  const lockSubtitle = !lockStatus.pin
    ? 'Off — require a PIN to open the app'
    : lockStatus.biometric
      ? 'On — PIN + fingerprint / face'
      : lockStatus.biometricAvailable
        ? 'On — PIN (biometrics available)'
        : 'On — PIN';

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backButton} hitSlop={8}>
          <AppIcon name="chevron-left" size={22} color="#1F2937" strokeWidth={2.4} />
        </Pressable>
        <Text style={s.title}>Privacy & Security</Text>
      </View>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

        <Section label="Login Security">
          <Row
            icon="lock"
            title="Change Password"
            subtitle="You'll be signed out after changing it"
            onPress={() => setView('changePassword')}
          />
          <Row
            icon="fingerprint"
            title="App Lock"
            subtitle={lockSubtitle}
            badge={lockStatus.pin ? 'ON' : 'OFF'}
            badgeOn={lockStatus.pin}
            last
            onPress={openAppLock}
          />
        </Section>

        <Section label="Privacy">
          <Row
            icon="file"
            title="Privacy Policy"
            subtitle="How Humaeli collects, uses and protects data"
            onPress={() => setView('privacyPolicy')}
          />
          <Row
            icon="download"
            title="Request Data Export"
            subtitle="Ask support for a copy of your account data"
            onPress={requestDataExport}
          />
          <Row
            icon="mail"
            title="Privacy Questions"
            subtitle={SUPPORT_EMAIL}
            last
            onPress={() => emailSupport('Privacy question - Doctor account', 'Hello,')}
          />
        </Section>

        <Section label="This Device">
          <View style={[s.row, s.rowLast]}>
            <View style={s.rowIcon}>
              <AppIcon name="smartphone" size={18} color="#0D9488" strokeWidth={1.9} />
            </View>
            <View style={s.rowBody}>
              <Text style={s.rowTitle}>{deviceLabel}</Text>
              <View style={s.currentBadge}><Text style={s.currentBadgeText}>Current Session</Text></View>
            </View>
          </View>
        </Section>
        <Text style={s.note}>
          Your account stays signed in on one device at a time. Signing in on another device automatically signs this one out.
        </Text>

        <Pressable onPress={onLogout} style={s.logoutBtn}>
          <AppIcon name="logout" size={17} color="#FFF" strokeWidth={2} />
          <Text style={s.logoutText}>Log Out of This Device</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Section({ label, children }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionLabel}>{label}</Text>
      <View style={s.card}>{children}</View>
    </View>
  );
}

function Row({ icon, title, subtitle, last, onPress, badge, badgeOn }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.row, last && s.rowLast, pressed && s.rowPressed]}>
      <View style={s.rowIcon}>
        <AppIcon name={icon} size={18} color="#0D9488" strokeWidth={1.9} />
      </View>
      <View style={s.rowBody}>
        <Text style={s.rowTitle}>{title}</Text>
        <Text style={s.rowSubtitle}>{subtitle}</Text>
      </View>
      {!!badge && (
        <View style={[s.badge, badgeOn ? s.badgeOn : s.badgeOff]}>
          <Text style={[s.badgeText, badgeOn ? s.badgeTextOn : s.badgeTextOff]}>{badge}</Text>
        </View>
      )}
      <AppIcon name="chevron-right" size={18} color="#9AA6B8" strokeWidth={2} />
    </Pressable>
  );
}

const s = createDoctorStyles({
  screen: { flex: 1, backgroundColor: '#F0FDFA' },
  header: { height: 62, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#D8DFE9', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F1F4F8', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  title: { fontSize: 19, fontWeight: '800', color: '#0D9488' },
  content: { padding: 16, paddingBottom: 36 },
  section: { marginBottom: 18 },
  sectionLabel: { fontSize: 13, fontWeight: '700', letterSpacing: 0.4, color: '#667085', marginBottom: 10, marginLeft: 2, textTransform: 'uppercase' },
  card: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#C8D1DF',
    borderRadius: 14,
    shadowColor: '#17243A',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#EEF1F5', gap: 12 },
  rowLast: { borderBottomWidth: 0 },
  rowPressed: { backgroundColor: '#F7F9FC' },
  rowIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#DCFCFF', alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: '#17243A' },
  rowSubtitle: { fontSize: 12.5, color: '#667085', marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeOn: { backgroundColor: '#D9FAE8' },
  badgeOff: { backgroundColor: '#F1F4F8' },
  badgeText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  badgeTextOn: { color: '#139A5B' },
  badgeTextOff: { color: '#667085' },
  currentBadge: { alignSelf: 'flex-start', backgroundColor: '#D9FAE8', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 },
  currentBadgeText: { fontSize: 11.5, fontWeight: '700', color: '#139A5B' },
  note: { fontSize: 12.5, lineHeight: 18, color: '#667085', marginTop: -8, marginBottom: 16, marginHorizontal: 2 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 12, backgroundColor: '#DC2626' },
  logoutText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});
