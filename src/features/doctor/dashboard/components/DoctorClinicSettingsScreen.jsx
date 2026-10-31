// Clinic settings — port of the web Setting/ClinicSetting/ClinicUpload.jsx:
// POST /api/clinics (multipart: doctor_id, clinic_name, phone_number, location,
// fee?, clinic_photo[]) plus the doctor's existing clinics from
// GET /api/clinics?doctor_id&role=doctor.
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, View } from 'react-native';
import Text from '../../../../components/TranslatedText';
import TextInput from '../../../../components/TranslatedTextInput';
import { launchImageLibrary } from 'react-native-image-picker';
import LinearGradient from 'react-native-linear-gradient';
import AppIcon from '../icons/AppIcon';
import { useToast } from '../../../../components/common/ToastProvider';
import { createDoctorStyles } from '../theme';
import { CLINICIAN_GRADIENT } from '../../../../theme/palette';
import axiosInstance from '../../../../axiosConfig';
import { getStoredDoctorUser, pickFirst } from '../api/doctorAppointments';
import { appendClinicFee, clinicFeeOf, clinicPhotoUrl, loadDoctorClinics } from '../api/doctorClinics';
import useKeyboardAwareScroll from '../../../../hooks/useKeyboardAwareScroll';
import useKeyboardLift from '../../../../hooks/useKeyboardLift';
import { useDoctorBack } from '../useDoctorBack';
import EditClinicScreen from './EditClinicScreen';
import ClinicFeeField, { cleanClinicFee, isValidClinicFee } from './ClinicFeeField';
import CountryPhoneInput from '../../../../components/common/CountryPhoneInput';
import { buildInternationalPhoneNumber, isValidLocalPhoneNumber, phoneNumberError } from '../../../../utils/countryCodes';
import { DEFAULT_COUNTRY, findCountry, formatFee } from '../../../../utils/consultationCurrency';
import { feeCurrencyNeedsSave, loadDoctorFeeCurrency, saveDoctorFeeCurrency } from '../api/doctorFeeCurrency';

// Express error pages come back as HTML strings, not JSON — read either.
const getApiErrorText = (err, fallback) => {
  const data = err?.response?.data;
  if (typeof data === 'string') {
    const match = data.match(/Error:\s*([^<\n]+)/);
    return match ? match[1].trim() : fallback;
  }
  return data?.message || data?.error || err?.message || fallback;
};

// multer's "Unexpected field" (wrong field name or more files than allowed),
// also seen wrapped as "Unexpected file field: clinic_photo".
const isUnexpectedFileFieldError = (err) =>
  /Unexpected (file )?field|LIMIT_UNEXPECTED_FILE/i.test(getApiErrorText(err, ''));

