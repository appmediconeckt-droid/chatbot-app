// Walk-in booking opened straight from a doctor's QR code (patient side).
//   GET  /api/auth/doctor-qr/:doctorId          doctor shown at the top
//   POST /api/auth/doctor-qr/:doctorId/scan     records the QR scan (stats)
//   POST /api/appointments                      books today's in-clinic visit
// The visit is booked as the signed-in patient's appointment (booking_source
// 'qr'), not as an anonymous walk-in row: that links it to the patient, so it
// shows in My Token with its live queue, gets a token number from the
// server's slot service, and counts as a QR booking in the doctor's stats.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import DateTimePicker from '@react-native-community/datetimepicker';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Text from '../../../../../../components/TranslatedText';
import TextInput from '../../../../../../components/TranslatedTextInput';
import PATIENT from '../../../../../../theme/palette';
import { API_BASE_URL } from '../../../../../../axiosConfig';
import useLanguageRender from '../../../../../../hooks/useLanguageRender';
import axiosInstance from '../../../../../../axiosConfig';
import { bookedSlotKeys, ownBookedKeys, slotsForDay, upcomingDays } from '../../../../../../utils/doctorSlots';

// Walk-ins booked from this phone ({ doctorId, key: 'YYYY-MM-DD|minutes' }).
// Walk-in rows aren't returned to the patient by any API, so this is how a
// second scan still knows which of today's times the patient already took.
const WALKIN_BOOKED_KEY = 'walkinBookedSlots';
const readOwnWalkins = async () => {
  try {
    const list = JSON.parse((await AsyncStorage.getItem(WALKIN_BOOKED_KEY)) || '[]');
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};
const rememberOwnWalkin = async (doctorId, key) => {
  const today = upcomingDays(1)[0].iso;
  const list = (await readOwnWalkins()).filter((e) => String(e?.key || '').slice(0, 10) >= today);
  list.push({ doctorId: String(doctorId), key });
  try { await AsyncStorage.setItem(WALKIN_BOOKED_KEY, JSON.stringify(list)); } catch { /* best effort */ }
};

const SLOT_REFRESH_MS = 30000;

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

// '15:00' → '3:00 PM' (clinic timings from the QR profile).
const formatClock = (value) => {
  const [h, m] = String(value || '').split(':').map(Number);
  if (!Number.isFinite(h)) return String(value || '');
  return `${h % 12 || 12}:${pad(m || 0)} ${h >= 12 ? 'PM' : 'AM'}`;
};

const emptyForm = { patientName: '', contactNumber: '', problem: '', dateOfBirth: '', location: '', gender: '', appointmentDate: '', appointmentTime: '', email: '' };

// clinicId: set when the scanned QR is a clinic-wise booking QR, so the walk-in
// is booked at that clinic (old QRs without a clinic book as before).
export default function WalkInBookingScreen({ visible, doctorId, clinicId = null, source = 'qr', onClose }) {
  const { t } = useLanguageRender();
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [doctor, setDoctor] = useState(null);
  const [doctorLoading, setDoctorLoading] = useState(false);
  const [doctorProfile, setDoctorProfile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');
  const [token, setToken] = useState('');
  const [picker, setPicker] = useState(null); // 'dob' | null
  const visitRecorded = useRef(null);

  // Doctor's open slots (public availability API). A walk-in is booked only
  // on a free slot — no free-form time, so two patients can't pick the same
  // time and nobody books outside the doctor's hours.
  const [availability, setAvailability] = useState({ ranges: [], unavailableDates: [], bookedSlots: [] });
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState('');
  const [clockTick, setClockTick] = useState(0);

  const loadAvailability = useCallback(async () => {
    if (!doctorId) return;
    try {
      setSlotsLoading(true);
      setSlotsError('');
      const { data } = await axios.get(`${API}/availability/available`, {
        params: { doctor_id: doctorId, clinic_id: clinicId || undefined },
      });
      setAvailability({
        ranges: data?.availableRanges || data?.existingRanges || data?.data || [],
        unavailableDates: data?.unavailableDates || [],
        bookedSlots: data?.bookedSlots || [],
      });
    } catch (err) {
      setSlotsError('Could not load available slots. Pull to retry or try again.');
      setAvailability({ ranges: [], unavailableDates: [], bookedSlots: [] });
    } finally {
      setSlotsLoading(false);
    }
  }, [doctorId, clinicId]);

  useEffect(() => { if (visible) loadAvailability(); }, [visible, loadAvailability]);

  // Times this patient already holds with this doctor — never offered again:
  // their appointments (signed-in /api/appointments returns only their own),
  // walk-ins booked from this phone, and slots the server just refused.
  const [ownBooked, setOwnBooked] = useState(() => new Set());
  const loadOwnBookings = useCallback(async () => {
    if (!doctorId) return;
    const keys = new Set();
    (await readOwnWalkins()).forEach((e) => { if (String(e?.doctorId) === String(doctorId) && e?.key) keys.add(e.key); });
    try {
      const { data } = await axiosInstance.get('/api/appointments', { headers: { 'Cache-Control': 'no-cache' } });
      const list = Array.isArray(data) ? data : (data?.appointments || data?.data || []);
      ownBookedKeys(list, doctorId).forEach((k) => keys.add(k));
    } catch { /* signed out / offline: the server still guards */ }
    setOwnBooked((prev) => new Set([...prev, ...keys]));
  }, [doctorId]);
  useEffect(() => {
    if (!visible) return;
    setOwnBooked(new Set());
    loadOwnBookings();
  }, [visible, loadOwnBookings]);

  // Re-check every 30s so a slot that starts while the form is open drops out.
  useEffect(() => {
    if (!visible) return undefined;
    const id = setInterval(() => setClockTick((n) => n + 1), SLOT_REFRESH_MS);
    return () => clearInterval(id);
  }, [visible]);

  // A walk-in is for today (as on the web walk-in page), so only today's free
  // slots are offered — no day picker.
  const today = upcomingDays(1)[0];
  const daySlots = useMemo(() => {
    // Booked by anyone (when the server reports it) + held by this patient.
    const booked = new Set([...bookedSlotKeys(availability.bookedSlots, clinicId), ...ownBooked]);
    return slotsForDay({ ...availability, booked, clinicId, iso: today.iso, weekday: today.weekday });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availability, clinicId, clockTick, today.iso, ownBooked]);
  const hasAnySlot = daySlots.length > 0;

  // Keep the visit on today and drop a picked slot that is no longer free
  // (booked / started while the form was open).
  useEffect(() => {
    if (!visible || slotsLoading) return;
    setForm((cur) => {
      const keepTime = cur.appointmentTime && daySlots.some((x) => x.time24 === cur.appointmentTime);
      if (cur.appointmentDate === today.iso && (keepTime || !cur.appointmentTime)) return cur;
      return { ...cur, appointmentDate: today.iso, appointmentTime: keepTime ? cur.appointmentTime : '' };
    });
  }, [visible, slotsLoading, daySlots, today.iso]);

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
    // Public doctor profile for the card: photo, specialization, clinics with
    // today's timings. Optional — the card falls back to the QR details.
    setDoctorProfile(null);
    axios.get(`${API}/qr/doctors/${encodeURIComponent(doctorId)}/profile`)
      .then(({ data }) => { if (active) setDoctorProfile(data?.data || null); })
      .catch(() => {});
    axios.get(`${API}/auth/doctor-qr/${encodeURIComponent(doctorId)}`)
      .then(({ data }) => {
        if (!active) return;
        // The server sends the doctor's fields straight in `data` (fullName,
        // name, …); older ones nested them under `doctor`. Reading only
        // `.doctor` left the card saying "Doctor" instead of the name.
        const payload = data?.data || data || {};
        const found = payload.doctor || (payload.fullName || payload.name ? payload : null);
        setDoctor(found);
        const visitKey = `${doctorId}-${Date.now()}`;
        if (found && visitRecorded.current !== doctorId) {
          visitRecorded.current = doctorId;
          axios.post(`${API}/auth/doctor-qr/${encodeURIComponent(doctorId)}/scan`, {
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
    // A walk-in needs one of the doctor's free slots.
    if (!hasAnySlot) next.appointmentTime = 'No walk-in slots are left for today. Please contact the clinic.';
    else if (!form.appointmentTime) next.appointmentTime = 'Pick an available time slot';
    else if (!daySlots.some((x) => x.time24 === form.appointmentTime)) {
      next.appointmentTime = 'That slot is no longer available. Please pick another.';
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
    // Patient details the doctor should see with the visit (the appointment
    // itself is tied to the signed-in account).
    const details = [
      `Patient: ${form.patientName.trim()}`,
      `Phone: ${form.contactNumber.trim()}`,
      age ? `Age: ${age}` : '',
      form.gender ? `Gender: ${form.gender}` : '',
      form.email.trim() ? `Email: ${form.email.trim()}` : '',
    ].filter(Boolean).join(' | ');
    const payload = {
      doctor_id: doctorId,
      counselorId: doctorId,
      clinic_id: clinicId || undefined,
      // The chosen slot: appointment_date (YYYY-MM-DD) + appointment_time (HH:MM, 24h, IST).
      appointment_date: form.appointmentDate,
      appointment_time: form.appointmentTime,
      symptoms: form.problem.trim(),
      notes: `Walk-in (QR). ${details}. Problem: ${form.problem.trim()}`,
      patient_location: form.location.trim(),
      consultation_mode: 'in-clinic',
      booking_source: source === 'qr' ? 'qr' : 'direct',
    };
    try {
      setSubmitting(true);
      setApiError('');
      const response = await axiosInstance.post('/api/appointments', payload);
      const created = response.data?.data || response.data?.appointment || response.data || {};
      const tokenValue = pick(created.token_number, created.tokenNumber, created.walkin_token, created.queue_token, created.token, created.id, 'Booked');
      setToken(String(tokenValue));
      // Remember it so this time isn't offered to this patient again today.
      const [h, m] = form.appointmentTime.split(':').map(Number);
      rememberOwnWalkin(doctorId, `${form.appointmentDate}|${h * 60 + m}`);
    } catch (error) {
      const message = error?.response?.data?.message || error?.response?.data?.error || error?.message || '';
      // The server refused this exact time (taken / duplicate): hide the slot
      // straight away so it can't be picked again, then refresh the list.
      if (error?.response?.status === 409 || /already|booked|taken|slot|duplicate/i.test(message)) {
        const [h, m] = form.appointmentTime.split(':').map(Number);
        setOwnBooked((prev) => new Set(prev).add(`${form.appointmentDate}|${h * 60 + m}`));
        setForm((cur) => ({ ...cur, appointmentTime: '' }));
        setApiError('That time was just booked. Please pick another slot.');
      } else {
        setApiError(message || 'Unable to book walk-in appointment');
      }
      loadAvailability();
    } finally {
      setSubmitting(false);
    }
  };

  const onPick = (event, date) => {
    const which = picker;
    if (Platform.OS === 'android') setPicker(null);
    if (event?.type === 'dismissed' || !date || !which) return;
    if (which === 'dob') update('dateOfBirth', toDateKey(date));
  };


  const rawDoctorName = pick(
    doctorProfile?.name, doctorProfile?.fullName,
    doctor?.full_name, doctor?.fullName, doctor?.name,
  ) || '';
  // "Dr. Vijay" — without doubling a title the name already carries.
  const doctorName = rawDoctorName ? (/^dr\.?\s/i.test(rawDoctorName) ? rawDoctorName : `Dr. ${rawDoctorName}`) : '';
  const specRaw = pick(doctorProfile?.specialization, doctor?.specialization);
  const specialization = (Array.isArray(specRaw) ? specRaw.filter(Boolean).join(' · ') : specRaw || '').trim();
  const qualification = String(pick(doctorProfile?.qualification, doctor?.qualification, '') || '');
  const doctorPhoto = pick(doctorProfile?.profilePhoto?.url, typeof doctorProfile?.profilePhoto === 'string' ? doctorProfile.profilePhoto : undefined);
  const doctorInitials = rawDoctorName.replace(/^dr\.?\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'Dr';
  // The clinic this walk-in is for (the QR's clinic, or the only one).
  const profileClinics = Array.isArray(doctorProfile?.clinics) ? doctorProfile.clinics : [];
  const visitClinic = profileClinics.find((c) => clinicId && String(c.clinicId || c.clinic?.id) === String(clinicId))
    || (profileClinics.length === 1 ? profileClinics[0] : null);
  const clinicAddress = typeof visitClinic?.clinic?.address === 'string'
    ? visitClinic.clinic.address
    : Object.values(visitClinic?.clinic?.address || {}).filter((v) => typeof v === 'string' && v).join(', ');
  const todayTimings = (visitClinic?.timings || [])
    .filter((tm) => (tm.date ? String(tm.date).slice(0, 10) === today.iso : Number(tm.weekday) === today.weekday))
    .map((tm) => `${formatClock(tm.startTime)} – ${formatClock(tm.endTime)}`);
  const age = calculateAge(form.dateOfBirth);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
        <View style={s.header}>
          <Pressable onPress={onClose} style={s.backBtn} hitSlop={10}>
            <Ionicons name="chevron-back" size={22} color="#0F172A" />
          </Pressable>
          <View style={s.flex}>
            <Text style={s.headerTitle}>Book Walk-in Visit</Text>
            {!!doctorName && <Text translate={false} style={s.headerSub} numberOfLines={1}>with {doctorName}</Text>}
          </View>
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
              {/* Doctor card: who the patient is booking with, where and when. */}
              <LinearGradient colors={[PATIENT.gradientFrom, PATIENT.gradientTo]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.doctorCard}>
                <View style={s.doctorDecoLg} />
                <View style={s.doctorDecoSm} />
                <View style={s.doctorTop}>
                  <View style={s.doctorAvatar}>
                    {doctorPhoto
                      ? <Image source={{ uri: doctorPhoto }} style={s.doctorPhoto} />
                      : <Text translate={false} style={s.doctorInitials}>{doctorInitials}</Text>}
                  </View>
                  <View style={s.flex}>
                    {doctorLoading && !doctorName ? (
                      <ActivityIndicator color="#FFFFFF" style={s.doctorLoading} />
                    ) : (
                      <>
                        <View style={s.doctorNameRow}>
                          <Text translate={false} style={s.doctorName} numberOfLines={1}>{doctorName || 'Doctor'}</Text>
                          {!!doctorName && <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />}
                        </View>
                        <Text translate={false} style={s.doctorSpec} numberOfLines={1}>
                          {[specialization, qualification].filter(Boolean).join('  ·  ') || 'Doctor'}
                        </Text>
                      </>
                    )}
                  </View>
                  <View style={s.walkinBadge}>
                    <Ionicons name="walk-outline" size={12} color="#FFFFFF" />
                    <Text style={s.walkinBadgeText}>Walk-in</Text>
                  </View>
                </View>
                {!!visitClinic && (
                  <View style={s.doctorInfoBox}>
                    <View style={s.doctorInfoRow}>
                      <Ionicons name="business-outline" size={15} color="#FFFFFF" />
                      <Text translate={false} style={s.doctorInfoStrong} numberOfLines={1}>{visitClinic.clinic?.name}</Text>
                    </View>
                    {!!clinicAddress && (
                      <View style={s.doctorInfoRow}>
                        <Ionicons name="location-outline" size={15} color="rgba(255,255,255,0.9)" />
                        <Text translate={false} style={s.doctorInfoText} numberOfLines={2}>{clinicAddress}</Text>
                      </View>
                    )}
                    <View style={s.doctorInfoRow}>
                      <Ionicons name="time-outline" size={15} color="rgba(255,255,255,0.9)" />
                      <Text style={s.doctorInfoText} numberOfLines={1}>
                        {todayTimings.length ? `Today ${todayTimings.join(', ')}` : 'Today'}
                      </Text>
                    </View>
                  </View>
                )}
              </LinearGradient>
              <Text style={s.intro}>Fill in your details and pick a slot to get today's token.</Text>

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

              {/* Today's free slots (a walk-in is for today). */}
              <Field label="Today's Available Slots *" error={errors.appointmentTime}>
                {slotsLoading ? (
                  <View style={s.slotState}><ActivityIndicator color={PATIENT.primary} /><Text style={s.slotStateText}>Loading available slots...</Text></View>
                ) : slotsError ? (
                  <View style={s.slotState}>
                    <Text style={s.slotStateText}>{slotsError}</Text>
                    <Pressable onPress={loadAvailability} style={s.retryBtn}><Text style={s.retryText}>Retry</Text></Pressable>
                  </View>
                ) : !hasAnySlot ? (
                  <View style={s.slotState}>
                    <Ionicons name="calendar-clear-outline" size={22} color="#94A3B8" />
                    <Text style={s.slotStateText}>No walk-in slots are left for today. Please contact the clinic reception.</Text>
                  </View>
                ) : (
                  <View style={s.slotGrid}>
                    {daySlots.map((slot) => {
                      const on = slot.time24 === form.appointmentTime;
                      return (
                        <Pressable key={slot.time24} onPress={() => update('appointmentTime', slot.time24)} style={[s.slot, on && s.slotOn]}>
                          <Text translate={false} style={[s.slotText, on && s.slotTextOn]}>{slot.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </Field>
              <Field label="Email (Optional)" error={errors.email}>
                <TextInput style={s.input} value={form.email} onChangeText={(v) => update('email', v)} placeholder="you@example.com" placeholderTextColor="#94A3B8" keyboardType="email-address" autoCapitalize="none" />
              </Field>

              {!!apiError && (
                <View style={s.errorBox}>
                  <Ionicons name="alert-circle" size={16} color="#B42318" />
                  <Text style={s.errorBoxText}>{apiError}</Text>
                </View>
              )}

              <Pressable onPress={submit} disabled={submitting || (!slotsLoading && !hasAnySlot)} style={[s.primaryBtn, (submitting || (!slotsLoading && !hasAnySlot)) && s.disabled]}>
                {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.primaryBtnText}>{t('Confirm Appointment')}</Text>}
              </Pressable>
              <Text style={s.expect}>You'll get your token instantly. Estimated wait is usually 15–30 minutes.</Text>
            </ScrollView>
          </KeyboardAvoidingView>
        )}

        {picker && (
          <DateTimePicker
            value={form.dateOfBirth ? new Date(`${form.dateOfBirth}T00:00:00`) : new Date(2000, 0, 1)}
            mode="date"
            maximumDate={new Date()}
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
  // Visit slot picker
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: { width: '31.5%', paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: '#CBD5E1', backgroundColor: '#FFFFFF', alignItems: 'center' },
  slotOn: { borderColor: PATIENT.primary, backgroundColor: PATIENT.primary },
  slotText: { fontSize: 13.5, fontWeight: '700', color: '#0F172A' },
  slotTextOn: { color: '#FFFFFF' },
  slotState: { alignItems: 'center', gap: 8, paddingVertical: 16, paddingHorizontal: 12, borderRadius: 12, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  slotStateText: { fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 18 },
  retryBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: PATIENT.primary },
  retryText: { fontSize: 13, fontWeight: '700', color: PATIENT.primary },
  screen: { flex: 1, backgroundColor: PATIENT.backgroundTint },
  flex: { flex: 1 },
  header: { height: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E8ECF1' },
  backBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9', marginRight: 10 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  content: { padding: 16, paddingBottom: 32 },
  headerSub: { fontSize: 12.5, fontWeight: '600', color: PATIENT.primary, marginTop: 1 },
  doctorCard: { borderRadius: 20, padding: 16, overflow: 'hidden', shadowColor: '#0F172A', shadowOpacity: 0.16, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
  doctorDecoLg: { position: 'absolute', width: 160, height: 160, borderRadius: 80, right: -50, top: -70, backgroundColor: 'rgba(255,255,255,0.12)' },
  doctorDecoSm: { position: 'absolute', width: 80, height: 80, borderRadius: 40, left: -25, bottom: -35, backgroundColor: 'rgba(255,255,255,0.10)' },
  doctorTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  doctorAvatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.22)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.65)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  doctorPhoto: { width: '100%', height: '100%' },
  doctorInitials: { fontSize: 19, fontWeight: '800', color: '#FFFFFF' },
  doctorLoading: { alignSelf: 'flex-start' },
  doctorNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  doctorName: { flexShrink: 1, fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  doctorSpec: { fontSize: 12.5, fontWeight: '600', color: 'rgba(255,255,255,0.9)', marginTop: 2 },
  walkinBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.22)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  walkinBadgeText: { fontSize: 11, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.3 },
  doctorInfoBox: { marginTop: 14, padding: 11, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.16)', gap: 7 },
  doctorInfoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  doctorInfoStrong: { flex: 1, fontSize: 14, fontWeight: '800', color: '#FFFFFF' },
  doctorInfoText: { flex: 1, fontSize: 12.5, lineHeight: 17, fontWeight: '500', color: 'rgba(255,255,255,0.92)' },
  intro: { fontSize: 13, color: '#64748B', marginTop: 12, marginBottom: 6 },
  field: { marginTop: 12 },
  label: { fontSize: 12.5, fontWeight: '700', color: '#334155', marginBottom: 6 },
  input: { minHeight: 46, borderWidth: 1, borderColor: '#D5DCE5', borderRadius: 11, backgroundColor: '#FFFFFF', paddingHorizontal: 12, fontSize: 14.5, color: '#0F172A' },
  multiline: { minHeight: 92, paddingTop: 11 },
  multilineShort: { minHeight: 70, paddingTop: 11 },
  selectInput: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  readOnly: { backgroundColor: '#F1F5F9' },
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
