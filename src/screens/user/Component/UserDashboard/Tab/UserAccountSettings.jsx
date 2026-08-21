import React, { useEffect, useState } from 'react';
import useLanguageRender from '../../../../../hooks/useLanguageRender';
import { useNavigation } from '@react-navigation/native';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
  Switch,
  StatusBar,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import axiosInstance from '../../../../../axiosConfig';
import PATIENT, {
  PATIENT_GRADIENT,
  TRANSPARENT_GRADIENT,
  GRADIENT_DIRECTION,
} from '../../../../../theme/palette';
import PatientGradientButton from '../../../../../components/common/PatientGradientButton';

const isGeneratedUserAvatarUrl = (raw) => {
  const url = typeof raw === 'string' ? raw : raw?.url || raw?.secure_url || '';
  const value = String(url || '').trim();
  if (!value) return false;
  return (
    value.startsWith('data:image/') ||
    /^https:\/\/api\.dicebear\.com\//i.test(value)
  );
};

const UserAccountSettings = ({ onNavigateBack }) => {
  const { t } = useLanguageRender();
  const navigation = useNavigation();
  const [account, setAccount] = useState({ name: '', email: '', phone: '', profilePhoto: '' });
  const [loading, setLoading] = useState(true);
  const [appLockEnabled, setAppLockEnabled] = useState(false);
  const [passwordMode, setPasswordMode] = useState('change'); // 'add' or 'change'

  // Add password via OTP
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  // Verified with a password-specific endpoint so the login OTP endpoint does
  // not consume the code before the password save request can use it.
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [newPasswordAdd, setNewPasswordAdd] = useState('');
  const [confirmPasswordAdd, setConfirmPasswordAdd] = useState('');
  const [showNewPasswordAdd, setShowNewPasswordAdd] = useState(false);

  // Change password
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [otpLoading, setOtpLoading] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    loadAccount();
    checkAppLock();
  }, []);

  // The PIN is set on the App Lock screen, so coming back from there has to
  // re-read it. Without this the switch still showed OFF after a PIN had just
  // been created - it only refreshed if the whole screen remounted.
  useEffect(() => {
    const unsub = navigation.addListener('focus', checkAppLock);
    return unsub;
  }, [navigation]);

  const loadAccount = async () => {
    try {
      const userId = await AsyncStorage.getItem('userId');
      const rawUserData = await AsyncStorage.getItem('userData');
      const parsedUserData = rawUserData ? JSON.parse(rawUserData) : null;
      const storedEmail = (await AsyncStorage.getItem('userEmail')) || parsedUserData?.email || '';

      if (!userId) {
        if (storedEmail) setAccount((p) => ({ ...p, email: storedEmail }));
        setLoading(false);
        return;
      }

      const res = await axiosInstance.get(`/api/auth/getUser/${userId}`);
      if (res.data?.success && res.data.user) {
        const u = res.data.user;
        const userName = u.fullName || u.name || 'Rohan';
        const rawPhoto = u.profilePhoto?.url || u.profilePhoto?.secure_url || u.profilePhoto;
        const photoUri = isGeneratedUserAvatarUrl(rawPhoto) ? String(rawPhoto).trim() : null;

        setAccount({
          name: userName,
          email: u.email || storedEmail,
          phone: u.phoneNumber || u.phone || '6701424686',
          profilePhoto: photoUri || `https://ui-avatars.com/api/?name=${userName.replace(/\s/g, '+')}&background=random`,
        });
      }
    } catch (e) {
      console.error('Failed to load account:', e);
      setAccount((p) => ({
        ...p,
        profilePhoto: 'https://ui-avatars.com/api/?name=User&background=random',
      }));
    } finally {
      setLoading(false);
    }
  };

  const checkAppLock = async () => {
    const pin = await AsyncStorage.getItem('appLockPin');
    setAppLockEnabled(!!pin);
  };

  // The switch used to call navigate() whichever way it was dragged, so turning
  // it OFF did not remove anything - the lock stayed on.
  const handleToggleAppLock = (next) => {
    if (next) {
      // Turning it on means creating a PIN, which happens on the App Lock
      // screen. The switch stays off until a PIN actually exists - checkAppLock
      // on focus flips it when we come back.
      navigation.navigate('AppLockSettings');
      return;
    }
    Alert.alert(
      t('Remove App Lock'),
      t('This will delete your PIN and unlock the app. You can set a new PIN any time.'),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Remove'),
          style: 'destructive',
          onPress: async () => {
            // Clear the biometric flag too - it is useless without a PIN and
            // would otherwise re-enable itself with the next PIN.
            await AsyncStorage.multiRemove(['appLockPin', 'appLockBiometricEnabled']);
            setAppLockEnabled(false);
          },
        },
      ],
    );
  };

  const handleSendOTP = async () => {
    if (!account.email) {
      Alert.alert('Error', 'Email not found');
      return;
    }
    setOtpLoading(true);
    try {
      const res = await axiosInstance.post('/api/auth/generateOtp', { email: account.email });
      if (res.data?.success) {
        setOtpSent(true);
        setOtpVerified(false);
        setOtpCode('');
        Alert.alert('Success', `OTP sent to ${account.email}`);
      } else {
        Alert.alert('Error', res.data?.message || 'Failed to send OTP');
      }
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to send OTP');
    } finally {
      setOtpLoading(false);
    }
  };

  // Drop back to the OTP step when the code expires between verification and
  // saving the password.
  const handleAddPasswordError = (message) => {
    const msg = message || 'Failed to add password';
    if (/otp|code|expired|invalid/i.test(msg)) {
      setOtpVerified(false);
      setOtpCode('');
    }
    Alert.alert('Error', msg);
  };

  // Checks the code before revealing the password fields. New backends validate
  // with a non-consuming endpoint; older deployed backends may not have that
  // route yet, so final password save remains the source of truth for OTP.
  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length !== 6) {
      Alert.alert('Error', 'Enter the 6-digit OTP');
      return;
    }
    setOtpVerifying(true);
    try {
      const res = await axiosInstance.post('/api/auth/verify-password-otp', {
        email: account.email,
        otp: otpCode,
      });
      if (res.data?.success) {
        setOtpVerified(true);
      } else {
        Alert.alert('Error', res.data?.message || 'That OTP is not correct.');
      }
    } catch (e) {
      if (e.response?.status === 404) {
        setOtpVerified(true);
        return;
      }
      Alert.alert('Error', e.response?.data?.message || 'That OTP is not correct.');
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleAddPassword = async () => {
    if (!otpCode || otpCode.length !== 6) {
      Alert.alert('Error', 'Enter the 6-digit OTP');
      return;
    }
    if (!newPasswordAdd) {
      Alert.alert('Error', 'Enter new password');
      return;
    }
    if (newPasswordAdd !== confirmPasswordAdd) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setPwLoading(true);
    try {
      const res = await axiosInstance.post('/api/auth/set-password-by-otp', {
        email: account.email,
        otp: otpCode,
        password: newPasswordAdd,
      });
      if (res.data?.success) {
        Alert.alert('Success', 'Password added successfully!');
        setOtpSent(false);
        setOtpCode('');
        setNewPasswordAdd('');
        setConfirmPasswordAdd('');
        setPasswordMode('change');
      } else {
        handleAddPasswordError(res.data?.message);
      }
    } catch (e) {
      handleAddPasswordError(e.response?.data?.message);
    } finally {
      setPwLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword) {
      Alert.alert('Error', 'Enter your current password');
      return;
    }
    if (!newPassword) {
      Alert.alert('Error', 'Enter your new password');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }
    if (currentPassword === newPassword) {
      Alert.alert('Error', 'New password must be different');
      return;
    }

    setPwLoading(true);
    try {
      const res = await axiosInstance.post('/api/auth/changePassword', {
        oldPassword: currentPassword,
        newPassword: newPassword,
      });
      if (res.data?.success) {
        Alert.alert('Success', 'Password changed successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        Alert.alert('Error', res.data?.message || 'Failed to change password');
      }
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to change password');
    } finally {
      setPwLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={PATIENT.primary} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <View style={s.header}>
        <TouchableOpacity onPress={onNavigateBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>{t('settings:settings', 'Settings')}</Text>
        <View style={s.headerSpacer} />
      </View>

      <ScrollView
        style={s.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.scrollContent}
        scrollIndicatorInsets={{ right: 1 }}
      >
        <View style={s.section}>
          <Text style={s.sectionTitle}>{t('ACCOUNT INFO')}</Text>

          <View style={s.accountCard}>
            {!imageError && account.profilePhoto ? (
              <Image
                source={{ uri: String(account.profilePhoto).trim() }}
                style={s.avatar}
                onError={() => setImageError(true)}
                onLoadStart={() => setImageError(false)}
              />
            ) : (
              <View style={[s.avatar, s.avatarFallback]}>
                <Text style={s.avatarText}>
                  {account.name?.charAt(0)?.toUpperCase() || 'R'}
                </Text>
              </View>
            )}
            <View>
              <Text style={s.accountName}>{t(account.name)}</Text>
              <Text style={s.accountType}>{t('Personal Account')}</Text>
            </View>
          </View>

          {[
            { icon: 'mail-outline', label: 'Email', value: account.email },
            { icon: 'phone-portrait-outline', label: 'Phone', value: account.phone },
            { icon: 'log-in-outline', label: 'Login via', value: 'Email & Password' },
          ].map((item, idx) => (
            <View
              key={idx}
              style={[
                s.infoRow,
                idx === 2 && s.infoRowLast,
              ]}
            >
              <Ionicons name={item.icon} size={16} color={PATIENT.primary} />
              <View style={s.infoTextWrap}>
                <Text style={s.infoLabel}>{t(item.label)}</Text>
                <Text style={s.infoValue}>{item.value}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={s.section}>
          <View style={s.passwordHeader}>
            <View>
              <Text style={s.sectionTitle}>{t('Password Security')}</Text>
              <Text style={s.passwordSub}>{t('Update your current password')}</Text>
            </View>
          </View>

          <View style={s.tabsContainer}>
            {[
              { key: 'add', label: 'Add' },
              { key: 'change', label: 'Change' },
            ].map(({ key, label }) => {
              const isActive = passwordMode === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={s.tabWrap}
                  onPress={() => setPasswordMode(key)}
                  activeOpacity={0.85}
                >
                  <LinearGradient
                    colors={isActive ? PATIENT_GRADIENT : TRANSPARENT_GRADIENT}
                    {...GRADIENT_DIRECTION}
                    style={s.tab}
                  >
                    <Text
                      style={[s.tabText, isActive && s.tabTextActive]}
                      numberOfLines={1}
                      maxFontSizeMultiplier={1}
                    >
                      {label}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Add Password Mode */}
          {passwordMode === 'add' ? (
            <View style={s.passwordContent}>
              {!otpSent ? (
                <>
                  <View style={s.inputBox}>
                    <Text style={s.inputLabel}>{t('Email')}</Text>
                    <View style={s.inputWrapper}>
                      <Ionicons name="mail-outline" size={16} color="#94a3b8" />
                      <Text style={s.emailReadonly}>{account.email}</Text>
                      <TouchableOpacity
                        style={[s.otpBtn, otpLoading && s.btnDisabled]}
                        onPress={handleSendOTP}
                        disabled={otpLoading}
                      >
                        {otpLoading ? (
                          <ActivityIndicator size={12} color="#fff" />
                        ) : (
                          <Text style={s.otpBtnText}>{t('Send OTP')}</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              ) : !otpVerified ? (
                /* Step 2 - the code on its own, with its own button. The password
                   fields used to sit here too, so the whole thing arrived at once. */
                <>
                  <View style={s.inputBox}>
                    <Text style={s.inputLabel}>{t('OTP Code')}</Text>
                    <View style={s.inputWrapper}>
                      <Ionicons name="key-outline" size={16} color="#94a3b8" />
                      <TextInput
                        style={s.input}
                        placeholder="000000"
                        placeholderTextColor="#cbd5e1"
                        value={otpCode}
                        onChangeText={setOtpCode}
                        keyboardType="number-pad"
                        maxLength={6}
                      />
                      <TouchableOpacity
                        style={[s.otpBtn, (otpCode.length !== 6 || otpVerifying) && s.btnDisabled]}
                        onPress={handleVerifyOtp}
                        disabled={otpCode.length !== 6 || otpVerifying}
                      >
                        {otpVerifying ? (
                          <ActivityIndicator size={12} color="#fff" />
                        ) : (
                          <Text style={s.otpBtnText}>{t('Verify')}</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>

                  <TouchableOpacity onPress={handleSendOTP} disabled={otpLoading}>
                    <Text style={s.otpResend}>
                      {otpLoading ? t('Sending...') : t('Resend OTP')}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                /* Step 3 - only now the two password boxes. */
                <>
                  <View style={s.otpDoneRow}>
                    <Ionicons name="checkmark-circle" size={16} color={PATIENT.primary} />
                    <Text style={s.otpDoneText}>
                      {t('Code entered')} · {otpCode}
                    </Text>
                    <TouchableOpacity onPress={() => setOtpVerified(false)}>
                      <Text style={s.otpDoneChange}>{t('Change')}</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={s.inputBox}>
                    <Text style={s.inputLabel}>{t('New Password')}</Text>
                    <View style={s.inputWrapper}>
                      <Ionicons name="lock-closed-outline" size={16} color="#94a3b8" />
                      <TextInput
                        style={s.input}
                        placeholder="••••••••••••"
                        placeholderTextColor="#cbd5e1"
                        secureTextEntry={!showNewPasswordAdd}
                        value={newPasswordAdd}
                        onChangeText={setNewPasswordAdd}
                      />
                      <TouchableOpacity onPress={() => setShowNewPasswordAdd(!showNewPasswordAdd)}>
                        <Ionicons
                          name={showNewPasswordAdd ? 'eye' : 'eye-off'}
                          size={16}
                          color="#94a3b8"
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={s.inputBox}>
                    <Text style={s.inputLabel}>{t('Confirm Password')}</Text>
                    <View style={s.inputWrapper}>
                      <Ionicons name="lock-closed-outline" size={16} color="#94a3b8" />
                      <TextInput
                        style={s.input}
                        placeholder="••••••••••••"
                        placeholderTextColor="#cbd5e1"
                        secureTextEntry
                        value={confirmPasswordAdd}
                        onChangeText={setConfirmPasswordAdd}
                      />
                    </View>
                  </View>

                  <PatientGradientButton
                    style={[s.submitBtn, pwLoading && s.btnDisabled]}
                    onPress={handleAddPassword}
                    disabled={pwLoading}
                  >
                    {pwLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle" size={16} color="#fff" />
                        <Text style={s.submitBtnText}>{t('Add Password')}</Text>
                      </>
                    )}
                  </PatientGradientButton>
                </>
              )}
            </View>
          ) : (
            <View style={s.passwordContent}>
              <View style={s.inputBox}>
                <Text style={s.inputLabel}>{t('Current Password')}</Text>
                <View style={s.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={16} color="#94a3b8" />
                  <TextInput
                    style={s.input}
                    placeholder="••••••••••••"
                    placeholderTextColor="#cbd5e1"
                    secureTextEntry={!showCurrentPassword}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                  />
                  <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)}>
                    <Ionicons
                      name={showCurrentPassword ? 'eye' : 'eye-off'}
                      size={16}
                      color="#94a3b8"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={s.inputBox}>
                <Text style={s.inputLabel}>{t('New Password')}</Text>
                <View style={s.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={16} color="#94a3b8" />
                  <TextInput
                    style={s.input}
                    placeholder="••••••••••••"
                    placeholderTextColor="#cbd5e1"
                    secureTextEntry={!showNewPassword}
                    value={newPassword}
                    onChangeText={setNewPassword}
                  />
                  <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)}>
                    <Ionicons
                      name={showNewPassword ? 'eye' : 'eye-off'}
                      size={16}
                      color="#94a3b8"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={s.inputBox}>
                <Text style={s.inputLabel}>{t('Confirm Password')}</Text>
                <View style={s.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={16} color="#94a3b8" />
                  <TextInput
                    style={s.input}
                    placeholder="••••••••••••"
                    placeholderTextColor="#cbd5e1"
                    secureTextEntry={!showConfirmPassword}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />
                  <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                    <Ionicons
                      name={showConfirmPassword ? 'eye' : 'eye-off'}
                      size={16}
                      color="#94a3b8"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <PatientGradientButton
                style={[s.submitBtn, pwLoading && s.btnDisabled]}
                onPress={handleChangePassword}
                disabled={pwLoading}
              >
                {pwLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={16} color="#fff" />
                    <Text style={s.submitBtnText}>{t('Change Password')}</Text>
                  </>
                )}
              </PatientGradientButton>
            </View>
          )}
        </View>

        <View style={s.section}>
          <View style={s.appLockRow}>
            <View>
              <Text style={s.appLockTitle}>{t('App Lock')}</Text>
              <Text style={s.appLockSub}>{t('Face & PIN protection')}</Text>
            </View>
            <Switch
              value={appLockEnabled}
              onValueChange={handleToggleAppLock}
              trackColor={{ false: '#cbd5e1', true: PATIENT.primary }}
              thumbColor="#ffffff"
            />
          </View>
        </View>

        <View style={s.bottomSpace} />
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9F9FF', paddingTop: 0, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: { fontSize: 18, lineHeight: 22, fontWeight: '800', color: '#0f172a', includeFontPadding: false },
  headerSpacer: { width: 24 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 96 },

  section: {
    backgroundColor: '#ffffff',
    marginBottom: 14,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E8ECF3',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  sectionTitle: { fontSize: 13, lineHeight: 16, fontWeight: '800', color: '#94a3b8', letterSpacing: 0.4, marginBottom: 10, includeFontPadding: false },

  accountCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F3F7F6', padding: 12, borderRadius: 12, marginBottom: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarFallback: { backgroundColor: PATIENT.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
  accountName: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  accountType: { fontSize: 13, lineHeight: 16, color: '#64748b', marginTop: 1, includeFontPadding: false },

  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#eef2f7' },
  infoRowLast: { borderBottomWidth: 0, paddingBottom: 0 },
  infoTextWrap: { marginLeft: 10, flex: 1 },
  infoLabel: { fontSize: 13, lineHeight: 16, fontWeight: '600', color: '#94a3b8', includeFontPadding: false },
  infoValue: { fontSize: 13, lineHeight: 16, fontWeight: '600', color: '#0f172a', marginTop: 3, includeFontPadding: false },

  passwordHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  changeBtn: { fontSize: 13, lineHeight: 16, fontWeight: '700', color: PATIENT.primary, includeFontPadding: false },
  passwordSub: { fontSize: 13, lineHeight: 16, color: '#64748b', marginTop: 2, includeFontPadding: false },

  tabsContainer: { flexDirection: 'row', gap: 8, marginBottom: 12, backgroundColor: '#f1f5f9', padding: 4, borderRadius: 12 },
  // Wrapper owns flex + clips the gradient to the tab radius.
  tabWrap: { flex: 1, minWidth: 0, borderRadius: 9, overflow: 'hidden' },
  tab: { height: 40, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  tabText: { fontSize: 13, lineHeight: 16, fontWeight: '700', color: '#64748b', textAlign: 'center', includeFontPadding: false },
  tabTextActive: { color: '#ffffff' },

  passwordContent: { gap: 10 },

  inputBox: { marginBottom: 2 },
  inputLabel: { fontSize: 13, lineHeight: 16, fontWeight: '700', color: '#334155', marginBottom: 6, includeFontPadding: false },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 8, paddingHorizontal: 11, borderWidth: 1, borderColor: '#dbe3ef', minHeight: 42, gap: 8 },
  input: { flex: 1, color: '#0f172a', fontSize: 13, lineHeight: 16, fontWeight: '500', paddingVertical: 10, includeFontPadding: false },
  emailReadonly: { flex: 1, color: '#64748b', fontSize: 13, lineHeight: 16, fontWeight: '500', includeFontPadding: false },

  otpBtn: { backgroundColor: PATIENT.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, minWidth: 80, alignItems: 'center' },
  otpBtnText: { color: '#fff', fontSize: 13, lineHeight: 16, fontWeight: '700', includeFontPadding: false },
  otpResend: { color: PATIENT.primary, fontSize: 13, lineHeight: 16, fontWeight: '700', marginBottom: 14, includeFontPadding: false },
  otpDoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E6F6EC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  otpDoneText: { flex: 1, color: '#0F172A', fontSize: 13, lineHeight: 16, fontWeight: '600', includeFontPadding: false },
  otpDoneChange: { color: PATIENT.primary, fontSize: 13, lineHeight: 16, fontWeight: '700', includeFontPadding: false },

  submitBtn: { borderRadius: 10, paddingVertical: 12, marginTop: 8 },
  submitBtnText: { fontSize: 13, lineHeight: 16, fontWeight: '800', color: '#ffffff', includeFontPadding: false },
  btnDisabled: { opacity: 0.5 },

  appLockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  appLockTitle: { fontSize: 13, lineHeight: 16, fontWeight: '700', color: '#0f172a', includeFontPadding: false },
  appLockSub: { fontSize: 13, lineHeight: 16, color: '#64748b', marginTop: 2, includeFontPadding: false },
  bottomSpace: { height: 24 },

});

export default UserAccountSettings;
