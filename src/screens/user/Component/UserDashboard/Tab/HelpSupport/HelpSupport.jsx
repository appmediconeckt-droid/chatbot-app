import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Animated,
  TextInput,
  Alert,
  StatusBar,
  Platform,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const SUPPORT_EMAIL = 'app.mediconeckt@gmail.com';
const ADMIN_EMAIL = 'vsinghthakur187@gmail.com';
const APP_NAME = 'Mediconeckt';

const FAQS = [
  {
    q: 'How do I book an appointment with a counselor?',
    a: 'Go to the Appointments tab, browse available counselors, and tap "Schedule" on any counselor card. Pick a date, time, and add a reason. The counselor will confirm shortly.',
  },
  {
    q: 'Is my identity kept private during sessions?',
    a: 'Yes. You appear to counselors under an anonymous name. Your real name, photo, and contact details are never shared with them.',
  },
  {
    q: 'How do voice and video calls work?',
    a: 'Once a counselor accepts your chat request, you can initiate a voice or video call directly from the chat screen. Both parties must be online.',
  },
  {
    q: 'What payment methods are accepted?',
    a: 'We support UPI, debit/credit cards, and net banking through our secure wallet system. All transactions are encrypted.',
  },
  {
    q: 'Can I cancel or reschedule an appointment?',
    a: 'Yes. Go to My Appointments, tap "View Details" on the appointment, and use the cancel or reschedule option at least 2 hours before the session.',
  },
  {
    q: 'What if I face a technical issue during a call?',
    a: 'Check your internet connection first. If the issue persists, end the call and restart it. For recurring issues, contact our support team.',
  },
  {
    q: 'How do I update my profile or account details?',
    a: 'Tap the menu icon → My Profile. You can edit your name, email, phone, and other details. Email and phone changes require OTP verification.',
  },
  {
    q: 'Is the app available 24/7?',
    a: 'The app is available 24/7. Counselor availability varies — you can see their online status (green dot) in the directory.',
  },
];

