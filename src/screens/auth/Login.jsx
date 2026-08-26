import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Keyboard,
  Platform,
  Modal,
  Dimensions,
  useWindowDimensions,
  Image,
} from 'react-native';
import TextInput from '../../components/TranslatedTextInput';
import Text from '../../components/TranslatedText';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL } from '../../axiosConfig';
import GoogleAuthButton from './components/GoogleAuthButton';
import Ionicons from 'react-native-vector-icons/Ionicons';
import socketService from '../../services/socketService';
import { paletteForRole } from '../../theme/palette';
import AuthBackground from '../../theme/AuthBackground';
import logo from '../../image/Humaeli.png';
import useLanguageRender from '../../hooks/useLanguageRender';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '../../components/common/ToastProvider';
import { STRONG_PASSWORD_HINT, validateStrongPassword } from '../../utils/passwordPolicy';
import PasswordRequirementChecklist from '../../components/common/PasswordRequirementChecklist';

// Vertical inset of the login scroll content.
const SCROLL_PAD_V = 24;

const Login = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { t } = useLanguageRender();
  const { showToast } = useToast();
  // Role decides the whole theme: patient → green, counselor → blue.
  // Layout/animation stay identical; only the palette swaps.
  const C = paletteForRole(route?.params?.role);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  // Space to reserve below the card. Measured, not assumed - see the effect.
  const [kbPad, setKbPad] = useState(0);
  const scrollRef = useRef(null);
  // Window height with the keyboard closed, to detect whether it shrinks.
  const baseHeightRef = useRef(Dimensions.get('window').height);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  // Conflict modal states - MATCHING WEB VERSION EXACTLY
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [conflictOtpResendTimer, setConflictOtpResendTimer] = useState(0);
  const [conflictOtpResending, setConflictOtpResending] = useState(false);
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

  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isTablet = windowWidth >= 600;
  const isCompact = windowWidth < 360 || windowHeight < 700;

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

  // Whether the Android window actually shrinks for the keyboard depends on
  // things we can't read from here reliably (targetSdk 36 forces edge-to-edge on
  // Android 15+, which disables the manifest's adjustResize, but older versions
  // still resize). Assuming either way is what left the card under the keyboard,
  // so measure instead: reserve only the part of the keyboard the window did NOT
  // already give up. That is correct in both cases and never double-counts.
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      const keyboardHeight = e?.endCoordinates?.height || 0;
      // Read live rather than from state - a closure would capture a stale value.
      const shrunkBy = Math.max(0, baseHeightRef.current - Dimensions.get('window').height);
      setKbPad(Math.max(0, keyboardHeight - shrunkBy));
      setKeyboardOpen(true);
      // After the relayout, so the scroll offset reflects the new padding.
      requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
    });

    const hideSub = Keyboard.addListener(hideEvent, () => {
      baseHeightRef.current = Dimensions.get('window').height;
      setKbPad(0);
      setKeyboardOpen(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
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

  useEffect(() => {
    if (!showConflictModal || !otpSent || conflictOtpResendTimer <= 0) return undefined;

    const timer = setInterval(() => {
      setConflictOtpResendTimer((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [showConflictModal, otpSent, conflictOtpResendTimer]);

  const formatOtpTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const getRoleLabel = (role) => {
    const normalized = normalizeRole(role);
    return normalized === 'counselor' ? 'Consultant' : 'User';
  };

  const buildRoleMismatchMessage = (actualRole, selectedRole) => {
    const actualLabel = getRoleLabel(actualRole);
    const selectedLabel = selectedRole ? getRoleLabel(selectedRole) : 'another';
    return `Role mismatch: this email is registered as ${actualLabel}, but you selected ${selectedLabel} login. Please go back and select ${actualLabel} login.`;
  };

  const showLoginError = (message, title = 'Login failed', duration = 8000) => {
    const safeMessage = String(message || 'Login failed').trim() || 'Login failed';
    setErrorMessage(safeMessage);
    showToast({
      type: 'error',
      title,
      message: safeMessage,
      duration,
    });
    if (duration > 0) {
      setTimeout(() => {
        setErrorMessage((current) => (current === safeMessage ? '' : current));
      }, duration);
    }
  };

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

    let selectedRole = '';
    try {
      const roleFromRoute = normalizeRole(route?.params?.role);
      const storedRoleRaw = normalizeRole(await AsyncStorage.getItem('role'));
      selectedRole = roleFromRoute || storedRoleRaw;
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
          const responseData = error?.response?.data || {};
          const message = String(responseData?.message || '').toLowerCase();
          const isRoleMismatch =
            responseData?.roleMismatch === true ||
            responseData?.code === 'ROLE_MISMATCH' ||
            error?.response?.status === 403 ||
            message.includes('role mismatch') ||
            message.includes('registered as a counsellor') ||
            message.includes('registered as a counselor') ||
            message.includes('registered as a user') ||
            message.includes('please use counsellor login') ||
            message.includes('please use counselor login') ||
            message.includes('please use user login');
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
          showLoginError(
            buildRoleMismatchMessage(normalizedUserRole, selectedRole),
            'Role mismatch'
          );
          setIsLoading(false);
          return;
        }

        if (!selectedAsCounselor && isCounselor) {
          showLoginError(
            buildRoleMismatchMessage(normalizedUserRole, selectedRole),
            'Role mismatch'
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
      // The PIN is device-local, so a new phone has none. Require setup before
      // entering the app, otherwise this first session would be unlocked.
      const existingPin = await AsyncStorage.getItem('appLockPin');
      setTimeout(() => {
        if (!existingPin) {
          navigation.replace('PinSetup', {
            forced: true,
            destination: 'LocationGate',
            destinationParams: { destination },
          });
        } else {
          navigation.replace('LocationGate', { destination });
        }
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
        setConflictOtpResendTimer(0);
        setConflictOtpResending(false);
        return;
      }

      const responseData = err?.response?.data || {};
      const responseMessage = String(responseData?.message || '').toLowerCase();
      const isRoleMismatch =
        responseData?.roleMismatch === true ||
        responseData?.code === 'ROLE_MISMATCH' ||
        responseMessage.includes('role mismatch') ||
        responseMessage.includes('registered as a counsellor') ||
        responseMessage.includes('registered as a counselor') ||
        responseMessage.includes('registered as a user');
      const msg = isRoleMismatch
        ? buildRoleMismatchMessage(responseData?.actualRole, selectedRole)
        : err?.response?.data?.message || err?.message || 'Login failed';

      showLoginError(msg, isRoleMismatch ? 'Role mismatch' : 'Login failed');
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
        setOtp('');
        setConflictOtpResendTimer(60);
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

  const handleResendConflictOtp = async () => {
    if (conflictOtpResending || conflictOtpResendTimer > 0) return;

    setConflictOtpResending(true);
    setErrorMessage('');
    setOtp('');

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/auth/logout-other-devices`,
        { email },
        { withCredentials: true }
      );

      if (response.data?.success) {
        setConflictOtpResendTimer(60);
        setSuccessMessage('OTP resent to your email.');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setErrorMessage(response.data?.message || 'Failed to resend OTP');
        setTimeout(() => setErrorMessage(''), 3000);
      }
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to resend OTP';
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(''), 3000);
    } finally {
      setConflictOtpResending(false);
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

      closeConflictModal();
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

  const closeConflictModal = () => {
    setShowConflictModal(false);
    setOtpSent(false);
    setOtp('');
    setConflictOtpResendTimer(0);
    setConflictOtpResending(false);
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

    const passwordCheck = validateStrongPassword(fpNewPassword);
    if (!passwordCheck.isValid) {
      setFpError(passwordCheck.message);
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

  // Centring the card looks right when the keyboard is closed, but once it opens
  // the card is taller than what's left of the viewport - and centring overflow
  // content keeps its bottom (Login / Continue with Google / Create account) out
  // of reach. Top-align while typing and lift the card so those stay visible.
  const scrollContainerStyle = {
    ...styles.scrollContainer,
    justifyContent: keyboardOpen ? 'flex-start' : 'center',
    // Pushes the card's bottom (Login / Continue with Google / Create account)
    // clear of the keyboard; scrollToEnd above then brings it into view.
    paddingBottom: SCROLL_PAD_V + kbPad,
    paddingHorizontal: isCompact ? 14 : 20,
  };
  const loginCardStyle = [
    styles.loginCard,
    {
      maxWidth: isTablet ? 480 : 440,
      padding: isCompact ? 20 : 28,
      borderRadius: isCompact ? 16 : 20,
    },
  ];
  const logoStyle = [
    styles.logoImage,
    {
      width: isCompact ? 160 : 200,
      height: isCompact ? 54 : 68,
      marginBottom: isCompact ? 14 : 20,
    },
  ];

  return (
    <AuthBackground role={route?.params?.role}>
    {/* Plain View, not KeyboardAvoidingView: the measured kbPad above is the one
        and only place keyboard space is reserved. Keeping KAV as well meant two
        mechanisms compensating for the same keyboard, which is what buried the
        card's buttons no matter which behavior was set. */}
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={scrollContainerStyle}
        // Without this the first tap while the keyboard is open only dismisses
        // it, so "Continue with Google" and Login needed two taps.
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={loginCardStyle}>
          {/* Header Section */}
          <View style={styles.headerSection}>
            <Image source={logo} style={logoStyle} resizeMode="contain" />
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
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color="#64748b"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Options */}
            <View style={styles.optionsContainer}>
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => setRememberMe(!rememberMe)}
              >
                <View style={[
                  styles.checkbox,
                  rememberMe && styles.checkboxChecked,
                  rememberMe && { backgroundColor: C.primary, borderColor: C.primary },
                ]}>
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
                <Text style={[styles.forgotPassword, { color: C.primary }]}>{t('auth:forgotPassword')}</Text>
              </TouchableOpacity>
            </View>

            {/* Login Button */}
            <TouchableOpacity
              style={[
                styles.loginButton,
                { backgroundColor: C.primary, shadowColor: C.primary },
                (!email || !password || isLoading) && styles.loginButtonDisabled,
              ]}
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
                setConflictOtpResendTimer(0);
                setConflictOtpResending(false);
                setErrorMessage('');
              }}
              onError={(msg) => {
                console.warn('[Login] Google onError:', msg);
                showLoginError(
                  msg,
                  String(msg || '').toLowerCase().includes('role')
                    ? 'Role mismatch'
                    : 'Google sign-in failed'
                );
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
                <Text style={[styles.signUpLink, { color: C.primary }]}> {t('auth:signup')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Conflict Resolution Modal - EXACT MATCH TO WEB VERSION */}
        <Modal
          visible={showConflictModal}
          transparent={true}
          animationType="slide"
          onRequestClose={closeConflictModal}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>{t('Session Conflict Detected')}</Text>
              <Text style={styles.modalText}>
                You are already logged in on another device.
              </Text>

              {/* Logout Other Devices Button */}
              <TouchableOpacity
                style={[
                  styles.modalButton,
                  { backgroundColor: C.primary, shadowColor: C.primary },
                  logoutLoading && styles.modalButtonDisabled,
                ]}
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
                  <Text style={styles.otpLabel}>{t('Enter OTP:')}</Text>
                  <TextInput
                    style={styles.otpInput}
                    value={otp}
                    onChangeText={(text) => {
                      const cleaned = text.replace(/\D/g, '').slice(0, 6);
                      setOtp(cleaned);
                      setErrorMessage(''); // Clear error when typing
                    }}
                    placeholder={t('6-digit code')}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                  <TouchableOpacity
                    style={[
                      styles.modalButton,
                      { backgroundColor: C.primary, shadowColor: C.primary },
                      otpLoading && styles.modalButtonDisabled,
                    ]}
                    onPress={handleVerifyOtp}
                    disabled={otpLoading}
                  >
                    {otpLoading ? (
                      <View style={styles.buttonLoadingContainer}>
                        <ActivityIndicator color="#fff" size="small" />
                        <Text style={styles.modalButtonText}> Verifying...</Text>
                      </View>
                    ) : (
                      <Text style={styles.modalButtonText}>{t('Verify OTP')}</Text>
                    )}
                  </TouchableOpacity>
                  <View style={styles.otpResendRow}>
                    {conflictOtpResendTimer > 0 ? (
                      <Text style={styles.otpTimerText}>
                        Resend OTP in {formatOtpTimer(conflictOtpResendTimer)}
                      </Text>
                    ) : (
                      <Text style={styles.otpTimerText}>Didn't receive code?</Text>
                    )}
                    <TouchableOpacity
                      onPress={handleResendConflictOtp}
                      disabled={conflictOtpResending || conflictOtpResendTimer > 0}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text
                        style={[
                          styles.otpResendText,
                          { color: C.primary },
                          (conflictOtpResending || conflictOtpResendTimer > 0) && styles.otpResendTextDisabled,
                        ]}
                      >
                        {conflictOtpResending ? 'Sending...' : 'Resend OTP'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              <TouchableOpacity onPress={closeConflictModal} style={styles.modalCancelButton}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
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
              <View style={[styles.fpModalContent, { paddingBottom: Math.max(insets.bottom, 36) }]}>
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
                    <View style={[styles.fpIconWrap, { backgroundColor: C.secondaryTint }]}>
                      <Text style={styles.fpIcon}>✉️</Text>
                    </View>
                    <Text style={styles.fpTitle}>{t('Forgot Password')}</Text>
                    <Text style={styles.fpSubtitle}>
                      Enter your registered email to receive a password reset OTP
                    </Text>

                    {fpError ? <Text style={styles.fpError}>⚠️ {fpError}</Text> : null}

                    <Text style={styles.fpLabel}>{t('Email Address *')}</Text>
                    <TextInput
                      style={styles.fpInput}
                      placeholder={t('Enter your registered email')}
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
                      style={[styles.fpButton, { backgroundColor: C.primary, shadowColor: C.primary }, fpLoading && styles.fpButtonDisabled]}
                      onPress={handleForgotPasswordSendOTP}
                      disabled={fpLoading}
                    >
                      <Text style={styles.fpButtonText}>
                        {fpLoading ? t('Sending OTP...') : t('Send Reset OTP')}
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.fpFooter}>
                      <Text style={styles.fpFooterText}>{t('Remember your password?')}</Text>
                      <TouchableOpacity onPress={closeForgotPasswordModal}>
                        <Text style={[styles.fpFooterLink, { color: C.primary }]}>{t('Back to Login')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* ===== STEP 2: OTP VERIFICATION ===== */}
                {fpStep === 'otp' && (
                  <View style={styles.fpStep}>
                    <View style={[styles.fpIconWrap, { backgroundColor: C.secondaryTint }]}>
                      <Text style={styles.fpIcon}>✉️</Text>
                    </View>
                    <Text style={styles.fpTitle}>{t('Verify OTP')}</Text>
                    <Text style={styles.fpSubtitle}>{t('Enter the 6-digit code sent to')}</Text>
                    <Text style={[styles.fpEmailDisplay, { color: C.primary }]}>{fpEmail}</Text>

                    {fpError ? <Text style={styles.fpError}>⚠️ {fpError}</Text> : null}
                    {fpSuccess ? <Text style={styles.fpSuccess}>✓ {fpSuccess}</Text> : null}

                    <Text style={styles.fpLabel}>{t('OTP Code *')}</Text>
                    <TextInput
                      style={[styles.fpInput, styles.fpOtpInput]}
                      placeholder={t('000000')}
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
                      style={[styles.fpButton, { backgroundColor: C.primary, shadowColor: C.primary }, (fpLoading || !fpOtp) && styles.fpButtonDisabled]}
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
                          { color: C.primary },
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
                      <Text style={styles.fpFooterText}>{t('Wrong email?')}</Text>
                      <TouchableOpacity onPress={() => { setFpStep('email'); setFpError(''); }}>
                        <Text style={[styles.fpFooterLink, { color: C.primary }]}>{t('Go back')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* ===== STEP 3: RESET PASSWORD ===== */}
                {fpStep === 'reset' && (
                  <View style={styles.fpStep}>
                    <View style={[styles.fpIconWrap, { backgroundColor: C.secondaryTint }]}>
                      <Text style={styles.fpIcon}>🔒</Text>
                    </View>
                    <Text style={styles.fpTitle}>{t('Reset Password')}</Text>
                    <Text style={styles.fpSubtitle}>{t('Create a new password for your account')}</Text>
                    <Text style={[styles.fpEmailDisplay, { color: C.primary }]}>{fpEmail}</Text>

                    {fpError ? <Text style={styles.fpError}>⚠️ {fpError}</Text> : null}
                    {fpSuccess ? <Text style={styles.fpSuccess}>✓ {fpSuccess}</Text> : null}

                    {/* New Password */}
                    <Text style={styles.fpLabel}>{t('New Password *')}</Text>
                    <View style={styles.fpPasswordWrapper}>
                      <TextInput
                        style={styles.fpPasswordInput}
                        placeholder={t('Enter new password')}
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
                        accessibilityRole="button"
                        accessibilityLabel={fpShowPassword ? 'Hide password' : 'Show password'}
	                      >
	                        <Ionicons
	                          name={fpShowPassword ? 'eye-off-outline' : 'eye-outline'}
	                          size={22}
	                          color="#64748b"
	                        />
	                      </TouchableOpacity>
	                    </View>
	                    <Text style={styles.fpPasswordHint}>{t(STRONG_PASSWORD_HINT)}</Text>
	                    <PasswordRequirementChecklist password={fpNewPassword} style={styles.fpPasswordChecklist} />

	                    {/* Confirm Password */}
                    <Text style={styles.fpLabel}>{t('Confirm Password *')}</Text>
                    <View style={styles.fpPasswordWrapper}>
                      <TextInput
                        style={styles.fpPasswordInput}
                        placeholder={t('Confirm new password')}
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
                        accessibilityRole="button"
                        accessibilityLabel={fpShowConfirmPassword ? 'Hide password' : 'Show password'}
                      >
                        <Ionicons
                          name={fpShowConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                          size={22}
                          color="#64748b"
                        />
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      style={[styles.fpButton, { backgroundColor: C.primary, shadowColor: C.primary }, (fpLoading || fpSuccess) && styles.fpButtonDisabled]}
                      onPress={handleForgotPasswordReset}
                      disabled={fpLoading || fpSuccess}
                    >
                      <Text style={styles.fpButtonText}>
                        {fpLoading ? t('Resetting Password...') : t('Reset Password')}
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.fpFooter}>
                      <Text style={styles.fpFooterText}>{t('Remember your password?')}</Text>
                      <TouchableOpacity onPress={closeForgotPasswordModal}>
                        <Text style={[styles.fpFooterLink, { color: C.primary }]}>{t('Back to Login')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        </Modal>
      </ScrollView>
    </View>
    </AuthBackground>
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
    // Keeps the card off the keyboard edge once the viewport shrinks, and gives
    // it room to scroll instead of sitting flush against the top/bottom.
    paddingVertical: SCROLL_PAD_V,
  },
  loginCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 25,
    width: '100%',
    alignSelf: 'center',
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
  logoImage: {
    // Logo is a 2.92:1 wordmark with transparent padding stripped, so the box
    // has to match that ratio - a square box would re-add the dead space.
    width: 200,
    height: 68,
    marginBottom: 20,
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
    minHeight: 56,
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
    minHeight: 56,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
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
    justifyContent: 'center',
    marginBottom: 10,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
  modalButtonDisabled: {
    backgroundColor: '#94A3B8',
    shadowOpacity: 0,
    elevation: 0,
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
  otpResendRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  otpTimerText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  otpResendText: {
    fontSize: 13,
    fontWeight: '900',
  },
  otpResendTextDisabled: {
    color: '#94A3B8',
  },
  modalCancelButton: {
    width: '100%',
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  modalCancelText: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '700',
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
    marginBottom: 6,
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  fpPasswordHint: {
    alignSelf: 'stretch',
    color: '#64748b',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 4,
  },
  fpPasswordChecklist: {
    alignSelf: 'stretch',
    marginBottom: 10,
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
    marginLeft: 4,
  },
});

export default Login;
