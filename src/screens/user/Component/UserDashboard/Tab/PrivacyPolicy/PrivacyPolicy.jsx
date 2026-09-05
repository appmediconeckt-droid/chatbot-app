import React, { useEffect, useState } from 'react';
import {
  Alert,
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import useLanguageRender from '../../../../../../hooks/useLanguageRender';
import { PATIENT, DOCTOR } from '../../../../../../theme/palette';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const SUPPORT_EMAIL = 'support@humaeli.com';

// ─── Static content (mirrors the Figma) ───────────────────────────────────────
const PROTECTED_FEATURES = [
  { icon: 'lock-closed', label: 'End-to-end\nencryption' },
  { icon: 'shield-checkmark', label: 'GDPR certified\naccess' },
  { icon: 'eye-off', label: 'Anonymous\nconsultation' },
  { icon: 'card', label: 'Secure wallet\ntransactions' },
];

const DATA_GROUPS = [
  {
    id: 'profile',
    icon: 'person-outline',
    title: 'Personal Profile',
    collects: ['Name, age and gender', 'Contact details', 'Health preferences'],
    purpose: ['Personalise your care experience', 'Match you with the right consultant'],
  },
  {
    id: 'chats',
    icon: 'chatbubbles-outline',
    title: 'Chats & Calls',
    collects: ['Messages and quick replies', 'Chat status and attachments', 'Accepted chat sessions'],
    purpose: ['Provide continuous conversation history', 'Enable consultant support during sessions'],
  },
  {
    id: 'appointments',
    icon: 'calendar-outline',
    title: 'Appointments',
    collects: ['Booking date and time', 'Selected consultant', 'Session notes'],
    purpose: ['Manage your upcoming sessions', 'Send timely reminders'],
  },
  {
    id: 'wallet',
    icon: 'wallet-outline',
    title: 'Wallet & Transactions',
    collects: ['Recharge and payment history', 'Refund records', 'Transaction receipts'],
    purpose: ['Process payments securely', 'Maintain accurate billing history'],
  },
];

// A privacy policy has to say what rights you have, who else sees the data and
// how long it is kept. Those three were missing - the page only described what
// gets collected.
const RIGHTS = [
  {
    icon: 'eye-outline',
    id: 'access',
    title: 'Access Your Data',
    desc: 'Learn how to view your personal information',
  },
  {
    icon: 'create-outline',
    id: 'correct',
    title: 'Correct Your Data',
    desc: 'Update your information from your profile',
  },
  {
    icon: 'trash-outline',
    id: 'delete',
    title: 'Delete Account',
    desc: 'Learn how to permanently delete your account',
  },
  {
    icon: 'megaphone-outline',
    id: 'grievance',
    title: 'Raise a Grievance',
    desc: 'Report an issue or contact Humaeli Support',
  },
  {
    icon: 'wallet-outline',
    id: 'refund',
    title: 'Refund',
    desc: 'Learn how refund requests are processed',
  },
];

const RIGHT_DETAILS = {
  access: {
    paragraphs: [
      'You have the right to access the personal information associated with your Humaeli account.',
      'You can view most of your personal information directly from your Profile section. This may include your name and profile information, email address, mobile number, profile photo, account-related information, app preferences, appointment-related information, and other personal information available in your profile.',
    ],
    steps: ['Open the Humaeli app.', 'Go to the Profile section.', 'View the personal information associated with your account.'],
    action: 'Go to Profile',
  },
  correct: {
    paragraphs: [
      'You have the right to correct or update inaccurate or outdated personal information associated with your Humaeli account.',
      'Please ensure that the information you provide is accurate and up to date.',
    ],
    steps: ['Open your Profile.', 'Tap the Edit or Edit Profile button.', 'Update the required information.', 'Review your changes.', 'Tap Save or Update to save the updated information.'],
    action: 'Go to Profile',
  },
  delete: {
    paragraphs: [
      'You have the right to request deletion of your Humaeli account and associated personal data.',
    ],
    steps: ['Open the Humaeli app.', 'Go to Settings.', 'Find the Delete Account option.', 'Tap Delete Account.', 'Read the deletion warning carefully.', 'Confirm that you want to permanently delete your account.'],
    warning: 'Deleting your account is permanent. You may lose access to the account and your profile information may be deleted according to Humaeli\'s data deletion policy. Records that Humaeli must retain for legal, financial, security, fraud-prevention, or regulatory reasons may be kept for the required period. Review active services, appointments, wallet, refund requests, and other pending activities first.',
    action: 'Go to Settings',
  },
  grievance: {
    paragraphs: [
      'If you have a concern, complaint, privacy-related issue, account problem, payment issue, technical problem, or any other concern regarding Humaeli, you can raise a grievance through our Help & Support section.',
    ],
    steps: ['Open the Humaeli app.', 'Go to Help & Support.', 'Tap Report an Issue.', 'Select or describe your issue.', 'Add the required details.', 'Submit your request.'],
    footer: `Our support team will review your request and assist you. You can also contact us at ${SUPPORT_EMAIL}.`,
    action: 'Go to Help & Support',
    secondaryAction: 'Email Support',
  },
  refund: {
    paragraphs: [
      'If you are eligible for a refund, you can submit a refund request through Humaeli.',
      'Refund eligibility may depend on the service or payment status and Humaeli\'s refund policy. Submitting a refund request does not automatically guarantee approval.',
    ],
    steps: ['Submit a refund request from the payment/refund section of the Humaeli app.', 'Provide the required refund details.', 'Your refund request will be sent to the Humaeli Admin for review.', 'The Admin will verify the request.', 'Once approved, the refundable amount will be credited to your Humaeli Wallet.', 'The approved refund should normally be processed to the Humaeli Wallet within approximately 24 hours after approval.'],
    flow: 'Refund Request  →  Admin Review  →  Admin Approval  →  Refund Processed  →  Amount Added to Humaeli Wallet',
    footer: 'Contact Help & Support if you have any issue with your refund.',
    action: 'Request Refund',
  },
};

const SHARING = [
  'Counselors you book see only what a session needs — your name (or anonymous label), age, gender and the chat history of that session.',
  'We do not sell your data, and we do not share it for advertising.',
  'Data may be disclosed if required by law or to protect someone from serious harm.',
];

const RETENTION = [
  'Chats, calls and appointment records are kept while your account is active so your history stays available.',
  'Wallet and transaction records are kept as long as tax and accounting rules require.',
  'After you delete your account, personal data is removed except where law requires us to keep it.',
];

const CHECKLIST = [
  'Never share OTP with anyone',
  'Enable App Lock in settings',
  'Keep emergency contact updated',
  'Review device permissions regularly',
];

const LAST_UPDATED = 'July 2026';

const PrivacyPolicy = ({ onClose, onOpenTab, onOpenHelpSupport, onOpenRefund }) => {
  const { t } = useLanguageRender();
  const [C, setC] = useState(PATIENT);
  const [role, setRole] = useState('user');
  const [expanded, setExpanded] = useState('chats');
  const [expandedRight, setExpandedRight] = useState(null);

  useEffect(() => {
    (async () => {
      const [userRole, roleKey, userType] = await Promise.all([
        AsyncStorage.getItem('userRole'),
        AsyncStorage.getItem('role'),
        AsyncStorage.getItem('userType'),
      ]);
      const norm = (v) => String(v || '').trim().toLowerCase();
      const isCounselor = [userRole, roleKey, userType]
        .map(norm)
        .some((v) => v === 'counselor' || v === 'counsellor');
      setRole(isCounselor ? 'counselor' : 'user');
      setC(isCounselor ? DOCTOR : PATIENT);
    })();
  }, []);

  const toggle = (id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((cur) => (cur === id ? null : id));
  };

  const openTab = (tab) => {
    if (typeof onOpenTab === 'function') {
      onClose?.();
      onOpenTab(tab);
    }
  };

  const openRight = (right) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedRight((current) => (current === right.id ? null : right.id));
  };

  const handleRightAction = (rightId, action) => {
    if (action === 'Go to Profile') openTab('profile');
    else if (action === 'Go to Settings') openTab('settings');
    else if (action === 'Go to Help & Support') {
      onClose?.();
      onOpenHelpSupport?.();
    } else if (action === 'Email Support') openSupport('Humaeli Support / Grievance Request');
    else if (action === 'Request Refund') {
      onClose?.();
      onOpenRefund?.();
    }
  };

  const renderRightDetails = (rightId) => {
    const details = RIGHT_DETAILS[rightId];
    if (!details) return null;
    return (
      <View style={s.rightDetails}>
        {details.paragraphs.map((paragraph) => (
          <Text key={paragraph} style={s.rightDetailText}>{t(paragraph)}</Text>
        ))}
        {details.steps && (
          <View style={s.rightSteps}>
            {details.steps.map((step, index) => (
              <View key={step} style={s.rightStep}>
                <View style={[s.stepNumber, { backgroundColor: C.primary }]}>
                  <Text style={s.stepNumberText}>{index + 1}</Text>
                </View>
                <Text style={s.rightDetailText}>{t(step)}</Text>
              </View>
            ))}
          </View>
        )}
        {details.warning && (
          <View style={s.rightWarning}>
            <Ionicons name="warning-outline" size={17} color="#B45309" />
            <Text style={s.rightWarningText}>{t(details.warning)}</Text>
          </View>
        )}
        {details.flow && <Text style={[s.rightFlow, { color: C.primary }]}>{t(details.flow)}</Text>}
        {details.footer && <Text style={s.rightDetailText}>{t(details.footer)}</Text>}
        <View style={s.rightActions}>
          <TouchableOpacity
            style={[s.rightPrimaryAction, { backgroundColor: C.primary }]}
            onPress={() => handleRightAction(rightId, details.action)}
            activeOpacity={0.85}
          >
            <Text style={s.rightPrimaryActionText}>{t(details.action)}</Text>
          </TouchableOpacity>
          {details.secondaryAction && (
            <TouchableOpacity style={s.rightSecondaryAction} onPress={() => handleRightAction(rightId, details.secondaryAction)} activeOpacity={0.85}>
              <Text style={[s.rightSecondaryActionText, { color: C.primary }]}>{t(details.secondaryAction)}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // Opens a privacy-specific support email directly. This button used to call
  // openTab('support'), which matched no dashboard tab and quietly dumped the
  // user on the chat list. Contacting support about privacy shouldn't detour
  // through the whole help screen either - the subject is pre-filled so the
  // question lands in the right place.
  const openSupport = (subjectText = 'Privacy question - Humaeli') => {
    const subject = encodeURIComponent(subjectText);
    const body = encodeURIComponent(
      'Please describe your privacy or data question below:\n\n',
    );
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`).catch(() => {
      Alert.alert('Contact Support', `Please email us at ${SUPPORT_EMAIL}`);
    });
  };

  const QUICK_ACTIONS = [
    { icon: 'person-outline', title: 'Manage Profile', sub: 'Update details', onPress: () => openTab('profile') },
    { icon: 'shield-checkmark-outline', title: 'Security Settings', sub: 'Passwords & OTP', onPress: () => openTab('settings') },
    // { icon: 'trash-outline', title: 'Delete Account', sub: 'Remove data', danger: true, onPress: () => openTab('settings') },
  ];

  return (
    <View style={[s.root, { backgroundColor: C.backgroundTint }]}>
      <StatusBar barStyle="dark-content" backgroundColor={C.backgroundTint} />
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
        {/* ── Protected hero ──────────────────────────────────────────────── */}
        <LinearGradient
          colors={[C.gradientFrom, C.gradientTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.hero}
        >
          <View style={s.heroTop}>
            <View style={s.heroShield}>
              <Ionicons name="shield-checkmark" size={26} color="#fff" />
            </View>
            <View>
              <Text style={s.heroTitle}>{t('Protected')}</Text>
              <Text style={s.heroSub}>{t('Your data is secure')}</Text>
            </View>
          </View>
          <View style={s.heroGrid}>
            {PROTECTED_FEATURES.map((f) => (
              <View key={f.icon} style={s.heroFeature}>
                <Ionicons name={f.icon} size={16} color="#fff" />
                <Text style={s.heroFeatureText}>{t(f.label)}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* ── Quick actions ───────────────────────────────────────────────── */}
        {/* Full-width rows, not a 2-column grid: the grid only lined up at an
            even number of cards, and a lone card on the last row stretched to
            full width because of flexGrow. */}
        <Text style={s.sectionTitle}>{t('QUICK ACTIONS')}</Text>
        <View style={s.card}>
          {QUICK_ACTIONS.map((a, idx) => (
            <TouchableOpacity
              key={a.title}
              style={[s.actionRow, idx === QUICK_ACTIONS.length - 1 && s.rowLast]}
              activeOpacity={0.7}
              onPress={a.onPress}
            >
              <View style={[s.rowIcon, { backgroundColor: a.danger ? '#FEECEC' : C.secondaryTint }]}>
                <Ionicons name={a.icon} size={19} color={a.danger ? C.danger : C.primary} />
              </View>
              <View style={s.rowBody}>
                <Text style={[s.rowTitle, a.danger && { color: C.danger }]}>{t(a.title)}</Text>
                <Text style={s.rowSub}>{t(a.sub)}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Data collection accordion ───────────────────────────────────── */}
        <Text style={s.sectionTitle}>{t('DATA COLLECTION')}</Text>
        <View style={s.accordion}>
          {DATA_GROUPS.map((g) => {
            const open = expanded === g.id;
            return (
              <View key={g.id} style={s.accItem}>
                <TouchableOpacity style={s.accHead} activeOpacity={0.8} onPress={() => toggle(g.id)}>
                  <View style={[s.accIcon, { backgroundColor: C.secondaryTint }]}>
                    <Ionicons name={g.icon} size={19} color={C.primary} />
                  </View>
                  <Text style={s.accTitle}>{t(g.title)}</Text>
                  <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color="#94A3B8" />
                </TouchableOpacity>

                {open && (
                  <View style={s.accBody}>
                    <Text style={s.accLabel}>What Humaeli Collects:</Text>
                    {g.collects.map((c) => (
                      <View key={c} style={s.bulletRow}>
                        <View style={[s.bulletDot, { backgroundColor: C.primary }]} />
                        <Text style={s.bulletText}>{t(c)}</Text>
                      </View>
                    ))}

                    <Text style={[s.accLabel, { marginTop: 14 }]}>Purpose:</Text>
                    {g.purpose.map((p) => (
                      <View key={p} style={s.bulletRow}>
                        <View style={[s.bulletDot, { backgroundColor: C.primary }]} />
                        <Text style={s.bulletText}>{t(p)}</Text>
                      </View>
                    ))}

                    <View style={[s.infoBox, { backgroundColor: C.secondaryTint, borderColor: C.border }]}>
                      <Ionicons name="lock-closed" size={15} color={C.primary} />
                      <Text style={[s.infoText, { color: C.primary }]}>
                        All interactions are end-to-end encrypted and stored securely.
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* ── Your rights ─────────────────────────────────────────────────── */}
        <Text style={s.sectionTitle}>{t('YOUR RIGHTS')}</Text>
        <View style={s.card}>
          {RIGHTS.map((r, idx) => (
            <View key={r.title} style={[s.rightItem, idx === RIGHTS.length - 1 && s.rowLast]}>
              <TouchableOpacity
                style={s.actionRow}
                activeOpacity={0.7}
                onPress={() => openRight(r)}
                accessibilityRole="button"
                accessibilityLabel={t(r.title)}
              >
              <View style={[s.rowIcon, { backgroundColor: C.secondaryTint }]}>
                <Ionicons name={r.icon} size={19} color={C.primary} />
              </View>
              <View style={s.rowBody}>
                <Text style={s.rowTitle}>{t(r.title)}</Text>
                <Text style={s.rowSub}>{t(r.desc)}</Text>
              </View>
              <Ionicons name={expandedRight === r.id ? 'chevron-up' : 'chevron-forward'} size={18} color="#CBD5E1" />
              </TouchableOpacity>
              {expandedRight === r.id && renderRightDetails(r.id)}
            </View>
          ))}
        </View>

        {/* ── Who your data reaches ───────────────────────────────────────── */}
        <Text style={s.sectionTitle}>{t('DATA SHARING')}</Text>
        <View style={[s.card, s.policyList]}>
          {SHARING.map((line) => (
            <View key={line} style={s.policyRow}>
              <View style={[s.policyDot, { backgroundColor: C.primary }]} />
              <Text style={s.policyText}>{t(line)}</Text>
            </View>
          ))}
        </View>

        {/* ── How long it is kept ─────────────────────────────────────────── */}
        <Text style={s.sectionTitle}>{t('DATA RETENTION')}</Text>
        <View style={[s.card, s.policyList]}>
          {RETENTION.map((line) => (
            <View key={line} style={s.policyRow}>
              <View style={[s.policyDot, { backgroundColor: C.primary }]} />
              <Text style={s.policyText}>{t(line)}</Text>
            </View>
          ))}
        </View>

        {/* ── Privacy checklist ───────────────────────────────────────────── */}
        <Text style={s.sectionTitle}>{t('YOUR PRIVACY CHECKLIST')}</Text>
        <View style={[s.card, s.policyList]}>
          {CHECKLIST.map((item) => (
            <View key={item} style={s.checkRow}>
              <Ionicons name="checkmark-circle" size={20} color={C.online} />
              <Text style={s.checkText}>{t(item)}</Text>
            </View>
          ))}
        </View>

        {/* ── Help card ───────────────────────────────────────────────────── */}
        <LinearGradient
          colors={[C.gradientFrom, C.gradientTo]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.helpCard}
        >
          <View style={s.helpIcon}>
            <Ionicons name="help-buoy-outline" size={24} color="#fff" />
          </View>
          <Text style={s.helpTitle}>{t('Need help with privacy?')}</Text>
          <Text style={s.helpText}>
            Our support team is here to answer any questions about your data security.
          </Text>
          <TouchableOpacity style={s.helpPrimary} activeOpacity={0.85} onPress={openSupport}>
            <Text style={[s.helpPrimaryText, { color: C.primary }]}>{t('Contact Support')}</Text>
          </TouchableOpacity>
          {/* <TouchableOpacity style={s.helpSecondary} activeOpacity={0.85} onPress={() => openTab('settings')}>
            <Text style={s.helpSecondaryText}>{t('Privacy Settings')}</Text>
          </TouchableOpacity> */}
        </LinearGradient>

        {/* A policy with no effective date can't be relied on. */}
        {/* <Text style={s.stamp}>Last updated: {LAST_UPDATED}</Text> */}
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
  hero: { borderRadius: 22, padding: 18 },
  heroTop: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  heroShield: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 14,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  heroTitle: { color: '#fff', fontSize: 20, fontWeight: '900' },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 1 },
  heroGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 18 },
  heroFeature: { alignItems: 'flex-start', flexDirection: 'row', gap: 8, paddingVertical: 8, width: '50%' },
  heroFeatureText: { color: '#fff', fontSize: 12.5, fontWeight: '600', lineHeight: 16 },

  // Section
  sectionTitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 24,
  },

  // Quick actions
  // One card shell reused by Quick actions / Rights / Sharing / Retention so the
  // sections line up with each other instead of each inventing its own box.
  card: {
    backgroundColor: '#fff',
    borderColor: '#EEF0F5',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  actionRow: {
    alignItems: 'center',
    borderBottomColor: '#F1F5F9',
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 13,
  },
  rightItem: { borderBottomColor: '#F1F5F9', borderBottomWidth: 1 },
  rightDetails: { paddingBottom: 16, paddingHorizontal: 14 },
  rightDetailText: { color: '#64748B', fontSize: 13, lineHeight: 19, marginBottom: 9 },
  rightSteps: { marginBottom: 5, marginTop: 2 },
  rightStep: { alignItems: 'flex-start', flexDirection: 'row', gap: 9, marginBottom: 8 },
  stepNumber: { alignItems: 'center', borderRadius: 10, height: 20, justifyContent: 'center', width: 20 },
  stepNumberText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  rightWarning: { alignItems: 'flex-start', backgroundColor: '#FFF7ED', borderColor: '#FED7AA', borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 8, marginBottom: 10, padding: 11 },
  rightWarningText: { color: '#92400E', flex: 1, fontSize: 12, lineHeight: 18 },
  rightFlow: { fontSize: 12, fontWeight: '800', lineHeight: 18, marginBottom: 10 },
  rightActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 3 },
  rightPrimaryAction: { alignItems: 'center', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  rightPrimaryActionText: { color: '#fff', fontSize: 12.5, fontWeight: '800' },
  rightSecondaryAction: { alignItems: 'center', borderColor: '#D8E8DE', borderRadius: 10, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  rightSecondaryActionText: { fontSize: 12.5, fontWeight: '800' },
  rowLast: { borderBottomWidth: 0 },
  rowIcon: {
    alignItems: 'center',
    borderRadius: 11,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  // flex:1 so the title/description column takes the leftover width and the
  // chevron stays pinned right on every row.
  rowBody: { flex: 1 },
  rowTitle: { color: '#0f172a', fontSize: 14, fontWeight: '800' },
  rowSub: { color: '#94A3B8', fontSize: 12, lineHeight: 17, marginTop: 2 },
  stamp: {
    color: '#94A3B8',
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 18,
    textAlign: 'center',
  },

  // Accordion
  accordion: { gap: 10 },
  accItem: {
    backgroundColor: '#fff',
    borderColor: '#EEF0F5',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  accHead: { alignItems: 'center', flexDirection: 'row', gap: 12, padding: 14 },
  accIcon: { alignItems: 'center', borderRadius: 11, height: 38, justifyContent: 'center', width: 38 },
  accTitle: { color: '#0f172a', flex: 1, fontSize: 15, fontWeight: '800' },
  accBody: { paddingBottom: 16, paddingHorizontal: 16, paddingTop: 2 },
  accLabel: { color: '#334155', fontSize: 12.5, fontWeight: '800', marginBottom: 8 },
  bulletRow: { alignItems: 'center', flexDirection: 'row', gap: 9, paddingVertical: 3 },
  bulletDot: { borderRadius: 3, height: 6, width: 6 },
  bulletText: { color: '#64748B', flex: 1, fontSize: 13, lineHeight: 18 },

  // Long-form bullets (sharing / retention). Unlike bulletRow above these wrap
  // to several lines, so the dot is pinned to the first line rather than
  // centred against the whole paragraph.
  policyList: { paddingVertical: 12 },
  policyRow: { flexDirection: 'row', gap: 10, paddingVertical: 5 },
  policyDot: { borderRadius: 3, height: 6, marginTop: 7, width: 6 },
  policyText: { color: '#64748B', flex: 1, fontSize: 13, lineHeight: 19 },
  infoBox: {
    alignItems: 'flex-start',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    padding: 12,
  },
  infoText: { flex: 1, fontSize: 12, fontWeight: '600', lineHeight: 17 },

  // Checklist
  checkRow: { alignItems: 'center', flexDirection: 'row', gap: 11, paddingVertical: 8 },
  checkText: { color: '#334155', flex: 1, fontSize: 13.5, fontWeight: '600' },

  // Help
  helpCard: { alignItems: 'center', borderRadius: 22, marginTop: 24, padding: 22 },
  helpIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 16,
    height: 50,
    justifyContent: 'center',
    marginBottom: 12,
    width: 50,
  },
  helpTitle: { color: '#fff', fontSize: 17, fontWeight: '900' },
  helpText: { color: 'rgba(255,255,255,0.9)', fontSize: 13, lineHeight: 19, marginTop: 6, textAlign: 'center' },
  helpPrimary: {
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: '#fff',
    borderRadius: 14,
    marginTop: 18,
    paddingVertical: 13,
  },
  helpPrimaryText: { fontSize: 14.5, fontWeight: '800' },
  helpSecondary: {
    alignItems: 'center',
    alignSelf: 'stretch',
    borderColor: 'rgba(255,255,255,0.6)',
    borderRadius: 14,
    borderWidth: 1.5,
    marginTop: 10,
    paddingVertical: 13,
  },
  helpSecondaryText: { color: '#fff', fontSize: 14.5, fontWeight: '800' },
});

export default PrivacyPolicy;
