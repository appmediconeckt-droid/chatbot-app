import React, { useState, useEffect, useRef } from 'react';
import useLanguageRender from '../../../../../../hooks/useLanguageRender';
import TranslatedMessageBubble from '../../../../../../components/TranslatedMessageBubble';
import { useNavigation } from '@react-navigation/native';
import {
  View,
  Text,
  Image,
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
  Alert,
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Feather from 'react-native-vector-icons/Feather';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { API_BASE_URL } from '../../../../../../axiosConfig';
import CounselorHelpSupport from './CounselorHelpSupport';
import GradientFill from '../../../../../../components/common/GradientFill';
import { DOCTOR } from '../../../../../../theme/palette';
import CounselorPrivacyPolicy from './CounselorPrivacyPolicy';
import CounselorWallet from '../Wallet/CounselorWallet';
import LanguageSelector from '../../../../../../components/common/LanguageSelector';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TERMS_URL = 'https://humaeli.com/terms-of-use/';
const { width } = Dimensions.get('window');
const isTablet = width >= 600;

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
      {/* Search bar */}
      <Animated.View style={[skel.searchBar, { opacity }]} />

      {/* Sections — mirror the live page: Account(3), Security(3), Privacy(2), Support(2) */}
      <SkSection rows={3} />
      <SkSection rows={3} />
      <SkSection rows={2} />
      <SkSection rows={2} />

      {/* App version card */}
      <View style={skel.versionCard}>
        <Animated.View style={[skel.iconBox, { opacity }]} />
        <View style={skel.body}>
          <Animated.View style={[skel.lineLg, { opacity }]} />
          <Animated.View style={[skel.lineSm, { opacity }]} />
        </View>
      </View>

      {/* Sign out */}
      <Animated.View style={[skel.signOut, { opacity }]} />
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

const FEEDBACK_CATEGORIES = [
  { key: 'bug', label: 'Bug', icon: 'alert-triangle' },
  { key: 'suggestion', label: 'Suggestion', icon: 'zap' },
  { key: 'other', label: 'Other', icon: 'message-circle' },
];

const CounselorSettings = ({ onNavigate, onLogout, notifCount = 0, onBellPress }) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { t } = useLanguageRender();
  const [counselor, setCounselor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [settingsSearch, setSettingsSearch] = useState('');

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
  // Confirmed locally - there is no verify-only endpoint, so the code is really
  // checked when the password is saved. This just gates the password fields so
  // the counselor does one step at a time instead of meeting the whole form.
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwNotice, setPwNotice] = useState({ type: '', msg: '' });
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const openPwModal = (mode) => {
    setPwMode(mode);
    setPwForm(INITIAL_PW_FORM);
    setOtpSent(false);
    setOtpVerified(false);
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
        setOtpVerified(false);
        setPw('otp', '');
        setPwNotice({ type: 'success', msg: res.data.message || 'OTP sent to your email.' });
      } else {
        setPwNotice({ type: 'error', msg: res.data?.message || 'Failed to send OTP.' });
      }
    } catch (err) {
      setPwNotice({ type: 'error', msg: err.response?.data?.message || err.message || 'Failed to send OTP.' });
    } finally { setPwLoading(false); }
  };

  // Checks the code before the password fields appear. New backends validate
  // with a non-consuming endpoint; older deployed backends may not have that
  // route yet, so final password save remains the source of truth for OTP.
  const handleVerifyOtp = async () => {
    setPwNotice({ type: '', msg: '' });
    if (!pwForm.otp || pwForm.otp.length !== 6) {
      setPwNotice({ type: 'error', msg: 'Enter the 6-digit OTP.' });
      return;
    }
    setOtpVerifying(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/api/auth/verify-password-otp`, {
        email: counselor?.email?.trim().toLowerCase(),
        otp: pwForm.otp,
      });
      if (res.data?.success) {
        setOtpVerified(true);
      } else {
        setPwNotice({ type: 'error', msg: res.data?.message || 'That OTP is not correct.' });
      }
    } catch (err) {
      if (err.response?.status === 404) {
        setOtpVerified(true);
        return;
      }
      setPwNotice({
        type: 'error',
        msg: err.response?.data?.message || 'That OTP is not correct.',
      });
    } finally {
      setOtpVerifying(false);
    }
  };

  // If the code expires between verify and save, step back to the OTP step.
  const pwFailed = (message, fallback) => {
    const msg = message || fallback;
    if (/otp|code|expired|invalid/i.test(msg)) {
      setOtpVerified(false);
      setPw('otp', '');
    }
    setPwNotice({ type: 'error', msg });
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
        setOtpVerified(false);
        setPwModal(false);
      } else {
        pwFailed(res.data?.message, 'Failed to set password.');
      }
    } catch (err) {
      pwFailed(err.response?.data?.message || err.message, 'Failed to set password.');
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
  }, []);

  const fetchCounselor = async () => {
    try {
      setLoading(true);
      const counsellorId = await AsyncStorage.getItem('counsellorId');
      const token = await AsyncStorage.getItem('accessToken') || await AsyncStorage.getItem('token');
      if (!counsellorId) {
        setLoading(false);
        return;
      }
      const res = await axios.get(
        `${API_BASE_URL}/api/auth/me`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const counselorData = res.data?.user || res.data?.counsellor;
      if (res.data?.success && counselorData) {
        setCounselor(counselorData);
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
    // App Lock manage screen: view status, set/change/remove the PIN, and the
    // biometric toggle. Opt-in — nothing is forced.
    if (id === 'app_lock') return navigation.navigate('AppLockSettings');
    if (id === 'contact')
      return Linking.openURL('mailto:support@humaeli.com');
    if (id === 'help') return setShowHelp(true);
    if (id === 'privacy') return setShowPrivacy(true);
    if (id === 'terms') return Linking.openURL(TERMS_URL);
    if (id === 'delete_account')
      return Alert.alert(
        'Delete Account',
        'This will permanently delete your account and all data. This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => {} },
        ]
      );
    if (id === 'feedback') {
      setFeedbackNotice({ type: '', msg: '' });
      return setFeedbackModal(true);
    }
  };

  const profileName =
    formatName(counselor?.fullName || counselor?.name) || 'Your Profile';
  // profilePhoto may be a plain URL string OR a Cloudinary-style object
  // ({ url, secure_url }). Passing an object to <Image source={{uri}}> crashes
  // RN ("cannot be cast from ReadableNativeMap to string"), so resolve to a
  // string or null and fall back to the initial avatar.
  const rawPhoto = counselor?.profilePhoto;
  const photoUri =
    typeof rawPhoto === 'string'
      ? rawPhoto
      : rawPhoto?.secure_url || rawPhoto?.url || null;
  const profileSubtitle =
    counselor?.email ||
    counselor?.phoneNumber ||
    counselor?.phone ||
    'Personal & professional details';
  const payoutSubtitle = counselor?.payoutAccount?.maskedNumber
    ? `${counselor.payoutAccount.bankName || 'Bank'} •••• ${counselor.payoutAccount.maskedNumber}`
    : 'Add a bank account for payouts';
  const payoutBadge = counselor?.payoutAccount?.verified ? 'Verified' : null;
  const SECTIONS = [
    {
      title: t('settings:account'),
      items: [
        {
          id: 'profile',
          icon: 'user',
          iconBg: '#EFF6FF',
          iconColor: '#2563EB',
          label: t('counselor:profile'),
          type: 'nav',
        },
        {
          id: 'payout',
          icon: 'credit-card',
          iconBg: '#EFF6FF',
          iconColor: '#2563EB',
          label: t('settings:payoutAccount'),
          type: 'nav',
        },
        {
          id: 'language',
          icon: 'globe',
          iconBg: '#EFF6FF',
          iconColor: '#2563EB',
          label: t('settings:language', 'Language'),
          type: 'language',
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
          type: 'nav',
        },
        {
          id: 'add_password',
          icon: 'key',
          iconBg: '#EFF6FF',
          iconColor: '#2563EB',
          label: t('settings:addPassword', 'Add Password by OTP'),
          type: 'nav',
        },
        {
          id: 'app_lock',
          icon: 'smartphone',
          iconBg: '#EFF6FF',
          iconColor: '#2563EB',
          label: t('settings:appLock'),
          type: 'nav',
        },
      ],
    },
    {
      title: t('settings:privacy', 'Privacy'),
      items: [
        {
          id: 'privacy',
          icon: 'file-text',
          iconBg: '#EFF6FF',
          iconColor: '#2563EB',
          // No externalLink icon: this opens the in-app privacy screen, it does
          // not leave the app, so the chevron is the honest affordance.
          label: t('settings:privacyPolicy'),
          type: 'nav',
        },
        {
          id: 'delete_account',
          icon: 'trash-2',
          iconBg: '#FEF2F2',
          iconColor: '#EF4444',
          label: t('settings:deleteAccount', 'Delete Account'),
          danger: true,
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
          iconBg: '#EFF6FF',
          iconColor: '#2563EB',
          label: t('settings:helpCenter', 'Help Center'),
          type: 'nav',
        },
        {
          id: 'contact',
          icon: 'mail',
          iconBg: '#EFF6FF',
          iconColor: '#2563EB',
          label: t('settings:contactSupport'),
          type: 'nav',
        },
      ],
    },
  ];

  // Filter sections/items by the search box.
  const sq = settingsSearch.trim().toLowerCase();
  const visibleSections = sq
    ? SECTIONS.map((s) => ({
        ...s,
        items: s.items.filter((it) => String(it.label).toLowerCase().includes(sq)),
      })).filter((s) => s.items.length > 0)
    : SECTIONS;

  return (
    <>
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      {!loading && (
        <>
        {/* Search settings */}
        <View style={styles.searchBox}>
          <Feather name="search" size={17} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder={t('settings:searchSettings', 'Search settings...')}
            placeholderTextColor="#94a3b8"
            value={settingsSearch}
            onChangeText={setSettingsSearch}
          />
        </View>
        </>
      )}

      {loading && <SettingsSkeleton />}

      {/* Nothing matched the search - say so rather than showing a blank page. */}
      {!loading && !!sq && visibleSections.length === 0 ? (
        <View style={styles.noResults}>
          <Feather name="search" size={26} color="#94a3b8" />
          <Text style={styles.noResultsTitle}>{t('No settings found')}</Text>
          <Text style={styles.noResultsSub}>
            {t('Try a different word, or clear the search to see everything.')}
          </Text>
          <TouchableOpacity
            style={styles.noResultsBtn}
            onPress={() => setSettingsSearch('')}
            activeOpacity={0.85}
          >
            <Text style={styles.noResultsBtnText}>{t('Clear search')}</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* Sections */}
      {!loading && visibleSections.map((section) => (
        <View key={section.title} style={styles.section}>
          <Text style={styles.sectionLabel}>{t(section.title)}</Text>
          <View style={styles.card}>
            {section.items.map((item, idx) => {
              const isLast = idx === section.items.length - 1;

              // Language: the whole row is a LanguageSelector trigger (opens the
              // shared language sheet). Matches the Figma's Account → Language row.
              if (item.type === 'language') {
                return (
                  <LanguageSelector
                    key={item.id}
                    brand={DOCTOR.primary}
                    userId={counselor?._id}
                    role="counselor"
                    triggerStyle={[styles.row, !isLast && styles.rowDivider]}
                  >
                    <View style={[styles.iconBox, { backgroundColor: item.iconBg }]}>
                      <Feather name={item.icon} size={18} color={item.iconColor} />
                    </View>
                    <View style={styles.rowBody}>
                      <Text style={styles.rowLabel}>{t(item.label)}</Text>
                    </View>
                    <View style={styles.rowTrail}>
                      <Feather name="chevron-right" size={18} color="#cbd5e1" />
                    </View>
                  </LanguageSelector>
                );
              }

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
                    <Text style={[styles.rowLabel, item.danger && styles.rowLabelDanger]}>{t(item.label)}</Text>
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
                      trackColor={{ false: '#e2e8f0', true: '#22C55E' }}
                      thumbColor={'#ffffff'}
                      ios_backgroundColor="#e2e8f0"
                    />
                  ) : (
                    <View style={styles.rowTrail}>
                      {!!item.badge && (
                        <View
                          style={[
                            styles.rowBadge,
                            {
                              backgroundColor: `${item.badgeColor}14`,
                              borderColor: `${item.badgeColor}33`,
                            },
                          ]}
                        >
                          {item.badgeDot && (
                            <View style={[styles.rowBadgeDot, { backgroundColor: item.badgeColor }]} />
                          )}
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
                      {item.externalLink ? (
                        <Feather name="external-link" size={16} color="#94a3b8" />
                      ) : !item.danger ? (
                        <Feather name="chevron-right" size={18} color="#cbd5e1" />
                      ) : null}
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
        <View style={[styles.iconBox, { backgroundColor: '#EFF6FF' }]}>
          <Feather name="smartphone" size={18} color="#2563EB" />
        </View>
        <View style={styles.rowBody}>
          <Text style={styles.rowLabel}>{t('settings:appVersion', 'App Version')}</Text>
          <Text style={styles.rowSub}>Humaeli v1.2.4 (Build 240)</Text>
        </View>
      </View>

      {/* Sign Out */}
      <TouchableOpacity
        style={styles.signOutBtn}
        onPress={onLogout}
        activeOpacity={0.85}
      >
        <Feather name="log-out" size={18} color="#ffffff" />
        <Text style={styles.signOutText}>{t('counselor:signOut')}</Text>
      </TouchableOpacity>

      <Text style={styles.footer}>© 2026 Humaeli. All rights reserved.</Text>
        </>
      )}
    </ScrollView>

    {/* Feedback Modal */}
    <Modal statusBarTranslucent navigationBarTranslucent visible={feedbackModal} animationType="slide" transparent onRequestClose={() => setFeedbackModal(false)}>
      <KeyboardAvoidingView style={pwStyles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[pwStyles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
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
                    <Text style={[fbStyles.catText, active && fbStyles.catTextActive]}>{t(c.label)}</Text>
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
              <GradientFill />
              {feedbackLoading ? <ActivityIndicator color="#fff" /> : (
                <><Feather name="send" size={16} color="#fff" /><Text style={pwStyles.submitText}>Submit</Text></>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>

    {/* Help & Support */}
    <Modal statusBarTranslucent navigationBarTranslucent visible={showHelp} animationType="slide" transparent={false} onRequestClose={() => setShowHelp(false)}>
      <CounselorHelpSupport
        onClose={() => setShowHelp(false)}
        // RN won't mount a second Modal while this one is dismissing, so the
        // handoff waits for the close animation before opening the next screen.
        onOpenEarnings={() => {
          setShowHelp(false);
          setTimeout(() => setShowWallet(true), 320);
        }}
        onOpenProfile={() => {
          setShowHelp(false);
          setTimeout(() => onNavigate?.('profile'), 320);
        }}
      />
    </Modal>

    {/* Privacy Policy */}
    <Modal statusBarTranslucent navigationBarTranslucent visible={showPrivacy} animationType="slide" transparent={false} onRequestClose={() => setShowPrivacy(false)}>
      <CounselorPrivacyPolicy onClose={() => setShowPrivacy(false)} />
    </Modal>

    {/* Earnings & Payouts */}
    <Modal statusBarTranslucent navigationBarTranslucent visible={showWallet} animationType="slide" transparent={false} onRequestClose={() => setShowWallet(false)}>
      <CounselorWallet onClose={() => setShowWallet(false)} />
    </Modal>

    {/* Password Modal */}
    <Modal statusBarTranslucent navigationBarTranslucent visible={pwModal} animationType="slide" transparent onRequestClose={() => setPwModal(false)}>
      <KeyboardAvoidingView style={pwStyles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[pwStyles.sheet, { maxHeight: isTablet ? '80%' : '90%' }]}>
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

          <ScrollView
            bounces={false}
            contentContainerStyle={[pwStyles.body, isTablet && { padding: 36, gap: 18 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
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
                      <GradientFill />
                      {pwLoading && !otpSent
                        ? <ActivityIndicator size={12} color="#fff" />
                        : <Text style={pwStyles.otpBtnText}>{otpSent ? t('auth:resendOtp') : t('auth:sendOtp')}</Text>
                      }
                    </TouchableOpacity>
                  </View>
                </View>
                {/* Step 2 - the code, with its own Verify button. */}
                {otpSent && !otpVerified && (
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
                      <TouchableOpacity
                        style={[
                          pwStyles.otpBtn,
                          (pwForm.otp.length !== 6 || otpVerifying) && pwStyles.submitDisabled,
                        ]}
                        onPress={handleVerifyOtp}
                        disabled={pwForm.otp.length !== 6 || otpVerifying}
                      >
                        <GradientFill />
                        {otpVerifying ? (
                          <ActivityIndicator size={12} color="#fff" />
                        ) : (
                          <Text style={pwStyles.otpBtnText}>{t('auth:verify', 'Verify')}</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {otpVerified && (
                  <View style={pwStyles.otpDoneRow}>
                    <Feather name="check-circle" size={15} color="#004AC6" />
                    <Text style={pwStyles.otpDoneText}>
                      {t('auth:enterOtp')} · {pwForm.otp}
                    </Text>
                    <TouchableOpacity onPress={() => setOtpVerified(false)}>
                      <Text style={pwStyles.otpDoneChange}>{t('common:edit', 'Change')}</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {/* Step 3 - the password pair appears only once the code is in.
                    Both boxes used to render before an OTP had even been sent. */}
                {otpVerified && (
                  <>
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
                <TouchableOpacity style={[pwStyles.submitBtn, pwLoading && pwStyles.submitDisabled]} onPress={handleSetPassword} disabled={pwLoading}>
                  <GradientFill />
                  {pwLoading ? <ActivityIndicator color="#fff" /> : (
                    <><Feather name="save" size={16} color="#fff" /><Text style={pwStyles.submitText}>{t('common:save')}</Text></>
                  )}
                </TouchableOpacity>
                  </>
                )}
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
                  <GradientFill />
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

  /* ── Greeting header ── */
  greetingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
  },
  greetingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  greetingAvatar: { width: 42, height: 42, borderRadius: 21 },
  greetingAvatarFallback: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#1D4ED8', alignItems: 'center', justifyContent: 'center',
  },
  greetingAvatarText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  greetingWelcome: { fontSize: 12, color: '#94A3B8', fontWeight: '500' },
  greetingName: { fontSize: 16, color: '#0F172A', fontWeight: '800', marginTop: 1 },
  bellButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  bellBadge: {
    position: 'absolute', top: 2, right: 2, minWidth: 17, height: 17, borderRadius: 9,
    paddingHorizontal: 4, backgroundColor: '#EF4444', borderWidth: 1.5, borderColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
  },
  bellBadgeText: { color: '#ffffff', fontSize: 9.5, fontWeight: '800' },

  /* ── Profile card ── */
  profileCard: {
    marginHorizontal: 16,
    marginTop: 6,
    borderRadius: 18,
    padding: 16,
  },
  profileTopRow: { flexDirection: 'row', alignItems: 'center' },
  profileAvatar: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' },
  profileAvatarFallback: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center',
  },
  profileAvatarText: { color: '#ffffff', fontSize: 22, fontWeight: '800' },
  profileName: { fontSize: 16, fontWeight: '800', color: '#ffffff' },
  profileRole: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  profileEmail: { fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  editBtnText: { fontSize: 12, fontWeight: '700', color: '#2563EB' },

  /* ── Tab pills ── */
  tabPillsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  tabPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 999,
    paddingVertical: 8,
  },
  tabPillText: { fontSize: 11.5, fontWeight: '700', color: '#475569' },

  /* ── Search ── */
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: 16,
    paddingHorizontal: 16,
    height: 48,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EAEEF3',
  },
  searchInput: { flex: 1, fontSize: 14, color: '#0f172a', fontWeight: '500', padding: 0 },

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
    marginBottom: 4,
    marginTop: 20,
  },
  noResults: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 46,
  },
  noResultsTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a', marginTop: 12 },
  noResultsSub: {
    fontSize: 12.5,
    lineHeight: 19,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 6,
  },
  noResultsBtn: {
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1.4,
    borderColor: '#C7DAFB',
    backgroundColor: '#EFF4FE',
  },
  noResultsBtnText: { fontSize: 13, fontWeight: '700', color: '#003A9B' },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    paddingHorizontal: 22,
    marginBottom: 8,
    marginTop: 6,
  },

  /* ── Card ── */
  card: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EDF1F6',
    overflow: 'hidden',
    shadowColor: '#1E293B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
  },

  /* ── Row ── */
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#F4F6F9',
  },

  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  rowBody: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  rowLabel: {
    fontSize: 14.5,
    fontWeight: '600',
    color: '#1E293B',
  },
  rowLabelDanger: {
    color: '#EF4444',
    fontWeight: '600',
  },
  rowSub: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
    fontWeight: '500',
  },
  rowTrail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
  },
  rowValue: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    maxWidth: 110,
  },
  rowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rowBadgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  rowBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  /* ── Version Card ── */
  versionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EEF2F6',
    marginTop: 18,
    marginBottom: 16,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#EF4444',
    paddingVertical: 16,
    marginTop: 8,
    marginBottom: 20,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
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
  // Search bar (matches styles.searchBox: mx16, h48, radius14)
  searchBar: {
    height: 48,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 14,
    backgroundColor: '#e8ecf0',
  },
  section: {
    width: '100%',
    marginTop: 20,
    marginBottom: 4,
  },
  sectionLabel: {
    height: 9,
    width: 90,
    borderRadius: 4,
    backgroundColor: '#e2e8f0',
    marginLeft: 22,
    marginBottom: 10,
  },
  // Card (matches styles.card: mx16, rounded, bordered)
  card: {
    marginHorizontal: 16,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EDF1F6',
    overflow: 'hidden',
  },
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F4F6F9',
  },
  // App version card (matches styles.versionCard)
  versionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 18,
    marginBottom: 16,
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#EEF2F6',
    backgroundColor: '#ffffff',
  },
  // Sign out button (matches styles.signOutBtn)
  signOut: {
    height: 52,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 20,
    borderRadius: 14,
    backgroundColor: '#e8ecf0',
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
    borderTopWidth: 3,
    borderColor: '#003A9B', },
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
  body: { padding: 20, paddingBottom: 20 },
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
    overflow: 'hidden',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 72,
    alignItems: 'center',
  },
  otpBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  otpDoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E7EEFE',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  otpDoneText: { flex: 1, color: '#0F172A', fontSize: 12.5, fontWeight: '600' },
  otpDoneChange: { color: '#004AC6', fontSize: 12, fontWeight: '700' },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    overflow: 'hidden',
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
