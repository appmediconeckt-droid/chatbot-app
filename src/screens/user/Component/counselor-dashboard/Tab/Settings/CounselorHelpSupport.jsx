import React, { useState } from 'react';
import {
  Alert,
  Linking,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import useLanguageRender from '../../../../../../hooks/useLanguageRender';
import GradientFill from '../../../../../../components/common/GradientFill';
import { DOCTOR } from '../../../../../../theme/palette';

const SUPPORT_EMAIL = 'support@humaeli.com';
const SUPPORT_PHONE = '+1 (800) 555-0199';
// India's unified emergency number (police / ambulance / fire).
const EMERGENCY_PHONE = '112';
// Government of India's 24x7 mental-health helpline.
const KIRAN_HELPLINE = '9152987821';
// Region-aware directory of verified crisis lines. Deliberately not a hardcoded
// list of numbers - a wrong helpline number is worse than none.
const HELPLINE_DIRECTORY = 'https://findahelpline.com';
const APP_VERSION = '2.1.4';
const LAST_UPDATED = 'July 2026';

/**
 * Help & Support for the counselor side.
 *
 * Counselors were being shown the *user* help screen, which answers questions
 * they never ask ("How do I book an appointment?", "How do I add funds to my
 * Wallet?") and offers an AI wellness assistant. This covers what a practitioner
 * actually needs instead: getting paid, receiving requests, running sessions,
 * verification, and what to do when a client is at risk.
 *
 * Props (all optional - every action has a working fallback):
 *   onClose         () => void
 *   onOpenEarnings  () => void   opens the Earnings & Payouts screen
 *   onOpenProfile   () => void   opens Profile & verification
 */
const CounselorHelpSupport = ({ onClose, onOpenEarnings, onOpenProfile }) => {
  const { t } = useLanguageRender();
  const [openFaq, setOpenFaq] = useState(null);

  const mailTo = (subject) => {
    const body = encodeURIComponent(
      `Please describe the issue below:\n\n\n---\nRole: Counselor\nApp version: ${APP_VERSION}\nPlatform: mobile`,
    );
    Linking.openURL(
      `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${body}`,
    ).catch(() => {
      Alert.alert(t('Email support'), `${t('Please email us at')} ${SUPPORT_EMAIL}`);
    });
  };

  const dial = (number) => {
    Linking.openURL(`tel:${number}`).catch(() => {
      Alert.alert(t('Call support'), `${t('Please call us at')} ${number}`);
    });
  };

  // Every card does something real; nothing here is decorative.
  const quickActions = [
    {
      icon: 'cash-multiple',
      label: t('Earnings & payouts'),
      sub: t('Balance, withdrawals, commission'),
      onPress: () =>
        onOpenEarnings
          ? onOpenEarnings()
          : mailTo('Counselor support - earnings question'),
    },
    {
      icon: 'shield-check-outline',
      label: t('Profile & verification'),
      sub: t('Documents, certificates, specialities'),
      onPress: () =>
        onOpenProfile
          ? onOpenProfile()
          : mailTo('Counselor support - verification question'),
    },
    {
      icon: 'email-outline',
      label: t('Email support'),
      sub: t('Replies within 24 hours'),
      onPress: () => mailTo('Counselor support request'),
    },
    {
      icon: 'phone-outline',
      label: t('Call support'),
      sub: t('Mon-Fri, 9am - 5pm IST'),
      onPress: () => dial(SUPPORT_PHONE),
    },
  ];

  const faqs = [
    {
      q: t('When do I get paid?'),
      a: t(
        'Earnings from a completed session move to your available balance once the session is marked complete. You can request a withdrawal from Earnings & Payouts at any time, as long as your payout account is verified. Standard payouts settle to your bank in 2-3 working days; instant payouts settle sooner and carry a fee shown before you confirm.',
      ),
    },
    {
      q: t('How is my earning per session calculated?'),
      a: t(
        'Each session is split between your share and the platform commission. The exact percentages, and what that means in rupees, are shown on the Counselor share and Platform commission cards in Earnings & Payouts. Your payout is the session amount minus that commission.',
      ),
    },
    {
      q: t('Why am I not receiving new chat requests?'),
      a: t(
        'New requests only reach counselors who are online. Check that your status shows Online on the dashboard, that the app has notification permission, and that you have a working internet connection. Requests already accepted continue to appear under Messages regardless of your status.',
      ),
    },
    {
      q: t('How do I accept a session request?'),
      a: t(
        'Open the Requests or Appointments tab, review the request, and tap Accept. Once accepted, the chat opens under Messages and the client can message you. Scheduling an appointment only becomes available after you accept.',
      ),
    },
    {
      q: t('How do I start a video or voice session?'),
      a: t(
        'Open the accepted chat or the confirmed appointment and use the video or voice button. Both sides need camera and microphone permission granted and a stable connection. For a scheduled appointment, the Conduct Session button appears when the session is due.',
      ),
    },
    {
      q: t('How do I get my profile verified?'),
      a: t(
        'Go to Profile and upload your qualification certificates and identity document, then complete your specialities, languages and experience. Verification is reviewed by our team; you will see a verified badge on your profile once it is approved.',
      ),
    },
    {
      q: t('What happens if I miss a scheduled appointment?'),
      a: t(
        'Missed sessions are visible to the client and affect your rating. If you cannot attend, message the client in advance through the chat so the appointment can be rescheduled. If something goes wrong on the day, email support with the appointment date and time.',
      ),
    },
    {
      q: t('How is my rating calculated?'),
      a: t(
        'Clients can rate a counselor after a completed session. Your rating is the average of those scores. Counselors with no ratings yet are shown as New rather than with a score.',
      ),
    },
  ];

  const toggleFaq = (i) => setOpenFaq((cur) => (cur === i ? null : i));

  const handleClientAtRisk = () => {
    Alert.alert(
      t('Client at immediate risk'),
      t(
        'If a client discloses intent to harm themselves or someone else, stay with them in the session, encourage them to contact emergency services, and escalate to our clinical support team straight away.',
      ),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Find a helpline'),
          onPress: () => {
            Linking.openURL(HELPLINE_DIRECTORY).catch(() => {
              Alert.alert(t('Crisis resources'), `${t('Please visit')} ${HELPLINE_DIRECTORY}`);
            });
          },
        },
        {
          text: `${t('Call')} ${EMERGENCY_PHONE}`,
          style: 'destructive',
          onPress: () => dial(EMERGENCY_PHONE),
        },
      ],
    );
  };

  return (
    <SafeAreaView style={s.root} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <View style={s.header}>
        <TouchableOpacity onPress={onClose} hitSlop={12}>
          <Ionicons name="chevron-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>{t('Help and Support')}</Text>
          <Text style={s.headerSub}>{t('Counselor support centre')}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Quick actions */}
        <View style={s.grid}>
          {quickActions.map((a) => (
            <TouchableOpacity
              key={a.label}
              style={s.card}
              onPress={a.onPress}
              activeOpacity={0.85}
            >
              <View style={s.cardIcon}>
                <GradientFill />
                <MaterialCommunityIcons name={a.icon} size={20} color="#ffffff" />
              </View>
              <Text style={s.cardLabel}>{t(a.label)}</Text>
              <Text style={s.cardSub}>{a.sub}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Client safety - specific to practising counselors, and absent from the
            user-facing help screen. */}
        <Text style={s.sectionTitle}>{t('CLIENT SAFETY')}</Text>
        <View style={s.safetyCard}>
          <View style={s.safetyHead}>
            <MaterialCommunityIcons name="alert-octagon-outline" size={20} color="#DC2626" />
            <Text style={s.safetyTitle}>{t('A client is at immediate risk')}</Text>
          </View>
          <Text style={s.safetyText}>
            {t(
              'Stay in the session, keep the client talking, and escalate without delay. Do not end the conversation while they are in danger.',
            )}
          </Text>
          <TouchableOpacity style={s.safetyBtn} onPress={handleClientAtRisk} activeOpacity={0.85}>
            <Text style={s.safetyBtnText}>{t('Escalation steps')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => dial(KIRAN_HELPLINE)} activeOpacity={0.7}>
            <Text style={s.safetyLink}>
              {t('KIRAN mental health helpline')} · {KIRAN_HELPLINE}
            </Text>
          </TouchableOpacity>
        </View>

        {/* FAQs */}
        <Text style={s.sectionTitle}>{t('COMMON QUESTIONS')}</Text>
        <View style={s.faqCard}>
          {faqs.map((f, i) => (
            <View key={f.q} style={[s.faqItem, i === faqs.length - 1 && s.faqItemLast]}>
              <TouchableOpacity style={s.faqHead} onPress={() => toggleFaq(i)} activeOpacity={0.7}>
                <Text style={s.faqQ}>{f.q}</Text>
                <Ionicons
                  name={openFaq === i ? 'chevron-up' : 'chevron-down'}
                  size={18}
                  color="#94a3b8"
                />
              </TouchableOpacity>
              {openFaq === i ? <Text style={s.faqA}>{f.a}</Text> : null}
            </View>
          ))}
        </View>

        {/* Contact */}
        <Text style={s.sectionTitle}>{t('CONTACT')}</Text>
        <View style={s.plainCard}>
          <TouchableOpacity
            style={s.row}
            onPress={() => mailTo('Counselor support request')}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="email-outline" size={20} color={DOCTOR.primary} />
            <View style={{ flex: 1 }}>
              <Text style={s.rowLabel}>{t('Email')}</Text>
              <Text style={s.rowValue}>{SUPPORT_EMAIL}</Text>
            </View>
          </TouchableOpacity>
          <View style={s.divider} />
          <TouchableOpacity style={s.row} onPress={() => dial(SUPPORT_PHONE)} activeOpacity={0.7}>
            <MaterialCommunityIcons name="phone-outline" size={20} color={DOCTOR.primary} />
            <View style={{ flex: 1 }}>
              <Text style={s.rowValue}>{SUPPORT_PHONE}</Text>
              <Text style={s.rowSub}>{t('Mon-Fri, 9am - 5pm IST')}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Report */}
        <Text style={s.sectionTitle}>{t('REPORT A PROBLEM')}</Text>
        <View style={s.plainCard}>
          <Text style={s.reportText}>
            {t('Hit a bug, a failed payout, or a session that would not connect?')}
          </Text>
          <TouchableOpacity
            style={s.reportBtn}
            onPress={() => mailTo(`Counselor bug report - Humaeli v${APP_VERSION}`)}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="bug-outline" size={18} color="#0f172a" />
            <Text style={s.reportBtnText}>{t('Report issue')}</Text>
          </TouchableOpacity>
        </View>

        <View style={s.versionBox}>
          <Text style={s.versionText}>
            {t('Humaeli Counselor')} · {t('Version')} {APP_VERSION}
          </Text>
          <Text style={s.versionSub}>
            {t('Last updated')}: {LAST_UPDATED}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F7FB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#EEF1F5',
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 6,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  headerSub: { fontSize: 11.5, color: '#94A3B8', marginTop: 2 },

  content: { padding: 16, paddingBottom: 40 },

  sectionTitle: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1,
    marginTop: 22,
    marginBottom: 10,
  },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    width: '47.5%',
    flexGrow: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EEF1F5',
    padding: 14,
  },
  // overflow clips GradientFill into the rounded square.
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  cardLabel: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  cardSub: { fontSize: 11.5, color: '#94A3B8', marginTop: 3, lineHeight: 16 },

  safetyCard: {
    backgroundColor: '#FFF7F7',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FBD5D5',
    padding: 16,
  },
  safetyHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  safetyTitle: { flex: 1, fontSize: 14.5, fontWeight: '800', color: '#0f172a' },
  safetyText: { fontSize: 12.5, lineHeight: 19, color: '#475569', marginTop: 8 },
  safetyBtn: {
    marginTop: 14,
    backgroundColor: '#DC2626',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  safetyBtnText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  safetyLink: {
    marginTop: 12,
    textAlign: 'center',
    fontSize: 12.5,
    fontWeight: '700',
    color: '#B91C1C',
  },

  faqCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EEF1F5',
    paddingHorizontal: 16,
  },
  faqItem: { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  faqItemLast: { borderBottomWidth: 0 },
  faqHead: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 15 },
  faqQ: { flex: 1, fontSize: 13.5, fontWeight: '700', color: '#0f172a' },
  faqA: { fontSize: 12.5, lineHeight: 19, color: '#475569', paddingBottom: 15 },

  plainCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EEF1F5',
    padding: 16,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  rowLabel: { fontSize: 11.5, color: '#94A3B8' },
  rowValue: { fontSize: 13.5, fontWeight: '700', color: '#0f172a' },
  rowSub: { fontSize: 11.5, color: '#94A3B8', marginTop: 2 },
  divider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 12 },

  reportText: { fontSize: 12.5, lineHeight: 19, color: '#475569' },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E6EBF1',
    borderRadius: 12,
    paddingVertical: 12,
  },
  reportBtnText: { fontSize: 13, fontWeight: '700', color: '#0f172a' },

  versionBox: { alignItems: 'center', marginTop: 26 },
  versionText: { fontSize: 12.5, fontWeight: '700', color: '#64748B' },
  versionSub: { fontSize: 11.5, color: '#94A3B8', marginTop: 3 },
});

export default CounselorHelpSupport;
