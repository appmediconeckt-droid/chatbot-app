import React, { useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AppIcon from '../icons/AppIcon';
import { useToast } from '../../../../components/common/ToastProvider';
import { createDoctorStyles } from '../theme';
import { CLINICIAN_GRADIENT } from '../../../../theme/palette';
import { API_BASE_URL } from '../../../../axiosConfig';
import { launchImageLibrary } from 'react-native-image-picker';

function toInitial(profile) {
  return {
    fullName: profile?.fullName || '',
    qualification: profile?.qualification || '',
    experience: profile?.experience != null ? String(profile.experience) : '',
    languages: Array.isArray(profile?.languages) ? profile.languages.join(', ') : '',
    summary: profile?.aboutMe || '',
    location: profile?.location || '',
  };
}

export default function DoctorEditProfileScreen({ profile, onBack, onSaved }) {
  const { showToast } = useToast();
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
      if (form.qualification.trim()) formData.append('qualification', form.qualification.trim());
      if (form.experience) formData.append('experience', String(Number(form.experience)));
      if (form.summary.trim()) formData.append('aboutMe', form.summary.trim());
      if (form.location.trim()) formData.append('location', form.location.trim());
      const languagesArr = form.languages
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
      if (languagesArr.length) formData.append('languages', JSON.stringify(languagesArr));
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
        headers: { Authorization: `Bearer ${accessToken}` },
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
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

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
            <Text style={s.name}>{form.fullName || 'Doctor'}</Text>
            <Text style={s.role}>{form.qualification}</Text>
          </View>
        </View>

        <Section icon="user" label="Overview">
          <Field label="Full Name" value={form.fullName} onChangeText={set('fullName')} />
          <Field label="Qualification" value={form.qualification} onChangeText={set('qualification')} />
          <View style={s.fieldRow}>
            <Field label="Experience (Years)" value={form.experience} onChangeText={set('experience')} keyboardType="numeric" half />
            <Field label="Languages" value={form.languages} onChangeText={set('languages')} half />
          </View>
        </Section>

        <Section icon="file" label="Professional Summary">
          <TextInput
            value={form.summary}
            onChangeText={set('summary')}
            multiline
            style={s.summaryInput}
            placeholder="Write a short professional summary"
            placeholderTextColor="#94A3B8"
          />
        </Section>

        <Section icon="pulse" label="Specialization">
          <ChipEditor label="Specialization / Areas of Focus" items={specialization} onChange={setSpecialization} />
        </Section>

        <Section icon="pin" label="Location">
          <Field label="Location / Address" value={form.location} onChangeText={set('location')} />
          <View style={s.mapPreview}>
            <AppIcon name="pin" size={22} color="#0D9488" strokeWidth={2} />
          </View>
        </Section>
      </ScrollView>
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

function Field({ label, value, onChangeText, half, keyboardType }) {
  return (
    <View style={[s.field, half && s.fieldHalf]}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        style={s.fieldInput}
        placeholderTextColor="#94A3B8"
        keyboardType={keyboardType}
      />
    </View>
  );
}

function ChipEditor({ label, items, onChange, muted, style }) {
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
  screen: { flex: 1, backgroundColor: '#F0FDFA' },
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

  mapPreview: { height: 110, borderRadius: 10, backgroundColor: '#E7EEF5', alignItems: 'center', justifyContent: 'center', marginTop: 2 },

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
