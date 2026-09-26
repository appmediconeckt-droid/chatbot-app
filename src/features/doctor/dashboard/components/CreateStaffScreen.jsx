// Create New Staff Member — the 3-step wizard opened from the "+ Add" button
// on Staff Management (Step 1: Role Selection, Step 2: Personal &
// Professional Details, Step 3: Review & Create). Real backend: POST
// /api/staff on the final step (see staffApi.js). Staff records have no
// login of their own, so there's no activation email / temp password —
// the review step just previews the employee ID the backend will assign.
import React, { useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import LinearGradient from 'react-native-linear-gradient';
import AppIcon from '../icons/AppIcon';
import { useToast } from '../../../../components/common/ToastProvider';
import { colors, createDoctorStyles } from '../theme';
import { useDoctorBack } from '../useDoctorBack';
import { CLINICIAN_GRADIENT } from '../../../../theme/palette';
import { getDatePickerValue, toDateOnlyString } from '../../../../utils/dateOfBirth';
import { createStaff } from './staffApi';

const ROLES = [
  { key: 'nurse', title: 'Nurse', description: 'Direct patient care & monitoring.', icon: 'plus', active: 42 },
  { key: 'medicalAssistant', title: 'Medical Assistant', description: 'Clinical operations & support.', icon: 'pulse', active: 18 },
  { key: 'labTechnician', title: 'Lab Technician', description: 'Lab tests & samples.', icon: 'flask', active: 12 },
  { key: 'billingStaff', title: 'Billing Staff', description: 'Invoicing & claims management.', icon: 'note', active: 8 },
  { key: 'housekeeping', title: 'Housekeeping', description: 'Ensures facility cleanliness and hygiene.', icon: 'home', active: 15 },
  { key: 'supervisor', title: 'Supervisor', description: 'Oversees departmental operations and staff.', icon: 'users', active: 6 },
];
const GENDERS = ['Male', 'Female', 'Other'];
const DEPARTMENTS = ['Emergency', 'Pathology', 'Finance', 'Admin', 'General Medicine', 'Housekeeping'];
const SHIFTS = ['Morning', 'Afternoon', 'Night', 'Rotational'];
const SHIFT_TIMES = {
  Morning: '7 AM - 3 PM',
  Afternoon: '3 PM - 11 PM',
  Night: '7 PM - 7 AM',
  Rotational: 'Varies weekly',
};
const ROLE_ID_PREFIX = {
  nurse: 'NUR',
  medicalAssistant: 'MAS',
  labTechnician: 'LAB',
  billingStaff: 'BIL',
  housekeeping: 'HSK',
  supervisor: 'SUP',
};
const DUMMY_PHOTOS = [
  'https://i.pravatar.cc/160?img=25',
  'https://i.pravatar.cc/160?img=33',
  'https://i.pravatar.cc/160?img=47',
  'https://i.pravatar.cc/160?img=52',
  'https://i.pravatar.cc/160?img=61',
];

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
const isValidPhone = (value) => value.replace(/\D/g, '').length >= 10;

const formatMDY = (isoDate) => {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-');
  return `${month}/${day}/${year}`;
};

const formatLongDate = (isoDate) => {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
};

const generateEmployeeId = (roleKey) => {
  const prefix = ROLE_ID_PREFIX[roleKey] ?? 'STF';
  const number = String(Math.floor(100 + Math.random() * 900));
  return `${prefix}${number}`;
};

const blankForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  dateOfBirth: '',
  gender: '',
  department: '',
  hireDate: '',
  shiftPreference: '',
};

