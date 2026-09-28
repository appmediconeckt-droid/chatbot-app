// Doctor appointment booking — port of the web
// UserDashboard/Tab/Appointment/AppointmentBookingModal.jsx (same API calls,
// same payload, same 3 steps) in the patient theme:
//   GET  /api/auth/getUser/:id                     patient info
//   GET  /api/clinics?doctor_id                    doctor's clinics
//   GET  /api/availability/available?doctor_id     slots (fallback /api/availability/ranges)
//   POST /api/appointments                         book (normal or emergency) → token number
// Steps: 1 select (clinic, mode, type, location, date, time) → 2 review &
// payment → 3 success with the token number.
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import Text from '../../../../../../components/TranslatedText';
import { PATIENT, PATIENT_GRADIENT } from '../../../../../../theme/palette';
import api from '../../../../../../axiosConfig';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const MODES = [
  { id: 'in-clinic', name: 'In-Clinic Visit', desc: 'Visit the clinic in person for consultation', icon: 'business-outline', fee: 0 },
  { id: 'video', name: 'Video Consultation', desc: 'Connect with doctor via video call', icon: 'videocam-outline', fee: 10 },
  { id: 'voice', name: 'Voice Consultation', desc: 'Talk with your doctor over a voice call', icon: 'call-outline', fee: 5 },
];

const PAYMENT_METHODS = [
  { id: 'Card', label: 'Credit/Debit Card', icon: 'card-outline' },
  { id: 'UPI', label: 'UPI Payment', icon: 'phone-portrait-outline' },
  { id: 'Cash', label: 'Cash at Clinic', icon: 'cash-outline' },
];

const pickFirst = (...values) => values.find((v) => v !== undefined && v !== null && v !== '');

// Clinic consultation fee shown when neither the clinic nor the doctor has a
// fee above 0 saved.
const DEFAULT_CONSULTATION_FEE = 500;
const firstPositiveFee = (...values) => {
  const fee = values.map(Number).find((v) => Number.isFinite(v) && v > 0);
  return fee ?? DEFAULT_CONSULTATION_FEE;
};

// "HH:MM" → "h:MM AM"
const formatRangeTime = (value) => {
  const m = String(value || '').match(/^(\d{1,2}):(\d{2})/);
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return '';
  const hour = Number(m[1]);
  return `${hour % 12 || 12}:${m[2]} ${hour >= 12 ? 'PM' : 'AM'}`;
};

const formatMinutes = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h % 12 || 12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

