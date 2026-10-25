// Create New Staff Member — the 3-step wizard opened from the "+ Add" button
// on Staff Management (Step 1: Role Selection, Step 2: Personal &
// Professional Details, Step 3: Review & Create). Real backend: POST
// /api/staff on the final step (see staffApi.js). Step 3 also generates the
// staff member's login: their email + a generated password, with the chosen
// role. After creating, the doctor sees those credentials once and can share
// them; the staff member then signs in on the main Login page and lands on
// the staff dashboard for their role.
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, Pressable, ScrollView, Share, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Text from '../../../../components/TranslatedText';
import TextInput from '../../../../components/TranslatedTextInput';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import LinearGradient from 'react-native-linear-gradient';
import AppIcon from '../icons/AppIcon';
import { useToast } from '../../../../components/common/ToastProvider';
import { colors, createDoctorStyles } from '../theme';
import { useDoctorBack } from '../useDoctorBack';
import { CLINICIAN_GRADIENT } from '../../../../theme/palette';
import { getDatePickerValue, toDateOnlyString } from '../../../../utils/dateOfBirth';
import { DEFAULT_SHIFT_TIMES, createStaff, fetchClinics, formatClock12, generateStaffPassword } from './staffApi';
import { pickStaffPhoto } from './pickStaffPhoto';
import useKeyboardAwareScroll from '../../../../hooks/useKeyboardAwareScroll';
import CountryPhoneInput from '../../../../components/common/CountryPhoneInput';
import { buildInternationalPhoneNumber, formatPhoneNumber, getPhoneLengthLabel, isValidLocalPhoneNumber } from '../../../../utils/countryCodes';

// Role `key`s are the backend role ids the web sends (docStaffRoleCards).
const ROLES = [
  {
    key: 'receptionist',
    title: 'Receptionist',
    description: "Views the assigned doctor's details, appointments, live tokens and checkups.",
    icon: 'calendar',
    department: 'Admin',
    // Shown on the full-width card when it is the only role on offer.
    points: [
      { icon: 'calendar', text: "Today's appointments and the live token queue" },
      { icon: 'pulse', text: 'Record patient vitals before the consultation' },
      { icon: 'file', text: 'Patient history and prescription PDFs' },
      { icon: 'qr', text: 'Clinic LED token display' },
    ],
  },
  // Hidden for now — only Receptionist can be created. Uncomment to bring a role back.
  // { key: 'nurse', title: 'Nurse', description: 'Direct patient care & monitoring.', icon: 'plus', department: 'Nursing' },
  // { key: 'assistant', title: 'Medical Assistant', description: 'Clinical operations & support.', icon: 'pulse', department: 'Clinical' },
  // { key: 'technician', title: 'Lab Technician', description: 'Lab tests & samples.', icon: 'flask', department: 'Pathology' },
  // { key: 'billing', title: 'Billing Staff', description: 'Invoicing & claims management.', icon: 'note', department: 'Finance' },
  // { key: 'housekeeping', title: 'Housekeeping', description: 'Ensures facility cleanliness and hygiene.', icon: 'home', department: 'Operations' },
  // { key: 'supervisor', title: 'Supervisor', description: 'Oversees departmental operations and staff.', icon: 'users', department: 'Operations' },
];
const GENDERS = ['Male', 'Female', 'Other'];
const DEPARTMENTS = ['Nursing', 'Clinical', 'Emergency', 'Pathology', 'Finance', 'Operations', 'Admin', 'General Medicine'];
// Web shift values.
const SHIFTS = ['Morning', 'Evening', 'Night'];
const ROLE_ID_PREFIX = {
  receptionist: 'REC',
  nurse: 'NUR',
  assistant: 'MA',
  technician: 'LAB',
  billing: 'BIL',
  housekeeping: 'HSK',
  supervisor: 'SUP',
};
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

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
  clinicId: '',
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  phoneCountryCode: '+91',
  dateOfBirth: '',
  gender: '',
  department: '',
  hireDate: '',
  shiftPreference: 'Morning',
  shiftStartTime: DEFAULT_SHIFT_TIMES.Morning[0],
  shiftEndTime: DEFAULT_SHIFT_TIMES.Morning[1],
};

