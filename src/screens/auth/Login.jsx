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
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const Login = ({ navigation }) => {
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

  useEffect(() => {
    loadRememberedUser();
  }, []);

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
      setErrorMessage('Please enter your email');
      return false;
    }
    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(email)) {
      setErrorMessage('Please enter a valid email address');
      return false;
    }
    return true;
  };

  const handleLogin = async () => {
    if (!validateEmail()) return;
    if (!password) {
      setErrorMessage('Please enter your password');
      return;
    }

    setErrorMessage('');
    setSuccessMessage('');
    setIsLoading(true);

    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/auth/login`,
        { email, password },
        { withCredentials: true }
      );

      // IMPORTANT: Only store tokens if remember me is checked (matching web version)
      if (rememberMe) {
        await AsyncStorage.setItem('rememberedUserId', email);
      } else {
        await AsyncStorage.removeItem('rememberedUserId');
      }

      // Navigate to dashboard - NO TOKEN STORAGE HERE (matches web version)
      navigation.replace('UserDashboard');
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
      const response = await axios.post(
        `${API_BASE_URL}/api/auth/verify-login-otp`,
        { email, otp },
        { withCredentials: true }
      );

      // Store tokens exactly like web version
      if (response.data?.accessToken) {
        await AsyncStorage.setItem('accessToken', response.data.accessToken);
      }
      if (response.data?.refreshToken) {
        await AsyncStorage.setItem('refreshToken', response.data.refreshToken);
      }

      setShowConflictModal(false);
      setSuccessMessage('OTP verified! Redirecting...');
      
      // Navigate after success message
      setTimeout(() => {
        navigation.replace('UserDashboard');
      }, 1200);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'OTP verification failed';
      setErrorMessage(msg);
      setTimeout(() => setErrorMessage(''), 3000);
    } finally {
      setOtpLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.loginCard}>
          {/* Header Section */}
          <View style={styles.headerSection}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoText}>Mediconect</Text>
            </View>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Login with your email and password</Text>
          </View>

          {/* Form Section */}
          <View style={styles.formContainer}>
            {/* Email Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
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
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="Enter your password"
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
                <Text style={styles.checkboxLabel}>Remember me</Text>
              </TouchableOpacity>
              
              <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
                <Text style={styles.forgotPassword}>Forgot Password?</Text>
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
                <Text style={styles.loginButtonText}>Login</Text>
              )}
            </TouchableOpacity>

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
              <Text style={styles.footerText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('RoleSelector')}>
                <Text style={styles.signUpLink}> Sign Up</Text>
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
    justifyContent: 'center',
    padding: 20,
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
});

export default Login;