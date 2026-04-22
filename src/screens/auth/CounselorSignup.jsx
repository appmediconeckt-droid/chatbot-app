import React, { useState, useEffect, useCallback } from "react";
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
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Icon from "react-native-vector-icons/FontAwesome5";
import LinearGradient from "react-native-linear-gradient";
import { Picker } from "@react-native-picker/picker";
import axiosInstance, { API_BASE_URL } from "../../axiosConfig";
import OtpCodeInput from "./components/OtpCodeInput";

const { width } = Dimensions.get("window");

const CounselorSignup = () => {
  const navigation = useNavigation();
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    fullName: "",
    phoneNumber: "",
    age: "",
    gender: "",
    qualification: "",
    specialization: "",
    experience: "",
    location: "",
    consultationMode: [],
    languages: [],
    aboutMe: "",
    profilePhoto: null,
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
  const [notification, setNotification] = useState({
    show: false,
    message: "",
    type: "",
  });

  const consultationModes = ["Online", "Offline", "Both"];
  const languageOptions = [
    "Hindi",
    "English",
    "Gujarati",
    "Marathi",
    "Tamil",
    "Telugu",
    "Bengali",
    "Punjabi",
  ];

  // Timer effects
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
    checkTokenAndRole();
  }, []);

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

  const checkTokenAndRole = async () => {
    try {
      const token =
        (await AsyncStorage.getItem("accessToken")) ||
        (await AsyncStorage.getItem("token"));
      const savedRole = (await AsyncStorage.getItem("userRole")) || "";
      const userRole = savedRole.toLowerCase();

      if (token && (userRole === "counselor" || userRole === "counsellor")) {
        navigation.replace("CounselorDashboard");
      } else if (token && userRole === "user") {
        navigation.replace("UserDashboard");
      }
    } catch (error) {
      console.error("Error checking token:", error);
    }
  };

  const showNotification = useCallback((message, type = "success") => {
    Alert.alert(
      type === "success" ? "Success" : type === "error" ? "Error" : "Info",
      message,
      [{ text: "OK" }]
    );
    setNotification({ show: true, message, type });
    setTimeout(() => {
      setNotification({ show: false, message: "", type: "" });
    }, 3000);
  }, []);

  const handleChange = useCallback(
    (name, value, isCheckbox = false, checkboxValue = null) => {
      if (isCheckbox) {
        if (name === "consultationMode") {
          setFormData((prev) => {
            let updatedModes = [...prev.consultationMode];
            if (value) {
              updatedModes.push(checkboxValue);
            } else {
              updatedModes = updatedModes.filter((mode) => mode !== checkboxValue);
            }
            return { ...prev, consultationMode: updatedModes };
          });
        } else if (name === "languages") {
          setFormData((prev) => {
            let updatedLanguages = [...prev.languages];
            if (value) {
              updatedLanguages.push(checkboxValue);
            } else {
              updatedLanguages = updatedLanguages.filter((lang) => lang !== checkboxValue);
            }
            return { ...prev, languages: updatedLanguages };
          });
        }
      } else {
        setFormData((prev) => ({ ...prev, [name]: value }));
      }

      if (errors[name]) {
        setErrors((prev) => ({ ...prev, [name]: "" }));
      }

      if (name === "email") setEmailVerified(false);
      if (name === "phoneNumber") setPhoneVerified(false);
    },
    [errors]
  );

  const validateLogin = useCallback(() => {
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
  }, [formData.email, formData.password]);

  const validateSignup = useCallback(() => {
    const newErrors = {};
    if (!formData.fullName) newErrors.fullName = "Full name is required";
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
    } else if (formData.age < 18 || formData.age > 100) {
      newErrors.age = "Age must be between 18 and 100";
    }
    if (!formData.gender) newErrors.gender = "Gender is required";
    if (!formData.qualification) newErrors.qualification = "Qualification is required";
    if (!formData.specialization) newErrors.specialization = "Specialization is required";
    if (!formData.experience) {
      newErrors.experience = "Experience is required";
    } else if (formData.experience < 0) {
      newErrors.experience = "Experience cannot be negative";
    }
    if (!formData.location) newErrors.location = "Location is required";
    if (formData.consultationMode.length === 0) {
      newErrors.consultationMode = "Select at least one consultation mode";
    }
    if (formData.languages.length === 0) {
      newErrors.languages = "Select at least one language";
    }
    if (!formData.aboutMe) newErrors.aboutMe = "About me is required";
    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm password";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }
    return newErrors;
  }, [formData, emailVerified, phoneVerified]);

  const resetEmailOtpState = useCallback(() => {
    setEmailOtp("");
    setEmailOtpError("");
    setEmailOtpSuccess(false);
    setEmailResendTimer(0);
  }, []);

  const resetPhoneOtpState = useCallback(() => {
    setPhoneOtp("");
    setPhoneOtpError("");
    setPhoneOtpSuccess(false);
    setPhoneResendTimer(0);
  }, []);

  const handleSendEmailOtp = useCallback(async () => {
    if (!formData.email) {
      setEmailOtpError("Please enter email address first");
      return;
    }
    if (!/\S+@\S+\.\S+/.test(formData.email)) {
      setEmailOtpError("Please enter a valid email address");
      return;
    }

    setIsSendingEmailOtp(true);
    setEmailOtpError("");
    try {
      const response = await axiosInstance.post(
        `${API_BASE_URL}/api/auth/send-email-otp`,
        { email: formData.email }
      );

      if (response.data.success) {
        showNotification("OTP sent to your email!", "success");
        setEmailResendTimer(60);
        setEmailOtpSuccess(false);
        setEmailOtp("");
      } else {
        setEmailOtpError(response.data.message || "Failed to send OTP");
      }
    } catch (error) {
      console.error("Send email OTP error:", error);
      setEmailOtpError(
        error.response?.data?.message || "Failed to send OTP. Please try again."
      );
    } finally {
      setIsSendingEmailOtp(false);
    }
  }, [formData.email, showNotification]);

  const handleVerifyEmailOtp = useCallback(async () => {
    if (!emailOtp || emailOtp.length !== 6) {
      setEmailOtpError("Please enter 6-digit OTP");
      return;
    }

    setIsVerifyingEmailOtp(true);
    setEmailOtpError("");
    try {
      const response = await axiosInstance.post(
        `${API_BASE_URL}/api/auth/verify-email-otp`,
        { email: formData.email, otp: emailOtp }
      );

      if (response.data.success) {
        setEmailVerified(true);
        setEmailOtpSuccess(true);
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
      setEmailOtpError(
        error.response?.data?.message || "Verification failed. Please try again."
      );
    } finally {
      setIsVerifyingEmailOtp(false);
    }
  }, [emailOtp, formData.email, showNotification, resetEmailOtpState]);

  const handleSendPhoneOtp = useCallback(async () => {
    if (!formData.phoneNumber) {
      setPhoneOtpError("Please enter phone number first");
      return;
    }
    if (!/^\d{10}$/.test(formData.phoneNumber)) {
      setPhoneOtpError("Please enter a valid 10-digit phone number");
      return;
    }

    setIsSendingPhoneOtp(true);
    setPhoneOtpError("");
    try {
      const response = await axiosInstance.post(
        `${API_BASE_URL}/api/auth/send-phone-otp`,
        { phoneNumber: formData.phoneNumber, email: formData.email }
      );

      if (response.data.success) {
        showNotification("OTP sent to your phone!", "success");
        setPhoneResendTimer(60);
        setPhoneOtpSuccess(false);
        setPhoneOtp("");
      } else {
        setPhoneOtpError(response.data.message || "Failed to send OTP");
      }
    } catch (error) {
      console.error("Send phone OTP error:", error);
      setPhoneOtpError(
        error.response?.data?.message || "Failed to send OTP. Please try again."
      );
    } finally {
      setIsSendingPhoneOtp(false);
    }
  }, [formData.phoneNumber, formData.email, showNotification]);

  const handleVerifyPhoneOtp = useCallback(async () => {
    if (!phoneOtp || phoneOtp.length !== 6) {
      setPhoneOtpError("Please enter 6-digit OTP");
      return;
    }

    setIsVerifyingPhoneOtp(true);
    setPhoneOtpError("");
    try {
      const response = await axiosInstance.post(
        `${API_BASE_URL}/api/auth/verify-phone-otp`,
        { phoneNumber: formData.phoneNumber, otp: phoneOtp }
      );

      if (response.data.success) {
        setPhoneVerified(true);
        setPhoneOtpSuccess(true);
        showNotification("Phone number verified successfully!", "success");
        setTimeout(() => {
          setShowPhoneOtpModal(false);
          resetPhoneOtpState();
        }, 1500);
      } else {
        setPhoneOtpError(response.data.message || "Invalid OTP");
      }
    } catch (error) {
      console.error("Verify phone OTP error:", error);
      setPhoneOtpError(
        error.response?.data?.message || "Verification failed. Please try again."
      );
    } finally {
      setIsVerifyingPhoneOtp(false);
    }
  }, [phoneOtp, formData.phoneNumber, showNotification, resetPhoneOtpState]);

  const handleLogin = useCallback(async () => {
    const doLogin = async (forceLogin = false) =>
      axiosInstance.post(`${API_BASE_URL}/api/auth/login`, {
        email: formData.email,
        password: formData.password,
        role: "counsellor",
        forceLogin,
      });

    try {
      const response = await doLogin(false);
      const token = response.data?.token || response.data?.accessToken;

      if (token) {
        await AsyncStorage.setItem("accessToken", token);
        await AsyncStorage.setItem("token", token);
        if (response.data.refreshToken)
          await AsyncStorage.setItem("refreshToken", response.data.refreshToken);
        if (response.data.user) {
          await AsyncStorage.setItem("userData", JSON.stringify(response.data.user));
          await AsyncStorage.setItem("userRole", "counselor");
          await AsyncStorage.setItem("counsellorId", response.data.user._id);
        }
        await AsyncStorage.setItem("userEmail", formData.email);
        await AsyncStorage.setItem("isAuthenticated", "true");
        showNotification("Login successful! Redirecting to dashboard...", "success");
        setTimeout(() => navigation.replace("CounselorDashboard"), 1500);
      } else {
        showNotification(response.data.message || "Login failed", "error");
      }
    } catch (error) {
      console.error("Login error:", error);
      const isAlreadyLoggedIn =
        error.response?.status === 409 && error.response?.data?.canForceLogin;

      if (isAlreadyLoggedIn) {
        try {
          const response = await doLogin(true);
          const token = response.data?.token || response.data?.accessToken;
          if (token) {
            await AsyncStorage.setItem("accessToken", token);
            await AsyncStorage.setItem("token", token);
            if (response.data.refreshToken)
              await AsyncStorage.setItem("refreshToken", response.data.refreshToken);
            if (response.data.user) {
              await AsyncStorage.setItem("userData", JSON.stringify(response.data.user));
              await AsyncStorage.setItem("userRole", "counselor");
              await AsyncStorage.setItem("counsellorId", response.data.user._id);
            }
            await AsyncStorage.setItem("userEmail", formData.email);
            await AsyncStorage.setItem("isAuthenticated", "true");
            showNotification("Logged in and previous device session was ended.", "success");
            setTimeout(() => navigation.replace("CounselorDashboard"), 1500);
            return;
          }
        } catch (forceError) {
          showNotification(
            forceError.response?.data?.message || "Unable to force login",
            "error"
          );
          return;
        }
      }
      showNotification(error.response?.data?.message || "Something went wrong", "error");
    }
  }, [formData.email, formData.password, navigation, showNotification]);

  const handleSignup = useCallback(async () => {
    if (!emailVerified) {
      setErrors((prev) => ({ ...prev, email: "Please verify your email first" }));
      showNotification("Please verify your email first", "error");
      return;
    }
    if (!phoneVerified) {
      setErrors((prev) => ({ ...prev, phoneNumber: "Please verify your phone number first" }));
      showNotification("Please verify your phone number first", "error");
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
        role: "counsellor",
      };

      const response = await axiosInstance.post(
        `${API_BASE_URL}/api/auth/complete-registration`,
        payload
      );

      if (response.data.success) {
        showNotification(
          "Counselor registered successfully! Redirecting to dashboard...",
          "success"
        );
        const token = response.data?.token || response.data?.accessToken;
        if (token) {
          await AsyncStorage.setItem("accessToken", token);
          await AsyncStorage.setItem("token", token);
          await AsyncStorage.setItem("userRole", "counselor");
          await AsyncStorage.setItem("userEmail", formData.email);
          await AsyncStorage.setItem("isAuthenticated", "true");
          if (response.data.user) {
            await AsyncStorage.setItem("userData", JSON.stringify(response.data.user));
            await AsyncStorage.setItem("counsellorId", response.data.user._id);
          }
        }
        setTimeout(() => navigation.replace("CounselorDashboard"), 1500);
      } else {
        showNotification(response.data.message || "Registration failed", "error");
      }
    } catch (error) {
      console.error("Signup error:", error);
      if (error.response) {
        if (error.response.status === 400) {
          if (error.response.data.message?.includes("duplicate key error")) {
            showNotification(
              "This phone number is already registered. Please use a different number.",
              "error"
            );
          } else if (error.response.data.errors) {
            const serverErrors = {};
            Object.keys(error.response.data.errors).forEach((key) => {
              serverErrors[key] = error.response.data.errors[key][0];
            });
            setErrors(serverErrors);
            showNotification("Please check the form for errors", "error");
          } else {
            showNotification(
              error.response.data.message || "Registration failed. Please check your information.",
              "error"
            );
          }
        } else if (error.response.status === 409) {
          showNotification("Counselor with this email or phone already exists", "error");
        } else {
          showNotification("Registration failed. Please try again.", "error");
        }
      } else if (error.request) {
        showNotification("Network error. Please check your connection.", "error");
      } else {
        showNotification("An error occurred. Please try again.", "error");
      }
    }
  }, [formData, emailVerified, phoneVerified, navigation, showNotification]);

  const handleSubmit = useCallback(async () => {
    setIsLoading(true);
    if (isLogin) {
      const loginErrors = validateLogin();
      if (Object.keys(loginErrors).length > 0) {
        setErrors(loginErrors);
        setIsLoading(false);
        showNotification("Please fill in all required fields", "error");
        return;
      }
      await handleLogin();
    } else {
      const signupErrors = validateSignup();
      if (Object.keys(signupErrors).length > 0) {
        setErrors(signupErrors);
        setIsLoading(false);
        showNotification("Please fill in all required fields correctly", "error");
        return;
      }
      await handleSignup();
    }
    setIsLoading(false);
  }, [isLogin, validateLogin, validateSignup, handleLogin, handleSignup, showNotification]);

  const toggleMode = useCallback(() => {
    setIsLogin((prev) => !prev);
    setErrors({});
    setEmailVerified(false);
    setPhoneVerified(false);
    setFormData({
      email: "",
      password: "",
      fullName: "",
      phoneNumber: "",
      age: "",
      gender: "",
      qualification: "",
      specialization: "",
      experience: "",
      location: "",
      consultationMode: [],
      languages: [],
      aboutMe: "",
      profilePhoto: null,
      confirmPassword: "",
    });
    setNotification({ show: false, message: "", type: "" });
  }, []);

  const renderLoginForm = () => (
    <>
      <View style={styles.field}>
        <Text style={styles.label}>
          <Icon name="envelope" size={14} color="#666" /> Email Address{" "}
          <Text style={styles.required}>*</Text>
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
          <Icon name="lock" size={14} color="#666" /> Password{" "}
          <Text style={styles.required}>*</Text>
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
            onPress={() => setShowPassword((prev) => !prev)}
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
        <TouchableOpacity>
          <Text style={styles.forgotText}>Forgot password?</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const renderSignupForm = () => (
    <>
      <View style={styles.grid}>
        <View style={styles.field}>
          <Text style={styles.label}>
            <Icon name="user" size={14} color="#666" /> Full Name{" "}
            <Text style={styles.required}>*</Text>
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
            <Icon name="envelope" size={14} color="#666" /> Email{" "}
            <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.verifyGroup}>
            <TextInput
              style={[
                styles.input,
                styles.verifyInput,
                errors.email && styles.inputError,
                emailVerified && styles.verifiedInput,
              ]}
              placeholder="Enter your email"
              placeholderTextColor="#999"
              value={formData.email}
              onChangeText={(text) => handleChange("email", text)}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!isLoading && !emailVerified}
            />
            {!emailVerified &&
              formData.email &&
              /\S+@\S+\.\S+/.test(formData.email) && (
                <TouchableOpacity
                  style={styles.verifyButtonSm}
                  onPress={() => {
                    // ✅ FIX: Only open modal — useEffect will trigger OTP send
                    resetEmailOtpState();
                    setShowEmailOtpModal(true);
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
            <Icon name="phone" size={14} color="#666" /> Phone Number{" "}
            <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.verifyGroup}>
            <TextInput
              style={[
                styles.input,
                styles.verifyInput,
                errors.phoneNumber && styles.inputError,
                phoneVerified && styles.verifiedInput,
              ]}
              placeholder="10 digit mobile number"
              placeholderTextColor="#999"
              value={formData.phoneNumber}
              onChangeText={(text) => handleChange("phoneNumber", text)}
              keyboardType="phone-pad"
              maxLength={10}
              editable={!isLoading && !phoneVerified}
            />
            {!phoneVerified &&
              formData.phoneNumber &&
              /^\d{10}$/.test(formData.phoneNumber) && (
                <TouchableOpacity
                  style={styles.verifyButtonSm}
                  onPress={() => {
                    // ✅ FIX: Only open modal — useEffect will trigger OTP send
                    resetPhoneOtpState();
                    setShowPhoneOtpModal(true);
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
          {errors.phoneNumber && (
            <Text style={styles.errorText}>{errors.phoneNumber}</Text>
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>
            <Icon name="calendar" size={14} color="#666" /> Age{" "}
            <Text style={styles.required}>*</Text>
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
            <Icon name="venus-mars" size={14} color="#666" /> Gender{" "}
            <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={formData.gender}
              onValueChange={(itemValue) => handleChange("gender", itemValue)}
              enabled={!isLoading}
              style={styles.picker}
              dropdownIconColor="#667eea"
            >
              <Picker.Item label="Select Gender" value="" color="#1a202c" />
              <Picker.Item label="Male" value="Male" color="#1a202c" />
              <Picker.Item label="Female" value="Female" color="#1a202c" />
              <Picker.Item label="Other" value="Other" color="#1a202c" />
            </Picker>
          </View>
          {errors.gender && <Text style={styles.errorText}>{errors.gender}</Text>}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>
            <Icon name="graduation-cap" size={14} color="#666" /> Qualification{" "}
            <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, errors.qualification && styles.inputError]}
            placeholder="e.g., M.Sc Psychology"
            placeholderTextColor="#999"
            value={formData.qualification}
            onChangeText={(text) => handleChange("qualification", text)}
            editable={!isLoading}
          />
          {errors.qualification && (
            <Text style={styles.errorText}>{errors.qualification}</Text>
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>
            <Icon name="id-card" size={14} color="#666" /> Specialization{" "}
            <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, errors.specialization && styles.inputError]}
            placeholder="e.g., Clinical Psychology"
            placeholderTextColor="#999"
            value={formData.specialization}
            onChangeText={(text) => handleChange("specialization", text)}
            editable={!isLoading}
          />
          {errors.specialization && (
            <Text style={styles.errorText}>{errors.specialization}</Text>
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>
            <Icon name="briefcase" size={14} color="#666" /> Experience (Years){" "}
            <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, errors.experience && styles.inputError]}
            placeholder="Years of experience"
            placeholderTextColor="#999"
            value={formData.experience}
            onChangeText={(text) => handleChange("experience", text)}
            keyboardType="numeric"
            editable={!isLoading}
          />
          {errors.experience && (
            <Text style={styles.errorText}>{errors.experience}</Text>
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>
            <Icon name="map-marker-alt" size={14} color="#666" /> Location{" "}
            <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, errors.location && styles.inputError]}
            placeholder="City, State"
            placeholderTextColor="#999"
            value={formData.location}
            onChangeText={(text) => handleChange("location", text)}
            editable={!isLoading}
          />
          {errors.location && <Text style={styles.errorText}>{errors.location}</Text>}
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>
          <Icon name="users" size={14} color="#666" /> Consultation Mode{" "}
          <Text style={styles.required}>*</Text>
        </Text>
        <View style={styles.checkboxGroup}>
          {consultationModes.map((mode) => (
            <TouchableOpacity
              key={mode}
              style={styles.checkboxItem}
              onPress={() => {
                const isChecked = formData.consultationMode.includes(mode);
                handleChange("consultationMode", !isChecked, true, mode);
              }}
              disabled={isLoading}
            >
              <View
                style={[
                  styles.checkbox,
                  formData.consultationMode.includes(mode) && styles.checkboxChecked,
                ]}
              >
                {formData.consultationMode.includes(mode) && (
                  <Icon name="check" size={12} color="#fff" />
                )}
              </View>
              <Text style={styles.checkboxLabel}>{mode}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {errors.consultationMode && (
          <Text style={styles.errorText}>{errors.consultationMode}</Text>
        )}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>
          <Icon name="language" size={14} color="#666" /> Languages{" "}
          <Text style={styles.required}>*</Text>
        </Text>
        <View style={styles.checkboxGroup}>
          {languageOptions.map((lang) => (
            <TouchableOpacity
              key={lang}
              style={styles.checkboxItem}
              onPress={() => {
                const isChecked = formData.languages.includes(lang);
                handleChange("languages", !isChecked, true, lang);
              }}
              disabled={isLoading}
            >
              <View
                style={[
                  styles.checkbox,
                  formData.languages.includes(lang) && styles.checkboxChecked,
                ]}
              >
                {formData.languages.includes(lang) && (
                  <Icon name="check" size={12} color="#fff" />
                )}
              </View>
              <Text style={styles.checkboxLabel}>{lang}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {errors.languages && <Text style={styles.errorText}>{errors.languages}</Text>}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>
          <Icon name="info-circle" size={14} color="#666" /> About Me{" "}
          <Text style={styles.required}>*</Text>
        </Text>
        <TextInput
          style={[styles.textArea, errors.aboutMe && styles.inputError]}
          placeholder="Tell us about yourself, your approach, and expertise..."
          placeholderTextColor="#999"
          value={formData.aboutMe}
          onChangeText={(text) => handleChange("aboutMe", text)}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          editable={!isLoading}
        />
        {errors.aboutMe && <Text style={styles.errorText}>{errors.aboutMe}</Text>}
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>
          <Icon name="lock" size={14} color="#666" /> Password{" "}
          <Text style={styles.required}>*</Text>
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
            onPress={() => setShowPassword((prev) => !prev)}
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
          <Icon name="lock" size={14} color="#666" /> Confirm Password{" "}
          <Text style={styles.required}>*</Text>
        </Text>
        <View style={styles.passwordWrapper}>
          <TextInput
            style={[
              styles.input,
              styles.passwordInput,
              errors.confirmPassword && styles.inputError,
            ]}
            placeholder="Confirm your password"
            placeholderTextColor="#999"
            value={formData.confirmPassword}
            onChangeText={(text) => handleChange("confirmPassword", text)}
            secureTextEntry={!showConfirmPassword}
            editable={!isLoading}
          />
          <TouchableOpacity
            onPress={() => setShowConfirmPassword((prev) => !prev)}
            style={styles.passwordToggle}
            disabled={isLoading}
          >
            <Text style={styles.toggleText}>{showConfirmPassword ? "Hide" : "Show"}</Text>
          </TouchableOpacity>
        </View>
        {errors.confirmPassword && (
          <Text style={styles.errorText}>{errors.confirmPassword}</Text>
        )}
      </View>

      <Text style={styles.termsText}>
        By signing up, you agree to our{" "}
        <Text style={styles.termsLink}>Terms of Service</Text> and{" "}
        <Text style={styles.termsLink}>Privacy Policy</Text>
      </Text>
    </>
  );

  return (
    <LinearGradient colors={["#667eea", "#764ba2"]} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollView}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ✅ FIX: Modals rendered inline as JSX, NOT as sub-components */}
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
              <View
                style={styles.modalContent}
                onStartShouldSetResponder={() => true}
              >
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
                  <Text style={styles.modalText}>
                    Enter the verification code sent to
                  </Text>
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
                      style={[
                        styles.verifyButton,
                        (!emailOtp || emailOtpSuccess) && styles.disabledButton,
                      ]}
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
                      style={[
                        styles.resendButton,
                        (isSendingEmailOtp || emailResendTimer > 0 || emailOtpSuccess) &&
                          styles.disabledButton,
                      ]}
                      onPress={handleSendEmailOtp}
                      disabled={
                        isSendingEmailOtp || emailResendTimer > 0 || emailOtpSuccess
                      }
                    >
                      <Text style={styles.resendButtonText}>
                        {isSendingEmailOtp
                          ? "Sending..."
                          : emailResendTimer > 0
                          ? `Resend in ${emailResendTimer}s`
                          : "Resend Code"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {emailOtpSuccess && (
                    <View style={styles.successContainer}>
                      <Icon name="check-circle" size={20} color="#4CAF50" />
                      <Text style={styles.successText}>
                        Email verified successfully!
                      </Text>
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
              <View
                style={styles.modalContent}
                onStartShouldSetResponder={() => true}
              >
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
                  <Text style={styles.modalText}>
                    Enter the verification code sent to
                  </Text>
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
                      style={[
                        styles.verifyButton,
                        (!phoneOtp || phoneOtpSuccess) && styles.disabledButton,
                      ]}
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
                      style={[
                        styles.resendButton,
                        (isSendingPhoneOtp || phoneResendTimer > 0 || phoneOtpSuccess) &&
                          styles.disabledButton,
                      ]}
                      onPress={handleSendPhoneOtp}
                      disabled={
                        isSendingPhoneOtp || phoneResendTimer > 0 || phoneOtpSuccess
                      }
                    >
                      <Text style={styles.resendButtonText}>
                        {isSendingPhoneOtp
                          ? "Sending..."
                          : phoneResendTimer > 0
                          ? `Resend in ${phoneResendTimer}s`
                          : "Resend Code"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {phoneOtpSuccess && (
                    <View style={styles.successContainer}>
                      <Icon name="check-circle" size={20} color="#4CAF50" />
                      <Text style={styles.successText}>
                        Phone verified successfully!
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          </Modal>

          <View style={styles.brandSection}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoText}>Counselors</Text>
            </View>
            <Text style={styles.brandTitle}>
              {isLogin ? "Welcome Back!" : "Join Our Community"}
            </Text>
            <Text style={styles.brandSubtitle}>
              {isLogin
                ? "Connect with expert counselors and find the support you need."
                : "Start your journey as a certified mental health counselor."}
            </Text>
            <View style={styles.features}>
              <Text style={styles.feature}>✓ Expert Counselors</Text>
              <Text style={styles.feature}>✓ 24/7 Support</Text>
              <Text style={styles.feature}>✓ Confidential Sessions</Text>
            </View>
          </View>

          <View style={styles.formSection}>
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

            <View style={styles.form}>
              {isLogin ? renderLoginForm() : renderSignupForm()}

              <TouchableOpacity
                style={[styles.submitButton, isLoading && styles.submitButtonLoading]}
                onPress={handleSubmit}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.submitText}>
                      {isLogin ? "Logging in..." : "Creating Account..."}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.submitText}>
                    {isLogin ? "Login" : "Create Account"}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  brandSection: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoContainer: {
    marginBottom: 20,
  },
  logoText: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
  },
  brandTitle: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 10,
    textAlign: "center",
  },
  brandSubtitle: {
    fontSize: 16,
    color: "rgba(255,255,255,0.9)",
    textAlign: "center",
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  features: {
    alignItems: "flex-start",
    backgroundColor: "rgba(255,255,255,0.1)",
    padding: 15,
    borderRadius: 10,
    width: "100%",
  },
  feature: {
    color: "#fff",
    fontSize: 14,
    marginVertical: 5,
  },
  formSection: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  formHeader: {
    alignItems: "center",
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 5,
  },
  formSubtitle: {
    fontSize: 14,
    color: "#666",
  },
  toggleLink: {
    color: "#667eea",
    fontWeight: "bold",
  },
  form: {
    width: "100%",
  },
  field: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333",
    marginBottom: 5,
  },
  required: {
    color: "#f44336",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: "#fafafa",
    color: "#1a202c",
  },
  textArea: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: "#fafafa",
    minHeight: 100,
    textAlignVertical: "top",
    color: "#1a202c",
  },
  inputError: {
    borderColor: "#f44336",
  },
  verifiedInput: {
    borderColor: "#4caf50",
    backgroundColor: "#fff",
  },
  errorText: {
    color: "#f44336",
    fontSize: 12,
    marginTop: 5,
  },
  passwordWrapper: {
    position: "relative",
  },
  passwordInput: {
    paddingRight: 60,
  },
  passwordToggle: {
    position: "absolute",
    right: 12,
    top: 12,
  },
  toggleText: {
    color: "#667eea",
    fontSize: 14,
    fontWeight: "500",
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
    color: "#666",
  },
  forgotText: {
    color: "#667eea",
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
    backgroundColor: "#667eea",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 70,
    alignItems: "center",
  },
  verifyButtonSmText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e8f5e9",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 5,
  },
  verifiedText: {
    color: "#4caf50",
    fontSize: 13,
    fontWeight: "500",
  },
  grid: {
    marginBottom: 10,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    backgroundColor: "#fafafa",
    overflow: "hidden",
  },
  picker: {
    height: 50,
    marginLeft: 5,
    width: "100%",
    color: "#1a202c",
  },
  checkboxGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 5,
  },
  checkboxItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 15,
    marginBottom: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#667eea",
    marginRight: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxChecked: {
    backgroundColor: "#667eea",
  },
  termsText: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
    marginTop: 15,
  },
  termsLink: {
    color: "#667eea",
    fontWeight: "500",
  },
  submitButton: {
    backgroundColor: "#667eea",
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
  },
  submitButtonLoading: {
    opacity: 0.7,
  },
  submitText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 20,
    width: width * 0.85,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  modalIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#e3f2fd",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
    flex: 1,
    textAlign: "center",
  },
  modalBody: {
    alignItems: "center",
  },
  modalText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 5,
  },
  modalRecipient: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 20,
  },
  otpInput: {
    width: "100%",
    marginBottom: 15,
  },
  otpDigitBox: {
    minHeight: 56,
    borderColor: "#ddd",
    backgroundColor: "#fafafa",
  },
  otpDigitBoxFocused: {
    borderColor: "#667eea",
  },
  otpDigitBoxSuccess: {
    borderColor: "#4caf50",
    backgroundColor: "#e8f5e9",
  },
  otpDigitText: {
    color: "#333",
  },
  otpError: {
    color: "#f44336",
    fontSize: 12,
    marginBottom: 15,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 15,
    gap: 10,
  },
  verifyButton: {
    backgroundColor: "#667eea",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1,
    alignItems: "center",
  },
  verifyButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  resendButton: {
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1,
    alignItems: "center",
  },
  resendButtonText: {
    color: "#666",
  },
  disabledButton: {
    opacity: 0.5,
  },
  successContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 10,
    gap: 5,
  },
  successText: {
    color: "#4caf50",
    fontSize: 14,
  },
});

export default CounselorSignup;
