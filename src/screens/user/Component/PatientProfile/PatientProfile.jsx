import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Dimensions
} from "react-native";
import * as ImagePicker from "react-native-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { API_BASE_URL } from "../../../../axiosConfig";

const { width, height } = Dimensions.get("window");

const PatientProfile = () => {
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [profileImage, setProfileImage] = useState(null);
  const [profileImageFile, setProfileImageFile] = useState(null);
  const [showNotification, setShowNotification] = useState({
    show: false,
    message: "",
    type: "",
  });

  const [patientData, setPatientData] = useState({
    personalInfo: {
      id: "",
      name: "",
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

  const insuranceProviders = [
    "Star Health Insurance",
    "ICICI Lombard",
    "HDFC ERGO",
    "Bajaj Allianz",
    "New India Assurance",
    "National Insurance",
    "Oriental Insurance",
    "United India Insurance",
    "Max Bupa Health Insurance",
    "Care Health Insurance",
  ];

  const insuranceTypes = [
    "Individual",
    "Family Floater",
    "Senior Citizen",
    "Critical Illness",
    "Group Health Insurance",
    "Maternity Insurance",
  ];

  const bloodGroups = ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
  const genders = ["Male", "Female", "Other"];

  const [editFormData, setEditFormData] = useState({
    name: "",
    age: "",
    gender: "",
    dateOfBirth: "",
    bloodGroup: "",
    email: "",
    phone: "",
    address: {
      line1: "",
      line2: "",
      city: "",
      state: "",
      pincode: "",
      country: "India",
    },
    emergencyContact: { name: "", relation: "", phone: "" },
    height: "",
    weight: "",
    allergies: "",
    chronicConditions: "",
    currentMedications: "",
    insuranceProvider: "",
    policyNumber: "",
    groupNumber: "",
    coverageAmount: "",
    validityDate: "",
    nominee: "",
    relationship: "",
    insuranceType: "",
  });

  useEffect(() => {
    fetchPatientProfile();
  }, []);

  const getProfilePhotoUrl = (userData) => {
    if (userData.profilePhoto) {
      if (
        typeof userData.profilePhoto === "object" &&
        userData.profilePhoto.url
      ) {
        return userData.profilePhoto.url;
      }
      if (typeof userData.profilePhoto === "string") {
        return userData.profilePhoto;
      }
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

        const formattedData = {
          personalInfo: {
            id: userData._id,
            name: userData.fullName || "",
            age: userData.age || null,
            gender: userData.gender || "",
            dateOfBirth: userData.dateOfBirth
              ? userData.dateOfBirth.split("T")[0]
              : "",
            bloodGroup: userData.bloodGroup || "",
            email: userData.email || "",
            phone: userData.phoneNumber || "",
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
    setEditFormData({
      name: data.personalInfo.name || "",
      age: data.personalInfo.age?.toString() || "",
      gender: data.personalInfo.gender || "",
      dateOfBirth: data.personalInfo.dateOfBirth || "",
      bloodGroup: data.personalInfo.bloodGroup || "",
      email: data.personalInfo.email || "",
      phone: data.personalInfo.phone || "",
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
        phone: data.personalInfo.emergencyContact?.phone || "",
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
      insuranceProvider: data.insuranceInfo.provider || "",
      policyNumber: data.insuranceInfo.policyNumber || "",
      groupNumber: data.insuranceInfo.groupNumber || "",
      coverageAmount: data.insuranceInfo.coverageAmount || "",
      validityDate: data.insuranceInfo.validityDate || "",
      nominee: data.insuranceInfo.nominee || "",
      relationship: data.insuranceInfo.relationship || "",
      insuranceType: data.insuranceInfo.insuranceType || "",
    });
  };

  const openEditModal = () => {
    initializeEditForm(patientData);
    setProfileImage(null);
    setProfileImageFile(null);
    setIsEditing(true);
  };

  const showNotificationMessage = (message, type) => {
    setShowNotification({ show: true, message, type });
    setTimeout(() => {
      setShowNotification({ show: false, message: "", type: "" });
    }, 3000);
  };

  const handleImageUpload = () => {
    ImagePicker.launchImageLibrary(
      {
        mediaType: "photo",
        includeBase64: false,
        maxHeight: 500,
        maxWidth: 500,
        quality: 0.8,
      },
      (response) => {
        if (response.assets && response.assets[0]) {
          const file = {
            uri: response.assets[0].uri,
            type: response.assets[0].type,
            name: response.assets[0].fileName || "profile.jpg",
          };

          if (file.uri) {
            if (response.assets[0].fileSize > 5 * 1024 * 1024) {
              showNotificationMessage("File size should be less than 5MB", "error");
              return;
            }
            setProfileImage(file.uri);
            setProfileImageFile(file);
          }
        }
      }
    );
  };

  const handleRemoveImage = () => {
    setProfileImage(null);
    setProfileImageFile(null);
    showNotificationMessage("Profile picture will be removed on save", "success");
  };

  const handleSaveProfile = async () => {
    try {
      setLoading(true);
      const formData = new FormData();

      formData.append("fullName", editFormData.name);
      formData.append("email", editFormData.email);
      formData.append("phoneNumber", editFormData.phone);
      formData.append("age", editFormData.age.toString());
      formData.append("gender", editFormData.gender);
      formData.append("bloodGroup", editFormData.bloodGroup);
      formData.append("dateOfBirth", editFormData.dateOfBirth);

      const addressObj = {
        ...editFormData.address,
        country: editFormData.address.country || "India",
      };
      formData.append("address", JSON.stringify(addressObj));
      formData.append(
        "emergencyContact",
        JSON.stringify(editFormData.emergencyContact)
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

      const insuranceObj = {
        provider: editFormData.insuranceProvider,
        policyNumber: editFormData.policyNumber,
        groupNumber: editFormData.groupNumber,
        coverageAmount: editFormData.coverageAmount,
        validityDate: editFormData.validityDate,
        nominee: editFormData.nominee,
        relationship: editFormData.relationship,
        insuranceType: editFormData.insuranceType,
      };
      formData.append("insuranceInfo", JSON.stringify(insuranceObj));

      if (profileImageFile) {
        formData.append("profilePhoto", profileImageFile);
      } else if (
        profileImage === null &&
        patientData.personalInfo.profilePhoto
      ) {
        formData.append("removeProfilePhoto", "true");
      }

      const response = await updatePatientProfile(formData);

      if (response.data.success) {
        showNotificationMessage("Profile updated successfully!", "success");
        await fetchPatientProfile();
        setIsEditing(false);
        setProfileImage(null);
        setProfileImageFile(null);
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
    setProfileImageFile(null);
  };

  const handleEditFormChange = (field, value) => {
    if (field.includes(".")) {
      const [parent, child] = field.split(".");
      setEditFormData((prev) => ({
        ...prev,
        [parent]: { ...prev[parent], [child]: value },
      }));
    } else {
      setEditFormData((prev) => ({ ...prev, [field]: value }));
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Not specified";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
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
      <View style={[styles.notification, styles[showNotification.type]]}>
        <Text style={styles.notificationText}>{showNotification.message}</Text>
      </View>
    );
  };

  const renderProfileHeader = () => (
    <View style={styles.header}>
      <View style={styles.avatarWrapper}>
        <View style={styles.avatar}>
          {patientData.personalInfo.profilePhoto ? (
            <Image
              source={{ uri: patientData.personalInfo.profilePhoto }}
              style={styles.avatarImage}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarPlaceholderText}>
                {getInitials(patientData.personalInfo.name)}
              </Text>
            </View>
          )}
        </View>
      </View>

      <View style={styles.profileInfo}>
        <Text style={styles.name}>{patientData.personalInfo.name}</Text>
        <Text style={styles.patientId}>
          Patient ID: {patientData.personalInfo.id}
        </Text>
        <View style={styles.badgeGroup}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {patientData.personalInfo.bloodGroup || "Blood Group"}
            </Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {patientData.personalInfo.age || "--"} years
            </Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {patientData.personalInfo.gender || "Gender"}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.headerActions}>
        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={openEditModal}
          disabled={loading}
        >
          <Text style={styles.btnPrimaryText}>✏️ Edit Profile</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderPersonalInfo = () => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Personal Information</Text>
      </View>
      <View style={styles.infoGrid}>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Full Name</Text>
          <Text style={styles.infoValue}>{patientData.personalInfo.name}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Date of Birth</Text>
          <Text style={styles.infoValue}>
            {formatDate(patientData.personalInfo.dateOfBirth)}
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Gender</Text>
          <Text style={styles.infoValue}>
            {patientData.personalInfo.gender || "Not specified"}
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Blood Group</Text>
          <Text style={styles.infoValue}>
            {patientData.personalInfo.bloodGroup || "Not specified"}
          </Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Email</Text>
          <Text style={styles.infoValue}>{patientData.personalInfo.email}</Text>
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>Phone</Text>
          <Text style={styles.infoValue}>{patientData.personalInfo.phone}</Text>
        </View>
      </View>
    </View>
  );

  const renderAddress = () => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Address</Text>
      </View>
      <View style={styles.addressDisplay}>
        <Text style={styles.addressText}>
          {patientData.personalInfo.address?.line1 || "No address provided"}
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
        <Text style={styles.cardTitle}>Emergency Contact</Text>
      </View>
      <View style={styles.emergencyDisplay}>
        <Text style={styles.emergencyIcon}>🆘</Text>
        <View style={styles.emergencyDetails}>
          <Text style={styles.emergencyName}>
            {patientData.personalInfo.emergencyContact?.name || "Not specified"}
          </Text>
          <Text style={styles.emergencyRelation}>
            {patientData.personalInfo.emergencyContact?.relation}
          </Text>
          <Text style={styles.emergencyPhone}>
            {patientData.personalInfo.emergencyContact?.phone}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderMedicalInfo = () => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Medical Information</Text>
      </View>
      <View style={styles.medicalGrid}>
        <View style={styles.vitalStats}>
          <Text style={styles.vitalTitle}>Vital Stats</Text>
          <View style={styles.vitalRow}>
            <Text style={styles.vitalLabel}>Height:</Text>
            <Text style={styles.vitalValue}>
              {patientData.medicalInfo?.height || "--"} cm
            </Text>
          </View>
          <View style={styles.vitalRow}>
            <Text style={styles.vitalLabel}>Weight:</Text>
            <Text style={styles.vitalValue}>
              {patientData.medicalInfo?.weight || "--"} kg
            </Text>
          </View>
        </View>
        <View style={styles.conditionsList}>
          {patientData.medicalInfo?.allergies?.length > 0 && (
            <View>
              <Text style={styles.conditionsTitle}>Allergies</Text>
              <View style={styles.tagsContainer}>
                {patientData.medicalInfo.allergies.map((a, i) => (
                  <View key={i} style={styles.tag}>
                    <Text style={styles.tagText}>{a}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          {patientData.medicalInfo?.chronicConditions?.length > 0 && (
            <View>
              <Text style={styles.conditionsTitle}>Chronic Conditions</Text>
              <View style={styles.tagsContainer}>
                {patientData.medicalInfo.chronicConditions.map((c, i) => (
                  <View key={i} style={styles.tag}>
                    <Text style={styles.tagText}>{c}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          {patientData.medicalInfo?.currentMedications?.length > 0 && (
            <View>
              <Text style={styles.conditionsTitle}>Current Medications</Text>
              <View style={styles.tagsContainer}>
                {patientData.medicalInfo.currentMedications.map((m, i) => (
                  <View key={i} style={styles.tag}>
                    <Text style={styles.tagText}>{m}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          {!patientData.medicalInfo?.allergies?.length &&
            !patientData.medicalInfo?.chronicConditions?.length &&
            !patientData.medicalInfo?.currentMedications?.length && (
              <Text style={styles.noData}>No medical information provided</Text>
            )}
        </View>
      </View>
    </View>
  );

  const renderInsuranceInfo = () => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Insurance Information</Text>
      </View>
      {patientData.insuranceInfo?.provider ? (
        <View style={styles.insuranceDisplay}>
          <View style={styles.insuranceHeader}>
            <Text style={styles.insuranceProvider}>
              {patientData.insuranceInfo.provider}
            </Text>
            <View style={styles.insuranceBadge}>
              <Text style={styles.insuranceBadgeText}>
                {patientData.insuranceInfo.insuranceType}
              </Text>
            </View>
          </View>
          <View style={styles.insuranceDetails}>
            <View>
              <Text style={styles.insuranceLabel}>Policy Number:</Text>
              <Text style={styles.insuranceValue}>
                {patientData.insuranceInfo.policyNumber}
              </Text>
            </View>
            <View>
              <Text style={styles.insuranceLabel}>Group Number:</Text>
              <Text style={styles.insuranceValue}>
                {patientData.insuranceInfo.groupNumber}
              </Text>
            </View>
            <View>
              <Text style={styles.insuranceLabel}>Coverage Amount:</Text>
              <Text style={styles.insuranceValue}>
                {patientData.insuranceInfo.coverageAmount}
              </Text>
            </View>
            <View>
              <Text style={styles.insuranceLabel}>Validity:</Text>
              <Text style={styles.insuranceValue}>
                {formatDate(patientData.insuranceInfo.validityDate)}
              </Text>
            </View>
            <View>
              <Text style={styles.insuranceLabel}>Nominee:</Text>
              <Text style={styles.insuranceValue}>
                {patientData.insuranceInfo.nominee} (
                {patientData.insuranceInfo.relationship})
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <Text style={styles.noData}>No insurance information added yet.</Text>
      )}
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
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <TouchableOpacity onPress={handleCancelEdit} style={styles.closeModal}>
              <Text style={styles.closeModalText}>×</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.modalBody}>
              {/* Profile Picture */}
              <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>Profile Picture</Text>
                <View style={styles.profilePictureEdit}>
                  <View style={styles.avatarPreview}>
                    {profileImage || patientData.personalInfo.profilePhoto ? (
                      <Image
                        source={{ uri: profileImage || patientData.personalInfo.profilePhoto }}
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
                    <TouchableOpacity style={styles.uploadBtn} onPress={handleImageUpload}>
                      <Text style={styles.uploadBtnText}>📷 Change Photo</Text>
                    </TouchableOpacity>
                    {(profileImage || patientData.personalInfo.profilePhoto) && (
                      <TouchableOpacity style={styles.removeBtn} onPress={handleRemoveImage}>
                        <Text style={styles.removeBtnText}>🗑️ Remove</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                  <Text style={styles.uploadHint}>JPG, PNG, GIF (max 5MB)</Text>
                </View>
              </View>

              {/* Personal Info */}
              <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>Personal Information</Text>
                <View style={styles.formRow}>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Full Name *</Text>
                    <TextInput
                      style={styles.input}
                      value={editFormData.name}
                      onChangeText={(text) => handleEditFormChange("name", text)}
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Patient ID</Text>
                    <TextInput
                      style={[styles.input, styles.readonly]}
                      value={patientData.personalInfo.id}
                      editable={false}
                    />
                  </View>
                </View>

                <View style={styles.formRow}>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Date of Birth *</Text>
                    <TextInput
                      style={styles.input}
                      value={editFormData.dateOfBirth}
                      onChangeText={(text) => handleEditFormChange("dateOfBirth", text)}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Age</Text>
                    <TextInput
                      style={styles.input}
                      value={editFormData.age}
                      onChangeText={(text) => handleEditFormChange("age", text)}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={styles.formRow}>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Gender *</Text>
                    <View style={styles.selectContainer}>
                      {genders.map((gender) => (
                        <TouchableOpacity
                          key={gender}
                          style={[
                            styles.selectOption,
                            editFormData.gender === gender.toLowerCase() && styles.selectOptionActive,
                          ]}
                          onPress={() => handleEditFormChange("gender", gender.toLowerCase())}
                        >
                          <Text
                            style={[
                              styles.selectOptionText,
                              editFormData.gender === gender.toLowerCase() && styles.selectOptionTextActive,
                            ]}
                          >
                            {gender}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Blood Group</Text>
                    <View style={styles.selectContainer}>
                      {bloodGroups.map((bg) => (
                        <TouchableOpacity
                          key={bg}
                          style={[
                            styles.selectOption,
                            editFormData.bloodGroup === bg && styles.selectOptionActive,
                          ]}
                          onPress={() => handleEditFormChange("bloodGroup", bg)}
                        >
                          <Text
                            style={[
                              styles.selectOptionText,
                              editFormData.bloodGroup === bg && styles.selectOptionTextActive,
                            ]}
                          >
                            {bg}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>

                <View style={styles.formRow}>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Email *</Text>
                    <TextInput
                      style={styles.input}
                      value={editFormData.email}
                      onChangeText={(text) => handleEditFormChange("email", text)}
                      keyboardType="email-address"
                      autoCapitalize="none"
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Phone *</Text>
                    <TextInput
                      style={styles.input}
                      value={editFormData.phone}
                      onChangeText={(text) => handleEditFormChange("phone", text)}
                      keyboardType="phone-pad"
                    />
                  </View>
                </View>
              </View>

              {/* Address */}
              <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>Address</Text>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Line 1</Text>
                  <TextInput
                    style={styles.input}
                    value={editFormData.address.line1}
                    onChangeText={(text) => handleEditFormChange("address.line1", text)}
                  />
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Line 2</Text>
                  <TextInput
                    style={styles.input}
                    value={editFormData.address.line2}
                    onChangeText={(text) => handleEditFormChange("address.line2", text)}
                  />
                </View>
                <View style={styles.formRow}>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>City</Text>
                    <TextInput
                      style={styles.input}
                      value={editFormData.address.city}
                      onChangeText={(text) => handleEditFormChange("address.city", text)}
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>State</Text>
                    <TextInput
                      style={styles.input}
                      value={editFormData.address.state}
                      onChangeText={(text) => handleEditFormChange("address.state", text)}
                    />
                  </View>
                </View>
                <View style={styles.formRow}>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Pincode</Text>
                    <TextInput
                      style={styles.input}
                      value={editFormData.address.pincode}
                      onChangeText={(text) => handleEditFormChange("address.pincode", text)}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Country</Text>
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
                <Text style={styles.sectionTitle}>Emergency Contact</Text>
                <View style={styles.formRow}>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Name</Text>
                    <TextInput
                      style={styles.input}
                      value={editFormData.emergencyContact.name}
                      onChangeText={(text) => handleEditFormChange("emergencyContact.name", text)}
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Relation</Text>
                    <TextInput
                      style={styles.input}
                      value={editFormData.emergencyContact.relation}
                      onChangeText={(text) => handleEditFormChange("emergencyContact.relation", text)}
                    />
                  </View>
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Phone</Text>
                  <TextInput
                    style={styles.input}
                    value={editFormData.emergencyContact.phone}
                    onChangeText={(text) => handleEditFormChange("emergencyContact.phone", text)}
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              {/* Medical */}
              <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>Medical Information</Text>
                <View style={styles.formRow}>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Height (cm)</Text>
                    <TextInput
                      style={styles.input}
                      value={editFormData.height}
                      onChangeText={(text) => handleEditFormChange("height", text)}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Weight (kg)</Text>
                    <TextInput
                      style={styles.input}
                      value={editFormData.weight}
                      onChangeText={(text) => handleEditFormChange("weight", text)}
                      keyboardType="numeric"
                    />
                  </View>
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Allergies (comma separated)</Text>
                  <TextInput
                    style={styles.input}
                    value={editFormData.allergies}
                    onChangeText={(text) => handleEditFormChange("allergies", text)}
                    placeholder="e.g., Penicillin, Dust"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Chronic Conditions</Text>
                  <TextInput
                    style={styles.input}
                    value={editFormData.chronicConditions}
                    onChangeText={(text) => handleEditFormChange("chronicConditions", text)}
                    placeholder="e.g., Diabetes, Hypertension"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
                <View style={styles.formGroup}>
                  <Text style={styles.formLabel}>Current Medications</Text>
                  <TextInput
                    style={styles.input}
                    value={editFormData.currentMedications}
                    onChangeText={(text) => handleEditFormChange("currentMedications", text)}
                    placeholder="e.g., Metformin 500mg"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </View>

              {/* Insurance */}
              <View style={styles.formSection}>
                <Text style={styles.sectionTitle}>Insurance Information</Text>
                <View style={styles.formRow}>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Provider</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollPicker}>
                      {insuranceProviders.map((p) => (
                        <TouchableOpacity
                          key={p}
                          style={[
                            styles.pickerOption,
                            editFormData.insuranceProvider === p && styles.pickerOptionActive,
                          ]}
                          onPress={() => handleEditFormChange("insuranceProvider", p)}
                        >
                          <Text
                            style={[
                              styles.pickerOptionText,
                              editFormData.insuranceProvider === p && styles.pickerOptionTextActive,
                            ]}
                          >
                            {p}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Insurance Type</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollPicker}>
                      {insuranceTypes.map((t) => (
                        <TouchableOpacity
                          key={t}
                          style={[
                            styles.pickerOption,
                            editFormData.insuranceType === t && styles.pickerOptionActive,
                          ]}
                          onPress={() => handleEditFormChange("insuranceType", t)}
                        >
                          <Text
                            style={[
                              styles.pickerOptionText,
                              editFormData.insuranceType === t && styles.pickerOptionTextActive,
                            ]}
                          >
                            {t}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>

                <View style={styles.formRow}>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Policy Number</Text>
                    <TextInput
                      style={styles.input}
                      value={editFormData.policyNumber}
                      onChangeText={(text) => handleEditFormChange("policyNumber", text)}
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Group Number</Text>
                    <TextInput
                      style={styles.input}
                      value={editFormData.groupNumber}
                      onChangeText={(text) => handleEditFormChange("groupNumber", text)}
                    />
                  </View>
                </View>

                <View style={styles.formRow}>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Coverage Amount</Text>
                    <TextInput
                      style={styles.input}
                      value={editFormData.coverageAmount}
                      onChangeText={(text) => handleEditFormChange("coverageAmount", text)}
                      placeholder="₹5,00,000"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Validity Date</Text>
                    <TextInput
                      style={styles.input}
                      value={editFormData.validityDate}
                      onChangeText={(text) => handleEditFormChange("validityDate", text)}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                </View>

                <View style={styles.formRow}>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Nominee</Text>
                    <TextInput
                      style={styles.input}
                      value={editFormData.nominee}
                      onChangeText={(text) => handleEditFormChange("nominee", text)}
                    />
                  </View>
                  <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>Relationship</Text>
                    <TextInput
                      style={styles.input}
                      value={editFormData.relationship}
                      onChangeText={(text) => handleEditFormChange("relationship", text)}
                    />
                  </View>
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
              <Text style={styles.btnSecondaryText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={handleSaveProfile}
              disabled={loading}
            >
              <Text style={styles.btnPrimaryText}>
                {loading ? "Saving..." : "Save Changes"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (loading && !patientData.personalInfo.id) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        {renderNotification()}
        {renderProfileHeader()}
        <View style={styles.content}>
          {renderPersonalInfo()}
          {renderAddress()}
          {renderEmergencyContact()}
          {renderMedicalInfo()}
          {renderInsuranceInfo()}
        </View>
        {renderEditModal()}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f7fb",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f7fb",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#64748b",
  },
  notification: {
    position: "absolute",
    top: 60,
    left: 16,
    right: 16,
    padding: 14,
    borderRadius: 12,
    zIndex: 1000,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  success: {
    backgroundColor: "#10b981",
  },
  error: {
    backgroundColor: "#ef4444",
  },
  notificationText: {
    color: "white",
    fontWeight: "600",
    fontSize: 14,
    textAlign: "center",
  },
  header: {
    backgroundColor: "white",
    borderRadius: 28,
    padding: 24,
    margin: 16,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarWrapper: {
    alignItems: "center",
    marginBottom: 16,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    overflow: "hidden",
    backgroundColor: "#667eea",
    shadowColor: "#667eea",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  avatarPlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#667eea",
  },
  avatarPlaceholderText: {
    fontSize: 48,
    fontWeight: "bold",
    color: "white",
  },
  profileInfo: {
    alignItems: "center",
  },
  name: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 4,
  },
  patientId: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 12,
  },
  badgeGroup: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  badge: {
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  badgeText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#475569",
  },
  headerActions: {
    marginTop: 16,
    alignItems: "center",
  },
  btnPrimary: {
    backgroundColor: "#667eea",
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 40,
    shadowColor: "#667eea",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  btnPrimaryText: {
    color: "white",
    fontWeight: "600",
    fontSize: 15,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    gap: 16,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: "#f1f5f9",
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#1e293b",
  },
  infoGrid: {
    gap: 16,
  },
  infoItem: {
    gap: 4,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
  },
  addressDisplay: {
    gap: 4,
  },
  addressText: {
    fontSize: 15,
    color: "#334155",
    lineHeight: 22,
  },
  emergencyDisplay: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
    backgroundColor: "#fef2e8",
    padding: 16,
    borderRadius: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#f97316",
  },
  emergencyIcon: {
    fontSize: 40,
  },
  emergencyDetails: {
    flex: 1,
  },
  emergencyName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 4,
  },
  emergencyRelation: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 4,
  },
  emergencyPhone: {
    fontSize: 16,
    fontWeight: "600",
    color: "#f97316",
  },
  medicalGrid: {
    gap: 16,
  },
  vitalStats: {
    backgroundColor: "#f8fafc",
    padding: 16,
    borderRadius: 20,
  },
  vitalTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 12,
  },
  vitalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  vitalLabel: {
    color: "#64748b",
  },
  vitalValue: {
    fontWeight: "600",
    color: "#1e293b",
  },
  conditionsList: {
    gap: 12,
  },
  conditionsTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 8,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  tag: {
    backgroundColor: "#eef2ff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 30,
  },
  tagText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#4f46e5",
  },
  noData: {
    color: "#94a3b8",
    textAlign: "center",
    paddingVertical: 16,
  },
  insuranceDisplay: {
    backgroundColor: "#f8fafc",
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  insuranceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  insuranceProvider: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1e293b",
  },
  insuranceBadge: {
    backgroundColor: "#dbeafe",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 30,
  },
  insuranceBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#4f46e5",
  },
  insuranceDetails: {
    gap: 12,
  },
  insuranceLabel: {
    fontSize: 12,
    color: "#64748b",
    marginBottom: 2,
  },
  insuranceValue: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e293b",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: "white",
    borderRadius: 32,
    width: width - 32,
    maxHeight: height - 40,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#eef2f6",
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "600",
    color: "#1e293b",
  },
  closeModal: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  closeModalText: {
    fontSize: 32,
    color: "#94a3b8",
  },
  modalBody: {
    padding: 20,
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#eef2f6",
  },
  formSection: {
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#eef2f6",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1e293b",
    marginBottom: 16,
  },
  formRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  formGroup: {
    flex: 1,
    gap: 6,
    marginBottom: 12,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  input: {
    borderWidth: 1.5,
    borderColor: "#e2e8f0",
    borderRadius: 14,
    padding: 12,
    fontSize: 14,
    backgroundColor: "white",
  },
  readonly: {
    backgroundColor: "#f8fafc",
    color: "#64748b",
  },
  selectContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  selectOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "white",
  },
  selectOptionActive: {
    backgroundColor: "#667eea",
    borderColor: "#667eea",
  },
  selectOptionText: {
    fontSize: 14,
    color: "#64748b",
  },
  selectOptionTextActive: {
    color: "white",
  },
  scrollPicker: {
    marginTop: 4,
    flexDirection: "row",
  },
  pickerOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    backgroundColor: "white",
    marginRight: 8,
  },
  pickerOptionActive: {
    backgroundColor: "#667eea",
    borderColor: "#667eea",
  },
  pickerOptionText: {
    fontSize: 14,
    color: "#64748b",
  },
  pickerOptionTextActive: {
    color: "white",
  },
  profilePictureEdit: {
    alignItems: "center",
    gap: 12,
    padding: 16,
    backgroundColor: "#f8fafc",
    borderRadius: 24,
  },
  avatarPreview: {
    width: 110,
    height: 110,
    borderRadius: 55,
    overflow: "hidden",
    backgroundColor: "#667eea",
  },
  avatarPreviewImage: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  avatarPreviewPlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarPreviewText: {
    fontSize: 42,
    fontWeight: "bold",
    color: "white",
  },
  uploadActions: {
    flexDirection: "row",
    gap: 12,
  },
  uploadBtn: {
    backgroundColor: "#667eea",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 40,
  },
  uploadBtnText: {
    color: "white",
    fontSize: 14,
    fontWeight: "500",
  },
  removeBtn: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 40,
  },
  removeBtnText: {
    color: "white",
    fontSize: 14,
    fontWeight: "500",
  },
  uploadHint: {
    fontSize: 12,
    color: "#94a3b8",
  },
  btnSecondary: {
    backgroundColor: "white",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: "#667eea",
  },
  btnSecondaryText: {
    color: "#667eea",
    fontWeight: "600",
    fontSize: 15,
  },
});

export default PatientProfile;