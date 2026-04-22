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
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../../axiosConfig';
import OtpCodeInput from './components/OtpCodeInput';
import { setAccessToken, setUserEmail, updateVerificationStatus } from './authUtils';

const OTPVerification = ({ navigation }) => {
  const [step, setStep] = useState('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [timer, setTimer] = useState(120);
  const [canResend, setCanResend] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

        if (token) {
          await setAccessToken(token);
        }

        await updateVerificationStatus(true);
        await AsyncStorage.setItem('userRole', 'user');
        await AsyncStorage.setItem('isAuthenticated', 'true');
        await AsyncStorage.setItem('userEmail', email);

        setSuccess('Login successful');

        setTimeout(() => navigation.replace('UserDashboard'), 1500);
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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.title}>
            {step === 'email' ? 'Login with Email' : 'Verify OTP'}
          </Text>

          {step === 'email' ? (
            <View>
              <TextInput
                style={styles.input}
                placeholder="Enter email"
                placeholderTextColor="#999"
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
                style={[styles.button, isLoading && styles.buttonDisabled]}
                onPress={handleSendCode}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Send OTP</Text>
                )}
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
                focusedBoxStyle={styles.otpDigitBoxFocused}
                textStyle={styles.otpDigitText}
              />

              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              {success ? <Text style={styles.successText}>{success}</Text> : null}

              <View style={styles.timerContainer}>
                {canResend ? (
                  <TouchableOpacity onPress={handleResendOtp} disabled={isLoading}>
                    <Text style={styles.resendText}>Resend OTP</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.timerText}>Resend in {formatTime(timer)}</Text>
                )}
              </View>

              <TouchableOpacity
                style={[
                  styles.button,
                  (otp.length !== 6 || isLoading) && styles.buttonDisabled
                ]}
                onPress={handleVerifyOtp}
                disabled={otp.length !== 6 || isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Verify OTP</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 30,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
    marginBottom: 30,
  },
  input: {
    width: '100%',
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    backgroundColor: '#fff',
    marginBottom: 15,
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
    borderColor: '#4facfe',
  },
  otpDigitText: {
    color: '#333',
  },
  button: {
    backgroundColor: '#4facfe',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
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
    color: '#4facfe',
    fontWeight: '600',
  },
});

export default OTPVerification;
