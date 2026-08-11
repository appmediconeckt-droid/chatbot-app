import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import axios from 'axios';
import LinearGradient from 'react-native-linear-gradient';
import { API_BASE_URL } from '../../../axiosConfig';
import useLanguageRender from '../../../hooks/useLanguageRender';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Reusable Forgot Password popup — mirrors the web chatbot flow exactly:
 *   Step 1: Email  -> POST /api/auth/send-forgot-password-otp   { email }
 *   Step 2: OTP    -> POST /api/auth/verify-forgot-password-otp { email, otp }
 *   Step 3: Reset  -> POST /api/auth/reset-password { email, newPassword, confirmPassword }
 *
 * Used by BOTH UserSignup (user side) and CounselorSignup (counselor side).
 *
 * Props:
 *   visible (bool)        - controls modal visibility
 *   onClose (fn)          - called to close the modal
 *   accentColor (string)  - theme color (user: #6366f1, counselor: #10b981)
 *   initialEmail (string) - prefill email from the login form
 */
const ForgotPasswordModal = ({
  visible,
  onClose,
  accentColor = '#006B2C',
  initialEmail = '',
}) => {
  const insets = useSafeAreaInsets();
  const { t } = useLanguageRender();
  // Theme gradient — counselor blue vs user green (matches signup/onboarding).
  const gradientColors = /004AC6|003A9B|1490FF|2563EB|1D4ED8/i.test(String(accentColor))
    ? ['#003A9B', '#1490FF']
    : ['#006B2C', '#01CE54'];
  const [step, setStep] = useState('email'); // 'email' | 'otp' | 'reset'
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resendTimer, setResendTimer] = useState(60);

  // Sync prefilled email whenever the modal opens
  useEffect(() => {
    if (visible) {
      setEmail(initialEmail || '');
    }
  }, [visible, initialEmail]);

  // 60-second resend countdown on the OTP step (matches web)
  useEffect(() => {
    if (step === 'otp' && resendTimer > 0) {
      const timer = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [step, resendTimer]);

  const resetAll = () => {
    setStep('email');
    setEmail('');
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setError('');
    setSuccess('');
    setResendTimer(60);
    setLoading(false);
    setResending(false);
  };

  const handleClose = () => {
    resetAll();
    onClose();
  };

  // STEP 1 — Send OTP
  const handleSendOTP = async () => {
    setError('');
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }
    try {
      setLoading(true);
      const res = await axios.post(
        `${API_BASE_URL}/api/auth/send-forgot-password-otp`,
        { email },
        { withCredentials: true },
      );
      if (res.data.success) {
        setOtp('');
        setResendTimer(60);
        setStep('otp');
      } else {
        setError(res.data.message || 'Failed to send OTP');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // STEP 2 — Verify OTP
  const handleVerifyOTP = async () => {
    setError('');
    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }
    try {
      setLoading(true);
      const res = await axios.post(
        `${API_BASE_URL}/api/auth/verify-forgot-password-otp`,
        { email, otp },
        { withCredentials: true },
      );
      if (res.data.success) {
        setSuccess('OTP verified successfully! Redirecting...');
        setTimeout(() => {
          setSuccess('');
          setNewPassword('');
          setConfirmPassword('');
          setStep('reset');
        }, 1200);
      } else {
        setError(res.data.message || 'Invalid OTP');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // STEP 2 — Resend OTP
  const handleResendOTP = async () => {
    setError('');
    try {
      setResending(true);
      const res = await axios.post(
        `${API_BASE_URL}/api/auth/send-forgot-password-otp`,
        { email },
        { withCredentials: true },
      );
      if (res.data.success) {
        setResendTimer(60);
      } else {
        setError(res.data.message || 'Failed to resend OTP');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to resend OTP. Please try again.');
    } finally {
      setResending(false);
    }
  };

  // STEP 3 — Reset Password
  const handleResetPassword = async () => {
    setError('');
    if (!newPassword) {
      setError('Please enter a new password');
      return;
    }
    if (newPassword.length < 3) {
      setError('Password must be at least 3 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    try {
      setLoading(true);
      const res = await axios.post(
        `${API_BASE_URL}/api/auth/reset-password`,
        { email, newPassword, confirmPassword },
        { withCredentials: true },
      );
      if (res.data.success) {
        setSuccess('Password reset successfully! Redirecting to login...');
        setTimeout(() => {
          handleClose();
        }, 1500);
      } else {
        setError(res.data.message || 'Failed to reset password');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.card, { paddingBottom: Math.max(insets.bottom, 36) }]}>
            {/* Close button */}
            <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
              <Text style={styles.closeText}>×</Text>
            </TouchableOpacity>

            {/* ===== STEP 1: EMAIL ===== */}
            {step === 'email' && (
              <View style={styles.step}>
                <View style={[styles.iconCircle, { backgroundColor: accentColor + '1A' }]}>
                  <Text style={styles.iconEmoji}>✉️</Text>
                </View>
                <Text style={styles.title}>{t('Forgot Password')}</Text>
                <Text style={styles.subtitle}>
                  Enter your registered email to receive a password reset OTP
                </Text>

                {error ? <Text style={styles.errorBox}>⚠️ {error}</Text> : null}

                <Text style={styles.label}>{t('Email Address *')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('Enter your registered email')}
                  placeholderTextColor="#94a3b8"
                  value={email}
                  onChangeText={(t) => {
                    setEmail(t);
                    setError('');
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!loading}
                />

                <TouchableOpacity style={{ alignSelf: 'stretch' }} activeOpacity={0.9} onPress={handleSendOTP} disabled={loading}>
                  <LinearGradient
                    colors={gradientColors}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={[styles.primaryBtn, loading && styles.btnDisabled]}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryBtnText}>{t('Send Reset OTP')}</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <View style={styles.footer}>
                  <Text style={styles.footerText}>{t('Remember your password?')}</Text>
                  <TouchableOpacity onPress={handleClose}>
                    <Text style={[styles.footerLink, { color: accentColor }]}>{t('Back to Login')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ===== STEP 2: OTP ===== */}
            {step === 'otp' && (
              <View style={styles.step}>
                <View style={[styles.iconCircle, { backgroundColor: accentColor + '1A' }]}>
                  <Text style={styles.iconEmoji}>✉️</Text>
                </View>
                <Text style={styles.title}>{t('Verify OTP')}</Text>
                <Text style={styles.subtitle}>{t('Enter the 6-digit code sent to')}</Text>
                <Text style={[styles.emailDisplay, { color: accentColor }]}>{email}</Text>

                {error ? <Text style={styles.errorBox}>⚠️ {error}</Text> : null}
                {success ? <Text style={styles.successBox}>✓ {success}</Text> : null}

                <Text style={styles.label}>{t('OTP Code *')}</Text>
                <TextInput
                  style={[styles.input, styles.otpInput]}
                  placeholder={t('000000')}
                  placeholderTextColor="#cbd5e1"
                  value={otp}
                  onChangeText={(t) => {
                    setOtp(t.replace(/[^0-9]/g, '').slice(0, 6));
                    setError('');
                  }}
                  keyboardType="number-pad"
                  maxLength={6}
                  editable={!loading && !success}
                />

                <TouchableOpacity style={{ alignSelf: 'stretch' }} activeOpacity={0.9} onPress={handleVerifyOTP} disabled={loading || !!success || !otp}>
                  <LinearGradient
                    colors={gradientColors}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={[styles.primaryBtn, (loading || !otp) && styles.btnDisabled]}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryBtnText}>{t('Verify OTP')}</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {/* Resend with 60s timer */}
                <TouchableOpacity
                  style={styles.resendBtn}
                  onPress={handleResendOTP}
                  disabled={resending || resendTimer > 0 || !!success}
                >
                  <Text
                    style={[
                      styles.resendText,
                      { color: accentColor },
                      (resendTimer > 0 || resending) && styles.resendDisabled,
                    ]}
                  >
                    {resending
                      ? 'Sending...'
                      : resendTimer > 0
                      ? `Resend in ${resendTimer}s`
                      : 'Resend OTP'}
                  </Text>
                </TouchableOpacity>

                <View style={styles.footer}>
                  <Text style={styles.footerText}>{t('Wrong email?')}</Text>
                  <TouchableOpacity onPress={() => { setStep('email'); setError(''); }}>
                    <Text style={[styles.footerLink, { color: accentColor }]}>{t('Go back')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* ===== STEP 3: RESET PASSWORD ===== */}
            {step === 'reset' && (
              <View style={styles.step}>
                <View style={[styles.iconCircle, { backgroundColor: accentColor + '1A' }]}>
                  <Text style={styles.iconEmoji}>🔒</Text>
                </View>
                <Text style={styles.title}>{t('Reset Password')}</Text>
                <Text style={styles.subtitle}>{t('Create a new password for your account')}</Text>
                <Text style={[styles.emailDisplay, { color: accentColor }]}>{email}</Text>

                {error ? <Text style={styles.errorBox}>⚠️ {error}</Text> : null}
                {success ? <Text style={styles.successBox}>✓ {success}</Text> : null}

                <Text style={styles.label}>{t('New Password *')}</Text>
                <View style={styles.passwordWrapper}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder={t('Enter new password')}
                    placeholderTextColor="#94a3b8"
                    value={newPassword}
                    onChangeText={(t) => {
                      setNewPassword(t);
                      setError('');
                    }}
                    secureTextEntry={!showPassword}
                    editable={!loading && !success}
                  />
                  <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword(!showPassword)}>
                    <Text style={styles.eyeEmoji}>{showPassword ? '🙈' : '👁️'}</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>{t('Confirm Password *')}</Text>
                <View style={styles.passwordWrapper}>
                  <TextInput
                    style={styles.passwordInput}
                    placeholder={t('Confirm new password')}
                    placeholderTextColor="#94a3b8"
                    value={confirmPassword}
                    onChangeText={(t) => {
                      setConfirmPassword(t);
                      setError('');
                    }}
                    secureTextEntry={!showConfirmPassword}
                    editable={!loading && !success}
                  />
                  <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                    <Text style={styles.eyeEmoji}>{showConfirmPassword ? '🙈' : '👁️'}</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={{ alignSelf: 'stretch' }} activeOpacity={0.9} onPress={handleResetPassword} disabled={loading || !!success}>
                  <LinearGradient
                    colors={gradientColors}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={[styles.primaryBtn, (loading || success) && styles.btnDisabled]}
                  >
                    {loading ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryBtnText}>{t('Reset Password')}</Text>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                <View style={styles.footer}>
                  <Text style={styles.footerText}>{t('Remember your password?')}</Text>
                  <TouchableOpacity onPress={handleClose}>
                    <Text style={[styles.footerLink, { color: accentColor }]}>{t('Back to Login')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 36,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    marginBottom: 4,
  },
  closeText: {
    fontSize: 26,
    color: '#64748b',
    fontWeight: '400',
    lineHeight: 28,
  },
  step: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  iconEmoji: {
    fontSize: 30,
  },
  title: {
    fontSize: 23,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13.5,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 4,
  },
  emailDisplay: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 14,
    textAlign: 'center',
  },
  errorBox: {
    color: '#dc2626',
    backgroundColor: '#fef2f2',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginTop: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
    fontSize: 13,
    fontWeight: '500',
    alignSelf: 'stretch',
  },
  successBox: {
    color: '#16a34a',
    backgroundColor: '#f0fdf4',
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginTop: 8,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#22c55e',
    fontSize: 13,
    fontWeight: '500',
    alignSelf: 'stretch',
  },
  label: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  input: {
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#1e293b',
    backgroundColor: '#f8fafc',
    alignSelf: 'stretch',
    marginBottom: 6,
  },
  otpInput: {
    textAlign: 'center',
    fontSize: 24,
    letterSpacing: 8,
    fontWeight: '800',
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    alignSelf: 'stretch',
    marginBottom: 6,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#1e293b',
  },
  eyeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  eyeEmoji: {
    fontSize: 20,
  },
  primaryBtn: {
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    marginTop: 14,
    elevation: 4,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  resendBtn: {
    paddingVertical: 10,
    marginTop: 6,
  },
  resendText: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  resendDisabled: {
    color: '#94a3b8',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
  },
  footerText: {
    fontSize: 13.5,
    color: '#64748b',
  },
  footerLink: {
    fontSize: 13.5,
    fontWeight: '700',
  },
});

export default ForgotPasswordModal;
