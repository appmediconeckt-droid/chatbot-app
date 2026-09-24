// Clinic settings — port of the web Setting/ClinicSetting/ClinicUpload.jsx:
// POST /api/clinics (multipart: doctor_id, clinic_name, phone_number, location,
// clinic_photo[]) plus the doctor's existing clinics from
// GET /api/clinics?doctor_id&role=doctor.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { launchImageLibrary } from 'react-native-image-picker';
import LinearGradient from 'react-native-linear-gradient';
import AppIcon from '../icons/AppIcon';
import { useToast } from '../../../../components/common/ToastProvider';
import { createDoctorStyles } from '../theme';
import { CLINICIAN_GRADIENT } from '../../../../theme/palette';
import axiosInstance from '../../../../axiosConfig';
import { getStoredDoctorUser, pickFirst } from '../api/doctorAppointments';
import { loadDoctorClinics } from '../api/doctorClinics';

// Express error pages come back as HTML strings, not JSON — read either.
const getApiErrorText = (err, fallback) => {
  const data = err?.response?.data;
  if (typeof data === 'string') {
    const match = data.match(/Error:\s*([^<\n]+)/);
    return match ? match[1].trim() : fallback;
  }
  return data?.message || data?.error || err?.message || fallback;
};

const isUnexpectedFileFieldError = (err) =>
  /Unexpected file field/i.test(getApiErrorText(err, ''));

export default function DoctorClinicSettingsScreen({ onBack }) {
  const { showToast } = useToast();
  const [doctorId, setDoctorId] = useState('');
  const [clinics, setClinics] = useState([]);
  const [loadingClinics, setLoadingClinics] = useState(true);
  const [clinicName, setClinicName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [photos, setPhotos] = useState([]);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    getStoredDoctorUser().then((user) => {
      const id = pickFirst(user?.id, user?.user_id, user?.doctor_id, user?._id, user?.userId, user?.doctorId, '');
      setDoctorId(id ? String(id) : '');
      if (!id) setLoadingClinics(false);
    });
  }, []);

  const refreshClinics = useCallback(async () => {
    if (!doctorId) return;
    try {
      setLoadingClinics(true);
      setClinics(await loadDoctorClinics(doctorId));
    } catch (err) {
      console.warn('Failed to load clinics:', err?.message);
    } finally {
      setLoadingClinics(false);
    }
  }, [doctorId]);

  useEffect(() => { refreshClinics(); }, [refreshClinics]);

  const pickPhotos = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 0, quality: 0.8 });
    if (result.didCancel || !result.assets?.length) return;
    setPhotos(result.assets);
  };

  const reset = () => {
    setClinicName('');
    setPhone('');
    setAddress('');
    setPhotos([]);
  };

  const handleSave = async () => {
    const missing = [];
    if (!clinicName.trim()) missing.push('Clinic Name');
    if (!phone.trim()) missing.push('Phone');
    if (!address.trim()) missing.push('Address');
    if (!doctorId) missing.push('Doctor ID (not logged in)');
    if (missing.length) {
      setStatus('failed');
      setMessage(`Missing: ${missing.join(', ')}`);
      return;
    }
    const buildFormData = (withPhotos) => {
      const formData = new FormData();
      formData.append('doctor_id', doctorId);
      formData.append('clinic_name', clinicName.trim());
      formData.append('phone_number', phone.trim());
      formData.append('location', address.trim());
      if (withPhotos) {
        photos.forEach((photo, index) => {
          formData.append('clinic_photo', {
            uri: photo.uri,
            type: photo.type || 'image/jpeg',
            name: photo.fileName || `clinic-${Date.now()}-${index}.jpg`,
          });
        });
      }
      return formData;
    };
    const post = (formData) =>
      axiosInstance.post('/api/clinics', formData, { headers: { 'Content-Type': 'multipart/form-data' } });

    try {
      setStatus('loading');
      setMessage('Creating clinic...');
      let photosSkipped = false;
      try {
        await post(buildFormData(photos.length > 0));
      } catch (err) {
        // Backends without the clinic upload handler (multerConfig
        // handleClinicUpload) reject the `clinic_photo` file field with a 500
        // HTML page ("Unexpected file field: clinic_photo"). Save the clinic
        // without photos instead of failing the whole request.
        if (photos.length > 0 && isUnexpectedFileFieldError(err)) {
          await post(buildFormData(false));
          photosSkipped = true;
        } else {
          throw err;
        }
      }
      setStatus('succeeded');
      setMessage(photosSkipped
        ? 'Clinic created, but photos were not uploaded — the server does not accept clinic photos yet.'
        : 'Clinic created successfully.');
      showToast('Clinic created');
      reset();
      refreshClinics();
    } catch (err) {
      setStatus('failed');
      setMessage(getApiErrorText(err, 'Failed to create clinic.'));
    }
  };

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backButton} hitSlop={8}>
          <AppIcon name="chevron-left" size={22} color="#1F2937" strokeWidth={2.4} />
        </Pressable>
        <View style={s.flex}>
          <Text style={s.title}>Clinic Settings</Text>
          <Text style={s.subtitle}>Add clinic contact information, location and photos</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Section icon="briefcase" label="Your Clinics">
          {loadingClinics ? (
            <ActivityIndicator color="#0D9488" />
          ) : clinics.length === 0 ? (
            <Text style={s.hint}>No clinics added yet.</Text>
          ) : (
            clinics.map((clinic, index) => (
              <View key={clinic.id} style={[s.clinicRow, index === clinics.length - 1 && s.clinicRowLast]}>
                <View style={s.logoThumb}><AppIcon name="briefcase" size={18} color="#0D9488" strokeWidth={1.8} /></View>
                <View style={s.flex}>
                  <Text style={s.clinicName}>{clinic.name}</Text>
                  <Text style={s.hint}>{clinic.location}{clinic.phone ? ` • ${clinic.phone}` : ''}</Text>
                </View>
              </View>
            ))
          )}
        </Section>

        <Section icon="plus" label="Add Clinic">
          <Field label="Clinic Name" value={clinicName} onChangeText={setClinicName} placeholder="Enter clinic name" />
          <Field label="Phone Number" value={phone} onChangeText={setPhone} placeholder="Enter phone number" keyboardType="phone-pad" icon="phone" />
          <Field label="Address" value={address} onChangeText={setAddress} placeholder="Enter clinic address" icon="pin" multiline />

          <Text style={s.fieldLabel}>Clinic Photos</Text>
          <Pressable onPress={pickPhotos} style={s.uploadBox}>
            <AppIcon name="upload" size={22} color="#0D9488" strokeWidth={1.8} />
            <Text style={s.uploadTitle}>{photos.length ? `${photos.length} photo(s) selected` : 'Tap to choose photos'}</Text>
            <Text style={s.uploadHint}>You can select multiple images</Text>
          </Pressable>
          {photos.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.previews}>
              {photos.map((photo) => (
                <Image key={photo.uri} source={{ uri: photo.uri }} style={s.preview} />
              ))}
            </ScrollView>
          )}
          {!!message && (
            <Text style={[s.message, status === 'failed' && s.messageError, status === 'succeeded' && s.messageOk]}>{message}</Text>
          )}
        </Section>
      </ScrollView>

      <View style={s.footer}>
        <Pressable onPress={reset} style={s.discardBtn}>
          <Text style={s.discardText}>Reset</Text>
        </Pressable>
        <Pressable onPress={handleSave} style={s.saveBtnWrap} disabled={status === 'loading'}>
          <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.saveBtn}>
            <Text style={s.saveText}>{status === 'loading' ? 'Saving...' : 'Save Clinic'}</Text>
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

