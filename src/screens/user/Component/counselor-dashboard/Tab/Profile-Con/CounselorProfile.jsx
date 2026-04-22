// CounselorProfile.jsx - React Native Version
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
  Modal,
  StyleSheet,
  Platform,
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { launchImageLibrary } from 'react-native-image-picker';
import { pick } from '@react-native-documents/picker';
import { API_BASE_URL } from '../../../../../../axiosConfig';

const CounselorProfile = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showDocumentPicker, setShowDocumentPicker] = useState(false);
  const [selectedCertId, setSelectedCertId] = useState(null);

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

  // Fetch profile data on component mount
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
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.data.success && response.data.counsellor) {
        const userData = response.data.counsellor;

        let profilePhotoUrl = 'https://via.placeholder.com/150x150?text=Profile';
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
            line1: '',
            line2: '',
            city: '',
            state: '',
            pincode: '',
            country: 'India'
          },
          emergencyContact: userData.emergencyContact || {
            name: '',
            relation: '',
            phone: ''
          },
          medicalInfo: userData.medicalInfo || {
            height: '',
            weight: '',
            allergies: [],
            chronicConditions: [],
            currentMedications: []
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
    setEditedData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleNestedInputChange = (parentField, field, value) => {
    setEditedData(prev => ({
      ...prev,
      [parentField]: {
        ...prev[parentField],
        [field]: value
      }
    }));
  };

  const handleProfilePhotoUpload = async () => {
    const options = {
      mediaType: 'photo',
      includeBase64: false,
      quality: 0.8,
    };

    launchImageLibrary(options, (response) => {
      if (response.didCancel) {
        console.log('User cancelled image picker');
      } else if (response.errorCode) {
        console.log('ImagePicker Error: ', response.errorMessage);
      } else if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        setEditedData(prev => ({
          ...prev,
          profilePhoto: {
            uri: asset.uri,
            type: asset.type,
            name: asset.fileName
          },
          profilePhotoUrl: asset.uri
        }));
      }
    });
  };

  const handleRemoveProfilePhoto = () => {
    setEditedData(prev => ({
      ...prev,
      profilePhoto: null,
      profilePhotoUrl: 'https://via.placeholder.com/150x150?text=Profile'
    }));
  };

  const handleAddLanguage = () => {
    if (newLanguage.trim() && !editedData.languages.includes(newLanguage.trim())) {
      setEditedData(prev => ({
        ...prev,
        languages: [...prev.languages, newLanguage.trim()]
      }));
      setNewLanguage('');
    }
  };

  const handleRemoveLanguage = (languageToRemove) => {
    setEditedData(prev => ({
      ...prev,
      languages: prev.languages.filter(lang => lang !== languageToRemove)
    }));
  };

  const handleAddSpecialization = () => {
    if (newSpecialization.trim() && !editedData.specialization.includes(newSpecialization.trim())) {
      setEditedData(prev => ({
        ...prev,
        specialization: [...prev.specialization, newSpecialization.trim()]
      }));
      setNewSpecialization('');
    }
  };

  const handleRemoveSpecialization = (specToRemove) => {
    setEditedData(prev => ({
      ...prev,
      specialization: prev.specialization.filter(spec => spec !== specToRemove)
    }));
  };

  const handleAddConsultationMode = () => {
    const modes = ['online', 'offline', 'both'];
    if (newConsultationMode && modes.includes(newConsultationMode) && !editedData.consultationMode.includes(newConsultationMode)) {
      setEditedData(prev => ({
        ...prev,
        consultationMode: [...prev.consultationMode, newConsultationMode]
      }));
      setNewConsultationMode('');
    }
  };

  const handleRemoveConsultationMode = (modeToRemove) => {
    setEditedData(prev => ({
      ...prev,
      consultationMode: prev.consultationMode.filter(mode => mode !== modeToRemove)
    }));
  };

  const handleDocumentUpload = async (certId) => {
    setSelectedCertId(certId);
    
    try {
      const [file] = await pick({
        mode: 'open',
        allowMultiSelection: false,
        type: ['application/pdf', 'image/jpeg', 'image/png', 'application/msword'],
      });

      const updatedCerts = editedData.certifications.map(cert => {
        if (cert._id === certId) {
          return {
            ...cert,
            document: {
              uri: file.uri,
              type: file.type,
              name: file.name
            },
            documentName: file.name,
            documentUrl: file.uri
          };
        }
        return cert;
      });

      setEditedData(prev => ({
        ...prev,
        certifications: updatedCerts
      }));
    } catch (err) {
      if (err.code !== 'CANCELED') {
        console.error('Error picking document:', err);
      }
    }
  };

  const handleAddCertification = async () => {
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

    setEditedData(prev => ({
      ...prev,
      certifications: [...prev.certifications, newCert]
    }));

    setNewCertification({
      name: '',
      issueDate: '',
      expiryDate: '',
      issuedBy: '',
      document: null,
      documentName: ''
    });
  };

  const handleNewDocumentUpload = async () => {
    try {
      const [file] = await pick({
        mode: 'open',
        allowMultiSelection: false,
        type: ['application/pdf', 'image/jpeg', 'image/png', 'application/msword'],
      });

      setNewCertification(prev => ({
        ...prev,
        document: {
          uri: file.uri,
          type: file.type,
          name: file.name
        },
        documentName: file.name
      }));
    } catch (err) {
      if (err.code !== 'CANCELED') {
        console.error('Error picking document:', err);
      }
    }
  };

  const handleRemoveCertification = (certId) => {
    setEditedData(prev => ({
      ...prev,
      certifications: prev.certifications.filter(cert => cert._id !== certId)
    }));
  };

  const handleRemoveDocument = (certId) => {
    const updatedCerts = editedData.certifications.map(cert => {
      if (cert._id === certId) {
        return {
          ...cert,
          document: null,
          documentName: '',
          documentUrl: ''
        };
      }
      return cert;
    });

    setEditedData(prev => ({
      ...prev,
      certifications: updatedCerts
    }));
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

      if (editedData.emergencyContact) {
        formData.append('emergencyContact[name]', editedData.emergencyContact.name || '');
        formData.append('emergencyContact[relation]', editedData.emergencyContact.relation || '');
        formData.append('emergencyContact[phone]', editedData.emergencyContact.phone || '');
      }

      if (editedData.languages && editedData.languages.length > 0) {
        editedData.languages.forEach((lang, index) => {
          formData.append(`languages[${index}]`, lang);
        });
      }

      if (editedData.specialization && editedData.specialization.length > 0) {
        editedData.specialization.forEach((spec, index) => {
          formData.append(`specialization[${index}]`, spec);
        });
      }

      if (editedData.consultationMode && editedData.consultationMode.length > 0) {
        editedData.consultationMode.forEach((mode, index) => {
          formData.append(`consultationMode[${index}]`, mode);
        });
      }

      if (editedData.profilePhoto && editedData.profilePhoto.uri) {
        formData.append('profilePhoto', {
          uri: editedData.profilePhoto.uri,
          type: editedData.profilePhoto.type,
          name: editedData.profilePhoto.name
        });
      }

      if (editedData.certifications && editedData.certifications.length > 0) {
        editedData.certifications.forEach((cert, index) => {
          formData.append(`certifications[${index}][name]`, cert.name || '');
          formData.append(`certifications[${index}][issuedBy]`, cert.issuedBy || '');

          if (cert.issueDate) {
            formData.append(`certifications[${index}][issueDate]`, cert.issueDate);
          }
          if (cert.expiryDate) {
            formData.append(`certifications[${index}][expiryDate]`, cert.expiryDate);
          }

          if (cert._id && !cert._id.toString().startsWith('temp_')) {
            formData.append(`certifications[${index}][_id]`, cert._id);
          }

          if (cert.document && cert.document.uri) {
            formData.append(`certifications[${index}][document]`, {
              uri: cert.document.uri,
              type: cert.document.type,
              name: cert.document.name
            });
          }
        });
      }

      const response = await updateCounselorProfile(formData);

      if (response.data.success) {
        setSuccessMessage('Profile updated successfully!');
        await fetchCounselorProfile();
        setIsEditing(false);

        setTimeout(() => {
          setSuccessMessage('');
        }, 3000);
      } else {
        setError(response.data.message || 'Failed to update profile');
      }
    } catch (err) {
      console.error('Error updating profile:', err);
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to update profile');

      setTimeout(() => {
        setError('');
      }, 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setEditedData(counselor);
    setNewLanguage('');
    setNewSpecialization('');
    setNewConsultationMode('');
    setNewCertification({
      name: '',
      issueDate: '',
      expiryDate: '',
      issuedBy: '',
      document: null,
      documentName: ''
    });
    setIsEditing(false);
    setError('');
    setSuccessMessage('');
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not specified';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const renderCertificationCard = (cert) => (
    <View key={cert._id} style={styles.certificationCard}>
      <View style={styles.certificationHeader}>
        <View style={styles.certificationTitle}>
          <Text style={styles.certificationIcon}>📜</Text>
          <Text style={styles.certificationName}>{cert.name}</Text>
        </View>
        {isEditing && (
          <TouchableOpacity onPress={() => handleRemoveCertification(cert._id)} style={styles.removeCertBtn}>
            <Text style={styles.removeBtnText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.certificationDetails}>
        <View style={styles.certificationInfo}>
          <View>
            <Text style={styles.infoLabel}>Issued By:</Text>
            <Text style={styles.infoText}>{cert.issuedBy || 'Not specified'}</Text>
          </View>
          <View>
            <Text style={styles.infoLabel}>Issue Date:</Text>
            <Text style={styles.infoText}>{cert.issueDate ? formatDate(cert.issueDate) : 'Not specified'}</Text>
          </View>
          <View>
            <Text style={styles.infoLabel}>Expiry Date:</Text>
            <Text style={styles.infoText}>{cert.expiryDate ? formatDate(cert.expiryDate) : 'Not specified'}</Text>
          </View>
        </View>

        <View style={styles.documentSection}>
          <Text style={styles.documentLabel}>Supporting Document:</Text>
          {cert.documentUrl || cert.document ? (
            <View style={styles.documentPreview}>
              <Text style={styles.documentLink}>📄 {cert.documentName || 'View Document'}</Text>
              {isEditing && (
                <TouchableOpacity onPress={() => handleRemoveDocument(cert._id)} style={styles.removeDocumentBtn}>
                  <Text style={styles.removeBtnText}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <Text style={styles.noDocument}>No document uploaded</Text>
          )}

          {isEditing && (
            <TouchableOpacity onPress={() => handleDocumentUpload(cert._id)} style={styles.uploadBtn}>
              <Text style={styles.uploadBtnText}>📁 Upload Document</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );

  if (loading && !counselor._id) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Success/Error Messages */}
      {successMessage ? (
        <View style={[styles.alert, styles.successAlert]}>
          <Text style={styles.successText}>{successMessage}</Text>
        </View>
      ) : null}
      {error ? (
        <View style={[styles.alert, styles.errorAlert]}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.avatarWrapper}>
          <View style={styles.profilePhotoContainer}>
            {editedData?.profilePhotoUrl && editedData.profilePhotoUrl !== 'https://via.placeholder.com/150x150?text=Profile' ? (
              <Image source={{ uri: editedData.profilePhotoUrl }} style={styles.profilePhoto} />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {counselor?.fullName?.charAt(0) || 'C'}
                </Text>
              </View>
            )}

            {isEditing && (
              <View style={styles.photoEditOverlay}>
                <TouchableOpacity onPress={handleProfilePhotoUpload} style={styles.uploadPhotoBtn}>
                  <Text style={styles.photoBtnText}>📷</Text>
                </TouchableOpacity>
                {editedData.profilePhotoUrl !== 'https://via.placeholder.com/150x150?text=Profile' && (
                  <TouchableOpacity onPress={handleRemoveProfilePhoto} style={styles.removePhotoBtn}>
                    <Text style={styles.photoBtnText}>✕</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          <View style={styles.uniqueCode}>
            <Text style={styles.uniqueCodeLabel}>Counselor Code:</Text>
            <Text style={styles.uniqueCodeValue}>{counselor?.uniqueCode || 'Not assigned'}</Text>
          </View>
        </View>

        <View style={styles.headerInfo}>
          <Text style={styles.name}>
            {isEditing ? (
              <TextInput
                style={styles.input}
                value={editedData.fullName || ''}
                onChangeText={(value) => handleInputChange('fullName', value)}
                placeholder="Full Name"
              />
            ) : (
              counselor?.fullName
            )}
          </Text>
          
          <View style={styles.specializationContainer}>
            {isEditing ? (
              <View>
                <View style={styles.tagsList}>
                  {editedData.specialization.map((spec, index) => (
                    <View key={index} style={styles.tag}>
                      <Text style={styles.tagText}>{spec}</Text>
                      <TouchableOpacity onPress={() => handleRemoveSpecialization(spec)}>
                        <Text style={styles.removeTagText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
                <View style={styles.addSection}>
                  <TextInput
                    style={[styles.input, styles.flex1]}
                    value={newSpecialization}
                    onChangeText={setNewSpecialization}
                    placeholder="Add new specialization..." placeholderTextColor="#94a3b8"
                    onSubmitEditing={handleAddSpecialization}
                  />
                  <TouchableOpacity onPress={handleAddSpecialization} style={styles.addBtn}>
                    <Text style={styles.addBtnText}>+ Add</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <Text style={styles.specialization}>
                {counselor?.specialization?.join(', ') || 'Not specified'}
              </Text>
            )}
          </View>

          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{counselor?.rating || 0} ★</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{counselor?.totalSessions || 0}</Text>
              <Text style={styles.statLabel}>Sessions</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{counselor?.activeClients || 0}</Text>
              <Text style={styles.statLabel}>Active Clients</Text>
            </View>
          </View>
        </View>

        <View style={styles.actions}>
          {!isEditing ? (
            <TouchableOpacity onPress={() => setIsEditing(true)} style={[styles.btn, styles.editBtn]}>
              <Text style={styles.btnText}>Edit Profile</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity onPress={handleSave} style={[styles.btn, styles.saveBtn]} disabled={loading}>
                <Text style={styles.btnText}>{loading ? 'Saving...' : 'Save Changes'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleCancel} style={[styles.btn, styles.cancelBtn]}>
                <Text style={styles.btnText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Left Column */}
        <View style={styles.leftColumn}>
          {/* Contact Information */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Contact Information</Text>
            <View style={styles.contactInfo}>
              <View style={styles.contactItem}>
                <Text style={styles.contactIcon}>📧</Text>
                <View style={styles.contactDetail}>
                  <Text style={styles.contactLabel}>Email</Text>
                  {isEditing ? (
                    <TextInput
                      style={styles.input}
                      value={editedData.email || ''}
                      onChangeText={(value) => handleInputChange('email', value)}
                      placeholder="Email"
                      keyboardType="email-address"
                    />
                  ) : (
                    <Text style={styles.contactValue}>{counselor?.email || 'Not specified'}</Text>
                  )}
                </View>
              </View>
              <View style={styles.contactItem}>
                <Text style={styles.contactIcon}>📱</Text>
                <View style={styles.contactDetail}>
                  <Text style={styles.contactLabel}>Phone</Text>
                  {isEditing ? (
                    <TextInput
                      style={styles.input}
                      value={editedData.phoneNumber || ''}
                      onChangeText={(value) => handleInputChange('phoneNumber', value)}
                      placeholder="Phone Number"
                      keyboardType="phone-pad"
                    />
                  ) : (
                    <Text style={styles.contactValue}>{counselor?.phoneNumber || 'Not specified'}</Text>
                  )}
                </View>
              </View>
              <View style={styles.contactItem}>
                <Text style={styles.contactIcon}>📍</Text>
                <View style={styles.contactDetail}>
                  <Text style={styles.contactLabel}>Location</Text>
                  {isEditing ? (
                    <TextInput
                      style={styles.input}
                      value={editedData.location || ''}
                      onChangeText={(value) => handleInputChange('location', value)}
                      placeholder="Location"
                    />
                  ) : (
                    <Text style={styles.contactValue}>{counselor?.location || 'Not specified'}</Text>
                  )}
                </View>
              </View>
            </View>
          </View>

          {/* Personal Information */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Personal Information</Text>
            <View style={styles.personalInfo}>
              <View style={styles.infoRow}>
                <Text style={styles.infoRowLabel}>Age:</Text>
                {isEditing ? (
                  <TextInput
                    style={[styles.input, styles.flex1]}
                    value={editedData.age?.toString() || ''}
                    onChangeText={(value) => handleInputChange('age', parseInt(value) || 0)}
                    placeholder="Age"
                    keyboardType="numeric"
                  />
                ) : (
                  <Text style={styles.infoRowValue}>{counselor?.age || 'Not specified'}</Text>
                )}
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoRowLabel}>Gender:</Text>
                {isEditing ? (
                  <View style={styles.pickerContainer}>
                    {['male', 'female', 'other'].map(option => (
                      <TouchableOpacity
                        key={option}
                        onPress={() => handleInputChange('gender', option)}
                        style={[
                          styles.genderOption,
                          editedData.gender === option && styles.genderOptionActive
                        ]}
                      >
                        <Text style={[
                          styles.genderOptionText,
                          editedData.gender === option && styles.genderOptionTextActive
                        ]}>
                          {option.charAt(0).toUpperCase() + option.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.infoRowValue}>
                    {counselor?.gender ? counselor.gender.charAt(0).toUpperCase() + counselor.gender.slice(1) : 'Not specified'}
                  </Text>
                )}
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoRowLabel}>Blood Group:</Text>
                {isEditing ? (
                  <TextInput
                    style={[styles.input, styles.flex1]}
                    value={editedData.bloodGroup || ''}
                    onChangeText={(value) => handleInputChange('bloodGroup', value)}
                    placeholder="e.g., A+, B-, O+"
                  />
                ) : (
                  <Text style={styles.infoRowValue}>{counselor?.bloodGroup || 'Not specified'}</Text>
                )}
              </View>
            </View>
          </View>

          {/* Address */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Address</Text>
            {isEditing ? (
              <View>
                <TextInput
                  style={styles.input}
                  value={editedData.address?.line1 || ''}
                  onChangeText={(value) => handleNestedInputChange('address', 'line1', value)}
                  placeholder="Address Line 1"
                />
                <TextInput
                  style={styles.input}
                  value={editedData.address?.line2 || ''}
                  onChangeText={(value) => handleNestedInputChange('address', 'line2', value)}
                  placeholder="Address Line 2"
                />
                <TextInput
                  style={styles.input}
                  value={editedData.address?.city || ''}
                  onChangeText={(value) => handleNestedInputChange('address', 'city', value)}
                  placeholder="City"
                />
                <TextInput
                  style={styles.input}
                  value={editedData.address?.state || ''}
                  onChangeText={(value) => handleNestedInputChange('address', 'state', value)}
                  placeholder="State"
                />
                <TextInput
                  style={styles.input}
                  value={editedData.address?.pincode || ''}
                  onChangeText={(value) => handleNestedInputChange('address', 'pincode', value)}
                  placeholder="Pincode"
                  keyboardType="numeric"
                />
                <TextInput
                  style={styles.input}
                  value={editedData.address?.country || ''}
                  onChangeText={(value) => handleNestedInputChange('address', 'country', value)}
                  placeholder="Country"
                />
              </View>
            ) : (
              <View>
                {counselor.address?.line1 && <Text style={styles.addressText}>{counselor.address.line1}</Text>}
                {counselor.address?.line2 && <Text style={styles.addressText}>{counselor.address.line2}</Text>}
                <Text style={styles.addressText}>
                  {counselor.address?.city && `${counselor.address.city}, `}
                  {counselor.address?.state && `${counselor.address.state} `}
                  {counselor.address?.pincode && `- ${counselor.address.pincode}`}
                </Text>
                {counselor.address?.country && <Text style={styles.addressText}>{counselor.address.country}</Text>}
                {!counselor.address?.line1 && !counselor.address?.city && (
                  <Text style={styles.addressText}>No address provided</Text>
                )}
              </View>
            )}
          </View>

          {/* Education */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Education</Text>
            {isEditing ? (
              <TextInput
                style={[styles.input, styles.textArea]}
                value={editedData.education || ''}
                onChangeText={(value) => handleInputChange('education', value)}
                placeholder="Enter your educational qualifications"
                multiline
                numberOfLines={3}
              />
            ) : (
              <Text style={styles.cardText}>{counselor?.education || counselor?.qualification || 'Not specified'}</Text>
            )}
          </View>

          {/* Experience */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Experience</Text>
            {isEditing ? (
              <TextInput
                style={styles.input}
                value={editedData.experience?.toString() || ''}
                onChangeText={(value) => handleInputChange('experience', parseInt(value) || 0)}
                placeholder="Years of experience"
                keyboardType="numeric"
              />
            ) : (
              <Text style={styles.cardText}>{counselor?.experience} years</Text>
            )}
          </View>

          {/* Consultation Mode */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Consultation Mode</Text>
            <View>
              <View style={styles.tagsList}>
                {editedData?.consultationMode?.map((mode, index) => (
                  <View key={index} style={[styles.tag, styles.consultationTag]}>
                    <Text style={styles.tagText}>{mode.charAt(0).toUpperCase() + mode.slice(1)}</Text>
                    {isEditing && (
                      <TouchableOpacity onPress={() => handleRemoveConsultationMode(mode)}>
                        <Text style={styles.removeTagText}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>

              {isEditing && (
                <View style={styles.addSection}>
                  <View style={styles.pickerContainer}>
                    {['online', 'offline', 'both'].map(mode => (
                      <TouchableOpacity
                        key={mode}
                        onPress={() => setNewConsultationMode(mode)}
                        style={[
                          styles.modeOption,
                          newConsultationMode === mode && styles.modeOptionActive
                        ]}
                      >
                        <Text style={[
                          styles.modeOptionText,
                          newConsultationMode === mode && styles.modeOptionTextActive
                        ]}>
                          {mode.charAt(0).toUpperCase() + mode.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity onPress={handleAddConsultationMode} style={styles.addBtn}>
                    <Text style={styles.addBtnText}>+ Add</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>

          {/* Languages */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Languages</Text>
            <View>
              <View style={styles.tagsList}>
                {editedData?.languages?.map((lang, index) => (
                  <View key={index} style={styles.tag}>
                    <Text style={styles.tagText}>{lang}</Text>
                    {isEditing && (
                      <TouchableOpacity onPress={() => handleRemoveLanguage(lang)}>
                        <Text style={styles.removeTagText}>✕</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>

              {isEditing && (
                <View style={styles.addSection}>
                  <TextInput
                    style={[styles.input, styles.flex1]}
                    value={newLanguage}
                    onChangeText={setNewLanguage}
                    placeholder="Add new language..." placeholderTextColor="#94a3b8"
                    onSubmitEditing={handleAddLanguage}
                  />
                  <TouchableOpacity onPress={handleAddLanguage} style={styles.addBtn}>
                    <Text style={styles.addBtnText}>+ Add</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Right Column */}
        <View style={styles.rightColumn}>
          {/* Bio */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Professional Bio</Text>
            {isEditing ? (
              <TextInput
                style={[styles.input, styles.textArea]}
                value={editedData.aboutMe || ''}
                onChangeText={(value) => handleInputChange('aboutMe', value)}
                placeholder="Write about your professional background, expertise, and approach to counseling..."
                multiline
                numberOfLines={5}
              />
            ) : (
              <Text style={styles.cardText}>{counselor?.aboutMe || 'No bio provided'}</Text>
            )}
          </View>

          {/* Licenses & Certifications */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Licenses & Certifications</Text>
            <View>
              <View style={styles.certificationsList}>
                {editedData?.certifications?.map(renderCertificationCard)}
              </View>

              {isEditing && (
                <View style={styles.addCertificationForm}>
                  <Text style={styles.addCertTitle}>Add New License/Certification</Text>
                  <TextInput
                    style={styles.input}
                    value={newCertification.name}
                    onChangeText={(value) => setNewCertification(prev => ({ ...prev, name: value }))}
                    placeholder="Certification/License Name *"
                  />
                  <TextInput
                    style={styles.input}
                    value={newCertification.issuedBy}
                    onChangeText={(value) => setNewCertification(prev => ({ ...prev, issuedBy: value }))}
                    placeholder="Issued By"
                  />
                  <View style={styles.dateRow}>
                    <TextInput
                      style={[styles.input, styles.flex1]}
                      value={newCertification.issueDate}
                      onChangeText={(value) => setNewCertification(prev => ({ ...prev, issueDate: value }))}
                      placeholder="Issue Date (YYYY-MM-DD)"
                    />
                    <TextInput
                      style={[styles.input, styles.flex1]}
                      value={newCertification.expiryDate}
                      onChangeText={(value) => setNewCertification(prev => ({ ...prev, expiryDate: value }))}
                      placeholder="Expiry Date (YYYY-MM-DD)"
                    />
                  </View>
                  
                  <TouchableOpacity onPress={handleNewDocumentUpload} style={styles.documentUploadArea}>
                    <Text style={styles.documentUploadText}>
                      {newCertification.documentName ? `📄 ${newCertification.documentName}` : '📁 Click to upload supporting document'}
                    </Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    onPress={handleAddCertification}
                    style={[styles.addCertBtn, !newCertification.name.trim() && styles.addCertBtnDisabled]}
                    disabled={!newCertification.name.trim()}
                  >
                    <Text style={styles.addCertBtnText}>+ Add Certification</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  alert: {
    padding: 12,
    borderRadius: 8,
    margin: 16,
    marginBottom: 0,
  },
  successAlert: {
    backgroundColor: '#d4edda',
    borderWidth: 1,
    borderColor: '#c3e6cb',
  },
  errorAlert: {
    backgroundColor: '#f8d7da',
    borderWidth: 1,
    borderColor: '#f5c6cb',
  },
  successText: {
    color: '#155724',
    fontSize: 14,
  },
  errorText: {
    color: '#721c24',
    fontSize: 14,
  },
  header: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    margin: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarWrapper: {
    alignItems: 'center',
  },
  profilePhotoContainer: {
    position: 'relative',
    width: 120,
    height: 120,
    marginBottom: 12,
  },
  profilePhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundGradient: { colors: ['#667eea', '#764ba2'] },
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarText: {
    fontSize: 48,
    color: '#fff',
    fontWeight: 'bold',
  },
  photoEditOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    flexDirection: 'row',
    gap: 5,
  },
  uploadPhotoBtn: {
    backgroundColor: '#667eea',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  removePhotoBtn: {
    backgroundColor: '#f56565',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  photoBtnText: {
    fontSize: 16,
    color: '#fff',
  },
  uniqueCode: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    flexDirection: 'row',
    gap: 5,
  },
  uniqueCodeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  uniqueCodeValue: {
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#667eea',
    fontWeight: '600',
  },
  headerInfo: {
    marginTop: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  specialization: {
    fontSize: 16,
    color: '#667eea',
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 12,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 12,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 16,
  },
  btn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  editBtn: {
    backgroundColor: '#667eea',
  },
  saveBtn: {
    backgroundColor: '#48bb78',
  },
  cancelBtn: {
    backgroundColor: '#f56565',
  },
  btnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  leftColumn: {
    marginBottom: 16,
  },
  rightColumn: {},
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#667eea',
  },
  cardText: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
  },
  contactInfo: {
    gap: 12,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  contactIcon: {
    fontSize: 18,
    minWidth: 30,
  },
  contactDetail: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    fontWeight: '500',
  },
  contactValue: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#333',
    backgroundColor: '#fff',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  personalInfo: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoRowLabel: {
    minWidth: 100,
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  infoRowValue: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  pickerContainer: {
    flexDirection: 'row',
    gap: 8,
    flex: 1,
  },
  genderOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  genderOptionActive: {
    backgroundColor: '#667eea',
    borderColor: '#667eea',
  },
  genderOptionText: {
    fontSize: 14,
    color: '#333',
  },
  genderOptionTextActive: {
    color: '#fff',
  },
  modeOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  modeOptionActive: {
    backgroundColor: '#48bb78',
    borderColor: '#48bb78',
  },
  modeOptionText: {
    fontSize: 14,
    color: '#333',
  },
  modeOptionTextActive: {
    color: '#fff',
  },
  addressText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
  },
  tagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 6,
  },
  consultationTag: {
    backgroundColor: '#e8f5e9',
  },
  tagText: {
    fontSize: 14,
    color: '#1976d2',
  },
  removeTagText: {
    fontSize: 12,
    color: '#1976d2',
  },
  addSection: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  flex1: {
    flex: 1,
  },
  addBtn: {
    backgroundColor: '#48bb78',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  // Certification styles
  certificationsList: {
    gap: 12,
  },
  certificationCard: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#667eea',
  },
  certificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  certificationTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  certificationIcon: {
    fontSize: 16,
  },
  certificationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  removeCertBtn: {
    backgroundColor: '#f56565',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  removeBtnText: {
    color: '#fff',
    fontSize: 12,
  },
  certificationDetails: {
    marginTop: 4,
  },
  certificationInfo: {
    gap: 8,
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
    marginBottom: 2,
  },
  infoText: {
    fontSize: 12,
    color: '#333',
  },
  documentSection: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 8,
    marginTop: 4,
  },
  documentLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    marginBottom: 6,
  },
  documentPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  documentLink: {
    fontSize: 12,
    color: '#667eea',
  },
  removeDocumentBtn: {
    backgroundColor: '#f56565',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  noDocument: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  uploadBtn: {
    backgroundColor: '#667eea',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  uploadBtnText: {
    color: '#fff',
    fontSize: 12,
  },
  addCertificationForm: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 2,
    borderColor: '#667eea',
    borderStyle: 'dashed',
  },
  addCertTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  documentUploadArea: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  documentUploadText: {
    color: '#667eea',
    fontSize: 14,
  },
  addCertBtn: {
    backgroundColor: '#48bb78',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  addCertBtnDisabled: {
    backgroundColor: '#ccc',
  },
  addCertBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  specializationContainer: {
    width: '100%',
  },
});

export default CounselorProfile;
