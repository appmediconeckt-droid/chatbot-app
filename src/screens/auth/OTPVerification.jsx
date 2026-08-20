import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../../axiosConfig';
import OtpCodeInput from './components/OtpCodeInput';
import { setAccessToken, setUserEmail, updateVerificationStatus } from './authUtils';
import useLanguageRender from '../../hooks/useLanguageRender';
import AuthBackground from '../../theme/AuthBackground';
import { GRADIENT_DIRECTION, gradientForRole, paletteForRole } from '../../theme/palette';

const OTPVerification = ({ navigation, route }) => {
  const { t } = useLanguageRender();
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [timer, setTimer] = useState(120);
  const [canResend, setCanResend] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [authRole, setAuthRole] = useState('user');

  const normalizeRole = (role) => {
    const value = String(role || '').trim().toLowerCase();
    if (!value) return '';
    return value.replace('counsellor', 'counselor');
  };

  const C = paletteForRole(authRole);
  const activeGradient = gradientForRole(authRole);

  useEffect(() => {
    const resolveRole = async () => {
      const routeRole = normalizeRole(route?.params?.role);
      if (routeRole) {
        setAuthRole(routeRole);
        return;
      }

      const storedRole =
        normalizeRole(await AsyncStorage.getItem('role')) ||
        normalizeRole(await AsyncStorage.getItem('userRole'));

      setAuthRole(storedRole || 'user');
    };

    resolveRole();
  }, [route?.params?.role]);

  // ✅ TIMER (2 MIN)
  useEffect(() => {
    let interval;

    if (step === 'otp' && timer > 0 && !canResend) {
      interval = setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [step, timer, canResend]);

  // ✅ FORMAT TIMER MM:SS
  const formatTime = (time) => {
    const min = Math.floor(time / 60);
    const sec = time % 60;
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  // ✅ SEND OTP
  const handleSendCode = async () => {
    if (!email) {
      setError('Enter valid email');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await axios.post(`${API_BASE_URL}/api/auth/generateOtp`, {
        email
      });

      if (res.data.success) {
        setStep('otp');
        setOtp('');
        setTimer(120);
        setCanResend(false);
        await setUserEmail(email);
        setSuccess('OTP sent successfully');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ VERIFY OTP
  const handleVerifyOtp = async () => {
    if (otp.length !== 6) {
      setError('Enter complete OTP');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const res = await axios.post(`${API_BASE_URL}/api/auth/verifyOtp`, {
        email,
        otp
      });

      if (res.data.success) {
        const token = res.data?.token || res.data?.accessToken;
        const resolvedRole = normalizeRole(
          res.data?.user?.role || res.data?.role || authRole
        );
        const resolvedId = res.data?.user?._id || res.data?.user?.id;

        if (token) {
          await setAccessToken(token);
        }

        await updateVerificationStatus(true);
        await AsyncStorage.setItem('userRole', resolvedRole);
        await AsyncStorage.setItem('isAuthenticated', 'true');
        await AsyncStorage.setItem('userEmail', email);

        if (res.data?.user) {
          await AsyncStorage.setItem('userData', JSON.stringify(res.data.user));
        }

        if (resolvedId) {
          if (resolvedRole === 'counselor') {
            await AsyncStorage.setItem('counsellorId', String(resolvedId));
          } else {
            await AsyncStorage.setItem('userId', String(resolvedId));
          }
        }

        setSuccess('Login successful');

        setTimeout(() => {
          if (resolvedRole === 'counselor') {
            navigation.replace('LocationGate', { destination: 'CounselorDashboard' });
          } else {
            navigation.replace('LocationGate', { destination: 'UserDashboard' });
          }
        }, 1500);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP');
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ RESEND OTP
  const handleResendOtp = async () => {
    if (!canResend) return;

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await axios.post(
        `${API_BASE_URL}/api/auth/resendOtp`,
        { email }
      );

      if (res.data.success) {
        setSuccess('OTP resent successfully');
        setTimer(120);
        setCanResend(false);

        setOtp('');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Resend failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <AuthBackground role={authRole} style={styles.background}>
        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              contentContainerStyle={styles.scrollContainer}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            >
              <View style={styles.card}>
                <Text style={[styles.title, { color: C.text }]}>
                  {step === 'email' ? 'Login with Email' : 'Verify OTP'}
                </Text>

                {step === 'email' ? (
                  <View>
                    <TextInput
                      style={[styles.input, { borderColor: C.border }]}
                      placeholder={t('Enter email')}
                      placeholderTextColor="#94a3b8"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      editable={!isLoading}
                    />

                    {error ? <Text style={styles.errorText}>{error}</Text> : null}
                    {success ? <Text style={styles.successText}>{success}</Text> : null}

                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={handleSendCode}
                      disabled={isLoading}
                    >
                      <LinearGradient
                        colors={isLoading ? ['#cbd5e1', '#cbd5e1'] : activeGradient}
                        {...GRADIENT_DIRECTION}
                        style={styles.button}
                      >
                        {isLoading ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text style={styles.buttonText}>{t('Send OTP')}</Text>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View>
                    <OtpCodeInput
                      value={otp}
                      onChangeText={setOtp}
                      autoFocus={true}
                      containerStyle={styles.otpContainer}
                      boxStyle={styles.otpDigitBox}
                      focusedBoxStyle={[styles.otpDigitBoxFocused, { borderColor: C.primary }]}
                      textStyle={styles.otpDigitText}
                    />

                    {error ? <Text style={styles.errorText}>{error}</Text> : null}
                    {success ? <Text style={styles.successText}>{success}</Text> : null}

                    <View style={styles.timerContainer}>
                      {canResend ? (
                        <TouchableOpacity onPress={handleResendOtp} disabled={isLoading}>
                          <Text style={[styles.resendText, { color: C.primary }]}>{t('Resend OTP')}</Text>
                        </TouchableOpacity>
                      ) : (
                        <Text style={styles.timerText}>Resend in {formatTime(timer)}</Text>
                      )}
                    </View>

                    <TouchableOpacity
                      activeOpacity={0.9}
                      onPress={handleVerifyOtp}
                      disabled={otp.length !== 6 || isLoading}
                    >
                      <LinearGradient
                        colors={(otp.length !== 6 || isLoading) ? ['#cbd5e1', '#cbd5e1'] : activeGradient}
                        {...GRADIENT_DIRECTION}
                        style={styles.button}
                      >
                        {isLoading ? (
                          <ActivityIndicator color="#fff" />
                        ) : (
                          <Text style={styles.buttonText}>{t('Verify OTP')}</Text>
                        )}
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </AuthBackground>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: { flex: 1, overflow: 'hidden' },
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 48,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 28,
    padding: 28,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 24,
    elevation: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 26,
  },
  input: {
    width: '100%',
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    marginBottom: 15,
    color: '#0f172a',
    fontWeight: '600',
  },
  otpContainer: {
    width: '100%',
    marginBottom: 20,
  },
  otpDigitBox: {
    borderColor: '#e0e0e0',
    backgroundColor: '#fff',
  },
  otpDigitBoxFocused: {
    borderWidth: 2,
  },
  otpDigitText: {
    color: '#333',
  },
  button: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: '#ff4d4f',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 10,
  },
  successText: {
    color: '#28a745',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 10,
  },
  timerContainer: {
    alignItems: 'center',
    marginVertical: 15,
  },
  timerText: {
    fontSize: 14,
    color: '#666',
  },
  resendText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default OTPVerification;
