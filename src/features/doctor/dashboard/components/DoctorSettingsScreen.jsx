// Doctor settings — same sections as the web Setting/Setting.jsx:
// Profile, Clinic, Payment, Profile QR, Change Password (POST /auth/changePassword,
// then sign out), Logout, Help & Support, Privacy, Delete Account (DELETE /auth/delete).
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import AppIcon from '../icons/AppIcon';
import { createDoctorStyles } from '../theme';
import axiosInstance from '../../../../axiosConfig';
import DoctorPrivacySecurityScreen from './DoctorPrivacySecurityScreen';
import DoctorNotificationPreferencesScreen from './DoctorNotificationPreferencesScreen';
import DoctorClinicSettingsScreen from './DoctorClinicSettingsScreen';
import DoctorProfileScreen from './DoctorProfileScreen';
import DoctorPaymentSettingsScreen from './DoctorPaymentSettingsScreen';
import DoctorChangePasswordScreen from './DoctorChangePasswordScreen';

const ACCOUNT_ROWS = [
  { key: 'personal', icon: 'user', title: 'Profile', subtitle: 'Professional details, experience and photo' },
  { key: 'clinic', icon: 'briefcase', title: 'Clinic', subtitle: 'Add clinic contact information, location and photos' },
  { key: 'payment', icon: 'smartphone', title: 'Payment', subtitle: 'Choose which payment methods are available' },
  { key: 'profileQR', icon: 'qr', title: 'Profile QR', subtitle: 'Share your profile and booking link' },
  { key: 'notifications', icon: 'bell', title: 'Notification Preferences', subtitle: 'Manage alerts for appointments and messages' },
  { key: 'privacySecurity', icon: 'shield', title: 'Privacy & Security', subtitle: 'Two-factor authentication, devices' },
  { key: 'changePassword', icon: 'lock', title: 'Change Password', subtitle: 'You will be signed out after changing it' },
];

const MORE_ROWS = [
  { key: 'help', icon: 'info', title: 'Help & Support', subtitle: 'What each settings section is for' },
  { key: 'privacy', icon: 'eye', title: 'Privacy', subtitle: 'How your profile and clinic information is used' },
];

const INFO = {
  help: {
    title: 'Help & Support',
    intro: 'Use these settings to keep your doctor profile, clinic details, payment options, and QR profile updated.',
    items: [
      ['Profile', 'Update professional details, education, experience, awards, and availability.'],
      ['Clinic', 'Add clinic contact information, location, and photos for patients.'],
      ['Payment', 'Choose which payment methods are available for appointments.'],
    ],
  },
  privacy: {
    title: 'Privacy',
    intro: 'Your doctor profile and clinic information are used to support appointment booking and patient communication.',
    items: [
      ['Public Information', 'Only profile and clinic details intended for patients are displayed publicly.'],
      ['Account Security', 'Change your password regularly and log out from shared devices.'],
    ],
  },
};

export default function DoctorSettingsScreen({ onBack, onLogout, onForceLogout, onOpenCard }) {
  const [view, setView] = useState('list');
  const [deleting, setDeleting] = useState(false);

  const handleLogout = onLogout || (() => {});

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This permanently deletes your account. This cannot be undone. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(true);
              await axiosInstance.delete('/api/auth/delete');
              Alert.alert('Account deleted', 'Your account has been deleted.');
              onForceLogout?.({ skipServerLogout: true });
            } catch (error) {
              Alert.alert('Error', error?.response?.data?.message || 'Account delete failed');
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  const back = () => setView('list');
  if (view === 'privacySecurity') return <DoctorPrivacySecurityScreen onBack={back} />;
  if (view === 'notifications') return <DoctorNotificationPreferencesScreen onBack={back} />;
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
            {info.items.map(([title, text], index) => (
              <View key={title} style={[s.row, index === info.items.length - 1 && s.rowLast]}>
                <View style={s.rowBody}>
                  <Text style={s.rowTitle}>{title}</Text>
                  <Text style={s.rowSubtitle}>{text}</Text>
                </View>
              </View>
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

  const renderRows = (rows) => rows.map((row, index) => (
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
  ));

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
        <View style={s.card}>{renderRows(ACCOUNT_ROWS)}</View>
        <Pressable onPress={handleLogout} style={s.logout}>
          <AppIcon name="logout" size={17} color="#DC2626" strokeWidth={2} />
          <Text style={s.logoutText}>Log Out</Text>
        </Pressable>
        <Text style={[s.section, s.sectionSpaced]}>More</Text>
        <View style={s.card}>{renderRows(MORE_ROWS)}</View>
        <Pressable onPress={confirmDeleteAccount} style={s.deleteBtn} disabled={deleting}>
          <Text style={s.deleteText}>{deleting ? 'Deleting...' : 'Delete Account'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const s = createDoctorStyles({
  screen: { flex: 1, backgroundColor: '#F0FDFA' },
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
  sectionSpaced: { marginTop: 24 },
  infoIntro: { fontSize: 14, lineHeight: 20, color: '#475467', marginBottom: 14 },
  deleteBtn: { alignItems: 'center', justifyContent: 'center', height: 46, marginTop: 16 },
  deleteText: { fontSize: 14, fontWeight: '700', color: '#DC2626', textDecorationLine: 'underline' },
});
