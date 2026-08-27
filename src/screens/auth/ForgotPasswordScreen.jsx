import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import useLanguageRender from '../../hooks/useLanguageRender';
import { getApiErrorMessage, isOtpRequestSuccessful, postPublicAuthEndpoint } from "./authUtils";

const ForgotPasswordScreen = () => {
  const { t } = useLanguageRender();
  const navigation = useNavigation();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSendOTP = async () => {
    setError("");

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setError("Please enter email");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setError("Please enter a valid email");
      return;
    }

    try {
      setLoading(true);
      const response = await postPublicAuthEndpoint("send-forgot-password-otp", {
        email: cleanEmail,
      });

      if (isOtpRequestSuccessful(response)) {
        Alert.alert("Success", "OTP sent to email", [
          {
            text: "OK",
            onPress: () => {
              navigation.navigate("ForgotPasswordOTP", { email: cleanEmail });
            },
          },
        ]);
      } else {
        setError("Failed to send OTP");
      }
    } catch (err) {
      setError("Error: " + getApiErrorMessage(err, "Failed to send OTP"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backBtn}>← Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{t('Forgot Password')}</Text>
        <Text style={styles.subtitle}>{t('Enter your email to reset password')}</Text>

        {error && <Text style={styles.errorText}>{error}</Text>}

        <TextInput
          style={styles.input}
          placeholder={t('Enter email')}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleSendOTP}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? "Sending..." : "Send OTP"}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate("Login")}>
          <Text style={styles.linkText}>{t('Back to Login')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  content: {
    flex: 1,
    padding: 20,
  },
  backBtn: {
    fontSize: 18,
    color: "#2c50cd",
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 30,
  },
  errorText: {
    color: "red",
    fontSize: 14,
    marginBottom: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    fontSize: 16,
  },
  button: {
    backgroundColor: "#2c50cd",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 20,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  linkText: {
    color: "#2c50cd",
    fontSize: 14,
    textAlign: "center",
  },
});

export default ForgotPasswordScreen;
