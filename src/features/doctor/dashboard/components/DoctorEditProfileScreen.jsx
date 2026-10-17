import React, { useContext, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image, Pressable, ScrollView, View } from 'react-native';
import Text from '../../../../components/TranslatedText';
import TextInput from '../../../../components/TranslatedTextInput';
import LinearGradient from 'react-native-linear-gradient';
import AppIcon from '../icons/AppIcon';
import { useToast } from '../../../../components/common/ToastProvider';
import { createDoctorStyles } from '../theme';
import { CLINICIAN_GRADIENT } from '../../../../theme/palette';
import { API_BASE_URL, TUNNEL_HEADERS } from '../../../../axiosConfig';
import { launchImageLibrary } from 'react-native-image-picker';
import LocationPicker from './LocationPicker';
import useKeyboardAwareScroll from '../../../../hooks/useKeyboardAwareScroll';

// Edge-to-edge Android doesn't shrink the window for the keyboard, so the
// form reserves the keyboard's height at the bottom and scrolls the focused
// field into view — every field (down to Location) stays reachable.
const KeyboardFocusContext = React.createContext(undefined);
const GENDER_OPTIONS = ['male', 'female', 'other'];

// Same values as Doctor Signup (stored lowercased in an array).
const CONSULTATION_MODES = [
  { value: 'online', label: 'Online', icon: 'video' },
  { value: 'offline', label: 'Offline', icon: 'home' },
  { value: 'both', label: 'Both', icon: 'globe' },
];

// The saved list as one choice: "both" when it says so, or names online and offline.
const toConsultationMode = (value) => {
  const list = (Array.isArray(value) ? value : String(value || '').split(','))
    .map((m) => String(m).trim().toLowerCase())
    .filter(Boolean);
  if (list.includes('both') || (list.includes('online') && list.includes('offline'))) return 'both';
  return list.find((m) => m === 'online' || m === 'offline') || '';
};

function toInitial(profile) {
  return {
    fullName: profile?.fullName || '',
    email: profile?.email || '',
    phoneNumber: profile?.phoneNumber || profile?.phoneNum || profile?.phone || '',
    age: profile?.age != null ? String(profile.age) : '',
    gender: String(profile?.gender || '').trim().toLowerCase(),
    qualification: profile?.qualification || '',
    experience: profile?.experience != null ? String(profile.experience) : '',
    languages: Array.isArray(profile?.languages) ? profile.languages.join(', ') : '',
    consultationMode: toConsultationMode(profile?.consultationMode ?? profile?.consultation_mode),
    summary: profile?.aboutMe || '',
    location: profile?.location || '',
  };
}

