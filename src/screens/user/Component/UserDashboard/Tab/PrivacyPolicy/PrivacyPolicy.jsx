import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const privacyHighlights = [
  {
    icon: 'verified-user',
    label: 'OTP protected',
    value: 'Email and phone changes',
  },
  {
    icon: 'person-outline',
    label: 'Anonymous care identity',
    value: 'Shown to counselors where supported',
  },
  {
    icon: 'lock-outline',
    label: 'Sensitive areas',
    value: 'Chats, calls, appointments, profile',
  },
];

const privacyDataGroups = [
  {
    icon: 'person',
    title: 'Profile and health details',
    text: 'Your name, anonymous display name, age, gender, contact details, photo/avatar, address, emergency contact, basic medical details, and insurance fields are used to maintain your patient profile.',
  },
  {
    icon: 'forum',
    title: 'AI chat and counselor conversations',
    text: 'Messages, quick replies, chat status, attachments, accepted chat sessions, and counselor details are used to provide conversations, continue history, and support rating prompts.',
  },
  {
    icon: 'event-available',
    title: 'Appointments and sessions',
    text: 'Appointment date, time, reason/notes, status, assigned counselor, call metadata, and session history help users and counselors manage care.',
  },
  {
    icon: 'account-balance-wallet',
    title: 'Wallet and transactions',
    text: 'Wallet balance, top-ups, transaction records, generated reports, and related support context are used for payment tracking.',
  },
  {
    icon: 'settings',
    title: 'Location and device context',
    text: 'Location can be captured at signup, login, or manual refresh to verify sessions, support account safety, and improve location-aware care features.',
  },
  {
    icon: 'admin-panel-settings',
    title: 'Security and account access',
    text: 'Login tokens, auth provider, password status, OTP verification, role, and account status are used to keep user and counselor areas separated and protected.',
  },
];

const privacyVisibility = [
  {
    title: 'Visible to you',
    text: 'Your dashboard shows your profile, AI chats, counselor interactions, appointments, wallet, call history, ratings prompts, and location/update controls.',
  },
  {
    title: 'Shared for care',
    text: 'Counselors may see the information needed to manage accepted sessions, appointments, and support conversations. Anonymous identity is used where supported.',
  },
  {
    title: 'Protected by access controls',
    text: 'User and counselor areas are separated by role, active sessions, OTP verification, and authenticated API requests.',
  },
];

const privacyChecklist = [
  'Use your anonymous name for counselor interactions when you do not want your real name displayed.',
  'Keep emergency contact and medical profile details accurate if you choose to fill them in.',
  'Review device permissions for location, camera, and microphone before calls.',
  'Update location manually from Settings/Profile if the login prompt was skipped.',
  'Do not share OTPs, passwords, or sensitive account details inside chat messages.',
  'Use My Profile and Settings to update or review the data stored in your account.',
];

const PrivacyPolicy = ({ onClose, onOpenTab }) => {
  const { t } = useTranslation();

  const openTab = (tab) => {
    if (typeof onOpenTab === 'function') {
      onClose?.();
      onOpenTab(tab);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.headerBtn} hitSlop={12}>
          <MaterialIcons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('settings:privacyPolicy')}</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <MaterialIcons name="lock-outline" size={34} color="#2563eb" />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>MediConeckt privacy center</Text>
            <Text style={styles.heroText}>
              This privacy center explains how MediConeckt uses your profile,
              chat, appointment, wallet, call, location, and security data inside
              this mobile app.
            </Text>
          </View>
        </View>

        <View style={styles.highlightRow}>
          {privacyHighlights.map((item) => (
            <View key={item.label} style={styles.highlightCard}>
              <MaterialIcons name={item.icon} size={22} color="#2563eb" />
              <Text style={styles.highlightLabel}>{item.label}</Text>
              <Text style={styles.highlightValue}>{item.value}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Data used in the app</Text>
        <View style={styles.dataGrid}>
          {privacyDataGroups.map((group) => (
            <View key={group.title} style={styles.dataCard}>
              <View style={styles.dataIcon}>
                <MaterialIcons name={group.icon} size={22} color="#2563eb" />
              </View>
              <Text style={styles.dataTitle}>{group.title}</Text>
              <Text style={styles.dataText}>{group.text}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Who can see what</Text>
        <View style={styles.visibilityList}>
          {privacyVisibility.map((item) => (
            <View key={item.title} style={styles.visibilityCard}>
              <Text style={styles.visibilityTitle}>{item.title}</Text>
              <Text style={styles.visibilityText}>{item.text}</Text>
            </View>
          ))}
        </View>

        <View style={styles.checklistPanel}>
          <Text style={styles.panelTitle}>Your privacy checklist</Text>
          {privacyChecklist.map((item) => (
            <View key={item} style={styles.checkRow}>
              <MaterialIcons name="check-circle" size={18} color="#16a34a" />
              <Text style={styles.checkText}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => openTab('profile')}>
            <Text style={styles.actionText}>Manage profile data</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn} onPress={() => openTab('settings')}>
            <Text style={styles.actionText}>Security settings</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderBottomColor: '#e2e8f0',
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 14,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 16 : 12,
  },
  headerBtn: { width: 40 },
  headerTitle: { color: '#0f172a', fontSize: 17, fontWeight: '800' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 42 },
  hero: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 18,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 18,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  heroCopy: { flex: 1 },
  heroTitle: { color: '#0f172a', fontSize: 20, fontWeight: '900', marginBottom: 6 },
  heroText: { color: '#64748b', fontSize: 13, lineHeight: 20 },
  highlightRow: { gap: 10, marginTop: 16 },
  highlightCard: {
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 14,
  },
  highlightLabel: { color: '#64748b', flex: 0.8, fontSize: 12, fontWeight: '800' },
  highlightValue: { color: '#0f172a', flex: 1.2, fontSize: 13, fontWeight: '800' },
  sectionTitle: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 22,
    textTransform: 'uppercase',
  },
  dataGrid: { gap: 10 },
  dataCard: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 16,
    borderWidth: 1,
    padding: 15,
  },
  dataIcon: {
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    borderRadius: 13,
    height: 40,
    justifyContent: 'center',
    marginBottom: 10,
    width: 40,
  },
  dataTitle: { color: '#0f172a', fontSize: 15, fontWeight: '900', marginBottom: 6 },
  dataText: { color: '#64748b', fontSize: 13, lineHeight: 20 },
  visibilityList: { gap: 10 },
  visibilityCard: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
    borderRadius: 14,
    borderWidth: 1,
    padding: 15,
  },
  visibilityTitle: { color: '#0f172a', fontSize: 14, fontWeight: '900', marginBottom: 5 },
  visibilityText: { color: '#475569', fontSize: 13, lineHeight: 20 },
  checklistPanel: {
    backgroundColor: '#ffffff',
    borderColor: '#e2e8f0',
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 20,
    padding: 16,
  },
  panelTitle: { color: '#0f172a', fontSize: 17, fontWeight: '900', marginBottom: 10 },
  checkRow: { flexDirection: 'row', gap: 9, marginTop: 10 },
  checkText: { color: '#334155', flex: 1, fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 18 },
  actionBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  actionText: { color: '#ffffff', fontSize: 13, fontWeight: '800' },
});

export default PrivacyPolicy;
