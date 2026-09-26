// Doctor Help & Support. Every action is real: email / call support, report a
// problem (email pre-filled with app + device details), check the Play Store
// for updates, and jump to the settings screens most questions end up in.
// The FAQs describe how the doctor dashboard actually behaves.
import React, { useState } from 'react';
import { Alert, LayoutAnimation, Linking, Platform, Pressable, ScrollView, Text, UIManager, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AppIcon from '../icons/AppIcon';
import { createDoctorStyles } from '../theme';
import { SUPPORT_EMAIL, SUPPORT_PHONE_DISPLAY, SUPPORT_PHONE_TEL } from '../../../../config';
import { APP_VERSION, APP_VERSION_CODE, PLAY_STORE_ID, PLAY_STORE_URL } from '../../../../constants/appInfo';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FAQS = [
  {
    q: 'When can I start a consultation?',
    a: 'Start Consultation unlocks at the appointment\'s scheduled time — until then the button shows when it will open. Walk-in patients can be started at any time. Video and voice calls open 15 minutes before the slot and stay available for the rest of that day.',
  },
  {
    q: 'What does the coloured badge on a queue card mean?',
    a: 'It shows how the patient is being seen: In-clinic Visit, Walk-in Visit, Video Consultation or Voice Consultation. The tabs above the queue show whether it is Pending, In Progress or Completed.',
  },
  {
    q: 'How is Today\'s Appointment Queue ordered?',
    a: 'By token number, lowest first. The first Pending card, and the Next Patient card, is always the next token to call. Appointments without a token come after the tokened ones, in time order.',
  },
  {
    q: 'An appointment\'s time has passed — where did it go?',
    a: 'Nowhere. Today\'s pending appointments stay in the Pending tab even after their slot time, so no patient is lost. Start the consultation when you\'re ready.',
  },
  {
    q: 'How do I set my available slots?',
    a: 'Open Calendar, choose your clinic, add time ranges for a weekday or a specific date (Morning / Afternoon / Evening presets are available), then tap Generate Slots to preview them. Mark a date unavailable to block it.',
  },
  {
    q: 'How do I schedule a follow-up?',
    a: 'Tick "Follow-up required" and pick a date when you complete an appointment, or open Follow-ups and tap New Follow-up to add one for any patient.',
  },
  {
    q: 'How do breaks work?',
    a: 'Tap Take Break on the dashboard and choose a duration. Your queue pauses and the break ends automatically when the time runs out, or tap End Break to finish early.',
  },
  {
    q: 'How do walk-in patients book with me?',
    a: 'Share your Profile QR (Settings → Profile QR). Patients scan it to register as a walk-in for your clinic, and they appear in your queue with a token.',
  },
  {
    q: 'I\'m not getting notifications.',
    a: 'Check Settings → Notification Preferences (notifications on, the right categories on, quiet hours off), and that notifications are allowed for Humaeli in your phone\'s settings. You only receive notifications on the one device you\'re signed in on.',
  },
  {
    q: 'Why was I signed out?',
    a: 'Your account can be signed in on one device at a time. Signing in on another phone signs this one out automatically. Changing your password also signs you out.',
  },
];

export default function DoctorHelpSupportScreen({ onBack, onOpenNotifications, onOpenPrivacySecurity }) {
  const [openFaq, setOpenFaq] = useState(null);

  const toggleFaq = (index) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenFaq((current) => (current === index ? null : index));
  };

  const mailTo = async (subject, intro = 'Please describe your question or issue below:') => {
    const email = (await AsyncStorage.getItem('userEmail').catch(() => null)) || 'not available';
    const body = [
      intro,
      '',
      '',
      '---',
      'Role: Doctor',
      `Account email: ${email}`,
      `App version: ${APP_VERSION} (${APP_VERSION_CODE})`,
      `Device: ${Platform.OS} ${Platform.Version}`,
    ].join('\n');
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`)
      .catch(() => Alert.alert('Email support', `No email app found. Please email us at ${SUPPORT_EMAIL}.`));
  };

  const callSupport = () => {
    Linking.openURL(`tel:${SUPPORT_PHONE_TEL}`)
      .catch(() => Alert.alert('Call support', `Please call us at ${SUPPORT_PHONE_DISPLAY}.`));
  };

  const reportProblem = () => mailTo(
    'Problem report - Doctor app',
    'What happened, and what did you expect? Steps to reproduce help us fix it faster:',
  );

  const checkForUpdates = () => {
    Linking.openURL(`market://details?id=${PLAY_STORE_ID}`)
      .catch(() => Linking.openURL(PLAY_STORE_URL))
      .catch(() => Alert.alert('Check for updates', `You are on version ${APP_VERSION}. The Play Store could not be opened.`));
  };

  const quickActions = [
    { icon: 'mail', label: 'Email Support', sub: 'Replies within 24 hours', onPress: () => mailTo('Doctor support request') },
    { icon: 'phone', label: 'Call Support', sub: 'Mon–Fri, 9am–5pm IST', onPress: callSupport },
    { icon: 'warning', label: 'Report a Problem', sub: 'Sends app & device details', onPress: reportProblem },
    { icon: 'refresh', label: 'Check for Updates', sub: `Version ${APP_VERSION}`, onPress: checkForUpdates },
  ];

  const shortcuts = [
    onOpenNotifications && { icon: 'bell', title: 'Notification Preferences', subtitle: 'Not getting alerts? Check these first', onPress: onOpenNotifications },
    onOpenPrivacySecurity && { icon: 'shield', title: 'Privacy & Security', subtitle: 'Password, app lock and this device', onPress: onOpenPrivacySecurity },
  ].filter(Boolean);

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backButton} hitSlop={8}>
          <AppIcon name="chevron-left" size={22} color="#1F2937" strokeWidth={2.4} />
        </Pressable>
        <Text style={s.title}>Help & Support</Text>
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.intro}>Find answers below, or reach our team — we usually reply within a working day.</Text>

        <View style={s.grid}>
          {quickActions.map((action) => (
            <View key={action.label} style={s.gridCell}>
              <Pressable onPress={action.onPress} style={({ pressed }) => [s.action, pressed && s.pressed]}>
                <View style={s.actionIcon}>
                  <AppIcon name={action.icon} size={18} color="#0D9488" strokeWidth={1.9} />
                </View>
                <Text style={s.actionLabel}>{action.label}</Text>
                <Text style={s.actionSub} numberOfLines={1}>{action.sub}</Text>
              </Pressable>
            </View>
          ))}
        </View>

        <Text style={s.sectionLabel}>Frequently Asked Questions</Text>
        <View style={s.card}>
          {FAQS.map((faq, index) => {
            const open = openFaq === index;
            return (
              <Pressable
                key={faq.q}
                onPress={() => toggleFaq(index)}
                style={[s.faq, index === FAQS.length - 1 && s.rowLast]}
              >
                <View style={s.faqHead}>
                  <Text style={[s.faqQ, open && s.faqQOpen]}>{faq.q}</Text>
                  <View style={open && s.chevronOpen}>
                    <AppIcon name="chevron-down" size={16} color={open ? '#0D9488' : '#9AA6B8'} strokeWidth={2.2} />
                  </View>
                </View>
                {open && <Text style={s.faqA}>{faq.a}</Text>}
              </Pressable>
            );
          })}
        </View>

        {shortcuts.length > 0 && (
          <>
            <Text style={s.sectionLabel}>Related Settings</Text>
            <View style={s.card}>
              {shortcuts.map((row, index) => (
                <Pressable
                  key={row.title}
                  onPress={row.onPress}
                  style={({ pressed }) => [s.row, index === shortcuts.length - 1 && s.rowLast, pressed && s.rowPressed]}
                >
                  <View style={s.rowIcon}><AppIcon name={row.icon} size={18} color="#0D9488" strokeWidth={1.9} /></View>
                  <View style={s.flex}>
                    <Text style={s.rowTitle}>{row.title}</Text>
                    <Text style={s.rowSubtitle}>{row.subtitle}</Text>
                  </View>
                  <AppIcon name="chevron-right" size={18} color="#9AA6B8" strokeWidth={2} />
                </Pressable>
              ))}
            </View>
          </>
        )}

        <View style={s.contactCard}>
          <Text style={s.contactTitle}>Contact</Text>
          <Pressable onPress={() => mailTo('Doctor support request')} style={s.contactRow} hitSlop={4}>
            <AppIcon name="mail" size={15} color="#0D9488" strokeWidth={1.9} />
            <Text style={s.contactText}>{SUPPORT_EMAIL}</Text>
          </Pressable>
          <Pressable onPress={callSupport} style={s.contactRow} hitSlop={4}>
            <AppIcon name="phone" size={15} color="#0D9488" strokeWidth={1.9} />
            <Text style={s.contactText}>{SUPPORT_PHONE_DISPLAY}</Text>
          </Pressable>
        </View>

        <Text style={s.footer}>Humaeli Doctor · Version {APP_VERSION}</Text>
      </ScrollView>
    </View>
  );
}