export default function DoctorEditProfileScreen({ profile, onBack, onSaved }) {
  const { showToast } = useToast();
  const {
    scrollRef,
    keyboardInset,
    scrollFocusedInputIntoView,
    handleKeyboardAwareScroll,
    handleKeyboardAwareScrollLayout,
  } = useKeyboardAwareScroll();
  const [form, setForm] = useState(() => toInitial(profile));
  const set = (key) => (value) => setForm((prev) => ({ ...prev, [key]: value }));
  const [specialization, setSpecialization] = useState(() =>
    Array.isArray(profile?.specialization) ? profile.specialization : [],
  );
  const [saving, setSaving] = useState(false);
  const [photo, setPhoto] = useState(null);

  const pickPhoto = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 1, quality: 0.8 });
    if (!result.didCancel && result.assets?.[0]) setPhoto(result.assets[0]);
  };

  const handleSave = async () => {
    if (!form.fullName.trim()) return showToast('Full name is required');
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      return showToast('Enter a valid email address');
    }
    if (form.phoneNumber.trim() && !/^\d{7,15}$/.test(form.phoneNumber.replace(/\D/g, ''))) {
      return showToast('Enter a valid phone number');
    }
    if (form.age.trim() && Number.isNaN(Number(form.age))) {
      return showToast('Age must be a number');
    }
    if (form.experience && Number.isNaN(Number(form.experience))) {
      return showToast('Experience must be a number');
    }
    try {
      setSaving(true);
      // Web: PATCH /auth/update/<profile _id from /auth/me>.
      const userId =
        profile?._id ||
        (await AsyncStorage.getItem('counsellorId')) ||
        (await AsyncStorage.getItem('counselorId')) ||
        (await AsyncStorage.getItem('userId'));
      const accessToken = (await AsyncStorage.getItem('accessToken')) || (await AsyncStorage.getItem('token'));
      if (!userId || !accessToken) throw new Error('Your session is incomplete. Please sign in again.');

      const formData = new FormData();
      formData.append('fullName', form.fullName.trim());
      if (form.email.trim()) formData.append('email', form.email.trim().toLowerCase());
      const phoneDigits = form.phoneNumber.replace(/\D/g, '');
      if (phoneDigits) {
        formData.append('phoneNumber', phoneDigits);
        formData.append('phoneNum', phoneDigits);
      }
      if (form.age.trim()) formData.append('age', String(Number(form.age)));
      if (form.gender) formData.append('gender', form.gender.toLowerCase());
      if (form.qualification.trim()) formData.append('qualification', form.qualification.trim());
      if (form.experience) formData.append('experience', String(Number(form.experience)));
      if (form.summary.trim()) formData.append('aboutMe', form.summary.trim());
      if (form.location.trim()) formData.append('location', form.location.trim());
      const languagesArr = form.languages
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
      if (languagesArr.length) formData.append('languages', JSON.stringify(languagesArr));
      if (form.consultationMode) formData.append('consultationMode', JSON.stringify([form.consultationMode]));
      if (specialization.length) formData.append('specialization', JSON.stringify(specialization));
      if (photo?.uri) {
        formData.append('profilePhoto', {
          uri: photo.uri,
          type: photo.type || 'image/jpeg',
          name: photo.fileName || `profile-${Date.now()}.jpg`,
        });
      }

      const result = await fetch(`${API_BASE_URL}/api/auth/update/${userId}`, {
        method: 'PATCH',
        headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${accessToken}` },
        body: formData,
      });
      const data = await result.json().catch(() => ({}));
      if (!result.ok) throw new Error(data?.message || 'Failed to update profile');

      showToast('Profile updated');
      onSaved ? onSaved() : onBack?.();
    } catch (error) {
      showToast(error?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable onPress={onBack} style={s.backButton} hitSlop={8}>
          <AppIcon name="chevron-left" size={22} color="#1F2937" strokeWidth={2.4} />
        </Pressable>
        <Text style={s.title}>Doctor Profile</Text>
        <Pressable onPress={handleSave} disabled={saving} hitSlop={8} style={{ marginRight: 14 }}>
          <Text style={s.saveLink}>{saving ? 'Saving…' : 'Save'}</Text>
        </Pressable>
        <Pressable onPress={onBack} disabled={saving} hitSlop={8}>
          <Text style={s.cancelLink}>Cancel</Text>
        </Pressable>
      </View>
      <KeyboardFocusContext.Provider value={scrollFocusedInputIntoView}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[s.content, { paddingBottom: 30 + keyboardInset }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={handleKeyboardAwareScroll}
        onLayout={handleKeyboardAwareScrollLayout}
        scrollEventThrottle={16}
      >

        <View style={s.profileCard}>
          <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.banner} />
          <View style={s.profileBody}>
            {photo?.uri || profile?.profilePhoto?.url ? (
              <Image source={{ uri: photo?.uri || profile.profilePhoto.url }} style={s.avatar} />
            ) : (
              <View style={[s.avatar, s.avatarPlaceholder]}><AppIcon name="user" size={34} color="#0D9488" /></View>
            )}
            <Pressable onPress={pickPhoto} style={s.avatarEdit}>
              <AppIcon name="camera" size={13} color="#FFF" strokeWidth={2} />
            </Pressable>
            <Text translate={false} style={s.name}>{form.fullName || 'Doctor'}</Text>
            <Text translate={false} style={s.role}>{form.qualification}</Text>
          </View>
        </View>

        <Section icon="user" label="Overview">
          <Field label="Full Name" value={form.fullName} onChangeText={set('fullName')} />
          <Field label="Email" value={form.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" />
          <Field label="Phone Number" value={form.phoneNumber} onChangeText={(value) => set('phoneNumber')(value.replace(/\D/g, '').slice(0, 15))} keyboardType="phone-pad" />
          <View style={s.field}>
            <Text style={s.fieldLabel}>Gender</Text>
            <View style={s.genderRow}>
              {GENDER_OPTIONS.map((item) => {
                const active = form.gender === item;
                return (
                  <Pressable
                    key={item}
                    onPress={() => set('gender')(item)}
                    style={[s.genderChip, active && s.genderChipActive]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                  >
                    {active && <AppIcon name="check-mark" size={14} color="#FFF" strokeWidth={2.6} />}
                    <Text style={[s.genderText, active && s.genderTextActive]}>{item.charAt(0).toUpperCase() + item.slice(1)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={s.fieldRow}>
            <Field label="Age" value={form.age} onChangeText={(value) => set('age')(value.replace(/\D/g, '').slice(0, 3))} keyboardType="number-pad" half />
            <Field label="Experience (Years)" value={form.experience} onChangeText={(value) => set('experience')(value.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" half />
          </View>
          <Field label="Qualification" value={form.qualification} onChangeText={set('qualification')} />
          <Field label="Languages" value={form.languages} onChangeText={set('languages')} />
          <View style={s.field}>
            <Text style={s.fieldLabel}>Consultation Mode</Text>
            <View style={s.genderRow}>
              {CONSULTATION_MODES.map((item) => {
                const active = form.consultationMode === item.value;
                return (
                  <Pressable
                    key={item.value}
                    onPress={() => set('consultationMode')(item.value)}
                    style={[s.genderChip, active && s.genderChipActive]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                  >
                    <AppIcon name={active ? 'check-mark' : item.icon} size={14} color={active ? '#FFF' : '#475467'} strokeWidth={active ? 2.6 : 2} />
                    <Text style={[s.genderText, active && s.genderTextActive]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Section>

        <Section icon="file" label="Professional Summary">
          <TextInput
            value={form.summary}
            onChangeText={set('summary')}
            multiline
            onFocus={scrollFocusedInputIntoView}
            style={s.summaryInput}
            placeholder="Write a short professional summary"
            placeholderTextColor="#94A3B8"
          />
        </Section>

        <Section icon="pulse" label="Specialization">
          <ChipEditor label="Specialization / Areas of Focus" items={specialization} onChange={setSpecialization} />
        </Section>

        <Section icon="pin" label="Location">
          <LocationPicker value={form.location} onChange={set('location')} />
        </Section>
      </ScrollView>
      </KeyboardFocusContext.Provider>
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

function Field({ label, value, onChangeText, half, keyboardType, autoCapitalize }) {
  const onFocus = useContext(KeyboardFocusContext);
  return (
    <View style={[s.field, half && s.fieldHalf]}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={s.fieldInput}
        placeholderTextColor="#94A3B8"
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        onFocus={onFocus}
      />
    </View>
  );
}

function ChipEditor({ label, items, onChange, muted, style }) {
  const onInputFocus = useContext(KeyboardFocusContext);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  const remove = (item) => onChange(items.filter((i) => i !== item));
  const confirmAdd = () => {
    const value = draft.trim();
    if (value) onChange([...items, value]);
    setDraft('');
    setAdding(false);
  };

  return (
    <View style={style}>
      <Text style={s.subLabel}>{label}</Text>
      <View style={s.chipsRow}>
        {items.map((item) => (
          <View key={item} style={muted ? s.chipMuted : s.chip}>
            <Text style={muted ? s.chipMutedText : s.chipText}>{item}</Text>
            <Pressable onPress={() => remove(item)} hitSlop={6}>
              <AppIcon name="x" size={11} color={muted ? '#526078' : '#0D9488'} strokeWidth={2.6} />
            </Pressable>
          </View>
        ))}
        {!adding && (
          <Pressable onPress={() => setAdding(true)} style={s.addChip}>
            <AppIcon name="plus" size={12} color="#0D9488" strokeWidth={2.4} />
            <Text style={s.addChipText}>ADD</Text>
          </Pressable>
        )}
      </View>
      {adding && (
        <View style={s.addRow}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Type and confirm"
            onFocus={onInputFocus}
            placeholderTextColor="#94A3B8"
            style={s.addInput}
            autoFocus
            onSubmitEditing={confirmAdd}
          />
          <Pressable onPress={confirmAdd} style={s.addConfirm}>
            <AppIcon name="check-mark" size={14} color="#FFF" strokeWidth={2.6} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = createDoctorStyles({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  header: { height: 62, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#D8DFE9', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 13 },
  backButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F1F4F8', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  title: { flex: 1, fontSize: 17, fontWeight: '800', color: '#0D9488' },
  saveLink: { fontSize: 14, fontWeight: '800', color: '#0D9488' },
  cancelLink: { fontSize: 14, fontWeight: '600', color: '#8A94A4' },
  content: { padding: 16, paddingBottom: 30 },

  profileCard: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#C8D1DF', borderRadius: 14, overflow: 'hidden', marginBottom: 18, shadowColor: '#17243A', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 },
  banner: { height: 64 },
  profileBody: { alignItems: 'center', paddingHorizontal: 16, paddingBottom: 18, marginTop: -34 },
  avatar: { width: 74, height: 74, borderRadius: 37, borderWidth: 3, borderColor: '#FFF', backgroundColor: '#DCFCFF' },
  avatarPlaceholder: { backgroundColor: '#E6FBF8', alignItems: 'center', justifyContent: 'center' },
  avatarEdit: { position: 'absolute', top: 60, left: '50%', marginLeft: 18, width: 26, height: 26, borderRadius: 13, backgroundColor: '#0D9488', borderWidth: 2, borderColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 17, fontWeight: '800', color: '#17243A', marginTop: 10 },
  role: { fontSize: 12.5, color: '#667085', marginTop: 2 },
  pillRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  darkPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#17243A', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  darkPillText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  lightPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F0FDFA', borderWidth: 1, borderColor: '#B7ECE7', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  lightPillDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#16A36A' },
  lightPillText: { fontSize: 12, fontWeight: '700', color: '#0D9488' },

  section: { marginBottom: 18 },
  sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10, marginLeft: 2 },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: '#17243A' },
  card: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#C8D1DF', borderRadius: 14, padding: 14, shadowColor: '#17243A', shadowOpacity: 0.05, shadowRadius: 6, elevation: 1 },

  field: { marginBottom: 14 },
  fieldHalf: { flex: 1 },
  fieldRow: { flexDirection: 'row', gap: 10 },
  fieldLabel: { fontSize: 12.5, fontWeight: '700', color: '#344054', marginBottom: 6 },
  fieldInput: { height: 44, borderWidth: 1, borderColor: '#D5DAE3', borderRadius: 10, paddingHorizontal: 12, fontSize: 13.5, color: '#17243A' },
  genderRow: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 12, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  genderChip: { flex: 1, height: 40, borderRadius: 9, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  genderChipActive: { backgroundColor: '#0D9488' },
  genderText: { fontSize: 14, fontWeight: '700', color: '#475467' },
  genderTextActive: { color: '#FFF' },

  summaryInput: { minHeight: 90, borderWidth: 1, borderColor: '#D5DAE3', borderRadius: 10, padding: 12, fontSize: 13.5, lineHeight: 19, color: '#17243A', textAlignVertical: 'top' },

  subLabel: { fontSize: 12.5, fontWeight: '700', color: '#344054', marginBottom: 8 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#B7ECE7', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#F0FDFA' },
  chipText: { fontSize: 11.5, fontWeight: '700', color: '#0D9488' },
  chipMuted: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#E3E7EE', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#F8FAFD' },
  chipMutedText: { fontSize: 11.5, fontWeight: '700', color: '#526078' },
  addChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#B7ECE7', borderStyle: 'dashed', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  addChipText: { fontSize: 11, fontWeight: '800', color: '#0D9488', letterSpacing: 0.3 },
  addRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  addInput: { flex: 1, height: 38, borderWidth: 1, borderColor: '#D5DAE3', borderRadius: 9, paddingHorizontal: 10, fontSize: 13, color: '#17243A' },
  addConfirm: { width: 38, height: 38, borderRadius: 9, backgroundColor: '#0D9488', alignItems: 'center', justifyContent: 'center' },


  feeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EEF1F5', gap: 10 },
  feeInfo: { flex: 1 },
  feeTitle: { fontSize: 13.5, fontWeight: '700', color: '#17243A' },
  feeSubtitle: { fontSize: 11.5, color: '#667085', marginTop: 2 },
  availableBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  availableLabel: { fontSize: 12, fontWeight: '600', color: '#667085' },
  feeInputWrap: { flexDirection: 'row', alignItems: 'center', height: 40, borderWidth: 1, borderColor: '#D5DAE3', borderRadius: 9, paddingHorizontal: 10, gap: 4, width: 100 },
  feeCurrency: { fontSize: 13.5, color: '#667085' },
  feeInput: { flex: 1, fontSize: 13.5, color: '#17243A' },
});
