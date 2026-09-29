// Walk-in booking opened straight from a doctor's QR code (patient side).
// Native version of the web form at /walk-in-appointment
// (chatbot/src/Component/DoctorDashboard/Walk-in/AppointmentForm.jsx), with
// the same public endpoints and payload:
//   GET  /api/auth/doctor-qr/:doctorId          doctor shown at the top
//   POST /api/auth/doctor-qr/:doctorId/visits   records the QR visit
//   POST /api/walkin-appointments               books it, returns the token
// Requests go through plain axios (no login token), exactly like the web page,
// so a refusal here can never trigger the app's sign-out-on-401 handling.
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import DateTimePicker from '@react-native-community/datetimepicker';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Text from '../../../../../../components/TranslatedText';
import TextInput from '../../../../../../components/TranslatedTextInput';
import PATIENT from '../../../../../../theme/palette';
import { API_BASE_URL } from '../../../../../../axiosConfig';
import useLanguageRender from '../../../../../../hooks/useLanguageRender';

const API = `${API_BASE_URL.replace(/\/+$/, '').replace(/\/api$/, '')}/api`;
const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer-not-to-say', label: 'Prefer not to say' },
];

const pick = (...values) => values.find((v) => v !== undefined && v !== null && String(v).trim() !== '');
const pad = (n) => String(n).padStart(2, '0');
const toDateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toTimeKey = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const normalizeGender = (g) => {
  const v = String(g || '').trim().toLowerCase();
  if (v === 'm' || v === 'male') return 'male';
  if (v === 'f' || v === 'female') return 'female';
  if (v === 'other') return 'other';
  return '';
};
const toDateKeyOrEmpty = (value) => {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(String(value))) return String(value).slice(0, 10);
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : toDateKey(d);
};
const calculateAge = (dateKey) => {
  if (!dateKey) return '';
  const birth = new Date(`${dateKey}T00:00:00`);
  const today = new Date();
  if (Number.isNaN(birth.getTime()) || birth > today) return '';
  let age = today.getFullYear() - birth.getFullYear();
  if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age -= 1;
  return String(age);
};
const formatDob = (key) => (key
  ? new Date(`${key}T00:00:00`).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  : '');
const formatTime = (key) => {
  if (!key) return '';
  const [h, m] = key.split(':').map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? 'PM' : 'AM'}`;
};

// Preferred visit date: today up to BOOKING_WINDOW_DAYS ahead.
const BOOKING_WINDOW_DAYS = 30;
const addDays = (date, days) => { const d = new Date(date); d.setDate(d.getDate() + days); return d; };
const formatVisitDate = (key) => {
  if (!key) return '';
  const today = toDateKey(new Date());
  if (key === today) return 'Today';
  if (key === toDateKey(addDays(new Date(), 1))) return 'Tomorrow';
  return new Date(`${key}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
};

const emptyForm = { patientName: '', contactNumber: '', problem: '', dateOfBirth: '', location: '', gender: '', appointmentDate: '', appointmentTime: '', email: '' };

