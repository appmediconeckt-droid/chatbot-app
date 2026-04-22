import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Animated,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Icon from "react-native-vector-icons/FontAwesome5";
import LinearGradient from "react-native-linear-gradient";
import { Picker } from "@react-native-picker/picker";
import axiosInstance from "../../axiosConfig";
import OtpCodeInput from "./components/OtpCodeInput";
import { Colors, Spacing, Typography } from "../../styles/globalStyles";

const { width, height } = Dimensions.get("window");

const UserSignup = () => {
  const navigation = useNavigation();
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  const [isLogin, setIsLogin] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    anonymous: "",
    phoneNumber: "",
    age: "",
    gender: "",
    confirmPassword: "",
  });

  // Verification states
  const [emailVerified, setEmailVerified] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [showEmailOtpModal, setShowEmailOtpModal] = useState(false);
  const [showPhoneOtpModal, setShowPhoneOtpModal] = useState(false);
  const [emailOtp, setEmailOtp] = useState("");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [isSendingEmailOtp, setIsSendingEmailOtp] = useState(false);
  const [isSendingPhoneOtp, setIsSendingPhoneOtp] = useState(false);
  const [isVerifyingEmailOtp, setIsVerifyingEmailOtp] = useState(false);
  const [isVerifyingPhoneOtp, setIsVerifyingPhoneOtp] = useState(false);
  const [emailOtpError, setEmailOtpError] = useState("");
  const [phoneOtpError, setPhoneOtpError] = useState("");
  const [emailOtpSuccess, setEmailOtpSuccess] = useState(false);
  const [phoneOtpSuccess, setPhoneOtpSuccess] = useState(false);
  const [emailResendTimer, setEmailResendTimer] = useState(0);
  const [phoneResendTimer, setPhoneResendTimer] = useState(0);

  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [showVerifyButton, setShowVerifyButton] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifySuccess, setVerifySuccess] = useState(false);
  const [notification, setNotification] = useState({
    show: false,
    message: "",
    type: "",
  });

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
  }, []);

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

  // ✅ FIX: Send email OTP automatically when modal opens
  useEffect(() => {
    if (showEmailOtpModal) {
      handleSendEmailOtp();
    }
  }, [showEmailOtpModal]);

  // ✅ FIX: Send phone OTP automatically when modal opens
  useEffect(() => {
    if (showPhoneOtpModal) {
      handleSendPhoneOtp();
    }
  }, [showPhoneOtpModal]);

  useEffect(() => {
    checkToken();
  }, []);

  const checkToken = async () => {
    try {
      const token =
        (await AsyncStorage.getItem("accessToken")) ||
        (await AsyncStorage.getItem("token"));
      const userRole = await AsyncStorage.getItem("userRole");

      if (token && userRole === "user") {
        navigation.replace("UserDashboard");
      }
    } catch (error) {
      console.error("Error checking saved user session:", error);
    }
  };

  const showNotification = (message, type = "success") => {
    Alert.alert(
      type === "success" ? "Success" : type === "error" ? "Error" : "Info",
      message,
      [{ text: "OK" }]
    );
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: "", type: "" });
    }, 3000);
  };

  const handleChange = (name, value) => {
    setFormData({ ...formData, [name]: value });

    if (errors[name]) {
      setErrors({ ...errors, [name]: "" });
    }
    if (apiError) {
      setApiError("");
    }

    if (name === "email") setEmailVerified(false);
    if (name === "phoneNumber") setPhoneVerified(false);
  };

  const validateLogin = () => {
    const newErrors = {};
    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email is invalid";
    }
    if (!formData.password) {
      newErrors.password = "Password is required";
    }
    return newErrors;
  };

  const validateSignup = () => {
    const newErrors = {};

    if (!formData.fullName) newErrors.fullName = "Full name is required";
    if (!formData.anonymous) newErrors.anonymous = "Anonymous name is required";

    if (!formData.email) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email is invalid";
    } else if (!emailVerified) {
      newErrors.email = "Please verify your email first";
    }

    if (!formData.phoneNumber) {
      newErrors.phoneNumber = "Phone number is required";
    } else if (!/^\d{10}$/.test(formData.phoneNumber)) {
      newErrors.phoneNumber = "Phone number must be 10 digits";
    } else if (!phoneVerified) {
      newErrors.phoneNumber = "Please verify your phone number first";
    }

    if (!formData.age) {
      newErrors.age = "Age is required";
    } else if (formData.age < 13 || formData.age > 120) {
      newErrors.age = "Age must be between 13 and 120";
    }

    if (!formData.gender) newErrors.gender = "Gender is required";

    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 3) {
      newErrors.password = "Password must be at least 3 characters";
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm password";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    return newErrors;
  };

  const resetEmailOtpState = () => {
    setEmailOtp("");
    setEmailOtpError("");
    setEmailOtpSuccess(false);
    setEmailResendTimer(0);
  };

  const resetPhoneOtpState = () => {
    setPhoneOtp("");
    setPhoneOtpError("");
    setPhoneOtpSuccess(false);
    setPhoneResendTimer(0);
  };

  const handleSendEmailOtp = async () => {
    if (!formData.email) {
      setEmailOtpError("Please enter email first");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      setEmailOtpError("Please enter a valid email address");
      return;
    }

    try {
      setIsSendingEmailOtp(true);
      setEmailOtpError("");

      const response = await axiosInstance.post(
        `/api/auth/send-email-otp`,
        {
          email: formData.email,
        },
      );

      if (response.data.success) {
        showNotification("OTP sent to email successfully!", "success");
        setEmailResendTimer(60);
      } else {
        setEmailOtpError(response.data.message || "Failed to send OTP");
      }
    } catch (error) {
      console.error("Send email OTP error:", error);
      setEmailOtpError(error.response?.data?.message || "Failed to send OTP. Please try again.");
    } finally {
      setIsSendingEmailOtp(false);
    }
  };

  const handleVerifyEmailOtp = async () => {
    if (!emailOtp || emailOtp.length !== 6) {
      setEmailOtpError("Please enter 6-digit OTP");
      return;
    }

    try {
      setIsVerifyingEmailOtp(true);
      setEmailOtpError("");

      const response = await axiosInstance.post(
        `/api/auth/verify-email-otp`,
        {
          email: formData.email,
          otp: emailOtp,
        },
      );

      if (response.data.success) {
        setEmailOtpSuccess(true);
        setEmailVerified(true);
        showNotification("Email verified successfully!", "success");
        setTimeout(() => {
          setShowEmailOtpModal(false);
          resetEmailOtpState();
        }, 1500);
      } else {
        setEmailOtpError(response.data.message || "Invalid OTP");
      }
    } catch (error) {
      console.error("Verify email OTP error:", error);
      setEmailOtpError(error.response?.data?.message || "Verification failed. Please try again.");
    } finally {
      setIsVerifyingEmailOtp(false);
    }
  };

  const handleSendPhoneOtp = async () => {
    if (!formData.phoneNumber) {
      setPhoneOtpError("Please enter phone number first");
      return;
    }
    if (!/^\d{10}$/.test(formData.phoneNumber)) {
      setPhoneOtpError("Please enter a valid 10-digit phone number");
      return;
    }

    try {
      setIsSendingPhoneOtp(true);
      setPhoneOtpError("");

      const response = await axiosInstance.post(
        `/api/auth/send-phone-otp`,
        {
          phoneNumber: formData.phoneNumber,
          email: formData.email,
        },
      );

      if (response.data.success) {
        showNotification("OTP sent to phone successfully!", "success");
        setPhoneResendTimer(60);
      } else {
        setPhoneOtpError(response.data.message || "Failed to send OTP");
      }
    } catch (error) {
      console.error("Send phone OTP error:", error);
      setPhoneOtpError(error.response?.data?.message || "Failed to send OTP. Please try again.");
    } finally {
      setIsSendingPhoneOtp(false);
    }
  };

  const handleVerifyPhoneOtp = async () => {
    if (!phoneOtp || phoneOtp.length !== 6) {
      setPhoneOtpError("Please enter 6-digit OTP");
      return;
    }

    try {
      setIsVerifyingPhoneOtp(true);
      setPhoneOtpError("");

      const response = await axiosInstance.post(
        `/api/auth/verify-phone-otp`,
        {
          phoneNumber: formData.phoneNumber,
          otp: phoneOtp,
          email: formData.email,
        },
      );

      if (response.data.success) {
        setPhoneVerified(true);
        setPhoneOtpSuccess(true);
        showNotification("Phone verified successfully!", "success");
        setTimeout(() => {
          setShowPhoneOtpModal(false);
          resetPhoneOtpState();
        }, 1500);
      } else {
        setPhoneOtpError(response.data.message || "Invalid OTP");
      }
    } catch (error) {
      console.error("Verify phone OTP error:", error);
      setPhoneOtpError(error.response?.data?.message || "Verification failed. Please try again.");
    } finally {
      setIsVerifyingPhoneOtp(false);
    }
  };

  const handleLogin = async () => {
    const doLogin = async (forceLogin = false) =>
      axiosInstance.post(
        `/api/auth/login`,
        {
          email: formData.email,
          password: formData.password,
          role: "user",
          forceLogin,
        },
      );

    try {
      const response = await doLogin(false);

      const token =
        response.data?.token ||
        response.data?.accessToken ||
        response.data?.data?.token ||
        response.data?.data?.accessToken;
      const refreshToken =
        response.data?.refreshToken || response.data?.data?.refreshToken;

      if (response.data?.message === "User already logged in") {
        setApiError("User already logged in");
        setShowVerifyButton(true);
        return;
      }

      if (token) {
        await AsyncStorage.setItem("isAuthenticated", "true");
        await AsyncStorage.setItem("userRole", "user");
        await AsyncStorage.setItem("refreshToken", response?.data?.refreshToken || "");
        await AsyncStorage.setItem("userEmail", formData.email);
        await AsyncStorage.setItem("token", token);
        await AsyncStorage.setItem("accessToken", token);

        if (refreshToken) await AsyncStorage.setItem("refreshToken", refreshToken);

        if (response.data.user) {
          await AsyncStorage.setItem("userData", JSON.stringify(response.data.user));
        }

        if (response.data.user?._id) {
          await AsyncStorage.setItem("userId", response.data.user._id);
        }

        showNotification("Login successful!", "success");
        setTimeout(() => navigation.replace("UserDashboard"), 1500);

        return;
      }

      if (response.data?.message) {
        setApiError(response.data.message);
        showNotification(response.data.message, "error");
        return;
      }

      setApiError("Login failed");
      showNotification("Login failed", "error");
    } catch (error) {
      console.error("Login error:", error);

      const isAlreadyLoggedIn =
        error.response?.status === 409 && error.response?.data?.canForceLogin;

      if (isAlreadyLoggedIn) {
        try {
          const response = await doLogin(true);

          const token =
            response.data?.token ||
            response.data?.accessToken ||
            response.data?.data?.token ||
            response.data?.data?.accessToken;
          const refreshToken =
            response.data?.refreshToken || response.data?.data?.refreshToken;

          if (token) {
            await AsyncStorage.setItem("isAuthenticated", "true");
            await AsyncStorage.setItem("userRole", "user");
            await AsyncStorage.setItem("userEmail", formData.email);
            await AsyncStorage.setItem("token", token);
            await AsyncStorage.setItem("accessToken", token);
            if (refreshToken) await AsyncStorage.setItem("refreshToken", refreshToken);

            if (response.data.user) {
              await AsyncStorage.setItem("userData", JSON.stringify(response.data.user));
            }

            if (response.data.user?._id) {
              await AsyncStorage.setItem("userId", response.data.user._id);
            }

            showNotification(
              "Logged in and previous device session was ended.",
              "success",
            );
            setTimeout(() => navigation.replace("UserDashboard"), 1500);
            return;
          }
        } catch (forceError) {
          const msg =
            forceError.response?.data?.message || "Unable to force login";
          setApiError(msg);
          showNotification(msg, "error");
          return;
        }
      }

      let errorMessage = "Something went wrong";
      if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.response?.status === 401) {
        errorMessage = "Invalid email or password";
      } else if (error.request) {
        errorMessage = "Network error. Please check your connection.";
      }
      setApiError(errorMessage);
      showNotification(errorMessage, "error");
    }
  };

  const handleSignup = async () => {
    if (!emailVerified) {
      setErrors((prev) => ({
        ...prev,
        email: "Please verify your email first",
      }));
      showNotification("Please verify your email first", "error");
      return;
    }
    if (!phoneVerified) {
      setErrors((prev) => ({
        ...prev,
        phoneNumber: "Please verify your phone number first",
      }));
      showNotification("Please verify your phone number first", "error");
      return;
    }

    try {
      const signupData = {
        fullName: formData.fullName.trim(),
        email: formData.email.trim(),
        anonymous: formData.anonymous.trim(),
        phoneNumber: formData.phoneNumber.trim(),
        password: formData.password,
        confirmPassword: formData.confirmPassword,
        age: parseInt(formData.age),
        gender: formData.gender,
        role: "user",
        isEmailVerified: true,
        isPhoneVerified: true,
      };

      console.log("Sending signup data:", signupData);

      const response = await axiosInstance.post(
        `/api/auth/complete-registration`,
        signupData,
      );

      if (
        response.data &&
        (response.data.message?.includes("success") || response.data.success)
      ) {
        const token = response.data?.token || response.data?.accessToken;

        if (token) {
          await AsyncStorage.setItem("isAuthenticated", "true");
          await AsyncStorage.setItem("userRole", "user");
          await AsyncStorage.setItem("userEmail", formData.email);
          await AsyncStorage.setItem("token", token);
          await AsyncStorage.setItem("accessToken", token);
        }

        if (response.data.user?._id) {
          await AsyncStorage.setItem("userId", response.data.user._id);
        }

        if (response.data.user) {
          await AsyncStorage.setItem("userData", JSON.stringify(response.data.user));
        }

        showNotification("Account created successfully!", "success");

        setTimeout(() => {
          navigation.replace("UserDashboard");
        }, 1500);
      } else {
        showNotification(
          "Account created successfully! Redirecting to dashboard...",
          "success",
        );
        setTimeout(() => {
          navigation.replace("UserDashboard");
        }, 1500);
      }
    } catch (error) {
      console.error("Signup error:", error);

      if (error.response) {
        if (error.response.status === 400) {
          if (error.response.data.errors) {
            const serverErrors = {};
            Object.keys(error.response.data.errors).forEach((key) => {
              serverErrors[key] = error.response.data.errors[key][0];
            });
            setErrors(serverErrors);
            showNotification("Please check the form for errors", "error");
          } else if (error.response.data.message) {
            setApiError(error.response.data.message);
            showNotification(error.response.data.message, "error");
          } else {
            setApiError("Registration failed. Please check your information.");
            showNotification(
              "Registration failed. Please check your information.",
              "error",
            );
          }
        } else if (error.response.status === 409) {
          setApiError("User with this email already exists");
          showNotification("User with this email already exists", "error");
        } else {
          setApiError("Registration failed. Please try again.");
          showNotification("Registration failed. Please try again.", "error");
        }
      } else if (error.request) {
        setApiError("Network error. Please check your connection.");
        showNotification(
          "Network error. Please check your connection.",
          "error",
        );
      } else {
        setApiError("An error occurred. Please try again.");
        showNotification("An error occurred. Please try again.", "error");
      }
    }
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    setApiError("");

    if (isLogin) {
      const loginErrors = validateLogin();
      if (Object.keys(loginErrors).length === 0) {
        await handleLogin();
      } else {
        setErrors(loginErrors);
        showNotification("Please fill in all required fields", "error");
      }
    } else {
      const signupErrors = validateSignup();
      if (Object.keys(signupErrors).length === 0) {
        await handleSignup();
      } else {
        setErrors(signupErrors);
        showNotification(
          "Please fill in all required fields correctly",
          "error",
        );
      }
    }

    setIsLoading(false);
  };

  const handleVerify = async () => {
    try {
      setIsVerifying(true);
      setVerifySuccess(false);
      const verifyResponse = await axiosInstance.post(
        `/api/auth/send-verification-email`,
        { email: formData.email },
      );
      if (verifyResponse.data?.success || verifyResponse.data?.message) {
        setVerifySuccess(true);
        showNotification(
          "Verification email sent successfully! Check your inbox.",
          "success",
        );
        setTimeout(() => setVerifySuccess(false), 3000);
      }
    } catch (error) {
      console.error("Verification error:", error);
      const errorMessage =
        error.response?.data?.message ||
        "Failed to send verification email. Please try again.";
      setApiError(errorMessage);
      showNotification(errorMessage, "error");
    } finally {
      setIsVerifying(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setErrors({});
    setApiError("");
    setShowVerifyButton(false);
    setVerifySuccess(false);
    setEmailVerified(false);
    setPhoneVerified(false);
    setFormData({
      email: "",
      password: "",
      fullName: "",
      anonymous: "",
      phoneNumber: "",
      age: "",
      gender: "",
      confirmPassword: "",
    });
  };

  const renderLoginForm = () => (
    <>
      <View style={styles.field}>
        <Text style={styles.label}>
          <Icon name="envelope" size={14} color="#666" /> Email Address <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={[styles.input, errors.email && styles.inputError]}
          placeholder="Enter your email"
          placeholderTextColor="#999"
          value={formData.email}
          onChangeText={(text) => handleChange("email", text)}
          keyboardType="email-address"
          autoCapitalize="none"
          editable={!isLoading}
        />
        {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>
          <Icon name="lock" size={14} color="#666" /> Password <Text style={styles.required}>*</Text>
        </Text>
        <View style={styles.passwordWrapper}>
          <TextInput
            style={[styles.input, styles.passwordInput, errors.password && styles.inputError]}
            placeholder="Enter your password"
            placeholderTextColor="#999"
            value={formData.password}
            onChangeText={(text) => handleChange("password", text)}
            secureTextEntry={!showPassword}
            editable={!isLoading}
          />
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.passwordToggle}
            disabled={isLoading}
          >
            <Text style={styles.toggleText}>{showPassword ? "Hide" : "Show"}</Text>
          </TouchableOpacity>
        </View>
        {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
      </View>

      <View style={styles.options}>
        <TouchableOpacity style={styles.checkboxContainer}>
          <Text style={styles.checkboxLabel}>Remember me</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate("OtpVerification")}>
          <Text style={styles.forgotText}>Forgot Password?</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderSignupForm = () => (
    <>
      <View style={styles.field}>
        <Text style={styles.label}>
          <Icon name="user" size={14} color="#666" /> Full Name <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={[styles.input, errors.fullName && styles.inputError]}
          placeholder="Enter your full name"
          placeholderTextColor="#999"
          value={formData.fullName}
          onChangeText={(text) => handleChange("fullName", text)}
          editable={!isLoading}
        />
        {errors.fullName && <Text style={styles.errorText}>{errors.fullName}</Text>}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>
          <Icon name="user" size={14} color="#666" /> Anonymous Name <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={[styles.input, errors.anonymous && styles.inputError]}
          placeholder="Choose an anonymous name"
          placeholderTextColor="#999"
          value={formData.anonymous}
          onChangeText={(text) => handleChange("anonymous", text)}
          editable={!isLoading}
        />
        {errors.anonymous && <Text style={styles.errorText}>{errors.anonymous}</Text>}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>
          <Icon name="envelope" size={14} color="#666" /> Email <Text style={styles.required}>*</Text>
        </Text>
        <View style={styles.verifyGroup}>
          <TextInput
            style={[
              styles.input,
              styles.verifyInput,
              errors.email && styles.inputError,
              emailVerified && styles.verifiedInput
            ]}
            placeholder="Enter your email"
            placeholderTextColor="#999"
            value={formData.email}
            onChangeText={(text) => handleChange("email", text)}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={!isLoading && !emailVerified}
          />
          {!emailVerified && formData.email && /\S+@\S+\.\S+/.test(formData.email) && (
            <TouchableOpacity
              style={styles.verifyButtonSm}
              onPress={() => {
                resetEmailOtpState();
                setShowEmailOtpModal(true);
                // ✅ FIX: Removed manual handleSendEmailOtp() call - useEffect will handle it
              }}
              disabled={isLoading}
            >
              <Text style={styles.verifyButtonSmText}>Verify</Text>
            </TouchableOpacity>
          )}
          {emailVerified && (
            <View style={styles.verifiedBadge}>
              <Icon name="check-circle" size={16} color="#4CAF50" />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          )}
        </View>
        {errors.email && <Text style={styles.errorText}>{errors.email}</Text>}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>
          <Icon name="phone" size={14} color="#666" /> Phone Number <Text style={styles.required}>*</Text>
        </Text>
        <View style={styles.verifyGroup}>
          <TextInput
            style={[
              styles.input,
              styles.verifyInput,
              errors.phoneNumber && styles.inputError,
              phoneVerified && styles.verifiedInput
            ]}
            placeholder="10 digit mobile number"
            placeholderTextColor="#999"
            value={formData.phoneNumber}
            onChangeText={(text) => handleChange("phoneNumber", text)}
            keyboardType="phone-pad"
            maxLength={10}
            editable={!isLoading && !phoneVerified}
          />
          {!phoneVerified && formData.phoneNumber && /^\d{10}$/.test(formData.phoneNumber) && (
            <TouchableOpacity
              style={styles.verifyButtonSm}
              onPress={() => {
                resetPhoneOtpState();
                setShowPhoneOtpModal(true);
                // ✅ FIX: Removed manual handleSendPhoneOtp() call - useEffect will handle it
              }}
              disabled={isLoading}
            >
              <Text style={styles.verifyButtonSmText}>Verify</Text>
            </TouchableOpacity>
          )}
          {phoneVerified && (
            <View style={styles.verifiedBadge}>
              <Icon name="check-circle" size={16} color="#4CAF50" />
              <Text style={styles.verifiedText}>Verified</Text>
            </View>
          )}
        </View>
        {errors.phoneNumber && <Text style={styles.errorText}>{errors.phoneNumber}</Text>}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>
          <Icon name="calendar" size={14} color="#666" /> Age <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={[styles.input, errors.age && styles.inputError]}
          placeholder="Your age"
          placeholderTextColor="#999"
          value={formData.age}
          onChangeText={(text) => handleChange("age", text)}
          keyboardType="number-pad"
          editable={!isLoading}
        />
        {errors.age && <Text style={styles.errorText}>{errors.age}</Text>}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>
          <Icon name="venus-mars" size={14} color="#666" /> Gender <Text style={styles.required}>*</Text>
        </Text>
        <View style={styles.genderPickerContainer}>
          <Picker
            selectedValue={formData.gender}
            onValueChange={(itemValue) => handleChange("gender", itemValue)}
            enabled={!isLoading}
            style={styles.picker}
            dropdownIconColor="#667eea"
          >
            <Picker.Item label="Select Gender" value="" color="#1a202c" />
            <Picker.Item label="Male" value="male" color="#1a202c" />
            <Picker.Item label="Female" value="female" color="#1a202c" />
            <Picker.Item label="Other" value="other" color="#1a202c" />
            <Picker.Item label="Prefer not to say" value="prefer-not-to-say" color="#1a202c" />
          </Picker>
        </View>
        {errors.gender && <Text style={styles.errorText}>{errors.gender}</Text>}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>
          <Icon name="lock" size={14} color="#666" /> Password <Text style={styles.required}>*</Text>
        </Text>
        <View style={styles.passwordWrapper}>
          <TextInput
            style={[styles.input, styles.passwordInput, errors.password && styles.inputError]}
            placeholder="Create a password"
            placeholderTextColor="#999"
            value={formData.password}
            onChangeText={(text) => handleChange("password", text)}
            secureTextEntry={!showPassword}
            editable={!isLoading}
          />
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.passwordToggle}
            disabled={isLoading}
          >
            <Text style={styles.toggleText}>{showPassword ? "Hide" : "Show"}</Text>
          </TouchableOpacity>
        </View>
        {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>
          <Icon name="lock" size={14} color="#666" /> Confirm Password <Text style={styles.required}>*</Text>
        </Text>
        <View style={styles.passwordWrapper}>
          <TextInput
            style={[styles.input, styles.passwordInput, errors.confirmPassword && styles.inputError]}
            placeholder="Confirm your password"
            placeholderTextColor="#999"
            value={formData.confirmPassword}
            onChangeText={(text) => handleChange("confirmPassword", text)}
            secureTextEntry={!showConfirmPassword}
            editable={!isLoading}
          />
          <TouchableOpacity
            onPress={() => setShowConfirmPassword(!showConfirmPassword)}
            style={styles.passwordToggle}
            disabled={isLoading}
          >
            <Text style={styles.toggleText}>{showConfirmPassword ? "Hide" : "Show"}</Text>
          </TouchableOpacity>
        </View>
        {errors.confirmPassword && <Text style={styles.errorText}>{errors.confirmPassword}</Text>}
      </View>

      <Text style={styles.termsText}>
        By signing up, you agree to our{" "}
        <Text style={styles.termsLink}>Terms of Service</Text> and{" "}
        <Text style={styles.termsLink}>Privacy Policy</Text>
      </Text>
    </>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={[Colors.primaryDark, Colors.primary, Colors.background]}
        style={styles.container}
      >
        <SafeAreaView style={styles.safeArea}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.keyboardView}
          >
            <ScrollView
              contentContainerStyle={styles.scrollView}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Animated.View style={[styles.brandSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                <View style={styles.logoContainer}>
                  <LinearGradient
                    colors={[Colors.secondary, Colors.accent]}
                    style={styles.logoIconSmall}
                  >
                    <Icon name="heartbeat" size={18} color={Colors.white} />
                  </LinearGradient>
                  <Text style={styles.logoText}>
                    Medi<Text style={styles.logoHighlight}>Coneckt</Text>
                  </Text>
                </View>
                <Text style={styles.brandTitle}>
                  {isLogin ? "Welcome Back!" : "Begin Your Journey"}
                </Text>
                <Text style={styles.brandSubtitle}>
                  {isLogin
                    ? "Connect with professional counselors and start your healing journey."
                    : "Join thousands of people who have found peace and clarity."}
                </Text>
              </Animated.View>

              <Animated.View style={[styles.formSection, { opacity: fadeAnim }]}>
                <View style={styles.formHeader}>
                  <Text style={styles.formTitle}>
                    {isLogin ? "Login to Account" : "Create Account"}
                  </Text>
                  <Text style={styles.formSubtitle}>
                    {isLogin ? "Don't have an account? " : "Already have an account? "}
                    <Text onPress={toggleMode} style={styles.toggleLink}>
                      {isLogin ? "Sign Up" : "Login"}
                    </Text>
                  </Text>
                </View>

                {apiError ? (
                  <View style={styles.apiError}>
                    <Text style={styles.apiErrorText}>{apiError}</Text>
                  </View>
                ) : null}

                {showVerifyButton ? (
                  <View style={styles.verifySection}>
                    {verifySuccess ? (
                      <View style={styles.verifySuccess}>
                        <Text style={styles.verifySuccessText}>
                          Verification email sent successfully! Check your inbox.
                        </Text>
                      </View>
                    ) : (
                      <>
                        <Text style={styles.verifyMessage}>
                          Your account is already logged in on another device.
                        </Text>
                        <TouchableOpacity
                          style={styles.verifyBtn}
                          onPress={handleVerify}
                          disabled={isVerifying || isLoading}
                        >
                          {isVerifying ? (
                            <ActivityIndicator size="small" color="#fff" />
                          ) : (
                            <Text style={styles.verifyBtnText}>📧 Verify Mail</Text>
                          )}
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                ) : null}

                <View style={styles.form}>
                  {isLogin ? renderLoginForm() : renderSignupForm()}

                  <TouchableOpacity
                    style={[styles.submitButton, isLoading && styles.submitButtonLoading]}
                    onPress={handleSubmit}
                    disabled={isLoading}
                  >
                    <LinearGradient
                      colors={[Colors.primary, Colors.primaryDark]}
                      style={styles.submitBtnGradient}
                    >
                      {isLoading ? (
                        <>
                          <ActivityIndicator size="small" color="#fff" />
                          <Text style={styles.submitText}>
                            {isLogin ? " Logging in..." : " Creating Account..."}
                          </Text>
                        </>
                      ) : (
                        <Text style={styles.submitText}>
                          {isLogin ? "Login Now" : "Create Account"}
                        </Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </LinearGradient>

      {/* EMAIL OTP MODAL */}
      <Modal
        visible={showEmailOtpModal}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => {
          if (!emailOtpSuccess) {
            setShowEmailOtpModal(false);
            resetEmailOtpState();
          }
        }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            if (!emailOtpSuccess) {
              setShowEmailOtpModal(false);
              resetEmailOtpState();
            }
          }}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIcon}>
                <Icon name="envelope" size={24} color="#4A90E2" />
              </View>
              <Text style={styles.modalTitle}>Verify Email Address</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowEmailOtpModal(false);
                  resetEmailOtpState();
                }}
                disabled={isVerifyingEmailOtp}
              >
                <Icon name="times" size={24} color="#999" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalText}>Enter the verification code sent to</Text>
              <Text style={styles.modalRecipient}>{formData.email}</Text>

              <OtpCodeInput
                value={emailOtp}
                onChangeText={setEmailOtp}
                editable={!isVerifyingEmailOtp && !emailOtpSuccess}
                autoFocus={true}
                success={emailOtpSuccess}
                containerStyle={styles.otpInput}
                boxStyle={styles.otpDigitBox}
                focusedBoxStyle={styles.otpDigitBoxFocused}
                successBoxStyle={styles.otpDigitBoxSuccess}
                textStyle={styles.otpDigitText}
              />

              {emailOtpError ? (
                <Text style={styles.otpError}>{emailOtpError}</Text>
              ) : null}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.verifyButton, (!emailOtp || emailOtpSuccess) && styles.disabledButton]}
                  onPress={handleVerifyEmailOtp}
                  disabled={isVerifyingEmailOtp || emailOtpSuccess || !emailOtp}
                >
                  {isVerifyingEmailOtp ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.verifyButtonText}>Verify</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.resendButton, (isSendingEmailOtp || emailResendTimer > 0 || emailOtpSuccess) && styles.disabledButton]}
                  onPress={handleSendEmailOtp}
                  disabled={isSendingEmailOtp || emailResendTimer > 0 || emailOtpSuccess}
                >
                  <Text style={styles.resendButtonText}>
                    {isSendingEmailOtp ? "Sending..." : emailResendTimer > 0 ? `Resend in ${emailResendTimer}s` : "Resend Code"}
                  </Text>
                </TouchableOpacity>
              </View>

              {emailOtpSuccess && (
                <View style={styles.successContainer}>
                  <Icon name="check-circle" size={20} color="#4CAF50" />
                  <Text style={styles.successText}>Email verified successfully!</Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* PHONE OTP MODAL */}
      <Modal
        visible={showPhoneOtpModal}
        transparent={true}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => {
          if (!phoneOtpSuccess) {
            setShowPhoneOtpModal(false);
            resetPhoneOtpState();
          }
        }}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => {
            if (!phoneOtpSuccess) {
              setShowPhoneOtpModal(false);
              resetPhoneOtpState();
            }
          }}
        >
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.modalHeader}>
              <View style={styles.modalIcon}>
                <Icon name="phone" size={24} color="#4A90E2" />
              </View>
              <Text style={styles.modalTitle}>Verify Phone Number</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowPhoneOtpModal(false);
                  resetPhoneOtpState();
                }}
                disabled={isVerifyingPhoneOtp}
              >
                <Icon name="times" size={24} color="#999" />
              </TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.modalText}>Enter the verification code sent to</Text>
              <Text style={styles.modalRecipient}>{formData.phoneNumber}</Text>

              <OtpCodeInput
                value={phoneOtp}
                onChangeText={setPhoneOtp}
                editable={!isVerifyingPhoneOtp && !phoneOtpSuccess}
                autoFocus={true}
                success={phoneOtpSuccess}
                containerStyle={styles.otpInput}
                boxStyle={styles.otpDigitBox}
                focusedBoxStyle={styles.otpDigitBoxFocused}
                successBoxStyle={styles.otpDigitBoxSuccess}
                textStyle={styles.otpDigitText}
              />

              {phoneOtpError ? (
                <Text style={styles.otpError}>{phoneOtpError}</Text>
              ) : null}

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.verifyButton, (!phoneOtp || phoneOtpSuccess) && styles.disabledButton]}
                  onPress={handleVerifyPhoneOtp}
                  disabled={isVerifyingPhoneOtp || phoneOtpSuccess || !phoneOtp}
                >
                  {isVerifyingPhoneOtp ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.verifyButtonText}>Verify</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.resendButton, (isSendingPhoneOtp || phoneResendTimer > 0 || phoneOtpSuccess) && styles.disabledButton]}
                  onPress={handleSendPhoneOtp}
                  disabled={isSendingPhoneOtp || phoneResendTimer > 0 || phoneOtpSuccess}
                >
                  <Text style={styles.resendButtonText}>
                    {isSendingPhoneOtp ? "Sending..." : phoneResendTimer > 0 ? `Resend in ${phoneResendTimer}s` : "Resend Code"}
                  </Text>
                </TouchableOpacity>
              </View>

              {phoneOtpSuccess && (
                <View style={styles.successContainer}>
                  <Icon name="check-circle" size={20} color="#4CAF50" />
                  <Text style={styles.successText}>Phone verified successfully!</Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: height * 0.05,
  },
  brandSection: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  logoIconSmall: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
    elevation: 5,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  logoText: {
    fontSize: 24,
    fontWeight: "bold",
    color: Colors.white,
  },
  logoHighlight: {
    color: Colors.accent,
  },
  brandTitle: {
    ...Typography.h1,
    color: Colors.white,
    marginBottom: Spacing.xs,
    textAlign: "center",
  },
  brandSubtitle: {
    ...Typography.body,
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  features: {
    alignItems: "flex-start",
    backgroundColor: "rgba(255,255,255,0.1)",
    padding: Spacing.md,
    borderRadius: 16,
    width: "100%",
  },
  feature: {
    color: "#fff",
    fontSize: 14,
    marginVertical: 4,
  },
  formSection: {
    backgroundColor: Colors.white,
    borderRadius: 30,
    padding: Spacing.lg,
    elevation: 20,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  formHeader: {
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  formTitle: {
    ...Typography.h2,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  formSubtitle: {
    ...Typography.bodySmall,
    color: Colors.textLight,
  },
  toggleLink: {
    color: Colors.primary,
    fontWeight: "bold",
  },
  apiError: {
    backgroundColor: "#ffebee",
    padding: Spacing.sm,
    borderRadius: 10,
    marginBottom: Spacing.md,
  },
  apiErrorText: {
    color: Colors.error,
    fontSize: 14,
    textAlign: "center",
  },
  verifySection: {
    backgroundColor: "#fff3e0",
    padding: Spacing.md,
    borderRadius: 12,
    marginBottom: Spacing.md,
    alignItems: "center",
  },
  verifyMessage: {
    color: "#e65100",
    fontSize: 14,
    marginBottom: 10,
    textAlign: "center",
  },
  verifyBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  verifyBtnText: {
    color: Colors.white,
    fontWeight: "bold",
  },
  verifySuccess: {
    alignItems: "center",
  },
  verifySuccessText: {
    color: Colors.success,
    fontSize: 14,
  },
  form: {
    width: "100%",
  },
  field: {
    marginBottom: Spacing.md,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  required: {
    color: Colors.error,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: "#F8FAFC",
    color: "#1a202c",
  },
  inputError: {
    borderColor: Colors.error,
  },
  verifiedInput: {
    borderColor: Colors.success,
    backgroundColor: "#F0FDF4",
  },
  errorText: {
    color: Colors.error,
    fontSize: 12,
    marginTop: 4,
  },
  passwordWrapper: {
    position: "relative",
  },
  passwordInput: {
    paddingRight: 60,
  },
  passwordToggle: {
    position: "absolute",
    right: 15,
    top: 15,
  },
  toggleText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: "bold",
  },
  options: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  checkboxContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkboxLabel: {
    fontSize: 14,
    color: Colors.textLight,
  },
  forgotText: {
    color: Colors.primary,
    fontSize: 14,
    fontWeight: "500",
  },
  verifyGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  verifyInput: {
    flex: 1,
  },
  verifyButtonSm: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 80,
    alignItems: "center",
  },
  verifyButtonSmText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: "bold",
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.success,
  },
  verifiedText: {
    color: Colors.success,
    fontSize: 14,
    fontWeight: "600",
  },
  genderPickerContainer: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    overflow: "hidden",
  },
  picker: {
    height: 55,
    marginLeft: 8,
    width: "100%",
    color: "#1a202c",
  },
  termsText: {
    fontSize: 12,
    color: Colors.textLight,
    textAlign: "center",
    marginTop: Spacing.md,
  },
  termsLink: {
    color: Colors.primary,
    fontWeight: "bold",
  },
  submitButton: {
    height: 55,
    borderRadius: 15,
    overflow: "hidden",
    marginTop: Spacing.xl,
  },
  submitBtnGradient: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  submitButtonLoading: {
    opacity: 0.7,
  },
  submitText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: "bold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderRadius: 25,
    width: width * 0.9,
    padding: Spacing.lg,
    elevation: 25,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  modalIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    ...Typography.h3,
    color: Colors.text,
    flex: 1,
    textAlign: "center",
  },
  modalBody: {
    alignItems: "center",
  },
  modalText: {
    ...Typography.bodySmall,
    color: Colors.textLight,
    marginBottom: 4,
  },
  modalRecipient: {
    ...Typography.h3,
    color: Colors.primary,
    marginBottom: Spacing.lg,
  },
  otpInput: {
    width: "100%",
    marginBottom: Spacing.md,
  },
  otpDigitBox: {
    minHeight: 58,
    borderColor: Colors.border,
    backgroundColor: "#F8FAFC",
  },
  otpDigitBoxFocused: {
    borderColor: Colors.primary,
  },
  otpDigitBoxSuccess: {
    borderColor: Colors.success,
    backgroundColor: "#F0FDF4",
  },
  otpDigitText: {
    color: Colors.text,
  },
  otpError: {
    color: Colors.error,
    fontSize: 12,
    marginBottom: Spacing.md,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: Spacing.md,
    gap: 12,
  },
  verifyButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    flex: 1,
    alignItems: "center",
  },
  verifyButtonText: {
    color: Colors.white,
    fontWeight: "bold",
  },
  resendButton: {
    backgroundColor: "#F1F5F9",
    paddingVertical: 12,
    borderRadius: 12,
    flex: 1,
    alignItems: "center",
  },
  resendButtonText: {
    color: Colors.text,
  },
  disabledButton: {
    opacity: 0.5,
  },
  successContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.sm,
    gap: 6,
  },
  successText: {
    color: Colors.success,
    fontSize: 14,
    fontWeight: "600",
  },
});

export default UserSignup;