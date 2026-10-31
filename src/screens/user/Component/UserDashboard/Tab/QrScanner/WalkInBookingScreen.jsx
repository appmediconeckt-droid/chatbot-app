import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import DateTimePicker from '@react-native-community/datetimepicker';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import Text from '../../../../../../components/TranslatedText';
import TextInput from '../../../../../../components/TranslatedTextInput';
import PATIENT from '../../../../../../theme/palette';
import api, { API_BASE_URL } from '../../../../../../axiosConfig';
import { toImageUri } from '../../../../../../utils/imageUri';
import useLanguageRender from '../../../../../../hooks/useLanguageRender';
import CountryPhoneInput from '../../../../../../components/common/CountryPhoneInput';
import { buildInternationalPhoneNumber, isValidMobileNumber, phoneNumberError, splitInternationalPhoneNumber } from '../../../../../../utils/countryCodes';

const API = `${API_BASE_URL.replace(/\/+$/, '').replace(/\/api$/, '')}/api`;
const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
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
const formatTime = (key) => {
  if (!key) return '';
  const [h, m] = key.split(':').map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? 'PM' : 'AM'}`;
};

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const formatDateKey = (key) => {
  const [y, m, d] = String(key || '').split('-').map(Number);
  if (!y || !m || !d) return '';
  const date = new Date(Date.UTC(y, m - 1, d));
  return `${WEEKDAYS[date.getUTCDay()]}, ${MONTHS_SHORT[m - 1]} ${d}`;
};

const SLOT_BOOKED_MESSAGE = 'This slot is already booked. Please choose another time.';
// Re-read slots while the form is open so booked/passed slots drop out.
const SLOT_REFRESH_MS = 30000;

// Clinic slots are India time, like DoctorBookingModal.
const todayIndia = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
const nowMinutesIndia = () => {
  const d = new Date(Date.now() + 330 * 60000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
};
const toMinutes = (value) => {
  const m = String(value || '').match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const minutesToKey = (minutes) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
const isUnavailableFlag = (range) => range.is_unavailable === true || Number(range.is_unavailable) === 1;

// Every slot of the day across the given ranges, merged by start time (a
// date-specific range and the same weekly range give one slot each). Tokens
// restart at 1 in every session (availability range), as the backend issues
// them: with sessions 12:31–13:31 and 17:00–18:00, 17:45 is token 4, not 8.
const buildDaySlots = (ranges, date) => {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  const slots = new Map();
  // Earliest range first, so a slot belongs to the session that starts first.
  [...ranges].sort((a, b) => (toMinutes(a.start_time) ?? 0) - (toMinutes(b.start_time) ?? 0)).forEach((range) => {
    if (isUnavailableFlag(range)) return;
    const specificDate = String(range.availability_date || range.date || '').slice(0, 10);
    const applies = specificDate
      ? specificDate === date
      : range.weekday !== null && range.weekday !== undefined && range.weekday !== '' && Number(range.weekday) === weekday;
    if (!applies) return;
    const start = toMinutes(range.start_time);
    const end = toMinutes(range.end_time);
    const duration = Number(range.slot_duration);
    if (start === null || end === null || !Number.isInteger(duration) || duration < 1 || end <= start) return;
    for (let minute = start; minute + duration <= end; minute += duration) {
      if (!slots.has(minute)) slots.set(minute, { minutes: minute, duration, clinicId: range.clinic_id || null, session: start });
    }
  });
  const perSession = new Map();
  return [...slots.values()]
    .sort((a, b) => a.minutes - b.minutes)
    .map((slot) => {
      const token = (perSession.get(slot.session) || 0) + 1;
      perSession.set(slot.session, token);
      return { ...slot, time: minutesToKey(slot.minutes), token };
    });
};

// A clinic record's ids: availability ranges store the clinic's _id, while
// /api/qr/walkin and older rows may name it by id / clinic_id.
const clinicIdsOf = (clinic) => (clinic && typeof clinic === 'object'
  ? [clinic._id, clinic.id, clinic.clinic_id, clinic.clinicId].filter((v) => v !== undefined && v !== null && v !== '').map(String)
  : []);
const clinicNameOf = (clinic) => String(pick(clinic?.clinic_name, clinic?.name, clinic?.clinicName, '') || '');
const clinicAddressOf = (clinic) => String(pick(
  typeof clinic?.location === 'string' ? clinic.location : undefined, clinic?.address, clinic?.city, '',
) || '');

const SLOT_GROUPS = [
  { label: 'Morning', icon: 'sunny-outline', test: (m) => m < 720 },
  { label: 'Afternoon', icon: 'partly-sunny-outline', test: (m) => m >= 720 && m < 1020 },
  { label: 'Evening', icon: 'moon-outline', test: (m) => m >= 1020 },
];

const emptyForm = { patientName: '', contactNumber: '', phoneCountryCode: '+91', problem: '', dateOfBirth: '', location: '', gender: '', appointmentTime: '', email: '' };

export default function WalkInBookingScreen({
  visible, doctorId, clinicId: scannedClinicId = null, clinicName: scannedClinicName = '', source = 'qr', onClose,
}) {
  // Explicit insets: SafeAreaView inside this Modal (its own Android window)
  // could report 0, leaving the submit button under the navigation bar.
  const insets = useSafeAreaInsets();
  const { t } = useLanguageRender();
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [doctor, setDoctor] = useState(null);
  const [doctorLoading, setDoctorLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');
  const [token, setToken] = useState('');
  const [picker, setPicker] = useState(null); // 'dob' | null
  const [availability, setAvailability] = useState({ ranges: [], unavailableDates: [], bookedSlots: [] });
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState('');
  const [slotsReload, setSlotsReload] = useState(0);
  const [bookedTime, setBookedTime] = useState('');
  const [bookedClinicId, setBookedClinicId] = useState(null);
  const [clinics, setClinics] = useState([]);
  // Picked by the patient only when the QR doesn't name a clinic and the
  // doctor has more than one.
  const [chosenClinicId, setChosenClinicId] = useState(null);
  const visitRecorded = useRef(null);

  // Fresh form for every scan, pre-filled from the signed-in patient's profile.
  useEffect(() => {
    if (!visible) return;
    setErrors({});
    setApiError('');
    setToken('');
    setBookedTime('');
    setBookedClinicId(null);
    setChosenClinicId(null);
    (async () => {
      let user = {};
      try { user = JSON.parse((await AsyncStorage.getItem('userData')) || '{}') || {}; } catch { user = {}; }
      const phone = splitInternationalPhoneNumber(pick(user.phoneNumber, user.phoneNum, user.phone, user.phone_number, user.mobile, ''), user.phoneCountryCode);
      setForm({
        ...emptyForm,
        patientName: String(pick(user.fullName, user.full_name, user.name, '') || ''),
        contactNumber: phone.phoneNumber,
        phoneCountryCode: phone.countryCode,
        dateOfBirth: toDateKeyOrEmpty(pick(user.dateOfBirth, user.date_of_birth, user.dob)),
        location: String(pick(typeof user.address === 'string' ? user.address : '', user.location, user.city, '') || ''),
        gender: normalizeGender(user.gender),
        email: String(pick(user.email, await AsyncStorage.getItem('userEmail'), '') || ''),
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

  // The doctor's clinics, so the confirmation can name the booked slot's clinic.
  useEffect(() => {
    if (!visible || !doctorId) return undefined;
    let active = true;
    setClinics([]);
    api.get('/api/clinics', { params: { doctor_id: doctorId } })
      .then(({ data }) => {
        if (!active) return;
        setClinics(Array.isArray(data) ? data : data?.clinics || data?.data || []);
      })
      .catch(() => {});
    return () => { active = false; };
  }, [visible, doctorId]);

  // Doctor's availability + every booked slot (walk-in and online), re-read
  // every SLOT_REFRESH_MS while the form is open.
  useEffect(() => {
    if (!visible || !doctorId) return undefined;
    let active = true;
    const load = (initial) => {
      if (initial) { setSlotsLoading(true); setSlotsError(''); }
      axios.get(`${API}/availability/available`, { params: { doctor_id: doctorId } })
        .then(({ data }) => {
          if (!active) return;
          setAvailability({
            ranges: data?.availableRanges || data?.existingRanges || data?.data || [],
            unavailableDates: data?.unavailableDates || [],
            bookedSlots: data?.bookedSlots || [],
          });
          setSlotsError('');
        })
        .catch((err) => {
          if (active && initial) setSlotsError(err?.response?.data?.message || "Could not load today's slots.");
        })
        .finally(() => { if (active && initial) setSlotsLoading(false); });
    };
    load(true);
    const timer = setInterval(() => load(false), SLOT_REFRESH_MS);
    return () => { active = false; clearInterval(timer); };
  }, [visible, doctorId, slotsReload]);

  // The clinic this walk-in is for: the one the scanned QR names (each clinic
  // has its own QR), else the patient's pick, else the doctor's only clinic.
  // Only that clinic's slots are offered — never another clinic's.
  const scannedClinic = scannedClinicId
    ? clinics.find((c) => clinicIdsOf(c).includes(String(scannedClinicId)))
      || (scannedClinicName ? clinics.find((c) => clinicNameOf(c).trim().toLowerCase() === String(scannedClinicName).trim().toLowerCase()) : null)
    : null;
  const activeClinic = scannedClinicId
    ? scannedClinic || null
    : chosenClinicId
      ? clinics.find((c) => clinicIdsOf(c).includes(String(chosenClinicId))) || null
      : clinics.length === 1 ? clinics[0] : null;
  const activeClinicIds = new Set([
    ...(scannedClinicId ? [String(scannedClinicId)] : []),
    ...clinicIdsOf(activeClinic),
  ]);
  const activeClinicId = activeClinic ? clinicIdsOf(activeClinic)[0] : scannedClinicId ? String(scannedClinicId) : null;
  const activeClinicName = activeClinic ? clinicNameOf(activeClinic) : String(scannedClinicName || '');
  const needsClinicChoice = !scannedClinicId && clinics.length > 1 && !activeClinic;
  const inActiveClinic = (clinicId) => !clinicId || !activeClinicIds.size || activeClinicIds.has(String(clinicId));

  const today = todayIndia();
  const dayOff = availability.unavailableDates.some((item) =>
    inActiveClinic(item?.clinic_id) && String(item?.date || item?.unavailable_date || item).slice(0, 10) === today);
  // Only the active clinic's slots are offered, and each clinic numbers its own
  // tokens from 1 — the token the booking returns. Numbering across the
  // doctor's whole day counted the other clinic's slots too, so a doctor with
  // two matching schedules saw "Token 8" on a slot that booked as token 4.
  const daySlots = dayOff || needsClinicChoice ? [] : buildDaySlots(
    availability.ranges.filter((range) => inActiveClinic(range.clinic_id)), today,
  ).map((slot) => ({
    ...slot,
    clinicId: slot.clinicId || activeClinicId,
  }));
  const bookedMinutes = new Set(availability.bookedSlots
    .filter((slot) => String(slot?.date || '').slice(0, 10) === today)
    .map((slot) => toMinutes(slot.time))
    .filter((minutes) => minutes !== null));
  // A slot stays bookable until it ends (the running slot + everything after).
  const nowMinutes = nowMinutesIndia();
  const visibleSlots = daySlots.filter((slot) => slot.minutes + slot.duration > nowMinutes);
  const freeSlots = visibleSlots.filter((slot) => !bookedMinutes.has(slot.minutes));
  const slotGroups = SLOT_GROUPS
    .map((group) => ({ ...group, slots: visibleSlots.filter((slot) => group.test(slot.minutes)) }))
    .filter((group) => group.slots.length);
  const isTimeBooked = (time) => !!time && bookedMinutes.has(toMinutes(time));
  const selectedSlot = daySlots.find((slot) => slot.time === form.appointmentTime);

  // The chosen slot got booked by someone else or ran out while the form was open.
  useEffect(() => {
    if (!form.appointmentTime) return;
    if (isTimeBooked(form.appointmentTime)) {
      setForm((current) => ({ ...current, appointmentTime: '' }));
      setErrors((current) => ({ ...current, appointmentTime: SLOT_BOOKED_MESSAGE }));
    } else if (!visibleSlots.some((slot) => slot.time === form.appointmentTime)) {
      setForm((current) => ({ ...current, appointmentTime: '' }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availability]);

  const chooseSlot = (slot) => {
    if (bookedMinutes.has(slot.minutes)) {
      setErrors((current) => ({ ...current, appointmentTime: SLOT_BOOKED_MESSAGE }));
      return;
    }
    update('appointmentTime', slot.time);
  };

  const update = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: '' }));
    setApiError('');
  };

  const validate = () => {
    const next = {};
    if (!form.patientName.trim()) next.patientName = 'Patient name is required';
    if (!isValidMobileNumber(form.contactNumber, form.phoneCountryCode)) next.contactNumber = phoneNumberError(form.contactNumber, form.phoneCountryCode);
    if (!form.problem.trim()) next.problem = 'Please describe the problem';
    if (!form.dateOfBirth) next.dateOfBirth = 'Date of birth is required';
    if (!form.location.trim()) next.location = 'Location or address is required';
    if (!form.gender) next.gender = 'Gender is required';
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) next.email = 'Enter a valid email';
    if (needsClinicChoice) next.clinic = 'Please choose the clinic you are visiting';
    if (!form.appointmentTime) next.appointmentTime = 'Please choose a time slot';
    else if (isTimeBooked(form.appointmentTime)) next.appointmentTime = SLOT_BOOKED_MESSAGE;
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
    // The signed-in patient's account, so the doctor's Patients tab groups
    // this visit with their other bookings.
    let patientAccountId = null;
    try {
      const stored = JSON.parse((await AsyncStorage.getItem('userData')) || '{}') || {};
      patientAccountId = pick(await AsyncStorage.getItem('userId'), stored._id, stored.id) || null;
    } catch {
      patientAccountId = null;
    }
    const payload = {
      patient_name: form.patientName.trim(),
      phone_number: buildInternationalPhoneNumber(form.phoneCountryCode, form.contactNumber),
      symptoms: form.problem.trim(),
      doctor_id: doctorId,
      ...(patientAccountId ? { patient_id: String(patientAccountId) } : {}),
      date_of_birth: form.dateOfBirth,
      age: age ? Number(age) : undefined,
      location: form.location.trim(),
      gender: form.gender,
      // Walk-in is always today, at the chosen slot (the API needs both).
      appointment_date: todayIndia(),
      appointment_time: form.appointmentTime,
      email: form.email.trim() || undefined,
      status: 'booked',
      booking_source: source,
      // The clinic whose QR was scanned (or the one picked) — the visit is booked there.
      ...(activeClinicId ? { clinic_id: activeClinicId } : {}),
    };
    try {
      setSubmitting(true);
      setApiError('');
      const url = `${API}/walkin-appointments`;
      const options = { headers: { 'Content-Type': 'application/json' } };
      let response;
      try {
        response = await axios.post(url, payload, options);
      } catch (firstError) {
        const firstMessage = String(firstError?.response?.data?.message || firstError?.response?.data?.error || '');
        if (firstError?.response?.status !== 400) throw firstError;
        if (/clinic_id/i.test(firstMessage) && /not allowed|unknown/i.test(firstMessage)) {
          // An older walk-in API that doesn't take clinic_id: book without it.
          const { clinic_id: _unused, ...withoutClinic } = payload;
          response = await axios.post(url, withoutClinic, options);
        } else {
          throw firstError;
        }
      }
      const created = response.data?.data || response.data?.appointment || response.data || {};
      const tokenValue = pick(created.token_number, created.tokenNumber, created.walkin_token, created.queue_token, created.token, created.id, 'Booked');
      setBookedTime(form.appointmentTime);
      setBookedClinicId(activeClinicId || selectedSlot?.clinicId || null);
      Keyboard.dismiss();
      setToken(String(tokenValue));
    } catch (error) {
      const message = error?.response?.data?.message || error?.response?.data?.error || error?.message || 'Unable to book walk-in appointment';
      if (error?.response?.status === 409) {
        // Someone took this slot between loading the form and submitting.
        setForm((current) => ({ ...current, appointmentTime: '' }));
        setErrors((current) => ({ ...current, appointmentTime: SLOT_BOOKED_MESSAGE }));
        setSlotsReload((n) => n + 1);
      } else {
        setApiError(message);
      }
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

  const doctorName = doctor ? pick(doctor.full_name, doctor.fullName, doctor.name, 'Doctor') : '';
  const specialization = doctor
    ? (Array.isArray(doctor.specialization) ? doctor.specialization.join(', ') : doctor.specialization || '')
    : '';
  const age = calculateAge(form.dateOfBirth);
  const doctorPhoto = doctor
    ? toImageUri(pick(doctor.profilePhoto, doctor.profile_photo, doctor.profileImage, doctor.photo, doctor.image, doctor.avatar))
    : null;
  const bookedClinic = activeClinic
    || (bookedClinicId && clinics.find((clinic) => clinicIdsOf(clinic).includes(String(bookedClinicId))))
    || (clinics.length === 1 ? clinics[0] : null);
  const clinicSource = bookedClinic
    || (doctor ? pick(doctor.clinic, Array.isArray(doctor.clinics) ? doctor.clinics[0] : undefined) : undefined);
  const clinicName = typeof clinicSource === 'string'
    ? clinicSource
    : pick(clinicSource?.clinic_name, clinicSource?.name, clinicSource?.clinicName, activeClinicName, doctor?.clinic_name, doctor?.clinicName, '') || '';
  const clinicAddress = clinicSource && typeof clinicSource === 'object'
    ? pick(typeof clinicSource.location === 'string' ? clinicSource.location : undefined, clinicSource.address, clinicSource.city, '') || ''
    : '';
  const tokenLabel = /^\d+$/.test(token) ? `#${token}` : token;
  const bookedWhen = [formatDateKey(todayIndia()), bookedTime && formatTime(bookedTime)].filter(Boolean).join(' at ');

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={[s.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={s.header}>
          <Pressable onPress={onClose} style={s.backBtn} hitSlop={10}>
            <Ionicons name="chevron-back" size={22} color="#0F172A" />
          </Pressable>
          <Text style={s.headerTitle}>Book Walk-in Visit</Text>
        </View>

        {token ? (
          <ScrollView contentContainerStyle={s.successWrap} showsVerticalScrollIndicator={false}>
            <View style={s.successHalo}>
              <LinearGradient
                colors={[PATIENT.gradientFrom, PATIENT.gradientTo]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.successIcon}
              >
                <Ionicons name="checkmark" size={30} color="#FFFFFF" />
              </LinearGradient>
            </View>
            <Text style={s.successTitle}>Appointment Confirmed!</Text>
            <Text style={s.successSub}>
              Token Number: <Text translate={false} style={s.successSubStrong}>{tokenLabel}</Text>
            </Text>

            <View style={s.summaryCard}>
              <View style={s.summaryDoctor}>
                {doctorPhoto ? (
                  <Image source={{ uri: doctorPhoto }} style={s.summaryAvatar} />
                ) : (
                  <View style={[s.summaryAvatar, s.summaryAvatarFallback]}>
                    <Ionicons name="medkit" size={20} color={PATIENT.primary} />
                  </View>
                )}
                <View style={s.flex}>
                  <Text style={s.summaryDoctorName} numberOfLines={1} translate={false}>{doctorName || 'Doctor'}</Text>
                  {!!specialization && <Text style={s.summaryDoctorSpec} numberOfLines={1}>{specialization}</Text>}
                </View>
              </View>
              <View style={s.summaryDivider} />
              {!!form.patientName.trim() && (
                <SummaryRow label="Patient" value={form.patientName.trim()} />
              )}
              {!!bookedWhen && <SummaryRow label="Date & Time" value={bookedWhen} />}
              {!!clinicName && <SummaryRow label="Clinic" value={clinicName} sub={clinicAddress} />}
              <View style={s.summaryRow}>
                <Text style={s.summaryLabel}>Token</Text>
                <View style={s.tokenPill}>
                  <Text style={s.tokenPillText} translate={false}>{tokenLabel}</Text>
                </View>
              </View>
            </View>

            <Text style={s.successNote}>
              Show this token at the clinic reception. Carry a valid ID and any past reports.
            </Text>

            <Pressable onPress={onClose} style={s.doneBtnWrap}>
              <LinearGradient
                colors={[PATIENT.gradientFrom, PATIENT.gradientTo]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={s.doneBtn}
              >
                <Ionicons name="home-outline" size={18} color="#FFFFFF" />
                <Text style={s.primaryBtnText}>Done / Back to Home</Text>
              </LinearGradient>
            </Pressable>
          </ScrollView>
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
              {scannedClinicId || clinics.length === 1 ? (
                <View style={s.clinicCard}>
                  <View style={s.clinicIcon}>
                    <Ionicons name="business" size={18} color={PATIENT.primary} />
                  </View>
                  <View style={s.flex}>
                    <Text style={s.clinicLabel}>{scannedClinicId ? 'Clinic · Scanned QR' : 'Clinic'}</Text>
                    <Text style={s.clinicName} numberOfLines={1} translate={false}>{activeClinicName || 'Clinic'}</Text>
                    {!!clinicAddressOf(activeClinic) && (
                      <Text style={s.clinicAddress} numberOfLines={2} translate={false}>{clinicAddressOf(activeClinic)}</Text>
                    )}
                  </View>
                  {!!scannedClinicId && <Ionicons name="qr-code-outline" size={18} color={PATIENT.primary} />}
                </View>
              ) : clinics.length > 1 ? (
                <Field label="Which clinic are you visiting? *" error={errors.clinic}>
                  <View style={s.clinicChoices}>
                    {clinics.map((clinic) => {
                      const id = clinicIdsOf(clinic)[0];
                      const on = Boolean(activeClinic) && clinicIdsOf(activeClinic)[0] === id;
                      return (
                        <Pressable
                          key={id}
                          onPress={() => {
                            setChosenClinicId(id);
                            setForm((current) => ({ ...current, appointmentTime: '' }));
                            setErrors((current) => ({ ...current, clinic: '', appointmentTime: '' }));
                          }}
                          style={[s.clinicChoice, on && s.clinicChoiceOn]}
                        >
                          <Ionicons name="business-outline" size={16} color={on ? '#FFFFFF' : PATIENT.primary} />
                          <View style={s.flex}>
                            <Text style={[s.clinicChoiceName, on && s.clinicChoiceTextOn]} numberOfLines={1} translate={false}>{clinicNameOf(clinic) || 'Clinic'}</Text>
                            {!!clinicAddressOf(clinic) && (
                              <Text style={[s.clinicChoiceAddress, on && s.clinicChoiceTextOn]} numberOfLines={1} translate={false}>{clinicAddressOf(clinic)}</Text>
                            )}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </Field>
              ) : null}
              <Text style={s.intro}>Fill in your details to get your appointment token.</Text>

              <Field label="Patient Name *" error={errors.patientName}>
                <TextInput style={s.input} value={form.patientName} onChangeText={(v) => update('patientName', v)} placeholder="Full name" placeholderTextColor="#94A3B8" />
              </Field>
              <Field label="Contact Number *">
                <CountryPhoneInput value={form.contactNumber} countryCode={form.phoneCountryCode} onChangePhoneNumber={(v) => update('contactNumber', v)} onChangeCountryCode={(v) => update('phoneCountryCode', v)} accentColor="#0D9488" error={errors.contactNumber} />
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

              <Field label="Today's Available Slots *" error={errors.appointmentTime}>
                {slotsLoading ? (
                  <View style={s.slotState}><ActivityIndicator color={PATIENT.primary} /></View>
                ) : slotsError ? (
                  <View style={s.slotState}>
                    <Text style={s.slotStateText}>{slotsError}</Text>
                    <Pressable onPress={() => setSlotsReload((n) => n + 1)} style={s.retryBtn}>
                      <Text style={s.retryText}>Retry</Text>
                    </Pressable>
                  </View>
                ) : needsClinicChoice ? (
                  <View style={s.slotState}>
                    <Ionicons name="business-outline" size={26} color="#94A3B8" />
                    <Text style={s.slotStateTitle}>Choose a clinic first</Text>
                    <Text style={s.slotStateText}>Pick the clinic above to see its slots for today.</Text>
                  </View>
                ) : !freeSlots.length ? (
                  <View style={s.slotState}>
                    <Ionicons name="calendar-clear-outline" size={26} color="#94A3B8" />
                    <Text style={s.slotStateTitle}>No slots available today</Text>
                    <Text style={s.slotStateText}>All of today's slots are booked or the doctor isn't available today.</Text>
                  </View>
                ) : (
                  slotGroups.map((group) => (
                    <View key={group.label} style={s.slotGroup}>
                      <View style={s.slotGroupHead}>
                        <Ionicons name={group.icon} size={14} color="#64748B" />
                        <Text style={s.slotGroupLabel}>{group.label}</Text>
                      </View>
                      <View style={s.slotGrid}>
                        {group.slots.map((slot) => {
                          const booked = bookedMinutes.has(slot.minutes);
                          const on = form.appointmentTime === slot.time;
                          return (
                            <Pressable
                              key={slot.time}
                              onPress={() => chooseSlot(slot)}
                              style={[s.slot, on && s.slotOn, booked && s.slotBooked]}
                            >
                              <Text translate={false} style={[s.slotTime, on && s.slotTextOn, booked && s.slotTextBooked]}>
                                {formatTime(slot.time)}
                              </Text>
                              {booked ? (
                                <Text style={[s.slotToken, s.slotTextBooked]}>Booked</Text>
                              ) : (
                                <Text style={[s.slotToken, on && s.slotTextOn]}>Token <Text translate={false}>{slot.token}</Text></Text>
                              )}
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ))
                )}
              </Field>
              {!!selectedSlot && (
                <View style={s.selectedBox}>
                  <Ionicons name="ticket-outline" size={16} color={PATIENT.primary} />
                  <Text style={s.selectedText}>
                    Today at <Text translate={false}>{formatTime(selectedSlot.time)}</Text> · Token <Text translate={false}>{selectedSlot.token}</Text>
                  </Text>
                </View>
              )}
              <Field label="Email (Optional)" error={errors.email}>
                <TextInput style={s.input} value={form.email} onChangeText={(v) => update('email', v)} placeholder="you@example.com" placeholderTextColor="#94A3B8" keyboardType="email-address" autoCapitalize="none" />
              </Field>

              {!!apiError && (
                <View style={s.errorBox}>
                  <Ionicons name="alert-circle" size={16} color="#B42318" />
                  <Text style={s.errorBoxText}>{apiError}</Text>
                </View>
              )}

              <Pressable onPress={submit} disabled={submitting || !freeSlots.length} style={[s.primaryBtn, (submitting || !freeSlots.length) && s.disabled]}>
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
      </View>
    </Modal>
  );
}

function SummaryRow({ label, value, sub }) {
  return (
    <View style={s.summaryRow}>
      <Text style={s.summaryLabel}>{label}</Text>
      <View style={s.flex}>
        <Text style={s.summaryValue} translate={false}>{value}</Text>
        {!!sub && <Text style={s.summarySub} translate={false}>{sub}</Text>}
      </View>
    </View>
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
  clinicCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F0FBF4', borderRadius: 14, borderWidth: 1, borderColor: '#BBE7CC', padding: 12, marginTop: 10 },
  clinicIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  clinicLabel: { fontSize: 11.5, fontWeight: '700', color: '#15803D', textTransform: 'uppercase', letterSpacing: 0.3 },
  clinicName: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginTop: 1 },
  clinicAddress: { fontSize: 12.5, color: '#64748B', marginTop: 2 },
  clinicChoices: { gap: 8 },
  clinicChoice: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#BBE7CC', borderRadius: 12, backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 10 },
  clinicChoiceOn: { backgroundColor: PATIENT.primary, borderColor: PATIENT.primary },
  clinicChoiceName: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  clinicChoiceAddress: { fontSize: 12, color: '#64748B', marginTop: 1 },
  clinicChoiceTextOn: { color: '#FFFFFF' },
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
  slotState: { alignItems: 'center', gap: 6, paddingVertical: 18, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  slotStateTitle: { fontSize: 14.5, fontWeight: '800', color: '#334155' },
  slotStateText: { fontSize: 12.5, color: '#64748B', textAlign: 'center' },
  retryBtn: { marginTop: 4, paddingHorizontal: 18, height: 34, borderRadius: 17, borderWidth: 1, borderColor: PATIENT.primary, alignItems: 'center', justifyContent: 'center' },
  retryText: { fontSize: 13, fontWeight: '700', color: PATIENT.primary },
  slotGroup: { marginBottom: 10 },
  slotGroupHead: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 7 },
  slotGroupLabel: { fontSize: 12.5, fontWeight: '700', color: '#64748B' },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slot: { width: '31%', minHeight: 54, borderRadius: 11, borderWidth: 1, borderColor: '#D5DCE5', backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', paddingVertical: 7 },
  slotOn: { backgroundColor: PATIENT.primary, borderColor: PATIENT.primary },
  slotBooked: { backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' },
  slotTime: { fontSize: 13.5, fontWeight: '800', color: '#0F172A' },
  slotToken: { fontSize: 11.5, fontWeight: '600', color: PATIENT.primary, marginTop: 2 },
  slotTextOn: { color: '#FFFFFF' },
  slotTextBooked: { color: '#94A3B8', textDecorationLine: 'line-through' },
  selectedBox: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 4, padding: 10, borderRadius: 10, backgroundColor: '#ECFDF3', borderWidth: 1, borderColor: '#BDE8CD' },
  selectedText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#05603A' },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF3F2', borderWidth: 1, borderColor: '#FECDCA', borderRadius: 10, padding: 11, marginTop: 16 },
  errorBoxText: { flex: 1, fontSize: 13, color: '#B42318' },
  primaryBtn: { height: 50, borderRadius: 14, backgroundColor: PATIENT.primary, alignItems: 'center', justifyContent: 'center', marginTop: 20, alignSelf: 'stretch' },
  primaryBtnText: { fontSize: 15.5, fontWeight: '800', color: '#FFFFFF' },
  disabled: { opacity: 0.6 },
  expect: { fontSize: 12, color: '#64748B', textAlign: 'center', marginTop: 10 },
  // Centred in the area under the header; the extra bottom padding lifts it
  // to the screen's visual centre instead of sitting low.
  successWrap: { flexGrow: 1, alignItems: 'center', justifyContent: 'flex-start', paddingHorizontal: 20, paddingTop: 32, paddingBottom: 40 },
  successHalo: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#DCF7E5', alignItems: 'center', justifyContent: 'center' },
  successIcon: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  successTitle: { fontSize: 24, fontWeight: '900', color: '#0F172A', marginTop: 18, textAlign: 'center' },
  successSub: { fontSize: 14, color: '#64748B', marginTop: 6 },
  successSubStrong: { fontWeight: '800', color: '#0F172A' },
  summaryCard: { alignSelf: 'stretch', marginTop: 22, backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#E3F1E8', padding: 16, shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  summaryDoctor: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  summaryAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#E6F6EC' },
  summaryAvatarFallback: { alignItems: 'center', justifyContent: 'center' },
  summaryDoctorName: { fontSize: 16.5, fontWeight: '800', color: '#0F172A' },
  summaryDoctorSpec: { fontSize: 13, color: '#64748B', marginTop: 2 },
  summaryDivider: { height: 1, backgroundColor: '#EDF1F5', marginVertical: 14 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 8 },
  summaryLabel: { fontSize: 13.5, color: '#64748B' },
  summaryValue: { fontSize: 13.5, fontWeight: '700', color: '#0F172A', textAlign: 'right' },
  summarySub: { fontSize: 12, color: '#64748B', textAlign: 'right', marginTop: 2 },
  tokenPill: { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 999, backgroundColor: '#DCF7E5' },
  tokenPillText: { fontSize: 14, fontWeight: '900', color: PATIENT.primary },
  successNote: { fontSize: 13, color: '#64748B', textAlign: 'center', marginTop: 18, lineHeight: 19, paddingHorizontal: 8 },
  doneBtnWrap: { alignSelf: 'stretch', marginTop: 20, borderRadius: 14, overflow: 'hidden' },
  doneBtn: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  iosDone: { alignSelf: 'stretch', marginHorizontal: 16, marginBottom: 12, height: 46, borderRadius: 12, backgroundColor: PATIENT.primary, alignItems: 'center', justifyContent: 'center' },
});
