import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Dimensions,
  SafeAreaView,
  Modal,
  StatusBar,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/FontAwesome5';
import axiosInstance from '../../axiosConfig';
import safeVibrate from '../../utils/safeVibrate';
import { Colors, Spacing, Typography } from '../../styles/globalStyles';

const { width, height } = Dimensions.get('window');

const Login = ({ navigation }) => {
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  
  // State for login credentials
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Error Queue System
  const [errorQueue, setErrorQueue] = useState([]);
  const [currentError, setCurrentError] = useState(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [isConnected, setIsConnected] = useState(true);

  const passwordInputRef = useRef(null);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
    
    // Check network
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected);
    });

    // Load remembered user
    loadRememberedUser();

    return () => unsubscribe();
  }, []);

  const loadRememberedUser = async () => {
    try {
      const savedId = await AsyncStorage.getItem('rememberedUserId');
      if (savedId) {
        setUserId(savedId);
        setRememberMe(true);
      }
    } catch (e) {}
  };

  const ErrorTypes = {
    VALIDATION: 'validation',
    NETWORK: 'network',
    AUTH: 'authentication',
    SERVER: 'server',
    UNKNOWN: 'unknown'
  };

  const addErrorToQueue = (errorMessage, errorType = ErrorTypes.UNKNOWN, field = null) => {
    const newError = {
      id: Date.now().toString(),
      message: errorMessage,
      type: errorType,
      field: field,
    };
    setErrorQueue(prev => [...prev, newError]);
    safeVibrate(100);
  };

  useEffect(() => {
    if (errorQueue.length > 0 && !currentError && !showErrorModal) {
      const nextError = errorQueue[0];
      setCurrentError(nextError);
      setShowErrorModal(true);
    }
  }, [errorQueue, currentError, showErrorModal]);

  const handleErrorDismiss = () => {
    setErrorQueue(prev => prev.slice(1));
    setCurrentError(null);
    setShowErrorModal(false);
  };

  const handleLogin = async () => {
    if (!isConnected) {
      addErrorToQueue('No internet connection', ErrorTypes.NETWORK);
      return;
    }

    if (!userId || !password) {
      addErrorToQueue('Please fill in all fields', ErrorTypes.VALIDATION);
      return;
    }

    setIsLoading(true);
    try {
      const response = await axiosInstance.post('/api/auth/login', {
        email: userId.trim(),
        password: password,
      });

      const data = response.data;
      const token = data.token || data.accessToken;
      const normalizedRole = String(
        data.user?.role || data.role || data.userRole || 'user'
      )
        .toLowerCase()
        .replace('counsellor', 'counselor');

      if (token) {
        setSuccessMessage('Login successful!');
        
        // Token and storage
        await AsyncStorage.multiRemove(['userData', 'userId', 'counsellorId', 'userRole']);
        await AsyncStorage.setItem('accessToken', token);
        await AsyncStorage.setItem('token', token);
        if (data.refreshToken) await AsyncStorage.setItem('refreshToken', data.refreshToken);
        
        if (data.user) {
          await AsyncStorage.setItem('userData', JSON.stringify(data.user));
          await AsyncStorage.setItem('userRole', normalizedRole);
          await AsyncStorage.setItem('userEmail', data.user.email);

          if (normalizedRole === 'counselor' && data.user._id) {
            await AsyncStorage.setItem('counsellorId', data.user._id);
          } else if (data.user._id) {
            await AsyncStorage.setItem('userId', data.user._id);
          }
          
          if (rememberMe) {
            await AsyncStorage.setItem('rememberedUserId', userId);
          } else {
            await AsyncStorage.removeItem('rememberedUserId');
          }

          // Navigation based on role
          setTimeout(() => {
            if (normalizedRole === 'counselor') {
              navigation.replace('CounselorDashboard');
            } else {
              navigation.replace('UserDashboard');
            }
          }, 800);
        } else {
          setIsLoading(false);
          addErrorToQueue('Login response is missing user details', ErrorTypes.SERVER);
        }
      } else {
        setIsLoading(false);
        addErrorToQueue(data.message || 'Login failed', ErrorTypes.AUTH);
      }
    } catch (error) {
      setIsLoading(false);
      const message = error.response?.data?.message || 'Server Error. Please try again.';
      addErrorToQueue(message, ErrorTypes.SERVER);
      console.error('Login error:', error);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={[Colors.primaryDark, Colors.primary, Colors.background]}
        style={styles.background}
      >
        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
          >
            <ScrollView 
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                {/* Brand Header */}
                <View style={styles.header}>
                  <LinearGradient
                    colors={[Colors.secondary, Colors.accent]}
                    style={styles.logoIcon}
                  >
                    <Icon name="heartbeat" size={30} color={Colors.white} />
                  </LinearGradient>
                  <Text style={styles.logoText}>
                    Medi<Text style={styles.logoHighlight}>Coneckt</Text>
                  </Text>
                  <Text style={styles.welcomeText}>Welcome Back</Text>
                  <Text style={styles.subtext}>Please login to your account</Text>
                </View>

                {/* Login Card */}
                <View style={styles.card}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>User ID</Text>
                    <View style={styles.inputWrapper}>
                      <Icon name="user" size={18} color={Colors.primary} style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="Enter your ID"
                        placeholderTextColor="#000000"
                        value={userId}
                        onChangeText={setUserId}
                        autoCapitalize="none"
                        returnKeyType="next"
                        onSubmitEditing={() => passwordInputRef.current?.focus()}
                      />
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Password</Text>
                    <View style={styles.inputWrapper}>
                      <Icon name="lock" size={18} color={Colors.primary} style={styles.inputIcon} />
                      <TextInput
                        ref={passwordInputRef}
                        style={styles.input}
                        placeholder="••••••••"
                        placeholderTextColor="#000000"
                        secureTextEntry={!showPassword}
                        value={password}
                        onChangeText={setPassword}
                        returnKeyType="done"
                        onSubmitEditing={handleLogin}
                      />
                      <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                        <Icon 
                          name={showPassword ? "eye-slash" : "eye"} 
                          size={18} 
                          color={Colors.textLight} 
                        />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <View style={styles.optionsRow}>
                    <TouchableOpacity 
                      style={styles.rememberRow}
                      onPress={() => setRememberMe(!rememberMe)}
                    >
                      <View style={[styles.checkbox, rememberMe && styles.checkboxActive]}>
                        {rememberMe && <Icon name="check" size={12} color={Colors.white} />}
                      </View>
                      <Text style={styles.rememberText}>Remember me</Text>
                    </TouchableOpacity>
                    <TouchableOpacity>
                      <Text style={styles.forgotText}>Forgot Password?</Text>
                    </TouchableOpacity>
                  </View>

                  {successMessage ? (
                    <View style={styles.successBox}>
                      <Text style={styles.successText}>{successMessage}</Text>
                    </View>
                  ) : null}

                  <TouchableOpacity 
                    style={[styles.loginBtn, isLoading && styles.loginBtnDisabled]}
                    onPress={handleLogin}
                    disabled={isLoading}
                  >
                    <LinearGradient
                      colors={[Colors.primary, Colors.primaryDark]}
                      style={styles.loginBtnGradient}
                    >
                      {isLoading ? (
                        <ActivityIndicator color={Colors.white} />
                      ) : (
                        <Text style={styles.loginBtnText}>Login Now</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                  <Text style={styles.footerText}>Don't have an account?</Text>
                  <TouchableOpacity onPress={() => navigation.navigate('RoleSelector')}>
                    <Text style={styles.signupLink}>Sign Up</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>

      {/* Error Modal */}
      <Modal
        visible={showErrorModal}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconBox}>
              <Icon name="exclamation-circle" size={40} color={Colors.error} />
            </View>
            <Text style={styles.modalTitle}>Error</Text>
            <Text style={styles.modalMessage}>{currentError?.message}</Text>
            <TouchableOpacity style={styles.modalBtn} onPress={handleErrorDismiss}>
              <Text style={styles.modalBtnText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: height * 0.05,
    paddingBottom: Spacing.xl,
  },
  content: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  logoIcon: {
    width: 70,
    height: 70,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    elevation: 10,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  logoText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.white,
    marginBottom: Spacing.sm,
  },
  logoHighlight: {
    color: Colors.accent,
  },
  welcomeText: {
    ...Typography.h1,
    color: Colors.white,
    marginTop: Spacing.md,
  },
  subtext: {
    ...Typography.body,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: Spacing.xs,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 30,
    padding: Spacing.lg,
    elevation: 20,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    marginTop: Spacing.md,
  },
  inputGroup: {
    marginBottom: Spacing.lg,
  },
  label: {
    ...Typography.bodySmall,
    color: Colors.text,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    paddingHorizontal: Spacing.md,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  inputIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    height: 55,
    fontSize: 16,
    color: '#1A202C',
    fontWeight: '500',
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.primary,
    marginRight: Spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxActive: {
    backgroundColor: Colors.primary,
  },
  rememberText: {
    fontSize: 14,
    color: '#4A5568',
  },
  forgotText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: 'bold',
  },
  loginBtn: {
    height: 55,
    borderRadius: 15,
    overflow: 'hidden',
    marginTop: Spacing.md,
  },
  loginBtnDisabled: {
    opacity: 0.7,
  },
  loginBtnGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginBtnText: {
    fontSize: 18,
    color: Colors.white,
    fontWeight: 'bold',
  },
  successBox: {
    backgroundColor: '#DCFCE7',
    padding: Spacing.sm,
    borderRadius: 10,
    marginBottom: Spacing.md,
    alignItems: 'center',
  },
  successText: {
    fontSize: 14,
    color: Colors.success,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  footerText: {
    fontSize: 16,
    color: '#2D3748',
  },
  signupLink: {
    fontSize: 16,
    color: Colors.secondary,
    fontWeight: 'bold',
    marginLeft: Spacing.xs,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderRadius: 25,
    padding: Spacing.xl,
    alignItems: 'center',
    width: '100%',
    elevation: 25,
  },
  modalIconBox: {
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: 24,
    color: Colors.error,
    marginBottom: Spacing.sm,
  },
  modalMessage: {
    fontSize: 16,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  modalBtn: {
    backgroundColor: '#F1F5F9',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xxl,
    borderRadius: 12,
  },
  modalBtnText: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: 'bold',
  },
});

export default Login;