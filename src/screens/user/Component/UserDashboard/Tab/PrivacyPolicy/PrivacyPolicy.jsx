import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Platform,
  StatusBar,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const APP_NAME = 'Mediconeckt';
const SUPPORT_EMAIL = 'app.mediconeckt@gmail.com';
const LAST_UPDATED = 'May 2026';

const SECTIONS = [
  {
    icon: 'info-outline',
    color: '#3b82f6',
    bg: '#eff6ff',
    title: '1. Introduction',
    body: `${APP_NAME} ("we", "our", or "us") is committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application.\n\nBy using ${APP_NAME}, you agree to the collection and use of information in accordance with this policy. If you do not agree with the terms of this policy, please do not use the app.`,
  },
  {
    icon: 'storage',
    color: '#10b981',
    bg: '#f0fdf4',
    title: '2. Information We Collect',
    body: `We collect the following types of information:\n\n• Personal Identification: Name, email address, phone number, date of birth, gender, and profile photo.\n\n• Anonymous Identity: A randomly generated anonymous username used when interacting with counselors to protect your real identity.\n\n• Location Data: Approximate location to match you with nearby counselors and for account security. Only collected when the app is in use.\n\n• Device Information: Device type, operating system, app version, and unique device identifiers for diagnostic and security purposes.\n\n• Usage Data: Pages visited, features used, session duration, and interaction patterns to improve our services.\n\n• Communication Data: Messages, call logs (not recordings), and appointment records within the platform.`,
  },
  {
    icon: 'psychology',
    color: '#8b5cf6',
    bg: '#f5f3ff',
    title: '3. How We Use Your Information',
    body: `We use the information we collect to:\n\n• Provide, operate, and maintain the ${APP_NAME} platform.\n• Match you with suitable counselors based on your preferences and location.\n• Process appointments, payments, and session management.\n• Send notifications, reminders, and service updates.\n• Detect and prevent fraud, unauthorized access, and security threats.\n• Improve our app, features, and user experience through analytics.\n• Comply with applicable legal obligations.\n• Respond to support requests and communicate with you about your account.`,
  },
  {
    icon: 'lock',
    color: '#f59e0b',
    bg: '#fffbeb',
    title: '4. Anonymity & Counselor Interactions',
    body: `Your privacy during counseling sessions is paramount:\n\n• You are identified to counselors only by your anonymous username — never your real name, photo, email, or phone number.\n• Counselors cannot access your personal contact details under any circumstance.\n• Your real identity is protected at all times during chats, voice calls, and video calls.\n• Session content is confidential and is not shared with third parties except where required by law (e.g., imminent risk of harm).`,
  },
  {
    icon: 'share',
    color: '#ef4444',
    bg: '#fef2f2',
    title: '5. Sharing of Information',
    body: `We do not sell, trade, or rent your personal information. We may share information only in the following circumstances:\n\n• Service Providers: Trusted third-party vendors (e.g., payment processors, cloud storage, communication APIs) who assist in operating our platform under strict confidentiality agreements.\n• Legal Requirements: When required by law, court order, or governmental authority.\n• Safety: To protect the safety, rights, or property of ${APP_NAME}, our users, or the public in emergency situations.\n• Business Transfers: In the event of a merger, acquisition, or sale of assets, your information may be transferred with prior notice.\n\nWe require all third parties to maintain the security of your personal information.`,
  },
  {
    icon: 'security',
    color: '#06b6d4',
    bg: '#ecfeff',
    title: '6. Data Security',
    body: `We implement industry-standard security measures to protect your information:\n\n• All data is transmitted using SSL/TLS encryption.\n• Passwords are hashed and never stored in plain text.\n• Sensitive operations (email/phone changes) require OTP verification.\n• We conduct regular security audits and vulnerability assessments.\n• Access to user data within our team is restricted on a need-to-know basis.\n\nDespite these measures, no method of transmission over the internet is 100% secure. We encourage you to use strong passwords and keep your login credentials confidential.`,
  },
  {
    icon: 'location-on',
    color: '#ec4899',
    bg: '#fdf2f8',
    title: '7. Location Data',
    body: `We request location permission to:\n\n• Show you counselors available in your area.\n• Add an additional layer of account security by detecting unusual login locations.\n• Enable emergency support features.\n\nLocation is collected only while the app is actively in use and is not stored permanently. You can disable location access in your device settings at any time, though some features may be limited as a result.`,
  },
  {
    icon: 'child-care',
    color: '#f97316',
    bg: '#fff7ed',
    title: '8. Children\'s Privacy',
    body: `${APP_NAME} is not intended for use by individuals under the age of 13. We do not knowingly collect personal information from children under 13.\n\nIf you are a parent or guardian and believe your child has provided us with personal information, please contact us immediately at ${SUPPORT_EMAIL}. We will take steps to delete such information promptly.`,
  },
  {
    icon: 'tune',
    color: '#64748b',
    bg: '#f1f5f9',
    title: '9. Your Rights & Choices',
    body: `You have the following rights regarding your personal information:\n\n• Access: Request a copy of the personal data we hold about you.\n• Correction: Update or correct inaccurate information in your profile.\n• Deletion: Request deletion of your account and associated data. Some data may be retained for legal or safety purposes.\n• Portability: Request your data in a structured, commonly used format.\n• Opt-Out: Unsubscribe from marketing communications at any time.\n• Location: Disable location access in your device settings at any time.\n\nTo exercise any of these rights, contact us at ${SUPPORT_EMAIL}.`,
  },
  {
    icon: 'cookie',
    color: '#a16207',
    bg: '#fefce8',
    title: '10. Cookies & Tracking',
    body: `Our app may use local storage and session tokens to:\n\n• Keep you logged in securely.\n• Remember your preferences and settings.\n• Analyse usage patterns to improve performance.\n\nThese are strictly functional and are not used for cross-app advertising. You may clear app data from your device settings to remove stored tokens.`,
  },
  {
    icon: 'update',
    color: '#6366f1',
    bg: '#eef2ff',
    title: '11. Changes to This Policy',
    body: `We may update this Privacy Policy from time to time to reflect changes in our practices or legal requirements. When we make significant changes, we will:\n\n• Notify you via an in-app notification or email.\n• Update the "Last Updated" date at the top of this page.\n\nYour continued use of ${APP_NAME} after changes are posted constitutes acceptance of the updated policy. We encourage you to review this policy periodically.`,
  },
  {
    icon: 'contact-mail',
    color: '#3b82f6',
    bg: '#eff6ff',
    title: '12. Contact Us',
    body: `If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:\n\n📧 Email: ${SUPPORT_EMAIL}\n🏢 ${APP_NAME} Privacy Team\n\nWe will respond to all legitimate requests within 7 business days.`,
  },
];

