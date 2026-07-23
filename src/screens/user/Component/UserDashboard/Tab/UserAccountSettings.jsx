import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import axiosInstance from '../../../../../axiosConfig';
import PATIENT from '../../../../../theme/palette';

const UserAccountSettings = ({ onNavigateBack }) => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [account, setAccount] = useState({ name: '', email: '', phone: '', profilePhoto: '' });
  const [loading, setLoading] = useState(true);
  const [appLockEnabled, setAppLockEnabled] = useState(false);
  const [passwordMode, setPasswordMode] = useState('change'); // 'add' or 'change'

  // Add password via OTP
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
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
        const photoUri = typeof u.profilePhoto === 'string' ? u.profilePhoto?.trim() : null;

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
        Alert.alert('Error', res.data?.message || 'Failed to add password');
      }
    } catch (e) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to add password');
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

  const handleSaveSecurity = () => {
    Alert.alert('Success', 'Security settings saved!');
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

      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={onNavigateBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Security</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 0 }} scrollIndicatorInsets={{ right: 1 }}>
        {/* Security Center */}
        <View style={s.section}>
          <View style={s.securityHeader}>
            <Ionicons name="checkmark-circle" size={20} color={PATIENT.primary} />
            <View style={{ marginLeft: 10, flex: 1 }}>
              <Text style={s.securityTitle}>Security Center</Text>
              <Text style={s.securitySub}>Manage your account protection</Text>
            </View>
          </View>

          <View style={s.securityStatus}>
            <View>
              <Text style={s.protectedLabel}>Protected</Text>
            </View>
            <View style={s.scoreCard}>
              <Text style={s.scoreText}>Score: 87%</Text>
            </View>
          </View>

          <View style={s.checksList}>
            {[
              'Two-factor auth active',
              'Strong password set',
              'Biometrics enabled',
            ].map((label, idx) => (
              <View key={idx} style={s.checkItem}>
                <Ionicons name="checkmark-circle" size={14} color={PATIENT.primary} />
                <Text style={s.checkLabel}>{label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Account Info */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>ACCOUNT INFO</Text>

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
              <Text style={s.accountName}>{account.name}</Text>
              <Text style={s.accountType}>Personal Account</Text>
            </View>
          </View>

          {[
            { icon: 'mail-outline', label: 'Email', value: account.email },
            { icon: 'phone-portrait-outline', label: 'Phone', value: account.phone },
            { icon: 'log-in-outline', label: 'Login via', value: 'Email & Password' },
          ].map((item, idx) => (
            <View key={idx} style={s.infoRow}>
              <Ionicons name={item.icon} size={16} color={PATIENT.primary} />
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={s.infoLabel}>{item.label}</Text>
                <Text style={s.infoValue}>{item.value}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Password Security */}
        <View style={s.section}>
          <View style={s.passwordHeader}>
            <View>
              <Text style={s.sectionTitle}>Password Security</Text>
              <Text style={s.passwordSub}>Update your current password</Text>
            </View>
            <TouchableOpacity>
              <Text style={s.changeBtn}>Change</Text>
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={s.tabsContainer}>
            <TouchableOpacity
              style={[s.tab, passwordMode === 'add' && s.tabActive]}
              onPress={() => setPasswordMode('add')}
            >
              <Text style={[s.tabText, passwordMode === 'add' && s.tabTextActive]}>Add</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.tab, passwordMode === 'change' && s.tabActive]}
              onPress={() => setPasswordMode('change')}
            >
              <Text style={[s.tabText, passwordMode === 'change' && s.tabTextActive]}>Change</Text>
            </TouchableOpacity>
          </View>

          {/* Add Password Mode */}
          {passwordMode === 'add' ? (
            <View style={s.passwordContent}>
              {!otpSent ? (
                <>
                  <View style={s.inputBox}>
                    <Text style={s.inputLabel}>Email</Text>
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
                          <Text style={s.otpBtnText}>Send OTP</Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              ) : (
                <>
                  <View style={s.inputBox}>
                    <Text style={s.inputLabel}>OTP Code</Text>
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
                    </View>
                  </View>

                  <View style={s.inputBox}>
                    <Text style={s.inputLabel}>New Password</Text>
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
                    <Text style={s.inputLabel}>Confirm Password</Text>
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

                  <TouchableOpacity
                    style={[s.submitBtn, pwLoading && s.btnDisabled]}
                    onPress={handleAddPassword}
                    disabled={pwLoading}
                  >
                    {pwLoading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="checkmark-circle" size={16} color="#fff" />
                        <Text style={s.submitBtnText}>Add Password</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          ) : (
            <View style={s.passwordContent}>
              <View style={s.inputBox}>
                <Text style={s.inputLabel}>Current Password</Text>
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
                <Text style={s.inputLabel}>New Password</Text>
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
                <Text style={s.inputLabel}>Confirm Password</Text>
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

              <TouchableOpacity
                style={[s.submitBtn, pwLoading && s.btnDisabled]}
                onPress={handleChangePassword}
                disabled={pwLoading}
              >
                {pwLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={16} color="#fff" />
                    <Text style={s.submitBtnText}>Change Password</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* App Lock */}
        <View style={s.section}>
          <View style={s.appLockRow}>
            <View>
              <Text style={s.appLockTitle}>App Lock</Text>
              <Text style={s.appLockSub}>Face & PIN protection</Text>
            </View>
            <Switch
              value={appLockEnabled}
              onValueChange={() => navigation.navigate('AppLockSettings')}
              trackColor={{ false: '#cbd5e1', true: PATIENT.primary }}
              thumbColor="#ffffff"
            />
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity style={s.saveBtn} onPress={handleSaveSecurity} activeOpacity={0.85}>
          <Ionicons name="shield-checkmark" size={18} color="#ffffff" />
          <Text style={s.saveBtnText}>Save Security Settings</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', paddingTop: 0, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#ffffff', borderBottomWidth: 2, borderBottomColor: '#0066cc' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0f172a' },
  scroll: { flex: 1 },

  section: { backgroundColor: '#ffffff', marginHorizontal: 0, marginTop: 0, marginBottom: 0, borderRadius: 0, padding: 14, borderWidth: 0, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  sectionTitle: { fontSize: 10, fontWeight: '800', color: '#94a3b8', letterSpacing: 0.4, marginBottom: 10 },

  securityHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  securityTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  securitySub: { fontSize: 11, color: '#64748b', marginTop: 2 },

  securityStatus: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#f1f5f9', padding: 10, borderRadius: 8, marginBottom: 10 },
  protectedLabel: { fontSize: 12, fontWeight: '700', color: '#0f172a' },
  scoreCard: { backgroundColor: PATIENT.primary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  scoreText: { fontSize: 10, fontWeight: '700', color: '#ffffff' },

  checksList: { gap: 6 },
  checkItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkLabel: { fontSize: 12, fontWeight: '500', color: '#0f172a' },

  accountCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f1f5f9', padding: 10, borderRadius: 8, marginBottom: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  avatarFallback: { backgroundColor: PATIENT.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
  accountName: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  accountType: { fontSize: 11, color: '#64748b', marginTop: 1 },

  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  infoLabel: { fontSize: 10, fontWeight: '600', color: '#94a3b8' },
  infoValue: { fontSize: 12, fontWeight: '600', color: '#0f172a', marginTop: 3 },

  passwordHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  changeBtn: { fontSize: 12, fontWeight: '700', color: PATIENT.primary },
  passwordSub: { fontSize: 11, color: '#64748b', marginTop: 2 },

  tabsContainer: { flexDirection: 'row', gap: 8, marginBottom: 12, backgroundColor: '#f1f5f9', padding: 4, borderRadius: 8 },
  tab: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  tabActive: { backgroundColor: PATIENT.primary },
  tabText: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  tabTextActive: { color: '#ffffff' },

  passwordContent: { gap: 10 },

  inputBox: { marginBottom: 2 },
  inputLabel: { fontSize: 11, fontWeight: '700', color: '#334155', marginBottom: 6 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 8, paddingHorizontal: 11, borderWidth: 1, borderColor: '#dbe3ef', minHeight: 42, gap: 8 },
  input: { flex: 1, color: '#0f172a', fontSize: 13, fontWeight: '500', paddingVertical: 10 },
  emailReadonly: { flex: 1, color: '#64748b', fontSize: 13, fontWeight: '500' },

  otpBtn: { backgroundColor: PATIENT.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6, minWidth: 80, alignItems: 'center' },
  otpBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: PATIENT.primary, borderRadius: 10, paddingVertical: 12, marginTop: 8 },
  submitBtnText: { fontSize: 14, fontWeight: '800', color: '#ffffff' },
  btnDisabled: { opacity: 0.5 },

  appLockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  appLockTitle: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  appLockSub: { fontSize: 11, color: '#64748b', marginTop: 2 },

  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: PATIENT.primary, marginHorizontal: 12, marginTop: 10, marginBottom: 12, borderRadius: 10, paddingVertical: 14, shadowColor: PATIENT.primary, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 3 },
  saveBtnText: { fontSize: 15, fontWeight: '800', color: '#ffffff' },
});

export default UserAccountSettings;
