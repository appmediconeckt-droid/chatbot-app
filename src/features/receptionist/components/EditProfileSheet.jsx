// My Profile → Edit profile: the receptionist changes their own name, phone and
// photo. Role, clinic, shift and staff ID stay with the doctor (Staff
// Management), so they are not editable here. Email is the sign-in id.
import React, { useEffect, useState } from 'react';
import { Keyboard, Modal, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary } from 'react-native-image-picker';
import Text from '../../../components/TranslatedText';
import { AlertBox, Avatar, REC, RecButton } from '../receptionistUi';
import { updateMyProfile } from '../receptionistApi';
import { profilePhotoOf } from '../receptionistUtils';
import CountryPhoneInput from '../../../components/common/CountryPhoneInput';
import { getPhoneLengthLabel, isValidLocalPhoneNumber, splitInternationalPhoneNumber } from '../../../utils/countryCodes';

const phoneOf = (profile = {}) => String(profile.phoneNumber || profile.phone || '');

export default function EditProfileSheet({ visible, profile, onClose, onSaved }) {
  const insets = useSafeAreaInsets();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneCountryCode, setPhoneCountryCode] = useState('+91');
  const [photo, setPhoto] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [keyboard, setKeyboard] = useState(0);

  useEffect(() => {
    if (!visible) return;
    setFullName(profile?.fullName || '');
    const savedPhone = splitInternationalPhoneNumber(phoneOf(profile), profile?.phoneCountryCode);
    setPhone(savedPhone.phoneNumber);
    setPhoneCountryCode(savedPhone.countryCode);
    setPhoto(null);
    setError('');
  }, [visible, profile]);

  // Edge-to-edge Android ignores adjustResize: lift the sheet by the keyboard.
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => setKeyboard(e.endCoordinates?.height || 0));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboard(0));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const pickPhoto = async () => {
    try {
      const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1, quality: 0.8, maxWidth: 800, maxHeight: 800 });
      if (result?.errorCode) throw new Error(result.errorMessage || 'Could not open your photos.');
      if (!result?.didCancel && result?.assets?.[0]) setPhoto(result.assets[0]);
    } catch (err) {
      setError(err?.message || 'Could not open your photos.');
    }
  };

  const digits = phone.replace(/\D/g, '');
  const originalPhone = splitInternationalPhoneNumber(phoneOf(profile), profile?.phoneCountryCode);
  const changed = fullName.trim() !== (profile?.fullName || '').trim() || digits !== originalPhone.phoneNumber || phoneCountryCode !== originalPhone.countryCode || Boolean(photo);

  const save = async () => {
    if (fullName.trim().length < 2) { setError('Please enter your full name.'); return; }
    if (phone && !isValidLocalPhoneNumber(phone, phoneCountryCode)) { setError(`Enter a valid ${getPhoneLengthLabel(phoneCountryCode)} digit phone number for ${phoneCountryCode}.`); return; }
    setSaving(true);
    setError('');
    try {
      const user = await updateMyProfile(profile, { fullName: fullName.trim(), phoneNumber: digits, phoneCountryCode, photo });
      onSaved({
        ...user,
        fullName: user.fullName || fullName.trim(),
        phoneNumber: user.phoneNumber || digits || profile?.phoneNumber,
        phoneCountryCode: user.phoneCountryCode || phoneCountryCode,
        ...(photo && !profilePhotoOf(user) ? { profilePhoto: photo.uri } : {}),
      });
    } catch (err) {
      setError(err?.message || 'Profile could not be updated. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const close = () => { if (!saving) onClose(); };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent navigationBarTranslucent onRequestClose={close}>
      <Pressable style={s.overlay} onPress={close}>
        <Pressable
          style={[s.sheet, { paddingBottom: 18 + Math.max(insets.bottom, keyboard) }]}
          onPress={() => {}}
        >
          <View style={s.handle} />
          <View style={s.head}>
            <View style={s.flex}>
              <Text style={s.title}>Edit profile</Text>
              <Text style={s.sub}>Update how your name, phone and photo appear.</Text>
            </View>
            <Pressable onPress={close} style={s.close} hitSlop={8} accessibilityLabel="Close">
              <Ionicons name="close" size={20} color={REC.ink} />
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={s.photoRow}>
              <Pressable onPress={pickPhoto} disabled={saving} style={s.photoWrap}>
                <Avatar photo={photo?.uri || profilePhotoOf(profile || {})} name={fullName || profile?.fullName} size={76} />
                <View style={s.camera}><Ionicons name="camera" size={14} color="#FFFFFF" /></View>
              </Pressable>
              <Pressable onPress={pickPhoto} disabled={saving}>
                <Text style={s.photoLink}>{photo ? 'Choose another photo' : 'Change photo'}</Text>
              </Pressable>
            </View>

            <Text style={s.label}>Full name</Text>
            <View style={s.input}>
              <Ionicons name="person-outline" size={17} color={REC.muted} />
              <TextInput
                value={fullName}
                onChangeText={(value) => { setFullName(value); setError(''); }}
                style={s.inputText}
                placeholder="Your full name"
                placeholderTextColor="#94A3B8"
                autoCapitalize="words"
                maxLength={60}
                editable={!saving}
              />
            </View>

            <Text style={s.label}>Phone number</Text>
            <CountryPhoneInput value={phone} countryCode={phoneCountryCode} onChangePhoneNumber={(value) => { setPhone(value); setError(''); }} onChangeCountryCode={(value) => { setPhoneCountryCode(value); setError(''); }} editable={!saving} />

            <Text style={s.label}>Email</Text>
            <View style={[s.input, s.inputLocked]}>
              <Ionicons name="mail-outline" size={17} color={REC.muted} />
              <Text translate={false} style={[s.inputText, s.lockedText]} numberOfLines={1}>{profile?.email || 'Not provided'}</Text>
              <Ionicons name="lock-closed" size={14} color="#98A2B3" />
            </View>
            <Text style={s.hint}>Your email is your sign-in ID. Role, clinic and shift are managed by your doctor.</Text>

            <AlertBox text={error} />
          </ScrollView>

          <View style={s.actions}>
            <RecButton label="Cancel" onPress={close} disabled={saving} style={s.flex} />
            <RecButton
              primary
              icon={saving ? undefined : 'checkmark'}
              label={saving ? 'Saving...' : 'Save changes'}
              onPress={save}
              disabled={saving || !changed}
              style={s.flex}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  overlay: { flex: 1, backgroundColor: 'rgba(32,50,72,0.5)', justifyContent: 'flex-end' },
  sheet: { width: '100%', maxWidth: 600, alignSelf: 'center', backgroundColor: '#FFFFFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 18, paddingTop: 10, maxHeight: '92%' },
  handle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D0D5DD', alignSelf: 'center', marginBottom: 14 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 6 },
  title: { fontSize: 19, fontWeight: '800', color: REC.ink },
  sub: { fontSize: 12.5, color: REC.muted, marginTop: 2 },
  close: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#F2F5F7', alignItems: 'center', justifyContent: 'center' },
  photoRow: { alignItems: 'center', gap: 8, marginVertical: 14 },
  photoWrap: { borderRadius: 999, padding: 3, borderWidth: 2, borderColor: REC.soft },
  camera: { position: 'absolute', right: 2, bottom: 2, width: 26, height: 26, borderRadius: 13, backgroundColor: REC.primary, borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  photoLink: { fontSize: 13, fontWeight: '700', color: REC.primary },
  label: { fontSize: 12, fontWeight: '700', color: REC.muted, marginBottom: 6, marginTop: 12 },
  input: { height: 48, borderWidth: 1, borderColor: '#D8E1E8', borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13, backgroundColor: '#FFFFFF' },
  inputLocked: { backgroundColor: '#F6F8FB', borderColor: '#E5EBF0' },
  inputText: { flex: 1, fontSize: 14.5, color: REC.ink, paddingVertical: 0 },
  lockedText: { color: '#667085' },
  hint: { fontSize: 11.5, lineHeight: 16, color: REC.muted, marginTop: 8 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
});
