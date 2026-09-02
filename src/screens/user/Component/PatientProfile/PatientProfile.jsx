import React, { useState, useEffect } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Image,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  useWindowDimensions,
  StatusBar,
  Linking,
  Alert,
} from "react-native";
import TextInput from '../../../../components/TranslatedTextInput';
import Text from '../../../../components/TranslatedText';
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import Ionicons from "react-native-vector-icons/Ionicons";
import MaterialIcons from "react-native-vector-icons/MaterialIcons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useNavigation } from "@react-navigation/native";
import { API_BASE_URL } from "../../../../axiosConfig";
import { captureAndSendLocation } from "../../../../utils/locationHelper";
import AvatarPicker from "./AvatarPicker";
import PATIENT, {
  PATIENT_GRADIENT,
  TRANSPARENT_GRADIENT,
  GRADIENT_DIRECTION,
} from "../../../../theme/palette";
import LinearGradient from "react-native-linear-gradient";
import { toImageUri } from '../../../../utils/imageUri';
import useLanguageRender from '../../../../hooks/useLanguageRender';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import CountryPhoneInput from '../../../../components/common/CountryPhoneInput';
import {
  getPhoneLengthLabel,
  isValidLocalPhoneNumber,
  normalizeLocalPhoneNumber,
  splitInternationalPhoneNumber,
} from '../../../../utils/countryCodes';
import {
  calculateAgeFromDateOfBirth,
  formatDateOfBirthDisplay,
  getDatePickerValue,
  toDateOnlyString,
} from '../../../../utils/dateOfBirth';

