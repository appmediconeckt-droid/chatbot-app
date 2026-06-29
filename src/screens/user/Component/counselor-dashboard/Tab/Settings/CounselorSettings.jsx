import React, { useState, useEffect, useRef } from 'react';
import useLanguageRender from '../../../../../../hooks/useLanguageRender';
import TranslatedMessageBubble from '../../../../../../components/TranslatedMessageBubble';
import { useNavigation } from '@react-navigation/native';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Switch,
  Dimensions,
  Animated,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Feather from 'react-native-vector-icons/Feather';
import { API_BASE_URL } from '../../../../../../axiosConfig';
import HelpSupport from '../../../UserDashboard/Tab/HelpSupport/HelpSupport';
import PrivacyPolicy from '../../../UserDashboard/Tab/PrivacyPolicy/PrivacyPolicy';
import CounselorWallet from '../Wallet/CounselorWallet';

const TERMS_URL = 'https://mediconeckt.com/terms-of-use/';

const useShimmer = () => {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 850, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 850, useNativeDriver: true }),
      ])
    ).start();
  }, [anim]);
  return anim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });
};

const SettingsSkeleton = () => {
  const opacity = useShimmer();
  const SkRow = () => (
    <View style={skel.row}>
      <Animated.View style={[skel.iconBox, { opacity }]} />
      <View style={skel.body}>
        <Animated.View style={[skel.lineLg, { opacity }]} />
        <Animated.View style={[skel.lineSm, { opacity }]} />
      </View>
      <Animated.View style={[skel.trailDot, { opacity }]} />
    </View>
  );
  const SkSection = ({ rows = 3 }) => (
    <View style={skel.section}>
      <Animated.View style={[skel.sectionLabel, { opacity }]} />
      <View style={skel.card}>
        {Array.from({ length: rows }).map((_, i) => (
          <SkRow key={i} />
        ))}
      </View>
    </View>
  );
  return (
    <View style={skel.wrap}>
      <View style={skel.quickRow}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={skel.quickItem}>
            <Animated.View style={[skel.quickIcon, { opacity }]} />
            <Animated.View style={[skel.quickLabel, { opacity }]} />
          </View>
        ))}
      </View>
      <SkSection rows={4} />
      <SkSection rows={2} />
      <SkSection rows={3} />
    </View>
  );
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const formatName = (full) => {
  if (!full) return '';
  const trimmed = String(full).trim();
  if (!trimmed) return '';
  return /^(dr\.?|mr\.?|mrs\.?|ms\.?)\s/i.test(trimmed)
    ? trimmed
    : `Dr. ${trimmed}`;
};

const firstName = (full) => {
  const name = formatName(full).replace(/^(dr\.?|mr\.?|mrs\.?|ms\.?)\s+/i, '');
  return name.split(/\s+/)[0] || '';
};

const INITIAL_PW_FORM = { otp: '', password: '', confirmPassword: '', oldPassword: '', newPassword: '', confirmNewPassword: '' };

// Availability status options. Frontend-only for now — the choice is persisted
// in AsyncStorage and shown in the UI. Wire `key` to a backend status field
// later (model currently only has the isOnline boolean).
const AVAILABILITY_KEY = 'counselorAvailabilityStatus';
const AVAIL_STATUSES = [
  { key: 'online',  label: 'Online',  color: '#16A34A', bg: '#DCFCE7', icon: 'check-circle', desc: 'Available — accepting new clients' },
  { key: 'busy',    label: 'Busy',    color: '#DC2626', bg: '#FEE2E2', icon: 'minus-circle', desc: 'In a session — not taking new requests' },
  { key: 'away',    label: 'Away',    color: '#D97706', bg: '#FEF3C7', icon: 'clock',        desc: 'Stepped away — back shortly' },
  { key: 'offline', label: 'Offline', color: '#6B7280', bg: '#F3F4F6', icon: 'power',        desc: 'Not available right now' },
];

const FEEDBACK_CATEGORIES = [
  { key: 'bug', label: 'Bug', icon: 'alert-triangle' },
  { key: 'suggestion', label: 'Suggestion', icon: 'zap' },
  { key: 'other', label: 'Other', icon: 'message-circle' },
];