const SectionItem = ({ item }) => {
  const [open, setOpen] = useState(false);

  return (
    <View style={s.sectionCard}>
      <TouchableOpacity style={s.sectionHeader} onPress={() => setOpen(!open)} activeOpacity={0.8}>
        <View style={[s.sectionIconWrap, { backgroundColor: item.bg }]}>
          <MaterialIcons name={item.icon} size={20} color={item.color} />
        </View>
        <Text style={s.sectionTitle}>{item.title}</Text>
        <MaterialIcons
          name={open ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
          size={22}
          color="#94a3b8"
        />
      </TouchableOpacity>
      {open && (
        <View style={s.sectionBody}>
          <Text style={s.sectionText}>{item.body}</Text>
        </View>
      )}
    </View>
  );
};

const PrivacyPolicy = ({ onClose }) => {
  const { t } = useTranslation();
  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onClose} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <MaterialIcons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('settings:privacyPolicy')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={s.hero}>
          <View style={s.heroIcon}>
            <MaterialIcons name="shield" size={38} color="#8b5cf6" />
          </View>
          <Text style={s.heroTitle}>{t('settings:privacyMatters')}</Text>
          <Text style={s.heroSub}>{t('settings:privacyHeroSub')}</Text>
          <View style={s.updatedBadge}>
            <MaterialIcons name="update" size={13} color="#6366f1" />
            <Text style={s.updatedText}>{t('settings:lastUpdated')}: {LAST_UPDATED}</Text>
          </View>
        </View>

        {/* Quick Summary */}
        <View style={s.summaryCard}>
          <Text style={s.summaryTitle}>{t('settings:summaryGlance')}</Text>
          {[
            { icon: 'verified-user', text: 'Your real identity is never revealed to counselors', color: '#10b981' },
            { icon: 'lock', text: 'All data is encrypted in transit and at rest', color: '#3b82f6' },
            { icon: 'block', text: 'We never sell your personal data', color: '#ef4444' },
            { icon: 'location-off', text: 'Location only used while app is active', color: '#f59e0b' },
            { icon: 'delete-forever', text: 'You can request account deletion anytime', color: '#8b5cf6' },
          ].map((item, i) => (
            <View key={i} style={[s.summaryRow, i < 4 && s.summaryBorder]}>
              <MaterialIcons name={item.icon} size={18} color={item.color} />
              <Text style={s.summaryText}>{item.text}</Text>
            </View>
          ))}
        </View>

        {/* Full Sections */}
        <Text style={s.fullPolicyLabel}>{t('settings:fullPrivacyPolicyLabel')}</Text>
        <View style={s.sectionList}>
          {SECTIONS.map((section, i) => (
            <SectionItem key={i} item={section} />
          ))}
        </View>

        {/* Contact strip */}
        <TouchableOpacity
          style={s.contactStrip}
          onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Privacy%20Query%20-%20${APP_NAME}`)}
          activeOpacity={0.85}
        >
          <MaterialIcons name="email" size={20} color="#fff" />
          <Text style={s.contactStripText}>Questions? Email {SUPPORT_EMAIL}</Text>
          <MaterialIcons name="chevron-right" size={20} color="#fff" />
        </TouchableOpacity>

        <Text style={s.footer}>© {new Date().getFullYear()} {APP_NAME}. All rights reserved.</Text>
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? 16 : 12,
    paddingBottom: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 48, paddingTop: 8 },

  hero: { alignItems: 'center', paddingVertical: 24, marginBottom: 4 },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#f5f3ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#0f172a', marginBottom: 8, textAlign: 'center' },
  heroSub: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 21, paddingHorizontal: 16, marginBottom: 12 },
  updatedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#eef2ff',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  updatedText: { fontSize: 12, color: '#6366f1', fontWeight: '600' },

  summaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
  },
  summaryBorder: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  summaryText: { flex: 1, fontSize: 13, color: '#334155', fontWeight: '500', lineHeight: 18 },

  fullPolicyLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 24,
    marginBottom: 12,
  },

  sectionList: { gap: 8 },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  sectionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sectionTitle: { flex: 1, fontSize: 13, fontWeight: '700', color: '#0f172a', lineHeight: 19 },
  sectionBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  sectionText: { fontSize: 13, color: '#475569', lineHeight: 21 },

  contactStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#6366f1',
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 18,
    marginTop: 28,
  },
  contactStripText: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '600' },

  footer: {
    fontSize: 11,
    color: '#cbd5e1',
    textAlign: 'center',
    marginTop: 20,
  },
});

export default PrivacyPolicy;