// "09:30 AM" → "09:30:00"
const to24Hour = (t) => {
  if (!t) return '09:00:00';
  const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return t.length === 5 ? `${t}:00` : t;
  let hour = parseInt(m[1], 10);
  const ampm = m[3].toUpperCase();
  if (ampm === 'PM' && hour !== 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  return `${String(hour).padStart(2, '0')}:${m[2]}:00`;
};

// India date (YYYY-MM-DD) for "today", like the web.
const todayIndia = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
// Minutes since midnight right now, India time (slots are clinic-local IST).
const nowMinutesIndia = () => {
  const d = new Date(Date.now() + 330 * 60000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
};

const isUnavailableFlag = (range) => range.is_unavailable === true || Number(range.is_unavailable) === 1;

// Clinic "Available Days" / "Timings" summary (web clinicSchedule.js).
const getClinicSchedule = (ranges, clinicId, unavailableDates = [], selectedIso = null) => {
  const today = todayIndia();
  const blocked = new Set(unavailableDates
    .filter((item) => !item?.clinic_id || String(item.clinic_id) === String(clinicId))
    .map((item) => String(item?.date || item?.unavailable_date || item).slice(0, 10)));
  const entries = ranges.flatMap((range) => {
    if (range.clinic_id && String(range.clinic_id) !== String(clinicId)) return [];
    if (isUnavailableFlag(range)) return [];
    const date = String(range.availability_date || range.date || '').slice(0, 10);
    if (date && (date < today || blocked.has(date))) return [];
    const weekday = date ? new Date(`${date}T00:00:00Z`).getUTCDay()
      : range.weekday != null && range.weekday !== '' ? Number(range.weekday) : null;
    const label = WEEKDAYS[weekday];
    const start = formatRangeTime(range.start_time);
    const end = formatRangeTime(range.end_time);
    if (!label || !start || !end) return [];
    return [{ weekday, date, time: `${start} – ${end}` }];
  });
  const dayNumbers = [...new Set(entries.map((e) => (e.weekday + 6) % 7))].sort((a, b) => a - b);
  const groups = [];
  dayNumbers.forEach((day) => {
    const last = groups[groups.length - 1];
    if (last && day === last[1] + 1) last[1] = day;
    else groups.push([day, day]);
  });
  const dayLabel = (day) => WEEKDAYS[(day + 1) % 7];
  const selectedWeekday = selectedIso ? new Date(`${selectedIso}T00:00:00Z`).getUTCDay() : null;
  const timingEntries = selectedIso
    ? entries.filter((e) => !blocked.has(selectedIso) && (e.date ? e.date === selectedIso : e.weekday === selectedWeekday))
    : entries;
  return {
    days: groups.map(([a, b]) => (a === b ? dayLabel(a) : `${dayLabel(a)} – ${dayLabel(b)}`)).join(', ') || 'No availability scheduled',
    timings: [...new Set(timingEntries.map((e) => e.time))].join(', ') || 'Not scheduled',
  };
};

const unwrapList = (data) => {
  if (Array.isArray(data)) return data;
  return data?.clinics || data?.data || [];
};

export default function DoctorBookingModal({ visible, doctorData, onClose, onBooked }) {
  const incoming = doctorData || {};
  const doctorId = pickFirst(incoming.id, incoming._id);
  const doctor = {
    id: doctorId,
    name: pickFirst(incoming.name, incoming.fullName, 'Doctor'),
    specialty: pickFirst(incoming.specialization, incoming.specialty, 'General'),
    experience: incoming.experience ? (/year/i.test(String(incoming.experience)) ? incoming.experience : `${incoming.experience} Years Exp`) : '',
    rating: Number(incoming.rating) > 0 ? Number(incoming.rating).toFixed(1) : null,
    languages: Array.isArray(incoming.languages) ? incoming.languages.join(', ') : (incoming.languages || ''),
    nextAvailable: incoming.nextAvailable || 'Today',
    consultationFee: firstPositiveFee(incoming.consultationFee, incoming.fee, incoming.consultation_fee),
    photo: typeof incoming.avatar === 'string' && /^(https?:|file:|data:)/.test(incoming.avatar) ? incoming.avatar : null,
  };

  const [step, setStep] = useState('select'); // select | payment | success
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [priority, setPriority] = useState('normal');
  const [emergencyReason, setEmergencyReason] = useState('');
  const [selectedClinicId, setSelectedClinicId] = useState(null);
  const [selectedModeId, setSelectedModeId] = useState('in-clinic');
  const [clinicOpen, setClinicOpen] = useState(false);
  const [modeOpen, setModeOpen] = useState(false);
  const [location, setLocation] = useState(incoming.location || '');
  const [apiClinics, setApiClinics] = useState([]);
  const [clinicsLoading, setClinicsLoading] = useState(false);
  const [ranges, setRanges] = useState([]);
  const [unavailableDates, setUnavailableDates] = useState([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [booking, setBooking] = useState(false);
  const [bookError, setBookError] = useState('');
  const [token, setToken] = useState(null);
  const [requestId, setRequestId] = useState('');
  const [patientInfo, setPatientInfo] = useState(null);
  const isEmergency = priority === 'emergency';

  // Reset everything each time the sheet opens for a doctor.
  useEffect(() => {
    if (!visible) return;
    setStep('select');
    setSelectedDate(null);
    setSelectedTime(null);
    setPriority('normal');
    setEmergencyReason('');
    setSelectedModeId('in-clinic');
    setClinicOpen(false);
    setModeOpen(false);
    setLocation(incoming.location || '');
    setPaymentMethod('Cash');
    setBookError('');
    setToken(null);
    setRequestId('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, doctorId]);

  // Patient info
  useEffect(() => {
    if (!visible) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const saved = JSON.parse((await AsyncStorage.getItem('userData')) || 'null');
        if (!cancelled && saved) setPatientInfo(saved);
        const id = pickFirst(await AsyncStorage.getItem('userId'), saved?._id, saved?.id);
        if (!id) return;
        const res = await api.get(`/api/auth/getUser/${id}`);
        const u = res.data?.user || res.data?.data || res.data;
        if (!cancelled && u) setPatientInfo(u);
      } catch { /* keep fallback */ }
    })();
    return () => { cancelled = true; };
  }, [visible]);

  // Clinics
  useEffect(() => {
    if (!visible || !doctorId) return undefined;
    let cancelled = false;
    setClinicsLoading(true);
    api.get('/api/clinics', { params: { doctor_id: doctorId } })
      .then((res) => {
        if (cancelled) return;
        const list = unwrapList(res.data);
        setApiClinics(list);
        setSelectedClinicId(list.length ? pickFirst(list[0]._id, list[0].id) : null);
      })
      .catch(() => { if (!cancelled) setApiClinics([]); })
      .finally(() => { if (!cancelled) setClinicsLoading(false); });
    return () => { cancelled = true; };
  }, [visible, doctorId]);

  // Availability
  useEffect(() => {
    if (!visible || !doctorId) return undefined;
    let cancelled = false;
    setAvailabilityLoading(true);
    const params = { doctor_id: doctorId };
    api.get('/api/availability/available', { params })
      .then((res) => {
        if (cancelled) return;
        setRanges(res.data?.availableRanges || res.data?.existingRanges || res.data?.data || []);
        setUnavailableDates(res.data?.unavailableDates || []);
      })
      .catch(() => api.get('/api/availability/ranges', { params })
        .then((res2) => {
          if (cancelled) return;
          setRanges(res2.data?.existingRanges || res2.data?.availableRanges || res2.data?.data || []);
          setUnavailableDates(res2.data?.unavailableDates || []);
        })
        .catch(() => {
          if (!cancelled) {
            setRanges([]);
            setUnavailableDates([]);
          }
        }))
      .finally(() => { if (!cancelled) setAvailabilityLoading(false); });
    return () => { cancelled = true; };
  }, [visible, doctorId]);

  useEffect(() => { setSelectedTime(null); }, [selectedClinicId]);

  // Tick while open so a slot that passes (e.g. 12:00 while you're choosing)
  // drops out of the list and can't be booked.
  const [clockTick, setClockTick] = useState(0);
  useEffect(() => {
    if (!visible) return undefined;
    const id = setInterval(() => setClockTick((n) => n + 1), 30000);
    return () => clearInterval(id);
  }, [visible]);

  const rangesForDate = (iso, weekday) => {
    const blocked = unavailableDates.some((item) =>
      (!item?.clinic_id || String(item.clinic_id) === String(selectedClinicId)) &&
      String(item?.date || item?.unavailable_date || item).slice(0, 10) === iso);
    if (blocked) return [];
    return ranges.filter((range) => {
      if (range.clinic_id && String(range.clinic_id) !== String(selectedClinicId)) return false;
      if (isUnavailableFlag(range)) return false;
      const rangeDate = String(range.date || range.availability_date || '').slice(0, 10);
      const recurrence = String(range.recurrence || '').toLowerCase();
      return rangeDate
        ? rangeDate === iso
        : recurrence !== 'date' && range.weekday != null && range.weekday !== '' && Number(range.weekday) === weekday;
    });
  };

  // Only current/future slots: on today, a slot is bookable while it hasn't
  // ended yet (the running slot + everything after it). Earlier ones are gone.
  const buildSlots = (iso, weekday) => {
    const cutoff = iso === todayIndia() ? nowMinutesIndia() : -1;
    const slots = new Map();
    rangesForDate(iso, weekday).forEach((range) => {
      if (!range.start_time || !range.end_time) return;
      const [sh, sm] = String(range.start_time).split(':').map(Number);
      const [eh, em] = String(range.end_time).split(':').map(Number);
      const start = sh * 60 + (sm || 0);
      const end = eh * 60 + (em || 0);
      const duration = Math.max(1, Number(range.slot_duration || 15));
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return;
      for (let cursor = start; cursor + duration <= end; cursor += duration) {
        if (cursor + duration > cutoff) slots.set(cursor, { time: formatMinutes(cursor), minutes: cursor });
      }
    });
    return Array.from(slots.values()).sort((a, b) => a.minutes - b.minutes);
  };
  const slotsForDate = (date) => (date ? buildSlots(date.iso, date.weekday) : []);

  const calendarDates = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(`${todayIndia()}T12:00:00`);
    d.setDate(d.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return {
      date: d.getDate(),
      day: WEEKDAYS[d.getDay()],
      label: `${MONTHS[d.getMonth()]} ${d.getDate()}`,
      iso,
      weekday: d.getDay(),
      status: buildSlots(iso, d.getDay()).length ? 'available' : 'unavailable',
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [ranges, unavailableDates, selectedClinicId, clockTick]);

  // Default to the first available day.
  useEffect(() => {
    if (availabilityLoading) return;
    const still = selectedDate && calendarDates.some((d) => d.iso === selectedDate.iso && d.status === 'available');
    if (!still) setSelectedDate(calendarDates.find((d) => d.status === 'available') || null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availabilityLoading, calendarDates]);


  const dateSlots = slotsForDate(selectedDate);
  useEffect(() => {
    if (selectedTime && !dateSlots.some((x) => x.time === selectedTime)) setSelectedTime(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clockTick, selectedDate?.iso]);
  const slotGroups = [
    { label: 'Morning', icon: 'sunny-outline', slots: dateSlots.filter((x) => x.minutes < 720) },
    { label: 'Afternoon', icon: 'partly-sunny-outline', slots: dateSlots.filter((x) => x.minutes >= 720 && x.minutes < 1020) },
    { label: 'Evening', icon: 'moon-outline', slots: dateSlots.filter((x) => x.minutes >= 1020) },
  ].filter((g) => g.slots.length);

  const clinics = apiClinics.length
    ? apiClinics.map((c, i) => ({
      id: pickFirst(c._id, c.id, `clinic-${i + 1}`),
      name: pickFirst(c.clinic_name, c.name, 'Clinic'),
      address: pickFirst(typeof c.location === 'string' ? c.location : undefined, c.address, c.city, 'Clinic Address'),
      phone: pickFirst(c.phone_number, c.phone, ''),
      ...(availabilityLoading
        ? { days: 'Loading availability...', timings: 'Loading availability...' }
        : getClinicSchedule(ranges, pickFirst(c._id, c.id), unavailableDates, selectedDate?.iso)),
      fee: firstPositiveFee(c.fee, c.consultation_fee, c.consultationFee, doctor.consultationFee),
    }))
    : [{ id: null, name: 'No clinic available', address: incoming.location || '', days: '—', timings: '—', fee: doctor.consultationFee }];
  const hasClinics = apiClinics.length > 0;
  const selectedClinic = clinics.find((c) => c.id === selectedClinicId) || clinics[0];
  const selectedMode = MODES.find((m) => m.id === selectedModeId) || MODES[0];
  const totalFee = (Number(selectedClinic?.fee) || 0) + (Number(selectedMode?.fee) || 0);

  // Regular bookings happen at the chosen clinic, so the location is the
  // clinic address (read-only). Emergency requests keep an editable location.
  useEffect(() => {
    if (selectedClinic?.address && !isEmergency) setLocation(selectedClinic.address);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClinic?.id, isEmergency]);

  const pt = patientInfo || {};
  const patientName = pickFirst(pt.full_name, pt.fullName, pt.name, 'You');
  const dateStr = selectedDate ? `${selectedDate.day}, ${selectedDate.label}` : '';
  const emergencyReady = Boolean(doctorId && selectedClinicId && !booking
    && emergencyReason.trim().length >= 10 && emergencyReason.trim().length <= 1000);
  const canContinue = !!selectedDate && !!selectedTime && hasClinics && !!location.trim();

  const confirmBooking = async () => {
    if (booking) return;
    if (isEmergency && !emergencyReady) {
      setBookError('Select a clinic and describe the emergency in 10 to 1000 characters.');
      return;
    }
    if (!hasClinics) {
      setBookError('This doctor has no clinic available, so the appointment cannot be booked.');
      return;
    }
    // The slot may have passed while the user was on the payment step.
    if (!isEmergency && !slotsForDate(selectedDate).some((x) => x.time === selectedTime)) {
      setSelectedTime(null);
      setStep('select');
      setBookError('That time slot has already passed. Please choose an upcoming slot.');
      return;
    }
    setBooking(true);
    setBookError('');
    const formattedTime = to24Hour(selectedTime);
    const patientId = pickFirst(await AsyncStorage.getItem('userId'), pt._id, pt.id);
    const payload = isEmergency
      ? {
        counselorId: doctorId,
        clinic_id: selectedClinic.id,
        priority: 'emergency',
        emergency_reason: emergencyReason.trim(),
        patient_location: (location || selectedClinic.address || '').trim() || null,
        consultation_mode: 'in-clinic',
      }
      : {
        doctor_id: doctorId,
        counselorId: doctorId,
        patient_id: patientId,
        appointment_date: selectedDate?.iso || null,
        appointment_time: formattedTime,
        date: `${selectedDate?.iso}T${formattedTime}+05:30`,
        clinic_id: selectedClinic.id,
        clinic: selectedClinic.name,
        location: location.trim(),
        patient_location: location.trim(),
        appointment_location: location.trim(),
        consultation_mode: selectedMode.id,
        fee: totalFee,
        payment_method: paymentMethod,
        notes: `Consultation: ${selectedMode.name} at ${selectedClinic.name}. Location: ${location.trim()}`,
        booking_source: 'online',
        priority,
      };
    try {
      const res = await api.post('/api/appointments', payload);
      const data = res.data?.data || res.data || {};
      setToken(pickFirst(data.token, data.token_number, data.queue_token, data.appointment?.token_number) ?? null);
      setRequestId(String(pickFirst(data._id, data.id, data.appointment?._id, '')));
      setStep('success');
      onBooked?.();
    } catch (err) {
      setBookError(err?.response?.data?.message || err?.message || 'Failed to book appointment. Please try again.');
    } finally {
      setBooking(false);
    }
  };

  // Web: success closes itself after 6 seconds.
  useEffect(() => {
    if (step !== 'success') return undefined;
    const t = setTimeout(() => onClose?.(), 6000);
    return () => clearTimeout(t);
  }, [step, onClose]);

  const header = (title, subtitle, onBack) => (
    <View style={s.header}>
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={8} style={s.headerBtn}><Ionicons name="chevron-back" size={22} color="#0F172A" /></Pressable>
      ) : <View style={s.headerBtn} />}
      <View style={s.flex}>
        <Text style={s.headerTitle}>{title}</Text>
        {!!subtitle && <Text style={s.headerSub}>{subtitle}</Text>}
      </View>
      <Pressable onPress={onClose} hitSlop={8} style={s.headerBtn}><Ionicons name="close" size={22} color="#0F172A" /></Pressable>
    </View>
  );

  const renderSuccess = () => (
    <View style={s.screen}>
      {header(isEmergency ? 'Request Sent' : 'Booked', '')}
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.successHero}>
          <View style={s.successIcon}><GradientFill /><Ionicons name="checkmark" size={38} color="#FFF" /></View>
          <Text style={s.successTitle}>{isEmergency ? 'Emergency Appointment Requested' : 'Appointment Booked Successfully!'}</Text>
          <Text style={s.successSub}>
            {isEmergency
              ? 'Your emergency request has been sent to the clinic for the doctor and care team to review. The clinic will confirm consultation timing.'
              : 'A confirmation notification with all the details has been generated for you.'}
          </Text>
        </View>
        <LinearGradient colors={PATIENT_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.tokenCard}>
          <View style={s.flex}>
            <Text style={s.tokenLabel}><Ionicons name="ticket-outline" size={13} color="#FFF" /> {isEmergency ? 'Request Status' : 'Token Number'}</Text>
            <Text style={s.tokenNote}>{isEmergency ? `Request ID: ${requestId}` : 'Arrive 15 minutes early'}</Text>
          </View>
          <Text style={s.tokenNum}>{isEmergency ? 'Sent' : token != null ? `#${token}` : 'Pending'}</Text>
        </LinearGradient>
        <View style={s.card}>
          <Row icon="person-outline" label="Patient" value={patientName} />
          <Row icon="medkit-outline" label="Doctor" value={doctor.name} />
          <Row icon="business-outline" label="Clinic" value={selectedClinic.name} />
          <Row icon="location-outline" label="Location" value={location || selectedClinic.address} />
          <Row icon={selectedMode.icon} label="Consultation Mode" value={selectedMode.name} />
          <Row icon="calendar-outline" label="Date" value={isEmergency ? 'Requested today' : dateStr} />
          <Row icon="time-outline" label="Time" value={isEmergency ? 'Clinic will confirm' : selectedTime} last />
          {!isEmergency && <View style={s.totalRow}><Text style={s.totalLabel}>Total Fee</Text><Text style={s.totalValue}>₹{totalFee}</Text></View>}
        </View>
        <Text style={s.closingNote}>You can follow your token live in the Token tab. Closing shortly…</Text>
        <GradientButton label="Done" icon="checkmark" onPress={onClose} />
      </ScrollView>
    </View>
  );

  const renderPayment = () => (
    <View style={s.screen}>
      {header('Review & Payment', 'Please review your appointment details before confirming', () => setStep('select'))}
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.card}>
          <Text style={s.cardTitle}><Ionicons name="calendar-outline" size={15} color={PATIENT.primary} /> Appointment Summary</Text>
          <Row icon="person-outline" label="Patient" value={patientName} />
          <Row icon="medkit-outline" label="Doctor" value={doctor.name} />
          <Row icon="business-outline" label="Clinic" value={selectedClinic.name} />
          <Row icon="location-outline" label="Location" value={location} />
          <Row icon={selectedMode.icon} label="Mode" value={selectedMode.name} />
          <Row icon="calendar-outline" label="Date" value={dateStr} />
          <Row icon="time-outline" label="Time" value={selectedTime} last />
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}><Ionicons name="wallet-outline" size={15} color={PATIENT.primary} /> Choose Payment Method</Text>
          {PAYMENT_METHODS.map((pm) => {
            const active = paymentMethod === pm.id;
            return (
              <Pressable key={pm.id} onPress={() => setPaymentMethod(pm.id)} style={[s.payMethod, active && s.payMethodActive]}>
                <View style={[s.payIcon, active && s.payIconActive]}>{active && <GradientFill />}<Ionicons name={pm.icon} size={17} color={active ? '#FFF' : PATIENT.primary} /></View>
                <Text style={[s.payLabel, active && s.payLabelActive]}>{pm.label}</Text>
                <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={20} color={active ? PATIENT.primary : '#CBD5E1'} />
              </Pressable>
            );
          })}
        </View>

        <View style={s.slotBanner}>
          <Ionicons name="ticket-outline" size={20} color={PATIENT.primary} />
          <View style={s.flex}>
            <Text style={s.slotBannerLabel}>Selected Appointment Slot</Text>
            <Text style={s.slotBannerValue}>{selectedTime}</Text>
            <Text style={s.slotBannerNote}>Your token follows this slot's position in the doctor's daily schedule. Arrive 15 minutes early.</Text>
          </View>
        </View>

        <View style={s.card}>
          <Text style={s.cardTitle}><Ionicons name="receipt-outline" size={15} color={PATIENT.primary} /> Fee Breakdown</Text>
          <View style={s.feeRow}><Text style={s.feeLabel}>Consultation Fee</Text><Text style={s.feeValue}>₹{selectedClinic.fee}</Text></View>
          {selectedMode.fee > 0 && (
            <View style={s.feeRow}><Text style={s.feeLabel}>{selectedMode.name}</Text><Text style={s.feeValue}>+₹{selectedMode.fee}</Text></View>
          )}
          <View style={s.totalRow}><Text style={s.totalLabel}>Total</Text><Text style={s.totalValue}>₹{totalFee}</Text></View>
        </View>

        <View style={s.infoBox}>
          <Ionicons name="information-circle-outline" size={16} color="#166534" />
          <Text style={s.infoText}>Your appointment will be reserved immediately upon confirmation. All details will be stored in your dashboard.</Text>
        </View>
        {!!bookError && <Text style={s.errorText}>{bookError}</Text>}
      </ScrollView>
      <View style={s.footer}>
        <GradientButton label={booking ? 'Booking…' : `Confirm & Book · ₹${totalFee}`} icon="lock-closed" onPress={confirmBooking} disabled={booking} loading={booking} />
      </View>
    </View>
  );

  const renderSelect = () => (
    <View style={s.screen}>
      {header('Book Appointment', doctor.name)}
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {/* Doctor card */}
        <View style={s.card}>
          <View style={s.doctorTop}>
            {doctor.photo ? (
              <Image source={{ uri: doctor.photo }} style={s.avatar} />
            ) : (
              <View style={[s.avatar, s.avatarInitials]}>
                <Text style={s.avatarText}>{String(doctor.name).replace(/^Dr\.?\s+/i, '').slice(0, 2).toUpperCase()}</Text>
              </View>
            )}
            <View style={s.flex}>
              <Text style={s.doctorName}>{doctor.name}</Text>
              <Text style={s.doctorMeta}>{[doctor.specialty, doctor.experience].filter(Boolean).join(' • ')}</Text>
              {!!doctor.rating && <Text style={s.doctorRating}>★ {doctor.rating}/5</Text>}
            </View>
          </View>
          <View style={s.badges}>
            {!!doctor.languages && <Badge icon="globe-outline" text={doctor.languages} />}
            <Badge icon="time-outline" text={`Next available: ${doctor.nextAvailable}`} />
          </View>
        </View>

        {/* Clinic details */}
        <View style={s.card}>
          <Text style={s.cardTitle}><Ionicons name="business-outline" size={15} color={PATIENT.primary} /> Clinic Details</Text>
          <Detail label="Location" value={selectedClinic.address || 'Not specified'} />
          <Detail label="Available Days" value={selectedClinic.days} />
          <Detail label="Timings" value={selectedClinic.timings} />
          <Detail label="Consultation Fee" value={`₹${selectedClinic.fee}`} />
        </View>

        {/* Clinic selector */}
        <Selector
          eyebrow="CLINIC"
          icon="business"
          value={clinicsLoading ? 'Loading clinics…' : selectedClinic.name}
          open={clinicOpen}
          onToggle={() => { setClinicOpen((o) => !o); setModeOpen(false); }}
        >
          {clinics.map((c) => (
            <Pressable
              key={c.id || c.name}
              style={[s.option, selectedClinicId === c.id && s.optionActive]}
              onPress={() => {
                if (booking) return;
                if (c.id) setSelectedClinicId(c.id);
                if (c.address) setLocation(c.address);
                setClinicOpen(false);
              }}
            >
              <View style={s.flex}>
                <Text style={s.optionName}>{c.name}</Text>
                <Text style={s.optionSub}>{c.address}</Text>
                <View style={s.tags}>
                  <Tag text={c.days} tone="blue" />
                  <Tag text={c.timings} tone="gray" />
                  <Tag text={`₹${c.fee}`} tone="green" />
                </View>
              </View>
              {selectedClinicId === c.id && <Ionicons name="checkmark-circle" size={20} color={PATIENT.primary} />}
            </Pressable>
          ))}
        </Selector>

        {/* Mode selector */}
        {!isEmergency && (
          <Selector
            eyebrow="CONSULTATION MODE"
            icon={selectedMode.icon.replace('-outline', '')}
            value={selectedMode.name}
            open={modeOpen}
            onToggle={() => { setModeOpen((o) => !o); setClinicOpen(false); }}
          >
            {MODES.map((m) => (
              <Pressable key={m.id} style={[s.option, selectedModeId === m.id && s.optionActive]} onPress={() => { setSelectedModeId(m.id); setModeOpen(false); }}>
                <View style={s.modeIcon}><Ionicons name={m.icon} size={18} color={PATIENT.primary} /></View>
                <View style={s.flex}>
                  <Text style={s.optionName}>{m.name}</Text>
                  <Text style={s.optionSub}>{m.desc}</Text>
                  <Text style={s.optionFee}>Additional Fee: ₹{m.fee}</Text>
                </View>
                {selectedModeId === m.id && <Ionicons name="checkmark-circle" size={20} color={PATIENT.primary} />}
              </Pressable>
            ))}
          </Selector>
        )}

        {/* Appointment type */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Appointment Type</Text>
          <View style={s.typeRow}>
            <Pressable style={[s.typeBtn, !isEmergency && s.typeBtnActive]} onPress={() => { setPriority('normal'); setSelectedTime(null); }} disabled={booking}>
              {!isEmergency && <GradientFill />}
              <Ionicons name="calendar-outline" size={16} color={!isEmergency ? '#FFF' : PATIENT.primary} />
              <Text style={[s.typeText, !isEmergency && s.typeTextActive]}>Regular</Text>
            </Pressable>
            <Pressable style={[s.typeBtn, isEmergency && s.typeBtnEmergency]} onPress={() => { setPriority('emergency'); setSelectedTime(null); setSelectedModeId('in-clinic'); }} disabled={booking}>
              {isEmergency && <GradientFill danger />}
              <Ionicons name="alert-circle-outline" size={16} color={isEmergency ? '#FFF' : '#DC2626'} />
              <Text style={[s.typeText, s.typeTextEmergency, isEmergency && s.typeTextActive]}>Emergency — send now</Text>
            </Pressable>
          </View>
          {isEmergency && (
            <View style={s.emergencyBox}>
              <Text style={s.fieldLabel}>Reason for emergency *</Text>
              <TextInput
                style={s.textArea}
                value={emergencyReason}
                onChangeText={setEmergencyReason}
                placeholder="Describe why you need an urgent appointment"
                placeholderTextColor="#94A3B8"
                multiline
                maxLength={1000}
                textAlignVertical="top"
              />
              <Text style={s.helpText}>
                {emergencyReason.trim().length}/1000 · at least 10 characters. No date, time slot or payment is needed. Your request alerts the doctor and the clinic's nurse/reception team, who confirm the timing.
              </Text>
            </View>
          )}
        </View>

        {/* Location */}
        <View style={s.card}>
          <Text style={s.fieldLabel}><Ionicons name="location-outline" size={13} color={PATIENT.primary} /> {isEmergency ? 'Your Location (optional)' : 'Appointment Location'}</Text>
          {isEmergency ? (
            <TextInput style={s.input} value={location} onChangeText={setLocation} placeholder="Enter area, address or clinic location" placeholderTextColor="#94A3B8" />
          ) : (
            <View style={s.inputLocked}>
              <Text style={s.inputLockedText} numberOfLines={2}>{location || selectedClinic?.address || 'Clinic address'}</Text>
            </View>
          )}
        </View>

        {/* Date + time */}
        {!isEmergency && (
          <View style={s.card}>
            <View style={s.dateHead}>
              <Text style={s.cardTitle}>Choose Appointment Date</Text>
              <Text style={s.monthLabel}>{new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dates}>
              {calendarDates.map((d) => {
                const selected = selectedDate?.iso === d.iso;
                const unavailable = d.status === 'unavailable';
                return (
                  <Pressable
                    key={d.iso}
                    disabled={unavailable}
                    onPress={() => { setSelectedDate(d); setSelectedTime(null); }}
                    style={[s.dateCard, unavailable && s.dateCardOff, selected && s.dateCardSelected]}
                  >
                    {selected && <GradientFill />}
                    <Text style={[s.dateDay, selected && s.dateTextSelected]}>{d.day}</Text>
                    <Text style={[s.dateNum, selected && s.dateTextSelected, unavailable && s.dateNumOff]}>{d.date}</Text>
                    <View style={[s.dateDot, unavailable ? s.dateDotOff : s.dateDotOn, selected && s.dateDotSelected]} />
                  </Pressable>
                );
              })}
            </ScrollView>

            {availabilityLoading ? (
              <View style={s.state}><ActivityIndicator color={PATIENT.primary} /><Text style={s.stateText}>Loading doctor availability...</Text></View>
            ) : !selectedDate ? (
              <View style={s.state}><Ionicons name="calendar-clear-outline" size={22} color="#94A3B8" /><Text style={s.stateText}>No upcoming slots at this clinic. Today's timings are over and the doctor hasn't opened slots for the next 7 days.</Text></View>
            ) : (
              <>
                <Text style={s.timesTitle}>Available Times for {selectedDate.day}, {selectedDate.label}</Text>
                {slotGroups.length ? slotGroups.map((g) => (
                  <View key={g.label} style={s.slotGroup}>
                    <Text style={s.slotGroupLabel}><Ionicons name={g.icon} size={13} color="#64748B" /> {g.label}</Text>
                    <View style={s.slots}>
                      {g.slots.map((slot) => {
                        const selected = selectedTime === slot.time;
                        return (
                          <Pressable key={slot.time} onPress={() => setSelectedTime(slot.time)} style={[s.slot, selected && s.slotSelected]}>
                            {selected && <GradientFill />}
                            <Text style={[s.slotText, selected && s.slotTextSelected]}>{slot.time}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                )) : (
                  <View style={s.state}><Ionicons name="time-outline" size={20} color="#94A3B8" /><Text style={s.stateText}>No specific time slots for this date.</Text></View>
                )}
              </>
            )}
          </View>
        )}

        {!hasClinics && !clinicsLoading && (
          <View style={s.warnBox}>
            <Ionicons name="alert-circle" size={16} color="#B45309" />
            <Text style={s.warnText}>This doctor has no clinic available yet, so booking isn't possible.</Text>
          </View>
        )}
        {!!bookError && <Text style={s.errorText}>{bookError}</Text>}
      </ScrollView>

      <View style={s.footer}>
        {!isEmergency && (
          <View style={s.footerSummary}>
            <Text style={s.footerSummaryText} numberOfLines={1}>
              {selectedDate && selectedTime ? `${dateStr} • ${selectedTime}` : 'Select a date and time'}
            </Text>
            <Text style={s.footerFee}>₹{totalFee}.00</Text>
          </View>
        )}
        {isEmergency ? (
          <GradientButton
            label={booking ? 'Sending Emergency Request…' : 'Send Emergency Request'}
            icon="alert-circle"
            danger
            onPress={confirmBooking}
            disabled={!emergencyReady || clinicsLoading}
            loading={booking}
          />
        ) : (
          <GradientButton label="Confirm Selection" icon="arrow-forward" onPress={() => canContinue && setStep('payment')} disabled={!canContinue} />
        )}
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={() => (step === 'payment' ? setStep('select') : onClose?.())}
    >
      {/* A Modal is its own native window: give it its own safe-area context so
          the header clears the status bar / notch and the footer clears the
          home indicator / gesture bar. */}
      <SafeAreaProvider>
        <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
          {step === 'success' ? renderSuccess() : step === 'payment' ? renderPayment() : renderSelect()}
        </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

// Same gradient as the "Confirm Selection" button, filling a selected chip.
// Sits behind the content; the parent clips it to its rounded corners.
function GradientFill({ danger }) {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={danger ? ['#DC2626', '#EF4444'] : PATIENT_GRADIENT}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={s.gradientFill}
    />
  );
}

function GradientButton({ label, icon, onPress, disabled, loading, danger }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[s.btnWrap, disabled && s.btnDisabled]}>
      <LinearGradient colors={danger ? ['#DC2626', '#EF4444'] : PATIENT_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.btn}>
        {loading ? <ActivityIndicator color="#FFF" /> : <Ionicons name={icon} size={17} color="#FFF" />}
        <Text style={s.btnText}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

function Selector({ eyebrow, icon, value, open, onToggle, children }) {
  return (
    <View style={s.selector}>
      <Pressable style={s.selectorHead} onPress={onToggle}>
        <View style={s.selectorIcon}><Ionicons name={icon} size={17} color={PATIENT.primary} /></View>
        <View style={s.flex}>
          <Text style={s.selectorEyebrow}>{eyebrow}</Text>
          <Text style={s.selectorValue} numberOfLines={1}>{value}</Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color="#64748B" />
      </Pressable>
      {open && <View style={s.selectorBody}>{children}</View>}
    </View>
  );
}

function Row({ icon, label, value, last }) {
  return (
    <View style={[s.row, last && s.rowLast]}>
      <Text style={s.rowLabel}><Ionicons name={icon} size={13} color="#64748B" /> {label}</Text>
      <Text style={s.rowValue} numberOfLines={2}>{value || '—'}</Text>
    </View>
  );
}

function Detail({ label, value }) {
  return (
    <Text style={s.detail}><Text style={s.detailKey}>{label}: </Text>{value}</Text>
  );
}

function Badge({ icon, text }) {
  return (
    <View style={s.badge}>
      <Ionicons name={icon} size={12} color={PATIENT.primary} />
      <Text style={s.badgeText} numberOfLines={1}>{text}</Text>
    </View>
  );
}

function Tag({ text, tone }) {
  return <Text style={[s.tag, s[`tag_${tone}`]]} numberOfLines={1}>{text}</Text>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  screen: { flex: 1, backgroundColor: '#F7F9FB' },
  flex: { flex: 1 },
  content: { padding: 14, paddingBottom: 24 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, paddingVertical: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  headerBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A', textAlign: 'center' },
  headerSub: { fontSize: 12, color: '#64748B', textAlign: 'center', marginTop: 1 },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#EEF2F6' },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  doctorTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 58, height: 58, borderRadius: 29 },
  avatarInitials: { backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '900', color: PATIENT.primary },
  doctorName: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  doctorMeta: { fontSize: 12.5, color: '#64748B', marginTop: 2 },
  doctorRating: { fontSize: 12.5, fontWeight: '800', color: '#D97706', marginTop: 3 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#EEF2F6' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#ECFDF3', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5, maxWidth: '100%' },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#166534' },
  detail: { fontSize: 13, color: '#334155', marginTop: 4, lineHeight: 19 },
  detailKey: { fontWeight: '800', color: '#0F172A' },
  selector: { backgroundColor: '#FFF', borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#EEF2F6', overflow: 'hidden' },
  selectorHead: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13 },
  selectorIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#ECFDF3', alignItems: 'center', justifyContent: 'center' },
  selectorEyebrow: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.5, color: '#64748B' },
  selectorValue: { fontSize: 15, fontWeight: '800', color: '#0F172A', marginTop: 1 },
  selectorBody: { borderTopWidth: 1, borderTopColor: '#EEF2F6', padding: 10, gap: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0' },
  optionActive: { borderColor: PATIENT.primary, backgroundColor: '#F0FDF4' },
  optionName: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  optionSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  optionFee: { fontSize: 12, fontWeight: '700', color: PATIENT.primary, marginTop: 3 },
  modeIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#ECFDF3', alignItems: 'center', justifyContent: 'center' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 },
  tag: { fontSize: 11, fontWeight: '700', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, overflow: 'hidden', maxWidth: '100%' },
  tag_blue: { color: '#1D4ED8', backgroundColor: '#EFF6FF' },
  tag_gray: { color: '#475569', backgroundColor: '#F1F5F9' },
  tag_green: { color: '#15803D', backgroundColor: '#DCFCE7' },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 12, borderWidth: 1.5, borderColor: '#D1D5DB', paddingHorizontal: 6 },
  typeBtnActive: { borderColor: 'transparent', overflow: 'hidden' },
  typeBtnEmergency: { borderColor: 'transparent', overflow: 'hidden' },
  typeText: { fontSize: 13, fontWeight: '800', color: PATIENT.primary, flexShrink: 1 },
  typeTextEmergency: { color: '#DC2626' },
  typeTextActive: { color: '#FFF' },
  emergencyBox: { marginTop: 12, backgroundColor: '#FEF2F2', borderRadius: 12, padding: 11 },
  fieldLabel: { fontSize: 13, fontWeight: '800', color: '#0F172A', marginBottom: 7 },
  textArea: { minHeight: 90, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#FECACA', borderRadius: 10, padding: 10, fontSize: 14, color: '#0F172A' },
  helpText: { fontSize: 11.5, lineHeight: 16, color: '#7F1D1D', marginTop: 6 },
  input: { height: 46, borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 12, fontSize: 14, color: '#0F172A' },
  inputLocked: { minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#F8FAFC' },
  inputLockedText: { flex: 1, fontSize: 14, color: '#334155', fontWeight: '600' },
  dateHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthLabel: { fontSize: 12.5, fontWeight: '700', color: '#64748B', marginBottom: 8 },
  dates: { gap: 8, paddingVertical: 4 },
  dateCard: { width: 58, paddingVertical: 10, borderRadius: 14, borderWidth: 1.5, borderColor: '#BBF7D0', backgroundColor: '#FFF', alignItems: 'center' },
  dateCardOff: { borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', opacity: 0.6 },
  dateCardSelected: { borderColor: 'transparent', overflow: 'hidden' },
  dateDay: { fontSize: 11.5, fontWeight: '700', color: '#64748B' },
  dateNum: { fontSize: 19, fontWeight: '900', color: '#0F172A', marginTop: 2 },
  dateNumOff: { color: '#94A3B8' },
  dateTextSelected: { color: '#FFF' },
  dateDot: { width: 6, height: 6, borderRadius: 3, marginTop: 5 },
  dateDotOn: { backgroundColor: '#22C55E' },
  dateDotOff: { backgroundColor: '#CBD5E1' },
  dateDotSelected: { backgroundColor: '#FFF' },
  state: { alignItems: 'center', gap: 6, paddingVertical: 18 },
  stateText: { fontSize: 13, color: '#64748B', textAlign: 'center' },
  timesTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginTop: 12, marginBottom: 6 },
  slotGroup: { marginTop: 8 },
  slotGroupLabel: { fontSize: 12.5, fontWeight: '700', color: '#64748B', marginBottom: 6 },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  slot: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5, borderColor: '#D1FAE5', backgroundColor: '#FFF' },
  slotSelected: { borderColor: 'transparent', overflow: 'hidden' },
  slotText: { fontSize: 12.5, fontWeight: '800', color: '#166534' },
  slotTextSelected: { color: '#FFF' },
  warnBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FEF3C7', borderRadius: 12, padding: 11, marginBottom: 12 },
  warnText: { flex: 1, fontSize: 12.5, color: '#92400E', fontWeight: '600' },
  errorText: { fontSize: 13, color: '#DC2626', fontWeight: '700', marginBottom: 10 },
  footer: { backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#E2E8F0', padding: 12, gap: 8 },
  footerSummary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerSummaryText: { flex: 1, fontSize: 12.5, color: '#475569', fontWeight: '600' },
  footerFee: { fontSize: 16, fontWeight: '900', color: PATIENT.primary },
  btnWrap: { borderRadius: 14, overflow: 'hidden' },
  btnDisabled: { opacity: 0.5 },
  btn: { height: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnText: { fontSize: 15, fontWeight: '800', color: '#FFF' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontSize: 13, color: '#64748B' },
  rowValue: { flexShrink: 1, fontSize: 13.5, fontWeight: '800', color: '#0F172A', textAlign: 'right' },
  payMethod: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 11, borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0', marginTop: 8 },
  payMethodActive: { borderColor: PATIENT.primary, backgroundColor: '#F0FDF4' },
  payIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#ECFDF3', alignItems: 'center', justifyContent: 'center' },
  payIconActive: { overflow: 'hidden' },
  payLabel: { flex: 1, fontSize: 14, fontWeight: '700', color: '#334155' },
  payLabelActive: { color: '#0F172A', fontWeight: '800' },
  slotBanner: { flexDirection: 'row', gap: 10, backgroundColor: '#ECFDF3', borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#BBF7D0' },
  slotBannerLabel: { fontSize: 12, fontWeight: '700', color: '#166534' },
  slotBannerValue: { fontSize: 22, fontWeight: '900', color: PATIENT.primary, marginTop: 2 },
  slotBannerNote: { fontSize: 12, lineHeight: 17, color: '#166534', marginTop: 4 },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  feeLabel: { fontSize: 13.5, color: '#475569' },
  feeValue: { fontSize: 13.5, fontWeight: '800', color: '#0F172A' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: 10, marginTop: 6, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  totalLabel: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  totalValue: { fontSize: 17, fontWeight: '900', color: PATIENT.primary },
  infoBox: { flexDirection: 'row', gap: 8, backgroundColor: '#F0FDF4', borderRadius: 12, padding: 11, marginBottom: 12 },
  infoText: { flex: 1, fontSize: 12, lineHeight: 17, color: '#166534' },
  successHero: { alignItems: 'center', paddingVertical: 12 },
  successIcon: { width: 72, height: 72, borderRadius: 36, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  gradientFill: { position: 'absolute', top: -2, left: -2, right: -2, bottom: -2 },
  successTitle: { fontSize: 19, fontWeight: '900', color: '#0F172A', marginTop: 12, textAlign: 'center' },
  successSub: { fontSize: 13, lineHeight: 19, color: '#475569', textAlign: 'center', marginTop: 6, paddingHorizontal: 10 },
  tokenCard: { flexDirection: 'row', alignItems: 'center', borderRadius: 18, padding: 16, marginVertical: 12 },
  tokenLabel: { fontSize: 13, fontWeight: '800', color: '#FFF' },
  tokenNote: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 3 },
  tokenNum: { fontSize: 34, fontWeight: '900', color: '#FFF' },
  closingNote: { fontSize: 12, color: '#64748B', textAlign: 'center', marginBottom: 12 },
});
