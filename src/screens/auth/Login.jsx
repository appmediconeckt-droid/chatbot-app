import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { API_BASE_URL } from '../../axiosConfig';
import GoogleAuthButton from './components/GoogleAuthButton';
import { sendLocationSilently } from '../../utils/locationHelper';
import socketService from '../../services/socketService';

const Login = ({ navigation, route }) => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Conflict modal states - MATCHING WEB VERSION EXACTLY
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Forgot Password Modal States
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [fpEmail, setFpEmail] = useState('');
  const [fpLoading, setFpLoading] = useState(false);
  const [fpResending, setFpResending] = useState(false);
  const [fpError, setFpError] = useState('');
  const [fpSuccess, setFpSuccess] = useState('');
  const [fpStep, setFpStep] = useState('email'); // 'email', 'otp', 'reset'
  const [fpOtp, setFpOtp] = useState('');
  const [fpNewPassword, setFpNewPassword] = useState('');
  const [fpConfirmPassword, setFpConfirmPassword] = useState('');
  const [fpShowPassword, setFpShowPassword] = useState(false);
  const [fpShowConfirmPassword, setFpShowConfirmPassword] = useState(false);
  const [fpResendTimer, setFpResendTimer] = useState(60);

  // Tablet detection
  const { width } = Dimensions.get('window');
  const isTablet = width >= 600;

  const normalizeRole = (role) => {
    const value = String(role || '').trim().toLowerCase();
    if (!value) return '';
    return value === 'counsellor' ? 'counselor' : value;
  };

  const mapRoleForBackend = (role) => {
    return role === 'counselor' ? 'counsellor' : role;
  };

  const buildBackendRoleCandidates = (role) => {
    // No role selected (e.g. came straight to Login without RoleSelector): send
    // BOTH so the request never 400s with "role is required". The retry loop
    // falls through to the next candidate on a role mismatch.
    if (!role) return ['user', 'counsellor'];
    return role === 'counselor'
      ? ['counsellor', 'counselor']
      : [mapRoleForBackend(role)];
  };

  useEffect(() => {
    loadRememberedUser();
  }, []);

  // Forgot Password OTP resend countdown timer (matches web — 60s)
  useEffect(() => {
    if (fpStep === 'otp' && fpResendTimer > 0) {
      const timer = setInterval(() => {
        setFpResendTimer((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [fpStep, fpResendTimer]);

  const loadRememberedUser = async () => {
    try {
      const rememberedUserId = await AsyncStorage.getItem('rememberedUserId');
      if (rememberedUserId) {
        setEmail(rememberedUserId);
        setRememberMe(true);
      }
    } catch (error) {
      console.error('Error loading remembered user:', error);
    }
  };

  const validateEmail = () => {
    if (!email) {
      setErrorMessage(t('auth:enterEmail'));
      return false;
    }
    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(email)) {
      setErrorMessage(t('auth:enterEmail'));
      return false;
    }
    return true;
  };

  const handleLogin = async () => {
    if (!validateEmail()) return;
    if (!password) {
      setErrorMessage(t('auth:enterPassword'));
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsLoading(true);

    try {
      const roleFromRoute = normalizeRole(route?.params?.role);
      const storedRoleRaw = normalizeRole(await AsyncStorage.getItem('role'));
      const selectedRole = roleFromRoute || storedRoleRaw;
      const roleCandidates = buildBackendRoleCandidates(selectedRole);

      let response;
      for (let index = 0; index < Math.max(roleCandidates.length, 1); index += 1) {
        const candidateRole = roleCandidates[index];
        try {
          response = await axios.post(
            `${API_BASE_URL}/api/auth/login`,
            {
              email,
              password,
              ...(candidateRole ? { role: candidateRole } : {}),
            },
            { withCredentials: true }
          );
          break;
        } catch (error) {
          const message = String(error?.response?.data?.message || '').toLowerCase();
          const isRoleMismatch =
            error?.response?.status === 403 ||
            message.includes('role mismatch') ||
            message.includes('role');
          const isLastAttempt = index === Math.max(roleCandidates.length, 1) - 1;
          if (!isRoleMismatch || isLastAttempt) {
            throw error;
          }
        }
      }

      // FIRST: Get the role from response
      const userRoleRaw =
        response.data?.role || response.data?.user?.role || 'user';
      const normalizedUserRole = normalizeRole(userRoleRaw) || 'user';
      const isCounselor = normalizedUserRole === 'counselor';

      // SECOND: Read the role the user selected in RoleSelector.
      const selectedAsCounselor = selectedRole === 'counselor';

      // THIRD: Validate — if a role was explicitly selected, enforce it.
      if (selectedRole) {
        if (selectedAsCounselor && !isCounselor) {
          setErrorMessage(
            "Access denied: You selected the Counsellor login but your account is registered as a User. Please go back and select the correct role."
          );
          setIsLoading(false);
          return;
        }

        if (!selectedAsCounselor && isCounselor) {
          setErrorMessage(
            "Access denied: You selected the User login but your account is registered as a Counsellor. Please go back and select the correct role."
          );
          setIsLoading(false);
          return;
        }
      }

      const token = response.data?.accessToken || response.data?.token;
      if (token) {
        await AsyncStorage.setItem('accessToken', token);
        await AsyncStorage.setItem('token', token);
      }
      if (response.data?.refreshToken) {
        await AsyncStorage.setItem('refreshToken', response.data.refreshToken);
      }

      await AsyncStorage.setItem('userRole', normalizedUserRole);
      await AsyncStorage.setItem('isAuthenticated', 'true');
      await AsyncStorage.setItem('userEmail', email);

      const user = response.data?.user || response.data;
      if (user) {
        await AsyncStorage.setItem('userData', JSON.stringify(user));
        const id = user._id || user.id;
        if (id) {
          await AsyncStorage.setItem('userId', id);
          if (isCounselor) {
            await AsyncStorage.setItem('counsellorId', id);
            await AsyncStorage.setItem('counselorId', id);
          }
        }
      }

      // Remove temporary selected role
      await AsyncStorage.removeItem('role');

      if (rememberMe) {
        await AsyncStorage.setItem('rememberedUserId', email);
      } else {
        await AsyncStorage.removeItem('rememberedUserId');
      }

      setSuccessMessage(t('auth:login') + ' ' + t('common:success'));

      socketService.connect().catch(() => {});

      const destination = isCounselor ? 'CounselorDashboard' : 'UserDashboard';
      setTimeout(() => {
        navigation.replace('LocationGate', { destination });
      }, 800);
    } catch (err) {
      // CRITICAL: Check for both conditions exactly like web version
      if (
        err?.isOneDeviceConflict ||
        (err?.response?.status === 409 && err?.response?.data?.needLogout)
      ) {
        setShowConflictModal(true);
        setOtpSent(false);
        setOtp('');
        return;
      }

      const msg = err?.response?.data?.message || err?.message || 'Login failed';
      setErrorMessage(msg);
      
      // Auto-clear error message after 3 seconds
      setTimeout(() => setErrorMessage(''), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogoutOtherDevices = async () => {
    setLogoutLoading(true);
    setErrorMessage('');

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/auth/logout-other-devices`,
        { email },
        { withCredentials: true }
      );

      if (response.data?.success) {
        setOtpSent(true);
        setSuccessMessage('OTP sent to your email.');
        // Auto-clear success message
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setErrorMessage(response.data?.message || 'Failed to send OTP');
        setTimeout(() => setErrorMessage(''), 3000);
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to send OTP';
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(''), 3000);
    } finally {
      setLogoutLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      setErrorMessage('Please enter a valid 6-digit OTP');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    setOtpLoading(true);
    setErrorMessage('');

    try {
      const roleFromRoute = normalizeRole(route?.params?.role);
      const storedRole = normalizeRole(await AsyncStorage.getItem('role'));
      const selectedRole = roleFromRoute || storedRole || 'user';

      const response = await axios.post(
        `${API_BASE_URL}/api/auth/verify-login-otp`,
        { email, otp },
        { withCredentials: true }
      );

      const token = response.data?.accessToken || response.data?.token;
      if (token) {
        await AsyncStorage.setItem('accessToken', token);
        await AsyncStorage.setItem('token', token);
      }
      if (response.data?.refreshToken) {
        await AsyncStorage.setItem('refreshToken', response.data.refreshToken);
      }

      const resolvedRole =
        normalizeRole(response.data?.role || response.data?.user?.role) ||
        selectedRole;
      await AsyncStorage.setItem('userRole', resolvedRole);
      await AsyncStorage.setItem('isAuthenticated', 'true');
      await AsyncStorage.setItem('userEmail', email);

      const user = response.data?.user || response.data;
      if (user) {
        await AsyncStorage.setItem('userData', JSON.stringify(user));
        const id = user._id || user.id;
        if (id) {
          await AsyncStorage.setItem('userId', id);
          if (resolvedRole === 'counselor') {
            await AsyncStorage.setItem('counsellorId', id);
            await AsyncStorage.setItem('counselorId', id);
          }
        }
      }

      await AsyncStorage.removeItem('role');

      setShowConflictModal(false);
      setSuccessMessage('OTP verified! Redirecting...');

      socketService.connect().catch(() => {});

      const destination = resolvedRole === 'counselor' ? 'CounselorDashboard' : 'UserDashboard';
      setTimeout(() => {
        navigation.replace('LocationGate', { destination });
      }, 800);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'OTP verification failed';
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(''), 3000);
    } finally {
      setOtpLoading(false);
    }
  };

  // ========== FORGOT PASSWORD HANDLERS (mirrors web chatbot exactly) ==========

  // STEP 1 — Send OTP (web: ForgotPassword.jsx handleSubmit)
  const handleForgotPasswordSendOTP = async () => {
    setFpError('');

    if (!fpEmail.trim()) {
      setFpError('Please enter your email address');
      return;
    }

    if (!/\S+@\S+\.\S+/.test(fpEmail)) {
      setFpError('Please enter a valid email address');
      return;
    }

    try {
      setFpLoading(true);
      const response = await axios.post(
        `${API_BASE_URL}/api/auth/send-forgot-password-otp`,
        { email: fpEmail },
        { withCredentials: true }
      );

      if (response.data.success) {
        setFpOtp('');
        setFpResendTimer(60);
        setFpStep('otp');
      } else {
        setFpError(response.data.message || 'Failed to send OTP');
      }
    } catch (err) {
      setFpError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setFpLoading(false);
    }
  };

  // STEP 2 — Verify OTP (web: ForgotPasswordOTP.jsx handleVerify)
  const handleForgotPasswordVerifyOTP = async () => {
    setFpError('');

    if (!fpOtp || fpOtp.length !== 6) {
      setFpError('Please enter a valid 6-digit OTP');
      return;
    }

    try {
      setFpLoading(true);
      const response = await axios.post(
        `${API_BASE_URL}/api/auth/verify-forgot-password-otp`,
        { email: fpEmail, otp: fpOtp },
        { withCredentials: true }
      );

      if (response.data.success) {
        setFpSuccess('OTP verified successfully! Redirecting...');
        setTimeout(() => {
          setFpSuccess('');
          setFpNewPassword('');
          setFpConfirmPassword('');
          setFpStep('reset');
        }, 1200);
      } else {
        setFpError(response.data.message || 'Invalid OTP');
      }
    } catch (err) {
      setFpError(err.response?.data?.message || 'Verification failed. Please try again.');
    } finally {
      setFpLoading(false);
    }
  };

  // STEP 2 — Resend OTP (web: ForgotPasswordOTP.jsx handleResend)
  const handleForgotPasswordResendOTP = async () => {
    setFpError('');
    try {
      setFpResending(true);
      const response = await axios.post(
        `${API_BASE_URL}/api/auth/send-forgot-password-otp`,
        { email: fpEmail },
        { withCredentials: true }
      );

      if (response.data.success) {
        setFpResendTimer(60);
      } else {
        setFpError(response.data.message || 'Failed to resend OTP');
      }
    } catch (err) {
      setFpError(err.response?.data?.message || 'Failed to resend OTP. Please try again.');
    } finally {
      setFpResending(false);
    }
  };

  // STEP 3 — Reset Password (web: ResetPassword.jsx handleSubmit)
  const handleForgotPasswordReset = async () => {
    setFpError('');

    if (!fpNewPassword) {
      setFpError('Please enter a new password');
      return;
    }

    if (fpNewPassword.length < 3) {
      setFpError('Password must be at least 3 characters');
      return;
    }

    if (fpNewPassword !== fpConfirmPassword) {
      setFpError('Passwords do not match');
      return;
    }

    try {
      setFpLoading(true);
      const response = await axios.post(
        `${API_BASE_URL}/api/auth/reset-password`,
        { email: fpEmail, newPassword: fpNewPassword, confirmPassword: fpConfirmPassword },
        { withCredentials: true }
      );

      if (response.data.success) {
        setFpSuccess('Password reset successfully! Redirecting to login...');
        setTimeout(() => {
          closeForgotPasswordModal();
        }, 1500);
      } else {
        setFpError(response.data.message || 'Failed to reset password');
      }
    } catch (err) {
      setFpError(err.response?.data?.message || 'Failed to reset password. Please try again.');
    } finally {
      setFpLoading(false);
    }
  };

  const closeForgotPasswordModal = () => {
    setShowForgotPasswordModal(false);
    setFpStep('email');
    setFpEmail('');
    setFpOtp('');
    setFpNewPassword('');
    setFpConfirmPassword('');
    setFpError('');
    setFpSuccess('');
    setFpShowPassword(false);
    setFpShowConfirmPassword(false);
    setFpResendTimer(60);
  };

  const scrollContainerStyle = {
    ...styles.scrollContainer,
    justifyContent: 'center',
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={scrollContainerStyle}>
        <View style={styles.loginCard}>
          {/* Header Section */}
          <View style={styles.headerSection}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoText}>Mediconeckt</Text>
            </View>
            <Text style={styles.title}>{t('auth:welcomeBack')}</Text>
            <Text style={styles.subtitle}>{t('auth:login')} {t('common:or')} {t('auth:email')}</Text>
          </View>

          {/* Form Section */}
          <View style={styles.formContainer}>
            {/* Email Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('auth:email')}</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder={t('auth:enterEmail')}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    setErrorMessage('');
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  editable={!isLoading}
                />
              </View>
            </View>

            {/* Password Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>{t('auth:password')}</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder={t('auth:enterPassword')}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    setErrorMessage('');
                  }}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  editable={!isLoading}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Text>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Options */}
            <View style={styles.optionsContainer}>
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => setRememberMe(!rememberMe)}
              >
                <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                  {rememberMe && <Text style={styles.checkmark}>✓</Text>}
                </View>
                <Text style={styles.checkboxLabel}>{t('common:confirm')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  console.log('FORGOT PASSWORD TAPPED - opening modal');
                  setShowForgotPasswordModal(true);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                activeOpacity={0.6}
              >
                <Text style={styles.forgotPassword}>{t('auth:forgotPassword')}</Text>
              </TouchableOpacity>
            </View>

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.loginButton, (!email || !password || isLoading) && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={!email || !password || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.loginButtonText}>{t('auth:login')}</Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t('auth:orContinueWith')}</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google Sign-In */}
            <GoogleAuthButton
              role={normalizeRole(route?.params?.role) || 'user'}
              mode="signin"
              disabled={isLoading}
              locationEvent="login"
              onSuccess={({ isCounselor }) => {
                setSuccessMessage(t('auth:login') + ' ' + t('common:success'));
                const destination = isCounselor ? 'CounselorDashboard' : 'UserDashboard';
                setTimeout(() => {
                  navigation.replace('LocationGate', { destination });
                }, 800);
              }}
              onConflict={({ email: conflictEmail }) => {
                if (conflictEmail) setEmail(conflictEmail);
                setShowConflictModal(true);
                setOtpSent(false);
                setOtp('');
                setErrorMessage('');
              }}
              onError={(msg) => {
                console.warn('[Login] Google onError:', msg);
                setErrorMessage(msg);
                // 8s — long enough to actually read it.
                setTimeout(() => setErrorMessage(''), 8000);
              }}
            />

            {/* Error Message */}
            {errorMessage ? (
              <View style={[styles.errorContainer, { marginTop: 16 }]}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {/* Success Message */}
            {successMessage ? (
              <View style={styles.successContainer}>
                <Text style={styles.successText}>{successMessage}</Text>
              </View>
            ) : null}

            {/* Sign Up Link */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>{t('auth:dontHaveAccount')} </Text>
              <TouchableOpacity onPress={() => navigation.navigate('RoleSelector')}>
                <Text style={styles.signUpLink}> {t('auth:signup')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Conflict Resolution Modal - EXACT MATCH TO WEB VERSION */}
        <Modal
          visible={showConflictModal}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setShowConflictModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>Session Conflict Detected</Text>
              <Text style={styles.modalText}>
                You are already logged in on another device.
              </Text>

              {/* Logout Other Devices Button */}
              <TouchableOpacity
                style={styles.modalButton}
                onPress={handleLogoutOtherDevices}
                disabled={logoutLoading}
              >
                {logoutLoading ? (
                  <View style={styles.buttonLoadingContainer}>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={styles.modalButtonText}> Sending OTP...</Text>
                  </View>
                ) : (
                  <Text style={styles.modalButtonText}>
                    Logout Other Devices & Send OTP
                  </Text>
                )}
              </TouchableOpacity>

              {/* OTP Section - Only shows after OTP is sent */}
              {otpSent && (
                <View style={styles.otpSection}>
                  <Text style={styles.otpLabel}>Enter OTP:</Text>
                  <TextInput
                    style={styles.otpInput}
                    value={otp}
                    onChangeText={(text) => {
                      const cleaned = text.replace(/\D/g, '').slice(0, 6);
                      setOtp(cleaned);
                      setErrorMessage(''); // Clear error when typing
                    }}
                    placeholder="6-digit code"
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                  <TouchableOpacity
                    style={[styles.modalButton, styles.verifyButton]}
                    onPress={handleVerifyOtp}
                    disabled={otpLoading}
                  >
                    {otpLoading ? (
                      <View style={styles.buttonLoadingContainer}>
                        <ActivityIndicator color="#fff" size="small" />
                        <Text style={styles.modalButtonText}> Verifying...</Text>
                      </View>
                    ) : (
                      <Text style={styles.modalButtonText}>Verify OTP</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </Modal>

        {/* ========== FORGOT PASSWORD MODAL ========== */}
        <Modal
          visible={showForgotPasswordModal}
          transparent={true}
          animationType="slide"
          onRequestClose={closeForgotPasswordModal}
        >
          <View style={styles.fpModalOverlay}>
            <ScrollView
              contentContainerStyle={styles.fpModalScroll}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.fpModalContent}>
                {/* Close Button */}
                <TouchableOpacity
                  style={styles.fpCloseBtn}
                  onPress={closeForgotPasswordModal}
                >
                  <Text style={styles.fpCloseBtnText}>×</Text>
                </TouchableOpacity>

                {/* ===== STEP 1: EMAIL ===== */}
                {fpStep === 'email' && (
                  <View style={styles.fpStep}>
                    <View style={styles.fpIconWrap}>
                      <Text style={styles.fpIcon}>✉️</Text>
                    </View>
                    <Text style={styles.fpTitle}>Forgot Password</Text>
                    <Text style={styles.fpSubtitle}>
                      Enter your registered email to receive a password reset OTP
                    </Text>

                    {fpError ? <Text style={styles.fpError}>⚠️ {fpError}</Text> : null}

                    <Text style={styles.fpLabel}>Email Address *</Text>
                    <TextInput
                      style={styles.fpInput}
                      placeholder="Enter your registered email"
                      placeholderTextColor="#94a3b8"
                      value={fpEmail}
                      onChangeText={(text) => {
                        setFpEmail(text);
                        setFpError('');
                      }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      editable={!fpLoading}
                    />

                    <TouchableOpacity
                      style={[styles.fpButton, fpLoading && styles.fpButtonDisabled]}
                      onPress={handleForgotPasswordSendOTP}
                      disabled={fpLoading}
                    >
                      <Text style={styles.fpButtonText}>
                        {fpLoading ? 'Sending OTP...' : 'Send Reset OTP'}
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.fpFooter}>
                      <Text style={styles.fpFooterText}>Remember your password? </Text>
                      <TouchableOpacity onPress={closeForgotPasswordModal}>
                        <Text style={styles.fpFooterLink}>Back to Login</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* ===== STEP 2: OTP VERIFICATION ===== */}
                {fpStep === 'otp' && (
                  <View style={styles.fpStep}>
                    <View style={styles.fpIconWrap}>
                      <Text style={styles.fpIcon}>✉️</Text>
                    </View>
                    <Text style={styles.fpTitle}>Verify OTP</Text>
                    <Text style={styles.fpSubtitle}>Enter the 6-digit code sent to</Text>
                    <Text style={styles.fpEmailDisplay}>{fpEmail}</Text>

                    {fpError ? <Text style={styles.fpError}>⚠️ {fpError}</Text> : null}
                    {fpSuccess ? <Text style={styles.fpSuccess}>✓ {fpSuccess}</Text> : null}

                    <Text style={styles.fpLabel}>OTP Code *</Text>
                    <TextInput
                      style={[styles.fpInput, styles.fpOtpInput]}
                      placeholder="000000"
                      placeholderTextColor="#cbd5e1"
                      value={fpOtp}
                      onChangeText={(text) => {
                        setFpOtp(text.replace(/[^0-9]/g, '').slice(0, 6));
                        setFpError('');
                      }}
                      keyboardType="number-pad"
                      maxLength={6}
                      editable={!fpLoading && !fpSuccess}
                    />

                    <TouchableOpacity
                      style={[styles.fpButton, (fpLoading || !fpOtp) && styles.fpButtonDisabled]}
                      onPress={handleForgotPasswordVerifyOTP}
                      disabled={fpLoading || fpSuccess || !fpOtp}
                    >
                      <Text style={styles.fpButtonText}>
                        {fpLoading ? 'Verifying...' : 'Verify OTP'}
                      </Text>
                    </TouchableOpacity>

                    {/* Resend OTP with 60s timer (matches web) */}
                    <TouchableOpacity
                      style={styles.fpResendBtn}
                      onPress={handleForgotPasswordResendOTP}
                      disabled={fpResending || fpResendTimer > 0 || fpSuccess}
                    >
                      <Text
                        style={[
                          styles.fpResendText,
                          (fpResendTimer > 0 || fpResending) && styles.fpResendTextDisabled,
                        ]}
                      >
                        {fpResending
                          ? 'Sending...'
                          : fpResendTimer > 0
                          ? `Resend in ${fpResendTimer}s`
                          : 'Resend OTP'}
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.fpFooter}>
                      <Text style={styles.fpFooterText}>Wrong email? </Text>
                      <TouchableOpacity onPress={() => { setFpStep('email'); setFpError(''); }}>
                        <Text style={styles.fpFooterLink}>Go back</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* ===== STEP 3: RESET PASSWORD ===== */}
                {fpStep === 'reset' && (
                  <View style={styles.fpStep}>
                    <View style={styles.fpIconWrap}>
                      <Text style={styles.fpIcon}>🔒</Text>
                    </View>
                    <Text style={styles.fpTitle}>Reset Password</Text>
                    <Text style={styles.fpSubtitle}>Create a new password for your account</Text>
                    <Text style={styles.fpEmailDisplay}>{fpEmail}</Text>

                    {fpError ? <Text style={styles.fpError}>⚠️ {fpError}</Text> : null}
                    {fpSuccess ? <Text style={styles.fpSuccess}>✓ {fpSuccess}</Text> : null}

                    {/* New Password */}
                    <Text style={styles.fpLabel}>New Password *</Text>
                    <View style={styles.fpPasswordWrapper}>
                      <TextInput
                        style={styles.fpPasswordInput}
                        placeholder="Enter new password"
                        placeholderTextColor="#94a3b8"
                        value={fpNewPassword}
                        onChangeText={(text) => {
                          setFpNewPassword(text);
                          setFpError('');
                        }}
                        secureTextEntry={!fpShowPassword}
                        editable={!fpLoading && !fpSuccess}
                      />
                      <TouchableOpacity
                        style={styles.fpEyeBtn}
                        onPress={() => setFpShowPassword(!fpShowPassword)}
                      >
                        <Text style={styles.fpEyeText}>{fpShowPassword ? '🙈' : '👁️'}</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Confirm Password */}
                    <Text style={styles.fpLabel}>Confirm Password *</Text>
                    <View style={styles.fpPasswordWrapper}>
                      <TextInput
                        style={styles.fpPasswordInput}
                        placeholder="Confirm new password"
                        placeholderTextColor="#94a3b8"
                        value={fpConfirmPassword}
                        onChangeText={(text) => {
                          setFpConfirmPassword(text);
                          setFpError('');
                        }}
                        secureTextEntry={!fpShowConfirmPassword}
                        editable={!fpLoading && !fpSuccess}
                      />
                      <TouchableOpacity
                        style={styles.fpEyeBtn}
                        onPress={() => setFpShowConfirmPassword(!fpShowConfirmPassword)}
                      >
                        <Text style={styles.fpEyeText}>{fpShowConfirmPassword ? '🙈' : '👁️'}</Text>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      style={[styles.fpButton, (fpLoading || fpSuccess) && styles.fpButtonDisabled]}
                      onPress={handleForgotPasswordReset}
                      disabled={fpLoading || fpSuccess}
                    >
                      <Text style={styles.fpButtonText}>
                        {fpLoading ? 'Resetting Password...' : 'Reset Password'}
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.fpFooter}>
                      <Text style={styles.fpFooterText}>Remember your password? </Text>
                      <TouchableOpacity onPress={closeForgotPasswordModal}>
                        <Text style={styles.fpFooterLink}>Back to Login</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  loginCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  logoText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  formContainer: {
    marginTop: 10,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    backgroundColor: '#f9f9f9',
  },
  input: {
    flex: 1,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  passwordInput: {
    paddingRight: 40,
  },
  eyeIcon: {
    padding: 10,
    position: 'absolute',
    right: 0,
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 4,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
  },
  checkmark: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#666',
  },
  forgotPassword: {
    fontSize: 14,
    color: '#007AFF',
  },
  loginButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  loginButtonDisabled: {
    backgroundColor: '#ccc',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#ffcdd2',
  },
  errorText: {
    color: '#c62828',
    fontSize: 14,
    textAlign: 'center',
  },
  successContainer: {
    backgroundColor: '#e8f5e9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#c8e6c9',
  },
  successText: {
    color: '#2e7d32',
    fontSize: 14,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  footerText: {
    fontSize: 14,
    color: '#666',
  },
  signUpLink: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  modalText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  verifyButton: {
    backgroundColor: '#4CAF50',
  },
  otpSection: {
    marginTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 15,
  },
  otpLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  otpInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: 12,
  },
  buttonLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ========== FORGOT PASSWORD MODAL STYLES ==========
  fpModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  fpModalScroll: {
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  fpModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
  },
  fpCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    marginBottom: 8,
  },
  fpCloseBtnText: {
    fontSize: 28,
    color: '#666',
    fontWeight: '300',
    lineHeight: 30,
  },
  fpStep: {
    paddingBottom: 10,
    alignItems: 'center',
  },
  fpIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#f0f4ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  fpIcon: {
    fontSize: 32,
  },
  fpTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#081625',
    marginBottom: 8,
    textAlign: 'center',
  },
  fpSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 6,
    textAlign: 'center',
    lineHeight: 20,
  },
  fpEmailDisplay: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2c50cd',
    marginBottom: 16,
    textAlign: 'center',
  },
  fpError: {
    color: '#dc2626',
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
    fontSize: 13,
    fontWeight: '500',
    alignSelf: 'stretch',
  },
  fpSuccess: {
    color: '#16a34a',
    backgroundColor: '#f0fdf4',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#22c55e',
    fontSize: 13,
    fontWeight: '500',
    alignSelf: 'stretch',
  },
  fpLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
    marginBottom: 8,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  fpInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    fontSize: 16,
    marginBottom: 16,
    color: '#1e293b',
    backgroundColor: '#f8fafc',
    alignSelf: 'stretch',
  },
  fpOtpInput: {
    textAlign: 'center',
    fontSize: 24,
    letterSpacing: 8,
    fontWeight: '700',
  },
  fpPasswordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    marginBottom: 16,
    alignSelf: 'stretch',
  },
  fpPasswordInput: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#1e293b',
  },
  fpEyeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  fpEyeText: {
    fontSize: 20,
  },
  fpButton: {
    backgroundColor: '#2c50cd',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 12,
    alignSelf: 'stretch',
    elevation: 2,
    shadowColor: '#2c50cd',
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  fpButtonDisabled: {
    opacity: 0.6,
  },
  fpButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  fpResendBtn: {
    paddingVertical: 8,
    marginBottom: 8,
  },
  fpResendText: {
    color: '#2c50cd',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  fpResendTextDisabled: {
    color: '#94a3b8',
  },
  fpFooter: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  fpFooterText: {
    fontSize: 14,
    color: '#64748b',
  },
  fpFooterLink: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2c50cd',
  },
});

export default Login;