function Field({ label, value, onChangeText, placeholder, keyboardType, icon, multiline }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={[s.fieldInputWrap, multiline && s.fieldInputMulti]}>
        {icon && <AppIcon name={icon} size={16} color="#7B8493" strokeWidth={1.8} />}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          keyboardType={keyboardType}
          multiline={multiline}
          style={s.fieldInput}
          placeholderTextColor="#94A3B8"
        />
      </View>
    </View>
  );
}

const s = createDoctorStyles({
  screen: { flex: 1, backgroundColor: '#F0FDFA' },
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
  clinicRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EEF1F5' },
  clinicRowLast: { borderBottomWidth: 0 },
  clinicName: { fontSize: 15, fontWeight: '800', color: '#17243A' },
  hint: { fontSize: 12.5, color: '#667085' },
  logoThumb: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#F0FDFA', alignItems: 'center', justifyContent: 'center' },
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 12.5, fontWeight: '700', color: '#344054', marginBottom: 6 },
  fieldInputWrap: { flexDirection: 'row', alignItems: 'center', minHeight: 44, borderWidth: 1, borderColor: '#D5DAE3', borderRadius: 10, paddingHorizontal: 12, gap: 8 },
  fieldInputMulti: { alignItems: 'flex-start', paddingVertical: 8, minHeight: 72 },
  fieldInput: { flex: 1, fontSize: 13.5, color: '#17243A', paddingVertical: 0 },
  uploadBox: { borderWidth: 1.5, borderColor: '#C8D1DF', borderStyle: 'dashed', borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingVertical: 22, gap: 6 },
  uploadTitle: { fontSize: 13.5, fontWeight: '700', color: '#344054' },
  uploadHint: { fontSize: 11.5, color: '#94A3B8' },
  previews: { gap: 8, paddingTop: 10 },
  preview: { width: 72, height: 72, borderRadius: 8 },
  message: { fontSize: 13, color: '#344054', marginTop: 12 },
  messageError: { color: '#DC2626' },
  messageOk: { color: '#16A36A' },
  footer: { flexDirection: 'row', gap: 10, padding: 16, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#D8DFE9' },
  discardBtn: { flex: 1, height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#D5DAE3', alignItems: 'center', justifyContent: 'center' },
  discardText: { fontSize: 14.5, fontWeight: '700', color: '#344054' },
  saveBtnWrap: { flex: 1.4 },
  saveBtn: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 14.5, fontWeight: '700', color: '#FFF' },
});
