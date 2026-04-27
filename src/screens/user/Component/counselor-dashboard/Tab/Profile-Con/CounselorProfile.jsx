// CounselorProfile.jsx - Premium Professional UI
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform,
  Dimensions,
  KeyboardAvoidingView,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchImageLibrary } from 'react-native-image-picker';
import DocumentPicker from '@react-native-documents/picker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import safeVibrate from '../../../../../../utils/safeVibrate';

const { width, height } = Dimensions.get('window');

// Responsive helpers
const scale = (size) => (width / 375) * size;
const isSmall = width <= 768;
const isTablet = width > 768 && width <= 1024;

const API_BASE_URL = 'https://chatbot-backend-js25.onrender.com';

const CounselorProfile = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [activeTab, setActiveTab] = useState('professional');

  // State for counselor data
  const [counselor, setCounselor] = useState({
    _id: '',
    uniqueCode: '',
    fullName: '',
    specialization: [],
    experience: 0,
    education: '',
    email: '',
    phoneNumber: '',
    location: '',
    languages: [],
    profilePhoto: null,
    profilePhotoUrl: '',
    certifications: [],
    aboutMe: '',
    rating: 0,
    totalSessions: 0,
    activeClients: 0,
    qualification: '',
    consultationMode: [],
    isActive: true,
    profileCompleted: false,
    age: null,
    gender: '',
    dateOfBirth: null,
    bloodGroup: '',
    address: {
      line1: '',
      line2: '',
      city: '',
      state: '',
      pincode: '',
      country: 'India'
    },
    emergencyContact: {
      name: '',
      relation: '',
      phone: ''
    },
    medicalInfo: {
      height: '',
      weight: '',
      allergies: [],
      chronicConditions: [],
      currentMedications: []
    }
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState(counselor);
  const [newLanguage, setNewLanguage] = useState('');
  const [newSpecialization, setNewSpecialization] = useState('');
  const [newConsultationMode, setNewConsultationMode] = useState('');
  const [newCertification, setNewCertification] = useState({
    name: '',
    issueDate: '',
    expiryDate: '',
    issuedBy: '',
    document: null,
    documentName: ''
  });

  const AVATAR_SIZE = isSmall ? 110 : 130;

  useEffect(() => {
    fetchCounselorProfile();
  }, []);

  const fetchCounselorProfile = async () => {
    try {
      setLoading(true);
      setError('');

      const counsellorId = await AsyncStorage.getItem('counsellorId');
      const token = await AsyncStorage.getItem('token');

      if (!counsellorId) {
        setError('Counselor ID not found. Please login again.');
        setLoading(false);
        return;
      }

      const response = await axios.get(`${API_BASE_URL}/api/auth/counsellors/${counsellorId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success && response.data.counsellor) {
        const userData = response.data.counsellor;

        let profilePhotoUrl = '';
        if (userData.profilePhoto) {
          if (typeof userData.profilePhoto === 'string') {
            profilePhotoUrl = userData.profilePhoto;
          } else if (userData.profilePhoto.url) {
            profilePhotoUrl = userData.profilePhoto.url;
          }
        }

        const formattedData = {
          _id: userData._id,
          uniqueCode: userData.uniqueCode || `CNS-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
          fullName: userData.fullName || userData.name || '',
          specialization: Array.isArray(userData.specialization) ? userData.specialization : [],
          experience: userData.experience || 0,
          education: userData.education || '',
          email: userData.email || '',
          phoneNumber: userData.phoneNumber || userData.phone || '',
          location: userData.location || '',
          languages: Array.isArray(userData.languages) ? userData.languages : [],
          profilePhoto: null,
          profilePhotoUrl: profilePhotoUrl,
          certifications: Array.isArray(userData.certifications) ? userData.certifications : [],
          aboutMe: userData.aboutMe || userData.bio || '',
          rating: userData.rating || 0,
          totalSessions: userData.totalSessions || 0,
          activeClients: userData.activeClients || 0,
          qualification: userData.qualification || '',
          consultationMode: Array.isArray(userData.consultationMode) ? userData.consultationMode : [],
          isActive: userData.isActive || true,
          profileCompleted: userData.profileCompleted || false,
          age: userData.age || null,
          gender: userData.gender || '',
          dateOfBirth: userData.dateOfBirth || null,
          bloodGroup: userData.bloodGroup || '',
          address: userData.address || {
            line1: '', line2: '', city: '', state: '', pincode: '', country: 'India'
          },
          emergencyContact: userData.emergencyContact || { name: '', relation: '', phone: '' },
          medicalInfo: userData.medicalInfo || {
            height: '', weight: '', allergies: [], chronicConditions: [], currentMedications: []
          }
        };

        setCounselor(formattedData);
        setEditedData(formattedData);
      } else {
        setError(response.data.message || 'Failed to load profile data');
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
      setError('Failed to load profile data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const updateCounselorProfile = async (formData) => {
    try {
      const counsellorId = await AsyncStorage.getItem('counsellorId');
      const accessToken = await AsyncStorage.getItem('accessToken');
      const response = await axios.patch(`${API_BASE_URL}/api/auth/update/${counsellorId}`, formData, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      return response;
    } catch (error) {
      throw error;
    }
  };

  const handleInputChange = (field, value) => {
    setEditedData(prev => ({ ...prev, [field]: value }));
  };

  const handleTabPress = (tabKey) => {
    if (activeTab === tabKey) return;
    safeVibrate(80);
    setActiveTab(tabKey);
  };

  const handleNestedInputChange = (parentField, field, value) => {
    setEditedData(prev => ({
      ...prev,
      [parentField]: { ...prev[parentField], [field]: value }
    }));
  };

  const handleProfilePhotoUpload = async () => {
    const options = { mediaType: 'photo', includeBase64: false, quality: 0.8 };
    launchImageLibrary(options, (response) => {
      if (response.didCancel) return;
      if (response.errorCode) return;
      if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        setEditedData(prev => ({
          ...prev,
          profilePhoto: { uri: asset.uri, type: asset.type, name: asset.fileName },
          profilePhotoUrl: asset.uri
        }));
      }
    });
  };

  const handleAddLanguage = () => {
    if (newLanguage.trim() && !editedData.languages.includes(newLanguage.trim())) {
      setEditedData(prev => ({ ...prev, languages: [...prev.languages, newLanguage.trim()] }));
      setNewLanguage('');
    }
  };

  const handleRemoveLanguage = (lang) => {
    setEditedData(prev => ({ ...prev, languages: prev.languages.filter(l => l !== lang) }));
  };

  const handleAddSpecialization = () => {
    if (newSpecialization.trim() && !editedData.specialization.includes(newSpecialization.trim())) {
      setEditedData(prev => ({ ...prev, specialization: [...prev.specialization, newSpecialization.trim()] }));
      setNewSpecialization('');
    }
  };

  const handleRemoveSpecialization = (spec) => {
    setEditedData(prev => ({ ...prev, specialization: prev.specialization.filter(s => s !== spec) }));
  };

  const handleAddConsultationMode = () => {
    const modes = ['online', 'offline', 'both'];
    if (newConsultationMode && modes.includes(newConsultationMode) && !editedData.consultationMode.includes(newConsultationMode)) {
      setEditedData(prev => ({ ...prev, consultationMode: [...prev.consultationMode, newConsultationMode] }));
      setNewConsultationMode('');
    }
  };

  const handleRemoveConsultationMode = (mode) => {
    setEditedData(prev => ({ ...prev, consultationMode: prev.consultationMode.filter(m => m !== mode) }));
  };

  const handleDocumentUpload = async (certId) => {
    try {
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.pdf, DocumentPicker.types.images],
      });
      const file = Array.isArray(result) ? result[0] : result;
      const updatedCerts = editedData.certifications.map(cert => {
        if (cert._id === certId) {
          return {
            ...cert,
            document: { uri: file.uri, type: file.type, name: file.name },
            documentName: file.name,
            documentUrl: file.uri
          };
        }
        return cert;
      });
      setEditedData(prev => ({ ...prev, certifications: updatedCerts }));
    } catch (err) {
      if (err.code !== 'DOCUMENT_PICKER_CANCELED') console.error('Error picking document:', err);
    }
  };

  const handleAddCertification = () => {
    if (!newCertification.name.trim()) {
      Alert.alert('Error', 'Please enter certification name');
      return;
    }
    const newCert = {
      _id: `temp_${Date.now()}`,
      name: newCertification.name,
      document: newCertification.document,
      documentName: newCertification.documentName,
      documentUrl: newCertification.document ? newCertification.document.uri : '',
      issueDate: newCertification.issueDate,
      expiryDate: newCertification.expiryDate,
      issuedBy: newCertification.issuedBy
    };
    setEditedData(prev => ({ ...prev, certifications: [...prev.certifications, newCert] }));
    setNewCertification({ name: '', issueDate: '', expiryDate: '', issuedBy: '', document: null, documentName: '' });
  };

  const handleRemoveCertification = (certId) => {
    setEditedData(prev => ({ ...prev, certifications: prev.certifications.filter(cert => cert._id !== certId) }));
  };

  const handleNewDocumentUpload = async () => {
    try {
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.pdf, DocumentPicker.types.images],
      });
      const file = Array.isArray(result) ? result[0] : result;
      setNewCertification(prev => ({
        ...prev,
        document: { uri: file.uri, type: file.type, name: file.name },
        documentName: file.name
      }));
    } catch (err) {
      if (err.code !== 'DOCUMENT_PICKER_CANCELED') console.error('Error picking document:', err);
    }
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccessMessage('');

      const formData = new FormData();
      formData.append('fullName', editedData.fullName);
      formData.append('email', editedData.email);
      formData.append('phoneNumber', editedData.phoneNumber);
      formData.append('qualification', editedData.qualification || editedData.education);
      formData.append('experience', editedData.experience.toString());
      formData.append('location', editedData.location);
      formData.append('aboutMe', editedData.aboutMe);
      formData.append('education', editedData.education);

      if (editedData.age) formData.append('age', editedData.age.toString());
      if (editedData.gender) formData.append('gender', editedData.gender);
      if (editedData.bloodGroup) formData.append('bloodGroup', editedData.bloodGroup);

      if (editedData.address) {
        formData.append('address[line1]', editedData.address.line1 || '');
        formData.append('address[line2]', editedData.address.line2 || '');
        formData.append('address[city]', editedData.address.city || '');
        formData.append('address[state]', editedData.address.state || '');
        formData.append('address[pincode]', editedData.address.pincode || '');
        formData.append('address[country]', editedData.address.country || 'India');
      }

      if (editedData.languages && editedData.languages.length > 0) {
        editedData.languages.forEach((lang, index) => formData.append(`languages[${index}]`, lang));
      }
      if (editedData.specialization && editedData.specialization.length > 0) {
        editedData.specialization.forEach((spec, index) => formData.append(`specialization[${index}]`, spec));
      }
      if (editedData.consultationMode && editedData.consultationMode.length > 0) {
        editedData.consultationMode.forEach((mode, index) => formData.append(`consultationMode[${index}]`, mode));
      }

      if (editedData.profilePhoto && editedData.profilePhoto.uri) {
        formData.append('profilePhoto', {
          uri: editedData.profilePhoto.uri,
          type: editedData.profilePhoto.type,
          name: editedData.profilePhoto.name
        });
      }

      const response = await updateCounselorProfile(formData);
      if (response.data.success) {
        setSuccessMessage('Profile updated successfully!');
        await fetchCounselorProfile();
        setIsEditing(false);
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setError(response.data.message || 'Failed to update profile');
      }
    } catch (err) {
      console.error('Error updating profile:', err);
      setError(err.response?.data?.message || 'Failed to update profile');
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditedData(counselor);
    setNewLanguage('');
    setNewSpecialization('');
    setNewConsultationMode('');
    setNewCertification({ name: '', issueDate: '', expiryDate: '', issuedBy: '', document: null, documentName: '' });
    setIsEditing(false);
    setError('');
    setSuccessMessage('');
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not specified';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  };

  // Star Rating Component
  const StarRating = ({ rating, size = 14 }) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Icon
          key={i}
          name={i <= Math.round(rating) ? 'star' : 'star-border'}
          size={size}
          color={i <= Math.round(rating) ? '#FFB800' : '#E2E8F0'}
        />
      );
    }
    return <View style={styles.starRating}>{stars}</View>;
  };

  if (loading && !counselor._id) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#4F46E5" />
        <Text style={styles.loadingText}>Loading your profile...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        
        {/* Notification Banner */}
        {(successMessage || error) && (
          <View style={[styles.banner, successMessage ? styles.successBanner : styles.errorBanner]}>
            <Icon name={successMessage ? 'check-circle' : 'error'} size={20} color="#fff" />
            <Text style={styles.bannerText}>{successMessage || error}</Text>
          </View>
        )}

        {/* Profile Header Card */}
        <View style={styles.profileHeaderCard}>
          <LinearGradient colors={['#4F46E5', '#7C3AED']} style={styles.headerGradient}>
            <View style={styles.headerTop}>
              <View style={styles.avatarSection}>
                <View style={[styles.avatarContainer, { width: AVATAR_SIZE, height: AVATAR_SIZE }]}>
                  {editedData?.profilePhotoUrl ? (
                    <Image
                      source={{ uri: editedData.profilePhotoUrl }}
                      style={[styles.avatarImage, { width: AVATAR_SIZE, height: AVATAR_SIZE }]}
                    />
                  ) : (
                    <View style={[styles.avatarPlaceholder, { width: AVATAR_SIZE, height: AVATAR_SIZE }]}>
                      <Text style={[styles.avatarLetter, { fontSize: AVATAR_SIZE * 0.38 }]}>
                        {counselor?.fullName?.charAt(0)?.toUpperCase() || 'C'}
                      </Text>
                    </View>
                  )}
                  {isEditing && (
                    <TouchableOpacity onPress={handleProfilePhotoUpload} style={styles.editPhotoBtn}>
                      <Icon name="camera-alt" size={18} color="#fff" />
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.statusBadge}>
                  <View style={[styles.statusDot, counselor.isActive ? styles.activeDot : styles.inactiveDot]} />
                  <Text style={styles.statusText}>{counselor.isActive ? 'Active' : 'Inactive'}</Text>
                </View>
              </View>

              <View style={styles.headerInfo}>
                {isEditing ? (
                  <TextInput
                    style={styles.nameInput}
                    value={editedData.fullName || ''}
                    onChangeText={(value) => handleInputChange('fullName', value)}
                    placeholder="Your Full Name"
                    placeholderTextColor="rgba(255,255,255,0.6)"
                  />
                ) : (
                  <Text style={styles.counselorName}>{counselor.fullName || 'Your Name'}</Text>
                )}
                <Text style={styles.counselorCode}>{counselor.uniqueCode}</Text>
                
                <View style={styles.specializationRow}>
                  {counselor.specialization.slice(0, 3).map((spec, i) => (
                    <View key={i} style={styles.specBadge}>
                      <Text style={styles.specBadgeText}>{spec}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{counselor.rating?.toFixed(1) || '0.0'}</Text>
                <StarRating rating={counselor.rating || 0} size={12} />
                <Text style={styles.statLabel}>Rating</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{counselor.totalSessions || 0}</Text>
                <Icon name="video-call" size={14} color="rgba(255,255,255,0.7)" />
                <Text style={styles.statLabel}>Sessions</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{counselor.activeClients || 0}</Text>
                <Icon name="people" size={14} color="rgba(255,255,255,0.7)" />
                <Text style={styles.statLabel}>Clients</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{counselor.experience || 0}+</Text>
                <Icon name="work" size={14} color="rgba(255,255,255,0.7)" />
                <Text style={styles.statLabel}>Years</Text>
              </View>
            </View>

            {/* Edit Button */}
            <View style={styles.headerActions}>
              {!isEditing ? (
                <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.editProfileBtn}>
                  <Icon name="edit" size={18} color="#4F46E5" />
                  <Text style={styles.editProfileBtnText}>Edit Profile</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.editActions}>
                  <TouchableOpacity onPress={handleSave} style={styles.saveBtn} disabled={loading}>
                    <Text style={styles.saveBtnText}>{loading ? 'Saving...' : 'Save Changes'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleCancel} style={styles.cancelBtn}>
                    <Text style={styles.cancelBtnText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </LinearGradient>
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabBar}>
          {[
            { key: 'professional', icon: 'business-center', label: 'Professional' },
            { key: 'personal', icon: 'person', label: 'Personal' },
            { key: 'contact', icon: 'contacts', label: 'Contact' },
          ].map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.activeTab]}
              onPress={() => handleTabPress(tab.key)}
            >
              <Icon
                name={tab.icon}
                size={20}
                color={activeTab === tab.key ? '#4F46E5' : '#94A3B8'}
              />
              <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        {activeTab === 'professional' && (
          <View style={styles.tabContent}>
            {/* Bio */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Icon name="description" size={20} color="#4F46E5" />
                <Text style={styles.sectionTitle}>Professional Bio</Text>
              </View>
              {isEditing ? (
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={editedData.aboutMe || ''}
                  onChangeText={(value) => handleInputChange('aboutMe', value)}
                  placeholder="Describe your professional background and approach..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={5}
                />
              ) : (
                <Text style={styles.bodyText}>{counselor.aboutMe || 'No bio added yet.'}</Text>
              )}
            </View>

            {/* Specializations */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Icon name="psychology" size={20} color="#4F46E5" />
                <Text style={styles.sectionTitle}>Specializations</Text>
              </View>
              <View style={styles.chipContainer}>
                {(isEditing ? editedData.specialization : counselor.specialization).map((spec, i) => (
                  <View key={i} style={styles.chip}>
                    <Text style={styles.chipText}>{spec}</Text>
                    {isEditing && (
                      <TouchableOpacity onPress={() => handleRemoveSpecialization(spec)}>
                        <Icon name="close" size={14} color="#4F46E5" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
              {isEditing && (
                <View style={styles.addRow}>
                  <TextInput
                    style={[styles.textInput, { flex: 1 }]}
                    value={newSpecialization}
                    onChangeText={setNewSpecialization}
                    placeholder="Add specialization..."
                    placeholderTextColor="#94A3B8"
                    onSubmitEditing={handleAddSpecialization}
                  />
                  <TouchableOpacity onPress={handleAddSpecialization} style={styles.addBtn}>
                    <Icon name="add" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Education & Experience */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Icon name="school" size={20} color="#4F46E5" />
                <Text style={styles.sectionTitle}>Education & Experience</Text>
              </View>
              <View style={styles.infoRow}>
                <Icon name="book" size={16} color="#64748B" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Education</Text>
                  {isEditing ? (
                    <TextInput
                      style={styles.textInput}
                      value={editedData.education || ''}
                      onChangeText={(value) => handleInputChange('education', value)}
                      placeholder="Your educational qualifications"
                      placeholderTextColor="#94A3B8"
                    />
                  ) : (
                    <Text style={styles.infoValue}>{counselor.education || 'Not specified'}</Text>
                  )}
                </View>
              </View>
              <View style={styles.infoRow}>
                <Icon name="work-history" size={16} color="#64748B" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Experience</Text>
                  {isEditing ? (
                    <TextInput
                      style={styles.textInput}
                      value={editedData.experience?.toString() || ''}
                      onChangeText={(value) => handleInputChange('experience', parseInt(value) || 0)}
                      placeholder="Years of experience"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                    />
                  ) : (
                    <Text style={styles.infoValue}>{counselor.experience} years</Text>
                  )}
                </View>
              </View>
            </View>

            {/* Consultation Mode */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Icon name="videocam" size={20} color="#4F46E5" />
                <Text style={styles.sectionTitle}>Consultation Mode</Text>
              </View>
              <View style={styles.chipContainer}>
                {(isEditing ? editedData.consultationMode : counselor.consultationMode).map((mode, i) => (
                  <View key={i} style={[styles.chip, styles.modeChip]}>
                    <Icon
                      name={mode === 'online' ? 'wifi' : mode === 'offline' ? 'location-on' : 'settings'}
                      size={14}
                      color="#059669"
                    />
                    <Text style={styles.modeChipText}>{mode.charAt(0).toUpperCase() + mode.slice(1)}</Text>
                    {isEditing && (
                      <TouchableOpacity onPress={() => handleRemoveConsultationMode(mode)}>
                        <Icon name="close" size={14} color="#059669" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
              {isEditing && (
                <View style={styles.modeSelector}>
                  {['online', 'offline', 'both'].map(mode => (
                    <TouchableOpacity
                      key={mode}
                      onPress={() => setNewConsultationMode(mode)}
                      style={[styles.modeOption, newConsultationMode === mode && styles.modeOptionActive]}
                    >
                      <Text style={[styles.modeOptionText, newConsultationMode === mode && styles.modeOptionTextActive]}>
                        {mode.charAt(0).toUpperCase() + mode.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity onPress={handleAddConsultationMode} style={styles.addBtn}>
                    <Icon name="add" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Languages */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Icon name="language" size={20} color="#4F46E5" />
                <Text style={styles.sectionTitle}>Languages</Text>
              </View>
              <View style={styles.chipContainer}>
                {(isEditing ? editedData.languages : counselor.languages).map((lang, i) => (
                  <View key={i} style={[styles.chip, styles.langChip]}>
                    <Text style={styles.langChipText}>{lang}</Text>
                    {isEditing && (
                      <TouchableOpacity onPress={() => handleRemoveLanguage(lang)}>
                        <Icon name="close" size={14} color="#7C3AED" />
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
              {isEditing && (
                <View style={styles.addRow}>
                  <TextInput
                    style={[styles.textInput, { flex: 1 }]}
                    value={newLanguage}
                    onChangeText={setNewLanguage}
                    placeholder="Add language..."
                    placeholderTextColor="#94A3B8"
                    onSubmitEditing={handleAddLanguage}
                  />
                  <TouchableOpacity onPress={handleAddLanguage} style={styles.addBtn}>
                    <Icon name="add" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Certifications */}
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Icon name="verified" size={20} color="#4F46E5" />
                <Text style={styles.sectionTitle}>Certifications</Text>
              </View>
              {(isEditing ? editedData.certifications : counselor.certifications).map((cert, i) => (
                <View key={cert._id || i} style={styles.certCard}>
                  <View style={styles.certHeader}>
                    <Icon name="workspace-premium" size={18} color="#4F46E5" />
                    <Text style={styles.certName}>{cert.name}</Text>
                    {isEditing && (
                      <TouchableOpacity onPress={() => handleRemoveCertification(cert._id)}>
                        <Icon name="delete" size={18} color="#EF4444" />
                      </TouchableOpacity>
                    )}
                  </View>
                  <View style={styles.certDetails}>
                    <Text style={styles.certDetail}>Issued by: {cert.issuedBy || 'N/A'}</Text>
                    <Text style={styles.certDetail}>Issue: {cert.issueDate ? formatDate(cert.issueDate) : 'N/A'}</Text>
                    <Text style={styles.certDetail}>Expiry: {cert.expiryDate ? formatDate(cert.expiryDate) : 'N/A'}</Text>
                  </View>
                </View>
              ))}
              {isEditing && (
                <View style={styles.addCertForm}>
                  <TextInput
                    style={styles.textInput}
                    value={newCertification.name}
                    onChangeText={(value) => setNewCertification(prev => ({ ...prev, name: value }))}
                    placeholder="Certification name *"
                    placeholderTextColor="#94A3B8"
                  />
                  <TextInput
                    style={styles.textInput}
                    value={newCertification.issuedBy}
                    onChangeText={(value) => setNewCertification(prev => ({ ...prev, issuedBy: value }))}
                    placeholder="Issued by"
                    placeholderTextColor="#94A3B8"
                  />
                  <View style={styles.dateRow}>
                    <TextInput
                      style={[styles.textInput, { flex: 1 }]}
                      value={newCertification.issueDate}
                      onChangeText={(value) => setNewCertification(prev => ({ ...prev, issueDate: value }))}
                      placeholder="Issue date (YYYY-MM-DD)"
                      placeholderTextColor="#94A3B8"
                    />
                    <TextInput
                      style={[styles.textInput, { flex: 1 }]}
                      value={newCertification.expiryDate}
                      onChangeText={(value) => setNewCertification(prev => ({ ...prev, expiryDate: value }))}
                      placeholder="Expiry date (YYYY-MM-DD)"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                  <TouchableOpacity onPress={handleAddCertification} style={styles.addCertBtn}>
                    <Text style={styles.addCertBtnText}>Add Certification</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        )}

        {activeTab === 'personal' && (
          <View style={styles.tabContent}>
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Icon name="person" size={20} color="#4F46E5" />
                <Text style={styles.sectionTitle}>Personal Details</Text>
              </View>
              <View style={styles.infoRow}>
                <Icon name="cake" size={16} color="#64748B" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Age</Text>
                  {isEditing ? (
                    <TextInput
                      style={styles.textInput}
                      value={editedData.age?.toString() || ''}
                      onChangeText={(value) => handleInputChange('age', parseInt(value) || 0)}
                      placeholder="Your age"
                      keyboardType="numeric"
                    />
                  ) : (
                    <Text style={styles.infoValue}>{counselor.age || 'Not specified'}</Text>
                  )}
                </View>
              </View>
              <View style={styles.infoRow}>
                <Icon name="wc" size={16} color="#64748B" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Gender</Text>
                  {isEditing ? (
                    <View style={styles.genderSelector}>
                      {['male', 'female', 'other'].map(g => (
                        <TouchableOpacity
                          key={g}
                          onPress={() => handleInputChange('gender', g)}
                          style={[styles.genderOption, editedData.gender === g && styles.genderOptionActive]}
                        >
                          <Text style={[styles.genderText, editedData.gender === g && styles.genderTextActive]}>
                            {g.charAt(0).toUpperCase() + g.slice(1)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.infoValue}>
                      {counselor.gender ? counselor.gender.charAt(0).toUpperCase() + counselor.gender.slice(1) : 'Not specified'}
                    </Text>
                  )}
                </View>
              </View>
              <View style={styles.infoRow}>
                <Icon name="bloodtype" size={16} color="#64748B" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Blood Group</Text>
                  {isEditing ? (
                    <TextInput
                      style={styles.textInput}
                      value={editedData.bloodGroup || ''}
                      onChangeText={(value) => handleInputChange('bloodGroup', value)}
                      placeholder="e.g., A+"
                    />
                  ) : (
                    <Text style={styles.infoValue}>{counselor.bloodGroup || 'Not specified'}</Text>
                  )}
                </View>
              </View>
            </View>

            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Icon name="location-on" size={20} color="#4F46E5" />
                <Text style={styles.sectionTitle}>Address</Text>
              </View>
              {isEditing ? (
                <View style={styles.addressForm}>
                  <TextInput
                    style={styles.textInput}
                    value={editedData.address?.line1 || ''}
                    onChangeText={(value) => handleNestedInputChange('address', 'line1', value)}
                    placeholder="Address Line 1"
                  />
                  <TextInput
                    style={styles.textInput}
                    value={editedData.address?.line2 || ''}
                    onChangeText={(value) => handleNestedInputChange('address', 'line2', value)}
                    placeholder="Address Line 2"
                  />
                  <View style={styles.dateRow}>
                    <TextInput style={[styles.textInput, { flex: 1 }]} value={editedData.address?.city || ''} onChangeText={(value) => handleNestedInputChange('address', 'city', value)} placeholder="City" />
                    <TextInput style={[styles.textInput, { flex: 1 }]} value={editedData.address?.state || ''} onChangeText={(value) => handleNestedInputChange('address', 'state', value)} placeholder="State" />
                  </View>
                  <View style={styles.dateRow}>
                    <TextInput style={[styles.textInput, { flex: 1 }]} value={editedData.address?.pincode || ''} onChangeText={(value) => handleNestedInputChange('address', 'pincode', value)} placeholder="Pincode" keyboardType="numeric" />
                    <TextInput style={[styles.textInput, { flex: 1 }]} value={editedData.address?.country || ''} onChangeText={(value) => handleNestedInputChange('address', 'country', value)} placeholder="Country" />
                  </View>
                </View>
              ) : (
                <View>
                  {counselor.address?.line1 ? (
                    <>
                      <Text style={styles.addressLine}>{counselor.address.line1}</Text>
                      {counselor.address.line2 && <Text style={styles.addressLine}>{counselor.address.line2}</Text>}
                      <Text style={styles.addressLine}>
                        {[counselor.address.city, counselor.address.state, counselor.address.pincode].filter(Boolean).join(', ')}
                      </Text>
                      <Text style={styles.addressLine}>{counselor.address.country}</Text>
                    </>
                  ) : (
                    <Text style={styles.bodyText}>No address provided</Text>
                  )}
                </View>
              )}
            </View>
          </View>
        )}

        {activeTab === 'contact' && (
          <View style={styles.tabContent}>
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <Icon name="contact-phone" size={20} color="#4F46E5" />
                <Text style={styles.sectionTitle}>Contact Information</Text>
              </View>
              <View style={styles.infoRow}>
                <Icon name="email" size={16} color="#64748B" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Email</Text>
                  {isEditing ? (
                    <TextInput style={styles.textInput} value={editedData.email || ''} onChangeText={(value) => handleInputChange('email', value)} placeholder="Your email" keyboardType="email-address" />
                  ) : (
                    <Text style={styles.infoValue}>{counselor.email || 'Not specified'}</Text>
                  )}
                </View>
              </View>
              <View style={styles.infoRow}>
                <Icon name="phone" size={16} color="#64748B" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Phone</Text>
                  {isEditing ? (
                    <TextInput style={styles.textInput} value={editedData.phoneNumber || ''} onChangeText={(value) => handleInputChange('phoneNumber', value)} placeholder="Phone number" keyboardType="phone-pad" />
                  ) : (
                    <Text style={styles.infoValue}>{counselor.phoneNumber || 'Not specified'}</Text>
                  )}
                </View>
              </View>
              <View style={styles.infoRow}>
                <Icon name="location-on" size={16} color="#64748B" />
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Location</Text>
                  {isEditing ? (
                    <TextInput style={styles.textInput} value={editedData.location || ''} onChangeText={(value) => handleInputChange('location', value)} placeholder="Your location" />
                  ) : (
                    <Text style={styles.infoValue}>{counselor.location || 'Not specified'}</Text>
                  )}
                </View>
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  loadingScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#64748B',
  },

  // Banner
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 12,
  },
  successBanner: {
    backgroundColor: '#059669',
  },
  errorBanner: {
    backgroundColor: '#EF4444',
  },
  bannerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },

  // Profile Header
  profileHeaderCard: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 8,
  },
  headerGradient: {
    padding: 20,
  },
  headerTop: {
    flexDirection: isSmall ? 'column' : 'row',
    alignItems: isSmall ? 'center' : 'flex-start',
    gap: 20,
  },
  avatarSection: {
    alignItems: 'center',
  },
  avatarContainer: {
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
    position: 'relative',
  },
  avatarImage: {
    borderRadius: 999,
  },
  avatarPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 999,
  },
  avatarLetter: {
    color: '#fff',
    fontWeight: '700',
  },
  editPhotoBtn: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: '#4F46E5',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeDot: {
    backgroundColor: '#10B981',
  },
  inactiveDot: {
    backgroundColor: '#F59E0B',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  // Header Info
  headerInfo: {
    flex: 1,
    alignItems: isSmall ? 'center' : 'flex-start',
  },
  counselorName: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
  },
  nameInput: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.4)',
    paddingVertical: 4,
    marginBottom: 4,
  },
  counselorCode: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
  },
  specializationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  specBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  specBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
  },
  statLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },

  // Star Rating
  starRating: {
    flexDirection: 'row',
    gap: 2,
  },

  // Header Actions
  headerActions: {
    alignItems: 'center',
    marginTop: 16,
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  editProfileBtnText: {
    color: '#4F46E5',
    fontSize: 15,
    fontWeight: '700',
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
  },
  saveBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  cancelBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
  },
  cancelBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },

  // Tabs
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  activeTab: {
    backgroundColor: '#EEF2FF',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
  activeTabText: {
    color: '#4F46E5',
  },

  // Tab Content
  tabContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // Section Card
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },

  // Typography
  bodyText: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 22,
  },

  // Chips
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  chipText: {
    fontSize: 13,
    color: '#4F46E5',
    fontWeight: '500',
  },
  modeChip: {
    backgroundColor: '#ECFDF5',
  },
  modeChipText: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '500',
  },
  langChip: {
    backgroundColor: '#F5F3FF',
  },
  langChipText: {
    fontSize: 13,
    color: '#7C3AED',
    fontWeight: '500',
  },

  // Add Row
  addRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  addBtn: {
    backgroundColor: '#4F46E5',
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Info Row
  infoRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '500',
  },

  // Text Input
  textInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#F8FAFC',
    color: '#0F172A',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },

  // Mode Selector
  modeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  modeOption: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#fff',
  },
  modeOptionActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  modeOptionText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  modeOptionTextActive: {
    color: '#fff',
  },

  // Gender Selector
  genderSelector: {
    flexDirection: 'row',
    gap: 8,
  },
  genderOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  genderOptionActive: {
    backgroundColor: '#4F46E5',
    borderColor: '#4F46E5',
  },
  genderText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  genderTextActive: {
    color: '#fff',
  },

  // Address
  addressForm: {
    gap: 10,
  },
  addressLine: {
    fontSize: 14,
    color: '#475569',
    marginBottom: 2,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 10,
  },

  // Certifications
  certCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#4F46E5',
  },
  certHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  certName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0F172A',
    flex: 1,
  },
  certDetails: {
    marginTop: 8,
    gap: 3,
    paddingLeft: 26,
  },
  certDetail: {
    fontSize: 12,
    color: '#64748B',
  },
  addCertForm: {
    gap: 10,
    marginTop: 12,
    padding: 14,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#4F46E5',
  },
  addCertBtn: {
    backgroundColor: '#4F46E5',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  addCertBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default CounselorProfile;