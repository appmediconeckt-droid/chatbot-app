import AppVersionFooter from '../../../../components/common/AppVersionFooter';
// Doctor settings — same sections as the web Setting/Setting.jsx:
// Profile, Clinic, Payment, Profile QR, Change Password (POST /auth/changePassword,
// then sign out), Logout, Help & Support, Privacy, Delete Account (DELETE /auth/delete).
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, View } from 'react-native';
import { loadPublicProfileLink } from '../api/doctorPublicProfile';
import Text from '../../../../components/TranslatedText';
import AppIcon from '../icons/AppIcon';
import { createDoctorStyles } from '../theme';
import { useDoctorBack } from '../useDoctorBack';
import axiosInstance from '../../../../axiosConfig';
import DoctorPrivacySecurityScreen from './DoctorPrivacySecurityScreen';
import DoctorNotificationPreferencesScreen from './DoctorNotificationPreferencesScreen';
import DoctorClinicSettingsScreen from './DoctorClinicSettingsScreen';
import DoctorProfileScreen from './DoctorProfileScreen';
import DoctorPaymentSettingsScreen from './DoctorPaymentSettingsScreen';
import DoctorChangePasswordScreen from './DoctorChangePasswordScreen';
import DoctorHelpSupportScreen from './DoctorHelpSupportScreen';
import LanguageSelector from '../../../../components/common/LanguageSelector';
import { LANGUAGES } from '../../../../i18n';
import { useLanguageContext } from '../../../../contexts/LanguageContext';
import { CLINICIAN } from '../../../../theme/palette';
import { getDoctorIdFromUser, getStoredDoctorUser } from '../api/doctorAppointments';

// Grouped as separate cards: your practice, the app and its security, support.
const PRACTICE_ROWS = [
  { key: 'personal', icon: 'user', title: 'Profile', subtitle: 'Professional details, experience and photo' },
  { key: 'clinic', icon: 'briefcase', title: 'Clinic', subtitle: 'Add clinic contact information, location and photos' },
  { key: 'payment', icon: 'smartphone', title: 'Payment', subtitle: 'Choose which payment methods are available' },
  { key: 'profileQR', icon: 'qr', title: 'Profile QR', subtitle: 'Share your profile and booking link' },
];

const APP_ROWS = [
  { key: 'notifications', icon: 'bell', title: 'Notification Preferences', subtitle: 'Choose alerts and set quiet hours' },
  { key: 'language', icon: 'globe', title: 'Language', subtitle: 'Choose the app language' },
  { key: 'privacySecurity', icon: 'shield', title: 'Privacy & Security', subtitle: 'Password, app lock, privacy and this device' },
  { key: 'changePassword', icon: 'lock', title: 'Change Password', subtitle: 'You will be signed out after changing it' },
];

const MORE_ROWS = [
  { key: 'help', icon: 'info', title: 'Help & Support', subtitle: 'FAQs, contact support, report a problem' },
  { key: 'privacy', icon: 'eye', title: 'Privacy Policy', subtitle: 'How your profile and clinic information is used' },
];

const INFO = {
  privacy: {
    title: 'Privacy Policy',
    intro: 'Your doctor profile and clinic information are used to support appointment booking and patient communication.',
    // [title, text, action]: each row opens the matching place (see openInfoAction).
    items: [
      ['Public Information', 'Only profile and clinic details intended for patients are displayed publicly. Tap to see your public profile.', 'publicProfile'],
      ['Account Security', 'Change your password, turn on App Lock and manage this device.', 'privacySecurity'],
    ],
  },
};

