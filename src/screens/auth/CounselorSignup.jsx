import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ActivityIndicator,
  Image,
  SafeAreaView,
  StatusBar,
  useWindowDimensions,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL } from '../../axiosConfig';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary } from 'react-native-image-picker';

// Import logo
import logo from '../../image/Mediconect Logo-3.png';

const CounselorSignup = ({ navigation, route }) => {
  const { width } = useWindowDimensions();
  const [isLogin, setIsLogin] = useState(true);
  const [focusedField, setFocusedField] = useState(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
    phoneNumber: '',
    age: '',
    gender: '',
    qualification: '',
    specialization: '',
    experience: '',
    location: '',
    consultationMode: [],
    languages: [],
    aboutMe: '',
    profilePhoto: null,
    confirmPassword: '',
  });

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
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

  // Verification states
  const [emailVerified, setEmailVerified] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState({ show: false, type: '', value: '' });
  const [otpCode, setOtpCode] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [otpError, setOtpError] = useState('');

  // Device Conflict States
  const [showDeviceConflict, setShowDeviceConflict] = useState(false);
  const [deviceOtp, setDeviceOtp] = useState('');
  const [deviceOtpSent, setDeviceOtpSent] = useState(false);
  const [isSendingDeviceOtp, setIsSendingDeviceOtp] = useState(false);
  const [isVerifyingDeviceOtp, setIsVerifyingDeviceOtp] = useState(false);

  const consultationModes = ['Online', 'Offline', 'Both'];
  const languageOptions = ['Hindi', 'English', 'Gujarati', 'Marathi', 'Tamil', 'Telugu', 'Bengali', 'Punjabi'];
  const genderOptions = ['Male', 'Female', 'Other'];

  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    fieldAnims.forEach(anim => anim.setValue(0));

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 20, friction: 7, useNativeDriver: true }),
      Animated.stagger(40, fieldAnims.map(anim =>
        Animated.spring(anim, { toValue: 1, tension: 25, friction: 8, useNativeDriver: true })
      ))
    ]).start();
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
    return true;
  };

  const validateSignup = () => {
    const newErrors = {};
    if (!formData.fullName) newErrors.fullName = "Full name is required";
    if (!formData.email) newErrors.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = "Email is invalid";
    else if (!emailVerified) newErrors.email = "Please verify your email first";

    if (!formData.phoneNumber) newErrors.phoneNumber = "Phone is required";
    else if (!/^\d{10}$/.test(formData.phoneNumber)) newErrors.phoneNumber = "Must be 10 digits";
    else if (!phoneVerified) newErrors.phoneNumber = "Please verify your phone first";

    if (!formData.age) newErrors.age = "Age is required";
    else if (formData.age < 18 || formData.age > 100) newErrors.age = "Must be 18-100";

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
      const response = await axios.post(`${API_BASE_URL}/api/auth/login`, {
        email: formData.email,
        password: formData.password,
        role: 'counsellor',
      });
      if (await persistCounselorSession(response.data)) {
        showNotification('Login successful!');
        setTimeout(() => navigation.replace('CounselorDashboard'), 1000);
      }
    } catch (err) {
      if (err?.response?.status === 409) {
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
      
      // Use FormData for file upload support
      const data = new FormData();
      data.append('fullName', formData.fullName.trim());
      data.append('email', formData.email.trim());
      data.append('phoneNumber', formData.phoneNumber.trim());
      data.append('age', formData.age);
      data.append('gender', formData.gender.toLowerCase());
      data.append('qualification', formData.qualification.trim());
      data.append('specialization', formData.specialization.trim());
      data.append('experience', formData.experience);
      data.append('location', formData.location.trim());
      data.append('aboutMe', formData.aboutMe.trim());
      data.append('password', formData.password);
      data.append('role', "counselor");
      
      formData.consultationMode.forEach(mode => data.append('consultationMode[]', mode.toLowerCase()));
      formData.languages.forEach(lang => data.append('languages[]', lang));

      if (formData.profilePhoto) {
        data.append('profilePhoto', {
          uri: formData.profilePhoto.uri,
          type: formData.profilePhoto.type || 'image/jpeg',
          name: formData.profilePhoto.fileName || 'profile.jpg',
        });
      }

      const response = await axios.post(`${API_BASE_URL}/api/auth/complete-registration`, data, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (response.data.success && await persistCounselorSession(response.data)) {
        showNotification('Counselor registered!');
        setTimeout(() => navigation.replace('CounselorDashboard'), 1500);
      }
    } catch (error) {
      showNotification(error.response?.data?.message || 'Signup failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectImage = () => {
    const options = {
      mediaType: 'photo',
      includeBase64: false,
      maxHeight: 1000,
      maxWidth: 1000,
    };

    launchImageLibrary(options, (response) => {
      if (response.didCancel) return;
      if (response.errorCode) {
        showNotification('Image picker error', 'error');
        return;
      }
      if (response.assets && response.assets.length > 0) {
        setFormData(prev => ({ ...prev, profilePhoto: response.assets[0] }));
      }
    });
  };

  const handleSendVerifyOtp = async (type) => {
    const value = type === 'email' ? formData.email : formData.phoneNumber;
    if (!value) return showNotification(`Enter ${type} first`, 'error');
    try {
      setIsLoading(true);
      const endpoint = type === 'email' ? 'send-email-otp' : 'send-phone-otp';
      const payload = type === 'email' ? { email: value } : { phoneNumber: value, email: formData.email };
      const response = await axios.post(`${API_BASE_URL}/api/auth/${endpoint}`, payload);
      if (response.data.success) {
        setShowOtpModal({ show: true, type, value });
        showNotification(`OTP sent to ${type}`);
      }
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed to send OTP', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) return setOtpError('Enter 6 digits');
    try {
      setIsVerifyingOtp(true);
      const type = showOtpModal.type;
      const endpoint = type === 'email' ? 'verify-email-otp' : 'verify-phone-otp';
      const payload = type === 'email'
        ? { email: formData.email, otp: otpCode }
        : { phoneNumber: formData.phoneNumber, otp: otpCode, email: formData.email };

      const response = await axios.post(`${API_BASE_URL}/api/auth/${endpoint}`, payload);
      if (response.data.success) {
        if (type === 'email') setEmailVerified(true);
        else setPhoneVerified(true);
        setShowOtpModal({ show: false, type: '', value: '' });
        setOtpCode('');
        showNotification(`${type} verified!`);
      }
    } catch (err) {
      setOtpError(err.response?.data?.message || 'Failed');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!formData.email) return showNotification('Enter email', 'error');
    try {
      setIsLoading(true);
      await axios.post(`${API_BASE_URL}/api/auth/forgot-password`, { email: formData.email });
      showNotification('Reset link sent to email');
    } catch (err) {
      showNotification(err.response?.data?.message || 'Failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendDeviceOtp = async () => {
    try {
      setIsSendingDeviceOtp(true);
      await axios.post(`${API_BASE_URL}/api/auth/logout-other-devices`, { email: formData.email, role: 'counsellor' });
      setDeviceOtpSent(true);
      showNotification('OTP sent to email');
    } catch (err) {
      showNotification('Failed', 'error');
    } finally {
      setIsSendingDeviceOtp(false);
    }
  };

  const handleVerifyDeviceOtp = async () => {
    try {
      setIsVerifyingDeviceOtp(true);
      const response = await axios.post(`${API_BASE_URL}/api/auth/verify-login-otp`, {
        email: formData.email,
        otp: deviceOtp,
        logoutOthers: true,
        role: 'counsellor'
      });
      if (await persistCounselorSession(response.data)) {
        setShowDeviceConflict(false);
        navigation.replace('CounselorDashboard');
      }
    } catch (err) {
      showNotification('Invalid OTP', 'error');
    } finally {
      setIsVerifyingDeviceOtp(false);
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => setNotification({ show: false, message: '', type: '' }), 3000);
  };

  const handleChange = useCallback((name, value) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    if (name === 'email') setEmailVerified(false);
    if (name === 'phoneNumber') setPhoneVerified(false);
  }, []);

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
    const isVerified = (verifyType === 'email' && emailVerified) || (verifyType === 'phone' && phoneVerified);
    const isMultiline = options.multiline;

    return (
      <Animated.View key={`counselor-input-${name}`} style={[styles.inputField, { opacity: fieldAnims[index], transform: [{ translateY: fieldAnims[index].interpolate({ inputRange: [0, 1], outputRange: [15, 0] }) }] }]}>
        <View style={[
          styles.inputWrapper,
          isFocused && styles.inputWrapperFocused,
          isMultiline && { height: 'auto', minHeight: 70, alignItems: 'flex-start', paddingTop: 10 }
        ]}>
          <Icon name={icon} size={20} color={isFocused ? '#10b981' : '#64748b'} style={[styles.inputIcon, isMultiline && { marginTop: 4 }]} />
          <TextInput
            style={[styles.textInput, isMultiline && { height: 'auto', minHeight: 50, textAlignVertical: 'top' }]}
            value={formData[name]}
            onChangeText={(text) => handleChange(name, text)}
            onFocus={() => setFocusedField(name)}
            onBlur={() => setFocusedField(null)}
            placeholder={placeholder}
            placeholderTextColor="#94a3b8"
            {...options}
          />
          {verifyType && !isLogin && (
            <TouchableOpacity onPress={() => handleSendVerifyOtp(verifyType)} disabled={isVerified} style={[styles.verifyBtn, isVerified && styles.verifiedBtn]}>
              {isVerified ? <Icon name="check-decagram" size={18} color="#10b981" /> : <Text style={styles.verifyBtnText}>Verify</Text>}
            </TouchableOpacity>
          )}
        </View>
        {errors[name] && <Text style={styles.errorText}>{errors[name]}</Text>}
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient colors={['#0f172a', '#1e293b', '#000000']} style={styles.gradient}>
        <Animated.View style={[styles.lavaOrb, styles.orb1, { transform: [{ translateY: orb1Anim }] }]} />
        <Animated.View style={[styles.lavaOrb, styles.orb2, { transform: [{ translateY: orb2Anim }] }]} />
        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : null} style={styles.flex}>
            <TouchableOpacity style={styles.backBtn} onPress={() => navigation.replace('RoleSelector')}><Icon name="chevron-left" size={28} color="#ffffff" /></TouchableOpacity>
            <ScrollView contentContainerStyle={[styles.scrollContent, isLogin && { paddingTop: 150 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="always">
              <Animated.View style={[styles.panel, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                <View style={styles.header}>
                  <View style={styles.logoBadge}><Image source={logo} style={styles.logo} resizeMode="contain" /></View>
                  <View style={styles.brandContainer}><Text style={styles.brandMain}>Medicone</Text><Text style={[styles.brandAlt, { color: '#10b981' }]}>ckt</Text></View>
                  <Text style={styles.tagline}>{isLogin ? 'Welcome back, Counselor' : 'Join our expert team'}</Text>
                </View>
                {!isLogin && (
                  <Animated.View key="photo-section" style={[styles.photoSection, { opacity: fieldAnims[0] }]}>
                    <TouchableOpacity onPress={handleSelectImage} style={styles.photoCircle}>
                      {formData.profilePhoto ? (
                        <Image source={{ uri: formData.profilePhoto.uri }} style={styles.photo} />
                      ) : (
                        <Icon name="camera-plus-outline" size={30} color="#10b981" />
                      )}
                    </TouchableOpacity>
                    <Text style={styles.photoLabel}>Counselor Photo</Text>
                  </Animated.View>
                )}
                <View style={styles.formPanel}>
                  {!isLogin ? (
                    <>{renderInput(1, 'fullName', 'account-outline', 'Full Name')}{renderInput(2, 'email', 'email-outline', 'Email Address', { keyboardType: 'email-address', autoCapitalize: 'none' }, 'email')}{renderInput(3, 'phoneNumber', 'phone-outline', 'Phone Number', { keyboardType: 'phone-pad' }, 'phone')}{renderInput(4, 'age', 'calendar-account-outline', 'Age', { keyboardType: 'numeric' })}
                      <Animated.View key="gender-section" style={{ opacity: fieldAnims[5] }}><Text style={styles.sectionLabel}>Gender</Text><View style={styles.genderRow}>{genderOptions.map(g => (<TouchableOpacity key={g} style={[styles.genderBtn, formData.gender === g && styles.genderBtnSelected]} onPress={() => handleChange('gender', g)}><Text style={[styles.genderText, formData.gender === g && styles.genderTextSelected]}>{g}</Text></TouchableOpacity>))}</View></Animated.View>
                      {renderInput(6, 'qualification', 'school-outline', 'Qualification')}{renderInput(7, 'specialization', 'certificate-outline', 'Specialization')}
                      <View style={styles.row}><View style={{ flex: 1 }}>{renderInput(8, 'experience', 'briefcase-clock-outline', 'Years')}</View><View style={{ flex: 1.5 }}>{renderInput(9, 'location', 'map-marker-radius-outline', 'City')}</View></View>
                      <Animated.View key="mode-section" style={{ opacity: fieldAnims[10] }}><Text style={styles.sectionLabel}>Consultation Mode</Text><View style={styles.tagRow}>{consultationModes.map(m => (<TouchableOpacity key={m} style={[styles.tag, formData.consultationMode.includes(m) && styles.tagSelected]} onPress={() => toggleListItem('consultationMode', m)}><Text style={[styles.tagText, formData.consultationMode.includes(m) && styles.tagTextSelected]}>{m}</Text></TouchableOpacity>))}</View></Animated.View>
                      <Animated.View key="lang-section" style={{ opacity: fieldAnims[11] }}><Text style={styles.sectionLabel}>Languages</Text><View style={styles.tagRow}>{languageOptions.map(l => (<TouchableOpacity key={l} style={[styles.tag, formData.languages.includes(l) && styles.tagSelected]} onPress={() => toggleListItem('languages', l)}><Text style={[styles.tagText, formData.languages.includes(l) && styles.tagTextSelected]}>{l}</Text></TouchableOpacity>))}</View></Animated.View>
                      {renderInput(12, 'aboutMe', 'account-details-outline', 'About Me', { multiline: true })}
                    </>
                  ) : (<>{renderInput(1, 'email', 'email-outline', 'Email Address', { keyboardType: 'email-address', autoCapitalize: 'none' })}</>)}
                  <Animated.View key="pwd-section" style={{ opacity: fieldAnims[13] }}>
                    <View style={[styles.inputWrapper, focusedField === 'password' && styles.inputWrapperFocused]}>
                      <Icon name="lock-outline" size={20} color={focusedField === 'password' ? '#10b981' : '#64748b'} style={styles.inputIcon} /><TextInput style={styles.textInput} value={formData.password} onChangeText={(text) => handleChange('password', text)} onFocus={() => setFocusedField('password')} onBlur={() => setFocusedField(null)} placeholder="Password" placeholderTextColor="#94a3b8" secureTextEntry={!showPassword} /><TouchableOpacity onPress={() => setShowPassword(!showPassword)}><Icon name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#64748b" /></TouchableOpacity>
                    </View>
                  </Animated.View>
                  {isLogin && (<TouchableOpacity onPress={handleForgotPassword} style={styles.forgotLink}><Text style={[styles.forgotText, { color: '#10b981' }]}>Forgot password?</Text></TouchableOpacity>)}
                  {!isLogin && (<Animated.View key="cpwd-section" style={{ opacity: fieldAnims[14] }}><View style={[styles.inputWrapper, focusedField === 'confirmPassword' && styles.inputWrapperFocused]}><Icon name="lock-check-outline" size={20} color={focusedField === 'confirmPassword' ? '#10b981' : '#64748b'} style={styles.inputIcon} /><TextInput style={styles.textInput} value={formData.confirmPassword} onChangeText={(text) => handleChange('confirmPassword', text)} onFocus={() => setFocusedField('confirmPassword')} onBlur={() => setFocusedField(null)} placeholder="Confirm Password" placeholderTextColor="#94a3b8" secureTextEntry={!showConfirmPassword} /><TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}><Icon name={showConfirmPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#64748b" /></TouchableOpacity></View></Animated.View>)}
                  <Animated.View key="btn-section" style={{ opacity: fieldAnims[15], marginTop: 10 }}><TouchableOpacity style={[styles.submitBtn, { backgroundColor: '#10b981' }]} onPress={isLogin ? handleLogin : handleSignup} disabled={isLoading}>{isLoading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnText}>{isLogin ? 'Login' : 'Join as Counselor'}</Text>}</TouchableOpacity></Animated.View>
                  <Animated.View key="sw-section" style={[styles.switchRow, { opacity: fieldAnims[16] }]}><Text style={styles.switchText}>{isLogin ? "New counselor?" : "Already a member?"}</Text><TouchableOpacity onPress={() => setIsLogin(!isLogin)}><Text style={[styles.switchLink, { color: '#10b981' }]}>{isLogin ? " Sign Up" : " Login"}</Text></TouchableOpacity></Animated.View>
                </View>
              </Animated.View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
        {/* OTP Modal */}
        <Modal visible={showOtpModal.show} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={[styles.modalIcon, { backgroundColor: '#f0fdf4' }]}><Icon name={showOtpModal.type === 'email' ? 'email-fast-outline' : 'cellphone-text'} size={40} color="#10b981" /></View>
              <Text style={styles.modalTitle}>Verification Code</Text>
              <Text style={styles.modalSub}>Enter code sent to {showOtpModal.value}</Text>
              <TextInput style={[styles.otpInput, { marginVertical: 15 }]} value={otpCode} onChangeText={setOtpCode} placeholder="000000" placeholderTextColor="#94a3b8" keyboardType="numeric" maxLength={6} />
              {otpError ? <Text style={styles.modalErrorText}>{otpError}</Text> : null}
              <TouchableOpacity style={[styles.modalActionBtn, { backgroundColor: '#10b981', marginVertical: 15 }]} onPress={handleVerifyOtp} disabled={isVerifyingOtp}>{isVerifyingOtp ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalActionText}>Verify Counselor</Text>}</TouchableOpacity>
              <TouchableOpacity onPress={() => setShowOtpModal({ show: false, type: '', value: '' })} style={styles.cancelBtn}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
            </View>
          </View>
        </Modal>
        {/* Device Conflict */}
        <Modal visible={showDeviceConflict} transparent animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { borderTopWidth: 4, borderColor: '#10b981' }]}><View style={[styles.modalIcon, { backgroundColor: '#f0fdf4' }]}><Icon name="devices" size={40} color="#10b981" /></View><Text style={styles.modalTitle}>Switching Devices</Text><Text style={styles.modalSub}>Counselor account active on another device. Logout there and continue here?</Text>{!deviceOtpSent ? (<TouchableOpacity style={[styles.modalActionBtn, { backgroundColor: '#10b981' }]} onPress={handleSendDeviceOtp} disabled={isSendingDeviceOtp}>{isSendingDeviceOtp ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalActionText}>Log out other device</Text>}</TouchableOpacity>) : (<View style={styles.otpWrapper}><TextInput style={styles.otpInput} value={deviceOtp} onChangeText={setDeviceOtp} placeholder="Enter OTP" placeholderTextColor="#94a3b8" keyboardType="numeric" maxLength={6} /><TouchableOpacity style={[styles.modalActionBtn, { backgroundColor: '#10b981' }]} onPress={handleVerifyDeviceOtp} disabled={isVerifyingDeviceOtp}>{isVerifyingDeviceOtp ? <ActivityIndicator color="#fff" /> : <Text style={styles.modalActionText}>Verify & Takeover</Text>}</TouchableOpacity></View>)}<TouchableOpacity onPress={() => setShowDeviceConflict(false)} style={styles.cancelBtn}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity></View>
          </View>
        </Modal>
        {notification.show && (<Animated.View style={[styles.notification, { backgroundColor: notification.type === 'error' ? '#ef4444' : notification.type === 'info' ? '#10b981' : '#10b981' }]}><Icon name={notification.type === 'error' ? 'alert-circle' : 'check-circle'} size={20} color="#fff" /><Text style={styles.notificationText}>{notification.message}</Text></Animated.View>)}
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  gradient: { flex: 1, overflow: 'hidden' },
  lavaOrb: { position: 'absolute', width: 300, height: 300, borderRadius: 150, opacity: 0.35 },
  orb1: { top: -100, left: -50, backgroundColor: '#10b981' },
  orb2: { bottom: -50, right: -100, backgroundColor: '#6366f1' },
  safeArea: { flex: 1 },
  scrollContent: { padding: 24, paddingTop: 100, paddingBottom: 60 },
  backBtn: { position: 'absolute', top: 30, left: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  panel: { backgroundColor: 'rgba(255, 255, 255, 0.96)', borderRadius: 40, padding: 24, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 30, elevation: 15 },
  header: { alignItems: 'center', marginBottom: 20 },
  logoBadge: { padding: 8, backgroundColor: '#fff', borderRadius: 20, shadowColor: '#10b981', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  logo: { width: 55, height: 55 },
  brandContainer: { flexDirection: 'row', marginTop: 12 },
  brandMain: { fontSize: 26, fontWeight: '900', color: '#1e293b' },
  brandAlt: { fontSize: 26, fontWeight: '400' },
  tagline: { fontSize: 13, color: '#64748b', fontWeight: '600', marginTop: 4 },
  photoSection: { alignItems: 'center', marginBottom: 20 },
  photoCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#f0fdf4', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#10b981', overflow: 'hidden' },
  photo: { width: '100%', height: '100%' },
  photoLabel: { fontSize: 12, fontWeight: '700', color: '#10b981', marginTop: 8 },
  formPanel: { gap: 12 },
  inputField: { width: '100%' },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 18, paddingHorizontal: 12, height: 52, borderWidth: 1.5, borderColor: '#f1f5f9' },
  inputWrapperFocused: { borderColor: '#10b981', backgroundColor: '#ffffff' },
  inputIcon: { marginRight: 8 },
  textInput: { flex: 1, color: '#1e293b', fontSize: 14, fontWeight: '600' },
  verifyBtn: { backgroundColor: '#10b981', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  verifiedBtn: { backgroundColor: 'transparent' },
  verifyBtnText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  errorText: { color: '#ef4444', fontSize: 11, marginTop: 4, marginLeft: 16, fontWeight: '600' },
  row: { flexDirection: 'row', gap: 12 },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  tag: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: '#f1f5f9', borderWidth: 1.5, borderColor: 'transparent' },
  tagSelected: { backgroundColor: '#f0fdf4', borderColor: '#10b981' },
  tagText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  tagTextSelected: { color: '#10b981' },
  forgotLink: { alignSelf: 'flex-end', marginTop: -8, marginBottom: 8 },
  forgotText: { fontSize: 12, fontWeight: '700' },
  submitBtn: { height: 56, borderRadius: 20, justifyContent: 'center', alignItems: 'center', shadowColor: '#10b981', shadowOpacity: 0.3, shadowRadius: 10, elevation: 8 },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  switchRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 10 },
  switchText: { fontSize: 14, color: '#64748b', fontWeight: '500' },
  switchLink: { fontSize: 14, fontWeight: '800' },
  genderRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  genderBtn: { flex: 1, height: 44, borderRadius: 15, backgroundColor: '#f1f5f9', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  genderBtnSelected: { backgroundColor: '#f0fdf4', borderColor: '#10b981' },
  genderText: { fontSize: 13, fontWeight: '700', color: '#64748b' },
  genderTextSelected: { color: '#10b981' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: { backgroundColor: '#fff', borderRadius: 30, padding: 24, width: '100%', alignItems: 'center' },
  modalIcon: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#1e293b', marginBottom: 12, textAlign: 'center' },
  modalSub: { fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  modalActionBtn: { width: '100%', height: 56, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  modalActionText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  modalErrorText: { color: '#ef4444', fontSize: 12, fontWeight: '700', marginBottom: 12 },
  cancelBtn: { marginTop: 16 },
  cancelText: { fontSize: 14, fontWeight: '700', color: '#94a3b8' },
  otpWrapper: { width: '100%', gap: 16 },
  otpInput: { width: '100%', height: 54, borderRadius: 18, backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#f1f5f9', textAlign: 'center', fontSize: 18, fontWeight: '800', color: '#1e293b' },
  notification: { position: 'absolute', top: 50, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 15, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 10, zIndex: 1000 },
  notificationText: { color: '#fff', fontSize: 14, fontWeight: '700', marginLeft: 8 },
});

export default CounselorSignup;