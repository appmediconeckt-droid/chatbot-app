import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosInstance, { API_BASE_URL } from '../../../../../axiosConfig';
import Feather from 'react-native-vector-icons/Feather';

/* ── helpers ──────────────────────────────────────────────────── */
const INITIAL = {
  otp: '', password: '', confirmPassword: '',
  oldPassword: '', newPassword: '', confirmNewPassword: '',
};

const strengthOf = (pw) => {
  let s = 0;
  if (pw.length >= 6) s++;
  if (/[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return s;
};
const STRENGTH_LABELS = ['Too short', 'Basic', 'Good', 'Strong', 'Very strong'];
const STRENGTH_COLORS = ['#e2e8f0', '#f59e0b', '#f59e0b', '#10b981', '#10b981'];

/* ── sub-components ───────────────────────────────────────────── */
const StrengthBar = ({ password }) => {
  const score = useMemo(() => strengthOf(password), [password]);
  if (!password) return null;
  return (
    <View style={st.wrap}>
      <View style={st.bars}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[st.bar, i < score && { backgroundColor: STRENGTH_COLORS[score] }]} />
        ))}
      </View>
      <Text style={[st.label, { color: STRENGTH_COLORS[score] }]}>{STRENGTH_LABELS[score]}</Text>
    </View>
  );
};

const PwInput = ({ label, value, onChange, placeholder, show, onToggle }) => (
  <View style={f.field}>
    <Text style={f.label}>{label}</Text>
    <View style={f.row}>
      <Feather name="lock" size={16} color="#94a3b8" style={f.icon} />
      <TextInput
        style={f.input}
        value={value}
        onChangeText={onChange}
        secureTextEntry={!show}
        autoCapitalize="none"
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
        returnKeyType="next"
      />
      <TouchableOpacity onPress={onToggle} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Feather name={show ? 'eye-off' : 'eye'} size={16} color="#94a3b8" />
      </TouchableOpacity>
    </View>
  </View>
);

const Notice = ({ type, msg }) => {
  if (!msg) return null;
  const isErr = type === 'error';
  return (
    <View style={[n.wrap, isErr ? n.err : n.ok]}>
      <Feather name={isErr ? 'alert-circle' : 'check-circle'} size={14} color={isErr ? '#dc2626' : '#16a34a'} />
      <Text style={[n.text, { color: isErr ? '#dc2626' : '#16a34a' }]}>{msg}</Text>
    </View>
  );
};