export default function DoctorClinicSettingsScreen({ onBack }) {
  // The window does not resize for the keyboard (edge-to-edge), so while it is
  // open the screen is shortened to end at its top edge: the Save Clinic
  // footer stays visible above the keyboard and the form scrolls in the space
  // left, with the focused field scrolled into view.
  const {
    scrollRef: kbScrollRef,
    keyboardOpen,
    keyboardTop,
    scrollFocusedInputIntoView: kbFocus,
    handleKeyboardAwareScroll: kbOnScroll,
    handleKeyboardAwareScrollLayout: kbOnLayout,
  } = useKeyboardAwareScroll({ layoutAvoidsKeyboard: true });
  const [screenRef, keyboardLift] = useKeyboardLift(keyboardOpen, keyboardTop);
  const { showToast } = useToast();
  const [doctorId, setDoctorId] = useState('');
  // The doctor's fee currency as loaded, and the country picked here.
  const [feeState, setFeeState] = useState(null);
  const [feeCountry, setFeeCountry] = useState(DEFAULT_COUNTRY);
  const [clinics, setClinics] = useState([]);
  const [loadingClinics, setLoadingClinics] = useState(true);
  const [clinicName, setClinicName] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneCountryCode, setPhoneCountryCode] = useState('+91');
  const [address, setAddress] = useState('');
  const [fee, setFee] = useState('');
  const [photos, setPhotos] = useState([]);
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');
  const [clinicsOpen, setClinicsOpen] = useState(false);
  // The clinic whose edit button was tapped (opens Edit Clinic).
  const [editingClinic, setEditingClinic] = useState(null);
  const [failedThumbs, setFailedThumbs] = useState({});

  useEffect(() => {
    getStoredDoctorUser().then((user) => {
      const id = pickFirst(user?.id, user?.user_id, user?.doctor_id, user?._id, user?.userId, user?.doctorId, '');
      setDoctorId(id ? String(id) : '');
      if (!id) setLoadingClinics(false);
    });
    loadDoctorFeeCurrency().then((loaded) => {
      setFeeState(loaded);
      setFeeCountry(loaded.country);
    });
  }, []);
  // Every clinic charges in the doctor's one currency: the saved one for the
  // list, the one picked in the form for a new clinic.
  const currency = findCountry(feeCountry)?.currency || 'INR';
  const listCurrency = feeState?.savedCurrency || currency;

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
    setPhoneCountryCode('+91');
    setAddress('');
    setFee('');
    setPhotos([]);
  };

  const handleSave = async () => {
    const missing = [];
    if (!clinicName.trim()) missing.push('Clinic Name');
    if (!phone.trim()) missing.push('Phone');
    if (!address.trim()) missing.push('Address');
    if (fee === '') missing.push('Consultation Fee');
    if (!doctorId) missing.push('Doctor ID (not logged in)');
    if (missing.length) {
      setStatus('failed');
      setMessage(`Missing: ${missing.join(', ')}`);
      return;
    }
    if (!isValidLocalPhoneNumber(phone, phoneCountryCode)) {
      setStatus('failed');
      setMessage(phoneNumberError(phone, phoneCountryCode, { mobile: false }));
      return;
    }
    if (!isValidClinicFee(fee, currency)) {
      setStatus('failed');
      setMessage(`Enter a valid consultation fee in ${currency}`);
      return;
    }
    const buildFormData = (photoList) => {
      const formData = new FormData();
      formData.append('doctor_id', doctorId);
      formData.append('clinic_name', clinicName.trim());
      formData.append('phone_number', buildInternationalPhoneNumber(phoneCountryCode, phone));
      formData.append('location', address.trim());
      appendClinicFee(formData, fee);
      photoList.forEach((photo, index) => {
        const type = photo.type || 'image/jpeg';
        const ext = (type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
        formData.append('clinic_photo', {
          uri: photo.uri,
          type,
          name: photo.fileName || `clinic-${Date.now()}-${index}.${ext}`,
        });
      });
      return formData;
    };
    const post = (formData) =>
      axiosInstance.post('/api/clinics', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        // Send the FormData as-is: axios must not serialise it, and uploads
        // need longer than the default timeout on slow networks.
        transformRequest: (data) => data,
        timeout: 60000,
      });

    // Try all photos, then only the first one (a server that accepts a
    // single `clinic_photo` rejects extra files with "Unexpected field"),
    // and only then save the clinic without photos.
    const attempts = [photos, photos.slice(0, 1), []]
      .filter((list, index, all) => index === 0 || list.length !== all[index - 1].length);

    try {
      setStatus('loading');
      // A new (or mismatched) currency is saved on the doctor first.
      if (feeCurrencyNeedsSave(feeState, feeCountry)) {
        setMessage('Saving fee currency...');
        const savedCurrency = await saveDoctorFeeCurrency(feeState.user, feeCountry);
        setFeeState((prev) => ({ ...prev, country: feeCountry, currency, savedCurrency }));
      }
      setMessage(photos.length ? 'Uploading clinic and photos...' : 'Creating clinic...');
      let uploadedCount = 0;
      let created = null;
      for (let i = 0; i < attempts.length; i += 1) {
        try {
          const response = await post(buildFormData(attempts[i]));
          created = response.data?.clinic || response.data?.data?.clinic || response.data?.data || null;
          uploadedCount = attempts[i].length;
          break;
        } catch (err) {
          console.warn('[clinic-upload] attempt failed', JSON.stringify({
            photos: attempts[i].length,
            status: err?.response?.status,
            error: getApiErrorText(err, err?.message || 'unknown'),
          }));
          const canRetryWithFewer = i < attempts.length - 1 && isUnexpectedFileFieldError(err);
          if (!canRetryWithFewer) throw err;
        }
      }
      // The server drops fields it doesn't store and still answers 200, so
      // check the new clinic really carries the fee that was sent.
      const feeDropped = !!created && typeof created === 'object' && clinicFeeOf(created) !== Number(fee);
      setStatus('succeeded');
      setMessage([
        uploadedCount === photos.length
          ? 'Clinic created successfully.'
          : uploadedCount > 0
            ? `Clinic created with ${uploadedCount} photo — the server accepts only one clinic photo.`
            : 'Clinic created, but photos were not uploaded — the server did not accept the photo.',
        feeDropped ? 'The server did not save the clinic fee. Fee support is needed on the backend.' : '',
      ].filter(Boolean).join(' '));
      showToast('Clinic created');
      reset();
      refreshClinics();
    } catch (err) {
      setStatus('failed');
      setMessage(getApiErrorText(err, 'Failed to create clinic.'));
    }
  };

  useDoctorBack(() => {
    if (!editingClinic) return false;
    setEditingClinic(null);
    return true;
  });

  if (editingClinic) {
    return (
      <EditClinicScreen
        clinic={editingClinic}
        onBack={() => setEditingClinic(null)}
        onSaved={() => {
          setEditingClinic(null);
          refreshClinics();
        }}
      />
    );
  }

  return (
    <View ref={screenRef} collapsable={false} style={[s.screen, keyboardLift > 0 && { paddingBottom: keyboardLift }]}>
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backButton} hitSlop={8}>
          <AppIcon name="chevron-left" size={22} color="#1F2937" strokeWidth={2.4} />
        </Pressable>
        <View style={s.flex}>
          <Text style={s.title}>Clinic Settings</Text>
          <Text style={s.subtitle}>Add clinic contact information, location and photos</Text>
        </View>
      </View>
      <ScrollView  showsVerticalScrollIndicator={false} ref={kbScrollRef} contentContainerStyle={s.content} onScroll={kbOnScroll} onLayout={kbOnLayout} onFocusCapture={kbFocus} scrollEventThrottle={16} keyboardShouldPersistTaps="handled">
        {/* Saved clinics as a dropdown: collapsed it's one line with the
            count, so the Add Clinic form below is what the screen leads with. */}
        <View style={s.section}>
          <Pressable
            onPress={() => setClinicsOpen((open) => !open)}
            style={({ pressed }) => [s.dropdownHead, clinicsOpen && s.dropdownHeadOpen, pressed && s.dropdownPressed]}
            accessibilityRole="button"
            accessibilityState={{ expanded: clinicsOpen }}
          >
            <View style={s.dropdownIcon}><AppIcon name="briefcase" size={16} color="#0D9488" strokeWidth={1.9} /></View>
            <View style={s.flex}>
              <Text style={s.dropdownTitle}>Your Clinics</Text>
              <Text translate={false} style={s.dropdownSub} numberOfLines={1}>
                {loadingClinics ? 'Loading…' : clinics.length ? clinics.map((c) => c.name).join(', ') : 'No clinics added yet'}
              </Text>
            </View>
            {!loadingClinics && clinics.length > 0 && (
              <View style={s.countPill}><Text style={s.countPillText}>{clinics.length}</Text></View>
            )}
            <View style={clinicsOpen && s.chevronUp}>
              <AppIcon name="chevron-down" size={16} color="#475467" strokeWidth={2.4} />
            </View>
          </Pressable>
          {clinicsOpen && (
            <View style={s.dropdownBody}>
              {loadingClinics ? (
                <ActivityIndicator color="#0D9488" />
              ) : clinics.length === 0 ? (
                <Text style={s.hint}>No clinics added yet.</Text>
              ) : (
                // Deleting a clinic is done from Clinic Profile (the trash icon on
                // the clinic photo) only; here each clinic can be edited.
                clinics.map((clinic, index) => {
                  const photoUrl = clinicPhotoUrl(typeof clinic.photo === 'string' ? clinic.photo : '');
                  const showPhoto = !!photoUrl && !failedThumbs[clinic.id];
                  return (
                    <View key={clinic.id} style={[s.clinicItem, index === clinics.length - 1 && s.clinicRowLast]}>
                      <View style={s.clinicRow}>
                        {showPhoto ? (
                          <Image
                            source={{ uri: photoUrl }}
                            style={s.logoThumb}
                            onError={() => setFailedThumbs((prev) => ({ ...prev, [clinic.id]: true }))}
                          />
                        ) : (
                          <View style={s.logoThumb}><AppIcon name="briefcase" size={18} color="#0D9488" strokeWidth={1.8} /></View>
                        )}
                        <View style={s.flex}>
                          <Text translate={false} style={s.clinicName}>{clinic.name}</Text>
                          <Text translate={false} style={s.hint}>{clinic.location}{clinic.phone ? ` • ${clinic.phone}` : ''}</Text>
                          <View style={s.clinicFeeRow}>
                            <Text style={s.hint}>Fee:</Text>
                            {clinic.fee != null ? (
                              <Text translate={false} style={s.clinicFee}>{formatFee(clinic.fee, listCurrency)}</Text>
                            ) : (
                              <Text style={s.clinicFeeMissing}>Not set — tap Edit</Text>
                            )}
                          </View>
                        </View>
                        <Pressable
                          onPress={() => setEditingClinic({
                            id: clinic.deleteId || clinic.id,
                            name: clinic.name,
                            phone: clinic.phone,
                            location: clinic.location,
                            photoUrl: showPhoto ? photoUrl : '',
                            fee: clinic.fee,
                          })}
                          style={({ pressed }) => [s.editBtn, pressed && s.editBtnPressed]}
                          hitSlop={6}
                          accessibilityRole="button"
                          accessibilityLabel={`Edit ${clinic.name}`}
                        >
                          <AppIcon name="pencil" size={14} color="#0D9488" strokeWidth={2.2} />
                          <Text style={s.editBtnText}>Edit</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          )}
        </View>

        <Section icon="plus" label="Add Clinic">
          <Field label="Clinic Name" value={clinicName} onChangeText={setClinicName} placeholder="Enter clinic name" />
          <View style={s.field}>
            <Text style={s.fieldLabel}>Phone Number</Text>
            <CountryPhoneInput mobile={false} value={phone} countryCode={phoneCountryCode} onChangePhoneNumber={setPhone} onChangeCountryCode={setPhoneCountryCode} onFocus={kbFocus} accentColor="#0D9488" />
          </View>
          <Field label="Address" value={address} onChangeText={setAddress} placeholder="Enter clinic address" icon="pin" multiline />

          <View style={[s.field, s.feeBox]}>
            <ClinicFeeField
              value={fee}
              onChangeText={(value) => setFee(cleanClinicFee(value, currency))}
              currency={currency}
              onFocus={kbFocus}
              country={feeCountry}
              onCountryChange={setFeeCountry}
              savedCurrency={feeState?.savedCurrency}
            />
          </View>

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
            <Text translate={false} style={[s.message, status === 'failed' && s.messageError, status === 'succeeded' && s.messageOk]}>{message}</Text>
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
  dropdownHead: { flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#C8D1DF', borderRadius: 14, paddingHorizontal: 13, paddingVertical: 11, shadowColor: '#17243A', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 },
  dropdownHeadOpen: { borderColor: '#5EC9BC', borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
  dropdownPressed: { backgroundColor: '#F6FBFA' },
  dropdownIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: '#E6F7F5', alignItems: 'center', justifyContent: 'center' },
  dropdownTitle: { fontSize: 14.5, fontWeight: '800', color: '#17243A' },
  dropdownSub: { fontSize: 12, color: '#667085', marginTop: 1 },
  countPill: { minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 7, backgroundColor: '#CCFBF1', alignItems: 'center', justifyContent: 'center' },
  countPillText: { fontSize: 12, fontWeight: '800', color: '#0F766E' },
  chevronUp: { transform: [{ rotate: '180deg' }] },
  dropdownBody: { backgroundColor: '#FFF', borderWidth: 1, borderTopWidth: 0, borderColor: '#5EC9BC', borderBottomLeftRadius: 14, borderBottomRightRadius: 14, paddingHorizontal: 14, paddingVertical: 4 },
  clinicItem: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EEF1F5' },
  clinicRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  clinicRowLast: { borderBottomWidth: 0 },
  clinicName: { fontSize: 15, fontWeight: '800', color: '#17243A' },
  hint: { fontSize: 12.5, color: '#667085' },
  clinicFeeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  clinicFee: { fontSize: 12.5, fontWeight: '800', color: '#0F766E' },
  clinicFeeMissing: { fontSize: 12.5, fontWeight: '700', color: '#B45309' },
  feeBox: { borderWidth: 1, borderColor: '#D5DAE3', borderRadius: 10, padding: 12 },
  logoThumb: { width: 44, height: 44, borderRadius: 10, backgroundColor: '#F0FDFA', alignItems: 'center', justifyContent: 'center' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, height: 32, paddingHorizontal: 11, borderRadius: 16, borderWidth: 1, borderColor: '#B7ECE7', backgroundColor: '#F0FDFA' },
  editBtnPressed: { backgroundColor: '#CCFBF1' },
  editBtnText: { fontSize: 12.5, fontWeight: '800', color: '#0D9488' },
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