const CONTACT_ACTIONS = [
  {
    icon: 'email',
    color: '#3b82f6',
    bg: '#eff6ff',
    onPress: () => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Support%20Request%20-%20${APP_NAME}`),
    labelKey: 'emailSupportLabel',
    valueKey: null,
    value: SUPPORT_EMAIL,
    descKey: 'emailResponseTime',
  },
  {
    icon: 'admin-panel-settings',
    color: '#8b5cf6',
    bg: '#f5f3ff',
    onPress: () => Linking.openURL(`mailto:${ADMIN_EMAIL}?subject=Admin%20Request%20-%20${APP_NAME}`),
    labelKey: 'contactAdminLabel',
    valueKey: null,
    value: ADMIN_EMAIL,
    descKey: 'adminIssueDesc',
  },
  {
    icon: 'chat',
    color: '#10b981',
    bg: '#f0fdf4',
    onPress: null,
    labelKey: 'liveChatLabel',
    valueKey: 'availableInApp',
    value: null,
    descKey: 'aiChatHelp',
  },
];

const TIP_ICONS = ['wifi', 'notifications-active', 'lock', 'location-on', 'headset'];
const TIP_KEYS = ['tipStableNet', 'tipNotifications', 'tipNeverShare', 'tipLocation', 'tipHeadset'];

const FAQItem = ({ item, index }) => {
  const [open, setOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const toggle = () => {
    Animated.timing(anim, {
      toValue: open ? 0 : 1,
      duration: 220,
      useNativeDriver: false,
    }).start();
    setOpen(!open);
  };

  return (
    <View style={s.faqItem}>
      <TouchableOpacity style={s.faqQ} onPress={toggle} activeOpacity={0.8}>
        <View style={s.faqQLeft}>
          <View style={s.faqNum}>
            <Text style={s.faqNumText}>{index + 1}</Text>
          </View>
          <Text style={s.faqQText}>{item.q}</Text>
        </View>
        <MaterialIcons
          name={open ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
          size={22}
          color="#64748b"
        />
      </TouchableOpacity>
      {open && (
        <View style={s.faqA}>
          <Text style={s.faqAText}>{item.a}</Text>
        </View>
      )}
    </View>
  );
};

const HelpSupport = ({ onClose }) => {
  const { t } = useTranslation();
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const handleSendEmail = () => {
    if (!subject.trim() || !message.trim()) {
      Alert.alert(t('common:error'), 'Please enter both a subject and message.');
      return;
    }
    const body = encodeURIComponent(message.trim());
    const sub = encodeURIComponent(subject.trim());
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${sub}&body=${body}`).catch(() =>
      Alert.alert('Error', 'Could not open mail app. Please email us at ' + SUPPORT_EMAIL)
    );
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#f8fafc" />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onClose} style={s.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <MaterialIcons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('settings:helpSupport')}</Text>
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
            <MaterialIcons name="support-agent" size={38} color="#3b82f6" />
          </View>
          <Text style={s.heroTitle}>{t('settings:helpHeroTitle')}</Text>
          <Text style={s.heroSub}>{t('settings:helpHeroSub')}</Text>
        </View>

        {/* Contact Options */}
        <Text style={s.sectionTitle}>{t('settings:contactUs')}</Text>
        <View style={s.contactGrid}>
          {CONTACT_ACTIONS.map((opt, i) => (
            <TouchableOpacity
              key={i}
              style={s.contactCard}
              onPress={opt.onPress}
              activeOpacity={opt.onPress ? 0.75 : 1}
              disabled={!opt.onPress}
            >
              <View style={[s.contactIconWrap, { backgroundColor: opt.bg }]}>
                <MaterialIcons name={opt.icon} size={26} color={opt.color} />
              </View>
              <Text style={s.contactLabel}>{t('settings:' + opt.labelKey)}</Text>
              <Text style={s.contactValue} numberOfLines={1}>{opt.valueKey ? t('settings:' + opt.valueKey) : opt.value}</Text>
              <Text style={s.contactDesc}>{t('settings:' + opt.descKey)}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Quick Tips */}
        <Text style={s.sectionTitle}>{t('settings:quickTips')}</Text>
        <View style={s.tipsCard}>
          {TIP_KEYS.map((key, i) => (
            <View key={i} style={[s.tipRow, i < TIP_KEYS.length - 1 && s.tipBorder]}>
              <View style={s.tipIconWrap}>
                <MaterialIcons name={TIP_ICONS[i]} size={18} color="#3b82f6" />
              </View>
              <Text style={s.tipText}>{t('settings:' + key)}</Text>
            </View>
          ))}
        </View>

        {/* FAQs */}
        <Text style={s.sectionTitle}>{t('settings:frequentlyAsked')}</Text>
        <View style={s.faqList}>
          {FAQS.map((item, i) => (
            <FAQItem key={i} item={item} index={i} />
          ))}
        </View>

        {/* Send Message Form */}
        <Text style={s.sectionTitle}>{t('settings:sendUsMessage')}</Text>
        <View style={s.formCard}>
          <Text style={s.formLabel}>{t('settings:subject')}</Text>
          <TextInput
            style={s.formInput}
            value={subject}
            onChangeText={setSubject}
            placeholder="e.g., Issue with appointment booking"
            placeholderTextColor="#94a3b8"
          />
          <Text style={[s.formLabel, { marginTop: 14 }]}>{t('settings:yourMessage')}</Text>
          <TextInput
            style={[s.formInput, s.formTextArea]}
            value={message}
            onChangeText={setMessage}
            placeholder="Describe your issue or question in detail..."
            placeholderTextColor="#94a3b8"
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
          <TouchableOpacity style={s.sendBtn} onPress={handleSendEmail} activeOpacity={0.85}>
            <MaterialIcons name="send" size={18} color="#fff" />
            <Text style={s.sendBtnText}>{t('settings:sendMessageBtn')}</Text>
          </TouchableOpacity>
          <Text style={s.formNote}>
            This will open your mail app pre-filled with your message.
          </Text>
        </View>

        {/* Version note */}
        <Text style={s.versionNote}>{APP_NAME} · support@mediconeckt.com</Text>
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

  hero: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 4,
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  heroTitle: { fontSize: 22, fontWeight: '800', color: '#0f172a', marginBottom: 8, textAlign: 'center' },
  heroSub: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 21, paddingHorizontal: 16 },

  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 24,
    marginBottom: 12,
  },

  contactGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  contactCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'flex-start',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  contactIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  contactLabel: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  contactValue: { fontSize: 11, color: '#3b82f6', fontWeight: '600' },
  contactDesc: { fontSize: 11, color: '#94a3b8', marginTop: 2 },

  tipsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 12,
  },
  tipBorder: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  tipIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipText: { flex: 1, fontSize: 13, color: '#334155', fontWeight: '500', lineHeight: 19 },

  faqList: { gap: 8 },
  faqItem: {
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
  faqQ: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    gap: 10,
  },
  faqQLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  faqNum: {
    width: 24,
    height: 24,
    borderRadius: 8,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  faqNumText: { fontSize: 11, fontWeight: '800', color: '#3b82f6' },
  faqQText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#0f172a', lineHeight: 19 },
  faqA: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 2,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  faqAText: { fontSize: 13, color: '#475569', lineHeight: 20 },

  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  formLabel: { fontSize: 12, fontWeight: '700', color: '#374151', marginBottom: 6 },
  formInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 14,
    color: '#0f172a',
    backgroundColor: '#f8fafc',
  },
  formTextArea: { minHeight: 110, textAlignVertical: 'top' },
  sendBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 16,
  },
  sendBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  formNote: { fontSize: 11, color: '#94a3b8', textAlign: 'center', marginTop: 10 },

  versionNote: {
    fontSize: 11,
    color: '#cbd5e1',
    textAlign: 'center',
    marginTop: 32,
  },
});

export default HelpSupport;