/* ── main component ───────────────────────────────────────────── */
const UserAccountSettings = ({ onNavigateBack }) => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [account, setAccount] = useState({ name: '', email: '', phone: '', authProvider: '', hasPassword: false });
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [mode, setMode] = useState('change'); // 'change' | 'set'
  const [form, setForm] = useState(INITIAL);
  const [otpSent, setOtpSent] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [notice, setNotice] = useState({ type: '', msg: '' });
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => { loadAccount(); }, []);

  const loadAccount = async () => {
    setLoadingAccount(true);
    try {
      const userId = await AsyncStorage.getItem('userId');
      const token = (await AsyncStorage.getItem('token')) || (await AsyncStorage.getItem('accessToken'));

      // Fallback email stored at login time
      const rawUserData = await AsyncStorage.getItem('userData');
      const parsedUserData = rawUserData ? JSON.parse(rawUserData) : null;
      const storedEmail = (await AsyncStorage.getItem('userEmail')) || parsedUserData?.email || '';

      if (!userId) {
        // No userId — at least populate email from storage so OTP can still be sent
        if (storedEmail) setAccount((p) => ({ ...p, email: storedEmail }));
        setLoadingAccount(false);
        return;
      }

      const res = await axiosInstance.get(`/api/auth/getUser/${userId}`);

      if (res.data?.success && res.data.user) {
        const u = res.data.user;
        const hasPass = typeof u.hasPassword === 'boolean'
          ? u.hasPassword
          : u.authProvider !== 'google' || !u.googleId;
        setAccount({
          name: u.fullName || u.name || '',
          email: u.email || storedEmail,
          phone: u.phoneNumber || u.phone || '',
          authProvider: u.authProvider || '',
          hasPassword: hasPass,
        });
        setMode(hasPass ? 'change' : 'set');
      } else if (storedEmail) {
        setAccount((p) => ({ ...p, email: storedEmail }));
      }
    } catch (e) {
      // API failed — try to at least get the email from storage
      try {
        const storedEmail = (await AsyncStorage.getItem('userEmail')) || (await AsyncStorage.getItem('email')) || '';
        const userData = await AsyncStorage.getItem('userData');
        const parsedEmail = userData ? JSON.parse(userData)?.email : '';
        const finalEmail = storedEmail || parsedEmail || '';
        if (finalEmail) setAccount((p) => ({ ...p, email: finalEmail }));
      } catch (_) {}
    } finally {
      setLoadingAccount(false);
    }
  };

  const setF = (key, val) =>
    setForm((p) => ({ ...p, [key]: key === 'otp' ? val.replace(/\D/g, '') : val }));

  const clear = () => setNotice({ type: '', msg: '' });
  const err = (msg) => setNotice({ type: 'error', msg });
  const ok = (msg) => setNotice({ type: 'success', msg });

  const switchMode = (m) => {
    setMode(m); clear(); setForm(INITIAL); setOtpSent(false);
    setShowOld(false); setShowNew(false); setShowConfirm(false);
  };

  /* ── Send OTP to email (generateOtp → Brevo email) ── */
  const sendOtp = async () => {
    clear();
    const emailToUse = account.email?.trim().toLowerCase();
    if (!emailToUse) { err('Email not found. Please log out and log in again.'); return; }
    setOtpLoading(true);
    try {
      const res = await axiosInstance.post('/api/auth/generateOtp', { email: emailToUse });
      if (res.data?.success) {
        setOtpSent(true);
        ok(res.data.message || `OTP sent to ${emailToUse}`);
      } else {
        err(res.data?.message || 'Failed to send OTP.');
      }
    } catch (e) {
      err(e.response?.data?.message || e.response?.data?.error || e.message || 'Failed to send OTP.');
    } finally {
      setOtpLoading(false);
    }
  };

  /* ── Set password with OTP (same as web) ── */
  const addPassword = async () => {
    clear();
    if (!form.otp || form.otp.length !== 6) { err('Enter the 6-digit OTP sent to your email.'); return; }
    if (form.password.length < 6) { err('Password must be at least 6 characters.'); return; }
    if (form.password !== form.confirmPassword) { err('Passwords do not match.'); return; }
    setPwLoading(true);
    try {
      const res = await axiosInstance.post('/api/auth/set-password-by-otp', {
        email: account.email?.trim().toLowerCase(),
        otp: form.otp,
        password: form.password,
      });
      if (res.data?.success) {
        ok(res.data.message || 'Password set successfully!');
        setForm(INITIAL);
        setOtpSent(false);
        setAccount((p) => ({ ...p, hasPassword: true }));
        setMode('change');
      } else {
        err(res.data?.message || 'Failed to set password.');
      }
    } catch (e) {
      const msg = e.response?.data?.message || e.message || 'Failed. Please try again.';
      err(msg);
      if (/already set/i.test(msg)) setMode('change');
    } finally {
      setPwLoading(false);
    }
  };

  /* ── change password ── */
  const changePassword = async () => {
    clear();
    if (!form.oldPassword) { err('Enter your current password.'); return; }
    if (form.newPassword.length < 6) { err('New password must be at least 6 characters.'); return; }
    if (form.newPassword !== form.confirmNewPassword) { err('New passwords do not match.'); return; }
    if (form.oldPassword === form.newPassword) { err('New password must be different from current.'); return; }
    setPwLoading(true);
    try {
      const res = await axiosInstance.post('/api/auth/changePassword', {
        oldPassword: form.oldPassword, newPassword: form.newPassword,
      });
      if (res.data?.success) {
        ok(res.data.message || 'Password changed successfully!');
        setForm(INITIAL);
        setAccount((p) => ({ ...p, hasPassword: true }));
      } else {
        err(res.data?.message || 'Failed to change password.');
      }
    } catch (e) {
      const msg = e.response?.data?.message || e.message || 'Failed to change password.';
      err(msg);
      if (/no password set/i.test(msg)) setMode('set');
    } finally {
      setPwLoading(false);
    }
  };

  if (loadingAccount) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#4f46e5" />
        <Text style={s.loadingTxt}>{t('common:loading')}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={s.root}
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.header}>
          {onNavigateBack && (
            <TouchableOpacity style={s.backBtn} onPress={onNavigateBack} activeOpacity={0.7}>
              <Feather name="arrow-left" size={20} color="#0f172a" />
            </TouchableOpacity>
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.title}>{t('settings:account')}</Text>
            <Text style={s.subtitle}>{t('settings:security')}</Text>
          </View>
        </View>

        {/* Account info */}
        <View style={s.card}>
          <Text style={s.cardTitle}>{t('settings:account')}</Text>
          {[
            { label: t('auth:name'), val: account.name },
            { label: t('auth:email'), val: account.email },
            { label: t('auth:phone'), val: account.phone },
            { label: t('settings:loginVia'), val: account.authProvider === 'google' ? 'Google' : 'Email & Password' },
            { label: t('auth:password'), val: account.hasPassword ? '●●●●●● (set)' : 'Not set yet' },
          ].map(({ label, val }) => (
            <View key={label} style={s.infoRow}>
              <Text style={s.infoKey}>{label}</Text>
              <Text style={[s.infoVal, label === 'Password' && !account.hasPassword && { color: '#f59e0b' }]}>
                {val || '—'}
              </Text>
            </View>
          ))}
        </View>

        {/* Password Security */}
        <View style={s.card}>
          {/* Tab toggle */}
          <View style={s.tabRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.cardTitle}>{t('settings:passwordSecurity')}</Text>
              <Text style={s.cardSub}>
                {mode === 'set' ? t('settings:setPasswordOtp') : t('settings:updatePassword')}
              </Text>
            </View>
            <View style={s.tabs}>
              <TouchableOpacity
                style={[s.tab, mode === 'set' && s.tabActive]}
                onPress={() => switchMode('set')}
                activeOpacity={0.8}
              >
                <Text style={[s.tabTxt, mode === 'set' && s.tabTxtActive]}>{t('settings:addTab')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.tab, mode === 'change' && s.tabActive]}
                onPress={() => switchMode('change')}
                activeOpacity={0.8}
              >
                <Text style={[s.tabTxt, mode === 'change' && s.tabTxtActive]}>{t('settings:changeTab')}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <Notice type={notice.type} msg={notice.msg} />

          {mode === 'set' ? (
            <>
              {/* Email row + Send OTP button */}
              <View style={f.field}>
                <Text style={f.label}>{t('settings:yourEmail')}</Text>
                <View style={f.row}>
                  <Feather name="mail" size={16} color="#94a3b8" style={f.icon} />
                  <Text style={f.readOnly} numberOfLines={1}>{account.email || '—'}</Text>
                  <TouchableOpacity
                    style={[s.otpBtn, (otpLoading || !account.email) && s.btnDisabled]}
                    onPress={sendOtp}
                    disabled={otpLoading || !account.email}
                    activeOpacity={0.8}
                  >
                    {otpLoading
                      ? <ActivityIndicator size={12} color="#fff" />
                      : <Text style={s.otpBtnTxt}>{otpSent ? t('auth:resendOtp') : t('auth:sendOtp')}</Text>
                    }
                  </TouchableOpacity>
                </View>
              </View>

              {/* OTP input — shown after OTP sent */}
              {otpSent && (
                <View style={f.field}>
                  <Text style={f.label}>{t('settings:otpCodeLabel')}</Text>
                  <View style={f.row}>
                    <Feather name="hash" size={16} color="#94a3b8" style={f.icon} />
                    <TextInput
                      style={f.input}
                      value={form.otp}
                      onChangeText={(v) => setF('otp', v)}
                      keyboardType="number-pad"
                      maxLength={6}
                      placeholder="Enter 6-digit OTP"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                </View>
              )}

              <PwInput
                label={t('auth:newPassword')}
                value={form.password}
                onChange={(v) => setF('password', v)}
                placeholder="Minimum 6 characters"
                show={showNew}
                onToggle={() => setShowNew((x) => !x)}
              />
              <StrengthBar password={form.password} />
              <PwInput
                label={t('auth:confirmPassword')}
                value={form.confirmPassword}
                onChange={(v) => setF('confirmPassword', v)}
                placeholder="Re-enter password"
                show={showConfirm}
                onToggle={() => setShowConfirm((x) => !x)}
              />
              <TouchableOpacity
                style={[s.submitBtn, (pwLoading || !otpSent) && s.btnDisabled]}
                onPress={addPassword}
                disabled={pwLoading || !otpSent}
                activeOpacity={0.85}
              >
                {pwLoading
                  ? <ActivityIndicator color="#fff" />
                  : <><Feather name="save" size={16} color="#fff" /><Text style={s.submitTxt}>{t('common:save')}</Text></>
                }
              </TouchableOpacity>
            </>
          ) : (
            <>
              <PwInput
                label={t('auth:oldPassword')}
                value={form.oldPassword}
                onChange={(v) => setF('oldPassword', v)}
                placeholder="Enter current password"
                show={showOld}
                onToggle={() => setShowOld((x) => !x)}
              />
              <PwInput
                label={t('auth:newPassword')}
                value={form.newPassword}
                onChange={(v) => setF('newPassword', v)}
                placeholder="Minimum 6 characters"
                show={showNew}
                onToggle={() => setShowNew((x) => !x)}
              />
              <StrengthBar password={form.newPassword} />
              <PwInput
                label={t('auth:confirmPassword')}
                value={form.confirmNewPassword}
                onChange={(v) => setF('confirmNewPassword', v)}
                placeholder="Re-enter new password"
                show={showConfirm}
                onToggle={() => setShowConfirm((x) => !x)}
              />

              <TouchableOpacity
                style={[s.submitBtn, pwLoading && s.btnDisabled]}
                onPress={changePassword}
                disabled={pwLoading}
                activeOpacity={0.85}
              >
                {pwLoading
                  ? <ActivityIndicator color="#fff" />
                  : <><Feather name="check-circle" size={16} color="#fff" /><Text style={s.submitTxt}>{t('settings:changePassword')}</Text></>
                }
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* App Lock */}
        <TouchableOpacity
          style={s.lockCard}
          onPress={() => navigation.navigate('PinSetup')}
          activeOpacity={0.8}
        >
          <View style={s.lockIconWrap}>
            <Feather name="smartphone" size={18} color="#7c3aed" />
          </View>
          <View style={s.lockText}>
            <Text style={s.lockTitle}>{t('settings:appLock')}</Text>
            <Text style={s.lockSub}>{t('settings:pinFingerprint')}</Text>
          </View>
          <Feather name="chevron-right" size={18} color="#94a3b8" />
        </TouchableOpacity>

        <Text style={s.footer}>© 2025 Mediconnect. All rights reserved.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default UserAccountSettings;

/* ── styles ───────────────────────────────────────────────────── */
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#f1f5f9' },
  content: { paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, backgroundColor: '#f1f5f9' },
  loadingTxt: { fontSize: 14, color: '#64748b' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: { fontSize: 22, fontWeight: '700', color: '#0f172a' },
  subtitle: { fontSize: 13, color: '#94a3b8', marginTop: 2 },

  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e8ecf0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a', marginBottom: 2 },
  cardSub: { fontSize: 12, color: '#94a3b8', marginBottom: 16 },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  infoKey: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  infoVal: { fontSize: 13, color: '#0f172a', fontWeight: '600', maxWidth: '60%', textAlign: 'right' },

  tabRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    padding: 3,
    alignSelf: 'flex-start',
    marginTop: 2,
  },
  tab: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8 },
  tabActive: { backgroundColor: '#4f46e5' },
  tabTxt: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  tabTxtActive: { color: '#fff' },

  otpBtn: {
    backgroundColor: '#4f46e5',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    minWidth: 90,
    alignItems: 'center',
  },
  otpBtnTxt: { color: '#fff', fontSize: 12, fontWeight: '700' },

  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#4f46e5',
    borderRadius: 14,
    paddingVertical: 15,
    marginTop: 8,
  },
  submitTxt: { color: '#fff', fontWeight: '800', fontSize: 15 },
  btnDisabled: { opacity: 0.5 },

  footer: { textAlign: 'center', fontSize: 11, color: '#cbd5e1', marginTop: 24 },

  lockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e8ecf0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  lockIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#EDE9FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockText: { flex: 1 },
  lockTitle: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  lockSub: { fontSize: 12, color: '#94a3b8', marginTop: 1 },
});

/* field styles */
const f = StyleSheet.create({
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '700', color: '#334155', marginBottom: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#dbe3ef',
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    minHeight: 50,
    gap: 8,
  },
  icon: {},
  input: { flex: 1, color: '#0f172a', fontSize: 14, paddingVertical: 10 },
  readOnly: { flex: 1, color: '#64748b', fontSize: 14 },
});

/* strength bar styles */
const st = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12, marginTop: -4 },
  bars: { flexDirection: 'row', flex: 1, gap: 4 },
  bar: { flex: 1, height: 4, borderRadius: 2, backgroundColor: '#e2e8f0' },
  label: { fontSize: 11, fontWeight: '700', minWidth: 62, textAlign: 'right' },
});

/* notice styles */
const n = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, padding: 12, marginBottom: 14 },
  err: { backgroundColor: '#fef2f2' },
  ok: { backgroundColor: '#f0fdf4' },
  text: { flex: 1, fontSize: 13, fontWeight: '500' },
});
