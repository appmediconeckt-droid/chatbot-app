// CounselorProfile.jsx - Modern Full Width Design
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
  KeyboardAvoidingView,
  Dimensions,
  Animated,
} from 'react-native';
import useLanguageRender from '../../../../../../hooks/useLanguageRender';
import TranslatedMessageBubble from '../../../../../../components/TranslatedMessageBubble';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchImageLibrary } from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import safeVibrate from '../../../../../../utils/safeVibrate';
import { API_BASE_URL } from '../../../../../../axiosConfig';

const { width } = Dimensions.get('window');

const normalizeGender = (value) => {
  if (!value) return '';
  const v = String(value).trim().toLowerCase();
  if (v === 'm' || v === 'male') return 'male';
  if (v === 'f' || v === 'female') return 'female';
  if (v === 'o' || v === 'other') return 'other';
  return v;
};

const normalizeBloodGroup = (value) => {
  if (!value) return '';
  return String(value).replace(/\s+/g, '').toUpperCase();
};

const CounselorProfile = () => {
  const navigation = useNavigation();
  const { t } = useLanguageRender();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [activeTab, setActiveTab] = useState('professional');

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
    isActive: false,
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
  const [clientsCount, setClientsCount] = useState(0);
  const [sessionsCount, setSessionsCount] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
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

  useEffect(() => {
    fetchCounselorProfile();
    fetchStatsData();
  }, []);

  const fetchStatsData = async () => {
    try {
      const counsellorId = await AsyncStorage.getItem('counsellorId');
      const token = await AsyncStorage.getItem('accessToken') || await AsyncStorage.getItem('token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      // Clients = accepted chats
      const chatsRes = await axios.get(`${API_BASE_URL}/api/chat/chats`, { headers });
      const chats = chatsRes.data?.chats || [];
      const accepted = chats.filter(c => String(c.status || '').toLowerCase() === 'accepted').length;
      setClientsCount(accepted);

      // Sessions = completed video calls
      try {
        const callsRes = await axios.get(`${API_BASE_URL}/api/video/calls/history/${counsellorId}`, { headers });
        const calls = callsRes.data?.calls || callsRes.data?.history || [];
        setSessionsCount(Array.isArray(calls) ? calls.length : 0);
      } catch {
        // endpoint may not exist — keep 0
      }
    } catch (e) {
      // non-critical
    }
  };

  const calcProfileCompletion = (data) => {
    const fields = [
      { key: 'fullName', check: v => !!v },
      { key: 'email', check: v => !!v },
      { key: 'phoneNumber', check: v => !!v },
      { key: 'profilePhotoUrl', check: v => !!v },
      { key: 'specialization', check: v => Array.isArray(v) && v.length > 0 },
      { key: 'experience', check: v => !!v && v > 0 },
      { key: 'qualification', check: v => !!v },
      { key: 'location', check: v => !!v },
      { key: 'aboutMe', check: v => !!v },
      { key: 'languages', check: v => Array.isArray(v) && v.length > 0 },
      { key: 'consultationMode', check: v => Array.isArray(v) && v.length > 0 },
      { key: 'gender', check: v => !!v },
    ];
    const filled = fields.filter(f => f.check(data[f.key])).length;
    return Math.round((filled / fields.length) * 100);
  };

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
          isActive:
            userData.isActive === true ||
            userData.isOnline === true ||
            userData.online === true ||
            String(userData.status || '').toLowerCase() === 'online',
          profileCompleted: userData.profileCompleted || false,
          age: userData.age || null,
          gender: normalizeGender(userData.gender),
          dateOfBirth: userData.dateOfBirth || null,
          bloodGroup: normalizeBloodGroup(userData.bloodGroup),
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
        const pct = calcProfileCompletion(formattedData);
        Animated.timing(progressAnim, {
          toValue: pct / 100,
          duration: 900,
          useNativeDriver: false,
        }).start();
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
    if (!dateString) return t('profile:notSpecified');
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  };

  const StarRating = ({ rating, size = 14 }) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      const filled = i <= Math.round(rating);
      stars.push(
        <View key={i} style={{ position: 'relative', width: size + 2, height: size + 2, alignItems: 'center', justifyContent: 'center' }}>
          {filled ? (
            <Icon name="star" size={size} color="#2563EB" />
          ) : (
            <>
              <Icon name="star" size={size} color="#ffffff" />
              <Icon name="star-border" size={size} color="#2563EB" style={{ position: 'absolute' }} />
            </>
          )}
        </View>
      );
    }
    return <View style={styles.starRow}>{stars}</View>;
  };

  if (loading && !counselor._id) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#94A3B8" />
        <Text style={styles.loadingText}>{t('profile:loadingYourProfile')}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent}
      >
        {/* FULL WIDTH - NO SIDE SPACING */}
        <View style={styles.fullWidth}>
        
        {/* Notification Banner - Full Width */}
        {(successMessage || error) && (
          <View style={[styles.banner, successMessage ? styles.successBanner : styles.errorBanner]}>
            <Icon name={successMessage ? 'check-circle' : 'error-outline'} size={20} color="#fff" />
            <Text style={styles.bannerText}>{successMessage || error}</Text>
          </View>
        )}

        {/* Profile Header - Full Width */}
        <LinearGradient
          colors={['#EFF6FF', '#DBEAFE', '#FFFFFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.profileHeader}
        >
          <View style={styles.headerContent}>
            {/* Avatar Section */}
            <View style={styles.avatarSection}>
              <View style={styles.avatarWrapper}>
                {editedData?.profilePhotoUrl ? (
                  <Image
                    source={{ uri: editedData.profilePhotoUrl }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarLetter}>
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
            </View>

            {/* Info Section */}
            <View style={styles.infoSection}>
              {isEditing ? (
                <TextInput
                  style={styles.nameInput}
                  value={editedData.fullName || ''}
                  onChangeText={(value) => handleInputChange('fullName', value)}
                  placeholder="Your Full Name"
                  placeholderTextColor="#9CA3AF"
                />
              ) : (
                <Text style={styles.counselorName}>{counselor.fullName || 'Your Name'}</Text>
              )}
              
              <View style={styles.codeRow}>
                <Icon name="verified" size={14} color="#2563EB" />
                <Text style={styles.counselorCode}>{counselor.uniqueCode}</Text>
              </View>
              
              <View style={styles.specializationRow}>
                {counselor.specialization.slice(0, 3).map((spec, i) => (
                  <View key={i} style={styles.specBadge}>
                    <Text style={styles.specBadgeText}>{spec}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Edit Button */}
            <View style={styles.editSection}>
              {!isEditing ? (
                <TouchableOpacity onPress={() => setIsEditing(true)} style={styles.editBtn}>
                  <Icon name="edit" size={18} color="#fff" />
                  <Text style={styles.editBtnText}>{t('common:edit')}</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.editActions}>
                  <TouchableOpacity onPress={handleSave} style={styles.saveBtn} disabled={loading}>
                    <Icon name="check" size={18} color="#fff" />
                    <Text style={styles.saveBtnText}>{t('common:save')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleCancel} style={styles.cancelBtn}>
                    <Icon name="close" size={18} color="#6B7280" />
                    <Text style={styles.cancelBtnText}>{t('common:cancel')}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Stats Row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <StarRating rating={counselor.rating || 0} size={12} />
                <Text style={styles.statValue}>{counselor.rating?.toFixed(1) || '0.0'}</Text>
                <Text style={styles.statLabel}>{t('profile:rating')}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Icon name="video-call" size={18} color="#2563EB" />
                <Text style={styles.statValue}>{sessionsCount}</Text>
                <Text style={styles.statLabel}>{t('profile:sessions')}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Icon name="people" size={18} color="#2563EB" />
                <Text style={styles.statValue}>{clientsCount}</Text>
                <Text style={styles.statLabel}>{t('profile:clients')}</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Icon name="work-history" size={18} color="#2563EB" />
                <Text style={styles.statValue}>{counselor.experience || 0}y</Text>
                <Text style={styles.statLabel}>{t('profile:experience')}</Text>
              </View>
            </View>

          </View>
        </LinearGradient>

        {/* Profile Completion Card */}
        {(() => {
          const pct = calcProfileCompletion(counselor);
          const barColor = '#2563EB';
          const bgColor = '#EFF6FF';
          const borderColor = '#DBEAFE';
          return (
            <View style={[styles.completionWrap, { backgroundColor: bgColor, borderColor }]}>
              <View style={styles.completionHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Icon name={pct === 100 ? 'check-circle' : 'person'} size={16} color={barColor} />
                  <Text style={styles.completionLabel}>{t('profile:profileCompletion')}</Text>
                </View>
                <Text style={[styles.completionPct, { color: barColor }]}>{pct}%</Text>
              </View>
              <View style={styles.completionTrack}>
                <Animated.View style={[styles.completionFill, {
                  backgroundColor: barColor,
                  width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                }]} />
              </View>
              {pct < 100 && (
                <Text style={styles.completionHint}>
                  {pct < 50 ? 'Add specialization, experience & location to get discovered' :
                   pct < 80 ? 'Almost there! Fill remaining fields to appear in search' :
                   'Just a few fields left to complete your profile'}
                </Text>
              )}
            </View>
          );
        })()}

        {/* All profile content — no tabs */}
        <View style={styles.tabContent}>
          {/* Personal info card — age, gender, blood group, email, phone, location, address */}
          <View style={styles.card}>
            <View style={styles.detailRow}>
              <Icon name="cake" size={18} color="#2563EB" />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>{t('profile:age')}</Text>
                {isEditing ? (
                  <TextInput style={styles.input} value={editedData.age?.toString() || ''} onChangeText={(v) => handleInputChange('age', parseInt(v) || 0)} placeholder="Your age" placeholderTextColor="#9CA3AF" keyboardType="numeric" />
                ) : (
                  <Text style={styles.detailValue}>{counselor.age || t('profile:notSpecified')}</Text>
                )}
              </View>
            </View>

            <View style={styles.detailRow}>
              <Icon name="wc" size={18} color="#7C3AED" />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>{t('profile:gender')}</Text>
                {isEditing ? (
                  <View style={styles.genderSelector}>
                    {['male', 'female', 'other'].map(g => (
                      <TouchableOpacity key={g} onPress={() => handleInputChange('gender', g)} style={[styles.genderOption, editedData.gender === g && styles.genderOptionActive]}>
                        <Text style={[styles.genderText, editedData.gender === g && styles.genderTextActive]}>{g.charAt(0).toUpperCase() + g.slice(1)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.detailValue}>{counselor.gender ? counselor.gender.charAt(0).toUpperCase() + counselor.gender.slice(1) : t('profile:notSpecified')}</Text>
                )}
              </View>
            </View>

            <View style={styles.detailRow}>
              <Icon name="bloodtype" size={18} color="#DC2626" />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>{t('profile:bloodGroup')}</Text>
                {isEditing ? (
                  <TextInput style={styles.input} value={editedData.bloodGroup || ''} onChangeText={(v) => handleInputChange('bloodGroup', v)} placeholder="e.g., A+" placeholderTextColor="#9CA3AF" />
                ) : (
                  <Text style={styles.detailValue}>{counselor.bloodGroup || t('profile:notSpecified')}</Text>
                )}
              </View>
            </View>

            <View style={styles.detailRow}>
              <Icon name="email" size={18} color="#2563EB" />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>{t('auth:email')}</Text>
                {isEditing ? (
                  <TextInput style={styles.input} value={editedData.email || ''} onChangeText={(v) => handleInputChange('email', v)} placeholder="Your email" placeholderTextColor="#9CA3AF" keyboardType="email-address" autoCapitalize="none" />
                ) : (
                  <Text style={styles.detailValue}>{counselor.email || t('profile:notSpecified')}</Text>
                )}
              </View>
            </View>

            <View style={styles.detailRow}>
              <Icon name="phone" size={18} color="#3B82F6" />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>{t('auth:phone')}</Text>
                {isEditing ? (
                  <TextInput style={styles.input} value={editedData.phoneNumber || ''} onChangeText={(v) => handleInputChange('phoneNumber', v)} placeholder="Your phone" placeholderTextColor="#9CA3AF" keyboardType="phone-pad" />
                ) : (
                  <Text style={styles.detailValue}>{counselor.phoneNumber || t('profile:notSpecified')}</Text>
                )}
              </View>
            </View>

            <View style={styles.detailRow}>
              <Icon name="location-on" size={18} color="#DC2626" />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>{t('profile:location')}</Text>
                {isEditing ? (
                  <TextInput style={styles.input} value={editedData.location || ''} onChangeText={(v) => handleInputChange('location', v)} placeholder="Your location" placeholderTextColor="#9CA3AF" />
                ) : (
                  <Text style={styles.detailValue}>{counselor.location || t('profile:notSpecified')}</Text>
                )}
              </View>
            </View>

            <View style={styles.detailRow}>
              <Icon name="home" size={18} color="#D97706" />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>{t('profile:address')}</Text>
                {isEditing ? (
                  <View style={styles.addressForm}>
                    <TextInput style={styles.input} value={editedData.address?.line1 || ''} onChangeText={(v) => handleNestedInputChange('address', 'line1', v)} placeholder="Line 1" placeholderTextColor="#9CA3AF" />
                    <TextInput style={styles.input} value={editedData.address?.line2 || ''} onChangeText={(v) => handleNestedInputChange('address', 'line2', v)} placeholder="Line 2" placeholderTextColor="#9CA3AF" />
                    <View style={styles.dateRow}>
                      <TextInput style={[styles.input, styles.flexInput]} value={editedData.address?.city || ''} onChangeText={(v) => handleNestedInputChange('address', 'city', v)} placeholder="City" placeholderTextColor="#9CA3AF" />
                      <TextInput style={[styles.input, styles.flexInput]} value={editedData.address?.state || ''} onChangeText={(v) => handleNestedInputChange('address', 'state', v)} placeholder="State" placeholderTextColor="#9CA3AF" />
                    </View>
                    <View style={styles.dateRow}>
                      <TextInput style={[styles.input, styles.flexInput]} value={editedData.address?.pincode || ''} onChangeText={(v) => handleNestedInputChange('address', 'pincode', v)} placeholder="Pincode" placeholderTextColor="#9CA3AF" keyboardType="numeric" />
                      <TextInput style={[styles.input, styles.flexInput]} value={editedData.address?.country || ''} onChangeText={(v) => handleNestedInputChange('address', 'country', v)} placeholder="Country" placeholderTextColor="#9CA3AF" />
                    </View>
                  </View>
                ) : (
                  <Text style={styles.detailValue}>
                    {counselor.address?.line1 ? [counselor.address.line1, counselor.address.city, counselor.address.state, counselor.address.country].filter(Boolean).join(', ') : t('profile:notSpecified')}
                  </Text>
                )}
              </View>
            </View>
          </View>

          {/* Bio */}
          <View style={styles.card}>
            {isEditing ? (
              <TextInput style={[styles.input, styles.textArea]} value={editedData.aboutMe || ''} onChangeText={(v) => handleInputChange('aboutMe', v)} placeholder="Share your professional journey and expertise..." placeholderTextColor="#9CA3AF" multiline numberOfLines={5} />
            ) : (
              <Text style={styles.bodyText}>{counselor.aboutMe || '✨ No bio added yet.'}</Text>
            )}
          </View>

          {/* Specializations */}
          <View style={styles.card}>
            <View style={styles.chipContainer}>
              {(isEditing ? editedData.specialization : counselor.specialization).map((spec, i) => (
                <View key={i} style={styles.chip}>
                  <Text style={styles.chipText}>{spec}</Text>
                  {isEditing && <TouchableOpacity onPress={() => handleRemoveSpecialization(spec)}><Icon name="close" size={14} color="#94A3B8" /></TouchableOpacity>}
                </View>
              ))}
            </View>
            {isEditing && (
              <View style={styles.addRow}>
                <TextInput style={[styles.input, styles.flexInput]} value={newSpecialization} onChangeText={setNewSpecialization} placeholder="Add specialization..." placeholderTextColor="#9CA3AF" onSubmitEditing={handleAddSpecialization} />
                <TouchableOpacity onPress={handleAddSpecialization} style={styles.addBtn}><Icon name="add" size={20} color="#fff" /></TouchableOpacity>
              </View>
            )}
          </View>

          {/* Education & Experience */}
          <View style={styles.card}>
            <View style={styles.detailRow}>
              <Icon name="menu-book" size={18} color="#7C3AED" />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>{t('profile:education')}</Text>
                {isEditing ? (
                  <TextInput style={styles.input} value={editedData.education || ''} onChangeText={(v) => handleInputChange('education', v)} placeholder="Your qualifications" placeholderTextColor="#9CA3AF" />
                ) : (
                  <Text style={styles.detailValue}>{counselor.education || t('profile:notSpecified')}</Text>
                )}
              </View>
            </View>
            <View style={styles.detailRow}>
              <Icon name="work" size={18} color="#D97706" />
              <View style={styles.detailContent}>
                <Text style={styles.detailLabel}>{t('profile:experience')}</Text>
                {isEditing ? (
                  <TextInput style={styles.input} value={editedData.experience?.toString() || ''} onChangeText={(v) => handleInputChange('experience', parseInt(v) || 0)} placeholder="Years" placeholderTextColor="#9CA3AF" keyboardType="numeric" />
                ) : (
                  <Text style={styles.detailValue}>{counselor.experience} {t('profile:years')}</Text>
                )}
              </View>
            </View>
          </View>

          {/* Consultation Mode */}
          <View style={styles.card}>
            <View style={styles.chipContainer}>
              {(isEditing ? editedData.consultationMode : counselor.consultationMode).map((mode, i) => (
                <View key={i} style={[styles.chip, styles.modeChip]}>
                  <Icon name={mode === 'online' ? 'wifi' : mode === 'offline' ? 'location-on' : 'sync'} size={14} color="#2563EB" />
                  <Text style={styles.modeChipText}>{mode.charAt(0).toUpperCase() + mode.slice(1)}</Text>
                  {isEditing && <TouchableOpacity onPress={() => handleRemoveConsultationMode(mode)}><Icon name="close" size={14} color="#2563EB" /></TouchableOpacity>}
                </View>
              ))}
            </View>
            {isEditing && (
              <View style={styles.modeSelector}>
                {['online', 'offline', 'both'].map(mode => (
                  <TouchableOpacity key={mode} onPress={() => setNewConsultationMode(mode)} style={[styles.modeOption, newConsultationMode === mode && styles.modeOptionActive]}>
                    <Text style={[styles.modeOptionText, newConsultationMode === mode && styles.modeOptionTextActive]}>{mode.charAt(0).toUpperCase() + mode.slice(1)}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity onPress={handleAddConsultationMode} style={styles.smallAddBtn}><Icon name="add" size={18} color="#fff" /></TouchableOpacity>
              </View>
            )}
          </View>

          {/* Languages */}
          <View style={styles.card}>
            <View style={styles.chipContainer}>
              {(isEditing ? editedData.languages : counselor.languages).map((lang, i) => (
                <View key={i} style={[styles.chip, styles.langChip]}>
                  <Text style={styles.langChipText}>{lang}</Text>
                  {isEditing && <TouchableOpacity onPress={() => handleRemoveLanguage(lang)}><Icon name="close" size={14} color="#2563EB" /></TouchableOpacity>}
                </View>
              ))}
            </View>
            {isEditing && (
              <View style={styles.addRow}>
                <TextInput style={[styles.input, styles.flexInput]} value={newLanguage} onChangeText={setNewLanguage} placeholder="Add language..." placeholderTextColor="#9CA3AF" onSubmitEditing={handleAddLanguage} />
                <TouchableOpacity onPress={handleAddLanguage} style={styles.addBtn}><Icon name="add" size={20} color="#fff" /></TouchableOpacity>
              </View>
            )}
          </View>

          {/* Certifications */}
          <View style={styles.card}>
            {(isEditing ? editedData.certifications : counselor.certifications).map((cert, i) => (
              <View key={cert._id || i} style={styles.certCard}>
                <View style={styles.certHeader}>
                  <Icon name="workspace-premium" size={18} color="#D97706" />
                  <Text style={styles.certName}>{cert.name}</Text>
                  {isEditing && <TouchableOpacity onPress={() => handleRemoveCertification(cert._id)}><Icon name="delete-outline" size={18} color="#EF4444" /></TouchableOpacity>}
                </View>
                <View style={styles.certDetails}>
                  <Text style={styles.certDetail}>{t('profile:issuedBy')}: {cert.issuedBy || 'N/A'}</Text>
                  <Text style={styles.certDetail}>{t('profile:issueDate')}: {cert.issueDate ? formatDate(cert.issueDate) : 'N/A'}</Text>
                  <Text style={styles.certDetail}>{t('profile:expiryDate')}: {cert.expiryDate ? formatDate(cert.expiryDate) : 'N/A'}</Text>
                </View>
              </View>
            ))}
            {isEditing && (
              <View style={styles.addCertForm}>
                <Text style={styles.addCertTitle}>{t('profile:addNewCertification')}</Text>
                <TextInput style={styles.input} value={newCertification.name} onChangeText={(v) => setNewCertification(prev => ({ ...prev, name: v }))} placeholder="Certification name *" placeholderTextColor="#9CA3AF" />
                <TextInput style={styles.input} value={newCertification.issuedBy} onChangeText={(v) => setNewCertification(prev => ({ ...prev, issuedBy: v }))} placeholder="Issued by" placeholderTextColor="#9CA3AF" />
                <View style={styles.dateRow}>
                  <TextInput style={[styles.input, styles.flexInput]} value={newCertification.issueDate} onChangeText={(v) => setNewCertification(prev => ({ ...prev, issueDate: v }))} placeholder="Issue date" placeholderTextColor="#9CA3AF" />
                  <TextInput style={[styles.input, styles.flexInput]} value={newCertification.expiryDate} onChangeText={(v) => setNewCertification(prev => ({ ...prev, expiryDate: v }))} placeholder="Expiry date" placeholderTextColor="#9CA3AF" />
                </View>
                <TouchableOpacity onPress={handleAddCertification} style={styles.addCertBtn}>
                  <Text style={styles.addCertBtnText}>Add Certification</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

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
    backgroundColor: '#FFFFFF',
  },
  scrollContent: {
    paddingBottom: 40,
    paddingTop: 0,
  },
  fullWidth: {
    width: '100%',
  },
  loadingScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#2563EB',
    fontWeight: '600',
  },

  // Banner
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 20,
    marginHorizontal: 16,
    marginBottom: 12,
    marginTop: 12,
    borderRadius: 14,
  },
  successBanner: {
    backgroundColor: '#2563EB',
  },
  errorBanner: {
    backgroundColor: '#ef4444',
  },
  bannerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },

  // Profile Header — dark teal background
  profileHeader: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 0,
    marginTop: 0,
    borderRadius: 0,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 6,
  },
  headerContent: {
    paddingVertical: 28,
    paddingHorizontal: 16,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 10,
  },
  avatarImage: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 4,
    borderColor: '#2563EB',
  },
  avatarPlaceholder: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
    shadowColor: '#1D4ED8',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  avatarLetter: {
    fontSize: 44,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  editPhotoBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#2563EB',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#1D4ED8',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeDot: {
    backgroundColor: '#22c55e',
  },
  inactiveDot: {
    backgroundColor: '#f59e0b',
  },
  statusText: {
    color: '#1E3A8A',
    fontSize: 12,
    fontWeight: '600',
  },

  // Info Section
  infoSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  counselorName: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1E3A8A',
    marginBottom: 6,
    textAlign: 'center',
    paddingHorizontal: 8,
    flexShrink: 1,
  },
  nameInput: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    borderBottomWidth: 2,
    borderBottomColor: '#2563EB',
    paddingVertical: 4,
    textAlign: 'center',
    marginBottom: 4,
    alignSelf: 'stretch',
    paddingHorizontal: 8,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  counselorCode: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  specializationRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
  },
  specBadge: {
    backgroundColor: 'rgba(37,99,235,0.1)',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  specBadgeText: {
    color: '#1E3A8A',
    fontSize: 12,
    fontWeight: '600',
  },

  // Edit Section
  editSection: {
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 0,
    alignSelf: 'stretch',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    paddingHorizontal: 28,
    paddingVertical: 11,
    borderRadius: 12,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
    alignSelf: 'center',
    justifyContent: 'center',
  },
  editBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  editActions: {
    flexDirection: 'row',
    gap: 10,
    alignSelf: 'stretch',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
    flex: 1,
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
    flex: 1,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cancelBtnText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '600',
  },

  // Stats Row
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 18,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E3A8A',
  },
  statLabel: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E2E8F0',
  },
  starRow: {
    flexDirection: 'row',
    gap: 2,
  },

  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 0,
    marginHorizontal: 0,
    marginTop: 14,
    marginBottom: 6,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 4,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  activeTab: {
    backgroundColor: '#EFF6FF',
    borderBottomWidth: 0,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  activeTabText: {
    color: '#2563EB',
  },

  // Tab Content
  tabContent: {
    paddingHorizontal: 0,
    paddingVertical: 12,
  },
  securityCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#EFF6FF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  securityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  securityIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityTextWrap: {
    flex: 1,
  },
  securityTitle: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '800',
  },
  securitySubtitle: {
    color: '#6B7280',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
  securityActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  securityButtonSecondary: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#EFF6FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  securityButtonSecondaryText: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '800',
  },
  securityButtonPrimary: {
    flex: 1,
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  securityButtonPrimaryText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },

  // Cards
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 18,
    marginBottom: 14,
   
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
  },

  // Typography
  bodyText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 22,
  },

  // Inputs
  input: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 14,
    backgroundColor: '#FFFFFF',
    color: '#1F2937',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  flexInput: {
    flex: 1,
  },

  // Chips
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    maxWidth: '100%',
  },
  chipText: {
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '600',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  modeChip: {
    backgroundColor: '#EFF6FF',
    borderColor: '#DBEAFE',
  },
  modeChipText: {
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '600',
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  langChip: {
    backgroundColor: '#F3E8FF',
    borderColor: '#E9D5FF',
  },
  langChipText: {
    fontSize: 13,
    color: '#2563EB',
    fontWeight: '600',
    flexShrink: 1,
    flexWrap: 'wrap',
  },

  // Add Row
  addRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 14,
  },
  addBtn: {
    backgroundColor: '#2563EB',
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  smallAddBtn: {
    backgroundColor: '#2563EB',
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Detail Row
  detailRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 18,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  detailValue: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '600',
    flexShrink: 1,
    flexWrap: 'wrap',
  },

  // Mode Selector
  modeSelector: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  modeOption: {
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#fff',
  },
  modeOptionActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  modeOptionText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  modeOptionTextActive: {
    color: '#fff',
  },

  // Gender Selector
  genderSelector: {
    flexDirection: 'row',
    gap: 10,
  },
  genderOption: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    backgroundColor: '#fff',
  },
  genderOptionActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  genderText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  genderTextActive: {
    color: '#fff',
  },

  // Address
  addressForm: {
    gap: 12,
  },
  addressLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  addressText: {
    fontSize: 14,
    color: '#374151',
    flex: 1,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 10,
  },

  // Certifications
  certCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#2563EB',
  },
  certHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  certName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    flexShrink: 1,
    flexWrap: 'wrap',
  },
  certDetails: {
    marginTop: 10,
    gap: 3,
    paddingLeft: 28,
  },
  certDetail: {
    fontSize: 12,
    color: '#6B7280',
  },
  addCertForm: {
    gap: 12,
    marginTop: 14,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#DBEAFE',
  },
  addCertTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  addCertBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: 'center',
  },
  addCertBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },

  // Card section icon box
  cardIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 2,
  },

  // ─── Profile Completion ───────────────────────────────────────────────────
  completionWrap: {
    marginHorizontal: 0,
    marginTop: 0,
    marginBottom: 0,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  completionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  completionLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E3A8A',
  },
  completionPct: {
    fontSize: 15,
    fontWeight: '800',
    color: '#2563EB',
  },
  completionTrack: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  completionFill: {
    height: '100%',
    borderRadius: 4,
  },
  completionHint: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 6,
    lineHeight: 15,
  },

});

export default CounselorProfile;