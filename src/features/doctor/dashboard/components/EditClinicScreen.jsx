// Edit a saved clinic: photo, name, phone and address (PATCH /api/clinics/:id).
// Opened from the edit button on Clinic Profile and on each clinic in Clinic
// Settings → Your Clinics. Same look and keyboard handling as the Add Clinic form.
import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, View } from 'react-native';
import Text from '../../../../components/TranslatedText';
import TextInput from '../../../../components/TranslatedTextInput';
import { launchImageLibrary } from 'react-native-image-picker';
import LinearGradient from 'react-native-linear-gradient';
import AppIcon from '../icons/AppIcon';
import LocationPicker from './LocationPicker';
import { useToast } from '../../../../components/common/ToastProvider';
import { createDoctorStyles } from '../theme';
import { CLINICIAN_GRADIENT } from '../../../../theme/palette';
import { updateClinic } from '../api/doctorClinics';
import useKeyboardAwareScroll from '../../../../hooks/useKeyboardAwareScroll';
import CountryPhoneInput from '../../../../components/common/CountryPhoneInput';
import { buildInternationalPhoneNumber, getPhoneLengthLabel, isValidLocalPhoneNumber, splitInternationalPhoneNumber } from '../../../../utils/countryCodes';

const errorText = (err, fallback) => {
  const data = err?.response?.data;
  if (typeof data === 'string') {
    const match = data.match(/Error:\s*([^<\n]+)/);
    return match ? match[1].trim() : fallback;
  }
  return data?.message || data?.error || err?.message || fallback;
};

