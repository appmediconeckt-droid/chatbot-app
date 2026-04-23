import React, { useState, useEffect } from 'react';
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
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL } from '../../axiosConfig';
import { launchImageLibrary } from 'react-native-image-picker';

const CounselorSignup = ({ navigation }) => {
  const [isLogin, setIsLogin] = useState(true);
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

  // Verification states
  const [emailVerified, setEmailVerified] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [showEmailOtpModal, setShowEmailOtpModal] = useState(false);
  const [showPhoneOtpModal, setShowPhoneOtpModal] = useState(false);
  const [emailOtp, setEmailOtp] = useState('');
  const [phoneOtp, setPhoneOtp] = useState('');
  const [isSendingEmailOtp, setIsSendingEmailOtp] = useState(false);
  const [isSendingPhoneOtp, setIsSendingPhoneOtp] = useState(false);
  const [isVerifyingEmailOtp, setIsVerifyingEmailOtp] = useState(false);
  const [isVerifyingPhoneOtp, setIsVerifyingPhoneOtp] = useState(false);
  const [emailOtpError, setEmailOtpError] = useState('');
  const [phoneOtpError, setPhoneOtpError] = useState('');
  const [emailOtpSuccess, setEmailOtpSuccess] = useState(false);
  const [phoneOtpSuccess, setPhoneOtpSuccess] = useState(false);
  const [emailResendTimer, setEmailResendTimer] = useState(0);
  const [phoneResendTimer, setPhoneResendTimer] = useState(0);

  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState({
    show: false,
    message: '',
    type: '',
  });
  const [showDeviceConflict, setShowDeviceConflict] = useState(false);
  const [deviceOtp, setDeviceOtp] = useState('');
  const [deviceOtpSent, setDeviceOtpSent] = useState(false);
  const [isSendingDeviceOtp, setIsSendingDeviceOtp] = useState(false);
  const [isVerifyingDeviceOtp, setIsVerifyingDeviceOtp] = useState(false);

  const consultationModes = ['Online', 'Offline', 'Both'];
  const languageOptions = [
    'Hindi', 'English', 'Gujarati', 'Marathi', 
    'Tamil', 'Telugu', 'Bengali', 'Punjabi',
  ];
  const genderOptions = ['Male', 'Female', 'Other'];

  useEffect(() => {
    let interval;
    if (emailResendTimer > 0) {
      interval = setInterval(() => {
        setEmailResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [emailResendTimer]);

  useEffect(() => {
    let interval;
    if (phoneResendTimer > 0) {
      interval = setInterval(() => {
        setPhoneResendTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [phoneResendTimer]);

  useEffect(() => {
    checkExistingSession();
  }, []);

  const checkExistingSession = async () => {
    const token = await AsyncStorage.getItem('accessToken');
    const userRole = await AsyncStorage.getItem('userRole');
    if (token && userRole === 'counselor') {
      navigation.replace('CounselorDashboard');
    } else if (token && userRole === 'user') {
      navigation.replace('UserDashboard');
    }
  };

  const showNotification = (message, type = 'success') => {
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: '', type: '' });
    }, 3000);
  };

  const handleChange = (name, value) => {
    if (name === 'consultationMode') {
      let updatedModes = [...formData.consultationMode];
      if (updatedModes.includes(value)) {
        updatedModes = updatedModes.filter((mode) => mode !== value);
      } else {
        updatedModes.push(value);
      }
      setFormData({ ...formData, consultationMode: updatedModes });
    } else if (name === 'languages') {
      let updatedLanguages = [...formData.languages];
      if (updatedLanguages.includes(value)) {
        updatedLanguages = updatedLanguages.filter((lang) => lang !== value);
      } else {
        updatedLanguages.push(value);
      }
      setFormData({ ...formData, languages: updatedLanguages });
    } else {
      setFormData({ ...formData, [name]: value });
    }

    if (errors[name]) {
      setErrors({ ...errors, [name]: '' });
    }

    if (name === 'email') setEmailVerified(false);
    if (name === 'phoneNumber') setPhoneVerified(false);
  };

  const handleImagePicker = () => {
    const options = {
      mediaType: 'photo',
      includeBase64: false,
      maxHeight: 2000,
      maxWidth: 2000,
      quality: 1,
    };

    launchImageLibrary(options, (response) => {
      if (response.didCancel) {
        console.log('User cancelled image picker');
      } else if (response.error) {
        console.log('ImagePicker Error: ', response.error);
        showNotification('Error selecting image', 'error');
      } else if (response.assets && response.assets[0]) {
        setFormData({ ...formData, profilePhoto: response.assets[0] });
      }
    });
  };

  const validateLogin = () => {
    const newErrors = {};
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required';
    }
    return newErrors;
  };

  const validateSignup = () => {
    const newErrors = {};
    if (!formData.fullName) newErrors.fullName = 'Full name is required';
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    } else if (!emailVerified) {
      newErrors.email = 'Please verify your email first';
    }
    if (!formData.phoneNumber) {
      newErrors.phoneNumber = 'Phone number is required';
    } else if (!/^\d{10}$/.test(formData.phoneNumber)) {
      newErrors.phoneNumber = 'Phone number must be 10 digits';
    } else if (!phoneVerified) {
      newErrors.phoneNumber = 'Please verify your phone number first';
    }
    if (!formData.age) {
      newErrors.age = 'Age is required';
    } else if (formData.age < 18 || formData.age > 100) {
      newErrors.age = 'Age must be between 18 and 100';
    }
    if (!formData.gender) newErrors.gender = 'Gender is required';
    if (!formData.qualification) newErrors.qualification = 'Qualification is required';
    if (!formData.specialization) newErrors.specialization = 'Specialization is required';
    if (!formData.experience) {
      newErrors.experience = 'Experience is required';
    } else if (formData.experience < 0) {
      newErrors.experience = 'Experience cannot be negative';
    }
    if (!formData.location) newErrors.location = 'Location is required';
    if (formData.consultationMode.length === 0) {
      newErrors.consultationMode = 'Select at least one consultation mode';
    }
    if (formData.languages.length === 0) {
      newErrors.languages = 'Select at least one language';
    }
    if (!formData.aboutMe) newErrors.aboutMe = 'About me is required';
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    return newErrors;
  };

  const handleSendEmailOtp = async () => {
    if (!formData.email) {
      setEmailOtpError('Please enter email address first');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      setEmailOtpError('Please enter a valid email address');
      return;
    }

    setIsSendingEmailOtp(true);
    setEmailOtpError('');
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/auth/send-email-otp`,
        { email: formData.email }
      );

      if (response.data.success) {
        showNotification('OTP sent to your email!', 'success');
        setEmailResendTimer(60);
        setEmailOtpSuccess(false);
        setEmailOtp('');
      } else {
        setEmailOtpError(response.data.message || 'Failed to send OTP');
      }
    } catch (error) {
      setEmailOtpError(
        error.response?.data?.message || 'Failed to send OTP. Please try again.'
      );
    } finally {
      setIsSendingEmailOtp(false);
    }
  };

  const handleVerifyEmailOtp = async () => {
    if (!emailOtp || emailOtp.length !== 6) {
      setEmailOtpError('Please enter 6-digit OTP');
      return;
    }

    setIsVerifyingEmailOtp(true);
    setEmailOtpError('');
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/auth/verify-email-otp`,
        { email: formData.email, otp: emailOtp }
      );

      if (response.data.success) {
        setEmailVerified(true);
        setEmailOtpSuccess(true);
        showNotification('Email verified successfully!', 'success');
        setTimeout(() => {
          setShowEmailOtpModal(false);
          resetEmailOtpState();
        }, 1500);
      } else {
        setEmailOtpError(response.data.message || 'Invalid OTP');
      }
    } catch (error) {
      setEmailOtpError(
        error.response?.data?.message || 'Verification failed. Please try again.'
      );
    } finally {
      setIsVerifyingEmailOtp(false);
    }
  };

  const resetEmailOtpState = () => {
    setEmailOtp('');
    setEmailOtpError('');
    setEmailOtpSuccess(false);
    setEmailResendTimer(0);
  };

  const handleSendPhoneOtp = async () => {
    if (!formData.phoneNumber) {
      setPhoneOtpError('Please enter phone number first');
      return;
    }
    if (!/^\d{10}$/.test(formData.phoneNumber)) {
      setPhoneOtpError('Please enter a valid 10-digit phone number');
      return;
    }

    setIsSendingPhoneOtp(true);
    setPhoneOtpError('');
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/auth/send-phone-otp`,
        { phoneNumber: formData.phoneNumber, email: formData.email }
      );

      if (response.data.success) {
        showNotification('OTP sent to your phone!', 'success');
        setPhoneResendTimer(60);
        setPhoneOtpSuccess(false);
        setPhoneOtp('');
      } else {
        setPhoneOtpError(response.data.message || 'Failed to send OTP');
      }
    } catch (error) {
      setPhoneOtpError(
        error.response?.data?.message || 'Failed to send OTP. Please try again.'
      );
    } finally {
      setIsSendingPhoneOtp(false);
    }
  };

  const handleVerifyPhoneOtp = async () => {
    if (!phoneOtp || phoneOtp.length !== 6) {
      setPhoneOtpError('Please enter 6-digit OTP');
      return;
    }

    setIsVerifyingPhoneOtp(true);
    setPhoneOtpError('');
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/auth/verify-phone-otp`,
        { phoneNumber: formData.phoneNumber, otp: phoneOtp }
      );

      if (response.data.success) {
        setPhoneVerified(true);
        setPhoneOtpSuccess(true);
        showNotification('Phone number verified successfully!', 'success');
        setTimeout(() => {
          setShowPhoneOtpModal(false);
          resetPhoneOtpState();
        }, 1500);
      } else {
        setPhoneOtpError(response.data.message || 'Invalid OTP');
      }
    } catch (error) {
      setPhoneOtpError(
        error.response?.data?.message || 'Verification failed. Please try again.'
      );
    } finally {
      setIsVerifyingPhoneOtp(false);
    }
  };

  const resetPhoneOtpState = () => {
    setPhoneOtp('');
    setPhoneOtpError('');
    setPhoneOtpSuccess(false);
    setPhoneResendTimer(0);
  };

  const persistCounselorSession = async (data) => {
    const token = data?.token || data?.accessToken;
    if (!token) return false;

    const decodeUserIdFromToken = (jwtToken) => {
      try {
        const payloadBase64 = jwtToken.split('.')[1];
        const normalized = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(atob(normalized));
        return payload?.userId || payload?.id || '';
      } catch {
        return '';
      }
    };

    await AsyncStorage.setItem('accessToken', token);
    await AsyncStorage.setItem('token', token);
    if (data.refreshToken) await AsyncStorage.setItem('refreshToken', data.refreshToken);
    
    const resolvedUserId = data?.user?._id || decodeUserIdFromToken(token) || '';
    if (resolvedUserId) {
      await AsyncStorage.setItem('counsellorId', resolvedUserId);
      await AsyncStorage.setItem('counselorId', resolvedUserId);
      await AsyncStorage.setItem('userId', resolvedUserId);
    }

    if (data.user) {
      await AsyncStorage.setItem('userData', JSON.stringify(data.user));
      await AsyncStorage.setItem('userRole', data.user.role || 'counselor');
    } else {
      await AsyncStorage.setItem('userRole', 'counselor');
    }
    await AsyncStorage.setItem('userEmail', formData.email);
    await AsyncStorage.setItem('isAuthenticated', 'true');
    return true;
  };

 const handleLogin = async () => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/auth/login`,
      {
        email: formData.email,
        password: formData.password,
        role: 'counselor',
      },
      { withCredentials: true }
    );

    if (await persistCounselorSession(response.data)) {
      showNotification('Login successful! Redirecting to dashboard...', 'success');
      setTimeout(() => navigation.replace('CounselorDashboard'), 1200);
    } else {
      showNotification(response.data?.message || 'Login failed', 'error');
    }
  } catch (err) {
    // CRITICAL FIX: Check for BOTH conditions exactly like web version
    if (
      err?.isOneDeviceConflict ||
      (err?.response?.status === 409 && err?.response?.data?.needLogout)
    ) {
      setShowDeviceConflict(true);
      setDeviceOtpSent(false);
      setDeviceOtp('');
      showNotification('Already login detected. Continue with email OTP verification.', 'info');
      return;
    }

    const errorMessage = err?.response?.data?.message || 'Something went wrong';
    showNotification(errorMessage, 'error');
  }
};

  const handleSendDeviceOtp = async () => {
    setIsSendingDeviceOtp(true);
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/auth/logout-other-devices`,
        { email: formData.email },
        { withCredentials: true }
      );
      if (response.data?.success) {
        setDeviceOtpSent(true);
        showNotification('OTP sent to your email. Enter it below.', 'success');
      } else {
        showNotification(response.data?.message || 'Failed to send OTP', 'error');
      }
    } catch (error) {
      showNotification(error.response?.data?.message || 'Failed to send OTP', 'error');
    } finally {
      setIsSendingDeviceOtp(false);
    }
  };

  const handleVerifyDeviceOtp = async () => {
    if (!deviceOtp || deviceOtp.length !== 6) {
      showNotification('Please enter a valid 6-digit OTP', 'error');
      return;
    }
    setIsVerifyingDeviceOtp(true);
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/auth/verify-login-otp`,
        { email: formData.email, otp: deviceOtp },
        { withCredentials: true }
      );

      if (await persistCounselorSession(response.data)) {
        setShowDeviceConflict(false);
        showNotification('OTP verified! Redirecting to dashboard...', 'success');
        setTimeout(() => navigation.replace('CounselorDashboard'), 1200);
      } else {
        showNotification(response.data?.message || 'OTP verification failed', 'error');
      }
    } catch (error) {
      showNotification(error.response?.data?.message || 'OTP verification failed', 'error');
    } finally {
      setIsVerifyingDeviceOtp(false);
    }
  };

  const handleSignup = async () => {
    if (!emailVerified) {
      setErrors((prev) => ({ ...prev, email: 'Please verify your email first' }));
      showNotification('Please verify your email first', 'error');
      return;
    }
    if (!phoneVerified) {
      setErrors((prev) => ({ ...prev, phoneNumber: 'Please verify your phone number first' }));
      showNotification('Please verify your phone number first', 'error');
      return;
    }

    try {
      const payload = {
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        phoneNumber: formData.phoneNumber.trim(),
        age: Number(formData.age),
        gender: formData.gender.toLowerCase(),
        qualification: formData.qualification.trim(),
        specialization: formData.specialization.trim(),
        experience: Number(formData.experience),
        location: formData.location.trim(),
        consultationMode: formData.consultationMode.map((m) => m.toLowerCase()),
        languages: formData.languages,
        aboutMe: formData.aboutMe.trim(),
        password: formData.password,
        confirmPassword: formData.confirmPassword,
        role: 'counselor',
      };

      const response = await axios.post(
        `${API_BASE_URL}/api/auth/complete-registration`,
        payload
      );

      if (response.data.success) {
        showNotification('Counselor registered successfully! Redirecting to dashboard...', 'success');

        const token = response.data?.token || response.data?.accessToken;
        if (token) {
          await AsyncStorage.setItem('accessToken', token);
          await AsyncStorage.setItem('token', token);
          await AsyncStorage.setItem('userRole', 'counselor');
          await AsyncStorage.setItem('userEmail', formData.email);
          await AsyncStorage.setItem('isAuthenticated', 'true');
          if (response.data.user) {
            await AsyncStorage.setItem('userData', JSON.stringify(response.data.user));
            await AsyncStorage.setItem('counsellorId', response.data.user._id);
          }
        }

        setTimeout(() => {
          navigation.replace('CounselorDashboard');
        }, 1500);
      } else {
        showNotification(response.data.message || 'Registration failed', 'error');
      }
    } catch (error) {
      if (error.response) {
        if (error.response.status === 400) {
          if (error.response.data.message && error.response.data.message.includes('duplicate key error')) {
            showNotification('This phone number is already registered. Please use a different number.', 'error');
          } else if (error.response.data.errors) {
            const serverErrors = {};
            Object.keys(error.response.data.errors).forEach((key) => {
              serverErrors[key] = error.response.data.errors[key][0];
            });
            setErrors(serverErrors);
            showNotification('Please check the form for errors', 'error');
          } else if (error.response.data.message) {
            showNotification(error.response.data.message, 'error');
          } else {
            showNotification('Registration failed. Please check your information.', 'error');
          }
        } else if (error.response.status === 409) {
          showNotification('Counselor with this email or phone already exists', 'error');
        } else {
          showNotification('Registration failed. Please try again.', 'error');
        }
      } else if (error.request) {
        showNotification('Network error. Please check your connection.', 'error');
      } else {
        showNotification('An error occurred. Please try again.', 'error');
      }
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);

    if (isLogin) {
      const loginErrors = validateLogin();
      if (Object.keys(loginErrors).length > 0) {
        setErrors(loginErrors);
        setIsLoading(false);
        showNotification('Please fill in all required fields', 'error');
        return;
      }
      await handleLogin();
    } else {
      const signupErrors = validateSignup();
      if (Object.keys(signupErrors).length > 0) {
        setErrors(signupErrors);
        setIsLoading(false);
        showNotification('Please fill in all required fields correctly', 'error');
        return;
      }
      await handleSignup();
    }

    setIsLoading(false);
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setErrors({});
    setShowDeviceConflict(false);
    setDeviceOtpSent(false);
    setDeviceOtp('');
    setEmailVerified(false);
    setPhoneVerified(false);
    setFormData({
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
    setNotification({ show: false, message: '', type: '' });
  };

  const EmailOtpModal = () => (
    <Modal
      visible={showEmailOtpModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => {
        if (!emailOtpSuccess) {
          setShowEmailOtpModal(false);
          resetEmailOtpState();
        }
      }}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.modalIconWrapper}>
              <Text style={styles.modalIcon}>✉️</Text>
            </View>
            <Text style={styles.modalTitle}>Verify Email Address</Text>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => {
                setShowEmailOtpModal(false);
                resetEmailOtpState();
              }}
              disabled={isVerifyingEmailOtp}
            >
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <Text style={styles.modalText}>Enter the verification code sent to</Text>
            <Text style={styles.modalRecipient}>{formData.email}</Text>

            <TextInput
              style={[styles.otpInput, emailOtpSuccess && styles.otpInputSuccess]}
              placeholder="000000"
              placeholderTextColor="#999"
              value={emailOtp}
              onChangeText={(text) => setEmailOtp(text.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              keyboardType="number-pad"
              editable={!isVerifyingEmailOtp && !emailOtpSuccess}
              autoFocus
            />

            {emailOtpError ? <Text style={styles.errorText}>{emailOtpError}</Text> : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.verifyButton]}
                onPress={handleVerifyEmailOtp}
                disabled={isVerifyingEmailOtp || emailOtpSuccess || !emailOtp}
              >
                {isVerifyingEmailOtp ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalButtonText}>Verify</Text>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.resendButton]}
                onPress={handleSendEmailOtp}
                disabled={isSendingEmailOtp || emailResendTimer > 0 || emailOtpSuccess}
              >
                {isSendingEmailOtp ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : emailResendTimer > 0 ? (
                  <Text style={styles.modalButtonText}>Resend in {emailResendTimer}s</Text>
                ) : (
                  <Text style={styles.modalButtonText}>Resend Code</Text>
                )}
              </TouchableOpacity>
            </View>

            {emailOtpSuccess && (
              <View style={styles.successContainer}>
                <Text style={styles.successText}>✓ Email verified successfully!</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );

  const PhoneOtpModal = () => (
    <Modal
      visible={showPhoneOtpModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => {
        if (!phoneOtpSuccess) {
          setShowPhoneOtpModal(false);
          resetPhoneOtpState();
        }
      }}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View style={styles.modalIconWrapper}>
              <Text style={styles.modalIcon}>📱</Text>
            </View>
            <Text style={styles.modalTitle}>Verify Phone Number</Text>
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => {
                setShowPhoneOtpModal(false);
                resetPhoneOtpState();
              }}
              disabled={isVerifyingPhoneOtp}
            >
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <Text style={styles.modalText}>Enter the verification code sent to</Text>
            <Text style={styles.modalRecipient}>{formData.phoneNumber}</Text>

            <TextInput
              style={[styles.otpInput, phoneOtpSuccess && styles.otpInputSuccess]}
              placeholder="000000"
              placeholderTextColor="#999"
              value={phoneOtp}
              onChangeText={(text) => setPhoneOtp(text.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              keyboardType="number-pad"
              editable={!isVerifyingPhoneOtp && !phoneOtpSuccess}
              autoFocus
            />

            {phoneOtpError ? <Text style={styles.errorText}>{phoneOtpError}</Text> : null}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.verifyButton]}
                onPress={handleVerifyPhoneOtp}
                disabled={isVerifyingPhoneOtp || phoneOtpSuccess || !phoneOtp}
              >
                {isVerifyingPhoneOtp ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalButtonText}>Verify</Text>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.resendButton]}
                onPress={handleSendPhoneOtp}
                disabled={isSendingPhoneOtp || phoneResendTimer > 0 || phoneOtpSuccess}
              >
                {isSendingPhoneOtp ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : phoneResendTimer > 0 ? (
                  <Text style={styles.modalButtonText}>Resend in {phoneResendTimer}s</Text>
                ) : (
                  <Text style={styles.modalButtonText}>Resend Code</Text>
                )}
              </TouchableOpacity>
            </View>

            {phoneOtpSuccess && (
              <View style={styles.successContainer}>
                <Text style={styles.successText}>✓ Phone verified successfully!</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Notification */}
        {notification.show && (
          <View style={[styles.notification, styles[`notification${notification.type}`]]}>
            <Text style={styles.notificationText}>{notification.message}</Text>
          </View>
        )}

        {showEmailOtpModal && <EmailOtpModal />}
        {showPhoneOtpModal && <PhoneOtpModal />}

        <View style={styles.brandSection}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>Mediconect</Text>
            <Text style={styles.logoSubtext}>Counselors</Text>
          </View>
          <Text style={styles.brandTitle}>
            {isLogin ? 'Welcome Back!' : 'Join Our Community'}
          </Text>
          <Text style={styles.brandSubtitle}>
            {isLogin
              ? 'Connect with expert counselors and find the support you need.'
              : 'Start your journey as a certified mental health counselor.'}
          </Text>
          <View style={styles.features}>
            <Text style={styles.feature}>✓ Expert Counselors</Text>
            <Text style={styles.feature}>✓ 24/7 Support</Text>
            <Text style={styles.feature}>✓ Confidential Sessions</Text>
          </View>
        </View>

        <View style={styles.formSection}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>{isLogin ? 'Login to Account' : 'Create Account'}</Text>
            <View style={styles.toggleContainer}>
              <Text style={styles.toggleText}>
                {isLogin ? "Don't have an account? " : 'Already have an account? '}
              </Text>
              <TouchableOpacity onPress={toggleMode} disabled={isLoading}>
                <Text style={styles.toggleLink}>{isLogin ? 'Sign Up' : 'Login'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {isLogin && showDeviceConflict && (
            <View style={styles.deviceConflictBox}>
              <Text style={styles.deviceConflictText}>Already login detected on another device.</Text>
              <TouchableOpacity
                style={styles.deviceActionButton}
                onPress={handleSendDeviceOtp}
                disabled={isSendingDeviceOtp}
              >
                {isSendingDeviceOtp ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.deviceActionText}>Logout Other Devices & Send OTP</Text>
                )}
              </TouchableOpacity>

              {deviceOtpSent && (
                <View style={styles.deviceOtpRow}>
                  <TextInput
                    style={styles.deviceOtpInput}
                    value={deviceOtp}
                    onChangeText={(text) => setDeviceOtp(text.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Enter 6-digit OTP"
                    placeholderTextColor="#999"
                    maxLength={6}
                    keyboardType="number-pad"
                  />
                  <TouchableOpacity
                    style={[styles.deviceActionButton, styles.deviceVerifyButton]}
                    onPress={handleVerifyDeviceOtp}
                    disabled={isVerifyingDeviceOtp}
                  >
                    {isVerifyingDeviceOtp ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.deviceActionText}>Verify OTP</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {isLogin ? (
            // Login Form
            <View>
              <View style={styles.field}>
                <Text style={styles.label}>Email Address *</Text>
                <TextInput
                  style={[styles.input, errors.email && styles.inputError]}
                  value={formData.email}
                  onChangeText={(text) => handleChange('email', text)}
                  placeholder="Enter your email"
                  placeholderTextColor="#999"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!isLoading}
                />
                {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Password *</Text>
                <View style={styles.passwordWrapper}>
                  <TextInput
                    style={[styles.input, styles.passwordInput, errors.password && styles.inputError]}
                    value={formData.password}
                    onChangeText={(text) => handleChange('password', text)}
                    placeholder="Enter your password"
                    placeholderTextColor="#999"
                    secureTextEntry={!showPassword}
                    editable={!isLoading}
                  />
                  <TouchableOpacity
                    style={styles.passwordToggle}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Text style={styles.passwordToggleText}>{showPassword ? 'Hide' : 'Show'}</Text>
                  </TouchableOpacity>
                </View>
                {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
              </View>

              <View style={styles.options}>
                <View style={styles.checkboxContainer}>
                  <View style={styles.checkbox} />
                  <Text style={styles.checkboxLabel}>Remember me</Text>
                </View>
                <TouchableOpacity>
                  <Text style={styles.forgotLink}>Forgot password?</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            // Signup Form
            <View>
              <View style={styles.grid}>
                <View style={styles.field}>
                  <Text style={styles.label}>Full Name *</Text>
                  <TextInput
                    style={[styles.input, errors.fullName && styles.inputError]}
                    value={formData.fullName}
                    onChangeText={(text) => handleChange('fullName', text)}
                    placeholder="Enter your full name"
                    placeholderTextColor="#999"
                    editable={!isLoading}
                  />
                  {errors.fullName && <Text style={styles.errorText}>{errors.fullName}</Text>}
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Email *</Text>
                  <View style={styles.verifyGroup}>
                    <TextInput
                      style={[
                        styles.input,
                        styles.verifyInput,
                        errors.email && styles.inputError,
                        emailVerified && styles.verifiedInput,
                      ]}
                      value={formData.email}
                      onChangeText={(text) => handleChange('email', text)}
                      placeholder="Enter your email"
                      placeholderTextColor="#999"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      editable={!isLoading && !emailVerified}
                    />
                    {!emailVerified && formData.email && /\S+@\S+\.\S+/.test(formData.email) && (
                      <TouchableOpacity
                        style={styles.verifyButton}
                        onPress={() => {
                          resetEmailOtpState();
                          setShowEmailOtpModal(true);
                          handleSendEmailOtp();
                        }}
                        disabled={isLoading}
                      >
                        <Text style={styles.verifyButtonText}>Verify</Text>
                      </TouchableOpacity>
                    )}
                    {emailVerified && (
                      <View style={styles.verifiedBadge}>
                        <Text style={styles.verifiedText}>✓ Verified</Text>
                      </View>
                    )}
                  </View>
                  {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Phone Number *</Text>
                  <View style={styles.verifyGroup}>
                    <TextInput
                      style={[
                        styles.input,
                        styles.verifyInput,
                        errors.phoneNumber && styles.inputError,
                        phoneVerified && styles.verifiedInput,
                      ]}
                      value={formData.phoneNumber}
                      onChangeText={(text) => handleChange('phoneNumber', text)}
                      placeholder="10 digit mobile number"
                      placeholderTextColor="#999"
                      maxLength={10}
                      keyboardType="phone-pad"
                      editable={!isLoading && !phoneVerified}
                    />
                    {!phoneVerified && formData.phoneNumber && /^\d{10}$/.test(formData.phoneNumber) && (
                      <TouchableOpacity
                        style={styles.verifyButton}
                        onPress={() => {
                          resetPhoneOtpState();
                          setShowPhoneOtpModal(true);
                          handleSendPhoneOtp();
                        }}
                        disabled={isLoading}
                      >
                        <Text style={styles.verifyButtonText}>Verify</Text>
                      </TouchableOpacity>
                    )}
                    {phoneVerified && (
                      <View style={styles.verifiedBadge}>
                        <Text style={styles.verifiedText}>✓ Verified</Text>
                      </View>
                    )}
                  </View>
                  {errors.phoneNumber && <Text style={styles.errorText}>{errors.phoneNumber}</Text>}
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Age *</Text>
                  <TextInput
                    style={[styles.input, errors.age && styles.inputError]}
                    value={formData.age}
                    onChangeText={(text) => handleChange('age', text)}
                    placeholder="Your age"
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                    editable={!isLoading}
                  />
                  {errors.age && <Text style={styles.errorText}>{errors.age}</Text>}
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Gender *</Text>
                  <View style={styles.pickerContainer}>
                    {genderOptions.map((gender) => (
                      <TouchableOpacity
                        key={gender}
                        style={[
                          styles.genderOption,
                          formData.gender === gender && styles.genderOptionSelected,
                        ]}
                        onPress={() => handleChange('gender', gender)}
                      >
                        <Text
                          style={[
                            styles.genderOptionText,
                            formData.gender === gender && styles.genderOptionTextSelected,
                          ]}
                        >
                          {gender}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {errors.gender && <Text style={styles.errorText}>{errors.gender}</Text>}
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Qualification *</Text>
                  <TextInput
                    style={[styles.input, errors.qualification && styles.inputError]}
                    value={formData.qualification}
                    onChangeText={(text) => handleChange('qualification', text)}
                    placeholder="e.g., M.Sc Psychology"
                    placeholderTextColor="#999"
                    editable={!isLoading}
                  />
                  {errors.qualification && <Text style={styles.errorText}>{errors.qualification}</Text>}
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Specialization *</Text>
                  <TextInput
                    style={[styles.input, errors.specialization && styles.inputError]}
                    value={formData.specialization}
                    onChangeText={(text) => handleChange('specialization', text)}
                    placeholder="e.g., Clinical Psychology"
                    placeholderTextColor="#999"
                    editable={!isLoading}
                  />
                  {errors.specialization && <Text style={styles.errorText}>{errors.specialization}</Text>}
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Experience (Years) *</Text>
                  <TextInput
                    style={[styles.input, errors.experience && styles.inputError]}
                    value={formData.experience}
                    onChangeText={(text) => handleChange('experience', text)}
                    placeholder="Years of experience"
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                    editable={!isLoading}
                  />
                  {errors.experience && <Text style={styles.errorText}>{errors.experience}</Text>}
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>Location *</Text>
                  <TextInput
                    style={[styles.input, errors.location && styles.inputError]}
                    value={formData.location}
                    onChangeText={(text) => handleChange('location', text)}
                    placeholder="City, State"
                    placeholderTextColor="#999"
                    editable={!isLoading}
                  />
                  {errors.location && <Text style={styles.errorText}>{errors.location}</Text>}
                </View>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Consultation Mode *</Text>
                <View style={styles.checkboxGroup}>
                  {consultationModes.map((mode) => (
                    <TouchableOpacity
                      key={mode}
                      style={styles.checkboxLabel}
                      onPress={() => handleChange('consultationMode', mode)}
                    >
                      <View style={[styles.checkbox, formData.consultationMode.includes(mode) && styles.checkboxChecked]}>
                        {formData.consultationMode.includes(mode) && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                      <Text style={styles.checkboxText}>{mode}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {errors.consultationMode && <Text style={styles.errorText}>{errors.consultationMode}</Text>}
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Languages *</Text>
                <View style={styles.checkboxGroup}>
                  {languageOptions.map((lang) => (
                    <TouchableOpacity
                      key={lang}
                      style={styles.checkboxLabel}
                      onPress={() => handleChange('languages', lang)}
                    >
                      <View style={[styles.checkbox, formData.languages.includes(lang) && styles.checkboxChecked]}>
                        {formData.languages.includes(lang) && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                      <Text style={styles.checkboxText}>{lang}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {errors.languages && <Text style={styles.errorText}>{errors.languages}</Text>}
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>About Me *</Text>
                <TextInput
                  style={[styles.textArea, errors.aboutMe && styles.inputError]}
                  value={formData.aboutMe}
                  onChangeText={(text) => handleChange('aboutMe', text)}
                  placeholder="Tell us about yourself, your approach, and expertise..."
                  placeholderTextColor="#999"
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  editable={!isLoading}
                />
                {errors.aboutMe && <Text style={styles.errorText}>{errors.aboutMe}</Text>}
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Profile Photo</Text>
                <TouchableOpacity style={styles.fileButton} onPress={handleImagePicker}>
                  <Text style={styles.fileButtonText}>
                    {formData.profilePhoto ? 'Change Photo' : 'Choose Photo'}
                  </Text>
                </TouchableOpacity>
                {formData.profilePhoto && (
                  <Text style={styles.fileName}>{formData.profilePhoto.fileName || 'Photo selected'}</Text>
                )}
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Password *</Text>
                <View style={styles.passwordWrapper}>
                  <TextInput
                    style={[styles.input, styles.passwordInput, errors.password && styles.inputError]}
                    value={formData.password}
                    onChangeText={(text) => handleChange('password', text)}
                    placeholder="Create a password"
                    placeholderTextColor="#999"
                    secureTextEntry={!showPassword}
                    editable={!isLoading}
                  />
                  <TouchableOpacity
                    style={styles.passwordToggle}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Text style={styles.passwordToggleText}>{showPassword ? 'Hide' : 'Show'}</Text>
                  </TouchableOpacity>
                </View>
                {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>Confirm Password *</Text>
                <View style={styles.passwordWrapper}>
                  <TextInput
                    style={[styles.input, styles.passwordInput, errors.confirmPassword && styles.inputError]}
                    value={formData.confirmPassword}
                    onChangeText={(text) => handleChange('confirmPassword', text)}
                    placeholder="Confirm your password"
                    placeholderTextColor="#999"
                    secureTextEntry={!showConfirmPassword}
                    editable={!isLoading}
                  />
                  <TouchableOpacity
                    style={styles.passwordToggle}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    <Text style={styles.passwordToggleText}>{showConfirmPassword ? 'Hide' : 'Show'}</Text>
                  </TouchableOpacity>
                </View>
                {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.submitButton, isLoading && styles.submitButtonLoading]}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>
                {isLogin ? 'Login' : 'Create Account'}
              </Text>
            )}
          </TouchableOpacity>

          {!isLogin && (
            <Text style={styles.termsText}>
              By signing up, you agree to our{' '}
              <Text style={styles.termsLink}>Terms of Service</Text> and{' '}
              <Text style={styles.termsLink}>Privacy Policy</Text>
            </Text>
          )}
        </View>
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
    padding: 20,
  },
  notification: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    padding: 15,
    borderRadius: 8,
    zIndex: 1000,
  },
  notificationsuccess: {
    backgroundColor: '#4caf50',
  },
  notificationerror: {
    backgroundColor: '#f44336',
  },
  notificationinfo: {
    backgroundColor: '#2196f3',
  },
  notificationText: {
    color: '#fff',
    textAlign: 'center',
  },
  brandSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  logoSubtext: {
    fontSize: 14,
    color: '#666',
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
    textAlign: 'center',
  },
  brandSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  features: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  feature: {
    fontSize: 12,
    color: '#666',
    marginHorizontal: 10,
  },
  formSection: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  formHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  toggleContainer: {
    flexDirection: 'row',
  },
  toggleText: {
    fontSize: 14,
    color: '#666',
  },
  toggleLink: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: 'bold',
  },
  field: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    color: '#333',
  },
  inputError: {
    borderColor: '#f44336',
  },
  verifiedInput: {
    borderColor: '#4caf50',
    backgroundColor: '#f0fff0',
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  passwordInput: {
    flex: 1,
    paddingRight: 60,
  },
  passwordToggle: {
    position: 'absolute',
    right: 10,
    padding: 5,
  },
  passwordToggleText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  verifyGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  verifyInput: {
    flex: 1,
    marginRight: 10,
  },
  verifyButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
  },
  verifyButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  verifiedBadge: {
    backgroundColor: '#4caf50',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
  },
  verifiedText: {
    color: '#fff',
    fontSize: 12,
  },
  grid: {
    marginBottom: 10,
  },
  pickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  genderOption: {
    flex: 1,
    padding: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginHorizontal: 5,
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
  },
  genderOptionSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  genderOptionText: {
    color: '#333',
  },
  genderOptionTextSelected: {
    color: '#fff',
  },
  checkboxGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  checkboxLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
    marginBottom: 10,
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
  checkboxText: {
    fontSize: 14,
    color: '#333',
  },
  textArea: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
    minHeight: 100,
    color: '#333',
    textAlignVertical: 'top',
  },
  fileButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  fileButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  fileName: {
    marginTop: 5,
    fontSize: 12,
    color: '#666',
  },
  options: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxLabel: {
    marginLeft: 5,
    fontSize: 14,
    color: '#666',
  },
  forgotLink: {
    fontSize: 14,
    color: '#007AFF',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonLoading: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  termsText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 15,
  },
  termsLink: {
    color: '#007AFF',
  },
  errorText: {
    color: '#f44336',
    fontSize: 12,
    marginTop: 5,
  },
  deviceConflictBox: {
    backgroundColor: '#e3f2fd',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  deviceConflictText: {
    color: '#007AFF',
    marginBottom: 10,
    textAlign: 'center',
    fontWeight: '600',
  },
  deviceActionButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  deviceActionText: {
    color: '#fff',
    fontWeight: '600',
  },
  deviceVerifyButton: {
    backgroundColor: '#4caf50',
  },
  deviceOtpRow: {
    marginTop: 10,
  },
  deviceOtpInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
    backgroundColor: '#f9f9f9',
    color: '#333',
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
    width: '85%',
    maxWidth: 400,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalIconWrapper: {
    marginRight: 10,
  },
  modalIcon: {
    fontSize: 24,
  },
  modalTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalClose: {
    padding: 5,
  },
  modalCloseText: {
    fontSize: 20,
    color: '#999',
  },
  modalBody: {
    padding: 20,
  },
  modalText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
  },
  modalRecipient: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 20,
  },
  otpInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 20,
    textAlign: 'center',
    letterSpacing: 4,
    marginBottom: 15,
    backgroundColor: '#f9f9f9',
    color: '#333',
  },
  otpInputSuccess: {
    borderColor: '#4caf50',
    backgroundColor: '#f0fff0',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  verifyButton: {
    backgroundColor: '#007AFF',
  },
  resendButton: {
    backgroundColor: '#4caf50',
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  successContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
  successText: {
    color: '#4caf50',
    fontSize: 14,
  },
});

export default CounselorSignup;