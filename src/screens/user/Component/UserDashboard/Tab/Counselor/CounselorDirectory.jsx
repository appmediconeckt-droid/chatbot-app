// CounselorProfile.jsx - Fixed Tab Spacing
import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchImageLibrary } from 'react-native-image-picker';
import DocumentPicker from '@react-native-documents/picker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import safeVibrate from '../../../../../../utils/safeVibrate';

const { width } = Dimensions.get('window');

// Responsive helpers
const isSmall = width < 420;
const isCompact = width < 560;
const isTablet = width >= 768 && width <= 1100;

const API_BASE_URL = 'https://chatbot-backend-js25.onrender.com';

const CounselorProfile = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [activeTab, setActiveTab] = useState('professional');

  // Tab animation
  const tabIndicatorAnim = useRef(new Animated.Value(0)).current;

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

  const AVATAR_SIZE = isSmall ? 100 : isTablet ? 110 : 130;

  // Animate tab indicator
  useEffect(() => {
    const tabIndex = activeTab === 'professional' ? 0 : activeTab === 'personal' ? 1 : 2;
    Animated.spring(tabIndicatorAnim, {
      toValue: tabIndex,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [activeTab, tabIndicatorAnim]);

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

  const StarRating = ({ rating, size = 12 }) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Icon
          key={i}
          name={i <= Math.round(rating) ? 'star' : 'star-border'}
          size={size}
          color={i <= Math.round(rating) ? '#FFB800' : 'rgba(255,255,255,0.3)'}
        />
      );
    }
    return <View style={styles.starRow}>{stars}</View>;
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
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
        bounces={true}
      >
        <View style={styles.pageShell}>
        
        {/* Notification Banner */}
        {(successMessage || error) && (
          <Animated.View style={[styles.banner, successMessage ? styles.successBanner : styles.errorBanner]}>
            <Icon name={successMessage ? 'check-circle' : 'error'} size={18} color="#fff" />
            <Text style={styles.bannerText}>{successMessage || error}</Text>
          </Animated.View>
        )}

        {/* Profile Header Card */}
        <View style={styles.profileHeaderCard}>
          <LinearGradient 
            colors={['#4F46E5', '#7C3AED']} 
            start={{x: 0, y: 0}} 
            end={{x: 1, y: 1}} 
            style={styles.headerGradient}
          >
            
            {/* Top Section - Avatar + Info */}
            <View style={styles.headerTopSection}>
              {/* Avatar */}
              <View style={styles.avatarColumn}>
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
                      <Icon name="camera-alt" size={16} color="#fff" />
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.statusBadge}>
                  <View style={[styles.statusDot, counselor.isActive ? styles.activeDot : styles.inactiveDot]} />
                  <Text style={styles.statusText}>{counselor.isActive ? 'Active' : 'Away'}</Text>
                </View>
              </View>

              {/* Info */}
              <View style={styles.infoColumn}>
                {isEditing ? (
                  <TextInput
                    style={styles.nameInput}
                    value={editedData.fullName || ''}
                    onChangeText={(value) => handleInputChange('fullName', value)}
                    placeholder="Your Full Name"
                    placeholderTextColor="rgba(255,255,255,0.5)"
                  />
                ) : (
                  <>
                    <Text style={styles.counselorName}>{counselor.fullName || 'Your Name'}</Text>
                    <View style={styles.codeRow}>
                      <Icon name="badge" size={14} color="rgba(255,255,255,0.7)" />
                      <Text style={styles.counselorCode}>{counselor.uniqueCode}</Text>
                    </View>
                  </>
                )}
                
                <View style={styles.specializationRow}>
                  {counselor.specialization.slice(0, 4).map((spec, i) => (
                    <View key={i} style={styles.specBadge}>
                      <Text style={styles.specBadgeText}>{spec}</Text>
                    </View>
                  ))}
                  {counselor.specialization.length > 4 && (
                    <View style={styles.specBadge}>
                      <Text style={styles.specBadgeText}>+{counselor.specialization.length - 4}</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Edit Button */}
              <View style={styles.editButtonColumn}>
                {!isEditing ? (
                  <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.editProfileBtn}>
                    <Icon name="edit" size={18} color="#4F46E5" />
                    {!isSmall && <Text style={styles.editProfileBtnText}>Edit Profile</Text>}
                  </TouchableOpacity>
                ) : (
                  <View style={styles.editActionsColumn}>
                    <TouchableOpacity onPress={handleSave} style={styles.saveBtnDesktop} disabled={loading}>
                      <Icon name="check" size={18} color="#fff" />
                      {!isSmall && <Text style={styles.saveBtnTextSmall}>Save</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleCancel} style={styles.cancelBtnDesktop}>
                      <Icon name="close" size={18} color="#fff" />
                      {!isSmall && <Text style={styles.cancelBtnTextSmall}>Cancel</Text>}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <StarRating rating={counselor.rating || 0} size={11} />
                <Text style={styles.statValue}>{counselor.rating?.toFixed(1) || '0.0'}</Text>
                <Text style={styles.statLabel}>Rating</Text>
              </View>
              <View style={styles.statVerticalDivider} />
              <View style={styles.statItem}>
                <Icon name="video-call" size={18} color="rgba(255,255,255,0.8)" />
                <Text style={styles.statValue}>{counselor.totalSessions || 0}</Text>
                <Text style={styles.statLabel}>Sessions</Text>
              </View>
              <View style={styles.statVerticalDivider} />
              <View style={styles.statItem}>
                <Icon name="people" size={18} color="rgba(255,255,255,0.8)" />
                <Text style={styles.statValue}>{counselor.activeClients || 0}</Text>
                <Text style={styles.statLabel}>Clients</Text>
              </View>
              <View style={styles.statVerticalDivider} />
              <View style={styles.statItem}>
                <Icon name="workspace-premium" size={18} color="rgba(255,255,255,0.8)" />
                <Text style={styles.statValue}>{counselor.experience || 0}Y</Text>
                <Text style={styles.statLabel}>Experience</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Tab Navigation */}
      // Replace only the tab bar section and styles

/* Tab Navigation - FIXED */
<View style={styles.tabBarOuter}>
  <View style={styles.tabBar}>
    <TouchableOpacity
      style={[
        styles.tab,
        activeTab === 'professional' && styles.activeTab,
      ]}
      onPress={() => handleTabPress('professional')}
      activeOpacity={0.8}
    >
      <Icon name="business-center" size={20} color={activeTab === 'professional' ? '#fff' : '#64748B'} />
      <Text style={[styles.tabText, activeTab === 'professional' && styles.activeTabText]}>
        Professional
      </Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={[
        styles.tab,
        activeTab === 'personal' && styles.activeTab,
      ]}
      onPress={() => handleTabPress('personal')}
      activeOpacity={0.8}
    >
      <Icon name="person" size={20} color={activeTab === 'personal' ? '#fff' : '#64748B'} />
      <Text style={[styles.tabText, activeTab === 'personal' && styles.activeTabText]}>
        Personal
      </Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={[
        styles.tab,
        activeTab === 'contact' && styles.activeTab,
      ]}
      onPress={() => handleTabPress('contact')}
      activeOpacity={0.8}
    >
      <Icon name="contact-page" size={20} color={activeTab === 'contact' ? '#fff' : '#64748B'} />
      <Text style={[styles.tabText, activeTab === 'contact' && styles.activeTabText]}>
        Contact
      </Text>
    </TouchableOpacity>
  </View>
</View>

        {/* Tab Content */}
        <View style={styles.tabContent}>
          {activeTab === 'professional' && (
            <>
              {/* Bio */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIconContainer}>
                    <Icon name="description" size={20} color="#4F46E5" />
                  </View>
                  <View>
                    <Text style={styles.sectionTitle}>Professional Bio</Text>
                    <Text style={styles.sectionSubtitle}>Your background and expertise</Text>
                  </View>
                </View>
                {isEditing ? (
                  <TextInput
                    style={[styles.textInput, styles.textArea]}
                    value={editedData.aboutMe || ''}
                    onChangeText={(value) => handleInputChange('aboutMe', value)}
                    placeholder="Describe your professional background and approach to counseling..."
                    placeholderTextColor="#94A3B8"
                    multiline
                    numberOfLines={5}
                  />
                ) : (
                  <Text style={styles.bodyText}>
                    {counselor.aboutMe || 'No bio added yet. Share your professional journey and expertise.'}
                  </Text>
                )}
              </View>

              {/* Specializations */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIconContainer}>
                    <Icon name="psychology" size={20} color="#4F46E5" />
                  </View>
                  <View>
                    <Text style={styles.sectionTitle}>Specializations</Text>
                    <Text style={styles.sectionSubtitle}>Areas of expertise</Text>
                  </View>
                </View>
                <View style={styles.chipContainer}>
                  {(isEditing ? editedData.specialization : counselor.specialization).map((spec, i) => (
                    <View key={i} style={styles.chip}>
                      <Text style={styles.chipText}>{spec}</Text>
                      {isEditing && (
                        <TouchableOpacity onPress={() => handleRemoveSpecialization(spec)} style={styles.chipRemoveBtn}>
                          <Icon name="close" size={14} color="#4F46E5" />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
                {isEditing && (
                  <View style={styles.addRow}>
                    <TextInput
                      style={[styles.textInput, styles.flexInput]}
                      value={newSpecialization}
                      onChangeText={setNewSpecialization}
                      placeholder="Add specialization..."
                      placeholderTextColor="#94A3B8"
                      onSubmitEditing={handleAddSpecialization}
                    />
                    <TouchableOpacity onPress={handleAddSpecialization} style={styles.addBtn}>
                      <Icon name="add" size={22} color="#fff" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Education & Experience */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIconContainer}>
                    <Icon name="school" size={20} color="#4F46E5" />
                  </View>
                  <View>
                    <Text style={styles.sectionTitle}>Education & Experience</Text>
                    <Text style={styles.sectionSubtitle}>Qualifications and years of practice</Text>
                  </View>
                </View>
                <View style={styles.infoRow}>
                  <View style={styles.infoIconBox}>
                    <Icon name="menu-book" size={18} color="#4F46E5" />
                  </View>
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
                <View style={[styles.infoRow, { marginBottom: 0 }]}>
                  <View style={styles.infoIconBox}>
                    <Icon name="work-history" size={18} color="#4F46E5" />
                  </View>
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
                  <View style={styles.sectionIconContainer}>
                    <Icon name="videocam" size={20} color="#4F46E5" />
                  </View>
                  <View>
                    <Text style={styles.sectionTitle}>Consultation Mode</Text>
                    <Text style={styles.sectionSubtitle}>How you connect with clients</Text>
                  </View>
                </View>
                <View style={styles.chipContainer}>
                  {(isEditing ? editedData.consultationMode : counselor.consultationMode).map((mode, i) => (
                    <View key={i} style={styles.modeChip}>
                      <Icon
                        name={mode === 'online' ? 'wifi' : mode === 'offline' ? 'location-on' : 'sync'}
                        size={14}
                        color="#059669"
                      />
                      <Text style={styles.modeChipText}>{mode.charAt(0).toUpperCase() + mode.slice(1)}</Text>
                      {isEditing && (
                        <TouchableOpacity onPress={() => handleRemoveConsultationMode(mode)} style={styles.chipRemoveBtn}>
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
                    <TouchableOpacity onPress={handleAddConsultationMode} style={styles.addBtnSmall}>
                      <Icon name="add" size={20} color="#fff" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Languages */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIconContainer}>
                    <Icon name="language" size={20} color="#4F46E5" />
                  </View>
                  <View>
                    <Text style={styles.sectionTitle}>Languages</Text>
                    <Text style={styles.sectionSubtitle}>Languages you speak</Text>
                  </View>
                </View>
                <View style={styles.chipContainer}>
                  {(isEditing ? editedData.languages : counselor.languages).map((lang, i) => (
                    <View key={i} style={styles.langChip}>
                      <Text style={styles.langChipText}>{lang}</Text>
                      {isEditing && (
                        <TouchableOpacity onPress={() => handleRemoveLanguage(lang)} style={styles.chipRemoveBtn}>
                          <Icon name="close" size={14} color="#7C3AED" />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
                {isEditing && (
                  <View style={styles.addRow}>
                    <TextInput
                      style={[styles.textInput, styles.flexInput]}
                      value={newLanguage}
                      onChangeText={setNewLanguage}
                      placeholder="Add language..."
                      placeholderTextColor="#94A3B8"
                      onSubmitEditing={handleAddLanguage}
                    />
                    <TouchableOpacity onPress={handleAddLanguage} style={styles.addBtn}>
                      <Icon name="add" size={22} color="#fff" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Certifications */}
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIconContainer}>
                    <Icon name="verified" size={20} color="#4F46E5" />
                  </View>
                  <View>
                    <Text style={styles.sectionTitle}>Certifications</Text>
                    <Text style={styles.sectionSubtitle}>Licenses and professional credentials</Text>
                  </View>
                </View>
                {(isEditing ? editedData.certifications : counselor.certifications).map((cert, i) => (
                  <View key={cert._id || i} style={styles.certCard}>
                    <View style={styles.certHeader}>
                      <Icon name="workspace-premium" size={18} color="#4F46E5" />
                      <Text style={styles.certName}>{cert.name}</Text>
                      {isEditing && (
                        <TouchableOpacity onPress={() => handleRemoveCertification(cert._id)}>
                          <Icon name="delete-outline" size={20} color="#EF4444" />
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
                {(!counselor.certifications || counselor.certifications.length === 0) && !isEditing && (
                  <Text style={styles.bodyText}>No certifications added yet.</Text>
                )}
                {isEditing && (
                  <View style={styles.addCertForm}>
                    <Text style={styles.addCertTitle}>Add New Certification</Text>
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
                        style={[styles.textInput, styles.flexInput]}
                        value={newCertification.issueDate}
                        onChangeText={(value) => setNewCertification(prev => ({ ...prev, issueDate: value }))}
                        placeholder="Issue date"
                        placeholderTextColor="#94A3B8"
                      />
                      <TextInput
                        style={[styles.textInput, styles.flexInput]}
                        value={newCertification.expiryDate}
                        onChangeText={(value) => setNewCertification(prev => ({ ...prev, expiryDate: value }))}
                        placeholder="Expiry date"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>
                    <TouchableOpacity onPress={handleAddCertification} style={styles.addCertBtn}>
                      <Icon name="add-circle-outline" size={18} color="#fff" />
                      <Text style={styles.addCertBtnText}>Add Certification</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </>
          )}

          {activeTab === 'personal' && (
            <>
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIconContainer}>
                    <Icon name="person" size={20} color="#4F46E5" />
                  </View>
                  <View>
                    <Text style={styles.sectionTitle}>Personal Details</Text>
                    <Text style={styles.sectionSubtitle}>Basic personal information</Text>
                  </View>
                </View>
                <View style={styles.infoRow}>
                  <View style={styles.infoIconBox}>
                    <Icon name="cake" size={18} color="#4F46E5" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Age</Text>
                    {isEditing ? (
                      <TextInput
                        style={styles.textInput}
                        value={editedData.age?.toString() || ''}
                        onChangeText={(value) => handleInputChange('age', parseInt(value) || 0)}
                        placeholder="Your age"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                      />
                    ) : (
                      <Text style={styles.infoValue}>{counselor.age || 'Not specified'}</Text>
                    )}
                  </View>
                </View>
                <View style={styles.infoRow}>
                  <View style={styles.infoIconBox}>
                    <Icon name="wc" size={18} color="#4F46E5" />
                  </View>
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
                <View style={[styles.infoRow, { marginBottom: 0 }]}>
                  <View style={styles.infoIconBox}>
                    <Icon name="bloodtype" size={18} color="#4F46E5" />
                  </View>
                  <View style={styles.infoContent}>
                    <Text style={styles.infoLabel}>Blood Group</Text>
                    {isEditing ? (
                      <TextInput
                        style={styles.textInput}
                        value={editedData.bloodGroup || ''}
                        onChangeText={(value) => handleInputChange('bloodGroup', value)}
                        placeholder="e.g., A+"
                        placeholderTextColor="#94A3B8"
                      />
                    ) : (
                      <Text style={styles.infoValue}>{counselor.bloodGroup || 'Not specified'}</Text>
                    )}
                  </View>
                </View>
              </View>

              <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionIconContainer}>
                    <Icon name="location-on" size={20} color="#4F46E5" />
                  </View>
                  <View>
                    <Text style={styles.sectionTitle}>Address</Text>
                    <Text style={styles.sectionSubtitle}>Your location details</Text>
                  </View>
                </View>
                {isEditing ? (
                  <View style={styles.addressForm}>
                    <TextInput
                      style={styles.textInput}
                      value={editedData.address?.line1 || ''}
                      onChangeText={(value) => handleNestedInputChange('address', 'line1', value)}
                      placeholder="Address Line 1"
                      placeholderTextColor="#94A3B8"
                    />
                    <TextInput
                      style={styles.textInput}
                      value={editedData.address?.line2 || ''}
                      onChangeText={(value) => handleNestedInputChange('address', 'line2', value)}
                      placeholder="Address Line 2"
                      placeholderTextColor="#94A3B8"
                    />
                    <View style={styles.dateRow}>
                      <TextInput style={[styles.textInput, styles.flexInput]} value={editedData.address?.city || ''} onChangeText={(value) => handleNestedInputChange('address', 'city', value)} placeholder="City" placeholderTextColor="#94A3B8" />
                      <TextInput style={[styles.textInput, styles.flexInput]} value={editedData.address?.state || ''} onChangeText={(value) => handleNestedInputChange('address', 'state', value)} placeholder="State" placeholderTextColor="#94A3B8" />
                    </View>
                    <View style={styles.dateRow}>
                      <TextInput style={[styles.textInput, styles.flexInput]} value={editedData.address?.pincode || ''} onChangeText={(value) => handleNestedInputChange('address', 'pincode', value)} placeholder="Pincode" placeholderTextColor="#94A3B8" keyboardType="numeric" />
                      <TextInput style={[styles.textInput, styles.flexInput]} value={editedData.address?.country || ''} onChangeText={(value) => handleNestedInputChange('address', 'country', value)} placeholder="Country" placeholderTextColor="#94A3B8" />
                    </View>
                  </View>
                ) : (
                  <View>
                    {counselor.address?.line1 ? (
                      <>
                        <View style={styles.addressLine}>
                          <Icon name="home" size={16} color="#64748B" />
                          <Text style={styles.addressText}>{counselor.address.line1}</Text>
                        </View>
                        {counselor.address.line2 && (
                          <View style={styles.addressLine}>
                            <Icon name="apartment" size={16} color="#64748B" />
                            <Text style={styles.addressText}>{counselor.address.line2}</Text>
                          </View>
                        )}
                        <View style={styles.addressLine}>
                          <Icon name="location-city" size={16} color="#64748B" />
                          <Text style={styles.addressText}>
                            {[counselor.address.city, counselor.address.state, counselor.address.pincode].filter(Boolean).join(', ')}
                          </Text>
                        </View>
                        <View style={styles.addressLine}>
                          <Icon name="public" size={16} color="#64748B" />
                          <Text style={styles.addressText}>{counselor.address.country}</Text>
                        </View>
                      </>
                    ) : (
                      <Text style={styles.bodyText}>No address provided</Text>
                    )}
                  </View>
                )}
              </View>
            </>
          )}

          {activeTab === 'contact' && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIconContainer}>
                  <Icon name="contact-phone" size={20} color="#4F46E5" />
                </View>
                <View>
                  <Text style={styles.sectionTitle}>Contact Information</Text>
                  <Text style={styles.sectionSubtitle}>How clients can reach you</Text>
                </View>
              </View>
              <View style={styles.infoRow}>
                <View style={styles.infoIconBox}>
                  <Icon name="email" size={18} color="#4F46E5" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Email Address</Text>
                  {isEditing ? (
                    <TextInput style={styles.textInput} value={editedData.email || ''} onChangeText={(value) => handleInputChange('email', value)} placeholder="Your email address" placeholderTextColor="#94A3B8" keyboardType="email-address" />
                  ) : (
                    <Text style={styles.infoValue}>{counselor.email || 'Not specified'}</Text>
                  )}
                </View>
              </View>
              <View style={styles.infoRow}>
                <View style={styles.infoIconBox}>
                  <Icon name="phone" size={18} color="#4F46E5" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Phone Number</Text>
                  {isEditing ? (
                    <TextInput style={styles.textInput} value={editedData.phoneNumber || ''} onChangeText={(value) => handleInputChange('phoneNumber', value)} placeholder="Your phone number" placeholderTextColor="#94A3B8" keyboardType="phone-pad" />
                  ) : (
                    <Text style={styles.infoValue}>{counselor.phoneNumber || 'Not specified'}</Text>
                  )}
                </View>
              </View>
              <View style={[styles.infoRow, { marginBottom: 0 }]}>
                <View style={styles.infoIconBox}>
                  <Icon name="location-on" size={18} color="#4F46E5" />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Location</Text>
                  {isEditing ? (
                    <TextInput style={styles.textInput} value={editedData.location || ''} onChangeText={(value) => handleInputChange('location', value)} placeholder="Your location" placeholderTextColor="#94A3B8" />
                  ) : (
                    <Text style={styles.infoValue}>{counselor.location || 'Not specified'}</Text>
                  )}
                </View>
              </View>
            </View>
          )}
        </View>

        {/* Bottom Spacing */}
        <View style={{ height: 40 }} />
        </View>
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
    paddingBottom: 20,
  },
  pageShell: {
    width: '100%',
    maxWidth: 860,
    alignSelf: 'center',
    paddingHorizontal: isSmall ? 10 : 18,
  },
  loadingScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  loadingText: {
    marginTop: 14,
    fontSize: 15,
    color: '#64748B',
    fontWeight: '500',
  },

  // Banner
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 0,
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  successBanner: { backgroundColor: '#059669' },
  errorBanner: { backgroundColor: '#EF4444' },
  bannerText: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1 },

  // Profile Header Card
  profileHeaderCard: {
    marginHorizontal: 0,
    marginTop: 18,
    borderRadius: isSmall ? 22 : 28,
    overflow: 'hidden',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 12,
  },
  headerGradient: { padding: isSmall ? 16 : 24 },

  // Header Top Section
  headerTopSection: {
    flexDirection: isSmall ? 'column' : 'row',
    alignItems: isSmall ? 'center' : 'flex-start',
    gap: isSmall ? 14 : 20,
  },
  avatarColumn: { alignItems: 'center', gap: 10 },
  avatarContainer: {
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.4)',
    position: 'relative',
  },
  avatarImage: { borderRadius: 999 },
  avatarPlaceholder: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 999,
  },
  avatarLetter: { color: '#fff', fontWeight: '800' },
  editPhotoBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#4F46E5',
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusDot: { width: 9, height: 9, borderRadius: 5 },
  activeDot: { backgroundColor: '#10B981' },
  inactiveDot: { backgroundColor: '#F59E0B' },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  // Info Column
  infoColumn: {
    flex: 1,
    alignItems: isSmall ? 'center' : 'flex-start',
    width: isSmall ? '100%' : 'auto',
    gap: 6,
  },
  counselorName: { fontSize: 26, fontWeight: '800', color: '#fff', letterSpacing: -0.5 },
  nameInput: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(255,255,255,0.5)',
    paddingVertical: 4,
    width: '100%',
  },
  codeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  counselorCode: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  specializationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  specBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  specBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600' },

  // Edit Button Column
  editButtonColumn: { justifyContent: 'flex-start', paddingTop: isSmall ? 0 : 4 },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  editProfileBtnText: { color: '#4F46E5', fontSize: 14, fontWeight: '700' },
  editActionsColumn: { flexDirection: 'row', gap: 8 },
  saveBtnDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  saveBtnTextSmall: { color: '#fff', fontSize: 14, fontWeight: '700' },
  cancelBtnDesktop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  cancelBtnTextSmall: { color: '#fff', fontSize: 14, fontWeight: '600' },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: isSmall ? 18 : 24,
    paddingTop: isSmall ? 16 : 20,
    paddingHorizontal: isSmall ? 2 : 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  statItem: { alignItems: 'center', gap: 4, flex: 1, minWidth: 0 },
  statValue: { fontSize: isSmall ? 17 : 20, fontWeight: '800', color: '#fff' },
  statLabel: { fontSize: isSmall ? 9 : 10, color: 'rgba(255,255,255,0.75)', fontWeight: '500', textAlign: 'center' },
  statVerticalDivider: { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.2)' },
  starRow: { flexDirection: 'row', gap: 2 },

  // Tab Bar - PROPER FULL WIDTH ACTIVE STATE
// Tab Bar - PROPER FULL WIDTH ACTIVE STATE
tabBarOuter: {
  marginHorizontal: 0,
  marginTop: 20,
},
tabBar: {
  flexDirection: 'row',
  backgroundColor: '#E8EDF5',
  borderRadius: 16,
  padding: 5,
  gap: 5,
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
  gap: 8,
  paddingVertical: 12,
  paddingHorizontal: 16,
  borderRadius: 12,
  minHeight: 48,
},
activeTab: {
  backgroundColor: '#4F46E5',
  shadowColor: '#4F46E5',
  shadowOffset: { width: 0, height: 3 },
  shadowOpacity: 0.3,
  shadowRadius: 6,
  elevation: 4,
},
tabText: {
  fontSize: 13,
  fontWeight: '700',
  color: '#64748B',
},
activeTabText: {
  color: '#FFFFFF',
},

// Content padding fix
pageShell: {
  width: '100%',
  maxWidth: 860,
  alignSelf: 'center',
  paddingHorizontal: 16,
},

// Fix section cards spacing
sectionCard: {
  backgroundColor: '#fff',
  borderRadius: 18,
  padding: 20,
  marginBottom: 14,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius: 8,
  elevation: 2,
},

// Profile header card margin fix
profileHeaderCard: {
  marginTop: 16,
  borderRadius: 24,
  overflow: 'hidden',
  shadowColor: '#4F46E5',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.25,
  shadowRadius: 24,
  elevation: 10,
},

// Tab content padding
tabContent: {
  paddingTop: 18,
},
// Content padding fix
pageShell: {
  width: '100%',
  maxWidth: 860,
  alignSelf: 'center',
  paddingHorizontal: 16,
},

// Fix section cards spacing
sectionCard: {
  backgroundColor: '#fff',
  borderRadius: 18,
  padding: 20,
  marginBottom: 14,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.05,
  shadowRadius: 8,
  elevation: 2,
},

// Profile header card margin fix
profileHeaderCard: {
  marginTop: 16,
  borderRadius: 24,
  overflow: 'hidden',
  shadowColor: '#4F46E5',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.25,
  shadowRadius: 24,
  elevation: 10,
},

// Tab content padding
tabContent: {
  paddingTop: 18,
},
  tabIndicator: {
    position: 'absolute',
    bottom: 2,
    height: 3,
    width: '40%',
    backgroundColor: '#4F46E5',
    borderRadius: 2,
  },

  // Tab Content
  tabContent: {
    paddingHorizontal: 0,
    paddingTop: 16,
  },

  // Section Card
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: isSmall ? 16 : 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: '#F1F5F9',
  },
  sectionIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#0F172A', letterSpacing: -0.3 },
  sectionSubtitle: { fontSize: 12, color: '#94A3B8', fontWeight: '400', marginTop: 2 },

  // Typography
  bodyText: { fontSize: 14, color: '#64748B', lineHeight: 22 },

  // Chips
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  chipText: { fontSize: 13, color: '#4F46E5', fontWeight: '600' },
  chipRemoveBtn: { padding: 2 },
  modeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  modeChipText: { fontSize: 13, color: '#059669', fontWeight: '600' },
  langChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F5F3FF',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  langChipText: { fontSize: 13, color: '#7C3AED', fontWeight: '600' },

  // Add Row
  addRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  flexInput: { flex: 1 },
  addBtn: {
    backgroundColor: '#4F46E5',
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  addBtnSmall: {
    backgroundColor: '#4F46E5',
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Info Row
  infoRow: { flexDirection: 'row', gap: 14, marginBottom: 18 },
  infoIconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  infoContent: { flex: 1 },
  infoLabel: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: { fontSize: 15, color: '#0F172A', fontWeight: '600' },

  // Text Input
  textInput: {
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: isSmall ? 10 : 11,
    fontSize: 14,
    backgroundColor: '#F8FAFC',
    color: '#0F172A',
  },
  textArea: { minHeight: 100, textAlignVertical: 'top' },

  // Mode Selector
  modeSelector: { flexDirection: 'row', gap: 8, marginTop: 14, flexWrap: 'wrap' },
  modeOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#fff',
  },
  modeOptionActive: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  modeOptionText: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  modeOptionTextActive: { color: '#fff' },

  // Gender Selector
  genderSelector: { flexDirection: 'row', gap: 8 },
  genderOption: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
  genderOptionActive: { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  genderText: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  genderTextActive: { color: '#fff' },

  // Address
  addressForm: { gap: 10 },
  addressLine: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  addressText: { fontSize: 14, color: '#475569', flex: 1 },
  dateRow: { flexDirection: 'row', gap: 10 },

  // Certifications
  certCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#4F46E5',
  },
  certHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  certName: { fontSize: 15, fontWeight: '700', color: '#0F172A', flex: 1 },
  certDetails: { marginTop: 10, gap: 4, paddingLeft: 28 },
  certDetail: { fontSize: 12, color: '#64748B', fontWeight: '500' },
  addCertForm: {
    gap: 10,
    marginTop: 14,
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#4F46E5',
  },
  addCertTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 4 },
  addCertBtn: {
    backgroundColor: '#4F46E5',
    paddingVertical: 13,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  addCertBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});

export default CounselorProfile;