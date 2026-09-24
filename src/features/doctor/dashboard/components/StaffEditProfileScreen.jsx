// Staff Edit Profile — opened from the "Edit Profile" button on Staff
// Profile. Real backend: PATCH /api/staff/:id (see staffApi.js) — Save
// writes straight to the staff record, and onSave hands the refreshed
// record back to Staff Management's list.
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import AppIcon from '../icons/AppIcon';
import { useToast } from '../../../../components/common/ToastProvider';
import { colors, createDoctorStyles } from '../theme';
import { CLINICIAN_GRADIENT } from '../../../../theme/palette';
import { roleLabelToKey, updateStaff } from './staffApi';

const DEPARTMENTS = ['Emergency', 'Pathology', 'Finance', 'Admin', 'General Medicine', 'Housekeeping'];
const ROLE_TYPES = ['Nurse', 'Medical Assistant', 'Lab Technician', 'Billing', 'Receptionist', 'Housekeeping', 'Supervisor'];
const EMPLOYMENT_STATUSES = ['Full-Time', 'Part-Time', 'Contract'];
const TABS = [
  { key: 'personal', label: 'Personal Info' },
  { key: 'employment', label: 'Employment' },
  { key: 'documents', label: 'Documents' },
];
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
const isValidPhone = (value) => value.replace(/\D/g, '').length >= 10;

