// Staff Edit Profile — opened from the "Edit Profile" button on Staff
// Profile. Real backend: PATCH /api/staff/:id (see staffApi.js) — Save
// writes straight to the staff record, and onSave hands the refreshed
// record back to Staff Management's list.
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Text from '../../../../components/TranslatedText';
import TextInput from '../../../../components/TranslatedTextInput';
import LinearGradient from 'react-native-linear-gradient';
import AppIcon from '../icons/AppIcon';
import { useToast } from '../../../../components/common/ToastProvider';
import { colors, createDoctorStyles } from '../theme';
import { CLINICIAN_GRADIENT } from '../../../../theme/palette';
import { roleLabelToKey, updateStaff } from './staffApi';
import { pickStaffPhoto } from './pickStaffPhoto';
import useKeyboardAwareScroll from '../../../../hooks/useKeyboardAwareScroll';

const DEPARTMENTS = ['Nursing', 'Clinical', 'Emergency', 'Pathology', 'Finance', 'Operations', 'Admin', 'General Medicine'];
const ROLE_TYPES = ['Nurse', 'Medical Assistant', 'Lab Technician', 'Billing', 'Receptionist', 'Housekeeping', 'Supervisor'];
const EMPLOYMENT_STATUSES = ['Full-Time', 'Part-Time', 'Contract'];
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
const isValidPhone = (value) => value.replace(/\D/g, '').length >= 10;