// "HH:MM" ↔ Date for the time picker.
const timeToDate = (value) => {
  const [h, m] = String(value || '09:00').split(':').map(Number);
  const d = new Date();
  d.setHours(Number.isFinite(h) ? h : 9, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
};
const dateToTime = (date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

export default function CreateStaffScreen({ onCancel, onCreated }) {
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
  const [step, setStep] = useState(1);
  // With a single role on offer there is nothing to choose — pre-select it.
  const [selectedRole, setSelectedRole] = useState(ROLES.length === 1 ? ROLES[0].key : null);
  const [form, setForm] = useState(blankForm);
  const [picker, setPicker] = useState(null);
  const [datePicker, setDatePicker] = useState(null);
  const [credentials, setCredentials] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [creating, setCreating] = useState(false);
  const [createdStaff, setCreatedStaff] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [clinics, setClinics] = useState([]);
  const [clinicsLoading, setClinicsLoading] = useState(true);

  // Every staff member belongs to one of the doctor's clinics (server requires clinic_id).
  useEffect(() => {
    let cancelled = false;
    fetchClinics()
      .then((list) => {
        if (cancelled) return;
        setClinics(list);
        if (list.length === 1) setForm((current) => ({ ...current, clinicId: current.clinicId || list[0].id }));
      })
      .catch(() => { if (!cancelled) setClinics([]); })
      .finally(() => { if (!cancelled) setClinicsLoading(false); });
    return () => { cancelled = true; };
  }, []);
  const selectedClinic = clinics.find((c) => c.id === form.clinicId);

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
  const phoneValid = isValidLocalPhoneNumber(form.phone, form.phoneCountryCode);
  const emailError = form.email.trim().length > 0 && !emailValid ? 'Enter a valid email address.' : '';
  const phoneError = form.phone.trim().length > 0 && !phoneValid ? `Enter a valid ${getPhoneLengthLabel(form.phoneCountryCode)} digit phone number for ${form.phoneCountryCode}.` : '';

  const canContinueStep1 = Boolean(selectedRole);
  const canContinueStep2 = Boolean(form.clinicId && form.firstName.trim() && form.lastName.trim() && emailValid && phoneValid
    && form.shiftStartTime && form.shiftEndTime);

  const handleStep1Continue = () => {
    if (!canContinueStep1) return;
    // Same default as the web: the role's own department.
    const role = ROLES.find((item) => item.key === selectedRole);
    if (role && !form.department) setField('department', role.department);
    setStep(2);
  };

  const handleStep2Continue = () => {
    if (!canContinueStep2) return;
    // Keep the password if the doctor goes back to edit details, so a
    // password they already noted down doesn't change under them.
    setCredentials((current) => ({
      employeeId: generateEmployeeId(selectedRole),
      password: current?.password || generateStaffPassword(),
    }));
    setStep(3);
  };

  const regeneratePassword = () =>
    setCredentials((current) => ({ ...current, password: generateStaffPassword() }));

  const loginEmail = form.email.trim();
  const roleTitle = selectedRoleInfo?.title ?? 'Staff';

  const credentialMessage = () => {
    const name = `${form.firstName} ${form.lastName}`.trim();
    return (
      `Hi ${name}, your ${roleTitle} account is ready.\n\n` +
      `Login from the app's main Login page:\n` +
      `Email: ${loginEmail}\n` +
      `Password: ${credentials?.password}\n` +
      `Role: ${roleTitle}\n\n` +
      'Please change your password after your first login.'
    );
  };

  const shareCredentials = () => {
    Share.share({ title: 'Staff login details', message: credentialMessage() }).catch(() => {});
  };



  const finishCreate = () => {
    const created = createdStaff;
    setCreatedStaff(null);
    onCreated ? onCreated(created) : onCancel();
  };

  const handleCreateAccount = async () => {
    if (!phoneValid) return showToast(phoneError || 'Enter a phone number.');
    try {
      setCreating(true);
      const created = await createStaff({
        clinicId: form.clinicId,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: buildInternationalPhoneNumber(form.phoneCountryCode, form.phone),
        dateOfBirth: form.dateOfBirth,
        gender: form.gender,
        role: selectedRole,
        department: form.department || ROLES.find((item) => item.key === selectedRole)?.department,
        hireDate: form.hireDate,
        shift: form.shiftPreference || 'Morning',
        shiftStartTime: form.shiftStartTime,
        shiftEndTime: form.shiftEndTime,
        password: credentials?.password,
      }, photo);
      showToast(`${created.name} added to your staff directory.`);
      // Show the login details once before leaving, so they can be shared.
      setCreatedStaff(created);
    } catch (error) {
      showToast(error?.response?.data?.message || 'Failed to create staff member');
    } finally {
      setCreating(false);
    }
  };

  const dropdownConfig = {
    gender: { label: 'Gender', options: GENDERS, value: form.gender, onSelect: (value) => setField('gender', value) },
    department: { label: 'Department', options: DEPARTMENTS, value: form.department, onSelect: (value) => setField('department', value) },
    // Picking a shift fills in its usual hours (like the web); the times stay editable.
    shiftPreference: {
      label: 'Shift Preference',
      options: SHIFTS,
      value: form.shiftPreference,
      onSelect: (value) => setForm((current) => ({
        ...current,
        shiftPreference: value,
        shiftStartTime: DEFAULT_SHIFT_TIMES[value]?.[0] || current.shiftStartTime,
        shiftEndTime: DEFAULT_SHIFT_TIMES[value]?.[1] || current.shiftEndTime,
      })),
    },
    clinic: {
      label: 'Clinic / Hospital',
      options: clinics.map((c) => c.name),
      value: selectedClinic?.name,
      onSelect: (value) => setField('clinicId', clinics.find((c) => c.name === value)?.id || ''),
    },
  }[picker];

  const dateField = datePicker === 'dateOfBirth' ? 'dateOfBirth' : datePicker === 'hireDate' ? 'hireDate' : null;
  const timeField = datePicker === 'shiftStartTime' || datePicker === 'shiftEndTime' ? datePicker : null;

  // Shift start / end time (the web's <input type="time">).
  const openTimePicker = (field) => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: timeToDate(form[field]),
        mode: 'time',
        is24Hour: false,
        onChange: (event, selected) => {
          if (event?.type === 'set' && selected) setField(field, dateToTime(selected));
        },
      });
      return;
    }
    setDatePicker(field);
  };
  // Empty hire date starts on today; empty date of birth on 1 Jan 2000.
  const pickerStart = (field) => (field === 'hireDate' && !form.hireDate ? new Date() : getDatePickerValue(form[field]));

  // Android: open the dialog imperatively. The <DateTimePicker> component
  // re-opens its dialog on every re-render (its onChange prop is new each
  // render), which snapped the year back to the start value mid-scroll.
  const openDatePicker = (field) => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: pickerStart(field),
        mode: 'date',
        maximumDate: new Date(),
        onChange: (event, selectedDate) => {
          if (event?.type === 'set' && selectedDate) setField(field, toDateOnlyString(selectedDate));
        },
      });
      return;
    }
    setDatePicker(field);
  };

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
        <ScrollView style={s.scrollArea} showsVerticalScrollIndicator={false} ref={kbScrollRef} contentContainerStyle={[s.content, kbInset > 0 && { paddingBottom: kbInset + 24 }]} onScroll={kbOnScroll} onLayout={kbOnLayout} onFocusCapture={kbFocus} scrollEventThrottle={16} keyboardShouldPersistTaps="handled">
          <Text style={s.subheading}>
            {ROLES.length === 1 ? 'This staff member will be created with the role below.' : 'Choose a staff role to begin creating a new account.'}
          </Text>
          {ROLES.length === 1 ? ROLES.map((role) => {
            const selected = selectedRole === role.key;
            return (
              <Pressable
                key={role.key}
                onPress={() => setSelectedRole(role.key)}
                style={[s.card, s.soloCard, selected && s.cardSelected]}
              >
                <View style={s.soloHead}>
                  <View style={s.soloIcon}><AppIcon name={role.icon} size={24} color={colors.blue} strokeWidth={2} /></View>
                  <View style={s.soloCopy}>
                    <Text style={s.soloTitle}>{role.title}</Text>
                    <Text style={s.soloDept}>{role.department} department</Text>
                  </View>
                  {selected && (
                    <View style={s.checkBadge}><AppIcon name="check-mark" size={11} color="#FFFFFF" strokeWidth={3} /></View>
                  )}
                </View>
                <Text style={s.soloDescription}>{role.description}</Text>
                {!!role.points?.length && (
                  <View style={s.soloPoints}>
                    <Text style={s.soloPointsTitle}>CAN ACCESS</Text>
                    {role.points.map((point) => (
                      <View key={point.text} style={s.soloPoint}>
                        <View style={s.soloPointIcon}><AppIcon name={point.icon} size={14} color={colors.blue} strokeWidth={2} /></View>
                        <Text style={s.soloPointText}>{point.text}</Text>
                      </View>
                    ))}
                  </View>
                )}
                <View style={s.soloNote}>
                  <AppIcon name="lock" size={14} color="#667085" strokeWidth={2} />
                  <Text style={s.soloNoteText}>Login details are generated in the last step for you to share.</Text>
                </View>
              </Pressable>
            );
          }) : (
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
                </Pressable>
              );
            })}
          </View>
          )}
        </ScrollView>
      )}

      {step === 2 && (
        <ScrollView style={s.scrollArea} showsVerticalScrollIndicator={false} ref={kbScrollRef} contentContainerStyle={[s.content, kbInset > 0 && { paddingBottom: kbInset + 24 }]} onScroll={kbOnScroll} onLayout={kbOnLayout} onFocusCapture={kbFocus} scrollEventThrottle={16} keyboardShouldPersistTaps="handled">
          <Text style={s.subheading}>Fill in the staff member&apos;s personal and professional details.</Text>

          <SectionHeader title="Clinic" />
          <FormDropdown
            label="Clinic / Hospital *"
            value={selectedClinic?.name}
            placeholder={clinicsLoading ? 'Loading clinics…' : clinics.length ? 'Select clinic' : 'No clinic found — add one in Clinic Settings'}
            onPress={() => { if (clinics.length) setPicker('clinic'); }}
          />

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
              onPress={async () => {
                try {
                  const uri = await pickStaffPhoto();
                  if (uri) setPhoto(uri);
                } catch (err) {
                  showToast(err?.message || 'Could not add photo');
                }
              }}
            >
              <AppIcon name="upload" size={14} color={colors.blue} strokeWidth={2.2} />
              <Text style={s.uploadButtonText}>{photo ? 'Change Photo' : 'Upload Photo'}</Text>
            </Pressable>
          </View>

          <FormField label="First Name" value={form.firstName} onChangeText={(value) => setField('firstName', value)} placeholder="e.g. Jane" />
          <FormField label="Last Name" value={form.lastName} onChangeText={(value) => setField('lastName', value)} placeholder="e.g. Doe" />
          <FormField label="Email Address" value={form.email} onChangeText={(value) => setField('email', value)} placeholder="jane.doe@example.com" keyboardType="email-address" autoCapitalize="none" error={emailError} />
          <View style={s.field}>
            <Text style={s.fieldLabel}>Phone Number</Text>
            <CountryPhoneInput value={form.phone} countryCode={form.phoneCountryCode} onChangePhoneNumber={(value) => setField('phone', value)} onChangeCountryCode={(value) => setField('phoneCountryCode', value)} onFocus={kbFocus} accentColor="#0D9488" />
            {!!phoneError && <Text style={s.fieldErrorText}>{phoneError}</Text>}
          </View>

          <SectionHeader title="Professional Details" />
          <FormDate label="Date of Birth" value={form.dateOfBirth} onPress={() => openDatePicker('dateOfBirth')} />
          <FormDropdown label="Gender" value={form.gender} placeholder="Select gender" onPress={() => setPicker('gender')} />
          <FormDropdown label="Department" value={form.department} placeholder="Select department" onPress={() => setPicker('department')} />
          <FormDate label="Hire Date" value={form.hireDate} onPress={() => openDatePicker('hireDate')} />
          <FormDropdown label="Shift Preference" value={form.shiftPreference} placeholder="Select shift preference" onPress={() => setPicker('shiftPreference')} />
          <View style={s.timeRow}>
            <View style={s.timeCol}>
              <FormTime label="Shift start time *" value={form.shiftStartTime} onPress={() => openTimePicker('shiftStartTime')} />
            </View>
            <View style={s.timeCol}>
              <FormTime label="Shift end time *" value={form.shiftEndTime} onPress={() => openTimePicker('shiftEndTime')} />
            </View>
          </View>
        </ScrollView>
      )}

      {step === 3 && (
        <ScrollView style={s.scrollArea} showsVerticalScrollIndicator={false} ref={kbScrollRef} contentContainerStyle={[s.content, kbInset > 0 && { paddingBottom: kbInset + 24 }]} onScroll={kbOnScroll} onLayout={kbOnLayout} onFocusCapture={kbFocus} scrollEventThrottle={16} keyboardShouldPersistTaps="handled">
          <View style={s.reviewCard}>
            <View style={s.reviewCardHeader}>
              <View style={s.reviewCardTitleRow}>
                <AppIcon name="user" size={16} color={colors.blue} strokeWidth={2} />
                <Text style={s.reviewCardTitle}>Personal Information</Text>
              </View>
              <Pressable onPress={() => setStep(2)} style={s.editLinkRow} hitSlop={6}>
                <AppIcon name="pencil" size={13} color={colors.blue} strokeWidth={2.2} />
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
              <ReviewItem label="Phone Number" value={formatPhoneNumber(form.phone, form.phoneCountryCode)} />
            </View>
          </View>

          <View style={s.reviewCard}>
            <View style={s.reviewCardHeader}>
              <View style={s.reviewCardTitleRow}>
                <AppIcon name="file" size={16} color={colors.blue} strokeWidth={2} />
                <Text style={s.reviewCardTitle}>Professional Details</Text>
              </View>
              <Pressable onPress={() => setStep(2)} style={s.editLinkRow} hitSlop={6}>
                <AppIcon name="pencil" size={13} color={colors.blue} strokeWidth={2.2} />
                <Text style={s.editLinkText}>Edit</Text>
              </Pressable>
            </View>

            <View style={s.reviewGrid}>
              <View style={s.reviewItem}>
                <Text style={s.reviewLabel}>Role</Text>
                <View style={s.rolePill}><Text style={s.rolePillText}>{selectedRoleInfo?.title ?? '—'}</Text></View>
              </View>
              <ReviewItem label="Employee ID (preview)" value={credentials?.employeeId} />
              <ReviewItem label="Clinic / Hospital" value={selectedClinic?.name} />
              <ReviewItem label="Department" value={form.department} />
              <ReviewItem label="Hire Date" value={formatLongDate(form.hireDate)} />
              <ReviewItem label="Shift Preference" value={`${form.shiftPreference} Shift (${formatClock12(form.shiftStartTime)} - ${formatClock12(form.shiftEndTime)})`} />
            </View>
          </View>

          <View style={s.reviewCard}>
            <View style={s.reviewCardHeader}>
              <View style={s.reviewCardTitleRow}>
                <AppIcon name="lock" size={16} color={colors.blue} strokeWidth={2} />
                <Text style={s.reviewCardTitle}>Login Credentials</Text>
              </View>
              <Pressable onPress={regeneratePassword} style={s.editLinkRow} hitSlop={6}>
                <AppIcon name="refresh" size={13} color={colors.blue} strokeWidth={2.2} />
                <Text style={s.editLinkText}>New Password</Text>
              </Pressable>
            </View>
            <CredentialRow label="Login Email" value={loginEmail} />
            <CredentialRow label="Login Role" value={roleTitle} />
            <CredentialRow
              label="Password"
              value={showPassword ? credentials?.password : '•'.repeat(credentials?.password?.length || 10)}
              icon={showPassword ? 'eye-off' : 'eye'}
              onIconPress={() => setShowPassword((current) => !current)}
              mono
            />
            <Text style={s.credentialHint}>
              An activation email will be sent to {loginEmail || 'the staff email'} with instructions to set a permanent password. They then sign in on the main Login page and open the {roleTitle} dashboard.
            </Text>
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
          <View style={s.summaryRow}>
            <View style={s.summaryCheck}><AppIcon name="check-mark" size={12} color="#16A34A" strokeWidth={3} /></View>
            <View style={s.grow}>
              <Text style={s.summaryLine}>Login Created</Text>
              <Text style={s.summarySub}>Password generated for {roleTitle} login.</Text>
            </View>
          </View>

          <View style={s.infoBanner}>
            <AppIcon name="check" size={14} color={colors.blue} strokeWidth={2.2} />
            <Text translate={false} style={s.infoBannerText}>
              <Text translate={false} style={s.infoBannerEmail}>{`${form.firstName} ${form.lastName}`.trim()}</Text> will be added to your staff directory and can log in as {roleTitle}. You&apos;ll see the login details again after creating, to share them.
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

      <Modal visible={createdStaff !== null} transparent animationType="fade" onRequestClose={finishCreate}>
        <View style={s.successOverlay}>
          <View style={s.successCard}>
            <View style={s.successIcon}><AppIcon name="check-mark" size={22} color="#16A34A" strokeWidth={3} /></View>
            <Text style={s.successTitle}>Staff Account Created</Text>
            <Text translate={false} style={s.successSub}>
              {createdStaff?.name} can now log in as {roleTitle}.
            </Text>
            {createdStaff?.credentialsEmailed === false ? (
              <>
                {/* The server couldn't email them — show and share instead. */}
                <View style={s.mailWarn}>
                  <AppIcon name="warning" size={15} color="#B45309" strokeWidth={2.2} />
                  <Text style={s.mailWarnText}>The login email couldn't be sent. Share these details with them — the password is shown only now.</Text>
                </View>
                <View style={s.successCredentials}>
                  <CredentialRow label="Login Email" value={loginEmail} />
                  <CredentialRow label="Login Role" value={roleTitle} />
                  <CredentialRow label="Password" value={credentials?.password} mono />
                </View>
                <Pressable onPress={shareCredentials} style={s.successPrimaryWrap}>
                  <LinearGradient colors={CLINICIAN_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.primaryButton}>
                    <AppIcon name="send" size={15} color="#FFFFFF" strokeWidth={2.2} />
                    <Text style={s.primaryButtonText}>Share Login Details</Text>
                  </LinearGradient>
                </Pressable>
              </>
            ) : (
              <>
                {/* The server emails the login email + password to the staff member. */}
                <View style={s.mailSent}>
                  <View style={s.mailSentIcon}>
                    <AppIcon name="mail" size={18} color="#0F766E" strokeWidth={2.2} />
                  </View>
                  <View style={s.mailSentBody}>
                    <Text style={s.mailSentTitle}>Activation email sent</Text>
                    <Text translate={false} style={s.mailSentTo} numberOfLines={1}>{loginEmail}</Text>
                  </View>
                </View>
                <Text style={s.mailSentHint}>
                  It has instructions to set a permanent password. After that they sign in from the main Login page as {roleTitle}.
                </Text>
              </>
            )}
            <Pressable onPress={finishCreate} style={s.successDone}>
              <Text style={s.secondaryButtonText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* iOS only — Android uses DateTimePickerAndroid.open (see openDatePicker). */}
      {timeField && Platform.OS === 'ios' && (
        <DateTimePicker
          value={timeToDate(form[timeField])}
          mode="time"
          display="spinner"
          onChange={(_event, selected) => {
            if (selected) setField(timeField, dateToTime(selected));
          }}
        />
      )}
      {dateField && Platform.OS === 'ios' && (
        <DateTimePicker
          value={pickerStart(dateField)}
          mode="date"
          display="inline"
          maximumDate={new Date()}
          onChange={(_event, selectedDate) => {
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
        <Text translate={false} style={value ? s.fieldValueText : s.fieldPlaceholderText}>{value || placeholder}</Text>
        <AppIcon name="chevron-down" size={15} color="#667085" strokeWidth={2.2} />
      </Pressable>
    </View>
  );
}

function FormTime({ label, value, onPress }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <Pressable onPress={onPress} style={s.fieldDropdown}>
        <Text translate={false} style={value ? s.fieldValueText : s.fieldPlaceholderText}>{value ? formatClock12(value) : '--:-- --'}</Text>
        <AppIcon name="clock" size={15} color="#667085" strokeWidth={2} />
      </Pressable>
    </View>
  );
}

function FormDate({ label, value, onPress }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      <Pressable onPress={onPress} style={s.fieldDropdown}>
        <Text translate={false} style={value ? s.fieldValueText : s.fieldPlaceholderText}>{value ? formatMDY(value) : 'mm/dd/yyyy'}</Text>
        <AppIcon name="calendar" size={15} color="#667085" strokeWidth={2} />
      </Pressable>
    </View>
  );
}

function CredentialRow({ label, value, icon, onIconPress, mono }) {
  return (
    <View style={s.credentialRow}>
      <Text style={s.reviewLabel}>{label}</Text>
      <View style={s.reviewValueRow}>
        <Text translate={false} selectable style={[s.reviewValue, mono && s.credentialMono]} numberOfLines={1}>{value || '—'}</Text>
        {icon && (
          <Pressable onPress={onIconPress} hitSlop={8}>
            <AppIcon name={icon} size={16} color="#8A94A4" strokeWidth={1.9} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

function ReviewItem({ label, value, rightIcon, onIconPress }) {
  return (
    <View style={s.reviewItem}>
      <Text style={s.reviewLabel}>{label}</Text>
      <View style={s.reviewValueRow}>
        <Text translate={false} style={s.reviewValue} numberOfLines={1}>{value || '—'}</Text>
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
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
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
  soloCard: { width: '100%', minHeight: 0, padding: 16 },
  soloHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  soloIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.paleBlue, alignItems: 'center', justifyContent: 'center' },
  soloCopy: { flex: 1, minWidth: 0 },
  soloTitle: { fontSize: 17, fontWeight: '800', color: '#17243A' },
  soloDept: { fontSize: 12, fontWeight: '600', color: colors.blue, marginTop: 2 },
  soloDescription: { fontSize: 13, lineHeight: 19, color: '#5B6576', marginTop: 12 },
  soloPoints: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E6ECF2', gap: 10 },
  soloPointsTitle: { fontSize: 10.5, fontWeight: '800', letterSpacing: 1.2, color: '#8A94A4' },
  soloPoint: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  soloPointIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: colors.paleBlue, alignItems: 'center', justifyContent: 'center' },
  soloPointText: { flex: 1, fontSize: 13, lineHeight: 18, color: '#17243A' },
  soloNote: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, padding: 10, borderRadius: 10, backgroundColor: '#F5F7FA' },
  soloNoteText: { flex: 1, fontSize: 11.5, lineHeight: 16, color: '#667085' },
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
  timeRow: { flexDirection: 'row', gap: 10 },
  timeCol: { flex: 1 },
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
  mailSent: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, padding: 12, borderRadius: 14, backgroundColor: '#F0FDFA', borderWidth: 1, borderColor: '#99E4D8' },
  mailSentIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#CCFBF1', alignItems: 'center', justifyContent: 'center' },
  mailSentBody: { flex: 1, minWidth: 0 },
  mailSentTitle: { fontSize: 14.5, fontWeight: '800', color: '#0F766E' },
  mailSentTo: { fontSize: 13, color: '#334155', marginTop: 2 },
  mailSentHint: { fontSize: 12.5, lineHeight: 18, color: '#64748B', textAlign: 'center', marginTop: 10 },
  mailWarn: { alignSelf: 'stretch', flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 12, padding: 10, borderRadius: 12, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A' },
  mailWarnText: { flex: 1, fontSize: 12.5, lineHeight: 18, color: '#92400E' },
  credentialRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EDF0F4' },
  credentialMono: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', letterSpacing: 1 },
  credentialHint: { fontSize: 12, lineHeight: 17, color: '#667085', marginTop: 10 },

  successOverlay: { flex: 1, backgroundColor: 'rgba(18,28,45,.45)', justifyContent: 'center', padding: 22 },
  successCard: { backgroundColor: '#FFF', borderRadius: 18, padding: 20 },
  successIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#E9FBF0', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  successTitle: { fontSize: 18, fontWeight: '800', color: '#17243A', textAlign: 'center', marginTop: 12 },
  successSub: { fontSize: 13, lineHeight: 19, color: '#526078', textAlign: 'center', marginTop: 6 },
  successCredentials: { backgroundColor: '#F8FAFD', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 4, marginTop: 16 },
  successPrimaryWrap: { borderRadius: 12, overflow: 'hidden', marginTop: 18 },
  successDone: { height: 46, borderRadius: 12, borderWidth: 1, borderColor: '#D2DAE6', alignItems: 'center', justifyContent: 'center', marginTop: 10 },

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
  primaryButton: { height: 46, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

  overlay: { flex: 1, backgroundColor: 'rgba(18,28,45,.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 18, paddingBottom: 28 },
  handle: { width: 42, height: 4, borderRadius: 2, backgroundColor: '#D0D5DD', alignSelf: 'center', marginBottom: 17 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: '#17243A', marginBottom: 6 },
  sheetOption: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#EDF0F4' },
  sheetOptionText: { fontSize: 15, fontWeight: '500', color: '#26364D' },
  sheetOptionTextActive: { fontWeight: '700', color: colors.blue },
});