export default function StaffEditProfileScreen({ member, onCancel, onSave }) {
  const { showToast } = useToast();
  const scrollRef = useRef(null);
  const sectionOffsets = useRef({});
  const [activeTab, setActiveTab] = useState('personal');
  const [picker, setPicker] = useState(null);
  const [documents, setDocuments] = useState(member.documents ?? []);
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
  const phoneValid = isValidPhone(form.phone);
  const emailError = form.email.trim().length > 0 && !emailValid ? 'Enter a valid email address.' : '';
  const phoneError = form.phone.trim().length > 0 && !phoneValid ? 'Enter a valid phone number (at least 10 digits).' : '';

  const scrollToSection = (key) => {
    setActiveTab(key);
    const y = sectionOffsets.current[key];
    if (typeof y === 'number') {
      scrollRef.current?.scrollTo({ y: Math.max(y - 12, 0), animated: true });
    }
  };

  const removeDocument = (name) => setDocuments((current) => current.filter((doc) => doc.name !== name));

  const handleSave = async () => {
    const fullName = form.fullName.trim();
    if (!fullName) {
      showToast('Full name is required.');
      return;
    }
    if (!emailValid) {
      showToast('Enter a valid email address before saving.');
      scrollToSection('personal');
      return;
    }
    if (!phoneValid) {
      showToast('Enter a valid phone number before saving.');
      scrollToSection('personal');
      return;
    }

    const [firstName, ...rest] = fullName.split(/\s+/);
    const lastName = rest.join(' ') || firstName;

    try {
      setSaving(true);
      const updated = await updateStaff(member.rawId, {
        firstName,
        lastName,
        email: form.email.trim(),
        phone: form.phone.trim(),
        department: form.department,
        role: roleLabelToKey(form.role),
        employmentStatus: form.employmentStatus,
      });
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

      <View style={s.tabsRow}>
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <Pressable key={tab.key} onPress={() => scrollToSection(tab.key)} style={s.tab}>
              <Text style={[s.tabText, active && s.tabTextActive]}>{tab.label}</Text>
              {active && <View style={s.tabIndicator} />}
            </Pressable>
          );
        })}
      </View>

      <ScrollView ref={scrollRef} style={s.scrollArea} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.photoBlock}>
          <View style={s.avatarWrap}>
            <View style={s.avatarCircle}><AppIcon name="user" size={26} color="#98A2B3" strokeWidth={1.8} /></View>
            <Pressable style={s.cameraBadge} onPress={() => showToast('Photo upload is coming soon.')} hitSlop={4}>
              <AppIcon name="camera" size={13} color="#FFFFFF" strokeWidth={2} />
            </Pressable>
          </View>
          <Pressable onPress={() => showToast('Photo upload is coming soon.')} hitSlop={6}>
            <Text style={s.changePhotoText}>Change Photo</Text>
          </Pressable>
        </View>

        <View onLayout={(event) => { sectionOffsets.current.personal = event.nativeEvent.layout.y; }}>
          <Text style={s.sectionTitle}>Personal Information</Text>
          <IconField label="Full Name" icon="user" value={form.fullName} onChangeText={(value) => setField('fullName', value)} placeholder="Full name" />
          <IconField label="Email Address" icon="message" value={form.email} onChangeText={(value) => setField('email', value)} placeholder="Email address" keyboardType="email-address" autoCapitalize="none" error={emailError} />
          <IconField label="Phone Number" icon="phone" value={form.phone} onChangeText={(value) => setField('phone', value)} placeholder="Phone number" keyboardType="phone-pad" error={phoneError} />
        </View>

        <View onLayout={(event) => { sectionOffsets.current.employment = event.nativeEvent.layout.y; }}>
          <Text style={s.sectionTitle}>Employment Details</Text>
          <DropdownField label="Department" value={form.department} onPress={() => setPicker('department')} />
          <DropdownField label="Role Type" value={form.role} onPress={() => setPicker('role')} />
          <DropdownField label="Employment Status" value={form.employmentStatus} onPress={() => setPicker('employmentStatus')} />
        </View>

        <View onLayout={(event) => { sectionOffsets.current.documents = event.nativeEvent.layout.y; }}>
          <Text style={s.sectionTitle}>Documents &amp; Credentials</Text>
          {documents.map((doc, index) => (
            <View key={doc.name} style={[s.documentRow, index === documents.length - 1 && s.documentRowLast]}>
              <View style={[s.documentIcon, doc.type === 'PDF' && s.documentIconPdf]}>
                <AppIcon name="file" size={16} color={doc.type === 'PDF' ? '#D2564B' : colors.blue} strokeWidth={1.9} />
              </View>
              <View style={s.grow}>
                <Text style={s.documentName} numberOfLines={1}>{doc.name}</Text>
                <Text style={s.documentMeta}>{[doc.type, doc.size].filter(Boolean).join(' · ')}</Text>
              </View>
              <Pressable onPress={() => removeDocument(doc.name)} hitSlop={8} style={s.documentDelete}>
                <AppIcon name="trash" size={16} color="#B0424A" strokeWidth={1.9} />
              </Pressable>
            </View>
          ))}
          {documents.length === 0 && <Text style={s.emptyHint}>No documents on file.</Text>}
          <Pressable style={s.uploadButton} onPress={() => showToast('Uploading documents is coming soon.')}>
            <AppIcon name="upload" size={14} color={colors.blue} strokeWidth={2.2} />
            <Text style={s.uploadButtonText}>Upload New Document</Text>
          </Pressable>
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
          <View style={s.sheet}>
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
        <Text style={value ? s.fieldValueText : s.fieldPlaceholderText}>{value || `Select ${label.toLowerCase()}`}</Text>
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

  tabsRow: { flexDirection: 'row', backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#DCE1E9' },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 11 },
  tabText: { fontSize: 13, fontWeight: '600', color: '#8A94A4' },
  tabTextActive: { color: colors.blue, fontWeight: '700' },
  tabIndicator: { position: 'absolute', bottom: -1, height: 2, width: '60%', backgroundColor: colors.blue, borderRadius: 1 },

  scrollArea: { flex: 1 },
  content: { padding: 16, paddingBottom: 24 },
  grow: { flex: 1 },

  photoBlock: { alignItems: 'center', marginBottom: 22 },
  avatarWrap: { position: 'relative' },
  avatarCircle: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#EEF1F5', alignItems: 'center', justifyContent: 'center' },
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

  documentRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#EEF1F5' },
  documentRowLast: { borderBottomWidth: 0 },
  documentIcon: { width: 36, height: 36, borderRadius: 9, backgroundColor: colors.paleBlue, alignItems: 'center', justifyContent: 'center' },
  documentIconPdf: { backgroundColor: '#FDF1F1' },
  documentName: { fontSize: 14, fontWeight: '600', color: '#26364D' },
  documentMeta: { fontSize: 12, color: '#8A94A4', marginTop: 2 },
  documentDelete: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  emptyHint: { fontSize: 13, color: '#8E9DB0', paddingVertical: 8 },

  uploadButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderWidth: 1, borderColor: '#D2DAE6', borderRadius: 10, backgroundColor: '#FFFFFF', marginTop: 14 },
  uploadButtonText: { fontSize: 13.5, fontWeight: '700', color: colors.blue },

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
