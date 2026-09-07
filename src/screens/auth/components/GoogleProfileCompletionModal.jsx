import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import Text from '../../../components/TranslatedText';
import TextInput from '../../../components/TranslatedTextInput';
import CountryPhoneInput from '../../../components/common/CountryPhoneInput';
import axiosInstance from '../../../axiosConfig';
import {
  getPhoneLengthLabel,
  isValidLocalPhoneNumber,
  normalizeLocalPhoneNumber,
  splitInternationalPhoneNumber,
} from '../../../utils/countryCodes';

const readUserId = (user) => user?._id || user?.id || user?.userId || null;

export const needsGoogleUserProfileCompletion = (user, isCounselor = false) => {
  if (isCounselor) return false;

  const anonymous = String(
    user?.anonymous || user?.anonymousName || user?.anonName || '',
  ).trim();
  const phone = String(
    user?.phoneNumber || user?.phoneNum || user?.phone || '',
  ).trim();

  return !anonymous || !phone;
};

const GoogleProfileCompletionModal = ({
  visible,
  user,
  onComplete,
  accentColor = '#00652C',
}) => {
  const [anonymous, setAnonymous] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCountryCode, setPhoneCountryCode] = useState('+91');
  const [focusedField, setFocusedField] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!visible) return;

    const phone = splitInternationalPhoneNumber(
      user?.phoneNumber || user?.phoneNum || user?.phone || '',
      user?.phoneCountryCode || '+91',
    );

    setAnonymous(
      String(user?.anonymous || user?.anonymousName || user?.anonName || '').trim(),
    );
    setPhoneNumber(phone.phoneNumber);
    setPhoneCountryCode(phone.countryCode);
    setFocusedField('');
    setSaving(false);
    setError('');
  }, [visible, user]);

  const handleSave = async () => {
    const anonymousName = anonymous.trim();
    const normalizedPhone = normalizeLocalPhoneNumber(
      phoneNumber,
      phoneCountryCode,
    );

    if (!anonymousName) {
      setError('Please enter your anonymous name.');
      return;
    }

    if (!isValidLocalPhoneNumber(normalizedPhone, phoneCountryCode)) {
      setError(
        `Please enter a valid ${getPhoneLengthLabel(phoneCountryCode)} digit phone number.`,
      );
      return;
    }

    const userId = readUserId(user) || (await AsyncStorage.getItem('userId'));
    if (!userId) {
      setError('User ID not found. Please login again.');
      return;
    }

    try {
      setSaving(true);
      setError('');

      const response = await axiosInstance.patch(`/api/auth/update/${userId}`, {
        anonymous: anonymousName,
        phoneNumber: normalizedPhone,
        phoneNum: normalizedPhone,
        phoneCountryCode,
      });

      const updatedUser = response.data?.user || response.data?.data?.user || {
        ...(user || {}),
        anonymous: anonymousName,
        phoneNumber: normalizedPhone,
        phoneCountryCode,
      };

      const currentUserRaw = await AsyncStorage.getItem('userData');
      let currentUser = {};
      try {
        currentUser = currentUserRaw ? JSON.parse(currentUserRaw) : {};
      } catch {
        currentUser = {};
      }

      const mergedUser = {
        ...currentUser,
        ...(user || {}),
        ...updatedUser,
        anonymous: updatedUser.anonymous || anonymousName,
        phoneNumber: updatedUser.phoneNumber || normalizedPhone,
        phoneCountryCode: updatedUser.phoneCountryCode || phoneCountryCode,
      };

      await AsyncStorage.setItem('userData', JSON.stringify(mergedUser));
      onComplete?.(mergedUser);
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          'Could not save details. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={() => {}}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <View style={[styles.iconWrap, { backgroundColor: `${accentColor}14` }]}>
              <Icon name="incognito-circle" size={34} color={accentColor} />
            </View>
            <Text style={styles.title}>Complete anonymous chat profile</Text>
            <Text style={styles.subtitle}>
              Add the name and phone number used for your patient chat profile.
            </Text>

            <View style={styles.field}>
              <Text style={styles.label}>Anonymous Name</Text>
              <View
                style={[
                  styles.inputWrapper,
                  focusedField === 'anonymous' && { borderColor: accentColor },
                ]}
              >
                <Icon
                  name="incognito-circle-outline"
                  size={20}
                  color={focusedField === 'anonymous' ? accentColor : '#64748b'}
                  style={styles.inputIcon}
                />
                <TextInput
                  value={anonymous}
                  onChangeText={(value) => {
                    setAnonymous(value);
                    setError('');
                  }}
                  onFocus={() => setFocusedField('anonymous')}
                  onBlur={() => setFocusedField('')}
                  placeholder="Anonymous Name"
                  placeholderTextColor="#94a3b8"
                  style={styles.textInput}
                  autoCapitalize="words"
                  editable={!saving}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Phone Number</Text>
              <CountryPhoneInput
                value={phoneNumber}
                countryCode={phoneCountryCode}
                onChangePhoneNumber={(value) => {
                  setPhoneNumber(value);
                  setError('');
                }}
                onChangeCountryCode={(code) => {
                  setPhoneCountryCode(code);
                  setError('');
                }}
                focused={focusedField === 'phone'}
                onFocus={() => setFocusedField('phone')}
                onBlur={() => setFocusedField('')}
                accentColor={accentColor}
                containerStyle={styles.phoneInputWrapper}
                inputStyle={styles.phoneTextInput}
              />
            </View>

            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleSave}
              disabled={saving}
              style={[
                styles.saveButton,
                { backgroundColor: accentColor, shadowColor: accentColor },
                saving && styles.saveButtonDisabled,
              ]}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>Save & Continue</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.66)',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 22,
  },
  card: {
    width: '100%',
    maxWidth: 410,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: '#DDF4E6',
    shadowColor: '#052E16',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 14,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 22,
    fontWeight: '600',
  },
  field: {
    width: '100%',
    marginBottom: 14,
  },
  label: {
    fontSize: 13,
    lineHeight: 17,
    color: '#334155',
    fontWeight: '800',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 54,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  inputIcon: {
    marginRight: 10,
  },
  textInput: {
    flex: 1,
    minWidth: 0,
    color: '#1e293b',
    fontSize: 15,
    fontWeight: '700',
  },
  phoneInputWrapper: {
    height: 54,
    borderColor: '#e2e8f0',
  },
  phoneTextInput: {
    fontSize: 15,
    fontWeight: '700',
  },
  errorText: {
    color: '#B91C1C',
    backgroundColor: '#FEF2F2',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    textAlign: 'center',
    padding: 10,
    borderRadius: 10,
    marginBottom: 14,
  },
  saveButton: {
    width: '100%',
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 5,
  },
  saveButtonDisabled: {
    opacity: 0.65,
    shadowOpacity: 0,
    elevation: 0,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
});

export default GoogleProfileCompletionModal;