// clinic: { id, name, phone, location, photoUrl }
export default function EditClinicScreen({ clinic, onBack, onSaved }) {
  const {
    scrollRef: kbScrollRef,
    frameInset: kbInset,
    scrollFocusedInputIntoView: kbFocus,
    handleKeyboardAwareScroll: kbOnScroll,
    handleKeyboardAwareScrollLayout: kbOnLayout,
  } = useKeyboardAwareScroll({ frameIsScroll: true });
  const { showToast } = useToast();
  const initialLocation = clinic?.location && clinic.location !== 'Address not available' ? clinic.location : '';
  const [name, setName] = useState(clinic?.name && clinic.name !== 'Unnamed Clinic' ? clinic.name : '');
  const [initialPhone] = useState(() => splitInternationalPhoneNumber(clinic?.phone, clinic?.phoneCountryCode));
  const [phone, setPhone] = useState(initialPhone.phoneNumber);
  const [phoneCountryCode, setPhoneCountryCode] = useState(initialPhone.countryCode);
  const [location, setLocation] = useState(initialLocation);
  const [photo, setPhoto] = useState(null);
  const [photoFailed, setPhotoFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const previewUri = photo?.uri || (!photoFailed && clinic?.photoUrl) || '';

  const pickPhoto = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1, quality: 0.8, maxWidth: 1600, maxHeight: 1600 });
    if (result.didCancel || !result.assets?.length) return;
    const asset = result.assets[0];
    // The server takes JPEG, PNG or WebP up to 5 MB.
    if (asset.type && !/image\/(jpe?g|png|webp)/i.test(asset.type)) {
      setError('Please choose a JPG, PNG or WebP photo.');
      return;
    }
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
      setError('Photo is too large. Please choose one under 5 MB.');
      return;
    }
    setError('');
    setPhoto(asset);
  };

  const handleSave = async () => {
    const missing = [];
    if (!name.trim()) missing.push('Clinic Name');
    if (!phone.trim()) missing.push('Phone');
    if (!location.trim()) missing.push('Address');
    if (missing.length) {
      setError(`Missing: ${missing.join(', ')}`);
      return;
    }
    if (!isValidLocalPhoneNumber(phone, phoneCountryCode)) {
      setError(`Enter a valid ${getPhoneLengthLabel(phoneCountryCode)} digit phone number for ${phoneCountryCode}`);
      return;
    }
    try {
      setSaving(true);
      setError('');
      const updated = await updateClinic(clinic.id, {
        name: name.trim(),
        phone: buildInternationalPhoneNumber(phoneCountryCode, phone),
        location: location.trim(),
        photo,
      });
      showToast('Clinic updated');
      onSaved?.(updated);
    } catch (err) {
      setError(errorText(err, 'Clinic could not be updated. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backButton} hitSlop={8} disabled={saving}>
          <AppIcon name="chevron-left" size={22} color="#1F2937" strokeWidth={2.4} />
        </Pressable>
        <View style={s.flex}>
          <Text style={s.title}>Edit Clinic</Text>
          <Text style={s.subtitle}>Update clinic photo, contact and location</Text>
        </View>
      </View>
      <ScrollView
        showsVerticalScrollIndicator={false}
        ref={kbScrollRef}
        contentContainerStyle={[s.content, kbInset > 0 && { paddingBottom: kbInset + 24 }]}
        onScroll={kbOnScroll}
        onLayout={kbOnLayout}
        onFocusCapture={kbFocus}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
      >
        <Section icon="upload" label="Clinic Photo">
          <Pressable onPress={pickPhoto} disabled={saving} style={({ pressed }) => [s.photoBox, pressed && s.pressed]}>
            {previewUri ? (
              <Image source={{ uri: previewUri }} style={s.photo} onError={() => setPhotoFailed(true)} />
            ) : (
              <View style={s.photoEmpty}>
                <AppIcon name="upload" size={24} color="#0D9488" strokeWidth={1.8} />
                <Text style={s.photoEmptyText}>Tap to add a clinic photo</Text>
              </View>
            )}
            {!!previewUri && (
              <View style={s.photoBadge}>
                <AppIcon name="pencil" size={13} color="#FFFFFF" strokeWidth={2.2} />
                <Text style={s.photoBadgeText}>Change Photo</Text>
              </View>
            )}
          </Pressable>
          <Text style={s.hint}>{photo ? 'New photo selected — it will replace the current one.' : 'JPG, PNG or WebP, up to 5 MB.'}</Text>
        </Section>

        <Section icon="briefcase" label="Clinic Details">
          <Field label="Clinic Name" value={name} onChangeText={setName} placeholder="Enter clinic name" />
          <View style={s.field}>
            <Text style={s.fieldLabel}>Phone Number</Text>
            <CountryPhoneInput value={phone} countryCode={phoneCountryCode} onChangePhoneNumber={setPhone} onChangeCountryCode={setPhoneCountryCode} onFocus={kbFocus} accentColor="#0D9488" />
          </View>
          <LocationPicker value={location} onChange={setLocation} label="Clinic Address" />
          {!!error && <Text translate={false} style={s.error}>{error}</Text>}
        </Section>
      </ScrollView>

      <View style={s.footer}>
        <Pressable onPress={onBack} style={s.cancelBtn} disabled={saving}>
          <Text style={s.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable onPress={handleSave} style={s.saveBtnWrap} disabled={saving}>
          <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.saveBtn}>
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.saveText}>Save Changes</Text>}
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

function Section({ icon, label, children }) {
  return (
    <View style={s.section}>
      <View style={s.sectionHeaderRow}>
        <AppIcon name={icon} size={15} color="#0D9488" strokeWidth={1.9} />
        <Text style={s.sectionLabel}>{label}</Text>
      </View>
      <View style={s.card}>{children}</View>
    </View>
  );
}

function Field({ label, value, onChangeText, placeholder, keyboardType, icon }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={s.fieldInputWrap}>
        {icon && <AppIcon name={icon} size={16} color="#7B8493" strokeWidth={1.8} />}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          keyboardType={keyboardType}
          style={s.fieldInput}
          placeholderTextColor="#94A3B8"
        />
      </View>
    </View>
  );
}

const s = createDoctorStyles({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { minHeight: 62, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#D8DFE9', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13, paddingVertical: 10 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F1F4F8', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  flex: { flex: 1 },
  title: { fontSize: 18, fontWeight: '800', color: '#0D9488' },
  subtitle: { fontSize: 12, color: '#667085', marginTop: 2 },
  content: { padding: 16, paddingBottom: 24 },
  section: { marginBottom: 18 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10, marginLeft: 2 },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: '#17243A' },
  card: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#C8D1DF', borderRadius: 14, padding: 14, shadowColor: '#17243A', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 },
  photoBox: { height: 170, borderRadius: 12, overflow: 'hidden', backgroundColor: '#F0FDFA', borderWidth: 1, borderColor: '#CCEFEA' },
  pressed: { opacity: 0.85 },
  photo: { width: '100%', height: '100%' },
  photoEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  photoEmptyText: { fontSize: 13.5, fontWeight: '700', color: '#0F766E' },
  photoBadge: { position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(15, 23, 42, 0.78)', borderRadius: 16, paddingHorizontal: 11, paddingVertical: 6 },
  photoBadgeText: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  hint: { fontSize: 12, color: '#667085', marginTop: 8 },
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 12.5, fontWeight: '700', color: '#344054', marginBottom: 6 },
  fieldInputWrap: { flexDirection: 'row', alignItems: 'center', minHeight: 44, borderWidth: 1, borderColor: '#D5DAE3', borderRadius: 10, paddingHorizontal: 12, gap: 8 },
  fieldInput: { flex: 1, fontSize: 13.5, color: '#17243A', paddingVertical: 0 },
  error: { fontSize: 13, color: '#DC2626', marginTop: 10 },
  footer: { flexDirection: 'row', gap: 10, padding: 16, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#D8DFE9' },
  cancelBtn: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#D5DAE3', alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 14.5, fontWeight: '700', color: '#344054' },
  saveBtnWrap: { flex: 1.4 },
  saveBtn: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 14.5, fontWeight: '700', color: '#FFF' },
});
