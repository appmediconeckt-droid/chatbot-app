import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Modal,
  ActivityIndicator,
  Image,
  SafeAreaView,
  StatusBar,
  useWindowDimensions,
  Animated,
} from 'react-native';
import TextInput from '../../components/TranslatedTextInput';
import Text from '../../components/TranslatedText';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosInstance from '../../axiosConfig';
import LinearGradient from 'react-native-linear-gradient';
import AuthBackground from '../../theme/AuthBackground';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary } from 'react-native-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import GoogleAuthButton from './components/GoogleAuthButton';
import ForgotPasswordModal from './components/ForgotPasswordModal';
import { sendLocationSilently } from '../../utils/locationHelper';
import socketService from '../../services/socketService';
import CountryPhoneInput from '../../components/common/CountryPhoneInput';
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

// Import logo
import logo from '../../image/HumaeliBlue.png';
import useLanguageRender from '../../hooks/useLanguageRender';
import useKeyboardAwareScroll from '../../hooks/useKeyboardAwareScroll';
import {
  getApiErrorMessage,
  isOtpRequestSuccessful,
  isOtpVerificationSuccessful,
  postPublicAuthEndpoint,
  postPublicAuthEndpointWithOtpRetry,
} from './authUtils';

const OTP_RESEND_SECONDS = 60;

