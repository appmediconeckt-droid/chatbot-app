import React, { useState } from 'react';
import {
  LayoutAnimation,
  Linking,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import Text from '../../../../../../components/TranslatedText';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { DOCTOR } from '../../../../../../theme/palette';
import useLanguageRender from '../../../../../../hooks/useLanguageRender';
import {
  SUPPORT_EMAIL,
  SUPPORT_PHONE_DISPLAY,
  SUPPORT_PHONE_TEL,
} from '../../../../../../config';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const LAST_UPDATED = '24 June 2026';

// ─── Feature grid (2×2) ────────────────────────────────────────────────────────
const FEATURES = [
  { icon: 'shield-checkmark', label: 'Secure Data', color: '#16A34A', bg: '#E6F6EC' },
  { icon: 'lock-closed', label: 'Encrypted Chats', color: '#2563EB', bg: '#EFF6FF' },
  { icon: 'card', label: 'Protected Payments', color: '#16A34A', bg: '#E6F6EC' },
  { icon: 'ribbon', label: 'Professional Privacy', color: '#EF4444', bg: '#FEE2E2' },
];

// ─── Accordion sections ────────────────────────────────────────────────────────
const SECTIONS = [
  {
    id: 'collect',
    icon: 'document-text-outline',
    title: 'Information We Collect',
    color: '#16A34A',
    bg: '#E6F6EC',
    points: [
      'Professional profile — name, qualifications and specialization',
      'Patient conversations and session notes',
      'Appointment schedule and availability',
      'Earnings, payouts and transaction records',
    ],
  },
  {
    id: 'use',
    icon: 'settings-outline',
    title: 'How We Use Information',
    color: '#2563EB',
    bg: '#EFF6FF',
    points: [
      'Match you with patients seeking care',
      'Process appointments and payouts',
      'Keep the platform safe and reliable',
      'Send important account and session updates',
    ],
  },
  {
    id: 'retention',
    icon: 'hourglass-outline',
    title: 'Data Retention and Deletion',
    color: '#10B981',
    bg: '#DFF7EC',
    points: [
      'Kept only as long as needed for the purposes stated in this policy.',
      'Longer retention possible if required or permitted by law.',
      'Depends on factors like info type, user relationship, legal rules, security, and payment/dispute history.',
      'Retention periods vary based on these specific conditions.',
    ],
  },
  {
    id: 'professional',
    icon: 'briefcase-outline',
    title: 'Professional Privacy',
    color: '#8B5CF6',
    bg: '#F3E8FF',
    points: [
      'Your credentials are verified and stored securely',
      'Session content stays confidential',
      'You control what appears on your public profile',
    ],
  },
  {
    id: 'responsibilities',
    icon: 'checkmark-done-outline',
    title: 'Your Responsibilities',
    color: '#F59E0B',
    bg: '#FEF3C7',
    points: [
      'Keep patient information confidential',
      'Maintain accurate professional details',
      'Follow ethical and legal guidelines',
    ],
  },
  {
    id: 'sharing',
    icon: 'share-social-outline',
    title: 'Sharing & Security',
    color: '#0D9488',
    bg: '#CCFBF1',
    points: [
      'We never sell your data',
      'Information is shared only for care coordination',
      'All chats are end-to-end encrypted',
    ],
  },
  {
    id: 'choices',
    icon: 'options-outline',
    title: 'Your Choices',
    color: '#2563EB',
    bg: '#EFF6FF',
    points: [
      'Update or export your data anytime',
      'Manage your notification preferences',
      'Request account deletion',
    ],
  },
];

const CounselorPrivacyPolicy = ({ onClose }) => {
  const { t } = useLanguageRender();
  const C = DOCTOR;
  const [expanded, setExpanded] = useState(null);

  const toggle = (id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((cur) => (cur === id ? null : id));
  };

  const dial = () => Linking.openURL(`tel:${SUPPORT_PHONE_TEL}`).catch(() => {});
  const email = () => {
    const subject = encodeURIComponent('Privacy question - Humaeli Consultant');
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}`).catch(() => {});
  };

  return (
    <View style={[s.root, { backgroundColor: C.backgroundTint }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <SafeAreaView edges={['top', 'bottom']} style={{ backgroundColor: '#fff' }}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} style={s.headerBtn} hitSlop={12}>
            <Ionicons name="chevron-back" size={24} color="#0f172a" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>{t('Privacy Policy')}</Text>
            <Text style={s.headerSub}>{t('Learn how Humaeli collects, uses, and protects your personal information')}</Text>
          </View>
        </View>
      </SafeAreaView>

      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <LinearGradient
          colors={[C.gradientFrom, C.gradientTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.hero}
        >
          <View style={s.heroTop}>
            <View style={s.heroIcon}>
              <Ionicons name="shield-checkmark" size={24} color="#fff" />
            </View>
            <Text style={s.heroTitle}>{t('Privacy & Security')}</Text>
          </View>
          <Text style={s.heroText}>
            Learn how Humaeli protects your professional data, patient conversations,
            appointments, earnings, and account information.
          </Text>
          <View style={s.heroStamp}>
            <Ionicons name="time-outline" size={13} color="#fff" />
            <Text style={s.heroStampText}>Last Updated: {LAST_UPDATED}</Text>
          </View>
        </LinearGradient>

        {/* ── Feature grid ─────────────────────────────────────────────────── */}
        <View style={s.grid}>
          {FEATURES.map((f) => (
            <View key={f.label} style={s.featureCard}>
              <View style={[s.featureIcon, { backgroundColor: f.bg }]}>
                <Ionicons name={f.icon} size={18} color={f.color} />
              </View>
              <Text style={s.featureLabel}>{t(f.label)}</Text>
            </View>
          ))}
        </View>

        {/* ── Accordion ────────────────────────────────────────────────────── */}
        <View style={s.accordion}>
          {SECTIONS.map((sec) => {
            const open = expanded === sec.id;
            return (
              <View key={sec.id} style={s.accItem}>
                <TouchableOpacity style={s.accHead} activeOpacity={0.8} onPress={() => toggle(sec.id)}>
                  <View style={[s.accIcon, { backgroundColor: sec.bg }]}>
                    <Ionicons name={sec.icon} size={18} color={sec.color} />
                  </View>
                  <Text style={s.accTitle}>{t(sec.title)}</Text>
                  <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color="#94A3B8" />
                </TouchableOpacity>

                {open && (
                  <View style={s.accBody}>
                    {sec.points.map((p) => (
                      <View key={p} style={s.bulletRow}>
                        <View style={[s.bulletDot, { backgroundColor: sec.color }]} />
                        <Text style={s.bulletText}>{t(p)}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* ── Assistance card ──────────────────────────────────────────────── */}
        <View style={s.assistCard}>
          <View style={[s.assistIcon, { backgroundColor: C.secondaryTint }]}>
            <Ionicons name="headset-outline" size={24} color={C.primary} />
          </View>
          <Text style={s.assistTitle}>{t('Need Privacy Assistance?')}</Text>
          <Text style={s.assistText}>
            Our dedicated team is here to help you with privacy-related inquiries.
          </Text>

          <TouchableOpacity activeOpacity={0.88} onPress={email} style={s.emailBtnWrap}>
            <LinearGradient
              colors={[C.gradientFrom, C.gradientTo]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.emailBtn}
            >
              <Ionicons name="mail-outline" size={17} color="#fff" />
              <Text style={s.emailBtnText}>{t('Email Support')}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={s.assistRow}>
            <TouchableOpacity style={s.ghostBtn} activeOpacity={0.85} onPress={dial}>
              <Ionicons name="call-outline" size={16} color={C.primary} />
              <Text style={[s.ghostBtnText, { color: C.primary }]}>
                {t('Call')} {SUPPORT_PHONE_DISPLAY}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <Text style={s.footer}>{t('Humaeli Consultant App v2.4.1')}</Text>
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomColor: '#EEF0F5',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 6,
    paddingBottom: 14,
    paddingHorizontal: 12,
    paddingTop: Platform.OS === 'android' ? 10 : 4,
  },
  headerBtn: { alignItems: 'center', height: 40, justifyContent: 'center', width: 36 },
  headerTitle: { color: '#0f172a', fontSize: 18, fontWeight: '800' },
  headerSub: { color: '#94A3B8', fontSize: 11.5, lineHeight: 15, marginTop: 2, paddingRight: 20 },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 42 },

  // Hero
  hero: { borderRadius: 20, padding: 18 },
  heroTop: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  heroTitle: { color: '#fff', fontSize: 19, fontWeight: '900' },
  heroText: { color: 'rgba(255,255,255,0.92)', fontSize: 13, lineHeight: 19, marginTop: 14 },
  heroStamp: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    marginTop: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  heroStampText: { color: '#fff', fontSize: 11.5, fontWeight: '700' },

  // Feature grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 },
  featureCard: {
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    borderColor: '#EEF0F5',
    borderRadius: 16,
    borderWidth: 1,
    flexGrow: 1,
    gap: 10,
    padding: 14,
    width: '47.5%',
  },
  featureIcon: { alignItems: 'center', borderRadius: 11, height: 38, justifyContent: 'center', width: 38 },
  featureLabel: { color: '#0f172a', fontSize: 13.5, fontWeight: '800' },

  // Accordion
  accordion: { gap: 10, marginTop: 16 },
  accItem: {
    backgroundColor: '#fff',
    borderColor: '#EEF0F5',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  accHead: { alignItems: 'center', flexDirection: 'row', gap: 12, padding: 14 },
  accIcon: { alignItems: 'center', borderRadius: 11, height: 38, justifyContent: 'center', width: 38 },
  accTitle: { color: '#0f172a', flex: 1, fontSize: 14.5, fontWeight: '800' },
  accBody: { paddingBottom: 14, paddingHorizontal: 16, paddingTop: 2 },
  bulletRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 9, paddingVertical: 4 },
  bulletDot: { borderRadius: 3, height: 6, marginTop: 6, width: 6 },
  bulletText: { color: '#64748B', flex: 1, fontSize: 13, lineHeight: 19 },

  // Assistance card
  assistCard: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: '#EEF0F5',
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 20,
    padding: 20,
  },
  assistIcon: {
    alignItems: 'center',
    borderRadius: 16,
    height: 52,
    justifyContent: 'center',
    marginBottom: 12,
    width: 52,
  },
  assistTitle: { color: '#0f172a', fontSize: 17, fontWeight: '900' },
  assistText: { color: '#64748B', fontSize: 13, lineHeight: 19, marginTop: 6, textAlign: 'center' },
  emailBtnWrap: { alignSelf: 'stretch', marginTop: 16 },
  emailBtn: {
    alignItems: 'center',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 13,
  },
  emailBtnText: { color: '#fff', fontSize: 14.5, fontWeight: '800' },
  assistRow: { alignSelf: 'stretch', flexDirection: 'row', gap: 12, marginTop: 10 },
  ghostBtn: {
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderColor: '#E6EBF1',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    paddingVertical: 12,
  },
  ghostBtnText: { fontSize: 14, fontWeight: '800' },

  footer: { color: '#9CA3AF', fontSize: 11.5, marginTop: 22, textAlign: 'center' },
});

export default CounselorPrivacyPolicy;