const PatientProfile = ({ onProfileUpdate }) => {
  const insets = useSafeAreaInsets();
  const { height: viewportHeight, width: viewportWidth } = useWindowDimensions();
  const responsiveContentWidth = Math.max(0, Math.min(viewportWidth - 32, 900));
  const navigation = useNavigation();
  const { t } = useLanguageRender();
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [profileImage, setProfileImage] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [showAvatarBuilder, setShowAvatarBuilder] = useState(false);
  const [showAvatarChooser, setShowAvatarChooser] = useState(false);
  const [showBloodGroupDropdown, setShowBloodGroupDropdown] = useState(false);
  const [showDateOfBirthPicker, setShowDateOfBirthPicker] = useState(false);
  const [showNotification, setShowNotification] = useState({
    show: false,
    message: "",
    type: "",
  });

  // Email changes remain OTP-gated. Phone changes use format validation only.
  const blankChange = {
    sending: false,
    sent: false,
    verifying: false,
    verified: false,
    verifiedValue: null,
    otp: "",
    error: "",
  };
  const [emailChange, setEmailChange] = useState(blankChange);
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);

  const [patientData, setPatientData] = useState({
    personalInfo: {
      id: "",
      name: "",
      anonymous: "",
      age: null,
      gender: "",
      dateOfBirth: "",
      bloodGroup: "",
      email: "",
      phone: "",
      profilePhoto: "",
      address: {
        line1: "",
        line2: "",
        city: "",
        state: "",
        pincode: "",
        country: "",
      },
      emergencyContact: {
        name: "",
        relation: "",
        phone: "",
      },
    },
    medicalInfo: {
      height: "",
      weight: "",
      allergies: [],
      chronicConditions: [],
      currentMedications: [],
    },
    insuranceInfo: {
      provider: "",
      policyNumber: "",
      groupNumber: "",
      coverageAmount: "",
      validityDate: "",
      nominee: "",
      relationship: "",
      insuranceType: "",
    },
  });



  const bloodGroups = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
  const genders = ["Male", "Female", "Other"];

  const normalizeGender = (value) => {
    if (!value) return "";
    const v = String(value).trim().toLowerCase();
    if (v === "m" || v === "male") return "male";
    if (v === "f" || v === "female") return "female";
    if (v === "o" || v === "other") return "other";
    return v;
  };

  const normalizeBloodGroup = (value) => {
    if (!value) return "";
    return String(value).replace(/\s+/g, "").toUpperCase();
  };

  const [editFormData, setEditFormData] = useState({
    name: "",
    anonymous: "",
    age: "",
    gender: "",
    dateOfBirth: "",
    bloodGroup: "",
    email: "",
    phone: "",
    phoneCountryCode: "+91",
    address: {
      line1: "",
      line2: "",
      city: "",
      state: "",
      pincode: "",
      country: "India",
    },
    emergencyContact: { name: "", relation: "", phone: "", phoneCountryCode: "+91" },
    height: "",
    weight: "",
    allergies: "",
    chronicConditions: "",
    currentMedications: "",
  });

  useEffect(() => {
    fetchPatientProfile();
  }, []);

  const isGeneratedUserAvatarUrl = (raw) => {
    const url =
      typeof raw === "string"
        ? raw
        : raw?.url || raw?.secure_url || "";
    const value = String(url || "").trim();
    if (!value) return false;
    return (
      value.startsWith("data:image/") ||
      /^https:\/\/api\.dicebear\.com\//i.test(value)
    );
  };

  const getProfilePhotoUrl = (userData) => {
    if (isGeneratedUserAvatarUrl(userData.profilePhoto)) {
      return typeof userData.profilePhoto === "string"
        ? userData.profilePhoto
        : userData.profilePhoto.url || userData.profilePhoto.secure_url || "";
    }
    return "";
  };

  const fetchPatientProfile = async () => {
    try {
      setLoading(true);
      const userId = await AsyncStorage.getItem("userId");
      const token = await AsyncStorage.getItem("token");

      if (!userId) {
        showNotificationMessage(
          "User ID not found. Please login again.",
          "error"
        );
        setLoading(false);
        return;
      }

      const response = await axios.get(
        `${API_BASE_URL}/api/auth/getUser/${userId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.data.success && response.data.user) {
        const userData = response.data.user;
        const profilePhotoUrl = getProfilePhotoUrl(userData);

        const dateOfBirth = userData.dateOfBirth
          ? userData.dateOfBirth.split("T")[0]
          : "";
        const ageFromDateOfBirth = calculateAgeFromDateOfBirth(dateOfBirth);

        const formattedData = {
          personalInfo: {
            id: userData._id,
            name: userData.fullName || "",
            anonymous: userData.anonymous || "",
            age: ageFromDateOfBirth ?? userData.age ?? null,
            gender: userData.gender || "",
            dateOfBirth,
            bloodGroup: normalizeBloodGroup(userData.bloodGroup),
            email: userData.email || "",
            phone: userData.phoneNumber || "",
            phoneCountryCode: userData.phoneCountryCode || "+91",
            profilePhoto: profilePhotoUrl,
            address: userData.address || {
              line1: "",
              line2: "",
              city: "",
              state: "",
              pincode: "",
              country: "",
            },
            emergencyContact: userData.emergencyContact || {
              name: "",
              relation: "",
              phone: "",
            },
          },
          medicalInfo: {
            height: userData.medicalInfo?.height || "",
            weight: userData.medicalInfo?.weight || "",
            allergies: Array.isArray(userData.medicalInfo?.allergies)
              ? userData.medicalInfo.allergies
              : [],
            chronicConditions: Array.isArray(
              userData.medicalInfo?.chronicConditions
            )
              ? userData.medicalInfo.chronicConditions
              : [],
            currentMedications: Array.isArray(
              userData.medicalInfo?.currentMedications
            )
              ? userData.medicalInfo.currentMedications
              : [],
          },
          insuranceInfo: {
            provider: userData.insuranceInfo?.provider || "",
            policyNumber: userData.insuranceInfo?.policyNumber || "",
            groupNumber: userData.insuranceInfo?.groupNumber || "",
            coverageAmount: userData.insuranceInfo?.coverageAmount || "",
            validityDate: userData.insuranceInfo?.validityDate
              ? userData.insuranceInfo.validityDate.split("T")[0]
              : "",
            nominee: userData.insuranceInfo?.nominee || "",
            relationship: userData.insuranceInfo?.relationship || "",
            insuranceType: userData.insuranceInfo?.insuranceType || "",
          },
        };

        setPatientData(formattedData);
        initializeEditForm(formattedData);
      } else {
        showNotificationMessage(
          response.data.message || "Failed to load profile data",
          "error"
        );
      }
    } catch (err) {
      console.error("Error fetching profile:", err);
      showNotificationMessage(
        "Failed to load profile data. Please try again.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const updatePatientProfile = async (formData) => {
    const userId = await AsyncStorage.getItem("userId");
    const token = await AsyncStorage.getItem("token");
    return await axios.patch(
      `${API_BASE_URL}/api/auth/update/${userId}`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      }
    );
  };

  const initializeEditForm = (data) => {
    const primaryPhone = splitInternationalPhoneNumber(
      data.personalInfo.phone || "",
      data.personalInfo.phoneCountryCode || "+91",
    );
    const emergencyPhone = splitInternationalPhoneNumber(
      data.personalInfo.emergencyContact?.phone || "",
    );
    setEditFormData({
      name: data.personalInfo.name || "",
      anonymous: data.personalInfo.anonymous || "",
      age:
        calculateAgeFromDateOfBirth(data.personalInfo.dateOfBirth)?.toString() ||
        data.personalInfo.age?.toString() ||
        "",
      gender: normalizeGender(data.personalInfo.gender),
      dateOfBirth: data.personalInfo.dateOfBirth || "",
      bloodGroup: normalizeBloodGroup(data.personalInfo.bloodGroup),
      email: data.personalInfo.email || "",
      phone: primaryPhone.phoneNumber,
      phoneCountryCode: primaryPhone.countryCode,
      address: {
        line1: data.personalInfo.address?.line1 || "",
        line2: data.personalInfo.address?.line2 || "",
        city: data.personalInfo.address?.city || "",
        state: data.personalInfo.address?.state || "",
        pincode: data.personalInfo.address?.pincode || "",
        country: data.personalInfo.address?.country || "India",
      },
      emergencyContact: {
        name: data.personalInfo.emergencyContact?.name || "",
        relation: data.personalInfo.emergencyContact?.relation || "",
        phone: emergencyPhone.phoneNumber,
        phoneCountryCode: emergencyPhone.countryCode,
      },
      height: data.medicalInfo.height?.toString() || "",
      weight: data.medicalInfo.weight?.toString() || "",
      allergies: Array.isArray(data.medicalInfo.allergies)
        ? data.medicalInfo.allergies.join(", ")
        : "",
      chronicConditions: Array.isArray(data.medicalInfo.chronicConditions)
        ? data.medicalInfo.chronicConditions.join(", ")
        : "",
      currentMedications: Array.isArray(data.medicalInfo.currentMedications)
        ? data.medicalInfo.currentMedications.join(", ")
        : "",
    });
  };

  const openEditModal = () => {
    initializeEditForm(patientData);
    setProfileImage(null);
    setIsEditing(true);
  };

  const showNotificationMessage = (message, type, duration = 3000) => {
    setShowNotification({ show: true, message, type });
    setTimeout(() => {
      setShowNotification({ show: false, message: "", type: "" });
    }, duration);
  };

  // Upload a generated avatar URL immediately.
  const uploadProfilePhoto = async (formData, successMsg) => {
    try {
      setPhotoUploading(true);
      const response = await updatePatientProfile(formData);
      if (response.data?.success) {
        showNotificationMessage(successMsg, "success");
        await fetchPatientProfile();
        if (onProfileUpdate) onProfileUpdate();
      } else {
        showNotificationMessage(
          response.data?.message || "Failed to update photo",
          "error"
        );
      }
    } catch (e) {
      showNotificationMessage(
        e.response?.data?.message || "Could not update photo. Please try again.",
        "error"
      );
    } finally {
      setPhotoUploading(false);
    }
  };

  // Generated avatar selected → save it immediately.
  const handleAvatarSelect = async (avatarUrl) => {
    setShowAvatarBuilder(false);
    if (isEditing) {
      // Inside the edit form, defer to the form's Save button.
      setProfileImage(avatarUrl);
      return;
    }
    const formData = new FormData();
    formData.append("avatarUrl", avatarUrl);
    await uploadProfilePhoto(formData, "Avatar updated!");
  };

  // ─── Profile-change OTP helpers ────────────────────────────────────────
  const authHeaders = async () => {
    const token =
      (await AsyncStorage.getItem("accessToken")) ||
      (await AsyncStorage.getItem("token"));
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const isEmailDirty = () =>
    String(editFormData?.email || "").trim().toLowerCase() !==
    String(patientData?.personalInfo?.email || "").trim().toLowerCase();

  const emailReady =
    !isEmailDirty() ||
    (emailChange.verified &&
      emailChange.verifiedValue ===
        String(editFormData?.email || "").trim().toLowerCase());
  const sendChangeOtp = async () => {
    const setState = setEmailChange;
    const newValue = String(editFormData.email || "").trim().toLowerCase();
    setState((s) => ({ ...s, sending: true, error: "" }));
    try {
      const headers = await authHeaders();
      const res = await axios.post(
        `${API_BASE_URL}/api/auth/profile-change/send-otp`,
        { field: "email", newValue },
        { headers, timeout: 15000 },
      );
      if (res.data?.success) {
        setState({
          sending: false,
          sent: true,
          verifying: false,
          verified: false,
          verifiedValue: null,
          otp: "",
          error: "",
        });
        showNotificationMessage(res.data.message || "OTP sent", "success");
      } else {
        throw new Error(res.data?.message || "Failed to send OTP");
      }
    } catch (err) {
      let msg = err.response?.data?.message || err.message;
      if (err?.response?.status === 404) {
        msg =
          "Backend route /api/auth/profile-change/send-otp not found. Deploy it on the backend first.";
      }
      setState((s) => ({ ...s, sending: false, error: msg }));
      showNotificationMessage(msg, "error");
    }
  };

  const verifyChangeOtp = async () => {
    const setState = setEmailChange;
    const state = emailChange;
    const newValue = String(editFormData.email || "").trim().toLowerCase();
    if (!state.otp || state.otp.length < 4) {
      setState((s) => ({ ...s, error: "Enter the OTP first" }));
      return;
    }
    setState((s) => ({ ...s, verifying: true, error: "" }));
    try {
      const headers = await authHeaders();
      const res = await axios.post(
        `${API_BASE_URL}/api/auth/profile-change/verify-otp`,
        { field: "email", newValue, otp: state.otp },
        { headers },
      );
      if (res.data?.success) {
        setState({
          sending: false,
          sent: false,
          verifying: false,
          verified: true,
          verifiedValue: newValue,
          otp: "",
          error: "",
        });
        showNotificationMessage(
          "Email verified",
          "success",
        );
      } else {
        throw new Error(res.data?.message || "Verification failed");
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message;
      setState((s) => ({ ...s, verifying: false, error: msg }));
      showNotificationMessage(msg, "error");
    }
  };

  // Re-edit invalidates a prior verification — same UX as web.
  useEffect(() => {
    if (
      emailChange.verified &&
      emailChange.verifiedValue !==
        String(editFormData?.email || "").trim().toLowerCase()
    ) {
      setEmailChange(blankChange);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editFormData?.email]);

  // Reset when exiting edit mode.
  useEffect(() => {
    if (!isEditing) {
      setEmailChange(blankChange);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  const handleUpdateLocation = async () => {
    setIsUpdatingLocation(true);
    try {
      await captureAndSendLocation("manual");
      showNotificationMessage("Location updated successfully", "success");
    } catch (err) {
      // The notification banner auto-hides after 3s, which is far too short for
      // anything the user has to act on - and there is nothing to tap. So a
      // permission problem gets a dialog that opens Settings directly instead of
      // a message telling them to hunt through Android menus, and a failed fix
      // gets a Retry. Everything else stays a simple banner.
      const kind = err?.kind;
      const message =
        err?.message ||
        "Couldn't update your location. Please try again.";

      // The user just declined the system prompt - they already answered. Popping
      // a second dialog telling them to allow it is nagging, so acknowledge it
      // quietly and let them tap Update again whenever they want.
      if (kind === "permission") {
        showNotificationMessage("Location not updated", "error");
        return;
      }

      // Permanently blocked: the system prompt will never reappear, so Settings
      // is genuinely the only way. Worth one dialog.
      if (kind === "blocked") {
        Alert.alert(
          "Location is turned off",
          "Location permission is blocked for Humaeli, so it can't be updated from here. You can turn it back on in Settings.",
          [
            { text: "Not now", style: "cancel" },
            { text: "Open settings", onPress: () => Linking.openSettings() },
          ],
        );
        return;
      }

      if (kind === "no-fix") {
        Alert.alert("Couldn't find your location", message, [
          { text: "Cancel", style: "cancel" },
          { text: "Try again", onPress: () => handleUpdateLocation() },
        ]);
        return;
      }

      showNotificationMessage(message, "error");
    } finally {
      setIsUpdatingLocation(false);
    }
  };

  const showValidationWarning = (title, message) => {
    showNotificationMessage(`${title}: ${message}`, "warning", 4500);
  };

  const validateProfileBeforeSave = () => {
    const fullName = String(editFormData.name || "").trim();
    const email = String(editFormData.email || "").trim();
    const primaryPhone = String(editFormData.phone || "").trim();
    const normalizedPhone = normalizeLocalPhoneNumber(
      primaryPhone,
      editFormData.phoneCountryCode,
    );
    const dateOfBirth = toDateOnlyString(editFormData.dateOfBirth);
    const calculatedAge = calculateAgeFromDateOfBirth(dateOfBirth);
    const emergency = editFormData.emergencyContact || {};
    const emergencyName = String(emergency.name || "").trim();
    const emergencyRelation = String(emergency.relation || "").trim();
    const emergencyRawPhone = String(emergency.phone || "").trim();
    const emergencyPhone = normalizeLocalPhoneNumber(
      emergencyRawPhone,
      emergency.phoneCountryCode,
    );

    if (!fullName) {
      return {
        valid: false,
        title: "Name required",
        message: "Please enter your full name before saving your profile.",
      };
    }

    if (!dateOfBirth || calculatedAge === null) {
      return {
        valid: false,
        title: "Date of birth required",
        message: "Please select a valid date of birth before saving your profile.",
      };
    }

    if (calculatedAge < 13 || calculatedAge > 120) {
      return {
        valid: false,
        title: "Check date of birth",
        message: "Please enter a valid date of birth. Age must be between 13 and 120.",
      };
    }

    if (!email) {
      return {
        valid: false,
        title: "Email required",
        message: "Please enter your email address before saving your profile.",
      };
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return {
        valid: false,
        title: "Invalid email",
        message: "Please enter a valid email address.",
      };
    }

    if (!primaryPhone) {
      return {
        valid: false,
        title: "Phone number required",
        message: `Please enter your ${getPhoneLengthLabel(editFormData.phoneCountryCode)} digit phone number.`,
      };
    }

    if (!isValidLocalPhoneNumber(normalizedPhone, editFormData.phoneCountryCode)) {
      return {
        valid: false,
        title: "Invalid phone number",
        message: `Please enter a valid ${getPhoneLengthLabel(editFormData.phoneCountryCode)} digit phone number.`,
      };
    }

    if (!emergencyName) {
      return {
        valid: false,
        title: "Emergency contact required",
        message: "Please enter emergency contact name before saving your profile.",
      };
    }

    if (!emergencyRelation) {
      return {
        valid: false,
        title: "Emergency relation required",
        message: "Please enter your relation with the emergency contact.",
      };
    }

    if (!emergencyRawPhone) {
      return {
        valid: false,
        title: "Emergency phone required",
        message: `Please enter emergency contact ${getPhoneLengthLabel(emergency.phoneCountryCode)} digit phone number.`,
      };
    }

    if (!isValidLocalPhoneNumber(emergencyPhone, emergency.phoneCountryCode)) {
      return {
        valid: false,
        title: "Invalid emergency phone",
        message: `Emergency contact phone must be ${getPhoneLengthLabel(emergency.phoneCountryCode)} digits.`,
      };
    }

    return {
      valid: true,
      dateOfBirth,
      calculatedAge,
      normalizedPhone,
      emergencyPhone,
    };
  };

  const normalizeProfileText = (value) => String(value || "").trim();
  const normalizeProfileListText = (value) =>
    String(value || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .join(", ");

  const hasProfileChanges = (validation) => {
    const savedPrimaryPhone = splitInternationalPhoneNumber(
      patientData.personalInfo.phone || "",
      patientData.personalInfo.phoneCountryCode || "+91",
    );
    const savedEmergencyPhone = splitInternationalPhoneNumber(
      patientData.personalInfo.emergencyContact?.phone || "",
      patientData.personalInfo.emergencyContact?.phoneCountryCode || "+91",
    );
    const savedDateOfBirth = toDateOnlyString(patientData.personalInfo.dateOfBirth);
    const savedAge =
      calculateAgeFromDateOfBirth(savedDateOfBirth) ??
      patientData.personalInfo.age ??
      "";
    const saved = {
      name: normalizeProfileText(patientData.personalInfo.name),
      anonymous: normalizeProfileText(patientData.personalInfo.anonymous),
      email: normalizeProfileText(patientData.personalInfo.email).toLowerCase(),
      phone: normalizeLocalPhoneNumber(savedPrimaryPhone.phoneNumber, savedPrimaryPhone.countryCode),
      phoneCountryCode: savedPrimaryPhone.countryCode,
      age: String(savedAge),
      gender: normalizeGender(patientData.personalInfo.gender),
      dateOfBirth: savedDateOfBirth || "",
      bloodGroup: normalizeBloodGroup(patientData.personalInfo.bloodGroup),
      address: {
        line1: normalizeProfileText(patientData.personalInfo.address?.line1),
        line2: normalizeProfileText(patientData.personalInfo.address?.line2),
        city: normalizeProfileText(patientData.personalInfo.address?.city),
        state: normalizeProfileText(patientData.personalInfo.address?.state),
        pincode: normalizeProfileText(patientData.personalInfo.address?.pincode),
        country: normalizeProfileText(patientData.personalInfo.address?.country || "India"),
      },
      emergencyContact: {
        name: normalizeProfileText(patientData.personalInfo.emergencyContact?.name),
        relation: normalizeProfileText(patientData.personalInfo.emergencyContact?.relation),
        phone: normalizeLocalPhoneNumber(savedEmergencyPhone.phoneNumber, savedEmergencyPhone.countryCode),
        phoneCountryCode: savedEmergencyPhone.countryCode,
      },
      height: normalizeProfileText(patientData.medicalInfo.height),
      weight: normalizeProfileText(patientData.medicalInfo.weight),
      allergies: Array.isArray(patientData.medicalInfo.allergies)
        ? patientData.medicalInfo.allergies.map((item) => normalizeProfileText(item)).filter(Boolean).join(", ")
        : normalizeProfileListText(patientData.medicalInfo.allergies),
      chronicConditions: Array.isArray(patientData.medicalInfo.chronicConditions)
        ? patientData.medicalInfo.chronicConditions.map((item) => normalizeProfileText(item)).filter(Boolean).join(", ")
        : normalizeProfileListText(patientData.medicalInfo.chronicConditions),
      currentMedications: Array.isArray(patientData.medicalInfo.currentMedications)
        ? patientData.medicalInfo.currentMedications.map((item) => normalizeProfileText(item)).filter(Boolean).join(", ")
        : normalizeProfileListText(patientData.medicalInfo.currentMedications),
    };

    const current = {
      name: normalizeProfileText(editFormData.name),
      anonymous: normalizeProfileText(editFormData.anonymous),
      email: normalizeProfileText(editFormData.email).toLowerCase(),
      phone: validation.normalizedPhone,
      phoneCountryCode: editFormData.phoneCountryCode,
      age: validation.calculatedAge.toString(),
      gender: normalizeGender(editFormData.gender),
      dateOfBirth: validation.dateOfBirth,
      bloodGroup: normalizeBloodGroup(editFormData.bloodGroup),
      address: {
        line1: normalizeProfileText(editFormData.address.line1),
        line2: normalizeProfileText(editFormData.address.line2),
        city: normalizeProfileText(editFormData.address.city),
        state: normalizeProfileText(editFormData.address.state),
        pincode: normalizeProfileText(editFormData.address.pincode),
        country: normalizeProfileText(editFormData.address.country || "India"),
      },
      emergencyContact: {
        name: normalizeProfileText(editFormData.emergencyContact.name),
        relation: normalizeProfileText(editFormData.emergencyContact.relation),
        phone: validation.emergencyPhone,
        phoneCountryCode: editFormData.emergencyContact.phoneCountryCode,
      },
      height: normalizeProfileText(editFormData.height),
      weight: normalizeProfileText(editFormData.weight),
      allergies: normalizeProfileListText(editFormData.allergies),
      chronicConditions: normalizeProfileListText(editFormData.chronicConditions),
      currentMedications: normalizeProfileListText(editFormData.currentMedications),
    };

    const avatarChanged =
      Boolean(profileImage) &&
      typeof profileImage === "string" &&
      toImageUri(profileImage) !== toImageUri(patientData.personalInfo.profilePhoto);

    return avatarChanged || JSON.stringify(current) !== JSON.stringify(saved);
  };

  const handleSaveProfile = async () => {
    if (!emailReady) {
      showValidationWarning(
        "Email verification required",
        "Please verify your new email with OTP before saving your profile.",
      );
      return;
    }

    const validation = validateProfileBeforeSave();
    if (!validation.valid) {
      showValidationWarning(validation.title, validation.message);
      return;
    }

    if (!hasProfileChanges(validation)) {
      showValidationWarning(
        "No changes to save",
        "Please update any profile detail before tapping Save Changes.",
      );
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();

      formData.append("fullName", editFormData.name);
      formData.append("anonymous", editFormData.anonymous || "");
      formData.append("email", String(editFormData.email || "").trim());
      formData.append("phoneNumber", validation.normalizedPhone);
      formData.append("phoneCountryCode", editFormData.phoneCountryCode);
      formData.append("age", validation.calculatedAge.toString());
      formData.append("gender", editFormData.gender);
      formData.append("bloodGroup", editFormData.bloodGroup);
      formData.append("dateOfBirth", validation.dateOfBirth);

      const addressObj = {
        ...editFormData.address,
        country: editFormData.address.country || "India",
      };
      formData.append("address", JSON.stringify(addressObj));
      formData.append(
        "emergencyContact",
        JSON.stringify({
          ...editFormData.emergencyContact,
          phone: validation.emergencyPhone,
        })
      );

      const medicalObj = {
        height: editFormData.height,
        weight: editFormData.weight,
        allergies: editFormData.allergies
          ? editFormData.allergies
              .split(",")
              .map((item) => item.trim())
              .filter((item) => item)
          : [],
        chronicConditions: editFormData.chronicConditions
          ? editFormData.chronicConditions
              .split(",")
              .map((item) => item.trim())
              .filter((item) => item)
          : [],
        currentMedications: editFormData.currentMedications
          ? editFormData.currentMedications
              .split(",")
              .map((item) => item.trim())
              .filter((item) => item)
          : [],
      };
      formData.append("medicalInfo", JSON.stringify(medicalObj));


      if (
        profileImage &&
        typeof profileImage === "string" &&
        profileImage.startsWith("http")
      ) {
        formData.append("avatarUrl", profileImage);
      }

      const response = await updatePatientProfile(formData);

      if (response.data.success) {
        showNotificationMessage("Profile updated successfully!", "success");
        await fetchPatientProfile();
        if (onProfileUpdate) onProfileUpdate();
        setIsEditing(false);
        setProfileImage(null);
      } else {
        showNotificationMessage(
          response.data.message || "Failed to update profile",
          "error"
        );
      }
    } catch (err) {
      console.error("Error updating profile:", err);
      showNotificationMessage(
        err.response?.data?.message || "Failed to update profile",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    initializeEditForm(patientData);
    setProfileImage(null);
  };

  const handleEditFormChange = (field, value) => {
    if (field.includes(".")) {
      const [parent, child] = field.split(".");
      setEditFormData((prev) => ({
        ...prev,
        [parent]: { ...prev[parent], [child]: value },
      }));
    } else if (field === "dateOfBirth") {
      const dateOfBirth = toDateOnlyString(value);
      const calculatedAge = calculateAgeFromDateOfBirth(dateOfBirth);
      setEditFormData((prev) => ({
        ...prev,
        dateOfBirth,
        age: calculatedAge !== null ? calculatedAge.toString() : "",
      }));
    } else {
      setEditFormData((prev) => ({ ...prev, [field]: value }));
    }
  };

  const handleDateOfBirthChange = (_event, selectedDate) => {
    if (Platform.OS === "android") {
      setShowDateOfBirthPicker(false);
    }
    if (!selectedDate) return;
    handleEditFormChange("dateOfBirth", toDateOnlyString(selectedDate));
  };

  const formatDate = (dateString) => {
    return formatDateOfBirthDisplay(dateString, t('profile:notSpecified'));
  };

  const getInitials = (name) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const renderNotification = () => {
    if (!showNotification.show) return null;
    return (
      <View style={styles.notification}>
        {showNotification.type === "success" ? (
          <LinearGradient
            colors={PATIENT_GRADIENT}
            {...GRADIENT_DIRECTION}
            style={styles.notificationFill}
          />
        ) : showNotification.type === "warning" ? (
          <LinearGradient
            colors={PATIENT_GRADIENT}
            {...GRADIENT_DIRECTION}
            style={styles.notificationFill}
          />
        ) : (
          <View style={[styles.notificationFill, styles.notificationError]} />
        )}
        <Text style={styles.notificationText}>{showNotification.message}</Text>
      </View>
    );
  };

  const renderProfileHeader = () => (
    <View style={[styles.card, styles.profileHeroCard, { width: responsiveContentWidth }]}>
      <Text style={styles.heroKicker}>{t('profile:patientProfile')}</Text>

      <View style={styles.avatarWrapper}>
        <TouchableOpacity
          style={styles.avatar}
          onPress={() => setShowAvatarChooser(true)}
          activeOpacity={0.85}
          disabled={photoUploading}
        >
          {patientData.personalInfo.profilePhoto ? (
            <Image
              source={{ uri: toImageUri(patientData.personalInfo.profilePhoto) }}
              style={styles.avatarImage}
            />
          ) : (
            <LinearGradient
              colors={PATIENT_GRADIENT}
              {...GRADIENT_DIRECTION}
              style={styles.avatarPlaceholder}
            >
              <Text style={styles.avatarPlaceholderText}>
                {getInitials(patientData.personalInfo.name)}
              </Text>
            </LinearGradient>
          )}
          {photoUploading && (
            <View style={styles.avatarUploading}>
              <ActivityIndicator size="small" color="#ffffff" />
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.editBadge}
          onPress={() => setShowAvatarChooser(true)}
          activeOpacity={0.8}
          disabled={photoUploading}
        >
          <Ionicons name="camera" size={13} color="white" />
        </TouchableOpacity>
      </View>

      <Text style={styles.name}>{patientData.personalInfo.name}</Text>
      <Text style={styles.heroSubtext} numberOfLines={1}>
        {patientData.personalInfo.email || patientData.personalInfo.phone || "Profile overview"}
      </Text>
      <View style={styles.idBadge}>
        <Text style={styles.patientId}>ID: {patientData.personalInfo.id.slice(-8).toUpperCase()}</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>{t('profile:blood')}</Text>
          <Text style={styles.statValue}>
            {normalizeBloodGroup(patientData.personalInfo.bloodGroup) || "--"}
          </Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>{t('profile:age')}</Text>
          <Text style={styles.statValue}>{patientData.personalInfo.age || "--"}y</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>{t('profile:gender')}</Text>
          <Text style={styles.statValueGender}>{patientData.personalInfo.gender || "Male"}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.editProfileBtnWrap}
        onPress={openEditModal}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={PATIENT_GRADIENT}
          {...GRADIENT_DIRECTION}
          style={styles.editProfileBtn}
        >
          <Ionicons name="create-outline" size={18} color="#ffffff" />
          <Text style={styles.editProfileBtnText}>{t('profile:editProfile', 'Edit Profile')}</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );

  const renderPersonalInfo = () => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="person-outline" size={20} color="#00652C" />
          <Text style={styles.cardTitle}>{t('profile:personalDetails')}</Text>
        </View>
      </View>
      <View style={styles.infoGrid}>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>{t('auth:fullName')}</Text>
          <Text style={styles.infoValue}>{patientData.personalInfo.name}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>{t('profile:anonymousName')}</Text>
          <Text style={styles.infoValue}>
            {patientData.personalInfo.anonymous || t('profile:notSpecified')}
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>{t('profile:dateOfBirth')}</Text>
          <Text style={styles.infoValue}>
            {formatDate(patientData.personalInfo.dateOfBirth)}
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>{t('profile:gender')}</Text>
          <Text style={styles.infoValue}>
            {patientData.personalInfo.gender || t('profile:notSpecified')}
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>{t('profile:bloodGroup')}</Text>
          <Text style={styles.infoValue}>
            {normalizeBloodGroup(patientData.personalInfo.bloodGroup) || t('profile:notSpecified')}
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>{t('auth:email')}</Text>
          <Text style={styles.infoValue}>{patientData.personalInfo.email}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>{t('auth:phone')}</Text>
          <Text style={styles.infoValue}>{patientData.personalInfo.phone}</Text>
        </View>
      </View>
    </View>
  );

  const renderAddress = () => (
    <View style={styles.card}>
      {/* No action icon here - the header's Edit Profile button already covers
          editing, and tapping the address itself should not navigate anywhere. */}
      <View style={styles.cardHeaderRow}>
        <View style={styles.cardTitleRow}>
          <Ionicons name="home" size={19} color="#00652C" />
          <Text style={styles.cardTitle}>{t('profile:address')}</Text>
        </View>
      </View>
      <View style={styles.addressDisplay}>
        <Text style={styles.addressText}>
          {patientData.personalInfo.address?.line1 || t('profile:noAddressProvided')}
        </Text>
        {patientData.personalInfo.address?.line2 && (
          <Text style={styles.addressText}>
            {patientData.personalInfo.address.line2}
          </Text>
        )}
        <Text style={styles.addressText}>
          {patientData.personalInfo.address?.city &&
            `${patientData.personalInfo.address.city}, `}
          {patientData.personalInfo.address?.state &&
            `${patientData.personalInfo.address.state} `}
          {patientData.personalInfo.address?.pincode &&
            `- ${patientData.personalInfo.address.pincode}`}
        </Text>
        {patientData.personalInfo.address?.country && (
          <Text style={styles.addressText}>
            {patientData.personalInfo.address.country}
          </Text>
        )}
      </View>
    </View>
  );

  const renderEmergencyContact = () => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardTitleRow}>
          <MaterialIcons name="emergency" size={20} color="#EF4444" />
          <Text style={styles.cardTitle}>{t('profile:emergencyContact')}</Text>
        </View>
      </View>
      <View style={styles.emergencyDisplay}>
        <View style={styles.sosBadge}>
          <Text style={styles.sosBadgeText}>{t('SOS')}</Text>
        </View>
        <View style={styles.emergencyDetails}>
          <Text style={styles.emergencyName}>
            {patientData.personalInfo.emergencyContact?.name || t('profile:notSpecified')}
          </Text>
          {!!patientData.personalInfo.emergencyContact?.relation && (
            <Text style={styles.emergencyRelation}>
              {patientData.personalInfo.emergencyContact.relation}
            </Text>
          )}
          {!!patientData.personalInfo.emergencyContact?.phone && (
            <Text style={styles.emergencyPhone}>
              {patientData.personalInfo.emergencyContact.phone}
            </Text>
          )}
        </View>
        {!!patientData.personalInfo.emergencyContact?.phone && (
          <TouchableOpacity
            style={styles.emergencyCallBtn}
            onPress={() => Linking.openURL(`tel:${patientData.personalInfo.emergencyContact.phone}`)}
            activeOpacity={0.85}
          >
            <Ionicons name="call" size={19} color="#00652C" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderEditModal = () => (
    <Modal
      visible={isEditing}
      animationType="slide"
      transparent={true}
      onRequestClose={handleCancelEdit}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContainer, {
          height: viewportHeight * 0.9,
          paddingBottom: Math.max(insets.bottom, 12),
        }]}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('settings:editProfile')}</Text>
            <TouchableOpacity onPress={handleCancelEdit} style={styles.closeModal}>
              <Text style={styles.closeModalText}>×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.modalBody}>
              {/* Avatar */}
              <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>{t('profile:createAvatar', 'Avatar')}</Text>
                <View style={styles.profilePictureEdit}>
                  <View style={styles.avatarPreview}>
                    {profileImage || patientData.personalInfo.profilePhoto ? (
                      <Image
                        source={{ uri: toImageUri(profileImage) || toImageUri(patientData.personalInfo.profilePhoto) }}
                        style={styles.avatarPreviewImage}
                      />
                    ) : (
                      <View style={styles.avatarPreviewPlaceholder}>
                        <Text style={styles.avatarPreviewText}>
                          {getInitials(editFormData.name)}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.uploadActions}>
                    <TouchableOpacity
                      style={styles.generateAvatarBtnWrap}
                      onPress={() => setShowAvatarBuilder(true)}
                      activeOpacity={0.85}
                    >
                      <LinearGradient
                        colors={PATIENT_GRADIENT}
                        {...GRADIENT_DIRECTION}
                        style={styles.generateAvatarBtn}
                      >
                        <Text style={styles.generateAvatarBtnText}>✨ {t('profile:createAvatar')}</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.uploadHint}>{t('profile:createAvatarSub', 'Build a custom cartoon avatar')}</Text>
                </View>
              </View>

              {/* Personal Info */}
              <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>{t('profile:personalInformation')}</Text>
                <View style={styles.formRow}>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>{t('auth:fullName')} *</Text>
                    <TextInput
                      style={styles.input}
                      value={editFormData.name}
                      onChangeText={(text) => handleEditFormChange("name", text)}
                    />
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>{t('profile:anonymousName')}</Text>
                  <TextInput
                    style={styles.input}
                    value={editFormData.anonymous}
                    onChangeText={(text) => handleEditFormChange("anonymous", text)}
                    placeholder={t('Used in anonymous chats')}
                    placeholderTextColor="#94a3b8"
                  />
                </View>

                <View style={styles.formRow}>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>{t('profile:dateOfBirth')} *</Text>
                    <TouchableOpacity
                      style={styles.datePickerButton}
                      onPress={() => setShowDateOfBirthPicker(true)}
                      activeOpacity={0.85}
                    >
                      <Ionicons name="calendar-outline" size={20} color="#00652C" />
                      <Text
                        style={[
                          styles.datePickerText,
                          !editFormData.dateOfBirth && styles.datePickerPlaceholder,
                        ]}
                      >
                        {formatDateOfBirthDisplay(
                          editFormData.dateOfBirth,
                          t('Select date of birth'),
                        )}
                      </Text>
                      <Ionicons name="chevron-down" size={18} color="#94a3b8" />
                    </TouchableOpacity>
                    {showDateOfBirthPicker && (
                      <DateTimePicker
                        value={getDatePickerValue(editFormData.dateOfBirth)}
                        mode="date"
                        display={Platform.OS === "ios" ? "spinner" : "default"}
                        maximumDate={new Date()}
                        onChange={handleDateOfBirthChange}
                      />
                    )}
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>{t('profile:age')}</Text>
                    <TextInput
                      style={[styles.input, styles.readonly]}
                      value={editFormData.age}
                      editable={false}
                      placeholder={t('Age will be calculated')}
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                </View>

                <View style={styles.formRow}>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>{t('profile:gender')} *</Text>
                    <View style={styles.selectContainer}>
                      {genders.map((gender) => {
                        const isActive = editFormData.gender === gender.toLowerCase();
                        return (
                          <TouchableOpacity
                            key={gender}
                            style={styles.selectOptionWrap}
                            onPress={() => handleEditFormChange("gender", gender.toLowerCase())}
                            activeOpacity={0.85}
                          >
                            <LinearGradient
                              colors={isActive ? PATIENT_GRADIENT : TRANSPARENT_GRADIENT}
                              {...GRADIENT_DIRECTION}
                              style={[styles.selectOption, isActive && styles.selectOptionActive]}
                            >
                              <Text
                                style={[
                                  styles.selectOptionText,
                                  isActive && styles.selectOptionTextActive,
                                ]}
                              >
                                {gender}
                              </Text>
                            </LinearGradient>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>{t('profile:bloodGroup')}</Text>
                    <TouchableOpacity
                      style={styles.dropdownButton}
                      onPress={() => setShowBloodGroupDropdown(true)}
                    >
                      <Text style={styles.dropdownButtonText}>
                        {editFormData.bloodGroup || "Select Blood Group"}
                      </Text>
                      <Ionicons name="chevron-down" size={20} color="#64748b" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>{t('auth:email')} *</Text>
                  <View style={styles.verifyRow}>
                    <TextInput
                      style={[styles.input, styles.verifyInput]}
                      value={editFormData.email}
                      onChangeText={(text) => handleEditFormChange("email", text)}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                    {isEmailDirty() && !emailChange.verified && (
                      <TouchableOpacity
                        style={[
                          styles.verifyBtn,
                          emailChange.sending && styles.verifyBtnDisabled,
                        ]}
                        onPress={() => sendChangeOtp("email")}
                        disabled={emailChange.sending}
                      >
                        <Text style={styles.verifyBtnText}>
                          {emailChange.sending
                            ? t('profile:sendingOtp')
                            : emailChange.sent
                            ? t('profile:resend')
                            : t('profile:verify')}
                        </Text>
                      </TouchableOpacity>
                    )}
                    {emailChange.verified && (
                      <View style={styles.verifiedBadge}>
                        <Ionicons name="checkmark-circle" size={18} color={PATIENT.primary} />
                        <Text style={styles.verifiedText}>{t('Verified')}</Text>
                      </View>
                    )}
                  </View>
                  {emailChange.sent && !emailChange.verified && (
                    <View style={styles.otpRow}>
                      <TextInput
                        style={[styles.input, styles.otpInput]}
                        value={emailChange.otp}
                        onChangeText={(t) =>
                          setEmailChange((s) => ({
                            ...s,
                            otp: t.replace(/\D/g, "").slice(0, 6),
                          }))
                        }
                        keyboardType="number-pad"
                        maxLength={6}
                        placeholder={t('6-digit OTP')}
                        placeholderTextColor="#94a3b8"
                      />
                      <TouchableOpacity
                        style={[
                          styles.verifyBtn,
                          styles.confirmBtn,
                          emailChange.verifying && styles.verifyBtnDisabled,
                        ]}
                        onPress={() => verifyChangeOtp("email")}
                        disabled={emailChange.verifying}
                      >
                        <Text style={styles.verifyBtnText}>
                          {emailChange.verifying ? t('profile:verifying') : t('common:confirm')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                  {!!emailChange.error && (
                    <Text style={styles.fieldErrorText}>{emailChange.error}</Text>
                  )}
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>{t('auth:phone')} *</Text>
                  <CountryPhoneInput
                    value={editFormData.phone}
                    countryCode={editFormData.phoneCountryCode}
                    onChangePhoneNumber={(text) => handleEditFormChange("phone", text)}
                    onChangeCountryCode={(code) => handleEditFormChange("phoneCountryCode", code)}
                    placeholder="Phone number"
                    accentColor={PATIENT.primary}
                    containerStyle={styles.phoneInputWrapper}
                  />
                </View>
              </View>

              {/* Address */}
              <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>{t('profile:address')}</Text>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>{t('profile:addressLine1')}</Text>
                  <TextInput
                    style={styles.input}
                    value={editFormData.address.line1}
                    onChangeText={(text) => handleEditFormChange("address.line1", text)}
                  />
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>{t('profile:addressLine2')}</Text>
                  <TextInput
                    style={styles.input}
                    value={editFormData.address.line2}
                    onChangeText={(text) => handleEditFormChange("address.line2", text)}
                  />
                </View>
                <View style={styles.formRow}>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>{t('profile:city')}</Text>
                    <TextInput
                      style={styles.input}
                      value={editFormData.address.city}
                      onChangeText={(text) => handleEditFormChange("address.city", text)}
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>{t('profile:state')}</Text>
                    <TextInput
                      style={styles.input}
                      value={editFormData.address.state}
                      onChangeText={(text) => handleEditFormChange("address.state", text)}
                    />
                  </View>
                </View>
                <View style={styles.formRow}>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>{t('profile:pincode')}</Text>
                    <TextInput
                      style={styles.input}
                      value={editFormData.address.pincode}
                      onChangeText={(text) => handleEditFormChange("address.pincode", text)}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>{t('profile:country')}</Text>
                    <TextInput
                      style={styles.input}
                      value={editFormData.address.country}
                      onChangeText={(text) => handleEditFormChange("address.country", text)}
                    />
                  </View>
                </View>
              </View>

              {/* Emergency Contact */}
              <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>{t('profile:emergencyContact')}</Text>
                <View style={styles.formRow}>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>{t('auth:name')} *</Text>
                    <TextInput
                      style={styles.input}
                      value={editFormData.emergencyContact.name}
                      onChangeText={(text) => handleEditFormChange("emergencyContact.name", text)}
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>{t('profile:relation')} *</Text>
                    <TextInput
                      style={styles.input}
                      value={editFormData.emergencyContact.relation}
                      onChangeText={(text) => handleEditFormChange("emergencyContact.relation", text)}
                    />
                  </View>
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>{t('auth:phone')} *</Text>
                  <CountryPhoneInput
                    value={editFormData.emergencyContact.phone}
                    countryCode={editFormData.emergencyContact.phoneCountryCode}
                    onChangePhoneNumber={(text) => handleEditFormChange("emergencyContact.phone", text)}
                    onChangeCountryCode={(code) => handleEditFormChange("emergencyContact.phoneCountryCode", code)}
                    placeholder="Phone number"
                    accentColor={PATIENT.primary}
                    containerStyle={styles.phoneInputWrapper}
                  />
                </View>
              </View>

            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.btnSecondary}
              onPress={handleCancelEdit}
              disabled={loading}
            >
              <Text style={styles.btnSecondaryText}>{t('common:cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btnPrimaryWrap}
              onPress={handleSaveProfile}
              disabled={loading}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={PATIENT_GRADIENT}
                {...GRADIENT_DIRECTION}
                style={styles.btnPrimary}
              >
                <Text style={styles.btnPrimaryText}>
                  {loading ? t('profile:saving') : t('profile:saveChanges')}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
        {renderNotification()}
      </View>
    </Modal>
  );

  if (loading && !patientData.personalInfo.id) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2A8A51" />
        <Text style={styles.loadingText}>{t('profile:loadingProfile')}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#F9F9FF" />
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={{ flex: 1 }}
      >
        {renderNotification()}
        {renderProfileHeader()}
        <View style={[styles.locationCard, { width: responsiveContentWidth }]}>
          <View style={styles.locationCardLeft}>
            <Ionicons name="location-outline" size={20} color="#00652C" />
            <Text style={styles.locationCardLabel}>{t('profile:shareLocation')}</Text>
          </View>
          <TouchableOpacity
            style={[
              styles.locationUpdateBtnWrap,
              isUpdatingLocation && styles.verifyBtnDisabled,
            ]}
            onPress={handleUpdateLocation}
            disabled={isUpdatingLocation}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={PATIENT_GRADIENT}
              {...GRADIENT_DIRECTION}
              style={styles.locationUpdateBtn}
            >
              <Text style={styles.locationUpdateBtnText}>
                {isUpdatingLocation ? t('profile:updating') : t('profile:update')}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
        <View style={[styles.content, { width: responsiveContentWidth }]}>
          {renderPersonalInfo()}
          {renderAddress()}
          {renderEmergencyContact()}
        </View>
      </ScrollView>
      {renderEditModal()}

      {/* Blood Group Dropdown Modal */}
      <Modal
        visible={showBloodGroupDropdown}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowBloodGroupDropdown(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowBloodGroupDropdown(false)}>
          <View style={styles.dropdownOverlay}>
            <View style={styles.dropdownContent}>
              <Text style={styles.dropdownTitle}>{t('Select Blood Group')}</Text>
              <ScrollView showsVerticalScrollIndicator={false} style={styles.dropdownList}>
                <TouchableOpacity
                  style={[
                    styles.dropdownItem,
                    !normalizeBloodGroup(editFormData.bloodGroup) && styles.dropdownItemSelected,
                  ]}
                  onPress={() => {
                    handleEditFormChange("bloodGroup", "");
                    setShowBloodGroupDropdown(false);
                  }}
                >
                  <Text
                    style={[
                      styles.dropdownItemText,
                      !normalizeBloodGroup(editFormData.bloodGroup) && styles.dropdownItemTextSelected,
                    ]}
                  >
                    {t('profile:notSpecified')}
                  </Text>
                  {!normalizeBloodGroup(editFormData.bloodGroup) && (
                    <Ionicons name="checkmark" size={20} color="#2c50cd" />
                  )}
                </TouchableOpacity>
                {bloodGroups.map((bg) => (
                  <TouchableOpacity
                    key={bg}
                    style={[
                      styles.dropdownItem,
                      normalizeBloodGroup(editFormData.bloodGroup) === bg && styles.dropdownItemSelected,
                    ]}
                    onPress={() => {
                      handleEditFormChange("bloodGroup", bg);
                      setShowBloodGroupDropdown(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.dropdownItemText,
                        normalizeBloodGroup(editFormData.bloodGroup) === bg && styles.dropdownItemTextSelected,
                      ]}
                    >
                      {bg}
                    </Text>
                    {normalizeBloodGroup(editFormData.bloodGroup) === bg && (
                      <Ionicons name="checkmark" size={20} color="#2c50cd" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <AvatarPicker
        visible={showAvatarBuilder}
        userId={patientData?.personalInfo?.id}
        userGender={patientData?.personalInfo?.gender}
        currentAvatarUrl={patientData?.personalInfo?.profilePhoto}
        onSelect={handleAvatarSelect}
        onClose={() => setShowAvatarBuilder(false)}
      />

      {/* Avatar action chooser */}
      <Modal
        visible={showAvatarChooser}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAvatarChooser(false)}
      >
        <TouchableOpacity
          style={styles.chooserOverlay}
          activeOpacity={1}
          onPress={() => setShowAvatarChooser(false)}
        >
          <View style={[styles.chooserSheet, { paddingBottom: Math.max(insets.bottom, 28) }]}>
            <View style={styles.chooserHandle} />
            <Text style={styles.chooserTitle}>{t('profile:createAvatar', 'Change Avatar')}</Text>

            <TouchableOpacity
              style={styles.chooserOption}
              onPress={() => { setShowAvatarChooser(false); setShowAvatarBuilder(true); }}
              activeOpacity={0.8}
            >
              <View style={[styles.chooserIcon, { backgroundColor: '#E6F6EC' }]}>
                <Ionicons name="happy-outline" size={22} color="#00652C" />
              </View>
              <View style={styles.chooserTextWrap}>
                <Text style={styles.chooserOptionTitle}>{t('profile:createAvatar', 'Create Avatar')}</Text>
                <Text style={styles.chooserOptionSub}>{t('profile:createAvatarSub', 'Build a custom cartoon avatar')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.chooserCancel}
              onPress={() => setShowAvatarChooser(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.chooserCancelText}>{t('common:cancel', 'Cancel')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  verifyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  verifyInput: {
    flex: 1,
  },
  verifyBtn: {
    backgroundColor: "#00652C",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  verifyBtnDisabled: {
    opacity: 0.6,
  },
  confirmBtn: {
    backgroundColor: PATIENT.primary,
  },
  verifyBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  verifiedText: {
    marginLeft: 4,
    color: PATIENT.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  otpRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  otpInput: {
    flex: 1,
    letterSpacing: 4,
    textAlign: "center",
  },
  fieldErrorText: {
    color: "#dc2626",
    fontSize: 12,
    marginTop: 4,
    fontWeight: "600",
  },
  locationCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#E6F6EC",
    borderColor: "#CDEBD8",
    borderWidth: 1,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    alignSelf: "center",
  },
  locationCardLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  locationCardLabel: {
    color: "#00652C",
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 8,
  },
  locationUpdateBtnWrap: {
    borderRadius: 8,
    overflow: "hidden",
  },
  locationUpdateBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  locationUpdateBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  securityCard: {
    backgroundColor: "#ffffff",
    borderColor: "#CDEBD8",
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  securityHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  securityIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#E6F6EC",
    alignItems: "center",
    justifyContent: "center",
  },
  securityTextWrap: {
    flex: 1,
  },
  securityTitle: {
    color: "#0f172a",
    fontSize: 15,
    fontWeight: "800",
  },
  securitySubtitle: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
  securityActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  securityButtonSecondary: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#E6F6EC",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  securityButtonSecondaryText: {
    color: "#00652C",
    fontSize: 13,
    fontWeight: "800",
  },
  securityButtonPrimary: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: "#00652C",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  securityButtonPrimaryText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "800",
  },
  container: {
    flex: 1,
    backgroundColor: PATIENT.backgroundTint,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 100, // Increased padding to ensure full visibility
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8fafc",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#64748b",
  },
  notification: {
    position: "absolute",
    top: 40,
    left: 16,
    right: 16,
    padding: 14,
    borderRadius: 12,
    overflow: "hidden",
    zIndex: 1000,
    elevation: 10,
  },
  // Absolute fill so the gradient sits behind the text without re-parenting it.
  notificationFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 12,
  },
  notificationError: { backgroundColor: PATIENT.danger },
  notificationText: {
    color: "white",
    fontWeight: "700",
    fontSize: 14,
    textAlign: "center",
  },
  header: {
    backgroundColor: "white",
    marginBottom: 20,
  },
  profileHeroCard: {
    marginTop: 12,
    marginBottom: 16,
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderColor: PATIENT.border,
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 3,
    alignSelf: 'center',
  },
  avatarWrapper: {
    position: "relative",
    marginTop: 6,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarUploading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  chooserOverlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    justifyContent: "flex-end",
  },
  chooserSheet: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
  },
  chooserHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#e2e8f0",
    marginBottom: 16,
  },
  chooserTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 16,
  },
  chooserOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
  },
  chooserIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  chooserTextWrap: {
    flex: 1,
  },
  chooserOptionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0f172a",
  },
  chooserOptionSub: {
    fontSize: 12.5,
    color: "#94a3b8",
    marginTop: 2,
  },
  chooserCancel: {
    marginTop: 14,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
  },
  chooserCancelText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#64748b",
  },
  avatarPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarPlaceholderText: {
    fontSize: 32,
    fontWeight: "800",
    color: "white",
  },
  editBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: PATIENT.primary,
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: "white",
    justifyContent: "center",
    alignItems: "center",
  },
  heroKicker: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: PATIENT.textMuted,
    marginBottom: 14,
    textAlign: "center",
  },
  name: {
    fontSize: 20,
    fontWeight: "800",
    color: PATIENT.text,
    marginTop: 12,
    marginBottom: 3,
    textAlign: "center",
  },
  heroSubtext: {
    fontSize: 13,
    color: PATIENT.textSecondary,
    fontWeight: "400",
    marginBottom: 10,
    textAlign: "center",
  },
  idBadge: {
    backgroundColor: PATIENT.backgroundTint,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    alignSelf: "center",
    borderWidth: 1,
    borderColor: PATIENT.border,
  },
  patientId: {
    fontSize: 11,
    fontWeight: "700",
    color: PATIENT.textSecondary,
    letterSpacing: 0.4,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: PATIENT.backgroundTint,
    borderRadius: 16,
    padding: 14,
    marginTop: 18,
    width: "100%",
    borderWidth: 1,
    borderColor: PATIENT.border,
  },
  // Wrapper owns the radius/clip + outer spacing; the gradient fills it.
  editProfileBtnWrap: {
    borderRadius: 12,
    overflow: "hidden",
    marginTop: 16,
    width: "100%",
  },
  editProfileBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
  },
  editProfileBtnText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statLabel: {
    fontSize: 10.5,
    color: PATIENT.textMuted,
    fontWeight: "600",
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  statValue: {
    fontSize: 15,
    fontWeight: "700",
    color: PATIENT.text,
  },
  statValueGender: {
    fontSize: 15,
    fontWeight: "700",
    color: PATIENT.primary,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: PATIENT.border,
  },
  content: {
    gap: 16,
    alignSelf: 'center',
  },
  card: {
    backgroundColor: "white",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeader: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: PATIENT.text,
  },
  infoGrid: {
    gap: 16,
  },
  infoItem: {
    gap: 4,
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94a3b8",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#334155",
  },
  addressDisplay: {
    gap: 6,
  },
  addressText: {
    fontSize: 15,
    color: "#475569",
    lineHeight: 22,
  },
  emergencyDisplay: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
  },
  sosBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#FEE2E2",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#FCA5A5",
  },
  sosBadgeText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#EF4444",
    letterSpacing: 0.3,
  },
  emergencyDetails: {
    flex: 1,
  },
  emergencyName: {
    fontSize: 15,
    fontWeight: "700",
    color: PATIENT.text,
  },
  emergencyRelation: {
    fontSize: 12.5,
    color: PATIENT.textSecondary,
    fontWeight: "500",
    marginTop: 2,
  },
  emergencyPhone: {
    fontSize: 13,
    fontWeight: "600",
    color: PATIENT.textSecondary,
    marginTop: 3,
  },
  emergencyCallBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#E6F6EC",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#CDEBD8",
  },
  medicalGrid: {
    gap: 20,
  },
  vitalCard: {
    backgroundColor: "#f0fdf4",
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#dcfce7",
    gap: 12,
  },
  vitalRows: {
    flexDirection: "row",
    gap: 12,
  },
  vitalRow: {
    flex: 1,
    gap: 4,
  },
  vitalTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#14532d",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  vitalLabel: {
    fontSize: 12,
    color: "#166534",
    fontWeight: "700",
  },
  vitalValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#14532d",
  },
  conditionsList: {
    gap: 16,
  },
  conditionsTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 8,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    backgroundColor: "#E6F6EC",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#CDEBD8",
  },
  tagText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#00652C",
  },
  noData: {
    color: "#94a3b8",
    textAlign: "center",
    paddingVertical: 20,
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "white",
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 24,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1e293b",
  },
  closeModal: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  closeModalText: {
    fontSize: 24,
    color: "#64748b",
  },
  modalBody: {
    padding: 24,
  },
  modalFooter: {
    flexDirection: "row",
    gap: 12,
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    backgroundColor: "white",
  },
  formSection: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#00652C",
    marginBottom: 20,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  formRow: {
    width: "100%",
  },
  formGroup: {
    width: "100%",
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#475569",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: "#1e293b",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  readonly: {
    color: "#64748b",
    backgroundColor: "#f1f5f9",
  },
  datePickerButton: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  datePickerText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#1e293b",
  },
  datePickerPlaceholder: {
    color: "#94a3b8",
  },
  phoneInputWrapper: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  btnPrimaryWrap: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
  btnPrimary: {
    paddingVertical: 14,
    alignItems: "center",
  },
  btnPrimaryText: {
    color: "white",
    fontWeight: "700",
    fontSize: 16,
  },
  btnSecondary: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  btnSecondaryText: {
    color: "#475569",
    fontWeight: "700",
    fontSize: 16,
  },
  profilePictureEdit: {
    alignItems: "center",
    backgroundColor: "#f8fafc",
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  avatarPreview: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#00652C",
    marginBottom: 16,
  },
  avatarPreviewImage: {
    width: "100%",
    height: "100%",
    borderRadius: 50,
  },
  avatarPreviewPlaceholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarPreviewText: {
    fontSize: 36,
    fontWeight: "800",
    color: "white",
  },
  uploadActions: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  uploadBtn: {
    backgroundColor: "#E6F6EC",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  uploadBtnText: {
    color: "#00652C",
    fontWeight: "700",
  },
  generateAvatarBtnWrap: {
    borderRadius: 8,
    overflow: "hidden",
  },
  generateAvatarBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  generateAvatarBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  uploadHint: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 8,
    textAlign: "center",
  },
  removeBtn: {
    backgroundColor: "#fef2f2",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  removeBtnText: {
    color: "#ef4444",
    fontWeight: "700",
  },
  selectContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8,
  },
  selectOption: {
    minHeight: 44,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    alignItems: "center",
    justifyContent: "center",
  },
  // Wrapper clips the gradient and now owns the sizing (flex/minWidth moved off
  // the inner view, which no longer sits directly in the row).
  selectOptionWrap: {
    flex: 1,
    minWidth: "30%",
    borderRadius: 12,
    overflow: "hidden",
  },
  selectOptionActive: {
    backgroundColor: "transparent",
    borderColor: "#006B2C",
  },
  selectOptionText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748b",
  },
  selectOptionTextActive: {
    color: "white",
  },
  dropdownButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  dropdownButtonText: {
    fontSize: 15,
    color: "#1e293b",
    fontWeight: "500",
    flex: 1,
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  dropdownContent: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    maxHeight: "60%",
    width: "85%",
    paddingHorizontal: 0,
    overflow: "hidden",
  },
  dropdownTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#081625",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  dropdownList: {
    maxHeight: "100%",
  },
  dropdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  dropdownItemSelected: {
    backgroundColor: "#f0f4ff",
  },
  dropdownItemText: {
    fontSize: 15,
    color: "#475569",
    fontWeight: "500",
    flex: 1,
  },
  dropdownItemTextSelected: {
    color: "#2c50cd",
    fontWeight: "700",
  },
  scrollPicker: {
    marginVertical: 4,
  },
  pickerOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
    marginRight: 8,
  },
  pickerOptionActive: {
    backgroundColor: "#00652C",
  },
  pickerOptionText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
  },
  pickerOptionTextActive: {
    color: "white",
  },
});

export default PatientProfile;
