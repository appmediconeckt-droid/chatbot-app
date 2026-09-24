// DoctorSignup — Login / Create Account for the new Doctor role.
//
// Real auth, mirroring CounselorSignup.jsx: login hits POST /api/auth/login
// and signup hits POST /api/auth/complete-registration. There is still no
// distinct "doctor" role on the backend (User.role is only
// user/counsellor/admin), so a Doctor account is a real `counsellor`-role
// account whose specialization must contain "Psychiatrist" — see the AUTH
// section below for the full reasoning. Google sign-in uses the shared native
// Google flow and the backend's counsellor role.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, TouchableOpacity, ScrollView, Platform, ActivityIndicator, Image, StatusBar, SafeAreaView, useWindowDimensions, Animated, findNodeHandle, Modal } from 'react-native';
// SafeAreaView is deliberately the plain react-native one here (a no-op on
// Android — it only does anything on iOS), matching what CounselorSignup.jsx
// and UserSignup.jsx already use. This screen was the only one of the three
// importing react-native-safe-area-context's SafeAreaView instead, which
// DOES apply real Android inset padding on top of — not instead of — this
// screen's own hand-tuned paddingTop/backBtn offsets (which were already
// sized assuming no automatic inset, same as the other two screens). That
// stacked padding was the one concrete difference between this screen and
// its two siblings, and lines up with this being the only one where the
// panel could scroll past the back button.
import TextInput from '../../components/TranslatedTextInput';
import Text from '../../components/TranslatedText';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import AuthBackground from '../../theme/AuthBackground';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import DateTimePicker from '@react-native-community/datetimepicker';
import CountryPhoneInput from '../../components/common/CountryPhoneInput';
import PasswordRequirementChecklist from '../../components/common/PasswordRequirementChecklist';
import {
  getPhoneLengthLabel,
  isValidLocalPhoneNumber,
  normalizeLocalPhoneNumber,
} from '../../utils/countryCodes';
import {
  calculateAgeFromDateOfBirth,
  formatDateOfBirthDisplay,
  getDatePickerValue,
  toDateOnlyString,
} from '../../utils/dateOfBirth';
import logo from '../../image/HumaeliIcon.png';
import useLanguageRender from '../../hooks/useLanguageRender';
import useKeyboardAwareScroll from '../../hooks/useKeyboardAwareScroll';
import { CLINICIAN } from '../../theme/palette';
import { STRONG_PASSWORD_HINT, validateStrongPassword } from '../../utils/passwordPolicy';
import GoogleAuthButton from './components/GoogleAuthButton';
import { createDoctorStyles } from '../../features/doctor/dashboard/theme';
import axiosInstance from '../../axiosConfig';
import socketService from '../../services/socketService';
import {
  getApiErrorMessage,
  isOtpRequestSuccessful,
  isOtpVerificationSuccessful,
  postPublicAuthEndpoint,
  postPublicAuthEndpointWithOtpRetry,
} from './authUtils';

import { enterAuthenticatedRoute } from '../../utils/authSession';
const genderOptions = ['Male', 'Female', 'Other'];
const consultationModes = ['Online', 'Offline', 'Both'];
const languageOptions = ['Hindi', 'English', 'Gujarati', 'Marathi', 'Tamil', 'Telugu', 'Bengali', 'Punjabi'];
const OTP_RESEND_SECONDS = 60;

// ─────────────────────────── AUTH ───────────────────────────
// Doctor = Psychiatrist. The backend's User.role enum only has
// user/counsellor/admin — there is no separate "doctor" role — so a Doctor
// account is a real `counsellor`-role account whose specialization contains
// "Psychiatrist" (see isPsychiatristSpecialization in PsychiatristDirectory,
// also used for the Doctor/Consultant badge and the Health Vitals gate).
// `userRole` is stored as 'doctor' LOCALLY ONLY, purely so this app's own
// routeForRole() sends the session to DoctorDashboard instead of
// CounselorDashboard on login/reload — the backend never sees that value.
//
const persistDoctorSession = async (data, email) => {
  const token = data?.token || data?.accessToken || data?.data?.token;
  if (!token) return false;
  const user = data?.user || data?.data?.user || null;

  await AsyncStorage.setItem('token', token);
  await AsyncStorage.setItem('accessToken', token);
  if (data?.refreshToken || data?.data?.refreshToken) {
    await AsyncStorage.setItem('refreshToken', data?.refreshToken || data?.data?.refreshToken);
  }
  await AsyncStorage.setItem('isAuthenticated', 'true');
  // Real backend role stays 'counsellor' — only the local routing hint says 'doctor'.
  await AsyncStorage.setItem('userType', 'doctor');
  await AsyncStorage.setItem('userRole', 'doctor');
  if (email) await AsyncStorage.setItem('userEmail', email);

  if (user) {
    await AsyncStorage.setItem('userData', JSON.stringify(user));
    const id = user._id || user.id;
    if (id) {
      await AsyncStorage.setItem('counsellorId', String(id));
      await AsyncStorage.setItem('counselorId', String(id));
      await AsyncStorage.setItem('userId', String(id));
    }
    // Kept for the existing doctor screens (DoctorHeader, DoctorSidebar,
    // NewFollowUpScreen) that already read the doctor's display name from
    // this key — now populated with the real registered/logged-in name.
    await AsyncStorage.setItem('doctorMockProfile', JSON.stringify(user));
  }
  await AsyncStorage.setItem('doctorMockSession', 'true');
  socketService.connect().catch(() => {});
  return true;
};
// ───────────────────────────────────────────────────────────────────────────────