export default function CreateStaffScreen({ onCancel, onCreated }) {
  const { showToast } = useToast();
  const [step, setStep] = useState(1);
  const [selectedRole, setSelectedRole] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [picker, setPicker] = useState(null);
  const [datePicker, setDatePicker] = useState(null);
  const [credentials, setCredentials] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [creating, setCreating] = useState(false);

  useDoctorBack(() => {
    if (step > 1) {
      setStep((current) => current - 1);
    } else {
      onCancel();
    }
    return true;
  });

  const setField = (field, value) => setForm((current) => ({ ...current, [field]: value }));
  const selectedRoleInfo = ROLES.find((item) => item.key === selectedRole);

  const emailValid = isValidEmail(form.email);
  const phoneValid = isValidPhone(form.phone);
  const emailError = form.email.trim().length > 0 && !emailValid ? 'Enter a valid email address.' : '';
  const phoneError = form.phone.trim().length > 0 && !phoneValid ? 'Enter a valid phone number (at least 10 digits).' : '';

  const canContinueStep1 = Boolean(selectedRole);
  const canContinueStep2 = Boolean(form.firstName.trim() && form.lastName.trim() && emailValid && phoneValid);

  const handleStep1Continue = () => {
    if (!canContinueStep1) return;
    setStep(2);
  };

  const handleStep2Continue = () => {
    if (!canContinueStep2) return;
    setCredentials({ employeeId: generateEmployeeId(selectedRole) });
    setStep(3);
  };

  const handleCreateAccount = async () => {
    try {
      setCreating(true);
      const created = await createStaff({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        dateOfBirth: form.dateOfBirth,
        gender: form.gender,
        role: selectedRole,
        department: form.department,
        hireDate: form.hireDate,
        shiftPreference: form.shiftPreference,
      });
      showToast(`${created.name} added to your staff directory as ${created.id}.`);
      onCreated ? onCreated(created) : onCancel();
    } catch (error) {
      showToast(error?.response?.data?.message || 'Failed to create staff member');
    } finally {
      setCreating(false);
    }
  };

  const dropdownConfig = {
    gender: { label: 'Gender', options: GENDERS, value: form.gender, onSelect: (value) => setField('gender', value) },
    department: { label: 'Department', options: DEPARTMENTS, value: form.department, onSelect: (value) => setField('department', value) },
    shiftPreference: { label: 'Shift Preference', options: SHIFTS, value: form.shiftPreference, onSelect: (value) => setField('shiftPreference', value) },
  }[picker];

  const dateField = datePicker === 'dateOfBirth' ? 'dateOfBirth' : datePicker === 'hireDate' ? 'hireDate' : null;

  return (
    <View style={s.screen}>
      <View style={s.header}>
        {step === 1 ? (
          <Pressable onPress={onCancel} style={s.headerButton} hitSlop={8}>
            <AppIcon name="chevron-left" size={21} color="#1F2937" strokeWidth={2.4} />
          </Pressable>
        ) : (
          <Pressable onPress={onCancel} style={s.headerButton} hitSlop={8}>
            <AppIcon name="x" size={18} color="#1F2937" strokeWidth={2.2} />
          </Pressable>
        )}
        <Text style={s.title} numberOfLines={1}>{step === 1 ? 'Create New Staff Member' : 'Add Staff Member'}</Text>
        {step === 1 ? (
          <Pressable onPress={onCancel} style={s.headerButton} hitSlop={8}>
            <AppIcon name="x" size={18} color="#1F2937" strokeWidth={2.2} />
          </Pressable>
        ) : (
          <View style={s.headerButton} />
        )}
      </View>

      <View style={s.stepBar}>
        <View style={s.stepRow}>
          <Text style={s.stepLabel}>Step {step} of 3</Text>
          <Text style={s.stepName}>{step === 1 ? 'Role Selection' : step === 2 ? 'Personal Details' : 'Review & Create'}</Text>
        </View>
        <View style={s.progressTrack}>
          <View
            style={[
              s.progressFill,
              step === 1 && s.progressFillStep1,
              step === 2 && s.progressFillStep2,
              step === 3 && s.progressFillStep3,
            ]}
          />
        </View>
      </View>

      {step === 1 && (
        <ScrollView style={s.scrollArea} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <Text style={s.subheading}>Choose a staff role to begin creating a new account.</Text>
          <View style={s.grid}>
            {ROLES.map((role) => {
              const selected = selectedRole === role.key;
              return (
                <Pressable
                  key={role.key}
                  onPress={() => setSelectedRole(role.key)}
                  style={[s.card, selected && s.cardSelected]}
                >
                  <View style={s.cardTopRow}>
                    <View style={s.roleIcon}><AppIcon name={role.icon} size={18} color={colors.blue} strokeWidth={2} /></View>
                    {selected && (
                      <View style={s.checkBadge}><AppIcon name="check-mark" size={11} color="#FFFFFF" strokeWidth={3} /></View>
                    )}
                  </View>
                  <Text style={s.roleTitle}>{role.title}</Text>
                  <Text style={s.roleDescription} numberOfLines={2}>{role.description}</Text>
                  <View style={s.activeRow}>
                    <View style={s.activeDot} />
                    <Text style={s.activeText}>{role.active} Active</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}

      {step === 2 && (
        <ScrollView style={s.scrollArea} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <Text style={s.subheading}>Fill in the staff member&apos;s personal and professional details.</Text>

          <SectionHeader title="Personal Information" />
          <View style={s.photoRow}>
            <View style={s.photoCircle}>
              {photo ? (
                <Image source={{ uri: photo }} style={s.photoImage} />
              ) : (
                <AppIcon name="user" size={22} color="#98A2B3" strokeWidth={1.8} />
              )}
            </View>
            <Pressable
              style={s.uploadButton}
              onPress={() => {
                setPhoto(DUMMY_PHOTOS[Math.floor(Math.random() * DUMMY_PHOTOS.length)]);
                showToast('Sample photo added (no real upload yet).');
              }}
            >
              <AppIcon name="upload" size={14} color={colors.blue} strokeWidth={2.2} />
              <Text style={s.uploadButtonText}>{photo ? 'Change Photo' : 'Upload Photo'}</Text>
            </Pressable>
          </View>

          <FormField label="First Name" value={form.firstName} onChangeText={(value) => setField('firstName', value)} placeholder="e.g. Jane" />
          <FormField label="Last Name" value={form.lastName} onChangeText={(value) => setField('lastName', value)} placeholder="e.g. Doe" />
          <FormField label="Email Address" value={form.email} onChangeText={(value) => setField('email', value)} placeholder="jane.doe@example.com" keyboardType="email-address" autoCapitalize="none" error={emailError} />
          <FormField label="Phone Number" value={form.phone} onChangeText={(value) => setField('phone', value)} placeholder="+91 0000000000" keyboardType="phone-pad" error={phoneError} />

          <SectionHeader title="Professional Details" />
          <FormDate label="Date of Birth" value={form.dateOfBirth} onPress={() => setDatePicker('dateOfBirth')} />
          <FormDropdown label="Gender" value={form.gender} placeholder="Select gender" onPress={() => setPicker('gender')} />
          <FormDropdown label="Department" value={form.department} placeholder="Select department" onPress={() => setPicker('department')} />
          <FormDate label="Hire Date" value={form.hireDate} onPress={() => setDatePicker('hireDate')} />
          <FormDropdown label="Shift Preference" value={form.shiftPreference} placeholder="Select shift preference" onPress={() => setPicker('shiftPreference')} />
        </ScrollView>
      )}

      {step === 3 && (
        <ScrollView style={s.scrollArea} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <View style={s.reviewCard}>
            <View style={s.reviewCardHeader}>
              <View style={s.reviewCardTitleRow}>
                <AppIcon name="user" size={16} color={colors.blue} strokeWidth={2} />
                <Text style={s.reviewCardTitle}>Personal Information</Text>
              </View>
              <Pressable onPress={() => setStep(2)} style={s.editLinkRow} hitSlop={6}>
                <AppIcon name="edit" size={13} color={colors.blue} strokeWidth={2.2} />
                <Text style={s.editLinkText}>Edit</Text>
              </Pressable>
            </View>

            <View style={s.reviewPhotoBlock}>
              <View style={s.reviewPhotoCircle}>
                {photo ? (
                  <Image source={{ uri: photo }} style={s.reviewPhotoImage} />
                ) : (
                  <AppIcon name="user" size={24} color="#98A2B3" strokeWidth={1.8} />
                )}
              </View>
              <View style={s.verifiedPill}>
                <AppIcon name="check-mark" size={11} color="#16A34A" strokeWidth={3} />
                <Text style={s.verifiedPillText}>Verified</Text>
              </View>
            </View>

            <View style={s.reviewGrid}>
              <ReviewItem label="Full Name" value={`${form.firstName} ${form.lastName}`.trim()} />
              <ReviewItem label="Email Address" value={form.email} />
              <ReviewItem label="Phone Number" value={form.phone} />
            </View>
          </View>

          <View style={s.reviewCard}>
            <View style={s.reviewCardHeader}>
              <View style={s.reviewCardTitleRow}>
                <AppIcon name="file" size={16} color={colors.blue} strokeWidth={2} />
                <Text style={s.reviewCardTitle}>Professional Details</Text>
              </View>
              <Pressable onPress={() => setStep(2)} style={s.editLinkRow} hitSlop={6}>
                <AppIcon name="edit" size={13} color={colors.blue} strokeWidth={2.2} />
                <Text style={s.editLinkText}>Edit</Text>
              </Pressable>
            </View>

            <View style={s.reviewGrid}>
              <View style={s.reviewItem}>
                <Text style={s.reviewLabel}>Role</Text>
                <View style={s.rolePill}><Text style={s.rolePillText}>{selectedRoleInfo?.title ?? '—'}</Text></View>
              </View>
              <ReviewItem label="Employee ID (preview)" value={credentials?.employeeId} />
              <ReviewItem label="Department" value={form.department} />
              <ReviewItem label="Hire Date" value={formatLongDate(form.hireDate)} />
              <ReviewItem label="Shift Preference" value={`${form.shiftPreference} Shift (${SHIFT_TIMES[form.shiftPreference] ?? ''})`} />
            </View>
          </View>

          <Text style={s.summaryTitle}>Final Account Summary</Text>
          <View style={s.summaryRow}>
            <View style={s.summaryCheck}><AppIcon name="check-mark" size={12} color="#16A34A" strokeWidth={3} /></View>
            <View style={s.grow}>
              <Text style={s.summaryLine}>Personal Info Complete</Text>
              <Text style={s.summarySub}>Name and email captured.</Text>
            </View>
          </View>
          <View style={s.summaryRow}>
            <View style={s.summaryCheck}><AppIcon name="check-mark" size={12} color="#16A34A" strokeWidth={3} /></View>
            <View style={s.grow}>
              <Text style={s.summaryLine}>Professional Details Set</Text>
              <Text style={s.summarySub}>Role and ID assigned.</Text>
            </View>
          </View>

          <View style={s.infoBanner}>
            <AppIcon name="check" size={14} color={colors.blue} strokeWidth={2.2} />
            <Text style={s.infoBannerText}>
              <Text style={s.infoBannerEmail}>{`${form.firstName} ${form.lastName}`.trim()}</Text> will be added to your staff directory. Staff records don&apos;t have their own login yet.
            </Text>
          </View>
        </ScrollView>
      )}

      <View style={s.footer}>
        {step === 1 ? (
          <>
            <Pressable onPress={onCancel} style={s.secondaryButton}>
              <Text style={s.secondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable onPress={handleStep1Continue} disabled={!canContinueStep1} style={s.primaryWrap}>
              <LinearGradient
                colors={canContinueStep1 ? CLINICIAN_GRADIENT : ['#C3CBD6', '#C3CBD6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.primaryButton}
              >
                <Text style={s.primaryButtonText}>Continue</Text>
              </LinearGradient>
            </Pressable>
          </>
        ) : step === 2 ? (
          <>
            <Pressable onPress={() => setStep(1)} style={s.secondaryButton}>
              <Text style={s.secondaryButtonText}>Back</Text>
            </Pressable>
            <Pressable onPress={handleStep2Continue} disabled={!canContinueStep2} style={s.primaryWrap}>
              <LinearGradient
                colors={canContinueStep2 ? CLINICIAN_GRADIENT : ['#C3CBD6', '#C3CBD6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={s.primaryButton}
              >
                <Text style={s.primaryButtonText}>Continue</Text>
              </LinearGradient>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable onPress={() => setStep(2)} style={s.secondaryButton} disabled={creating}>
              <Text style={s.secondaryButtonText}>Back</Text>
            </Pressable>
            <Pressable onPress={handleCreateAccount} disabled={creating} style={s.primaryWrap}>
              <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.primaryButton}>
                {creating ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryButtonText}>Create Account</Text>}
              </LinearGradient>
            </Pressable>
          </>
        )}
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

      {datePicker && (
        <DateTimePicker
          value={getDatePickerValue(form[dateField])}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          maximumDate={new Date()}
          onChange={(_event, selectedDate) => {
            if (Platform.OS === 'android') setDatePicker(null);
            if (selectedDate) setField(dateField, toDateOnlyString(selectedDate));
          }}
        />
      )}
    </View>
  );
}

function SectionHeader({ title }) {
  return (
    <View style={s.sectionHeaderWrap}>
      <Text style={s.sectionHeaderText}>{title}</Text>
      <View style={s.sectionHeaderRule} />
    </View>
  );
}

function FormField({ label, error, ...inputProps }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <TextInput {...inputProps} style={[s.fieldInput, error && s.fieldInputError]} placeholderTextColor="#9AA4B5" />
      {!!error && <Text style={s.fieldErrorText}>{error}</Text>}
    </View>
  );
}

function FormDropdown({ label, value, placeholder, onPress }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <Pressable onPress={onPress} style={s.fieldDropdown}>
        <Text style={value ? s.fieldValueText : s.fieldPlaceholderText}>{value || placeholder}</Text>
        <AppIcon name="chevron-down" size={15} color="#667085" strokeWidth={2.2} />
      </Pressable>
    </View>
  );
}

function FormDate({ label, value, onPress }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <Pressable onPress={onPress} style={s.fieldDropdown}>
        <Text style={value ? s.fieldValueText : s.fieldPlaceholderText}>{value ? formatMDY(value) : 'mm/dd/yyyy'}</Text>
        <AppIcon name="calendar" size={15} color="#667085" strokeWidth={2} />
      </Pressable>
    </View>
  );
}

function ReviewItem({ label, value, rightIcon, onIconPress }) {
  return (
    <View style={s.reviewItem}>
      <Text style={s.reviewLabel}>{label}</Text>
      <View style={s.reviewValueRow}>
        <Text style={s.reviewValue} numberOfLines={1}>{value || '—'}</Text>
        {rightIcon && (
          <Pressable onPress={onIconPress} hitSlop={8}>
            <AppIcon name={rightIcon} size={15} color="#8A94A4" strokeWidth={1.9} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const s = createDoctorStyles({
  screen: { flex: 1, backgroundColor: '#F5F7FB' },
  header: { height: 52, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#D8DFE9', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  headerButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 16.5, fontWeight: '700', color: colors.blue, textAlign: 'center', marginHorizontal: 2 },

  stepBar: { backgroundColor: '#FFF', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#EDF0F4' },
  stepRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  stepLabel: { fontSize: 12.5, fontWeight: '700', color: colors.blue },
  stepName: { fontSize: 12, fontWeight: '600', color: '#8A94A4' },
  progressTrack: { height: 5, borderRadius: 3, backgroundColor: '#E4E9F1', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: colors.blue },
  progressFillStep1: { width: '33%' },
  progressFillStep2: { width: '66%' },
  progressFillStep3: { width: '100%' },

  scrollArea: { flex: 1 },
  content: { padding: 16, paddingBottom: 24 },
  subheading: { fontSize: 13.5, lineHeight: 19, color: '#526078', marginBottom: 16 },
  grow: { flex: 1 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    width: '47.5%',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#DDE3EC',
    borderRadius: 14,
    padding: 12,
    minHeight: 148,
    shadowColor: '#17243A',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  cardSelected: { borderColor: colors.blue, backgroundColor: '#F2FDFC' },
  cardTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roleIcon: { width: 38, height: 38, borderRadius: 11, backgroundColor: colors.paleBlue, alignItems: 'center', justifyContent: 'center' },
  checkBadge: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  roleTitle: { fontSize: 14.5, fontWeight: '700', color: '#17243A', marginTop: 10 },
  roleDescription: { fontSize: 11.5, lineHeight: 15, color: '#8A94A4', marginTop: 4, minHeight: 30 },
  activeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#16A34A' },
  activeText: { fontSize: 11.5, fontWeight: '700', color: colors.blue },

  sectionHeaderWrap: { marginTop: 6, marginBottom: 14 },
  sectionHeaderText: { fontSize: 15.5, fontWeight: '700', color: '#17243A', marginBottom: 8 },
  sectionHeaderRule: { height: 1, backgroundColor: '#E1E6EE' },

  photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  photoCircle: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#EEF1F5', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  photoImage: { width: 54, height: 54, borderRadius: 27 },
  uploadButton: { flexDirection: 'row', alignItems: 'center', gap: 7, height: 38, borderWidth: 1, borderColor: '#D2DAE6', borderRadius: 10, paddingHorizontal: 14, backgroundColor: '#FFFFFF' },
  uploadButtonText: { fontSize: 13, fontWeight: '700', color: colors.blue },

  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 12.5, fontWeight: '600', color: '#3C4759', marginBottom: 6 },
  fieldInput: { height: 46, borderWidth: 1, borderColor: '#D2DAE6', borderRadius: 10, paddingHorizontal: 13, fontSize: 14, color: '#17243A', backgroundColor: '#FFFFFF' },
  fieldInputError: { borderColor: '#D2564B' },
  fieldErrorText: { fontSize: 12, color: '#D2564B', marginTop: 5 },
  fieldDropdown: { height: 46, borderWidth: 1, borderColor: '#D2DAE6', borderRadius: 10, paddingHorizontal: 13, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldValueText: { fontSize: 14, color: '#17243A' },
  fieldPlaceholderText: { fontSize: 14, color: '#9AA4B5' },

  reviewCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDE3EC',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    shadowColor: '#17243A',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  reviewCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#EDF0F4', marginBottom: 14 },
  reviewCardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  reviewCardTitle: { fontSize: 15, fontWeight: '700', color: '#17243A' },
  editLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  editLinkText: { fontSize: 12.5, fontWeight: '700', color: colors.blue },

  reviewPhotoBlock: { alignItems: 'center', marginBottom: 16 },
  reviewPhotoCircle: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#EEF1F5', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  reviewPhotoImage: { width: 58, height: 58, borderRadius: 29 },
  verifiedPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E9FBF0', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, marginTop: 8 },
  verifiedPillText: { fontSize: 11.5, fontWeight: '700', color: '#16A34A' },

  reviewGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14, columnGap: 12 },
  reviewItem: { width: '47%' },
  reviewLabel: { fontSize: 11.5, fontWeight: '600', color: '#8A94A4', marginBottom: 4 },
  reviewValueRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reviewValue: { flex: 1, fontSize: 14, fontWeight: '600', color: '#17243A' },
  rolePill: { alignSelf: 'flex-start', backgroundColor: colors.paleBlue, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  rolePillText: { fontSize: 13, fontWeight: '700', color: colors.blue },

  summaryTitle: { fontSize: 15.5, fontWeight: '700', color: '#17243A', marginBottom: 10 },
  summaryRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 12 },
  summaryCheck: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#E9FBF0', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  summaryLine: { fontSize: 14, fontWeight: '700', color: '#17243A' },
  summarySub: { fontSize: 12.5, color: '#8A94A4', marginTop: 1 },

  infoBanner: { flexDirection: 'row', gap: 9, backgroundColor: colors.paleBlue, borderRadius: 12, padding: 13, marginTop: 6 },
  infoBannerText: { flex: 1, fontSize: 12.5, lineHeight: 18, color: '#3C4759' },
  infoBannerEmail: { fontWeight: '700', color: colors.blue },

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