const CounselorSignup = ({ navigation, route }) => {
  const { t } = useLanguageRender();
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 600;
  const isCompact = width < 360 || height < 700;
  const [isLogin, setIsLogin] = useState(true);
  const [focusedField, setFocusedField] = useState(null);
  const {
    scrollRef,
    keyboardInset,
    scrollFocusedInputIntoView,
    handleKeyboardAwareScroll,
    handleKeyboardAwareScrollLayout,
  } = useKeyboardAwareScroll();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    phoneNumber: '',
    phoneCountryCode: '+91',
    age: '',
    dateOfBirth: '',
    gender: '',
    qualification: '',
    specialization: '',
    experience: '',
    location: '',
    consultationMode: [],
    languages: [],
    aboutMe: '',
    // profilePhoto: null,
    confirmPassword: '',
  });

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  // Holds the running entrance animation so a mode switch can stop it cleanly.
  const entranceAnimRef = useRef(null);
  // Entrance plays on open only; later mode toggles skip it.
  const firstEntranceRef = useRef(true);
  const orb1Anim = useRef(new Animated.Value(0)).current;
  const orb2Anim = useRef(new Animated.Value(0)).current;
  const particle1 = useRef(new Animated.Value(0)).current;
  const particle2 = useRef(new Animated.Value(0)).current;

  // Staggered field animations
  const fieldAnims = useRef([...Array(20)].map(() => new Animated.Value(0))).current;

  // UI States
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [showDateOfBirthPicker, setShowDateOfBirthPicker] = useState(false);

  // Verification states
  const [emailVerified, setEmailVerified] = useState(false);
  const [emailVerificationToken, setEmailVerificationToken] = useState('');
  const [showOtpModal, setShowOtpModal] = useState({ show: false, type: '', value: '' });
  const [otpCode, setOtpCode] = useState('');
  const [isSendingVerification, setIsSendingVerification] = useState(false);
  const sendingVerificationRef = useRef(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const verifyingOtpRef = useRef(false);
  const [otpError, setOtpError] = useState('');
  const [otpResendTimer, setOtpResendTimer] = useState(0);
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  const resendingOtpRef = useRef(false);

  // Device Conflict States
  const [showDeviceConflict, setShowDeviceConflict] = useState(false);
  const [deviceOtp, setDeviceOtp] = useState('');
  const [deviceOtpSent, setDeviceOtpSent] = useState(false);
  const [isSendingDeviceOtp, setIsSendingDeviceOtp] = useState(false);
  const [isVerifyingDeviceOtp, setIsVerifyingDeviceOtp] = useState(false);
  const [deviceOtpResendTimer, setDeviceOtpResendTimer] = useState(0);
  const [isResendingDeviceOtp, setIsResendingDeviceOtp] = useState(false);
  const resendingDeviceOtpRef = useRef(false);

  // Forgot Password popup
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const consultationModes = ['Online', 'Offline', 'Both'];
  const languageOptions = ['Hindi', 'English', 'Gujarati', 'Marathi', 'Tamil', 'Telugu', 'Bengali', 'Punjabi'];
  const genderOptions = ['Male', 'Female', 'Other'];

  // Same fix as UserSignup: the panel and every field take their opacity from
  // these values, so leaving any at 0 renders a blank page. Resetting them to 0
  // and starting a new animation over an unstopped one can leave a native-driven
  // value stuck. Entrance plays once on open; a Login <-> Create Account toggle
  // just snaps to the visible end state.
  useEffect(() => {
    entranceAnimRef.current?.stop();

    const showImmediately = () => {
      fadeAnim.setValue(1);
      slideAnim.setValue(0);
      fieldAnims.forEach(anim => anim.setValue(1));
    };

    if (!firstEntranceRef.current) {
      showImmediately();
      return;
    }
    firstEntranceRef.current = false;

    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    fieldAnims.forEach(anim => anim.setValue(0));

    entranceAnimRef.current = Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 20, friction: 7, useNativeDriver: true }),
      Animated.stagger(40, fieldAnims.map(anim =>
        Animated.spring(anim, { toValue: 1, tension: 25, friction: 8, useNativeDriver: true })
      ))
    ]);
    entranceAnimRef.current.start(({ finished }) => {
      if (!finished) showImmediately();
    });
  }, [isLogin]);

  useEffect(() => {
    const createOrbLoop = (anim, toVal) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: toVal, duration: 10000, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 10000, useNativeDriver: true }),
        ])
      );
    };
    createOrbLoop(orb1Anim, 120).start();
    createOrbLoop(orb2Anim, -100).start();
    createOrbLoop(particle1, 200).start();
    createOrbLoop(particle2, -150).start();
  }, []);

  useEffect(() => {
    if (!showOtpModal.show || otpResendTimer <= 0) return undefined;

    const interval = setInterval(() => {
      setOtpResendTimer(prev => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [showOtpModal.show, otpResendTimer]);

  useEffect(() => {
    if (!showDeviceConflict || !deviceOtpSent || deviceOtpResendTimer <= 0) return undefined;

    const interval = setInterval(() => {
      setDeviceOtpResendTimer(prev => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [showDeviceConflict, deviceOtpSent, deviceOtpResendTimer]);

  const formatOtpTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const persistCounselorSession = async (data) => {
    const token = data?.token || data?.accessToken;
    if (!token) return false;
    await AsyncStorage.setItem('token', token);
    await AsyncStorage.setItem('accessToken', token);
    await AsyncStorage.setItem('isAuthenticated', 'true');
    await AsyncStorage.setItem('userEmail', formData.email);

    if (data.user) {
      await AsyncStorage.setItem('userData', JSON.stringify(data.user));
      const role = data.user.role || 'counsellor';
      await AsyncStorage.setItem('userRole', role);
      const id = data.user._id || data.user.id;
      if (id) {
        await AsyncStorage.setItem('counsellorId', id);
        await AsyncStorage.setItem('userId', id);
      }
    } else {
      await AsyncStorage.setItem('userRole', 'counselor');
    }
    sendLocationSilently('login');
    socketService.connect().catch(() => {});
    return true;
  };

  const validateSignup = () => {
    const newErrors = {};
    if (!formData.fullName) newErrors.fullName = "Full name is required";
    if (!formData.email) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = "Email is invalid";
    else if (!emailVerified) newErrors.email = "Please verify your email first";

    if (!formData.phoneNumber) newErrors.phoneNumber = "Phone is required";
    else if (!isValidLocalPhoneNumber(formData.phoneNumber, formData.phoneCountryCode)) {
      newErrors.phoneNumber = `Phone number must be ${getPhoneLengthLabel(formData.phoneCountryCode)} digits`;
    }

    const calculatedAge = calculateAgeFromDateOfBirth(formData.dateOfBirth);
    if (!formData.dateOfBirth || calculatedAge === null) newErrors.dateOfBirth = "Date of birth is required";
    else if (calculatedAge < 18 || calculatedAge > 100) newErrors.dateOfBirth = "Must be 18-100";

    if (!formData.gender) newErrors.gender = "Gender is required";
    if (!formData.qualification) newErrors.qualification = "Qualification required";
    if (!formData.specialization) newErrors.specialization = "Specialization required";
    if (!formData.experience) newErrors.experience = "Experience required";
    if (formData.consultationMode.length === 0) newErrors.consultationMode = "Select mode";
    if (!formData.aboutMe) newErrors.aboutMe = "About me required";

    if (!formData.password) newErrors.password = "Password required";
    else if (formData.password.length < 6) newErrors.password = "Min 6 characters";
    if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = "Mismatch";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    try {
      setIsLoading(true);
      const response = await axiosInstance.post('/api/auth/login', {
        email: formData.email,
        password: formData.password,
        role: 'counsellor',
      });
      if (await persistCounselorSession(response.data)) {
        showNotification('Login successful!');
        // Existing counselor logging in → location gate, then dashboard.
        // Onboarding is only for brand-new signups (see handleSignup).
        setTimeout(() => navigation.replace('LocationGate', { destination: 'CounselorDashboard' }), 1000);
      }
    } catch (err) {
      if (err?.response?.status === 409) {
        setDeviceOtp('');
        setDeviceOtpSent(false);
        setDeviceOtpResendTimer(0);
        setIsResendingDeviceOtp(false);
        resendingDeviceOtpRef.current = false;
        setShowDeviceConflict(true);
        showNotification('Active session elsewhere', 'info');
      } else {
        showNotification(err?.response?.data?.message || 'Login failed', 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async () => {
    if (!validateSignup()) {
      showNotification('Please correct errors', 'error');
      return;
    }
    try {
      setIsLoading(true);
      
      // There is no file in the current signup form, so send JSON. Manually
      // setting multipart/form-data without a boundary can make Express see an
      // empty body and report every required field as missing.
      const phoneNumber = normalizeLocalPhoneNumber(formData.phoneNumber, formData.phoneCountryCode);
      const dateOfBirth = toDateOnlyString(formData.dateOfBirth);
      const calculatedAge = calculateAgeFromDateOfBirth(dateOfBirth);
      const data = {
        fullName: formData.fullName.trim(),
        email: formData.email.trim().toLowerCase(),
        phoneNumber,
        phoneNum: phoneNumber,
        phoneCountryCode: formData.phoneCountryCode,
        dateOfBirth,
        age: calculatedAge,
        gender: formData.gender.toLowerCase(),
        qualification: formData.qualification.trim(),
        specialization: formData.specialization.trim(),
        experience: formData.experience,
        location: formData.location.trim(),
        aboutMe: formData.aboutMe.trim(),
        password: formData.password,
        role: 'counselor',
        isEmailVerified: true,
        isPhoneVerified: true,
        emailVerificationToken,
        consultationMode: formData.consultationMode.map(mode => mode.toLowerCase()),
        languages: formData.languages,
      };

      const response = await postPublicAuthEndpoint('complete-registration', data);

      if (response.data?.success) {
        const hasSession = await persistCounselorSession(response.data);
        showNotification(response.data.message || 'Consultant registered!');

        if (hasSession) {
          setTimeout(() => navigation.replace('LocationGate', { destination: 'CounselorDashboard' }), 1500);
        } else if (response.data?.requiresLogin) {
          setFormData(prev => ({
            ...prev,
            password: '',
            confirmPassword: '',
          }));
          setEmailVerified(false);
          setEmailVerificationToken('');
          setTimeout(() => setIsLogin(true), 1200);
        }
      } else {
        showNotification(response.data?.message || 'Signup failed', 'error');
      }
    } catch (error) {
      showNotification(
        getApiErrorMessage(error, 'Signup failed'),
        'error',
      );
    } finally {
      setIsLoading(false);
    }
  };


  const handleSendVerifyOtp = async () => {
    if (sendingVerificationRef.current) return;
    const email = formData.email.trim().toLowerCase();
    const type = 'email';
    const value = email;
    if (!value) return showNotification(`Enter ${type} first`, 'error');
    if (type === 'email' && !/^\S+@\S+\.\S+$/.test(value)) {
      return showNotification('Please enter a valid email address', 'error');
    }
    sendingVerificationRef.current = true;
    setOtpCode('');
    setOtpError('');
    try {
      setIsSendingVerification(true);
      const endpoint = 'send-email-otp';
      const payload = { email: value };
      const response = await postPublicAuthEndpoint(endpoint, payload);
      if (isOtpRequestSuccessful(response)) {
        setFormData(prev => ({ ...prev, email: value }));
        setShowOtpModal({ show: true, type, value });
        setOtpResendTimer(OTP_RESEND_SECONDS);
        showNotification(response.data?.message || `OTP sent to ${type}`);
      } else {
        showNotification(response.data?.message || 'Failed to send OTP', 'error');
      }
    } catch (err) {
      showNotification(getApiErrorMessage(err, 'Failed to send OTP'), 'error');
    } finally {
      sendingVerificationRef.current = false;
      setIsSendingVerification(false);
    }
  };

  const handleResendVerifyOtp = async () => {
    if (resendingOtpRef.current || otpResendTimer > 0) return;

    const email = String(showOtpModal.value || formData.email).trim().toLowerCase();
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      setOtpError('Enter valid email');
      return;
    }

    try {
      resendingOtpRef.current = true;
      setIsResendingOtp(true);
      setOtpError('');
      setOtpCode('');

      const response = await postPublicAuthEndpoint('send-email-otp', { email });
      if (isOtpRequestSuccessful(response)) {
        setFormData(prev => ({ ...prev, email }));
        setShowOtpModal({ show: true, type: 'email', value: email });
        setOtpResendTimer(OTP_RESEND_SECONDS);
        showNotification(response.data?.message || 'OTP resent successfully');
      } else {
        setOtpError(response.data?.message || 'Failed to resend OTP');
      }
    } catch (err) {
      setOtpError(getApiErrorMessage(err, 'Failed to resend OTP'));
    } finally {
      resendingOtpRef.current = false;
      setIsResendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (verifyingOtpRef.current) return;
    const normalizedOtp = otpCode.trim();
    if (normalizedOtp.length !== 6) return setOtpError('Enter 6 digits');
    const otpEmail = String(showOtpModal.value || formData.email).trim().toLowerCase();
    try {
      verifyingOtpRef.current = true;
      setIsVerifyingOtp(true);
      setOtpError('');
      const type = 'email';
      const endpoint = 'verify-email-otp';
      const payload = { email: otpEmail, otp: normalizedOtp };

      const response = await postPublicAuthEndpointWithOtpRetry(endpoint, payload);
      if (isOtpVerificationSuccessful(response)) {
        setFormData(prev => ({ ...prev, email: otpEmail }));
        setEmailVerified(true);
        setEmailVerificationToken(
          response.data?.emailVerificationToken ||
          response.data?.data?.emailVerificationToken ||
          response.data?.result?.emailVerificationToken ||
          ''
        );
        setShowOtpModal({ show: false, type: '', value: '' });
        setOtpCode('');
        showNotification(`${type} verified!`);
      } else {
        setOtpError(response.data?.message || 'Failed');
      }
    } catch (err) {
      setOtpError(getApiErrorMessage(err, 'Verification failed'));
    } finally {
      verifyingOtpRef.current = false;
      setIsVerifyingOtp(false);
    }
  };

  const closeOtpModal = () => {
    setShowOtpModal({ show: false, type: '', value: '' });
    setOtpCode('');
    setOtpError('');
    setOtpResendTimer(0);
    setIsResendingOtp(false);
    resendingOtpRef.current = false;
  };

  // Forgot password — open the in-screen popup (email → OTP → reset)
  const handleForgotPassword = () => {
    setShowForgotPassword(true);
  };

  const handleSendDeviceOtp = async () => {
    try {
      setIsSendingDeviceOtp(true);
      setDeviceOtp('');
      await axiosInstance.post('/api/auth/logout-other-devices', { email: formData.email, role: 'counsellor' });
      setDeviceOtpSent(true);
      setDeviceOtpResendTimer(OTP_RESEND_SECONDS);
      showNotification('OTP sent to email');
    } catch (err) {
      showNotification('Failed', 'error');
    } finally {
      setIsSendingDeviceOtp(false);
    }
  };

  const handleResendDeviceOtp = async () => {
    if (resendingDeviceOtpRef.current || deviceOtpResendTimer > 0) return;

    try {
      resendingDeviceOtpRef.current = true;
      setIsResendingDeviceOtp(true);
      setDeviceOtp('');
      await axiosInstance.post('/api/auth/logout-other-devices', { email: formData.email, role: 'counsellor' });
      setDeviceOtpResendTimer(OTP_RESEND_SECONDS);
      showNotification('OTP resent to email');
    } catch (err) {
      showNotification('Failed to resend OTP', 'error');
    } finally {
      resendingDeviceOtpRef.current = false;
      setIsResendingDeviceOtp(false);
    }
  };

  const handleVerifyDeviceOtp = async () => {
    if (deviceOtp.trim().length !== 6) {
      showNotification('Enter 6 digit OTP', 'error');
      return;
    }

    try {
      setIsVerifyingDeviceOtp(true);
      const response = await axiosInstance.post('/api/auth/verify-login-otp', {
        email: formData.email,
        otp: deviceOtp.trim(),
        logoutOthers: true,
        role: 'counsellor'
      });
      if (await persistCounselorSession(response.data)) {
        closeDeviceConflictModal();
        // Device-conflict resolution is a login → location gate, then dashboard.
        navigation.replace('LocationGate', { destination: 'CounselorDashboard' });
      }
    } catch (err) {
      showNotification('Invalid OTP', 'error');
    } finally {
      setIsVerifyingDeviceOtp(false);
    }
  };

  const closeDeviceConflictModal = () => {
    setShowDeviceConflict(false);
    setDeviceOtp('');
    setDeviceOtpSent(false);
    setDeviceOtpResendTimer(0);
    setIsResendingDeviceOtp(false);
    resendingDeviceOtpRef.current = false;
  };

  const showNotification = (message, type = 'success', duration) => {
    const displayDuration = duration ?? (type === 'error' ? 8000 : 3000);
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: '' }), displayDuration);
  };

  const handleChange = useCallback((name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'email') {
      setEmailVerified(false);
      setEmailVerificationToken('');
    }
  }, []);

  const handleDateOfBirthChange = (_event, selectedDate) => {
    if (Platform.OS === 'android') setShowDateOfBirthPicker(false);
    if (!selectedDate) return;

    const dateOfBirth = toDateOnlyString(selectedDate);
    const calculatedAge = calculateAgeFromDateOfBirth(dateOfBirth);
    setFormData(prev => ({
      ...prev,
      dateOfBirth,
      age: calculatedAge !== null ? String(calculatedAge) : '',
    }));
    setErrors(prev => {
      const next = { ...prev };
      delete next.dateOfBirth;
      delete next.age;
      return next;
    });
  };

  const toggleListItem = useCallback((name, value) => {
    setFormData(prev => {
      let list = [...prev[name]];
      if (list.includes(value)) list = list.filter(i => i !== value);
      else list.push(value);
      return { ...prev, [name]: list };
    });
  }, []);

  const renderInput = (index, name, icon, placeholder, options = {}, verifyType = null) => {
    const isFocused = focusedField === name;
    const isVerified = verifyType === 'email' && emailVerified;
    const isMultiline = options.multiline;
    const isMetricField = name === 'age' || name === 'weight';

    return (
      <Animated.View key={`counselor-input-${name}`} style={[styles.inputField, { opacity: fieldAnims[index], transform: [{ translateY: fieldAnims[index].interpolate({ inputRange: [0, 1], outputRange: [15, 0] }) }] }]}>
        <View style={[
          styles.inputWrapper,
          isMetricField && styles.metricInputWrapper,
          isFocused && styles.inputWrapperFocused,
          isMultiline && { height: 'auto', minHeight: 70, alignItems: 'flex-start', paddingTop: 10 }
        ]}>
          <Icon name={icon} size={20} color={isFocused ? '#004AC6' : '#64748b'} style={[styles.inputIcon, isMultiline && { marginTop: 4 }]} />
          <TextInput
            style={[styles.textInput, isMetricField && styles.metricTextInput, isMultiline && { height: 'auto', minHeight: 50, textAlignVertical: 'top' }]}
            value={formData[name]}
            onChangeText={(text) => handleChange(name, text)}
            onFocus={(event) => {
              setFocusedField(name);
              scrollFocusedInputIntoView(event);
            }}
            onBlur={() => setFocusedField(null)}
            placeholder={placeholder}
            placeholderTextColor="#94a3b8"
            {...options}
          />
          {verifyType && !isLogin && (
            <TouchableOpacity onPress={handleSendVerifyOtp} disabled={isVerified || isSendingVerification} style={[styles.verifyBtn, (isVerified || isSendingVerification) && styles.verifiedBtn]}>
              {isVerified ? <Icon name="check-decagram" size={18} color="#004AC6" /> : isSendingVerification ? <ActivityIndicator size="small" color="#004AC6" /> : <Text style={styles.verifyBtnText}>{t('Verify')}</Text>}
            </TouchableOpacity>
          )}
        </View>
        {errors[name] && <Text style={styles.errorText}>{errors[name]}</Text>}
      </Animated.View>
    );
  };

  const renderPhoneInput = (index) => {
    const name = 'phoneNumber';
    const isFocused = focusedField === name;

    return (
      <Animated.View key="counselor-input-phoneNumber" style={[styles.inputField, { opacity: fieldAnims[index], transform: [{ translateY: fieldAnims[index].interpolate({ inputRange: [0, 1], outputRange: [15, 0] }) }] }]}>
        <CountryPhoneInput
          value={formData.phoneNumber}
          countryCode={formData.phoneCountryCode}
          onChangePhoneNumber={(text) => handleChange(name, text)}
          onChangeCountryCode={(code) => handleChange('phoneCountryCode', code)}
          focused={isFocused}
          accentColor="#004AC6"
          containerStyle={styles.phoneInputWrapper}
          inputStyle={styles.phoneTextInput}
          onFocus={(event) => {
            setFocusedField(name);
            scrollFocusedInputIntoView(event);
          }}
          onBlur={() => setFocusedField(null)}
        />
        {errors[name] && <Text style={styles.errorText}>{errors[name]}</Text>}
      </Animated.View>
    );
  };

  const renderDateOfBirthInput = (index) => (
    <Animated.View key="counselor-input-dateOfBirth" style={[styles.inputField, { opacity: fieldAnims[index], transform: [{ translateY: fieldAnims[index].interpolate({ inputRange: [0, 1], outputRange: [15, 0] }) }] }]}>
      <TouchableOpacity
        style={styles.inputWrapper}
        onPress={() => setShowDateOfBirthPicker(true)}
        activeOpacity={0.85}
      >
        <Icon name="calendar-month-outline" size={20} color="#64748b" style={styles.inputIcon} />
        <Text
          style={[
            styles.datePickerText,
            !formData.dateOfBirth && styles.datePickerPlaceholder,
          ]}
        >
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

  const scrollContainerStyle = {
    ...styles.scrollContent,
    justifyContent: isLogin ? 'center' : 'flex-start',
    paddingHorizontal: isCompact ? 12 : 16,
    paddingTop: isLogin ? (isCompact ? 72 : 88) : (isCompact ? 62 : 76),
    paddingBottom: (isLogin ? (isCompact ? 44 : 60) : (isCompact ? 14 : 20)) + keyboardInset,
  };
  const signupPanelHeight = Math.min(
    isTablet ? 760 : 720,
    Math.max(360, height - (isCompact ? 78 : 96))
  );
  const signupPanelPaddingY = isCompact ? 18 : 22;
  const signupLogoSize = isCompact ? 64 : 80;
  const signupHeaderHeight = signupLogoSize + (isCompact ? 68 : 74);
  const signupFormHeight = Math.max(
    260,
    signupPanelHeight - (signupPanelPaddingY * 2) - signupHeaderHeight
  );
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
  const formScrollStyle = [
    styles.formScroll,
    !isLogin && styles.signupFormScroll,
    !isLogin && { height: signupFormHeight },
  ];
  const formContentStyle = [
    styles.formPanel,
    !isLogin && styles.signupFormPanel,
    !isLogin && { paddingBottom: (isCompact ? 18 : 24) + keyboardInset },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      {/* Blue mesh backdrop (doctor palette) — scales to phone/tablet */}
      <AuthBackground role="counselor" style={styles.gradient}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.flex}>
            <TouchableOpacity style={styles.backBtn} onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.replace('RoleSelector'))}><Icon name="chevron-left" size={28} color="#0F172A" /></TouchableOpacity>
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
                  <View style={styles.brandContainer}><Text style={[styles.brandMain, { color: '#004AC6' }]}>{t('Humaeli')}</Text></View>
                  <Text style={styles.tagline}>{'Join our expert team'}</Text>
                </View>
                {/* {!isLogin && (
                  <Animated.View key="photo-section" style={[styles.photoSection, { opacity: fieldAnims[0] }]}>
                    <TouchableOpacity onPress={handleSelectImage} style={styles.photoCircle}>
                      {formData.profilePhoto ? (
                        <Image source={{ uri: formData.profilePhoto.uri }} style={styles.photo} />
                      ) : (
                        <Icon name="camera-plus-outline" size={30} color="#004AC6" />
                      )}
                    </TouchableOpacity>
                    <Text style={styles.photoLabel}>{t('Consultant Photo')}</Text>
                  </Animated.View>
                )} */}
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
                    <>{renderInput(1, 'fullName', 'account-outline', 'Full Name')}{renderInput(2, 'email', 'email-outline', 'Email Address', { keyboardType: 'email-address', autoCapitalize: 'none' }, 'email')}{renderPhoneInput(3)}{renderDateOfBirthInput(4)}{renderInput(5, 'age', 'calendar-account-outline', 'Age', { editable: false, placeholder: 'Age will be calculated' })}
                      <Animated.View key="gender-section" style={{ opacity: fieldAnims[6] }}><Text style={styles.sectionLabel}>{t('Gender')}</Text><View style={styles.genderRow}>{genderOptions.map(g => (<TouchableOpacity key={g} style={[styles.genderBtn, formData.gender === g && styles.genderBtnSelected]} onPress={() => handleChange('gender', g)}><Text style={[styles.genderText, formData.gender === g && styles.genderTextSelected]}>{g}</Text></TouchableOpacity>))}</View></Animated.View>
                      {renderInput(7, 'qualification', 'school-outline', 'Qualification')}{renderInput(8, 'specialization', 'certificate-outline', 'Specialization')}
                      <View style={styles.row}><View style={{ flex: 1 }}>{renderInput(9, 'experience', 'briefcase-clock-outline', 'Years')}</View><View style={{ flex: 1.5 }}>{renderInput(10, 'location', 'map-marker-radius-outline', 'City')}</View></View>
                      <Animated.View key="mode-section" style={{ opacity: fieldAnims[11] }}><Text style={styles.sectionLabel}>{t('Consultation Mode')}</Text><View style={styles.tagRow}>{consultationModes.map(m => (<TouchableOpacity key={m} style={[styles.tag, formData.consultationMode.includes(m) && styles.tagSelected]} onPress={() => toggleListItem('consultationMode', m)}><Text style={[styles.tagText, formData.consultationMode.includes(m) && styles.tagTextSelected]}>{m}</Text></TouchableOpacity>))}</View></Animated.View>
                      <Animated.View key="lang-section" style={{ opacity: fieldAnims[12] }}><Text style={styles.sectionLabel}>{t('Languages')}</Text><View style={styles.tagRow}>{languageOptions.map(l => (<TouchableOpacity key={l} style={[styles.tag, formData.languages.includes(l) && styles.tagSelected]} onPress={() => toggleListItem('languages', l)}><Text style={[styles.tagText, formData.languages.includes(l) && styles.tagTextSelected]}>{l}</Text></TouchableOpacity>))}</View></Animated.View>
                      {renderInput(13, 'aboutMe', 'account-details-outline', 'About Me', { multiline: true })}
                    </>
                  ) : (<>{renderInput(1, 'email', 'email-outline', 'Email Address', { keyboardType: 'email-address', autoCapitalize: 'none' })}</>)}
                  <Animated.View key="pwd-section" style={{ opacity: fieldAnims[14] }}>
                    <View style={[styles.inputWrapper, focusedField === 'password' && styles.inputWrapperFocused]}>
                      <Icon name="lock-outline" size={20} color={focusedField === 'password' ? '#004AC6' : '#64748b'} style={styles.inputIcon} /><TextInput style={styles.textInput} value={formData.password} onChangeText={(text) => handleChange('password', text)} onFocus={(event) => { setFocusedField('password'); scrollFocusedInputIntoView(event); }} onBlur={() => setFocusedField(null)} placeholder={t('Password')} placeholderTextColor="#94a3b8" secureTextEntry={!showPassword} /><TouchableOpacity onPress={() => setShowPassword(!showPassword)}><Icon name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#64748b" /></TouchableOpacity>
                    </View>
                  </Animated.View>
                  {isLogin && (<TouchableOpacity onPress={handleForgotPassword} style={styles.forgotLink}><Text style={[styles.forgotText, { color: '#004AC6' }]}>{t('Forgot password?')}</Text></TouchableOpacity>)}
                  {!isLogin && (<Animated.View key="cpwd-section" style={{ opacity: fieldAnims[15] }}><View style={[styles.inputWrapper, focusedField === 'confirmPassword' && styles.inputWrapperFocused]}><Icon name="lock-check-outline" size={20} color={focusedField === 'confirmPassword' ? '#004AC6' : '#64748b'} style={styles.inputIcon} /><TextInput style={styles.textInput} value={formData.confirmPassword} onChangeText={(text) => handleChange('confirmPassword', text)} onFocus={(event) => { setFocusedField('confirmPassword'); scrollFocusedInputIntoView(event); }} onBlur={() => setFocusedField(null)} placeholder={t('Confirm Password')} placeholderTextColor="#94a3b8" secureTextEntry={!showConfirmPassword} /><TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}><Icon name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#64748b" /></TouchableOpacity></View></Animated.View>)}
                  <Animated.View key="btn-section" style={{ opacity: fieldAnims[16], marginTop: 10 }}>
                    <TouchableOpacity activeOpacity={0.9} onPress={isLogin ? handleLogin : handleSignup} disabled={isLoading}>
                      <LinearGradient
                        colors={['#003A9B', '#1490FF']}
                        start={{ x: 0, y: 0.5 }}
                        end={{ x: 1, y: 0.5 }}
                        style={styles.submitBtn}
                      >
                        {isLoading ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text style={styles.submitBtnText}>{isLogin ? 'Login' : 'Create Account'}</Text>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  </Animated.View>
                  <Animated.View key="google-section" style={{ opacity: fieldAnims[16], marginTop: 14 }}>
                    <View style={styles.googleDividerRow}>
                      <View style={styles.googleDividerLine} />
                      <Text style={styles.googleDividerText}>or</Text>
                      <View style={styles.googleDividerLine} />
                    </View>
                    <GoogleAuthButton
                      role="counselor"
                      mode={isLogin ? 'signin' : 'signup'}
                      disabled={isLoading}
                      locationEvent={isLogin ? 'login' : 'signup'}
                      onSuccess={({ isCounselor }) => {
                        sendLocationSilently(isLogin ? 'login' : 'signup');
                        setTimeout(() => {
                          navigation.replace(
                            isCounselor ? 'CounselorDashboard' : 'UserDashboard',
                          );
                        }, 600);
                      }}
                      onError={(msg) => {
                        console.warn('[Google sign-in]', msg);
                        showNotification(msg || 'Google sign-in failed', 'error');
                      }}
                    />
                  </Animated.View>
                  <Animated.View key="sw-section" style={[styles.switchRow, { opacity: fieldAnims[17] }]}><Text style={styles.switchText}>{isLogin ? "New consultant?" : "Already a member?"}</Text><TouchableOpacity onPress={() => setIsLogin(!isLogin)}><Text style={[styles.switchLink, { color: '#004AC6' }]}>{isLogin ? " Sign Up" : " Login"}</Text></TouchableOpacity></Animated.View>
                </ScrollView>
              </Animated.View>
            </ScrollView>
          </View>
        </SafeAreaView>
        {/* OTP Modal */}
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
              <View style={[styles.modalIcon, { backgroundColor: '#f0fdf4' }]}><Icon name="email-fast-outline" size={40} color="#004AC6" /></View>
              <Text style={styles.modalTitle}>Verify Your Email</Text>
              <Text style={styles.modalSub}>Enter code sent to {showOtpModal.value}</Text>
              <TextInput key={`${showOtpModal.type}:${showOtpModal.value}:${showOtpModal.show ? 'open' : 'closed'}`} style={styles.otpInput} value={otpCode} onChangeText={(value) => setOtpCode(value.replace(/\D/g, ''))} placeholder={t('000000')} placeholderTextColor="#94a3b8" keyboardType="number-pad" maxLength={6} autoFocus />
              <View style={styles.otpResendRow}>
                {otpResendTimer > 0 ? (
                  <Text style={styles.otpTimerText}>
                    {t('Resend OTP in')} {formatOtpTimer(otpResendTimer)}
                  </Text>
                ) : (
                  <Text style={styles.otpTimerText}>{t("Didn't receive code?")}</Text>
                )}
                <TouchableOpacity
                  onPress={handleResendVerifyOtp}
                  disabled={otpResendTimer > 0 || isResendingOtp}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text
                    style={[
                      styles.otpResendText,
                      (otpResendTimer > 0 || isResendingOtp) && styles.otpResendTextDisabled,
                    ]}
                  >
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
                {isVerifyingOtp ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalActionText}>{t('Verify Consultant')}</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={closeOtpModal} style={styles.cancelBtn}><Text style={styles.cancelText}>{t('Cancel')}</Text></TouchableOpacity>
            </View>
          </View>
        </Modal>
        {/* Device Conflict */}
        <Modal
          visible={showDeviceConflict}
          transparent
          animationType="fade"
          presentationStyle="overFullScreen"
          statusBarTranslucent
          navigationBarTranslucent
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { borderTopWidth: 4, borderColor: '#004AC6' }]}>
              <View style={[styles.modalIcon, { backgroundColor: '#f0fdf4' }]}>
                <Icon name="devices" size={40} color="#004AC6" />
              </View>
              <Text style={styles.modalTitle}>{t('Switching Devices')}</Text>
              <Text style={styles.modalSub}>{t('Consultant account active on another device. Logout there and continue here?')}</Text>
              {!deviceOtpSent ? (
                <TouchableOpacity
                  style={[styles.modalActionBtn, isSendingDeviceOtp && styles.modalActionBtnDisabled]}
                  onPress={handleSendDeviceOtp}
                  disabled={isSendingDeviceOtp}
                >
                  {isSendingDeviceOtp ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalActionText}>{t('Log out other device')}</Text>}
                </TouchableOpacity>
              ) : (
                <View style={styles.otpWrapper}>
                  <TextInput
                    style={styles.otpInput}
                    value={deviceOtp}
                    onChangeText={(value) => setDeviceOtp(value.replace(/\D/g, '').slice(0, 6))}
                    placeholder={t('Enter OTP')}
                    placeholderTextColor="#94a3b8"
                    keyboardType="number-pad"
                    maxLength={6}
                    autoFocus
                  />
                  <View style={styles.otpResendRow}>
                    {deviceOtpResendTimer > 0 ? (
                      <Text style={styles.otpTimerText}>
                        {t('Resend OTP in')} {formatOtpTimer(deviceOtpResendTimer)}
                      </Text>
                    ) : (
                      <Text style={styles.otpTimerText}>{t("Didn't receive code?")}</Text>
                    )}
                    <TouchableOpacity
                      onPress={handleResendDeviceOtp}
                      disabled={deviceOtpResendTimer > 0 || isResendingDeviceOtp}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text
                        style={[
                          styles.otpResendText,
                          (deviceOtpResendTimer > 0 || isResendingDeviceOtp) && styles.otpResendTextDisabled,
                        ]}
                      >
                        {isResendingDeviceOtp ? t('Sending...') : t('Resend OTP')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity
                    style={[styles.modalActionBtn, isVerifyingDeviceOtp && styles.modalActionBtnDisabled]}
                    onPress={handleVerifyDeviceOtp}
                    disabled={isVerifyingDeviceOtp}
                  >
                    {isVerifyingDeviceOtp ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalActionText}>{t('Verify & Takeover')}</Text>}
                  </TouchableOpacity>
                </View>
              )}
              <TouchableOpacity onPress={closeDeviceConflictModal} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>{t('Cancel')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
        {notification.show && (<Animated.View style={[styles.notification, { backgroundColor: notification.type === 'error' ? '#ef4444' : notification.type === 'info' ? '#004AC6' : '#004AC6' }]}><Icon name={notification.type === 'error' ? 'alert-circle' : 'check-circle'} size={20} color="#fff" /><Text style={styles.notificationText}>{notification.message}</Text></Animated.View>)}

        {/* Forgot Password popup (counselor side) */}
        <ForgotPasswordModal
          visible={showForgotPassword}
          onClose={() => setShowForgotPassword(false)}
          accentColor="#004AC6"
          initialEmail={formData.email}
        />
      </AuthBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  gradient: { flex: 1, overflow: 'hidden' },
  lavaOrb: { position: 'absolute', width: 400, height: 400, borderRadius: 150, opacity: 0.35 },
  orb1: { top: -100, left: -50, backgroundColor: '#004AC6' },
  orb2: { bottom: -50, right: -100, backgroundColor: '#004AC6' },
  safeArea: { flex: 1 },
  scrollContent: { padding: 24, paddingTop: 100, paddingBottom: 60, flexGrow: 1 },
  backBtn: { position: 'absolute', top: 30, left: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  panel: { backgroundColor: 'rgba(255, 255, 255, 0.96)', borderRadius: 40, padding: 28, width: '100%', maxWidth: 440, alignSelf: 'center', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 30, elevation: 15 },
  header: { alignItems: 'center', marginBottom: 14 },
  logo: { width: 80, height: 80 },
  brandContainer: { flexDirection: 'row', marginTop: 4 },
  brandMain: { fontSize: 26, fontWeight: '900', color: '#1e293b' },
  brandAlt: { fontSize: 26, fontWeight: '400' },
  tagline: { fontSize: 13, color: '#64748b', fontWeight: '600', marginTop: 4 },
  photoSection: { alignItems: 'center', marginBottom: 20 },
  photoCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#f0fdf4', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#004AC6', overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  photoLabel: { fontSize: 12, fontWeight: '700', color: '#004AC6', marginTop: 8 },
  formScroll: { width: '100%' },
  signupFormScroll: { flexShrink: 0 },
  formPanel: { gap: 10 },
  signupFormPanel: { paddingBottom: 18 },
  inputField: { width: '100%' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 18, paddingHorizontal: 16, height: 58, borderWidth: 1.5, borderColor: '#f1f5f9' },
  metricInputWrapper: { height: 66, borderRadius: 20, paddingHorizontal: 20 },
  phoneInputWrapper: { height: 58, paddingHorizontal: 16 },
  inputWrapperFocused: { borderColor: '#004AC6', backgroundColor: '#ffffff' },
  inputIcon: { marginRight: 8 },
  textInput: { flex: 1, color: '#1e293b', fontSize: 15, fontWeight: '600' },
  metricTextInput: { fontSize: 18, fontWeight: '800' },
  phoneTextInput: { fontSize: 15 },
  datePickerText: { flex: 1, color: '#1e293b', fontSize: 15, fontWeight: '600' },
  datePickerPlaceholder: { color: '#94a3b8' },
  verifyBtn: { minWidth: 68, minHeight: 34, backgroundColor: '#004AC6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  verifiedBtn: { backgroundColor: 'transparent' },
  verifyBtnText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  errorText: { color: '#ef4444', fontSize: 11, marginTop: 4, marginLeft: 16, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 12 },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  tag: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: 'transparent' },
  tagSelected: { backgroundColor: '#f0fdf4', borderColor: '#004AC6' },
  tagText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  tagTextSelected: { color: '#004AC6' },
  googleDividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  googleDividerLine: { flex: 1, height: 1, backgroundColor: '#e5e7eb' },
  googleDividerText: {
    marginHorizontal: 12,
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '600',
  },
  forgotLink: { alignSelf: 'flex-end', marginTop: -8, marginBottom: 8 },
  forgotText: { fontSize: 12, fontWeight: '700' },
  submitBtn: { height: 60, borderRadius: 20, justifyContent: 'center', alignItems: 'center', shadowColor: '#004AC6', shadowOpacity: 0.3, shadowRadius: 10, elevation: 8 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 10 },
  switchText: { fontSize: 14, color: '#64748b', fontWeight: '500' },
  switchLink: { fontSize: 14, fontWeight: '800' },
  genderRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  genderBtn: { flex: 1, height: 44, borderRadius: 15, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  genderBtnSelected: { backgroundColor: '#f0fdf4', borderColor: '#004AC6' },
  genderText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  genderTextSelected: { color: '#004AC6' },
  modalOverlay: { flex: 1, width: '100%', minHeight: '100%', backgroundColor: 'rgba(15,23,42,0.64)', justifyContent: 'center', alignItems: 'center', padding: 22 },
  modalContent: { backgroundColor: '#fff', borderRadius: 26, padding: 28, width: '100%', maxWidth: 390, alignItems: 'center', borderWidth: 1, borderColor: '#DBEAFE', shadowColor: '#0B2F6B', shadowOpacity: 0.18, shadowRadius: 24, elevation: 14 },
  modalIcon: { width: 68, height: 68, borderRadius: 34, justifyContent: 'center', alignItems: 'center', marginBottom: 18 },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#0F172A', marginBottom: 8, textAlign: 'center' },
  modalSub: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 21, marginBottom: 22 },
  modalActionBtn: { width: '100%', height: 54, borderRadius: 16, backgroundColor: '#004AC6', justifyContent: 'center', alignItems: 'center', shadowColor: '#004AC6', shadowOpacity: 0.22, shadowRadius: 10, elevation: 5 },
  modalActionBtnDisabled: { backgroundColor: '#94A3B8', shadowOpacity: 0, elevation: 0 },
  modalActionText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  modalErrorText: { width: '100%', color: '#B91C1C', backgroundColor: '#FEF2F2', fontSize: 12, fontWeight: '700', textAlign: 'center', padding: 10, borderRadius: 10, marginTop: -6, marginBottom: 14 },
  cancelBtn: { width: '100%', height: 44, marginTop: 10, justifyContent: 'center', alignItems: 'center' },
  cancelText: { fontSize: 14, fontWeight: '700', color: '#64748B' },
  otpWrapper: { width: '100%', gap: 16 },
  otpInput: { width: '100%', height: 56, borderRadius: 16, backgroundColor: '#F8FAFC', borderWidth: 1.5, borderColor: '#BFD7FF', textAlign: 'center', fontSize: 22, letterSpacing: 8, fontWeight: '800', color: '#0F172A', marginBottom: 16 },
  otpResendRow: { width: '100%', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: -6, marginBottom: 16, flexWrap: 'wrap' },
  otpTimerText: { color: '#64748B', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  otpResendText: { color: '#004AC6', fontSize: 13, fontWeight: '900' },
  otpResendTextDisabled: { color: '#94A3B8' },
  notification: { position: 'absolute', top: 50, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 15, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 10, zIndex: 1000 },
  notificationText: { color: '#fff', fontSize: 14, fontWeight: '700', marginLeft: 8 },
});

export default CounselorSignup;