export default function StaffEditProfileScreen({ member, onCancel, onSave }) {
  // Signup-style keyboard handling: the form scrolls above the keyboard and the
  // focused field is scrolled into view (the window does not resize, edge-to-edge).
  const {
    scrollRef: kbScrollRef,
    frameInset: kbInset,
    scrollFocusedInputIntoView: kbFocus,
    handleKeyboardAwareScroll: kbOnScroll,
    handleKeyboardAwareScrollLayout: kbOnLayout,
  } = useKeyboardAwareScroll({ frameIsScroll: true });
  // Bottom sheets live in Modals, which draw under the system navigation
  // bar (edge-to-edge) — pad them by its height so their last row stays visible.
  const insets = useSafeAreaInsets();
  const { showToast } = useToast();
  const scrollRef = useRef(null);
  // New photo (data URI) picked on this screen; null = keep the current one.
  const [newPhoto, setNewPhoto] = useState(null);
  const shownPhoto = newPhoto || (member?.hasPhoto ? member.image : null);
  const changePhoto = async () => {
    try {
      const uri = await pickStaffPhoto();
      if (uri) setNewPhoto(uri);
    } catch (err) {
      showToast(err?.message || 'Could not add photo');
    }
  };
  const [picker, setPicker] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    fullName: member.name ?? '',
    email: member.email ?? '',
    phone: member.phone ?? '',
    department: member.department ?? '',
    role: member.role ?? '',
    employmentStatus: member.employmentStatus ?? '',
  });

  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const emailValid = isValidEmail(form.email);
  // Phone is optional here — staff added from the web may have none on file.
  const phoneValid = !form.phone.trim() || isValidPhone(form.phone);
  const emailError = form.email.trim().length > 0 && !emailValid ? 'Enter a valid email address.' : '';
  const phoneError = form.phone.trim().length > 0 && !phoneValid ? 'Enter a valid phone number (at least 10 digits).' : '';

  // Validation errors are in Personal Information, at the top.
  const scrollToTop = () => scrollRef.current?.scrollTo({ y: 0, animated: true });


  const handleSave = async () => {
    const fullName = form.fullName.trim();
    if (!fullName) {
      showToast('Full name is required.');
      return;
    }
    if (!emailValid) {
      showToast('Enter a valid email address before saving.');
      scrollToTop();
      return;
    }
    if (!phoneValid) {
      showToast('Enter a valid phone number before saving.');
      scrollToTop();
      return;
    }

    try {
      setSaving(true);
      // Web PUT /api/staff/:id body (full_name, clinic_id, contact_number, …).
      const updated = await updateStaff(member.rawId, {
        fullName,
        clinicId: member.clinicId,
        email: form.email.trim(),
        phone: form.phone.trim(),
        department: form.department,
        role: roleLabelToKey(form.role),
        shift: member.shift,
        status: member.status,
      }, newPhoto || undefined);
      onSave(updated);
    } catch (error) {
      showToast(error?.response?.data?.message || 'Failed to update staff member');
    } finally {
      setSaving(false);
    }
  };

  const dropdownConfig = {
    department: { label: 'Department', options: DEPARTMENTS, value: form.department, onSelect: (value) => setField('department', value) },
    role: { label: 'Role Type', options: ROLE_TYPES, value: form.role, onSelect: (value) => setField('role', value) },
    employmentStatus: { label: 'Employment Status', options: EMPLOYMENT_STATUSES, value: form.employmentStatus, onSelect: (value) => setField('employmentStatus', value) },
  }[picker];

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable onPress={onCancel} style={s.headerButton} hitSlop={8}>
          <AppIcon name="chevron-left" size={22} color="#1F2937" strokeWidth={2.4} />
        </Pressable>
        <Text style={s.title}>Edit Profile</Text>
        <Pressable onPress={handleSave} disabled={saving} hitSlop={8} style={s.saveLinkButton}>
          {saving ? <ActivityIndicator size="small" color={colors.blue} /> : <Text style={s.saveLinkText}>Save</Text>}
        </Pressable>
      </View>

      <ScrollView style={s.scrollArea} showsVerticalScrollIndicator={false} ref={(node) => { scrollRef.current = node; kbScrollRef.current = node; }} contentContainerStyle={[s.content, kbInset > 0 && { paddingBottom: kbInset + 24 }]} onScroll={kbOnScroll} onLayout={kbOnLayout} onFocusCapture={kbFocus} scrollEventThrottle={16} keyboardShouldPersistTaps="handled">
        <View style={s.photoBlock}>
          <View style={s.avatarWrap}>
            <View style={s.avatarCircle}>
              {shownPhoto
                ? <Image source={{ uri: shownPhoto }} style={s.avatarPhoto} />
                : <AppIcon name="user" size={26} color="#98A2B3" strokeWidth={1.8} />}
            </View>
            <Pressable style={s.cameraBadge} onPress={changePhoto} hitSlop={4}>
              <AppIcon name="camera" size={13} color="#FFFFFF" strokeWidth={2} />
            </Pressable>
          </View>
          <Pressable onPress={changePhoto} hitSlop={6}>
            <Text style={s.changePhotoText}>{shownPhoto ? 'Change Photo' : 'Add Photo'}</Text>
          </Pressable>
        </View>

        <View>
          <Text style={s.sectionTitle}>Personal Information</Text>
          <IconField label="Full Name" icon="user" value={form.fullName} onChangeText={(value) => setField('fullName', value)} placeholder="Full name" />
          <IconField label="Email Address" icon="message" value={form.email} onChangeText={(value) => setField('email', value)} placeholder="Email address" keyboardType="email-address" autoCapitalize="none" error={emailError} />
          <IconField label="Phone Number" icon="phone" value={form.phone} onChangeText={(value) => setField('phone', value)} placeholder="Phone number" keyboardType="phone-pad" error={phoneError} />
        </View>

        <View>
          <Text style={s.sectionTitle}>Employment Details</Text>
          <DropdownField label="Department" value={form.department} onPress={() => setPicker('department')} />
          <DropdownField label="Role Type" value={form.role} onPress={() => setPicker('role')} />
          <DropdownField label="Employment Status" value={form.employmentStatus} onPress={() => setPicker('employmentStatus')} />
        </View>
      </ScrollView>

      <View style={s.footer}>
        <Pressable onPress={onCancel} style={s.secondaryButton} disabled={saving}>
          <Text style={s.secondaryButtonText}>Discard</Text>
        </Pressable>
        <Pressable onPress={handleSave} disabled={saving} style={s.primaryWrap}>
          <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.primaryButton}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryButtonText}>Save Changes</Text>}
          </LinearGradient>
        </Pressable>
      </View>

      <Modal visible={picker !== null} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
        <Pressable style={s.overlay} onPress={() => setPicker(null)}>
          <View style={[s.sheet, { paddingBottom: 28 + insets.bottom }]}>
            <View style={s.handle} />
            {dropdownConfig && (
              <>
                <Text style={s.sheetTitle}>{dropdownConfig.label}</Text>
                {dropdownConfig.options.map((option) => {
                  const active = dropdownConfig.value === option;
                  return (
                    <Pressable
                      key={option}
                      style={s.sheetOption}
                      onPress={() => {
                        dropdownConfig.onSelect(option);
                        setPicker(null);
                      }}
                    >
                      <Text style={[s.sheetOptionText, active && s.sheetOptionTextActive]}>{option}</Text>
                      {active && <AppIcon name="check-mark" size={16} color={colors.blue} strokeWidth={2.6} />}
                    </Pressable>
                  );
                })}
              </>
            )}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function IconField({ label, icon, error, ...inputProps }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <View style={[s.fieldBox, error && s.fieldBoxError]}>
        <AppIcon name={icon} size={15} color="#8A94A4" strokeWidth={1.9} />
        <TextInput {...inputProps} style={s.fieldInput} placeholderTextColor="#9AA4B5" />
      </View>
      {!!error && <Text style={s.fieldErrorText}>{error}</Text>}
    </View>
  );
}

