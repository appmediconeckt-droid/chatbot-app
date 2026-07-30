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
import PATIENT from '../../../../../../theme/palette';

const SUPPORT_EMAIL = 'support@humaeli.com';
const SUPPORT_PHONE = '+1 (800) 555-0199';
// India's unified emergency number (police / ambulance / fire). Was '911',
// which simply does not connect from an Indian network.
const EMERGENCY_PHONE = '112';
const APP_VERSION = '2.1.4';
const LAST_UPDATED = 'July 2026';
// Matches applicationId in android/app/build.gradle.
const STORE_ID = 'com.chatbots';
// Real, region-aware directory of verified crisis lines. Deliberately not a
// hardcoded list of numbers - a wrong helpline number is worse than none.
const HELPLINE_DIRECTORY = 'https://findahelpline.com';

// onOpenTab / onOpenAiChat come from UserDashboard. CounselorSettings mounts
// this screen without them, so every use is guarded with a working fallback.
const HelpSupport = ({ onClose, onOpenTab, onOpenAiChat }) => {
  const { t } = useLanguageRender();
  const [expandedIndices, setExpandedIndices] = useState(new Set());

  const quickActions = [
    {
      icon: 'chat-processing-outline',
      label: t('Live Chat'),
      subtitle: t('Chat with our support team'),
      iconBg: '#E6F6EC',
      iconColor: PATIENT.primary,
      badge: t('Usually online within'),
      badgeColor: PATIENT.primary,
      badgeBg: '#E6F6EC',
      action: 'chat',
    },
    {
      icon: 'phone-outline',
      label: t('Call Support'),
      subtitle: t('Talk directly'),
      iconBg: '#E0EBFF',
      iconColor: '#2563eb',
      action: 'phone',
    },
    {
      icon: 'email-outline',
      label: t('Email Support'),
      subtitle: t('Send your questions'),
      iconBg: '#E6F6EC',
      iconColor: PATIENT.primary,
      badge: t('Within 24 hours'),
      badgeColor: '#94a3b8',
      badgeBg: '#f1f5f9',
      action: 'email',
    },
    {
      icon: 'robot-happy-outline',
      label: t('Humaelio'),
      subtitle: t('Get instant answers'),
      iconBg: '#E6F6EC',
      iconColor: PATIENT.primary,
      badge: t('24/7 Available'),
      badgeColor: PATIENT.primary,
      badgeBg: '#E6F6EC',
      action: 'ai',
    },
  ];

  const faqs = [
    { question: t('How do I book an appointment?'), answer: t("To book an appointment, navigate to the Counselors tab, select your preferred counselor, choose your consultation type, and pick a date and time. You'll receive a confirmation email with all the details.") },
    { question: t('How can I cancel or reschedule?'), answer: t('You can manage your appointments from the Appointments section. Tap any upcoming appointment to reschedule or cancel. Cancellations made 24 hours before the session are eligible for refunds.') },
    { question: t('Is my medical data secure?'), answer: t('Yes, all your personal and medical data is protected with end-to-end encryption and industry-standard security protocols. Your data is never shared with third parties without your consent.') },
    { question: t('How do I add funds to my Wallet?'), answer: t('Go to the Wallet tab and tap "Add Money". Choose your preferred payment method — card, UPI, or bank transfer — and enter the amount you want to add.') },
  ];

  const toggleFaq = (idx) => {
    const newSet = new Set(expandedIndices);
    if (newSet.has(idx)) newSet.delete(idx);
    else newSet.add(idx);
    setExpandedIndices(newSet);
  };

  const handleQuickAction = (action) => {
    if (action === 'email') {
      Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Support Request`).catch(() => {
        Alert.alert('Email Support', `Please email us at ${SUPPORT_EMAIL}`);
      });
    } else if (action === 'phone') {
      Linking.openURL(`tel:${SUPPORT_PHONE}`).catch(() => {
        Alert.alert('Call Support', `Please call us at ${SUPPORT_PHONE}`);
      });
    } else if (action === 'chat') {
      // Open the real chat tab rather than a dead confirmation dialog.
      if (onOpenTab) {
        onClose?.();
        onOpenTab('Chat');
      } else {
        Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Live Chat Request`).catch(() => {
          Alert.alert('Live Chat', `Chat isn't available here. Please email ${SUPPORT_EMAIL}.`);
        });
      }
    } else if (action === 'ai') {
      // Opens Humaelio, the AI assistant that already exists on the dashboard.
      if (onOpenAiChat) {
        onOpenAiChat();
      } else {
        Alert.alert('Humaelio', 'Open Humaelio from the dashboard chat button.');
      }
    }
  };

  const handleEmergency = () => {
    Alert.alert(
      'Emergency Contact',
      'If you are experiencing a medical emergency, please call your local emergency services immediately.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: `Call ${EMERGENCY_PHONE}`, style: 'destructive', onPress: () => Linking.openURL(`tel:${EMERGENCY_PHONE}`) },
      ]
    );
  };

  const handleCrisisResources = () => {
    Alert.alert(
      'Crisis Resources',
      'If you are in immediate danger, call emergency services. You can also browse verified crisis helplines for your country.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Find a helpline',
          onPress: () => {
            Linking.openURL(HELPLINE_DIRECTORY).catch(() => {
              Alert.alert('Crisis Resources', `Unable to open a browser. Please visit ${HELPLINE_DIRECTORY}`);
            });
          },
        },
        {
          text: `Call ${EMERGENCY_PHONE}`,
          style: 'destructive',
          onPress: () => Linking.openURL(`tel:${EMERGENCY_PHONE}`),
        },
      ]
    );
  };

  const handleCheckForUpdates = () => {
    // market:// opens the Play Store app directly; the https URL is the fallback
    // when the store app isn't installed.
    Linking.openURL(`market://details?id=${STORE_ID}`).catch(() => {
      Linking.openURL(`https://play.google.com/store/apps/details?id=${STORE_ID}`).catch(() => {
        Alert.alert('Check for Updates', `You are on version ${APP_VERSION}. Unable to open the store.`);
      });
    });
  };

  const handleReportIssue = () => {
    const subject = encodeURIComponent(`Bug Report — Humaeli v${APP_VERSION}`);
    const body = encodeURIComponent(
      `Please describe the issue below:\n\n\n---\nApp Version: ${APP_VERSION}\nPlatform: mobile`
    );
    const url = `mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Report an Issue', `Please email us at ${SUPPORT_EMAIL} describing the issue.`);
    });
  };

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('Help and Support')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Quick Action Cards */}
        <View style={s.quickGrid}>
          {quickActions.map((action, idx) => (
            <TouchableOpacity
              key={idx}
              style={s.actionCard}
              onPress={() => handleQuickAction(action.action)}
              activeOpacity={0.8}
            >
              <View style={[s.actionIcon, { backgroundColor: action.iconBg }]}>
                <MaterialCommunityIcons name={action.icon} size={22} color={action.iconColor} />
              </View>
              <Text style={s.actionLabel}>{t(action.label)}</Text>
              <Text style={s.actionSubtitle}>{t(action.subtitle)}</Text>
              {action.badge && (
                <View style={[s.actionBadge, { backgroundColor: action.badgeBg }]}>
                  <Text style={[s.actionBadgeText, { color: action.badgeColor }]}>{action.badge}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Popular Questions */}
        <Text style={s.sectionTitle}>{t('Popular Questions')}</Text>
        <View style={s.faqCard}>
          {faqs.map((faq, idx) => {
            const isExpanded = expandedIndices.has(idx);
            return (
              <View key={idx} style={[s.faqItem, idx === faqs.length - 1 && s.faqItemLast]}>
                <TouchableOpacity style={s.faqHeader} onPress={() => toggleFaq(idx)} activeOpacity={0.7}>
                  <Text style={s.faqQuestion}>{faq.question}</Text>
                  <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color="#94a3b8" />
                </TouchableOpacity>
                {isExpanded && <Text style={s.faqAnswer}>{faq.answer}</Text>}
              </View>
            );
          })}
        </View>

        {/* Need Immediate Help */}
        <View style={s.emergencyCard}>
          <View style={s.emergencyHeader}>
            <MaterialCommunityIcons name="alert" size={20} color="#f59e0b" />
            <Text style={s.emergencyTitle}>{t('Need Immediate Help?')}</Text>
          </View>
          <Text style={s.emergencyText}>
            If you are experiencing a medical emergency, please call your local emergency services immediately.
          </Text>
          <TouchableOpacity style={s.emergencyButton} onPress={handleEmergency} activeOpacity={0.85}>
            <Text style={s.emergencyButtonText}>{t('Emergency Contact')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleCrisisResources} activeOpacity={0.7}>
            <Text style={s.crisisLink}>{t('Crisis Resources')}</Text>
          </TouchableOpacity>
        </View>

        {/* Contact Information */}
        <Text style={s.contactHeading}>{t('CONTACT INFORMATION')}</Text>
        <View style={s.contactCard}>
          <TouchableOpacity style={s.contactRow} onPress={() => handleQuickAction('email')} activeOpacity={0.7}>
            <View style={s.contactIcon}>
              <MaterialCommunityIcons name="email-outline" size={20} color={PATIENT.primary} />
            </View>
            <View style={s.contactInfo}>
              <Text style={s.contactLabel}>{t('Email')}</Text>
              <Text style={s.contactValue}>{SUPPORT_EMAIL}</Text>
            </View>
          </TouchableOpacity>

          <View style={s.contactDivider} />

          <TouchableOpacity style={s.contactRow} onPress={() => handleQuickAction('phone')} activeOpacity={0.7}>
            <View style={s.contactIcon}>
              <MaterialCommunityIcons name="phone-outline" size={20} color={PATIENT.primary} />
            </View>
            <View style={s.contactInfo}>
              <Text style={s.contactValue}>{SUPPORT_PHONE}</Text>
              <Text style={s.contactSub}>Mon–Fri, 9am – 5pm IST</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Report a Problem */}
        <Text style={s.sectionTitle}>{t('Report a Problem')}</Text>
        <View style={s.reportCard}>
          <Text style={s.reportText}>{t('Encountered a bug or technical issue in the app?')}</Text>
          <View style={s.reportButtons}>
            <TouchableOpacity style={s.reportButton} onPress={handleReportIssue} activeOpacity={0.8}>
              <MaterialCommunityIcons name="bug-outline" size={18} color="#0f172a" />
              <Text style={s.reportButtonText}>{t('Report Issue')}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Version Info */}
        <View style={s.versionBox}>
          <Text style={s.versionText}>Humaeli Version {APP_VERSION}</Text>
          <Text style={s.versionSub}>Last updated: {LAST_UPDATED}</Text>
          <TouchableOpacity activeOpacity={0.7} onPress={handleCheckForUpdates}>
            <Text style={s.updateLink}>{t('Check for Updates')}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#eef2f6' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#0f172a' },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },


  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 14, rowGap: 12 },
  actionCard: { width: '48%', backgroundColor: '#ffffff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#eef2f6' },
  actionIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  actionLabel: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 3 },
  actionSubtitle: { fontSize: 11, color: '#94a3b8', fontWeight: '500', marginBottom: 8 },
  actionBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  actionBadgeText: { fontSize: 9, fontWeight: '700' },

  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginTop: 24, marginBottom: 12 },

  faqCard: { backgroundColor: '#ffffff', borderRadius: 14, borderWidth: 1, borderColor: '#eef2f6', paddingHorizontal: 14 },
  faqItem: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingVertical: 15 },
  faqItemLast: { borderBottomWidth: 0 },
  faqHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  faqQuestion: { fontSize: 13.5, fontWeight: '600', color: '#334155', flex: 1, marginRight: 10 },
  faqAnswer: { fontSize: 12.5, color: '#64748b', lineHeight: 20, marginTop: 10 },

  emergencyCard: { backgroundColor: '#fffbeb', borderRadius: 14, borderWidth: 1, borderColor: '#fde68a', padding: 16, marginTop: 24, alignItems: 'center' },
  emergencyHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  emergencyTitle: { fontSize: 14, fontWeight: '800', color: '#92400e' },
  emergencyText: { fontSize: 12, color: '#b45309', textAlign: 'center', lineHeight: 18, marginBottom: 14 },
  emergencyButton: { backgroundColor: '#f59e0b', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 40, alignSelf: 'stretch', alignItems: 'center' },
  emergencyButtonText: { fontSize: 14, fontWeight: '800', color: '#ffffff' },
  crisisLink: { fontSize: 13, fontWeight: '700', color: '#d97706', marginTop: 12 },

  contactHeading: { fontSize: 11, fontWeight: '700', color: '#94a3b8', letterSpacing: 0.6, marginTop: 24, marginBottom: 10 },
  contactCard: { backgroundColor: '#ffffff', borderRadius: 14, borderWidth: 1, borderColor: '#eef2f6', paddingHorizontal: 14 },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
  contactIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#E6F6EC', alignItems: 'center', justifyContent: 'center' },
  contactInfo: { flex: 1 },
  contactLabel: { fontSize: 11, fontWeight: '600', color: '#94a3b8', marginBottom: 2 },
  contactValue: { fontSize: 13.5, fontWeight: '700', color: '#0f172a' },
  contactSub: { fontSize: 11, color: '#94a3b8', fontWeight: '500', marginTop: 2 },
  contactDivider: { height: 1, backgroundColor: '#f1f5f9' },

  reportCard: { backgroundColor: '#ffffff', borderRadius: 14, borderWidth: 1, borderColor: '#eef2f6', padding: 16 },
  reportText: { fontSize: 12.5, color: '#64748b', fontWeight: '500', marginBottom: 14 },
  reportButtons: { flexDirection: 'row', gap: 12 },
  reportButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e6ebf1', borderRadius: 10, paddingVertical: 11 },
  reportButtonText: { fontSize: 12.5, fontWeight: '700', color: '#0f172a' },


  versionBox: { alignItems: 'center', marginTop: 20 },
  versionText: { fontSize: 12.5, fontWeight: '600', color: '#64748b' },
  versionSub: { fontSize: 11.5, color: '#94a3b8', marginTop: 3 },
  updateLink: { fontSize: 12.5, fontWeight: '700', color: '#2563eb', marginTop: 8 },
});

export default HelpSupport;
