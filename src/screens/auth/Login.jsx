import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Platform,
  Modal,
  KeyboardAvoidingView,
  useWindowDimensions,
  Image,
  Animated,
  findNodeHandle,
  BackHandler,
} from 'react-native';
import TextInput from '../../components/TranslatedTextInput';
import Text from '../../components/TranslatedText';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useFocusEffect } from '@react-navigation/native';
import { API_BASE_URL } from '../../axiosConfig';
import GoogleAuthButton from './components/GoogleAuthButton';
import GoogleProfileCompletionModal, {
  needsGoogleUserProfileCompletion,
} from './components/GoogleProfileCompletionModal';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import socketService from '../../services/socketService';
import { BRAND, BRAND_GRADIENT } from '../../theme/palette';
import AuthBackground from '../../theme/AuthBackground';
import logo from '../../image/HumaeliIcon.png';
import useLanguageRender from '../../hooks/useLanguageRender';
import useKeyboardAwareScroll from '../../hooks/useKeyboardAwareScroll';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '../../components/common/ToastProvider';
import { STRONG_PASSWORD_HINT, validateStrongPassword } from '../../utils/passwordPolicy';
import PasswordRequirementChecklist from '../../components/common/PasswordRequirementChecklist';
import { syncPushNotificationToken } from '../../services/notificationService';
import { sendLocationSilently } from '../../utils/locationHelper';
import { enterAuthenticatedRoute } from '../../utils/authSession';

// Vertical inset of the login scroll content.
const SCROLL_PAD_V = 24;

