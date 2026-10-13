import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Keyboard,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
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

const FOCUSED_INPUT_GAP = 16;
const FORM_PAD_BOTTOM = 6;
const CARD_SCREEN_GAP = 120;
const SAVE_BUTTON_GRADIENT = ['#006B2C', '#01CE54'];

const readUserId =(user) => user?._id || user?.id || user?.userId || null;

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
  gradientColors = SAVE_BUTTON_GRADIENT,
}) => {
  const [anonymous, setAnonymous] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneCountryCode, setPhoneCountryCode] = useState('+91');
  const [focusedField, setFocusedField] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [formHeight, setFormHeight] = useState(0);
  const formFrameRef = useRef(null);
  const formScrollRef = useRef(null);
  const formContentRef = useRef(null);
  const anonymousFieldRef = useRef(null);
  const saveButtonRef = useRef(null);
  const scrollTargetRef = useRef(null);
  const formScrollHeightRef = useRef(0);
  const formScrollYRef = useRef(0);
  const keyboardInsetRef = useRef(0);
  const scrollTimerRef = useRef(null);
  // Screen (not window) height, so the card size never changes when the
  // activity window resizes for the keyboard behind the modal.
  const maxCardHeight = Dimensions.get('screen').height - CARD_SCREEN_GAP;

  // Same as the Signup screen: the card and its header stay put, the fields
  // scroll inside the card, the keyboard-covered part of the form becomes extra
  // scroll space, and the focused field (or the Save button for the last
  // field) is scrolled just above the keyboard inside the form.
  const scrollTargetIntoView = useCallback(() => {
    const target = scrollTargetRef.current?.current;
    const content = formContentRef.current;
    const scrollView = formScrollRef.current;
    if (!target || !content || !scrollView || !keyboardInsetRef.current) return;

    target.measureLayout(
      content,
      (_x, y, _width, height) => {
        const top = y;
        const bottom = top + height;
        const visibleHeight = Math.max(
          60,
          formScrollHeightRef.current - keyboardInsetRef.current,
        );
        const currentY = formScrollYRef.current;
        let nextY = currentY;

        if (bottom + FOCUSED_INPUT_GAP > currentY + visibleHeight) {
          nextY = bottom + FOCUSED_INPUT_GAP - visibleHeight;
        } else if (top - FOCUSED_INPUT_GAP < currentY) {
          nextY = Math.max(0, top - FOCUSED_INPUT_GAP);
        }

        if (Math.abs(nextY - currentY) > 2) {
          scrollView.scrollTo({ y: nextY, animated: true });
        }
      },
      () => {},
    );
  }, []);

  const scheduleScrollIntoView = useCallback(
    (delay = Platform.OS === 'ios' ? 60 : 120) => {
      clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = setTimeout(scrollTargetIntoView, delay);
    },
    [scrollTargetIntoView],
  );

  const focusField = (field, targetRef) => {
    setFocusedField(field);
    scrollTargetRef.current = targetRef;
    if (keyboardInsetRef.current > 0) scheduleScrollIntoView();
  };

  // The modal is edge-to-edge (translucent bars), so its window is not resized
  // for the keyboard. Reserve exactly the part of the form the keyboard covers.
  useEffect(() => {
    if (!visible) return undefined;

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      const keyboardTop = e?.endCoordinates?.screenY;
      const applyInset = (inset) => {
        keyboardInsetRef.current = inset;
        setKeyboardInset(inset);
        scheduleScrollIntoView();
      };

      const frame = formFrameRef.current;
      if (!frame || !keyboardTop) {
        applyInset(e?.endCoordinates?.height || 0);
        return;
      }
      frame.measureInWindow((_x, y, _width, height) => {
        applyInset(Math.max(0, y + height - keyboardTop));
      });
    });
    const hideSub = Keyboard.addListener(hideEvent, () => {
      keyboardInsetRef.current = 0;
      setKeyboardInset(0);
    });

    return () => {
      clearTimeout(scrollTimerRef.current);
      showSub.remove();
      hideSub.remove();
      keyboardInsetRef.current = 0;
      setKeyboardInset(0);
    };
  }, [visible, scheduleScrollIntoView]);

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
      <View style={styles.overlay}>
        <View style={[styles.card, { maxHeight: maxCardHeight }]}>
          <View style={[styles.iconWrap, { backgroundColor: `${accentColor}14` }]}>
            <Icon name="incognito-circle" size={34} color={accentColor} />
          </View>
          <Text style={styles.title}>Complete anonymous chat profile</Text>
          <Text style={styles.subtitle}>
            Add the name and phone number used for your patient chat profile.
          </Text>

          {/* Fixed-height frame: the keyboard padding grows the scroll content,
              never the card, so the card does not move. */}
          <View
            ref={formFrameRef}
            collapsable={false}
            style={[styles.formFrame, formHeight > 0 && { height: formHeight }]}
          >
            <ScrollView
              ref={formScrollRef}
              contentContainerStyle={[
                styles.formContent,
                keyboardInset > 0 && {
                  paddingBottom: FORM_PAD_BOTTOM + keyboardInset,
                },
              ]}
              onLayout={(e) => {
                formScrollHeightRef.current = e.nativeEvent.layout.height;
                if (keyboardInsetRef.current > 0) scheduleScrollIntoView(40);
              }}
              onContentSizeChange={(_width, height) => {
                if (keyboardInsetRef.current > 0) return;
                const next = Math.ceil(height);
                setFormHeight((prev) => (Math.abs(prev - next) > 1 ? next : prev));
              }}
              onScroll={(e) => {
                formScrollYRef.current = e.nativeEvent.contentOffset.y;
              }}
              scrollEventThrottle={16}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              showsVerticalScrollIndicator
            >
              <View ref={formContentRef} collapsable={false}>
                <View ref={anonymousFieldRef} collapsable={false} style={styles.field}>
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
                      onFocus={() => focusField('anonymous', anonymousFieldRef)}
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
                    // Last field: bring the Save button into view too.
                    onFocus={() => focusField('phone', saveButtonRef)}
                    onBlur={() => setFocusedField('')}
                    accentColor={accentColor}
                    containerStyle={styles.phoneInputWrapper}
                    inputStyle={styles.phoneTextInput}
                  />
                </View>

                {error ? <Text style={styles.errorText}>{error}</Text> : null}

                <View ref={saveButtonRef} collapsable={false}>
                  <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={handleSave}
                    disabled={saving}
                    style={[
                      styles.saveButtonWrap,
                      { shadowColor: accentColor },
                      saving && styles.saveButtonDisabled,
                    ]}
                  >
                    {/* Same brand gradient as the Signup "Create Account" button. */}
                    <LinearGradient
                      colors={gradientColors}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={styles.saveButton}
                    >
                      {saving ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.saveButtonText}>Save & Continue</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.66)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 22,
  },
  formFrame: {
    flexShrink: 1,
    minHeight: 0,
  },
  formContent: {
    paddingBottom: FORM_PAD_BOTTOM,
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
  saveButtonWrap: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: '#006B2C',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 5,
  },
  saveButton: {
    width: '100%',
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
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