export default function DoctorSettingsScreen({ onBack, onLogout, onForceLogout, onOpenCard, navigation }) {
  const [view, setView] = useState('list');
  const [deleting, setDeleting] = useState(false);

  // Language: saved per doctor (same key DoctorDashboard reloads on focus).
  const { language: appLanguage } = useLanguageContext();
  const currentLanguageName = LANGUAGES.find((lang) => lang.code === appLanguage)?.name || 'English';
  const [doctorId, setDoctorId] = useState(null);
  useEffect(() => {
    getStoredDoctorUser().then((user) => {
      const id = getDoctorIdFromUser(user);
      if (id) setDoctorId(String(id));
    });
  }, []);

  // Back from any settings page returns to the settings list, not Home.
  useDoctorBack(() => {
    if (view === 'list') return false;
    setView('list');
    return true;
  });

  const handleLogout = onLogout || (() => {});

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Delete your account?',
      'Your account and all of its data will be permanently deleted. You will be signed out, and this cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(true);
              await axiosInstance.delete('/api/auth/delete');
              Alert.alert('Account deleted', 'Your account has been permanently deleted.');
              onForceLogout?.({ skipServerLogout: true });
            } catch (error) {
              Alert.alert(
                'Could not delete account',
                error?.response?.data?.message || 'Something went wrong. Please try again.',
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  const back = () => setView('list');

  // Privacy page rows: "Public Information" opens the doctor's public profile
  // (the page patients reach from the QR code); "Account Security" opens
  // Privacy & Security (password, App Lock, this device).
  const openInfoAction = (action) => {
    if (action === 'privacySecurity') {
      setView('privacySecurity');
      return;
    }
    if (action === 'publicProfile') {
      getStoredDoctorUser()
        .then((stored) => loadPublicProfileLink(stored))
        .then((url) => Linking.openURL(url))
        .catch((err) => Alert.alert('Public profile', err?.message || 'Could not open your public profile.'));
    }
  };

  if (view === 'privacySecurity') {
    return (
      <DoctorPrivacySecurityScreen
        onBack={back}
        navigation={navigation}
        onLogout={onLogout}
        onForceLogout={onForceLogout}
      />
    );
  }
  if (view === 'notifications') return <DoctorNotificationPreferencesScreen onBack={back} />;
  if (view === 'help') {
    return (
      <DoctorHelpSupportScreen
        onBack={back}
        onOpenNotifications={() => setView('notifications')}
        onOpenPrivacySecurity={() => setView('privacySecurity')}
      />
    );
  }
  if (view === 'clinic') return <DoctorClinicSettingsScreen onBack={back} />;
  if (view === 'payment') return <DoctorPaymentSettingsScreen onBack={back} />;
  if (view === 'personal') return <DoctorProfileScreen onBack={back} onOpenCard={onOpenCard} />;
  if (view === 'changePassword') {
    return (
      <DoctorChangePasswordScreen
        onBack={back}
        onPasswordChanged={() => {
          Alert.alert('Password changed', 'Password changed successfully. Please sign in again.');
          onForceLogout?.();
        }}
      />
    );
  }
  if (INFO[view]) {
    const info = INFO[view];
    return (
      <View style={s.screen}>
        <View style={s.header}>
          <Pressable onPress={back} style={s.backButton} hitSlop={8}>
            <AppIcon name="chevron-left" size={22} color="#1F2937" strokeWidth={2.4} />
          </Pressable>
          <Text style={s.title}>{info.title}</Text>
        </View>
        <ScrollView contentContainerStyle={s.content}>
          <Text style={s.infoIntro}>{info.intro}</Text>
          <View style={s.card}>
            {info.items.map(([title, text, action], index) => (
              <Pressable
                key={title}
                onPress={action ? () => openInfoAction(action) : undefined}
                disabled={!action}
                style={[s.row, index === info.items.length - 1 && s.rowLast]}
              >
                <View style={s.rowBody}>
                  <Text style={s.rowTitle}>{title}</Text>
                  <Text style={s.rowSubtitle}>{text}</Text>
                </View>
                {!!action && <AppIcon name="chevron-right" size={18} color="#9AA6B8" strokeWidth={2} />}
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>
    );
  }

  const open = (key) => {
    if (key === 'profileQR') return onOpenCard?.();
    return setView(key);
  };

  const renderLanguageRow = (row, index, rows) => (
    <LanguageSelector
      key={row.key}
      userId={doctorId}
      role="doctor"
      brand={CLINICIAN.primary}
      triggerStyle={[s.row, index === rows.length - 1 && s.rowLast]}
    >
      <View style={s.rowIcon}>
        <AppIcon name={row.icon} size={19} color="#0D9488" strokeWidth={1.9} />
      </View>
      <View style={s.rowBody}>
        <Text style={s.rowTitle}>{row.title}</Text>
        <Text style={s.rowSubtitle}>{row.subtitle}</Text>
      </View>
      <Text style={s.rowValue} numberOfLines={1} translate={false}>{currentLanguageName}</Text>
      <AppIcon name="chevron-right" size={18} color="#9AA6B8" strokeWidth={2} />
    </LanguageSelector>
  );

  const renderRows = (rows) => rows.map((row, index) => (row.key === 'language' ? renderLanguageRow(row, index, rows) : (
    <Pressable key={row.key} onPress={() => open(row.key)} style={[s.row, index === rows.length - 1 && s.rowLast]}>
      <View style={s.rowIcon}>
        <AppIcon name={row.icon} size={19} color="#0D9488" strokeWidth={1.9} />
      </View>
      <View style={s.rowBody}>
        <Text style={s.rowTitle}>{row.title}</Text>
        <Text style={s.rowSubtitle}>{row.subtitle}</Text>
      </View>
      <AppIcon name="chevron-right" size={18} color="#9AA6B8" strokeWidth={2} />
    </Pressable>
  )));

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backButton} hitSlop={8}>
          <AppIcon name="chevron-left" size={22} color="#1F2937" strokeWidth={2.4} />
        </Pressable>
        <Text style={s.title}>Settings</Text>
      </View>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.section}>Account Settings</Text>
        <View style={s.card}>{renderRows(PRACTICE_ROWS)}</View>
        <View style={[s.card, s.cardSpaced]}>{renderRows(APP_ROWS)}</View>
        <View style={[s.card, s.cardSpaced]}>{renderRows(MORE_ROWS)}</View>
        {/* Logout and Delete Account last, away from everyday rows. */}
        <Pressable onPress={handleLogout} style={s.logout}>
          <AppIcon name="logout" size={17} color="#DC2626" strokeWidth={2} />
          <Text style={s.logoutText}>Logout</Text>
        </Pressable>
        <View style={[s.dangerCard, s.cardSpaced]}>
          <View style={s.dangerHeader}>
            <View style={s.dangerIcon}>
              <AppIcon name="warning" size={19} color="#DC2626" strokeWidth={2} />
            </View>
            <View style={s.rowBody}>
              <Text style={s.dangerTitle}>Delete Account</Text>
              <Text style={s.dangerText}>
                Permanently delete your account and all of its data. This action cannot be undone.
              </Text>
            </View>
          </View>
          <Pressable
            onPress={confirmDeleteAccount}
            disabled={deleting}
            style={({ pressed }) => [s.deleteBtn, pressed && s.deleteBtnPressed, deleting && s.deleteBtnDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Delete account"
            accessibilityState={{ disabled: deleting, busy: deleting }}
          >
            {deleting ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <AppIcon name="trash" size={17} color="#FFF" strokeWidth={2} />
            )}
            <Text style={s.deleteText}>{deleting ? 'Deleting account...' : 'Delete Account'}</Text>
          </Pressable>
        </View>
        <AppVersionFooter />
      </ScrollView>
    </View>
  );
}

const s = createDoctorStyles({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { height: 62, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#D8DFE9', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F1F4F8', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  title: { fontSize: 22, fontWeight: '800', color: '#0D9488' },
  content: { padding: 16, paddingBottom: 36 },
  section: { fontSize: 13, fontWeight: '700', letterSpacing: 0.4, color: '#667085', marginBottom: 10, marginLeft: 2, textTransform: 'uppercase' },
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
  rowIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#DCFCFF', alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: '#17243A' },
  rowSubtitle: { fontSize: 12.5, color: '#667085', marginTop: 2 },
  rowValue: { fontSize: 12.5, fontWeight: '700', color: '#0F766E', maxWidth: 110, marginLeft: 6 },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderWidth: 1.5,
    borderColor: '#FCA5A5',
    borderRadius: 12,
    backgroundColor: '#FFF',
    marginTop: 22,
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: '#DC2626' },
  cardSpaced: { marginTop: 20 },
  infoIntro: { fontSize: 14, lineHeight: 20, color: '#475467', marginBottom: 14 },
  dangerCard: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#7F1D1D',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  dangerHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  dangerIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
  dangerTitle: { fontSize: 15, fontWeight: '700', color: '#17243A' },
  dangerText: { fontSize: 12.5, lineHeight: 18, color: '#667085', marginTop: 2 },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#DC2626',
    marginTop: 14,
  },
  deleteBtnPressed: { backgroundColor: '#B91C1C' },
  deleteBtnDisabled: { opacity: 0.7 },
  deleteText: { fontSize: 15, fontWeight: '700', color: '#FFF' },
});