const Login = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { t } = useLanguageRender();
  const { showToast } = useToast();
  // Login is the single common entry point for every role now, so it always
  // uses the real Humaeli brand colour (sampled from the app icon/logo)
  // rather than any one role's palette — a role param, if one is ever
  // passed, no longer changes how this screen looks.
  const C = BRAND;
  const buttonGradient = BRAND_GRADIENT;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // Same keyboard-avoidance the role Signup screens already use: scrolls
  // only the focused input into view (plus a small gap) instead of
  // reserving the keyboard's full height and revealing everything below —
  // which is what previously dragged the whole card (and its logo) up past
  // the fixed back button. The header and every section below it can now
  // stay full-size and visible at all times.
  const {
    scrollRef,
    keyboardInset,
    scrollFocusedInputIntoView,
    handleKeyboardAwareScroll,
    handleKeyboardAwareScrollLayout,
  } = useKeyboardAwareScroll();
  const fpModalScrollRef = useRef(null);
  // Password is the last field before the Login button — bringing only the
  // password field into view left the button itself sitting under the
  // keyboard. Focusing password scrolls to this ref instead (see its
  // onFocus below), which brings both into view together since the button
  // sits immediately below the field.
  const loginButtonRef = useRef(null);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  // Presentation only — which input is focused, so its border can pick up
  // the role color like every other auth screen already does.
  const [focusedField, setFocusedField] = useState(null);
  const [googleProfileCompletion, setGoogleProfileCompletion] = useState({
    visible: false,
    isCounselor: false,
    user: null,
  });
  
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

  // Entrance polish only — same fade/slide/logo-scale pattern used on
  // RoleSelector and the role Signup screens, so Login matches their feel.
  // Colors are untouched; this is purely presentational.
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(22)).current;
  const logoScale = useRef(new Animated.Value(0.9)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 420, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
      Animated.spring(logoScale, { toValue: 1, tension: 60, friction: 9, useNativeDriver: true }),
    ]).start();
  }, []);

  const normalizeRole = (role) => {
    const value = String(role || '').trim().toLowerCase();
    if (!value) return '';
    return value === 'counsellor' ? 'counselor' : value;
  };

  const mapRoleForBackend = (role) => {
    return role === 'counselor' ? 'counsellor' : role;
  };

  const buildBackendRoleCandidates = (role) => {
    // Always try BOTH candidates, regardless of any role hint (route param or
    // a leftover AsyncStorage 'role' from a visit to RoleSelector that never
    // finished signup) — a hint only decides which one is tried first. This
    // is what makes login "auto-detect the account's real role by email":
    // whichever candidate the backend accepts wins, and a stale/irrelevant
    // hint can never make a real account fail to log in.
    return role === 'counselor' ? ['counsellor', 'user'] : ['user', 'counsellor'];
  };

  useEffect(() => {
    loadRememberedUser();
  }, []);

  const scrollForgotPasswordModalToEnd = () => {
    requestAnimationFrame(() => {
      fpModalScrollRef.current?.scrollToEnd({ animated: true });
    });
  };

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

  const continueAfterAuth = async (isCounselor, delay = 800) => {
    const destination = isCounselor ? 'CounselorDashboard' : 'UserDashboard';

    // App Lock PIN is opt-in only — set up voluntarily from Settings
    // (AppLockSettings already does `navigate('PinSetup', { forced: false })`).
    // Login must never force it on someone who hasn't asked for it.
    setTimeout(() => {
      enterAuthenticatedRoute(navigation, 'LocationGate', { destination });
    }, delay);
  };

  // Login can be the only screen in the stack (reached via replace/reset);
  // then back should go to Landing, not exit the app.
  const goBackOrLanding = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.replace('Landing');
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (navigation.canGoBack()) return false;
        navigation.replace('Landing');
        return true;
      });
      return () => sub.remove();
    }, [navigation]),
  );

  const handleGoogleSuccess = ({ isCounselor, user }) => {
    // Google here is sent with role 'auto': the backend resolves the
    // account's real role from the DB and never creates a new account
    // (an unregistered Google account comes back via onNotRegistered).
    // Capture location here rather than in GoogleAuthButton (gateDriven).
    sendLocationSilently('login').catch(() => {});

    showToast({ type: 'success', title: t('auth:login'), message: t('common:success') });

    if (needsGoogleUserProfileCompletion(user, isCounselor)) {
      setGoogleProfileCompletion({
        visible: true,
        isCounselor,
        user,
      });
      return;
    }

    continueAfterAuth(isCounselor).catch((error) => {
      showLoginError(error?.message || 'Login failed');
    });
  };

  const handleGoogleProfileComplete = (updatedUser) => {
    const isCounselor = googleProfileCompletion.isCounselor;
    setGoogleProfileCompletion({
      visible: false,
      isCounselor: false,
      user: null,
    });
    if (updatedUser?.email) {
      AsyncStorage.setItem('userEmail', updatedUser.email).catch(() => {});
    }
    continueAfterAuth(isCounselor, 350).catch((error) => {
      showLoginError(error?.message || 'Login failed');
    });
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

      // Trust whichever role the backend actually confirmed for this email —
      // that's what "one login, auto-routed by account" means. There's no
      // client-side check against `selectedRole` here on purpose: a leftover
      // role hint (route param or stale AsyncStorage 'role') must never block
      // or misreport a real login.
      const userRoleRaw =
        response.data?.role || response.data?.user?.role || 'user';
      const normalizedUserRole = normalizeRole(userRoleRaw) || 'user';
      const isCounselor = normalizedUserRole === 'counselor';

      const token = response.data?.accessToken || response.data?.token;
      if (token) {
        await AsyncStorage.setItem('accessToken', token);
        await AsyncStorage.setItem('token', token);
      }
      if (response.data?.refreshToken) {
        await AsyncStorage.setItem('refreshToken', response.data.refreshToken);
      }

      await AsyncStorage.setItem('userRole', normalizedUserRole);
      await AsyncStorage.setItem('userType', isCounselor ? 'counselor' : 'user');
      await AsyncStorage.setItem('isAuthenticated', 'true');
      await AsyncStorage.setItem('userEmail', email);
      if (!isCounselor) {
        await AsyncStorage.multiRemove(['counsellorId', 'counselorId']);
      }

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

      showToast({ type: 'success', title: t('auth:login'), message: t('common:success') });

      socketService.connect().catch(() => {});
      syncPushNotificationToken().catch(error => {
        console.warn('[Push] Token sync after login failed:', error?.message || error);
      });

      // The PIN is device-local, so a new phone has none. Require setup before
      // entering the app, otherwise this first session would be unlocked.
      await continueAfterAuth(isCounselor);
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
      const otpIsCounselor = resolvedRole === 'counselor';
      await AsyncStorage.setItem('userRole', resolvedRole);
      await AsyncStorage.setItem('userType', otpIsCounselor ? 'counselor' : 'user');
      await AsyncStorage.setItem('isAuthenticated', 'true');
      await AsyncStorage.setItem('userEmail', email);
      if (!otpIsCounselor) {
        await AsyncStorage.multiRemove(['counsellorId', 'counselorId']);
      }

      const user = response.data?.user || response.data;
      if (user) {
        await AsyncStorage.setItem('userData', JSON.stringify(user));
        const id = user._id || user.id;
        if (id) {
          await AsyncStorage.setItem('userId', id);
          if (otpIsCounselor) {
            await AsyncStorage.setItem('counsellorId', id);
            await AsyncStorage.setItem('counselorId', id);
          }
        }
      }

      await AsyncStorage.removeItem('role');

      closeConflictModal();
      setSuccessMessage('OTP verified! Redirecting...');

      socketService.connect().catch(() => {});
      syncPushNotificationToken().catch(error => {
        console.warn('[Push] Token sync after OTP login failed:', error?.message || error);
      });

      const destination = resolvedRole === 'counselor' ? 'CounselorDashboard' : 'UserDashboard';
      setTimeout(() => {
        enterAuthenticatedRoute(navigation, 'LocationGate', { destination });
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

  // Top-anchored rather than dead-centered (centering left equally large,
  // unfinished-looking dead zones above the logo and below the card on a
  // tall phone) but pulled down a bit further than a bare "clear the back
  // button" offset would, so the card reads as sitting comfortably in the
  // upper-middle of the screen rather than pinned to the top.
  //
  // This no longer shrinks while the keyboard is open. The header used to
  // hide then so the whole (shorter) card could be scrolled into view above
  // the keyboard — but useKeyboardAwareScroll only ever scrolls the
  // currently focused input into view, never the whole card, so the back
  // button's clearance here is never touched regardless of keyboard state.
  const scrollContainerStyle = {
    ...styles.scrollContainer,
    justifyContent: 'flex-start',
    paddingTop: Math.max(insets.top, 12) + (isCompact ? 88 : 108),
    // Pushes the card's bottom (Login / Continue with Google / Create account)
    // clear of the keyboard on devices where the window doesn't resize for it.
    paddingBottom: SCROLL_PAD_V + keyboardInset,
    paddingHorizontal: isCompact ? 14 : 20,
  };
  // No boxed card anymore — everything floats directly on the AuthBackground
  // mesh, matching the reference design. Wider than before (was 400/440) for
  // a more confident, professional presence — still capped so it doesn't
  // stretch absurdly wide on a tablet.
  const loginCardStyle = [
    styles.loginCard,
    {
      maxWidth: isTablet ? 480 : 430,
      paddingHorizontal: isCompact ? 2 : 4,
    },
  ];
  // Icon-only mark (square), not the full wordmark — matches the layout the
  // per-role signup screens already use for their inline login view.
  const logoStyle = [
    styles.logoImage,
    {
      width: isCompact ? 62 : 72,
      height: isCompact ? 62 : 72,
      marginBottom: isCompact ? 8 : 10,
    },
  ];

  // Teal/aqua mesh throughout — the closest existing AuthBackground mode to
  // the real logo gradient, and used unconditionally now that Login is one
  // common brand-colored screen rather than something styled per role.
  return (
    <AuthBackground role="doctor">
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <TouchableOpacity
        style={[styles.backBtn, { top: Math.max(insets.top, 12) + 6 }]}
        onPress={goBackOrLanding}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="chevron-back" size={24} color="#0F172A" />
      </TouchableOpacity>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={scrollContainerStyle}
        onLayout={handleKeyboardAwareScrollLayout}
        onScroll={handleKeyboardAwareScroll}
        scrollEventThrottle={16}
        // Without this the first tap while the keyboard is open only dismisses
        // it, so "Continue with Google" and Login needed two taps.
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={[loginCardStyle, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          {/* Form Section — floating white card holding the brand header and
              the whole form, so the inputs stay crisp and readable against
              the colored mesh background. */}
          <View style={styles.formCard}>
            {/* Header — logo, brand name and tagline, always full-size and
                visible. Keyboard avoidance below only ever scrolls the
                focused input into view, so this never needs to shrink or
                hide to make room, and the back button is never at risk of
                being scrolled past. */}
            <View style={styles.headerSection}>
              <Animated.View style={{ transform: [{ scale: logoScale }] }}>
                <Image source={logo} style={logoStyle} resizeMode="contain" />
              </Animated.View>
              <Text style={[styles.brandName, { color: C.primary }]}>{t('Humaeli')}</Text>
              <Text style={styles.subtitle}>{t('Sign in to continue')}</Text>
            </View>
            {/* Email Input */}
            <View style={[styles.inputWrapper, focusedField === 'email' && { borderColor: C.primary, shadowColor: C.primary, shadowOpacity: 0.16 }]}>
              <Ionicons
                name="mail-outline"
                size={19}
                color={focusedField === 'email' ? C.primary : '#94a3b8'}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                placeholder={t('auth:enterEmail')}
                placeholderTextColor="#a1a9b8"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setErrorMessage('');
                }}
                onFocus={(event) => {
                  setFocusedField('email');
                  scrollFocusedInputIntoView(event);
                }}
                onBlur={() => setFocusedField(null)}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                editable={!isLoading}
              />
            </View>

            {/* Password Input */}
            <View style={[styles.inputWrapper, styles.inputWrapperSpaced, focusedField === 'password' && { borderColor: C.primary, shadowColor: C.primary, shadowOpacity: 0.16 }]}>
              <Ionicons
                name="lock-closed-outline"
                size={19}
                color={focusedField === 'password' ? C.primary : '#94a3b8'}
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder={t('auth:enterPassword')}
                placeholderTextColor="#a1a9b8"
                value={password}
                onChangeText={(text) => {
                  setPassword(text);
                  setErrorMessage('');
                }}
                onFocus={() => {
                  setFocusedField('password');
                  // Target the Login button, not this field itself — see
                  // the loginButtonRef comment above.
                  const handle = findNodeHandle(loginButtonRef.current);
                  if (handle) scrollFocusedInputIntoView({ target: handle });
                }}
                onBlur={() => setFocusedField(null)}
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
                  size={20}
                  color="#94a3b8"
                />
              </TouchableOpacity>
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
                <Text style={styles.checkboxLabel}>{t('Remember me')}</Text>
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

            {/* Login Button — brand gradient, matching the Humaeli icon's blue. */}
            <TouchableOpacity
              ref={loginButtonRef}
              style={[
                styles.loginButtonWrap,
                { shadowColor: C.primary },
                (!email || !password || isLoading) && styles.loginButtonDisabled,
              ]}
              onPress={handleLogin}
              disabled={!email || !password || isLoading}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={(!email || !password || isLoading) ? ['#cbd1dc', '#b7bfcc'] : buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.loginButton}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.loginButtonText}>{t('auth:login')}</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            {/* Divider + Google sign-in — always visible. */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
            </View>
            <GoogleAuthButton
              role="auto"
              mode="signin"
              disabled={isLoading}
              locationEvent="login"
              gateDriven
              onSuccess={handleGoogleSuccess}
              onNotRegistered={({ message }) => {
                showToast({
                  type: 'info',
                  title: t('Account not found'),
                  message: t(message),
                });
                navigation.navigate('RoleSelector');
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
              <View style={styles.errorContainer}>
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
        </Animated.View>

        {/* Conflict Resolution Modal - EXACT MATCH TO WEB VERSION */}
        <Modal
          visible={showConflictModal}
          transparent={true}
          animationType="slide"
          onRequestClose={closeConflictModal}
        >
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.cfCard}>
              <View style={[styles.cfIconWrap, { backgroundColor: C.backgroundTint }]}>
                <Ionicons
                  name={otpSent ? 'mail-open-outline' : 'phone-portrait-outline'}
                  size={28}
                  color={C.primary}
                />
              </View>

              <Text style={styles.cfTitle}>
                {otpSent ? t('Verify it is you') : t('Session Conflict Detected')}
              </Text>
              <Text style={styles.cfText}>
                {otpSent
                  ? 'We sent a 6-digit code to your registered email. Enter it below to sign out your other devices and continue.'
                  : 'You are already logged in on another device. Sign it out to continue on this one.'}
              </Text>

              {/* Step 1: send OTP */}
              {!otpSent && (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={handleLogoutOtherDevices}
                  disabled={logoutLoading}
                  style={styles.cfBtnWrap}
                >
                  <LinearGradient
                    colors={logoutLoading ? ['#94A3B8', '#94A3B8'] : BRAND_GRADIENT}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={styles.cfBtn}
                  >
                    {logoutLoading ? (
                      <>
                        <ActivityIndicator color="#fff" size="small" />
                        <Text style={styles.cfBtnText}>Sending OTP...</Text>
                      </>
                    ) : (
                      <>
                        <Ionicons name="log-out-outline" size={19} color="#fff" />
                        <Text style={styles.cfBtnText}>Logout other devices & send OTP</Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              )}

              {/* Step 2: enter OTP (6 boxes over one hidden input) */}
              {otpSent && (
                <View style={styles.cfOtpSection}>
                  <View style={styles.cfOtpRow}>
                    {[0, 1, 2, 3, 4, 5].map((i) => {
                      const digit = otp[i] || '';
                      const isActive = i === Math.min(otp.length, 5);
                      return (
                        <View
                          key={i}
                          style={[
                            styles.cfOtpBox,
                            digit ? { borderColor: C.primary, backgroundColor: C.backgroundTint } : null,
                            isActive && { borderColor: C.primary, borderWidth: 2 },
                            !!errorMessage && styles.cfOtpBoxError,
                          ]}
                        >
                          <Text style={styles.cfOtpDigit}>{digit}</Text>
                        </View>
                      );
                    })}
                    <TextInput
                      style={styles.cfHiddenInput}
                      value={otp}
                      onChangeText={(text) => {
                        const cleaned = text.replace(/\D/g, '').slice(0, 6);
                        setOtp(cleaned);
                        setErrorMessage('');
                      }}
                      keyboardType="number-pad"
                      maxLength={6}
                      autoFocus
                      caretHidden
                      textContentType="oneTimeCode"
                      autoComplete="sms-otp"
                      accessibilityLabel="Enter the 6-digit OTP"
                    />
                  </View>

                  {!!errorMessage && (
                    <View style={styles.cfErrorRow}>
                      <Ionicons name="alert-circle" size={15} color="#DC2626" />
                      <Text style={styles.cfErrorText}>{errorMessage}</Text>
                    </View>
                  )}

                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={handleVerifyOtp}
                    disabled={otpLoading || otp.length < 6}
                    style={styles.cfBtnWrap}
                  >
                    <LinearGradient
                      colors={otpLoading || otp.length < 6 ? ['#94A3B8', '#94A3B8'] : BRAND_GRADIENT}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={styles.cfBtn}
                    >
                      {otpLoading ? (
                        <>
                          <ActivityIndicator color="#fff" size="small" />
                          <Text style={styles.cfBtnText}>Verifying...</Text>
                        </>
                      ) : (
                        <Text style={styles.cfBtnText}>{t('Verify OTP')}</Text>
                      )}
                    </LinearGradient>
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
          </KeyboardAvoidingView>
        </Modal>

        <GoogleProfileCompletionModal
          visible={googleProfileCompletion.visible}
          user={googleProfileCompletion.user}
          accentColor={C.primary}
          onComplete={handleGoogleProfileComplete}
        />

        {/* ========== FORGOT PASSWORD MODAL ========== */}
        <Modal
          visible={showForgotPasswordModal}
          transparent={true}
          animationType="slide"
          onRequestClose={closeForgotPasswordModal}
        >
          <View style={styles.fpModalOverlay}>
            <ScrollView
              ref={fpModalScrollRef}
              contentContainerStyle={[
                styles.fpModalScroll,
                keyboardInset > 0 && { paddingBottom: keyboardInset },
              ]}
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
                      onFocus={scrollForgotPasswordModalToEnd}
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
                      onFocus={scrollForgotPasswordModalToEnd}
                    />

                    <TouchableOpacity
                      style={[styles.fpButton, { backgroundColor: C.primary, shadowColor: C.primary }, (fpLoading || !fpOtp) && styles.fpButtonDisabled]}
                      onPress={handleForgotPasswordVerifyOTP}
                      disabled={!!(fpLoading || fpSuccess || !fpOtp)}
                    >
                      <Text style={styles.fpButtonText}>
                        {fpLoading ? 'Verifying...' : 'Verify OTP'}
                      </Text>
                    </TouchableOpacity>

                    {/* Resend OTP with 60s timer (matches web) */}
                    <TouchableOpacity
                      style={styles.fpResendBtn}
                      onPress={handleForgotPasswordResendOTP}
                      disabled={!!(fpResending || fpResendTimer > 0 || fpSuccess)}
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
                        onFocus={scrollForgotPasswordModalToEnd}
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
                        onFocus={scrollForgotPasswordModalToEnd}
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
                      disabled={!!(fpLoading || fpSuccess)}
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
  // No background/border/shadow of its own anymore — the pills and button
  // each carry their own shadow, so the group floats on the mesh instead of
  // sitting inside a boxed card.
  loginCard: {
    width: '100%',
    alignSelf: 'center',
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  // Square icon-only mark — dimensions set responsively in logoStyle above.
  logoImage: {},
  backBtn: {
    position: 'absolute',
    left: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 100,
  },
  brandName: {
    fontSize: 26,
    fontWeight: '800',
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#5b6472',
    textAlign: 'center',
    lineHeight: 19,
  },
  // Floating white card that holds the whole form — gives the screen a
  // professional, grounded focal point against the colored mesh backdrop.
  // A crisp hairline border plus a stronger, tighter shadow keeps its edge
  // well-defined against the light blue mesh (a soft shadow alone all but
  // disappeared against that background).
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(15, 23, 42, 0.06)',
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 18,
    shadowColor: '#0b1e4d',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.16,
    shadowRadius: 22,
    elevation: 8,
  },
  // Soft pill inputs living inside the card — subtle border by default,
  // brand-colored glow on focus for a premium feel.
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    borderWidth: 1.5,
    borderColor: '#e7eaf1',
    borderRadius: 18,
    backgroundColor: '#f8fafc',
    paddingLeft: 16,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0,
    shadowRadius: 8,
    elevation: 0,
  },
  inputWrapperSpaced: {
    marginTop: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingRight: 16,
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  passwordInput: {
    paddingRight: 44,
  },
  eyeIcon: {
    padding: 10,
    position: 'absolute',
    right: 8,
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    // Breathing room from the password pill above — without this the row sat
    // flush against it, making "Remember me" look glued to the field.
    marginTop: 16,
    marginBottom: 18,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    // Neutral by default (only the role color, via C.primary, when checked) —
    // avoids a hardcoded blue clashing with a green/user-themed login.
    borderColor: '#cbd5e1',
    borderRadius: 5,
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
    color: '#64748b',
  },
  forgotPassword: {
    fontSize: 14,
    fontWeight: '700',
    color: '#007AFF',
  },
  // Outer wrapper carries the colored glow shadow (color set inline via
  // C.primary); the gradient fill lives on the inner LinearGradient below so
  // the rounded corners clip the gradient cleanly on both platforms.
  loginButtonWrap: {
    borderRadius: 18,
    marginTop: 4,
    marginBottom: 14,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.32,
    shadowRadius: 16,
    elevation: 6,
  },
  loginButton: {
    minHeight: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 16.5,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 14,
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
    padding: 14,
    borderRadius: 12,
    marginTop: 18,
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
    padding: 14,
    borderRadius: 12,
    marginTop: 18,
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
    marginTop: 14,
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
  cfCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 14,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 12,
  },
  cfIconWrap: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  cfTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  cfText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
  },
  cfBtnWrap: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
  },
  cfBtn: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cfBtnText: {
    color: '#FFFFFF',
    fontSize: 15.5,
    fontWeight: '700',
    textAlign: 'center',
    flexShrink: 1,
  },
  cfOtpSection: {
    width: '100%',
  },
  cfOtpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 14,
  },
  cfOtpBox: {
    flex: 1,
    height: 54,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#DDE3EA',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cfOtpBoxError: {
    borderColor: '#EF4444',
    backgroundColor: '#FEF2F2',
  },
  cfOtpDigit: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  cfHiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.01,
    color: 'transparent',
  },
  cfErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 12,
  },
  cfErrorText: {
    flexShrink: 1,
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
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