const CounselorSettings = ({ onNavigate, onLogout }) => {
  const navigation = useNavigation();
  const { t } = useLanguageRender();
  const [counselor, setCounselor] = useState(null);
  const [loading, setLoading] = useState(true);

  // Availability status (frontend-only, persisted locally)
  const [availStatus, setAvailStatus] = useState('online');
  const [availModal, setAvailModal] = useState(false);

  // In-app info screens
  const [showHelp, setShowHelp] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showWallet, setShowWallet] = useState(false);

  // Feedback modal state
  const [feedbackModal, setFeedbackModal] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState('suggestion');
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState({ type: '', msg: '' });

  const handleSubmitFeedback = async () => {
    if (!feedbackMessage.trim()) {
      setFeedbackNotice({ type: 'error', msg: 'Please enter your feedback.' });
      return;
    }
    setFeedbackLoading(true);
    setFeedbackNotice({ type: '', msg: '' });
    try {
      const token =
        (await AsyncStorage.getItem('token')) ||
        (await AsyncStorage.getItem('accessToken'));
      const res = await axios.post(
        `${API_BASE_URL}/api/feedback`,
        { category: feedbackCategory, message: feedbackMessage.trim() },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.data?.success) {
        setFeedbackNotice({ type: 'success', msg: res.data.message || 'Thank you for your feedback!' });
        setFeedbackMessage('');
      } else {
        setFeedbackNotice({ type: 'error', msg: res.data?.error || 'Failed to send feedback.' });
      }
    } catch (err) {
      setFeedbackNotice({
        type: 'error',
        msg: err.response?.data?.error || err.message || 'Failed to send feedback.',
      });
    } finally {
      setFeedbackLoading(false);
    }
  };

  // Password modal state
  const [pwModal, setPwModal] = useState(false);
  const [pwMode, setPwMode] = useState('change'); // 'change' | 'set'
  const [pwForm, setPwForm] = useState(INITIAL_PW_FORM);
  const [otpSent, setOtpSent] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwNotice, setPwNotice] = useState({ type: '', msg: '' });
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const openPwModal = (mode) => {
    setPwMode(mode);
    setPwForm(INITIAL_PW_FORM);
    setOtpSent(false);
    setPwNotice({ type: '', msg: '' });
    setShowOld(false); setShowNew(false); setShowConfirm(false);
    setPwModal(true);
  };

  const setPw = (key, val) =>
    setPwForm((prev) => ({ ...prev, [key]: key === 'otp' ? val.replace(/\D/g, '') : val }));

  const handleSendOtp = async () => {
    setPwNotice({ type: '', msg: '' });
    const email = counselor?.email?.trim().toLowerCase();
    if (!email) { setPwNotice({ type: 'error', msg: 'Email not found.' }); return; }
    setPwLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/auth/generateOtp`, { email });
      if (res.data?.success) {
        setOtpSent(true);
        setPwNotice({ type: 'success', msg: res.data.message || 'OTP sent to your email.' });
      } else {
        setPwNotice({ type: 'error', msg: res.data?.message || 'Failed to send OTP.' });
      }
    } catch (err) {
      setPwNotice({ type: 'error', msg: err.response?.data?.message || err.message || 'Failed to send OTP.' });
    } finally { setPwLoading(false); }
  };

  const handleSetPassword = async () => {
    setPwNotice({ type: '', msg: '' });
    if (!otpSent) { setPwNotice({ type: 'error', msg: 'Please request an OTP first.' }); return; }
    if (!pwForm.otp || pwForm.otp.length !== 6) { setPwNotice({ type: 'error', msg: 'Enter the 6-digit OTP.' }); return; }
    if (pwForm.password.length < 6) { setPwNotice({ type: 'error', msg: 'Password must be at least 6 characters.' }); return; }
    if (pwForm.password !== pwForm.confirmPassword) { setPwNotice({ type: 'error', msg: 'Passwords do not match.' }); return; }
    setPwLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/auth/set-password-by-otp`, {
        email: counselor?.email?.trim().toLowerCase(),
        otp: pwForm.otp,
        password: pwForm.password,
      });
      if (res.data?.success) {
        setPwNotice({ type: 'success', msg: res.data.message || 'Password set successfully.' });
        setPwForm(INITIAL_PW_FORM);
        setOtpSent(false);
        setPwModal(false);
      } else {
        setPwNotice({ type: 'error', msg: res.data?.message || 'Failed to set password.' });
      }
    } catch (err) {
      setPwNotice({ type: 'error', msg: err.response?.data?.message || err.message || 'Failed to set password.' });
    } finally { setPwLoading(false); }
  };

  const handleChangePassword = async () => {
    setPwNotice({ type: '', msg: '' });
    if (!pwForm.oldPassword) { setPwNotice({ type: 'error', msg: 'Enter your current password.' }); return; }
    if (pwForm.newPassword.length < 6) { setPwNotice({ type: 'error', msg: 'New password must be at least 6 characters.' }); return; }
    if (pwForm.newPassword !== pwForm.confirmNewPassword) { setPwNotice({ type: 'error', msg: 'Passwords do not match.' }); return; }
    if (pwForm.oldPassword === pwForm.newPassword) { setPwNotice({ type: 'error', msg: 'New password must differ from current.' }); return; }
    setPwLoading(true);
    try {
      const token = await AsyncStorage.getItem('token') || await AsyncStorage.getItem('accessToken');
      const res = await axios.post(`${API_BASE_URL}/api/auth/changePassword`,
        { oldPassword: pwForm.oldPassword, newPassword: pwForm.newPassword },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.data?.success) {
        setPwNotice({ type: 'success', msg: res.data.message || 'Password changed successfully.' });
        setPwForm(INITIAL_PW_FORM);
      } else throw new Error(res.data?.message || 'Failed to change password.');
    } catch (err) {
      setPwNotice({ type: 'error', msg: err.response?.data?.message || err.message || 'Failed to change password.' });
    } finally { setPwLoading(false); }
  };

  useEffect(() => {
    fetchCounselor();
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(AVAILABILITY_KEY);
        if (saved && AVAIL_STATUSES.some((s) => s.key === saved)) {
          setAvailStatus(saved);
        }
      } catch (err) {
        console.log('Failed to load availability status', err);
      }
    })();
  }, []);

  const handleSelectAvailability = async (key) => {
    const prev = availStatus;
    setAvailStatus(key); // optimistic
    setAvailModal(false);
    try {
      await AsyncStorage.setItem(AVAILABILITY_KEY, key);
      const token =
        (await AsyncStorage.getItem('token')) ||
        (await AsyncStorage.getItem('accessToken'));
      await axios.patch(
        `${API_BASE_URL}/api/chat/availability`,
        { status: key },
        { headers: { Authorization: `Bearer ${token}` } },
      );
    } catch (err) {
      console.log('Failed to update availability status', err);
      setAvailStatus(prev); // revert on failure
      try { await AsyncStorage.setItem(AVAILABILITY_KEY, prev); } catch {}
    }
  };

  const fetchCounselor = async () => {
    try {
      setLoading(true);
      const counsellorId = await AsyncStorage.getItem('counsellorId');
      const token = await AsyncStorage.getItem('token');
      if (!counsellorId) {
        setLoading(false);
        return;
      }
      const res = await axios.get(
        `${API_BASE_URL}/api/auth/counsellors/${counsellorId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.success && res.data.counsellor) {
        setCounselor(res.data.counsellor);
        // Server is the source of truth for availability — override local cache.
        const serverStatus = res.data.counsellor.availabilityStatus;
        if (serverStatus && AVAIL_STATUSES.some((s) => s.key === serverStatus)) {
          setAvailStatus(serverStatus);
          AsyncStorage.setItem(AVAILABILITY_KEY, serverStatus).catch(() => {});
        }
      }
    } catch (err) {
      console.error('Settings: failed to load counselor', err);
    } finally {
      setLoading(false);
    }
  };

  const handleNav = (id) => {
    if (id === 'profile') return onNavigate?.('profile');
    if (id === 'payout') return setShowWallet(true);
    if (id === 'change_password') return openPwModal('change');
    if (id === 'add_password') return openPwModal('set');
    if (id === 'app_lock') return navigation.navigate('PinSetup');
    if (id === 'availability') return setAvailModal(true);
    if (id === 'contact')
      return Linking.openURL('mailto:support@mediconeckt.com');
    if (id === 'help') return setShowHelp(true);
    if (id === 'privacy') return setShowPrivacy(true);
    if (id === 'terms') return Linking.openURL(TERMS_URL);
    if (id === 'feedback') {
      setFeedbackNotice({ type: '', msg: '' });
      return setFeedbackModal(true);
    }
  };

  const profileName =
    formatName(counselor?.fullName || counselor?.name) || 'Your Profile';
  const profileSubtitle =
    counselor?.email ||
    counselor?.phoneNumber ||
    counselor?.phone ||
    'Personal & professional details';
  const payoutSubtitle = counselor?.payoutAccount?.maskedNumber
    ? `${counselor.payoutAccount.bankName || 'Bank'} •••• ${counselor.payoutAccount.maskedNumber}`
    : 'Add a bank account for payouts';
  const payoutBadge = counselor?.payoutAccount?.verified ? 'Verified' : null;
  const currentAvail =
    AVAIL_STATUSES.find((s) => s.key === availStatus) || AVAIL_STATUSES[0];

  const SECTIONS = [
    {
      title: t('settings:account'),
      items: [
        {
          id: 'profile',
          icon: 'user',
          iconBg: '#EFF6FF',
          iconColor: '#2563EB',
          label: t('counselor:editProfile'),
          subtitle: profileSubtitle,
          value: firstName(counselor?.fullName || counselor?.name) || null,
          type: 'nav',
        },
        {
          id: 'availability',
          icon: currentAvail.icon,
          iconBg: currentAvail.bg,
          iconColor: currentAvail.color,
          label: 'Availability',
          subtitle: currentAvail.desc,
          badge: currentAvail.label,
          badgeColor: currentAvail.color,
          type: 'nav',
        },
        {
          id: 'payout',
          icon: 'credit-card',
          iconBg: '#ecfeff',
          iconColor: '#0D9488',
          label: t('settings:payoutAccount'),
          subtitle: payoutSubtitle,
          badge: payoutBadge ? t('common:verified') : null,
          badgeColor: '#0D9488',
          type: 'nav',
        },
      ],
    },
    {
      title: t('settings:security'),
      items: [
        {
          id: 'change_password',
          icon: 'lock',
          iconBg: '#EFF6FF',
          iconColor: '#2563EB',
          label: t('settings:changePassword'),
          subtitle: t('settings:updatePassword'),
          type: 'nav',
        },
        {
          id: 'add_password',
          icon: 'key',
          iconBg: '#EFF6FF',
          iconColor: '#0D9488',
          label: t('settings:addPassword'),
          subtitle: t('settings:setPasswordOtp'),
          type: 'nav',
        },
        {
          id: 'app_lock',
          icon: 'smartphone',
          iconBg: '#EDE9FE',
          iconColor: '#7c3aed',
          label: t('settings:appLock'),
          subtitle: t('settings:pinFingerprint'),
          type: 'nav',
        },
      ],
    },
    {
      title: t('settings:support'),
      items: [
        {
          id: 'help',
          icon: 'help-circle',
          iconBg: '#FEF3C7',
          iconColor: '#D97706',
          label: t('settings:help'),
          subtitle: t('settings:commonQuestions'),
          type: 'nav',
        },
        {
          id: 'contact',
          icon: 'mail',
          iconBg: '#DCFCE7',
          iconColor: '#16A34A',
          label: t('settings:contactSupport'),
          subtitle: 'support@mediconeckt.com',
          type: 'nav',
        },
        {
          id: 'feedback',
          icon: 'edit-2',
          iconBg: '#EFF6FF',
          iconColor: '#0D9488',
          label: t('settings:sendFeedback'),
          subtitle: t('settings:helpUsImprove'),
          type: 'nav',
        },
      ],
    },
    {
      title: t('settings:legal'),
      items: [
        {
          id: 'terms',
          icon: 'file-text',
          iconBg: '#F9FAFB',
          iconColor: '#6B7280',
          label: t('settings:termsOfService'),
          subtitle: 'Read our terms of service',
          type: 'nav',
        },
        {
          id: 'privacy',
          icon: 'lock',
          iconBg: '#F9FAFB',
          iconColor: '#6B7280',
          label: t('settings:privacyPolicy'),
          subtitle: 'How we handle your data',
          type: 'nav',
        },
      ],
    },
  ];

  return (
    <>
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('settings:settings')}</Text>
        <Text style={styles.headerSub}>
          {loading ? t('counselor:loadingAccount') : t('counselor:signingInAs', { name: profileName })}
        </Text>
      </View>

      {/* Quick actions */}
      {!loading && (
        <View style={styles.quickRow}>
          {[
            { id: 'profile', icon: 'user', color: '#2563EB', bg: '#EFF6FF', label: t('settings:profile') },
            { id: 'availability', icon: 'calendar', color: '#0D9488', bg: '#F0FDFA', label: t('settings:schedule') },
            { id: 'payout', icon: 'credit-card', color: '#7C3AED', bg: '#F5F3FF', label: t('settings:payout') },
            { id: 'help', icon: 'help-circle', color: '#D97706', bg: '#FFFBEB', label: t('settings:help') },
          ].map((q) => (
            <TouchableOpacity
              key={q.id}
              style={styles.quickItem}
              activeOpacity={0.7}
              onPress={() => handleNav(q.id)}
            >
              <View style={[styles.quickIcon, { backgroundColor: q.bg }]}>
                <Feather name={q.icon} size={18} color={q.color} />
              </View>
              <Text style={styles.quickLabel}>{q.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {loading && <SettingsSkeleton />}

      {/* Sections */}
      {!loading && SECTIONS.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionLabel}>{section.title}</Text>
          <View style={styles.card}>
            {section.items.map((item, idx) => {
              const isLast = idx === section.items.length - 1;
              const RowWrap = item.type === 'switch' ? View : TouchableOpacity;
              const rowProps =
                item.type === 'switch'
                  ? {}
                  : { onPress: () => handleNav(item.id), activeOpacity: 0.65 };
              return (
                <RowWrap
                  key={item.id}
                  style={[styles.row, !isLast && styles.rowDivider]}
                  {...rowProps}
                >
                  <View style={[styles.iconBox, { backgroundColor: item.iconBg }]}>
                    <Feather name={item.icon} size={18} color={item.iconColor} />
                  </View>

                  <View style={styles.rowBody}>
                    <Text style={styles.rowLabel}>{item.label}</Text>
                    {!!item.subtitle && (
                      <Text style={styles.rowSub} numberOfLines={1}>
                        {item.subtitle}
                      </Text>
                    )}
                  </View>

                  {item.type === 'switch' ? (
                    <Switch
                      value={item.value}
                      onValueChange={item.onChange}
                      trackColor={{ false: '#e2e8f0', true: '#0D9488' }}
                      thumbColor={'#ffffff'}
                      ios_backgroundColor="#e2e8f0"
                    />
                  ) : (
                    <View style={styles.rowTrail}>
                      {!!item.badge && (
                        <View
                          style={[
                            styles.rowBadge,
                            { backgroundColor: `${item.badgeColor}1A` },
                          ]}
                        >
                          <Text
                            style={[
                              styles.rowBadgeText,
                              { color: item.badgeColor },
                            ]}
                          >
                            {item.badge}
                          </Text>
                        </View>
                      )}
                      {!!item.value && !item.badge && (
                        <Text style={styles.rowValue} numberOfLines={1}>
                          {item.value}
                        </Text>
                      )}
                      <Feather name="chevron-right" size={16} color="#cbd5e1" />
                    </View>
                  )}
                </RowWrap>
              );
            })}
          </View>
        </View>
      ))}

      {/* App version card */}
      {!loading && (
        <>
      <View style={styles.versionCard}>
        <View style={[styles.iconBox, { backgroundColor: '#f1f5f9' }]}>
          <Feather name="info" size={18} color="#94a3b8" />
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.rowLabel}>App Version</Text>
          <Text style={styles.rowSub}>Mediconnect Counselor v1.2.4 (Build 248)</Text>
        </View>
        <View style={styles.versionPill}>
          <Text style={styles.versionPillText}>Latest</Text>
        </View>
      </View>

      {/* Sign Out */}
      <TouchableOpacity
        style={styles.signOutBtn}
        onPress={onLogout}
        activeOpacity={0.8}
      >
        <View style={styles.signOutInner}>
          <Feather name="log-out" size={18} color="#e53935" />
          <Text style={styles.signOutText}>{t('counselor:signOut')}</Text>
        </View>
      </TouchableOpacity>

      <Text style={styles.footer}>© 2025 Mediconnect. All rights reserved.</Text>
        </>
      )}
    </ScrollView>

    {/* Availability Status Modal */}
    <Modal visible={availModal} animationType="slide" transparent onRequestClose={() => setAvailModal(false)}>
      <View style={pwStyles.overlay}>
        <View style={pwStyles.sheet}>
          <View style={pwStyles.sheetHeader}>
            <View>
              <Text style={pwStyles.sheetTitle}>Availability</Text>
              <Text style={pwStyles.sheetSub}>Set your current status for clients</Text>
            </View>
            <TouchableOpacity onPress={() => setAvailModal(false)} style={pwStyles.closeBtn}>
              <Feather name="x" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          <View style={pwStyles.body}>
            {AVAIL_STATUSES.map((s) => {
              const selected = s.key === availStatus;
              return (
                <TouchableOpacity
                  key={s.key}
                  activeOpacity={0.75}
                  onPress={() => handleSelectAvailability(s.key)}
                  style={[
                    availStyles.option,
                    selected && { borderColor: s.color, backgroundColor: `${s.color}0D` },
                  ]}
                >
                  <View style={[availStyles.optionIcon, { backgroundColor: s.bg }]}>
                    <Feather name={s.icon} size={18} color={s.color} />
                  </View>
                  <View style={availStyles.optionBody}>
                    <Text style={availStyles.optionLabel}>{s.label}</Text>
                    <Text style={availStyles.optionDesc} numberOfLines={1}>{s.desc}</Text>
                  </View>
                  {selected
                    ? <Feather name="check-circle" size={20} color={s.color} />
                    : <View style={availStyles.optionDot} />
                  }
                </TouchableOpacity>
              );
            })}
            <Text style={availStyles.note}>
              Your status is saved to your account and shown to clients.
            </Text>
          </View>
        </View>
      </View>
    </Modal>

    {/* Feedback Modal */}
    <Modal visible={feedbackModal} animationType="slide" transparent onRequestClose={() => setFeedbackModal(false)}>
      <KeyboardAvoidingView style={pwStyles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={pwStyles.sheet}>
          <View style={pwStyles.sheetHeader}>
            <View>
              <Text style={pwStyles.sheetTitle}>Send Feedback</Text>
              <Text style={pwStyles.sheetSub}>Help us improve — your feedback goes to our team</Text>
            </View>
            <TouchableOpacity onPress={() => setFeedbackModal(false)} style={pwStyles.closeBtn}>
              <Feather name="x" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={pwStyles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {!!feedbackNotice.msg && (
              <View style={[pwStyles.notice, feedbackNotice.type === 'error' ? pwStyles.noticeError : pwStyles.noticeSuccess]}>
                <Feather name={feedbackNotice.type === 'error' ? 'alert-circle' : 'check-circle'} size={14} color={feedbackNotice.type === 'error' ? '#dc2626' : '#16a34a'} />
                <Text style={[pwStyles.noticeText, { color: feedbackNotice.type === 'error' ? '#dc2626' : '#16a34a' }]}>{feedbackNotice.msg}</Text>
              </View>
            )}

            <Text style={pwStyles.label}>Category</Text>
            <View style={fbStyles.catRow}>
              {FEEDBACK_CATEGORIES.map((c) => {
                const active = c.key === feedbackCategory;
                return (
                  <TouchableOpacity
                    key={c.key}
                    activeOpacity={0.75}
                    onPress={() => setFeedbackCategory(c.key)}
                    style={[fbStyles.catChip, active && fbStyles.catChipActive]}
                  >
                    <Feather name={c.icon} size={14} color={active ? '#2563EB' : '#64748b'} />
                    <Text style={[fbStyles.catText, active && fbStyles.catTextActive]}>{c.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[pwStyles.label, { marginTop: 16 }]}>Your feedback</Text>
            <View style={fbStyles.inputShell}>
              <TextInput
                style={fbStyles.input}
                value={feedbackMessage}
                onChangeText={setFeedbackMessage}
                placeholder="Tell us what's working, what's not, or what you'd like to see…"
                placeholderTextColor="#94a3b8"
                multiline
                maxLength={2000}
                textAlignVertical="top"
              />
            </View>
            <Text style={fbStyles.counter}>{feedbackMessage.length}/2000</Text>

            <TouchableOpacity
              style={[pwStyles.submitBtn, (feedbackLoading || !feedbackMessage.trim()) && pwStyles.submitDisabled]}
              onPress={handleSubmitFeedback}
              disabled={feedbackLoading || !feedbackMessage.trim()}
            >
              {feedbackLoading ? <ActivityIndicator color="#fff" /> : (
                <><Feather name="send" size={16} color="#fff" /><Text style={pwStyles.submitText}>Submit</Text></>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>

    {/* Help & Support */}
    <Modal visible={showHelp} animationType="slide" transparent={false} onRequestClose={() => setShowHelp(false)}>
      <HelpSupport onClose={() => setShowHelp(false)} />
    </Modal>

    {/* Privacy Policy */}
    <Modal visible={showPrivacy} animationType="slide" transparent={false} onRequestClose={() => setShowPrivacy(false)}>
      <PrivacyPolicy onClose={() => setShowPrivacy(false)} />
    </Modal>

    {/* Earnings & Payouts */}
    <Modal visible={showWallet} animationType="slide" transparent={false} onRequestClose={() => setShowWallet(false)}>
      <CounselorWallet onClose={() => setShowWallet(false)} />
    </Modal>

    {/* Password Modal */}
    <Modal visible={pwModal} animationType="slide" transparent onRequestClose={() => setPwModal(false)}>
      <KeyboardAvoidingView style={pwStyles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={pwStyles.sheet}>
          {/* Sheet header */}
          <View style={pwStyles.sheetHeader}>
            <View>
              <Text style={pwStyles.sheetTitle}>
                {pwMode === 'set' ? t('settings:addPassword') : t('settings:changePassword')}
              </Text>
              <Text style={pwStyles.sheetSub}>
                {pwMode === 'set' ? t('settings:setPasswordOtp') : t('settings:updatePassword')}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setPwModal(false)} style={pwStyles.closeBtn}>
              <Feather name="x" size={20} color="#64748b" />
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={pwStyles.body} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {/* Notice */}
            {!!pwNotice.msg && (
              <View style={[pwStyles.notice, pwNotice.type === 'error' ? pwStyles.noticeError : pwStyles.noticeSuccess]}>
                <Feather name={pwNotice.type === 'error' ? 'alert-circle' : 'check-circle'} size={14} color={pwNotice.type === 'error' ? '#dc2626' : '#16a34a'} />
                <Text style={[pwStyles.noticeText, { color: pwNotice.type === 'error' ? '#dc2626' : '#16a34a' }]}>{pwNotice.msg}</Text>
              </View>
            )}

            {pwMode === 'set' ? (
              <>
                {/* Email + Send OTP */}
                <View style={pwStyles.field}>
                  <Text style={pwStyles.label}>{t('auth:email')}</Text>
                  <View style={pwStyles.shell}>
                    <Feather name="mail" size={15} color="#94a3b8" />
                    <Text style={pwStyles.emailText} numberOfLines={1}>{counselor?.email || '—'}</Text>
                    <TouchableOpacity style={pwStyles.otpBtn} onPress={handleSendOtp} disabled={pwLoading}>
                      {pwLoading && !otpSent
                        ? <ActivityIndicator size={12} color="#fff" />
                        : <Text style={pwStyles.otpBtnText}>{otpSent ? t('auth:resendOtp') : t('auth:sendOtp')}</Text>
                      }
                    </TouchableOpacity>
                  </View>
                </View>
                {otpSent && (
                  <View style={pwStyles.field}>
                    <Text style={pwStyles.label}>{t('auth:enterOtp')}</Text>
                    <View style={pwStyles.shell}>
                      <Feather name="hash" size={15} color="#94a3b8" />
                      <TextInput
                        style={pwStyles.input}
                        value={pwForm.otp}
                        onChangeText={(v) => setPw('otp', v)}
                        keyboardType="number-pad"
                        maxLength={6}
                        placeholder="6-digit OTP"
                        placeholderTextColor="#94a3b8"
                      />
                    </View>
                  </View>
                )}
                <View style={pwStyles.field}>
                  <Text style={pwStyles.label}>{t('auth:newPassword')}</Text>
                  <View style={pwStyles.shell}>
                    <Feather name="lock" size={15} color="#94a3b8" />
                    <TextInput style={pwStyles.input} value={pwForm.password} onChangeText={(v) => setPw('password', v)} secureTextEntry={!showNew} placeholder="Minimum 6 characters" placeholderTextColor="#94a3b8" autoCapitalize="none" />
                    <TouchableOpacity onPress={() => setShowNew((x) => !x)}><Feather name={showNew ? 'eye-off' : 'eye'} size={15} color="#94a3b8" /></TouchableOpacity>
                  </View>
                </View>
                <View style={pwStyles.field}>
                  <Text style={pwStyles.label}>{t('auth:confirmPassword')}</Text>
                  <View style={pwStyles.shell}>
                    <Feather name="lock" size={15} color="#94a3b8" />
                    <TextInput style={pwStyles.input} value={pwForm.confirmPassword} onChangeText={(v) => setPw('confirmPassword', v)} secureTextEntry={!showConfirm} placeholder="Re-enter password" placeholderTextColor="#94a3b8" autoCapitalize="none" />
                    <TouchableOpacity onPress={() => setShowConfirm((x) => !x)}><Feather name={showConfirm ? 'eye-off' : 'eye'} size={15} color="#94a3b8" /></TouchableOpacity>
                  </View>
                </View>
                <TouchableOpacity style={[pwStyles.submitBtn, (pwLoading || !otpSent) && pwStyles.submitDisabled]} onPress={handleSetPassword} disabled={pwLoading || !otpSent}>
                  {pwLoading ? <ActivityIndicator color="#fff" /> : (
                    <><Feather name="save" size={16} color="#fff" /><Text style={pwStyles.submitText}>{t('common:save')}</Text></>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={pwStyles.field}>
                  <Text style={pwStyles.label}>{t('auth:oldPassword')}</Text>
                  <View style={pwStyles.shell}>
                    <Feather name="lock" size={15} color="#94a3b8" />
                    <TextInput style={pwStyles.input} value={pwForm.oldPassword} onChangeText={(v) => setPw('oldPassword', v)} secureTextEntry={!showOld} placeholder="Enter current password" placeholderTextColor="#94a3b8" autoCapitalize="none" />
                    <TouchableOpacity onPress={() => setShowOld((x) => !x)}><Feather name={showOld ? 'eye-off' : 'eye'} size={15} color="#94a3b8" /></TouchableOpacity>
                  </View>
                </View>

                <View style={pwStyles.field}>
                  <Text style={pwStyles.label}>{t('auth:newPassword')}</Text>
                  <View style={pwStyles.shell}>
                    <Feather name="lock" size={15} color="#94a3b8" />
                    <TextInput style={pwStyles.input} value={pwForm.newPassword} onChangeText={(v) => setPw('newPassword', v)} secureTextEntry={!showNew} placeholder="Minimum 6 characters" placeholderTextColor="#94a3b8" autoCapitalize="none" />
                    <TouchableOpacity onPress={() => setShowNew((x) => !x)}><Feather name={showNew ? 'eye-off' : 'eye'} size={15} color="#94a3b8" /></TouchableOpacity>
                  </View>
                </View>

                <View style={pwStyles.field}>
                  <Text style={pwStyles.label}>{t('auth:confirmPassword')}</Text>
                  <View style={pwStyles.shell}>
                    <Feather name="lock" size={15} color="#94a3b8" />
                    <TextInput style={pwStyles.input} value={pwForm.confirmNewPassword} onChangeText={(v) => setPw('confirmNewPassword', v)} secureTextEntry={!showConfirm} placeholder="Re-enter new password" placeholderTextColor="#94a3b8" autoCapitalize="none" />
                    <TouchableOpacity onPress={() => setShowConfirm((x) => !x)}><Feather name={showConfirm ? 'eye-off' : 'eye'} size={15} color="#94a3b8" /></TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity style={[pwStyles.submitBtn, pwLoading && pwStyles.submitDisabled]} onPress={handleChangePassword} disabled={pwLoading}>
                  {pwLoading ? <ActivityIndicator color="#fff" /> : (
                    <><Feather name="check-circle" size={16} color="#fff" /><Text style={pwStyles.submitText}>{t('settings:changePassword')}</Text></>
                  )}
                </TouchableOpacity>
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
    </>
  );
};

export default CounselorSettings;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingBottom: 48,
  },

  /* ── Header ── */
  header: {
    width: '100%',
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 20,
    borderBottomWidth: 3,
    borderBottomColor: '#2563EB',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: 0.1,
  },
  headerSub: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
    fontWeight: '500',
  },

  /* ── Quick actions ── */
  quickRow: {
    width: '100%',
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
    backgroundColor: '#F0F4FF',
    borderBottomWidth: 1,
    borderBottomColor: '#C7D2FE',
  },
  quickItem: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E7FF',
  },
  quickIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  quickLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
  },

  /* ── Section ── */
  section: {
    width: '100%',
    marginBottom: 8,
    marginTop: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#2563EB',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    marginBottom: 8,
  },

  /* ── Card ── */
  card: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
  },

  /* ── Row ── */
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },

  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  rowSub: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  rowTrail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    maxWidth: '40%',
  },
  rowValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    maxWidth: 110,
  },
  rowBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  rowBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  /* ── Version Card ── */
  versionCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 16,
    marginBottom: 20,
  },
  versionPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  versionPillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#16A34A',
    letterSpacing: 0.4,
  },

  /* ── Sign Out ── */
  signOutBtn: {
    marginHorizontal: 20,
    borderRadius: 14,
    backgroundColor: '#fff1f2',
    borderWidth: 1.5,
    borderColor: '#fecaca',
    marginBottom: 20,
    overflow: 'hidden',
  },
  signOutInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 10,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#ef4444',
  },

  /* ── Footer ── */
  footer: {
    textAlign: 'center',
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 8,
  },
});

const skel = StyleSheet.create({
  wrap: {
    width: '100%',
    paddingTop: 4,
  },
  quickRow: {
    width: '100%',
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
  },
  quickItem: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e8ecf0',
  },
  quickIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
    marginBottom: 8,
  },
  quickLabel: {
    width: 42,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e2e8f0',
  },
  section: {
    width: '100%',
    marginBottom: 12,
  },
  sectionLabel: {
    height: 8,
    width: 90,
    borderRadius: 4,
    backgroundColor: '#e2e8f0',
    marginLeft: 20,
    marginBottom: 10,
  },
  card: {
    width: '100%',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#e8ecf0',
  },
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
    marginRight: 14,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  lineLg: {
    height: 12,
    width: '55%',
    borderRadius: 4,
    backgroundColor: '#e2e8f0',
  },
  lineSm: {
    height: 9,
    width: '75%',
    borderRadius: 4,
    backgroundColor: '#edf1f5',
  },
  trailDot: {
    width: 16,
    height: 16,
    borderRadius: 4,
    backgroundColor: '#e2e8f0',
  },
});

const pwStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(4,47,46,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    borderTopWidth: 3,
    borderColor: '#2563EB',
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  sheetSub: { fontSize: 12, color: '#64748b', marginTop: 3, maxWidth: '85%' },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  body: { padding: 20, paddingBottom: 36 },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  noticeError: { backgroundColor: '#fef2f2' },
  noticeSuccess: { backgroundColor: '#f0fdf4' },
  noticeText: { flex: 1, fontSize: 13, fontWeight: '500' },
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6 },
  shell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#dbe3ef',
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    minHeight: 48,
  },
  input: { flex: 1, color: '#111827', fontSize: 14, paddingVertical: 10 },
  emailText: { flex: 1, color: '#64748b', fontSize: 14 },
  otpBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 72,
    alignItems: 'center',
  },
  otpBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 14,
    marginTop: 8,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitDisabled: { opacity: 0.7 },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});

const availStyles = StyleSheet.create({
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  optionIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionBody: { flex: 1, minWidth: 0 },
  optionLabel: { fontSize: 15, fontWeight: '700', color: '#111827' },
  optionDesc: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  optionDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  note: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
});

const fbStyles = StyleSheet.create({
  catRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  catChipActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  catText: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  catTextActive: { color: '#2563EB' },
  inputShell: {
    borderWidth: 1,
    borderColor: '#dbe3ef',
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 6,
    minHeight: 120,
  },
  input: {
    color: '#111827',
    fontSize: 14,
    minHeight: 100,
  },
  counter: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 8,
  },
});