const DoctorSignup = ({ navigation, route }) => {
  const { t } = useLanguageRender();
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 600;
  const isCompact = width < 360 || height < 700;
  const [isLogin, setIsLogin] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const {
    scrollRef,
    keyboardInset,
    scrollFocusedInputIntoView,
    handleKeyboardAwareScroll,
    handleKeyboardAwareScrollLayout,
  } = useKeyboardAwareScroll();
  // In login mode, password is the last field before the submit button —
  // scrolling to the password field alone left the button under the
  // keyboard. Focusing password scrolls to this ref instead (see its
  // onFocus below), bringing both into view together.
  const loginSubmitBtnRef = useRef(null);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    fullName: '',
    phoneNumber: '',
    phoneCountryCode: '+91',
    dateOfBirth: '',
    age: '',
    gender: '',
    qualification: '',
    specialization: '',
    experience: '',
    location: '',
    consultationMode: [],
    languages: [],
    aboutMe: '',
  });

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const firstEntranceRef = useRef(true);
  const fieldAnims = useRef([...Array(18)].map(() => new Animated.Value(0))).current;

  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [showDateOfBirthPicker, setShowDateOfBirthPicker] = useState(false);

  // Email verification — the backend's complete-registration endpoint rejects
  // signup unless it receives a valid emailVerificationToken from
  // verify-email-otp first (see completeRegistration in authController.js).
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailVerificationToken, setEmailVerificationToken] = useState('');
  const [showOtpModal, setShowOtpModal] = useState({ show: false, value: '' });
  const [otpCode, setOtpCode] = useState('');
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const sendingVerificationRef = useRef(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const verifyingOtpRef = useRef(false);
  const [otpError, setOtpError] = useState('');
  const [otpResendTimer, setOtpResendTimer] = useState(0);
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  const resendingOtpRef = useRef(false);

  useEffect(() => {
    if (!showOtpModal.show || otpResendTimer <= 0) return undefined;
    const interval = setInterval(() => {
      setOtpResendTimer((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [showOtpModal.show, otpResendTimer]);

  const formatOtpTimer = (seconds) => `00:${String(seconds).padStart(2, '0')}`;

  useEffect(() => {
    const showImmediately = () => {
      fadeAnim.setValue(1);
      slideAnim.setValue(0);
      fieldAnims.forEach((anim) => anim.setValue(1));
    };
    if (!firstEntranceRef.current) {
      showImmediately();
      return;
    }
    firstEntranceRef.current = false;
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    fieldAnims.forEach((anim) => anim.setValue(0));
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 20, friction: 7, useNativeDriver: true }),
      Animated.stagger(35, fieldAnims.map((anim) => Animated.spring(anim, { toValue: 1, tension: 25, friction: 8, useNativeDriver: true }))),
    ]).start();
  }, [isLogin]);

  const showNotification = (message, type = 'success', duration) => {
    const displayDuration = duration ?? (type === 'error' ? 6000 : 2600);
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: '' }), displayDuration);
  };

  const handleChange = useCallback((name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name === 'email') {
      setEmailVerified(false);
      setEmailVerificationToken('');
    }
  }, []);

  const toggleListItem = useCallback((name, value) => {
    setFormData((prev) => {
      let list = [...prev[name]];
      if (list.includes(value)) list = list.filter((i) => i !== value);
      else list.push(value);
      return { ...prev, [name]: list };
    });
  }, []);

  const handleDateOfBirthChange = (_event, selectedDate) => {
    if (Platform.OS === 'android') setShowDateOfBirthPicker(false);
    if (!selectedDate) return;
    const dateOfBirth = toDateOnlyString(selectedDate);
    const calculatedAge = calculateAgeFromDateOfBirth(dateOfBirth);
    setFormData((prev) => ({ ...prev, dateOfBirth, age: calculatedAge !== null ? String(calculatedAge) : '' }));
    setErrors((prev) => ({ ...prev, dateOfBirth: undefined, age: undefined }));
  };

  const validateSignup = () => {
    const next = {};
    if (!formData.fullName) next.fullName = 'Full name is required';
    if (!formData.email) next.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) next.email = 'Email is invalid';
    else if (!emailVerified) next.email = 'Please verify your email first';

    if (!formData.phoneNumber) next.phoneNumber = 'Phone is required';
    else if (!isValidLocalPhoneNumber(formData.phoneNumber, formData.phoneCountryCode)) {
      next.phoneNumber = `Phone number must be ${getPhoneLengthLabel(formData.phoneCountryCode)} digits`;
    }

    const calculatedAge = calculateAgeFromDateOfBirth(formData.dateOfBirth);
    if (!formData.dateOfBirth || calculatedAge === null) next.dateOfBirth = 'Date of birth is required';
    else if (calculatedAge < 21 || calculatedAge > 100) next.dateOfBirth = 'Must be 21-100';

    if (!formData.gender) next.gender = 'Gender is required';
    if (!formData.qualification) next.qualification = 'Qualification required';
    if (!formData.specialization) next.specialization = 'Specialization required';
    // Doctor accounts are Psychiatrists on this backend (see AUTH comment
    // above) — the Doctor/Consultant badge and Health Vitals gate elsewhere
    // in the app only recognize "psychiatrist" in the specialization text.
    else if (!/psychiatr/i.test(formData.specialization)) {
      next.specialization = 'Must include "Psychiatrist" (e.g. Child & Adolescent Psychiatrist)';
    }
    if (!formData.experience) next.experience = 'Experience required';
    if (formData.consultationMode.length === 0) next.consultationMode = 'Select mode';
    if (!formData.aboutMe) next.aboutMe = 'About me required';

    if (!formData.password) next.password = 'Password required';
    else {
      const check = validateStrongPassword(formData.password);
      if (!check.isValid) next.password = check.message;
    }
    if (formData.password !== formData.confirmPassword) next.confirmPassword = 'Mismatch';

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleLogin = async () => {
    if (!formData.email || !formData.password) {
      showNotification(t('Enter your email and password'), 'error');
      return;
    }
    try {
      setIsLoading(true);
      const response = await axiosInstance.post('/api/auth/login', {
        email: formData.email.trim().toLowerCase(),
        password: formData.password,
        role: 'counsellor',
      });
      const ok = await persistDoctorSession(response.data, formData.email.trim().toLowerCase());
      if (ok) {
        showNotification(t('Welcome back, Doctor!'));
        setTimeout(() => enterAuthenticatedRoute(navigation, 'DoctorDashboard'), 900);
      } else {
        showNotification(t('Login failed'), 'error');
      }
    } catch (err) {
      showNotification(err?.response?.data?.message || t('Login failed'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!validateSignup()) {
      showNotification(t('Please correct the highlighted fields'), 'error');
      return;
    }
    try {
      setIsLoading(true);
      const phoneNumber = normalizeLocalPhoneNumber(formData.phoneNumber, formData.phoneCountryCode);
      const dateOfBirth = toDateOnlyString(formData.dateOfBirth);
      const email = formData.email.trim().toLowerCase();
      const payload = {
        fullName: formData.fullName.trim(),
        email,
        phoneNumber,
        phoneNum: phoneNumber,
        phoneCountryCode: formData.phoneCountryCode,
        dateOfBirth,
        age: calculateAgeFromDateOfBirth(dateOfBirth),
        gender: formData.gender.toLowerCase(),
        qualification: formData.qualification.trim(),
        specialization: formData.specialization.trim(),
        experience: formData.experience,
        location: formData.location.trim(),
        aboutMe: formData.aboutMe.trim(),
        password: formData.password,
        confirmPassword: formData.confirmPassword,
        // Real backend role — see the AUTH comment above for why this isn't 'doctor'.
        role: 'counselor',
        isEmailVerified: true,
        isPhoneVerified: true,
        emailVerificationToken,
        consultationMode: formData.consultationMode.map((m) => m.toLowerCase()),
        languages: formData.languages,
      };

      const response = await postPublicAuthEndpoint('complete-registration', payload);
      const doctorProfile = response.data?.user || response.data?.data?.user || payload;

      if (response.data?.success !== false) {
        const hasSession = await persistDoctorSession(response.data, email);
        showNotification(response.data?.message || t('Account created! Let’s finish your professional profile.'));
        setTimeout(() => navigation.replace('DoctorOnboarding', {
          destination: 'DoctorDashboard',
          doctorProfileBase: doctorProfile,
        }), hasSession ? 1000 : 1500);
      } else {
        showNotification(response.data?.message || t('Signup failed'), 'error');
      }
    } catch (error) {
      showNotification(getApiErrorMessage(error, t('Signup failed')), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendVerifyOtp = async () => {
    if (sendingVerificationRef.current) return;
    const email = formData.email.trim().toLowerCase();
    if (!email) return showNotification(t('Enter your email first'), 'error');
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return showNotification(t('Please enter a valid email address'), 'error');
    }
    sendingVerificationRef.current = true;
    setOtpCode('');
    setOtpError('');
    try {
      setIsSendingVerification(true);
      const response = await postPublicAuthEndpoint('send-email-otp', { email });
      if (isOtpRequestSuccessful(response)) {
        setFormData((prev) => ({ ...prev, email }));
        setShowOtpModal({ show: true, value: email });
        setOtpResendTimer(OTP_RESEND_SECONDS);
        showNotification(response.data?.message || t('OTP sent to your email'));
      } else {
        showNotification(response.data?.message || t('Failed to send OTP'), 'error');
      }
    } catch (err) {
      showNotification(getApiErrorMessage(err, t('Failed to send OTP')), 'error');
    } finally {
      sendingVerificationRef.current = false;
      setIsSendingVerification(false);
    }
  };

  const handleResendVerifyOtp = async () => {
    if (resendingOtpRef.current || otpResendTimer > 0) return;
    const email = String(showOtpModal.value || formData.email).trim().toLowerCase();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      setOtpError(t('Enter valid email'));
      return;
    }
    try {
      resendingOtpRef.current = true;
      setIsResendingOtp(true);
      setOtpError('');
      setOtpCode('');
      const response = await postPublicAuthEndpoint('send-email-otp', { email });
      if (isOtpRequestSuccessful(response)) {
        setShowOtpModal({ show: true, value: email });
        setOtpResendTimer(OTP_RESEND_SECONDS);
        showNotification(response.data?.message || t('OTP resent successfully'));
      } else {
        setOtpError(response.data?.message || t('Failed to resend OTP'));
      }
    } catch (err) {
      setOtpError(getApiErrorMessage(err, t('Failed to resend OTP')));
    } finally {
      resendingOtpRef.current = false;
      setIsResendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (verifyingOtpRef.current) return;
    const normalizedOtp = otpCode.trim();
    if (normalizedOtp.length !== 6) return setOtpError(t('Enter 6 digits'));
    const otpEmail = String(showOtpModal.value || formData.email).trim().toLowerCase();
    try {
      verifyingOtpRef.current = true;
      setIsVerifyingOtp(true);
      setOtpError('');
      const response = await postPublicAuthEndpointWithOtpRetry('verify-email-otp', {
        email: otpEmail,
        otp: normalizedOtp,
      });
      if (isOtpVerificationSuccessful(response)) {
        setFormData((prev) => ({ ...prev, email: otpEmail }));
        setEmailVerified(true);
        setEmailVerificationToken(
          response.data?.emailVerificationToken ||
          response.data?.data?.emailVerificationToken ||
          response.data?.result?.emailVerificationToken ||
          ''
        );
        setShowOtpModal({ show: false, value: '' });
        setOtpCode('');
        setErrors((prev) => ({ ...prev, email: undefined }));
        showNotification(t('Email verified!'));
      } else {
        setOtpError(response.data?.message || t('Failed'));
      }
    } catch (err) {
      setOtpError(getApiErrorMessage(err, t('Verification failed')));
    } finally {
      verifyingOtpRef.current = false;
      setIsVerifyingOtp(false);
    }
  };

  const closeOtpModal = () => {
    setShowOtpModal({ show: false, value: '' });
    setOtpCode('');
    setOtpError('');
    setOtpResendTimer(0);
    setIsResendingOtp(false);
    resendingOtpRef.current = false;
  };

  const handleGoogleSuccess = async ({ isCounselor, user, isNewUser }) => {
    if (!isCounselor) {
      showNotification(t('This Google account is not registered as a doctor or consultant'), 'error');
      return;
    }

    const email = user?.email || '';
    const hasSession = await persistDoctorSession({
      user,
      accessToken: await AsyncStorage.getItem('accessToken'),
    }, email);
    if (!hasSession) {
      showNotification(t('Google sign-in did not create a session'), 'error');
      return;
    }

    if (isLogin && !isNewUser) {
      showNotification(t('Welcome back, Doctor!'));
      setTimeout(() => enterAuthenticatedRoute(navigation, 'DoctorDashboard'), 700);
      return;
    }

    showNotification(t('Account created with Google!'));
    setTimeout(() => navigation.replace('DoctorOnboarding', {
      destination: 'DoctorDashboard',
      doctorProfileBase: user,
    }), 900);
  };

  const renderInput = (index, name, icon, placeholder, options = {}, verifyType = null) => {
    const isFocused = focusedField === name;
    const isMultiline = options.multiline;
    const isVerified = verifyType === 'email' && emailVerified;
    return (
      <Animated.View key={`doctor-input-${name}`} style={[styles.inputField, { opacity: fieldAnims[index], transform: [{ translateY: fieldAnims[index].interpolate({ inputRange: [0, 1], outputRange: [15, 0] }) }] }]}>
        <View style={[styles.inputWrapper, isFocused && styles.inputWrapperFocused, isMultiline && { height: 'auto', minHeight: 70, alignItems: 'flex-start', paddingTop: 10 }]}>
          <Icon name={icon} size={20} color={isFocused ? CLINICIAN.primary : '#64748b'} style={[styles.inputIcon, isMultiline && { marginTop: 4 }]} />
          <TextInput
            style={[styles.textInput, isMultiline && { height: 'auto', minHeight: 50, textAlignVertical: 'top' }]}
            value={formData[name]}
            onChangeText={(text) => handleChange(name, text)}
            onFocus={(event) => { setFocusedField(name); scrollFocusedInputIntoView(event); }}
            onBlur={() => setFocusedField(null)}
            placeholder={placeholder}
            placeholderTextColor="#94a3b8"
            {...options}
          />
          {verifyType && !isLogin && (
            <TouchableOpacity
              onPress={handleSendVerifyOtp}
              disabled={isVerified || isSendingVerification}
              style={[styles.verifyBtn, (isVerified || isSendingVerification) && styles.verifiedBtn]}
            >
              {isVerified ? (
                <Icon name="check-decagram" size={18} color={CLINICIAN.primary} />
              ) : isSendingVerification ? (
                <ActivityIndicator size="small" color={CLINICIAN.primary} />
              ) : (
                <Text style={styles.verifyBtnText}>{t('Verify')}</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
        {errors[name] && <Text style={styles.errorText}>{errors[name]}</Text>}
      </Animated.View>
    );
  };

  const renderPhoneInput = (index) => (
    <Animated.View key="doctor-input-phoneNumber" style={[styles.inputField, { opacity: fieldAnims[index], transform: [{ translateY: fieldAnims[index].interpolate({ inputRange: [0, 1], outputRange: [15, 0] }) }] }]}>
      <CountryPhoneInput
        value={formData.phoneNumber}
        countryCode={formData.phoneCountryCode}
        onChangePhoneNumber={(text) => handleChange('phoneNumber', text)}
        onChangeCountryCode={(code) => handleChange('phoneCountryCode', code)}
        focused={focusedField === 'phoneNumber'}
        accentColor={CLINICIAN.primary}
        containerStyle={styles.phoneInputWrapper}
        inputStyle={styles.phoneTextInput}
        onFocus={(event) => { setFocusedField('phoneNumber'); scrollFocusedInputIntoView(event); }}
        onBlur={() => setFocusedField(null)}
      />
      {errors.phoneNumber && <Text style={styles.errorText}>{errors.phoneNumber}</Text>}
    </Animated.View>
  );

  const renderDateOfBirthInput = (index) => (
    <Animated.View key="doctor-input-dob" style={[styles.inputField, { opacity: fieldAnims[index], transform: [{ translateY: fieldAnims[index].interpolate({ inputRange: [0, 1], outputRange: [15, 0] }) }] }]}>
      <TouchableOpacity style={styles.inputWrapper} onPress={() => setShowDateOfBirthPicker(true)} activeOpacity={0.85}>
        <Icon name="calendar-month-outline" size={20} color="#64748b" style={styles.inputIcon} />
        <Text style={[styles.datePickerText, !formData.dateOfBirth && styles.datePickerPlaceholder]}>
          {formatDateOfBirthDisplay(formData.dateOfBirth, t('Date of Birth'))}
        </Text>
        <Icon name="chevron-down" size={20} color="#94a3b8" />
      </TouchableOpacity>
      {showDateOfBirthPicker && (
        <DateTimePicker
          value={getDatePickerValue(formData.dateOfBirth)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={new Date()}
          onChange={handleDateOfBirthChange}
        />
      )}
      {errors.dateOfBirth && <Text style={styles.errorText}>{errors.dateOfBirth}</Text>}
    </Animated.View>
  );

  // justifyContent is always 'flex-start' now, even in login mode — centering
  // the panel meant its "resting" scroll position shifted with content size,
  // and combined with the keyboard-open scroll this is what could send the
  // whole panel (and its back button clearance) further up than intended.
  // Top-anchoring keeps that clearance fixed and predictable, same as the
  // shared Login screen.
  const scrollContainerStyle = {
    ...styles.scrollContent,
    justifyContent: 'flex-start',
    paddingHorizontal: isCompact ? 12 : 16,
    paddingTop: isLogin ? (isCompact ? 72 : 88) : (isCompact ? 62 : 76),
    paddingBottom: (isLogin ? (isCompact ? 44 : 60) : (isCompact ? 14 : 20)) + keyboardInset,
  };
  const signupPanelHeight = Math.min(isTablet ? 760 : 720, Math.max(360, height - (isCompact ? 78 : 96)));
  const signupPanelPaddingY = isCompact ? 18 : 22;
  const signupLogoSize = isCompact ? 64 : 80;
  const signupHeaderHeight = signupLogoSize + (isCompact ? 68 : 74);
  const signupFormHeight = Math.max(260, signupPanelHeight - signupPanelPaddingY * 2 - signupHeaderHeight);
  const panelStyle = [
    styles.panel,
    {
      maxWidth: isTablet ? 480 : 440,
      height: isLogin ? undefined : signupPanelHeight,
      paddingHorizontal: isCompact ? 16 : 22,
      paddingVertical: signupPanelPaddingY,
      borderRadius: isCompact ? 28 : 40,
    },
  ];
  const formScrollStyle = [styles.formScroll, !isLogin && styles.signupFormScroll, !isLogin && { height: signupFormHeight }];
  const formContentStyle = [styles.formPanel, !isLogin && styles.signupFormPanel, !isLogin && { paddingBottom: (isCompact ? 18 : 24) + keyboardInset }];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <AuthBackground role="doctor" style={styles.gradient}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.flex}>
            <TouchableOpacity style={styles.backBtn} onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.replace('RoleSelector'))}>
              <Icon name="chevron-left" size={28} color="#0F172A" />
            </TouchableOpacity>
            <ScrollView
              ref={isLogin ? scrollRef : null}
              contentContainerStyle={scrollContainerStyle}
              showsVerticalScrollIndicator={false}
              onLayout={isLogin ? handleKeyboardAwareScrollLayout : undefined}
              onScroll={isLogin ? handleKeyboardAwareScroll : undefined}
              scrollEventThrottle={16}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              scrollEnabled={isLogin}
            >
              <Animated.View style={[panelStyle, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                <View style={styles.header}>
                  <Image source={logo} style={styles.logo} resizeMode="contain" />
                  <View style={styles.brandContainer}>
                    <Text style={[styles.brandMain, { color: CLINICIAN.primary }]}>{t('Humaeli')}</Text>
                  </View>
                  <Text style={styles.tagline}>{isLogin ? t('Welcome Back, Doctor') : t('Create Your Doctor Account')}</Text>
                </View>

                <ScrollView
                  ref={!isLogin ? scrollRef : null}
                  style={formScrollStyle}
                  contentContainerStyle={formContentStyle}
                  showsVerticalScrollIndicator={!isLogin}
                  onLayout={!isLogin ? handleKeyboardAwareScrollLayout : undefined}
                  onScroll={!isLogin ? handleKeyboardAwareScroll : undefined}
                  scrollEventThrottle={16}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                  scrollEnabled={!isLogin}
                >
                  {!isLogin ? (
                    <>
                      {renderInput(1, 'fullName', 'account-outline', t('Full Name'))}
                      {renderInput(2, 'email', 'email-outline', t('Email Address'), { keyboardType: 'email-address', autoCapitalize: 'none' }, 'email')}
                      {renderPhoneInput(3)}
                      {renderDateOfBirthInput(4)}
                      {renderInput(5, 'age', 'calendar-account-outline', t('Age'), { editable: false, placeholder: t('Age will be calculated') })}
                      <Animated.View key="gender-section" style={{ opacity: fieldAnims[6] }}>
                        <Text style={styles.sectionLabel}>{t('Gender')}</Text>
                        <View style={styles.genderRow}>
                          {genderOptions.map((g) => (
                            <TouchableOpacity key={g} style={[styles.genderBtn, formData.gender === g && styles.genderBtnSelected]} onPress={() => handleChange('gender', g)}>
                              <Text style={[styles.genderText, formData.gender === g && styles.genderTextSelected]}>{t(g)}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </Animated.View>
                      {renderInput(7, 'qualification', 'school-outline', t('Medical Qualification'))}
                      {renderInput(8, 'specialization', 'certificate-outline', t('Medical Specialization'))}
                      <View style={styles.row}>
                        <View style={{ flex: 1 }}>{renderInput(9, 'experience', 'briefcase-clock-outline', t('Years'))}</View>
                        <View style={{ flex: 1.5 }}>{renderInput(10, 'location', 'map-marker-radius-outline', t('City'))}</View>
                      </View>
                      <Animated.View key="mode-section" style={{ opacity: fieldAnims[11] }}>
                        <Text style={styles.sectionLabel}>{t('Consultation Mode')}</Text>
                        <View style={styles.tagRow}>
                          {consultationModes.map((m) => (
                            <TouchableOpacity key={m} style={[styles.tag, formData.consultationMode.includes(m) && styles.tagSelected]} onPress={() => toggleListItem('consultationMode', m)}>
                              <Text style={[styles.tagText, formData.consultationMode.includes(m) && styles.tagTextSelected]}>{t(m)}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                        {errors.consultationMode && <Text style={styles.errorText}>{errors.consultationMode}</Text>}
                      </Animated.View>
                      <Animated.View key="lang-section" style={{ opacity: fieldAnims[12] }}>
                        <Text style={styles.sectionLabel}>{t('Languages')}</Text>
                        <View style={styles.tagRow}>
                          {languageOptions.map((l) => (
                            <TouchableOpacity key={l} style={[styles.tag, formData.languages.includes(l) && styles.tagSelected]} onPress={() => toggleListItem('languages', l)}>
                              <Text style={[styles.tagText, formData.languages.includes(l) && styles.tagTextSelected]}>{t(l)}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </Animated.View>
                      {renderInput(13, 'aboutMe', 'account-details-outline', t('About Me'), { multiline: true })}
                    </>
                  ) : (
                    <>{renderInput(1, 'email', 'email-outline', t('Email'), { keyboardType: 'email-address', autoCapitalize: 'none' })}</>
                  )}

                  <Animated.View key="pwd-section" style={{ opacity: fieldAnims[14] }}>
                    <View style={[styles.inputWrapper, focusedField === 'password' && styles.inputWrapperFocused]}>
                      <Icon name="lock-outline" size={20} color={focusedField === 'password' ? CLINICIAN.primary : '#64748b'} style={styles.inputIcon} />
                      <TextInput
                        style={styles.textInput}
                        value={formData.password}
                        onChangeText={(text) => handleChange('password', text)}
                        onFocus={(event) => {
                          setFocusedField('password');
                          // In login mode, bring the submit button into view
                          // along with this field (see loginSubmitBtnRef).
                          // In signup mode there's a confirmPassword field
                          // right after this one, so the normal per-field
                          // behavior is what's wanted.
                          const btnHandle = isLogin ? findNodeHandle(loginSubmitBtnRef.current) : null;
                          scrollFocusedInputIntoView(btnHandle ? { target: btnHandle } : event);
                        }}
                        onBlur={() => setFocusedField(null)}
                        placeholder={t('Password')}
                        placeholderTextColor="#94a3b8"
                        secureTextEntry={!showPassword}
                      />
                      <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                        <Icon name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#64748b" />
                      </TouchableOpacity>
                    </View>
                    {!isLogin && <Text style={styles.passwordHint}>{t(STRONG_PASSWORD_HINT)}</Text>}
                    {!isLogin && <PasswordRequirementChecklist password={formData.password} style={styles.passwordChecklist} />}
                    {!isLogin && errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
                  </Animated.View>

                  {isLogin && (
                    <TouchableOpacity onPress={() => showNotification(t('Password reset will be available once the Doctor backend is connected'), 'info')} style={styles.forgotLink}>
                      <Text style={[styles.forgotText, { color: CLINICIAN.primary }]}>{t('Forgot Password?')}</Text>
                    </TouchableOpacity>
                  )}

                  {!isLogin && (
                    <Animated.View key="cpwd-section" style={{ opacity: fieldAnims[15] }}>
                      <View style={[styles.inputWrapper, focusedField === 'confirmPassword' && styles.inputWrapperFocused]}>
                        <Icon name="lock-check-outline" size={20} color={focusedField === 'confirmPassword' ? CLINICIAN.primary : '#64748b'} style={styles.inputIcon} />
                        <TextInput
                          style={styles.textInput}
                          value={formData.confirmPassword}
                          onChangeText={(text) => handleChange('confirmPassword', text)}
                          onFocus={(event) => { setFocusedField('confirmPassword'); scrollFocusedInputIntoView(event); }}
                          onBlur={() => setFocusedField(null)}
                          placeholder={t('Confirm Password')}
                          placeholderTextColor="#94a3b8"
                          secureTextEntry={!showConfirmPassword}
                        />
                        <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                          <Icon name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#64748b" />
                        </TouchableOpacity>
                      </View>
                      {errors.confirmPassword ? <Text style={styles.errorText}>{errors.confirmPassword}</Text> : null}
                    </Animated.View>
                  )}

                  <Animated.View key="btn-section" style={{ opacity: fieldAnims[16], marginTop: 10 }}>
                    <TouchableOpacity ref={loginSubmitBtnRef} activeOpacity={0.9} onPress={isLogin ? handleLogin : handleSignup} disabled={isLoading}>
                      <LinearGradient colors={[CLINICIAN.gradientFrom, CLINICIAN.gradientTo]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.submitBtn}>
                        {isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>{isLogin ? t('Login') : t('Create Account')}</Text>}
                      </LinearGradient>
                    </TouchableOpacity>
                  </Animated.View>

                  <Animated.View key="google-section" style={{ opacity: fieldAnims[16], marginTop: 14 }}>
                    <View style={styles.googleDividerRow}>
                      <View style={styles.googleDividerLine} />
                      <Text style={styles.googleDividerText}>{t('or')}</Text>
                      <View style={styles.googleDividerLine} />
                    </View>
                    <GoogleAuthButton
                      role="counselor"
                      mode={isLogin ? 'signin' : 'signup'}
                      disabled={isLoading}
                      accountRole="doctor"
                      locationEvent={isLogin ? 'login' : 'signup'}
                      onSuccess={handleGoogleSuccess}
                      onError={(message) => showNotification(message || t('Google sign-in failed'), 'error')}
                    />
                  </Animated.View>

                  {/* One shared Login screen for every role — tapping this always
                      goes to the common front Login, never a per-screen login form. */}
                  <Animated.View key="sw-section" style={[styles.switchRow, { opacity: fieldAnims[17] }]}>
                    <Text style={styles.switchText}>{isLogin ? t("Don't have an account?") : t('Already a member?')}</Text>
                    <TouchableOpacity onPress={() => (isLogin ? setIsLogin(false) : navigation.navigate('Login'))}>
                      <Text style={[styles.switchLink, { color: CLINICIAN.primary }]}>{isLogin ? t(' Create Account') : t(' Login')}</Text>
                    </TouchableOpacity>
                  </Animated.View>
                </ScrollView>
              </Animated.View>
            </ScrollView>
          </View>
        </SafeAreaView>

        <Modal
          visible={showOtpModal.show}
          transparent
          animationType="slide"
          presentationStyle="overFullScreen"
          statusBarTranslucent
          navigationBarTranslucent
          onRequestClose={closeOtpModal}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalIcon}>
                <Icon name="email-fast-outline" size={40} color={CLINICIAN.primary} />
              </View>
              <Text style={styles.modalTitle}>{t('Verify Your Email')}</Text>
              <Text style={styles.modalSub}>{t('Enter code sent to')} {showOtpModal.value}</Text>
              <TextInput
                key={`${showOtpModal.value}:${showOtpModal.show ? 'open' : 'closed'}`}
                style={styles.otpInput}
                value={otpCode}
                onChangeText={(value) => setOtpCode(value.replace(/\D/g, ''))}
                placeholder={t('000000')}
                placeholderTextColor="#94a3b8"
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />
              <View style={styles.otpResendRow}>
                {otpResendTimer > 0 ? (
                  <Text style={styles.otpTimerText}>{t('Resend OTP in')} {formatOtpTimer(otpResendTimer)}</Text>
                ) : (
                  <Text style={styles.otpTimerText}>{t("Didn't receive code?")}</Text>
                )}
                <TouchableOpacity onPress={handleResendVerifyOtp} disabled={otpResendTimer > 0 || isResendingOtp} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={[styles.otpResendText, (otpResendTimer > 0 || isResendingOtp) && styles.otpResendTextDisabled]}>
                    {isResendingOtp ? t('Sending...') : t('Resend')}
                  </Text>
                </TouchableOpacity>
              </View>
              {otpError ? <Text style={styles.modalErrorText}>{otpError}</Text> : null}
              <TouchableOpacity
                style={[styles.modalActionBtn, (isVerifyingOtp || otpCode.length !== 6) && styles.modalActionBtnDisabled]}
                onPress={handleVerifyOtp}
                disabled={isVerifyingOtp || otpCode.length !== 6}
              >
                {isVerifyingOtp ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalActionText}>{t('Verify Email')}</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={closeOtpModal} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>{t('Cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {notification.show && (
          <Animated.View style={[styles.notification, { backgroundColor: notification.type === 'error' ? '#ef4444' : CLINICIAN.primary }]}>
            <Icon name={notification.type === 'error' ? 'alert-circle' : 'check-circle'} size={20} color="#fff" />
            <Text style={styles.notificationText}>{notification.message}</Text>
          </Animated.View>
        )}
      </AuthBackground>
    </View>
  );
};

const styles = createDoctorStyles({
  container: { flex: 1 },
  flex: { flex: 1 },
  gradient: { flex: 1, overflow: 'hidden' },
  safeArea: { flex: 1 },
  scrollContent: { padding: 24, paddingTop: 100, paddingBottom: 60, flexGrow: 1 },
  backBtn: { position: 'absolute', top: 30, left: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  panel: { backgroundColor: 'rgba(255, 255, 255, 0.96)', borderRadius: 40, padding: 28, width: '100%', maxWidth: 440, alignSelf: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 30, elevation: 15 },
  header: { alignItems: 'center', marginBottom: 14 },
  logo: { width: 80, height: 80 },
  brandContainer: { flexDirection: 'row', marginTop: 4 },
  brandMain: { fontSize: 26, fontWeight: '900', color: '#1e293b' },
  tagline: { fontSize: 13, color: '#64748b', fontWeight: '600', marginTop: 4 },
  formScroll: { width: '100%' },
  signupFormScroll: { flexShrink: 0 },
  formPanel: { gap: 10 },
  signupFormPanel: { paddingBottom: 18 },
  inputField: { width: '100%' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 18, paddingHorizontal: 16, height: 58, borderWidth: 1.5, borderColor: '#f1f5f9' },
  phoneInputWrapper: { height: 58, paddingHorizontal: 16 },
  inputWrapperFocused: { borderColor: CLINICIAN.primary, backgroundColor: '#ffffff' },
  inputIcon: { marginRight: 8 },
  textInput: { flex: 1, color: '#1e293b', fontSize: 15, fontWeight: '600' },
  phoneTextInput: { fontSize: 15 },
  datePickerText: { flex: 1, color: '#1e293b', fontSize: 15, fontWeight: '600' },
  datePickerPlaceholder: { color: '#94a3b8' },
  errorText: { color: '#ef4444', fontSize: 11, marginTop: 4, marginLeft: 16, fontWeight: '600' },
  passwordHint: { color: '#64748b', fontSize: 11, lineHeight: 15, marginTop: 4, marginLeft: 16, fontWeight: '600' },
  passwordChecklist: { marginLeft: 16, marginRight: 4 },
  row: { flexDirection: 'row', gap: 12 },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  tag: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: 'transparent' },
  tagSelected: { backgroundColor: '#F0FDFA', borderColor: CLINICIAN.primary },
  tagText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  tagTextSelected: { color: CLINICIAN.primary },
  forgotLink: { alignSelf: 'flex-end', marginTop: -8, marginBottom: 8 },
  forgotText: { fontSize: 12, fontWeight: '700' },
  submitBtn: { height: 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center', shadowColor: CLINICIAN.primary, shadowOpacity: 0.3, shadowRadius: 10, elevation: 8 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  googleDividerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  googleDividerLine: { flex: 1, height: 1, backgroundColor: '#e5e7eb' },
  googleDividerText: { marginHorizontal: 12, fontSize: 12, color: '#9ca3af', fontWeight: '600' },
  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 10 },
  switchText: { fontSize: 14, color: '#64748b', fontWeight: '500' },
  switchLink: { fontSize: 14, fontWeight: '800' },
  genderRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  genderBtn: { flex: 1, height: 44, borderRadius: 15, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  genderBtnSelected: { backgroundColor: '#F0FDFA', borderColor: CLINICIAN.primary },
  genderText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  genderTextSelected: { color: CLINICIAN.primary },
  notification: { position: 'absolute', top: 50, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 15, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 10, zIndex: 1000 },
  notificationText: { color: '#fff', fontSize: 14, fontWeight: '700', marginLeft: 8 },

  verifyBtn: { minWidth: 68, minHeight: 34, backgroundColor: CLINICIAN.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  verifiedBtn: { backgroundColor: 'transparent' },
  verifyBtnText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  modalOverlay: { flex: 1, width: '100%', minHeight: '100%', backgroundColor: 'rgba(15,23,42,0.64)', justifyContent: 'center', alignItems: 'center', padding: 22 },
  modalContent: { backgroundColor: '#fff', borderRadius: 26, padding: 28, width: '100%', maxWidth: 390, alignItems: 'center', borderWidth: 1, borderColor: '#DBEAFE', shadowColor: '#0B2F6B', shadowOpacity: 0.18, shadowRadius: 24, elevation: 14 },
  modalIcon: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#F0FDFA', justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#0F172A', marginBottom: 8, textAlign: 'center' },
  modalSub: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 21, marginBottom: 22 },
  modalActionBtn: { width: '100%', height: 54, borderRadius: 16, backgroundColor: CLINICIAN.primary, justifyContent: 'center', alignItems: 'center', shadowColor: CLINICIAN.primary, shadowOpacity: 0.22, shadowRadius: 10, elevation: 5 },
  modalActionBtnDisabled: { backgroundColor: '#94A3B8', shadowOpacity: 0, elevation: 0 },
  modalActionText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  modalErrorText: { width: '100%', color: '#B91C1C', backgroundColor: '#FEF2F2', fontSize: 12, fontWeight: '700', textAlign: 'center', padding: 10, borderRadius: 10, marginTop: -6, marginBottom: 14 },
  cancelBtn: { width: '100%', height: 44, marginTop: 10, justifyContent: 'center', alignItems: 'center' },
  cancelText: { fontSize: 14, fontWeight: '700', color: '#64748B' },
  otpInput: { width: '100%', height: 56, borderRadius: 16, backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#BFD7FF', textAlign: 'center', fontSize: 22, letterSpacing: 8, fontWeight: '800', color: '#0F172A', marginBottom: 16 },
  otpResendRow: { width: '100%', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: -6, marginBottom: 16, flexWrap: 'wrap' },
  otpTimerText: { color: '#64748B', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  otpResendText: { color: CLINICIAN.primary, fontSize: 13, fontWeight: '900' },
  otpResendTextDisabled: { color: '#94A3B8' },
});

export default DoctorSignup;
