// DoctorSignup — Login / Create Account for the new Doctor role.
//
// IMPORTANT: There is no Doctor backend yet. Every "auth" action below is a
// local mock — clearly isolated in the MOCK AUTH section — so it can be
// swapped for real `axiosInstance` calls (mirroring CounselorSignup.jsx) the
// moment `/api/auth/*` supports the doctor role. Nothing here talks to the
// network or writes a real session token.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
  Image,
  StatusBar,
  useWindowDimensions,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
import MockGoogleAuthButton from './components/MockGoogleAuthButton';

const genderOptions = ['Male', 'Female', 'Other'];
const consultationModes = ['Online', 'Offline', 'Both'];
const languageOptions = ['Hindi', 'English', 'Gujarati', 'Marathi', 'Tamil', 'Telugu', 'Bengali', 'Punjabi'];

// ─────────────────────────── MOCK AUTH (frontend-only) ───────────────────────────
// Replace with real endpoints once the Doctor backend exists, e.g.
//   axiosInstance.post('/api/auth/login', { ...values, role: 'doctor' })
//   axiosInstance.post('/api/auth/doctor/complete-registration', payload)
const MOCK_NETWORK_DELAY_MS = 900;

const mockDoctorLogin = (email, password) =>
  new Promise((resolve, reject) => {
    setTimeout(() => {
      if (!email || !password) {
        reject(new Error('Enter your email and password'));
        return;
      }
      resolve({
        mock: true,
        doctor: { fullName: 'Dr. ' + email.split('@')[0], email },
      });
    }, MOCK_NETWORK_DELAY_MS);
  });

const mockDoctorSignup = (doctorProfile) =>
  new Promise((resolve) => {
    setTimeout(() => resolve({ mock: true, doctor: doctorProfile }), MOCK_NETWORK_DELAY_MS);
  });

// Stands in for a real Google OAuth exchange (see MockGoogleAuthButton.jsx
// for why). Produces a plausible doctor profile so the rest of the flow
// (onboarding merge, dashboard greeting) has something real to render.
const mockGoogleDoctorAuth = () =>
  new Promise((resolve) => {
    setTimeout(() => {
      const stamp = Date.now().toString().slice(-5);
      resolve({
        mock: true,
        doctor: {
          fullName: 'Dr. Google User',
          email: `doctor.google.${stamp}@gmail.com`,
        },
      });
    }, MOCK_NETWORK_DELAY_MS);
  });

const persistMockDoctorSession = async (doctorProfile) => {
  // Namespaced under `doctorMock*` (not `userRole`/`accessToken`) so this can
  // never be mistaken for a real session by the User/Consultant auth code.
  await AsyncStorage.setItem('doctorMockProfile', JSON.stringify(doctorProfile));
  await AsyncStorage.setItem('doctorMockSession', 'true');
};
// ───────────────────────────────────────────────────────────────────────────────

const DoctorSignup = ({ navigation, route }) => {
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
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [notification, setNotification] = useState({ show: false, message: '', type: '' });
  const [showDateOfBirthPicker, setShowDateOfBirthPicker] = useState(false);

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
    try {
      setIsLoading(true);
      const result = await mockDoctorLogin(formData.email, formData.password);
      await persistMockDoctorSession(result.doctor);
      showNotification(t('Welcome back, Doctor!'));
      setTimeout(() => navigation.replace('DoctorDashboard'), 900);
    } catch (err) {
      showNotification(err?.message || t('Login failed'), 'error');
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
      const doctorProfile = {
        fullName: formData.fullName.trim(),
        email: formData.email.trim().toLowerCase(),
        phoneNumber,
        phoneCountryCode: formData.phoneCountryCode,
        dateOfBirth,
        age: calculateAgeFromDateOfBirth(dateOfBirth),
        gender: formData.gender.toLowerCase(),
        qualification: formData.qualification.trim(),
        specialization: formData.specialization.trim(),
        experience: formData.experience,
        location: formData.location.trim(),
        consultationMode: formData.consultationMode.map((m) => m.toLowerCase()),
        languages: formData.languages,
        aboutMe: formData.aboutMe.trim(),
        role: 'doctor',
      };

      const response = await mockDoctorSignup(doctorProfile);
      // Persist the account-level profile now; DoctorOnboarding (next) fills
      // in credentialing/practice details and merges them into this same
      // mock session before handing off to DoctorProfile.
      await persistMockDoctorSession(response.doctor);
      showNotification(t('Account created! Let’s finish your professional profile.'));
      setTimeout(() => navigation.replace('DoctorOnboarding', {
        destination: 'DoctorProfile',
        doctorProfileBase: response.doctor,
      }), 1000);
    } catch (error) {
      showNotification(t('Signup failed'), 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleMockAuth = async () => {
    try {
      setIsGoogleLoading(true);
      const result = await mockGoogleDoctorAuth();
      await persistMockDoctorSession(result.doctor);
      if (isLogin) {
        showNotification(t('Welcome back, Doctor!'));
        setTimeout(() => navigation.replace('DoctorDashboard'), 700);
      } else {
        showNotification(t('Account created with Google (mock)!'));
        setTimeout(() => navigation.replace('DoctorOnboarding', {
          destination: 'DoctorProfile',
          doctorProfileBase: result.doctor,
        }), 900);
      }
    } catch (error) {
      showNotification(t('Google sign-in failed'), 'error');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const renderInput = (index, name, icon, placeholder, options = {}) => {
    const isFocused = focusedField === name;
    const isMultiline = options.multiline;
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

  const scrollContainerStyle = {
    ...styles.scrollContent,
    justifyContent: isLogin ? 'center' : 'flex-start',
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
                      {renderInput(2, 'email', 'email-outline', t('Email Address'), { keyboardType: 'email-address', autoCapitalize: 'none' })}
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
                        onFocus={(event) => { setFocusedField('password'); scrollFocusedInputIntoView(event); }}
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
                    <TouchableOpacity activeOpacity={0.9} onPress={isLogin ? handleLogin : handleSignup} disabled={isLoading}>
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
                    <MockGoogleAuthButton
                      mode={isLogin ? 'signin' : 'signup'}
                      disabled={isLoading}
                      loading={isGoogleLoading}
                      onPress={handleGoogleMockAuth}
                    />
                  </Animated.View>

                  <Animated.View key="sw-section" style={[styles.switchRow, { opacity: fieldAnims[17] }]}>
                    <Text style={styles.switchText}>{isLogin ? t("Don't have an account?") : t('Already a member?')}</Text>
                    <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
                      <Text style={[styles.switchLink, { color: CLINICIAN.primary }]}>{isLogin ? t(' Create Account') : t(' Login')}</Text>
                    </TouchableOpacity>
                  </Animated.View>
                </ScrollView>
              </Animated.View>
            </ScrollView>
          </View>
        </SafeAreaView>

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

const styles = StyleSheet.create({
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
});

export default DoctorSignup;