export default function WalkInBookingScreen({ visible, doctorId, source = 'qr', onClose }) {
  const { t } = useLanguageRender();
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [doctor, setDoctor] = useState(null);
  const [doctorLoading, setDoctorLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');
  const [token, setToken] = useState('');
  const [picker, setPicker] = useState(null); // 'dob' | 'time' | null
  const visitRecorded = useRef(null);

  // Fresh form for every scan, pre-filled from the signed-in patient's profile.
  useEffect(() => {
    if (!visible) return;
    setErrors({});
    setApiError('');
    setToken('');
    (async () => {
      let user = {};
      try { user = JSON.parse((await AsyncStorage.getItem('userData')) || '{}') || {}; } catch { user = {}; }
      const phoneDigits = String(pick(user.phoneNumber, user.phone, user.phone_number, user.mobile, '') || '').replace(/\D/g, '').slice(-10);
      setForm({
        ...emptyForm,
        patientName: String(pick(user.fullName, user.full_name, user.name, '') || ''),
        contactNumber: phoneDigits,
        dateOfBirth: toDateKeyOrEmpty(pick(user.dateOfBirth, user.date_of_birth, user.dob)),
        location: String(pick(typeof user.address === 'string' ? user.address : '', user.location, user.city, '') || ''),
        gender: normalizeGender(user.gender),
        email: String(pick(user.email, await AsyncStorage.getItem('userEmail'), '') || ''),
        appointmentDate: toDateKey(new Date()),
      });
    })();
  }, [visible]);

  // Doctor card + one "QR visit" record per scan (as the web page does).
  useEffect(() => {
    if (!visible || !doctorId) return undefined;
    let active = true;
    setDoctor(null);
    setDoctorLoading(true);
    axios.get(`${API}/auth/doctor-qr/${encodeURIComponent(doctorId)}`)
      .then(({ data }) => {
        if (!active) return;
        const found = data?.data?.doctor || data?.doctor || null;
        setDoctor(found);
        const visitKey = `${doctorId}-${Date.now()}`;
        if (found && visitRecorded.current !== doctorId) {
          visitRecorded.current = doctorId;
          axios.post(`${API}/auth/doctor-qr/${encodeURIComponent(doctorId)}/visits`, {
            visitId: `${visitKey}-${Math.random().toString(36).slice(2)}`,
            source,
          }).catch(() => {});
        }
      })
      .catch(() => { if (active) setDoctor(null); })
      .finally(() => { if (active) setDoctorLoading(false); });
    return () => { active = false; };
  }, [visible, doctorId, source]);

  useEffect(() => { if (!visible) visitRecorded.current = null; }, [visible]);

  const update = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '' }));
    setApiError('');
  };

  const validate = () => {
    const next = {};
    if (!form.patientName.trim()) next.patientName = 'Patient name is required';
    if (!/^\d{10}$/.test(form.contactNumber)) next.contactNumber = 'Enter a valid 10-digit number';
    if (!form.problem.trim()) next.problem = 'Please describe the problem';
    if (!form.dateOfBirth) next.dateOfBirth = 'Date of birth is required';
    if (!form.location.trim()) next.location = 'Location or address is required';
    if (!form.gender) next.gender = 'Gender is required';
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = 'Enter a valid email';
    // The API takes appointment_date and appointment_time together (or neither):
    // "Any time" is only possible for today; another day needs a time.
    const today = toDateKey(new Date());
    const visitDate = form.appointmentDate || today;
    if (visitDate < today) next.appointmentDate = 'Pick today or a later date';
    if (!form.appointmentTime && visitDate !== today) {
      next.appointmentTime = 'Pick a time for this date';
    } else if (form.appointmentTime && visitDate === today && form.appointmentTime <= toTimeKey(new Date())) {
      next.appointmentTime = 'That time has already passed. Pick a later time.';
    }
    setErrors(next);
    return !Object.keys(next).length;
  };

  const submit = async () => {
    if (submitting || !validate()) return;
    if (!doctorId) {
      setApiError('Doctor information is missing. Please scan the doctor QR code again.');
      return;
    }
    const age = calculateAge(form.dateOfBirth);
    const payload = {
      patient_name: form.patientName.trim(),
      phone_number: form.contactNumber.trim(),
      symptoms: form.problem.trim(),
      doctor_id: doctorId,
      date_of_birth: form.dateOfBirth,
      age: age ? Number(age) : undefined,
      location: form.location.trim(),
      gender: form.gender,
      // appointment_date (YYYY-MM-DD) and appointment_time (HH:MM, 24h) go
      // together, as the API requires; with "Any time" (today) neither is sent.
      appointment_date: form.appointmentTime ? (form.appointmentDate || toDateKey(new Date())) : undefined,
      appointment_time: form.appointmentTime || undefined,
      email: form.email.trim() || undefined,
      status: 'booked',
      booking_source: source,
    };
    try {
      setSubmitting(true);
      setApiError('');
      const response = await axios.post(`${API}/walkin-appointments`, payload, { headers: { 'Content-Type': 'application/json' } });
      const created = response.data?.data || response.data?.appointment || response.data || {};
      const tokenValue = pick(created.token_number, created.tokenNumber, created.walkin_token, created.queue_token, created.token, created.id, 'Booked');
      setToken(String(tokenValue));
    } catch (error) {
      setApiError(error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Unable to book walk-in appointment');
    } finally {
      setSubmitting(false);
    }
  };

  const onPick = (event, date) => {
    const which = picker;
    if (Platform.OS === 'android') setPicker(null);
    if (event?.type === 'dismissed' || !date || !which) return;
    if (which === 'dob') update('dateOfBirth', toDateKey(date));
    else if (which === 'visitDate') {
      update('appointmentDate', toDateKey(date));
      setErrors((current) => ({ ...current, appointmentTime: '' }));
    } else update('appointmentTime', toTimeKey(date));
  };

  const doctorName = doctor ? pick(doctor.full_name, doctor.fullName, doctor.name, 'Doctor') : '';
  const specialization = doctor
    ? (Array.isArray(doctor.specialization) ? doctor.specialization.join(', ') : doctor.specialization || '')
    : '';
  const age = calculateAge(form.dateOfBirth);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
        <View style={s.header}>
          <Pressable onPress={onClose} style={s.backBtn} hitSlop={10}>
            <Ionicons name="chevron-back" size={22} color="#0F172A" />
          </Pressable>
          <Text style={s.headerTitle}>Book Walk-in Visit</Text>
        </View>

        {token ? (
          <View style={s.successWrap}>
            <View style={s.successIcon}>
              <Ionicons name="checkmark" size={40} color="#FFFFFF" />
            </View>
            <Text style={s.successTitle}>Appointment Confirmed!</Text>
            {!!doctorName && <Text style={s.successDoctor} translate={false}>{doctorName}</Text>}
            <View style={s.tokenCard}>
              <Text style={s.tokenLabel}>YOUR TOKEN</Text>
              <Text style={s.tokenValue} translate={false}>{/^\d+$/.test(token) ? `#${token}` : token}</Text>
            </View>
            <Text style={s.successNote}>Show this token at the clinic reception. Carry a valid ID and any past reports.</Text>
            <Pressable onPress={onClose} style={s.primaryBtn}>
              <Text style={s.primaryBtnText}>Done</Text>
            </Pressable>
          </View>
        ) : (
          <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <View style={s.doctorCard}>
                <View style={s.doctorAvatar}>
                  <Ionicons name="medkit" size={20} color={PATIENT.primary} />
                </View>
                <View style={s.flex}>
                  {doctorLoading ? (
                    <ActivityIndicator color={PATIENT.primary} style={s.doctorLoading} />
                  ) : (
                    <>
                      <Text style={s.doctorName} numberOfLines={1} translate={!doctor}>{doctorName || 'Doctor'}</Text>
                      {!!specialization && <Text style={s.doctorSpec} numberOfLines={1}>{specialization}</Text>}
                    </>
                  )}
                </View>
              </View>
              <Text style={s.intro}>Fill in your details to get your appointment token.</Text>

              <Field label="Patient Name *" error={errors.patientName}>
                <TextInput style={s.input} value={form.patientName} onChangeText={(v) => update('patientName', v)} placeholder="Full name" placeholderTextColor="#94A3B8" />
              </Field>
              <Field label="Contact Number *" error={errors.contactNumber}>
                <TextInput style={s.input} value={form.contactNumber} onChangeText={(v) => update('contactNumber', v.replace(/\D/g, '').slice(0, 10))} placeholder="10-digit mobile number" placeholderTextColor="#94A3B8" keyboardType="phone-pad" maxLength={10} />
              </Field>
              <Field label="Medical Problem *" error={errors.problem}>
                <TextInput style={[s.input, s.multiline]} value={form.problem} onChangeText={(v) => update('problem', v)} placeholder="Describe your problem" placeholderTextColor="#94A3B8" multiline textAlignVertical="top" />
              </Field>

              <View style={s.row}>
                <View style={s.flex}>
                  <Field label="Date of Birth *" error={errors.dateOfBirth}>
                    <Pressable onPress={() => setPicker('dob')} style={[s.input, s.selectInput]}>
                      <Text style={form.dateOfBirth ? s.selectValue : s.placeholder}>{form.dateOfBirth ? formatDob(form.dateOfBirth) : 'Select date'}</Text>
                      <Ionicons name="calendar-outline" size={17} color={PATIENT.primary} />
                    </Pressable>
                  </Field>
                </View>
                <View style={s.ageBox}>
                  <Field label="Age">
                    <View style={[s.input, s.selectInput, s.readOnly]}>
                      <Text style={s.selectValue} translate={false}>{age || '—'}</Text>
                    </View>
                  </Field>
                </View>
              </View>

              <Field label="Location / Address *" error={errors.location}>
                <TextInput style={[s.input, s.multilineShort]} value={form.location} onChangeText={(v) => update('location', v)} placeholder="Your area or address" placeholderTextColor="#94A3B8" multiline textAlignVertical="top" />
              </Field>

              <Field label="Gender *" error={errors.gender}>
                <View style={s.chips}>
                  {GENDERS.map((g) => {
                    const on = form.gender === g.value;
                    return (
                      <Pressable key={g.value} onPress={() => update('gender', g.value)} style={[s.chip, on && s.chipOn]}>
                        <Text style={[s.chipText, on && s.chipTextOn]}>{g.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Field>

              <View style={s.row}>
                <View style={s.flex}>
                  <Field label="Preferred Date" error={errors.appointmentDate}>
                    <Pressable onPress={() => setPicker('visitDate')} style={[s.input, s.selectInput]}>
                      <Text style={s.selectValue}>{formatVisitDate(form.appointmentDate || toDateKey(new Date()))}</Text>
                      <Ionicons name="calendar-outline" size={17} color={PATIENT.primary} />
                    </Pressable>
                  </Field>
                </View>
                <View style={s.flex}>
                  <Field label="Preferred Time" error={errors.appointmentTime}>
                    <Pressable onPress={() => setPicker('time')} style={[s.input, s.selectInput]}>
                      <Text style={form.appointmentTime ? s.selectValue : s.placeholder}>
                        {form.appointmentTime
                          ? formatTime(form.appointmentTime)
                          : (form.appointmentDate && form.appointmentDate !== toDateKey(new Date()) ? 'Select time' : 'Any time')}
                      </Text>
                      <View style={s.timeActions}>
                        {!!form.appointmentTime && (
                          <Pressable onPress={() => update('appointmentTime', '')} hitSlop={8}>
                            <Ionicons name="close-circle" size={18} color="#94A3B8" />
                          </Pressable>
                        )}
                        <Ionicons name="time-outline" size={17} color={PATIENT.primary} />
                      </View>
                    </Pressable>
                  </Field>
                </View>
              </View>
              <Field label="Email (Optional)" error={errors.email}>
                <TextInput style={s.input} value={form.email} onChangeText={(v) => update('email', v)} placeholder="you@example.com" placeholderTextColor="#94A3B8" keyboardType="email-address" autoCapitalize="none" />
              </Field>

              {!!apiError && (
                <View style={s.errorBox}>
                  <Ionicons name="alert-circle" size={16} color="#B42318" />
                  <Text style={s.errorBoxText}>{apiError}</Text>
                </View>
              )}

              <Pressable onPress={submit} disabled={submitting} style={[s.primaryBtn, submitting && s.disabled]}>
                {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.primaryBtnText}>{t('Confirm Appointment')}</Text>}
              </Pressable>
              <Text style={s.expect}>You'll get your token instantly. Estimated wait is usually 15–30 minutes.</Text>
            </ScrollView>
          </KeyboardAvoidingView>
        )}

        {picker && (
          <DateTimePicker
            value={picker === 'dob'
              ? (form.dateOfBirth ? new Date(`${form.dateOfBirth}T00:00:00`) : new Date(2000, 0, 1))
              : picker === 'visitDate'
                ? new Date(`${form.appointmentDate || toDateKey(new Date())}T00:00:00`)
                : (form.appointmentTime ? new Date(`${form.appointmentDate || toDateKey(new Date())}T${form.appointmentTime}:00`) : new Date())}
            mode={picker === 'time' ? 'time' : 'date'}
            minimumDate={picker === 'visitDate' ? new Date() : undefined}
            maximumDate={picker === 'dob' ? new Date() : picker === 'visitDate' ? addDays(new Date(), BOOKING_WINDOW_DAYS) : undefined}
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={onPick}
          />
        )}
        {picker && Platform.OS === 'ios' && (
          <Pressable onPress={() => setPicker(null)} style={s.iosDone}><Text style={s.primaryBtnText}>Done</Text></Pressable>
        )}
      </SafeAreaView>
    </Modal>
  );
}

function Field({ label, error, children }) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      {children}
      {!!error && <Text style={s.error}>{error}</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: PATIENT.backgroundTint },
  flex: { flex: 1 },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E8ECF1' },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9', marginRight: 10 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  content: { padding: 16, paddingBottom: 32 },
  doctorCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFFFF', borderRadius: 14, borderWidth: 1, borderColor: '#DCEFE3', padding: 14 },
  doctorAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#E6F6EC', alignItems: 'center', justifyContent: 'center' },
  doctorLoading: { alignSelf: 'flex-start' },
  doctorName: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  doctorSpec: { fontSize: 12.5, color: '#64748B', marginTop: 2 },
  intro: { fontSize: 13, color: '#64748B', marginTop: 12, marginBottom: 6 },
  field: { marginTop: 12 },
  label: { fontSize: 12.5, fontWeight: '700', color: '#334155', marginBottom: 6 },
  input: { minHeight: 46, borderWidth: 1, borderColor: '#D5DCE5', borderRadius: 11, backgroundColor: '#FFFFFF', paddingHorizontal: 12, fontSize: 14.5, color: '#0F172A' },
  multiline: { minHeight: 92, paddingTop: 11 },
  multilineShort: { minHeight: 70, paddingTop: 11 },
  selectInput: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  readOnly: { backgroundColor: '#F1F5F9' },
  timeActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  selectValue: { fontSize: 14.5, color: '#0F172A' },
  placeholder: { fontSize: 14.5, color: '#94A3B8' },
  row: { flexDirection: 'row', gap: 10 },
  ageBox: { width: 90 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, height: 38, borderRadius: 19, borderWidth: 1, borderColor: '#D5DCE5', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: PATIENT.primary, borderColor: PATIENT.primary },
  chipText: { fontSize: 13.5, fontWeight: '600', color: '#334155' },
  chipTextOn: { color: '#FFFFFF' },
  error: { fontSize: 12, color: '#B42318', marginTop: 5 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF3F2', borderWidth: 1, borderColor: '#FECDCA', borderRadius: 10, padding: 11, marginTop: 16 },
  errorBoxText: { flex: 1, fontSize: 13, color: '#B42318' },
  primaryBtn: { height: 50, borderRadius: 14, backgroundColor: PATIENT.primary, alignItems: 'center', justifyContent: 'center', marginTop: 20, alignSelf: 'stretch' },
  primaryBtnText: { fontSize: 15.5, fontWeight: '800', color: '#FFFFFF' },
  disabled: { opacity: 0.6 },
  expect: { fontSize: 12, color: '#64748B', textAlign: 'center', marginTop: 10 },
  successWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  successIcon: { width: 76, height: 76, borderRadius: 38, backgroundColor: PATIENT.primary, alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: 21, fontWeight: '800', color: '#0F172A', marginTop: 16 },
  successDoctor: { fontSize: 14, color: '#64748B', marginTop: 4 },
  tokenCard: { marginTop: 22, paddingVertical: 18, paddingHorizontal: 40, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#BDE8CD', alignItems: 'center' },
  tokenLabel: { fontSize: 11.5, fontWeight: '800', letterSpacing: 1, color: '#64748B' },
  tokenValue: { fontSize: 40, fontWeight: '900', color: PATIENT.primary, marginTop: 4 },
  successNote: { fontSize: 13, color: '#64748B', textAlign: 'center', marginTop: 16, lineHeight: 19 },
  iosDone: { alignSelf: 'stretch', marginHorizontal: 16, marginBottom: 12, height: 46, borderRadius: 12, backgroundColor: PATIENT.primary, alignItems: 'center', justifyContent: 'center' },
});
