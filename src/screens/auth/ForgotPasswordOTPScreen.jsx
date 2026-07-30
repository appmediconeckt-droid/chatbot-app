import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  SafeAreaView,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import Ionicons from "react-native-vector-icons/Ionicons";
import axios from "axios";
import { API_BASE_URL } from "../../axiosConfig";
import useLanguageRender from '../../hooks/useLanguageRender';

export default function ForgotPasswordOTPScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const email = route.params?.email || "";

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    if (!email) {
      navigation.navigate("ForgotPassword");
      return;
    }

    // Start resend timer
    if (!canResend) {
      const timer = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [email, navigation, canResend]);

  const handleVerifyOTP = async () => {
    setError("");

    if (!otp || otp.length !== 6) {
      setError("Please enter a valid 6-digit OTP");
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post(
        `${API_BASE_URL}/api/auth/verify-forgot-password-otp`,
        { email, otp },
        { withCredentials: true }
      );

      if (response.data.success) {
        Alert.alert("Success", "OTP verified successfully!", [
          {
            text: "OK",
            onPress: () => {
              navigation.navigate("ResetPassword", { email });
            },
          },
        ]);
      } else {
        setError(response.data.message || "Invalid OTP");
      }
    } catch (err) {
      const errorMsg =
        err.response?.data?.message ||
        err.message ||
        "Verification failed. Please try again.";
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setError("");
    try {
      setResending(true);
      const response = await axios.post(
        `${API_BASE_URL}/api/auth/send-forgot-password-otp`,
        { email },
        { withCredentials: true }
      );

      if (response.data.success) {
        setResendTimer(60);
        setCanResend(false);
        Alert.alert("Success", "OTP resent to your email");
      } else {
        setError(response.data.message || "Failed to resend OTP");
      }
    } catch (err) {
      const errorMsg =
        err.response?.data?.message ||
        err.message ||
        "Failed to resend OTP. Please try again.";
      setError(errorMsg);
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Back Button */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#2c50cd" />
        </TouchableOpacity>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconWrapper}>
            <Ionicons name="mail-outline" size={48} color="#2c50cd" />
          </View>
          <Text style={styles.title}>{t('Verify OTP')}</Text>
          <Text style={styles.subtitle}>{t('Enter the 6-digit code sent to')}</Text>
          <Text style={styles.emailDisplay}>{email}</Text>
        </View>

        {/* Error Message */}
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠️ {error}</Text>
          </View>
        ) : null}

        {/* OTP Input */}
        <View style={styles.form}>
          <Text style={styles.label}>{t('One-Time Password *')}</Text>
          <View style={styles.inputWrapper}>
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color="#64748b"
              style={styles.inputIcon}
            />
            <TextInput
              style={styles.input}
              placeholder={t('000000')}
              placeholderTextColor="#94a3b8"
              value={otp}
              onChangeText={(text) => {
                setOtp(text.replace(/[^0-9]/g, "").slice(0, 6));
                setError("");
              }}
              keyboardType="numeric"
              maxLength={6}
              editable={!loading}
            />
          </View>
        </View>

        {/* Verify Button */}
        <TouchableOpacity
          style={[styles.verifyBtn, loading && styles.verifyBtnDisabled]}
          onPress={handleVerifyOTP}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.verifyBtnText}>{t('Verify OTP')}</Text>
          )}
        </TouchableOpacity>

        {/* Resend OTP */}
        <View style={styles.resendBox}>
          <Text style={styles.resendText}>{t("Didn't receive OTP?")}</Text>
          {canResend ? (
            <TouchableOpacity onPress={handleResendOTP} disabled={resending}>
              <Text style={styles.resendLink}>
                {resending ? "Resending..." : "Resend OTP"}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.resendDisabled}>Resend in {resendTimer}s</Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  iconWrapper: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#f0f4ff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#081625",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
  },
  emailDisplay: {
    fontSize: 15,
    fontWeight: "600",
    color: "#2c50cd",
    marginTop: 8,
  },
  errorBox: {
    backgroundColor: "#fef2f2",
    borderLeftWidth: 4,
    borderLeftColor: "#ef4444",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 8,
    marginBottom: 20,
  },
  errorText: {
    color: "#dc2626",
    fontSize: 14,
    fontWeight: "500",
  },
  form: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 20,
    color: "#1e293b",
    letterSpacing: 4,
  },
  verifyBtn: {
    backgroundColor: "#2c50cd",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 20,
    elevation: 2,
    shadowColor: "#2c50cd",
    shadowOpacity: 0.3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  verifyBtnDisabled: {
    opacity: 0.6,
  },
  verifyBtnText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  resendBox: {
    alignItems: "center",
    gap: 4,
  },
  resendText: {
    fontSize: 14,
    color: "#64748b",
  },
  resendLink: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2c50cd",
  },
  resendDisabled: {
    fontSize: 14,
    fontWeight: "600",
    color: "#cbd5e1",
  },
});