const s = createDoctorStyles({
  screen: { flex: 1, backgroundColor: '#F0FDFA' },
  flex: { flex: 1 },
  pressed: { opacity: 0.85 },
  header: { height: 62, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#D8DFE9', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F1F4F8', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  title: { fontSize: 19, fontWeight: '800', color: '#0D9488' },
  content: { padding: 16, paddingBottom: 36 },
  intro: { fontSize: 13, lineHeight: 19, color: '#667085', marginBottom: 14 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5, marginBottom: 12 },
  gridCell: { width: '50%', padding: 5 },
  action: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#C8D1DF', borderRadius: 14, padding: 13, minHeight: 112 },
  actionIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#DCFCFF', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  actionLabel: { fontSize: 14, fontWeight: '800', color: '#17243A' },
  actionSub: { fontSize: 11.5, color: '#667085', marginTop: 3 },

  sectionLabel: { fontSize: 13, fontWeight: '700', letterSpacing: 0.4, color: '#667085', marginTop: 8, marginBottom: 10, marginLeft: 2, textTransform: 'uppercase' },
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
    marginBottom: 14,
  },
  faq: { paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#EEF1F5' },
  faqHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  faqQ: { flex: 1, fontSize: 14, fontWeight: '700', color: '#17243A', lineHeight: 19 },
  faqQOpen: { color: '#0F766E' },
  faqA: { fontSize: 13, lineHeight: 19, color: '#475467', marginTop: 8 },
  chevronOpen: { transform: [{ rotate: '180deg' }] },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: '#EEF1F5' },
  rowLast: { borderBottomWidth: 0 },
  rowPressed: { backgroundColor: '#F7F9FC' },
  rowIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#DCFCFF', alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 14.5, fontWeight: '700', color: '#17243A' },
  rowSubtitle: { fontSize: 12, color: '#667085', marginTop: 2 },

  contactCard: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#C8D1DF', borderRadius: 14, padding: 14, gap: 10 },
  contactTitle: { fontSize: 14, fontWeight: '800', color: '#17243A' },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  contactText: { fontSize: 13.5, fontWeight: '600', color: '#0F766E' },
  footer: { textAlign: 'center', fontSize: 12, color: '#98A2B3', marginTop: 18 },
});