function DropdownField({ label, value, onPress }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <Pressable onPress={onPress} style={s.fieldDropdown}>
        <Text translate={false} style={value ? s.fieldValueText : s.fieldPlaceholderText}>{value || `Select ${label.toLowerCase()}`}</Text>
        <AppIcon name="chevron-down" size={15} color="#667085" strokeWidth={2.2} />
      </Pressable>
    </View>
  );
}

const s = createDoctorStyles({
  screen: { flex: 1, backgroundColor: '#F5F7FB' },
  header: { height: 52, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#D8DFE9', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  headerButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 16.5, fontWeight: '700', color: colors.blue, marginLeft: 2 },
  saveLinkButton: { paddingHorizontal: 8, height: 36, alignItems: 'center', justifyContent: 'center' },
  saveLinkText: { fontSize: 14.5, fontWeight: '700', color: colors.blue },


  scrollArea: { flex: 1 },
  content: { padding: 16, paddingBottom: 24 },
  grow: { flex: 1 },

  photoBlock: { alignItems: 'center', marginBottom: 22 },
  avatarPhoto: { width: '100%', height: '100%' },
  avatarWrap: { position: 'relative' },
  avatarCircle: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#EEF1F5', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cameraBadge: { position: 'absolute', right: -2, bottom: -2, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#F5F7FB' },
  changePhotoText: { fontSize: 13.5, fontWeight: '700', color: colors.blue, marginTop: 10 },

  sectionTitle: { fontSize: 15.5, fontWeight: '700', color: '#17243A', marginTop: 6, marginBottom: 14 },

  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.3, color: '#8A94A4', textTransform: 'uppercase', marginBottom: 7 },
  fieldBox: { height: 46, borderWidth: 1, borderColor: '#D2DAE6', borderRadius: 10, paddingHorizontal: 13, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', gap: 9 },
  fieldBoxError: { borderColor: '#D2564B' },
  fieldErrorText: { fontSize: 12, color: '#D2564B', marginTop: 5 },
  fieldInput: { flex: 1, fontSize: 14, color: '#17243A', paddingVertical: 0 },
  fieldDropdown: { height: 46, borderWidth: 1, borderColor: '#D2DAE6', borderRadius: 10, paddingHorizontal: 13, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldValueText: { fontSize: 14, color: '#17243A' },
  fieldPlaceholderText: { fontSize: 14, color: '#9AA4B5' },



  footer: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#EDF0F4' },
  secondaryButton: { flex: 1, height: 46, borderRadius: 12, borderWidth: 1, borderColor: '#D2DAE6', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  secondaryButtonText: { fontSize: 15, fontWeight: '700', color: '#3C4759' },
  primaryWrap: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  primaryButton: { height: 46, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  overlay: { flex: 1, backgroundColor: 'rgba(18,28,45,.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingBottom: 28 },
  handle: { width: 42, height: 4, borderRadius: 2, backgroundColor: '#D0D5DD', alignSelf: 'center', marginBottom: 17 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#17243A', marginBottom: 6 },
  sheetOption: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#EDF0F4' },
  sheetOptionText: { fontSize: 15, fontWeight: '500', color: '#26364D' },
  sheetOptionTextActive: { fontWeight: '700', color: colors.blue },
});
