// Doctor appointment booking — port of the web
// UserDashboard/Tab/Appointment/AppointmentBookingModal.jsx (same API calls,
// same payload, same 3 steps) in the patient theme:
//   GET  /api/auth/getUser/:id                     patient info
//   GET  /api/clinics?doctor_id                    doctor's clinics
//   GET  /api/availability/available?doctor_id     slots (fallback /api/availability/ranges)
//   POST /api/appointments                         book a regular doctor appointment
//   /api/payments/...                              card / UPI / wallet payment (utils/providerPayments)
//   GET  /api/wallet/data                          wallet balance, for paying from the wallet
// Steps: 1 select (clinic, mode, type, location, date, time) → 2 review &
// payment → 3 success with the token number. A card / UPI booking reaches the
// success step only after Razorpay checkout is paid and verified; a wallet
// booking once the server has debited the wallet.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Image, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import Text from '../../../../../../components/TranslatedText';
import { PATIENT, PATIENT_GRADIENT } from '../../../../../../theme/palette';
import api from '../../../../../../axiosConfig';
import { bookedSlotKeys, bookingWindowDays } from '../../../../../../utils/doctorSlots';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { feeCurrencyOf, formatFee } from '../../../../../../utils/consultationCurrency';
import { isOnlinePayment, isWalletPayment, methodRefused, paymentDisplayMethodsForBooking, paymentMethodGroups, paymentMethodsForBooking, payForAppointment, SLOT_RELEASED, useProviderPaymentOptions, useWalletBalance } from '../../../../../../utils/providerPayments';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const BOOK_FAILED = "Couldn't Book Appointment";
const PAY_FAILED = 'Payment Not Completed';
const PAYMENT_OPTIONS_REFRESH_MS = 10000;

// A doctor is booked in the clinic or by video only (no voice consultation).
const MODES = [
  { id: 'in-clinic', name: 'In-Clinic Visit', desc: 'Visit the clinic in person for consultation', icon: 'business-outline', fee: 0 },
  { id: 'video', name: 'Video Consultation', desc: 'Connect with doctor via video call', icon: 'videocam-outline', fee: 0 },
];

const pickFirst = (...values) => values.find((v) => v !== undefined && v !== null && v !== '');

// A fee the doctor saved in their profile (0 is a valid "no extra" charge),
// or null when they never set one.
const savedFee = (...values) => {
  const fee = values.find((v) => v !== undefined && v !== null && v !== '' && Number.isFinite(Number(v)));
  return fee != null ? Math.max(0, Number(fee)) : null;
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

// Slot key "YYYY-MM-DD|minutes" (clinic-local IST) of an existing appointment.
const bookingSlotKey = (apt) => {
  let iso = String(apt?.appointment_date || apt?.appointmentDate || '').slice(0, 10);
  let time = String(apt?.appointment_time || apt?.appointmentTime || '');
  if ((!iso || !time) && Number.isFinite(Date.parse(apt?.date))) {
    const ist = new Date(Date.parse(apt.date) + 330 * 60000).toISOString();
    iso = iso || ist.slice(0, 10);
    time = time || ist.slice(11, 16);
  }
  if (!time) return null;
  const [h, m] = to24Hour(time).split(':').map(Number);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || !Number.isFinite(h) || !Number.isFinite(m)) return null;
  return `${iso}|${h * 60 + m}`;
};
const isSameDoctor = (apt, doctorId) => String(pickFirst(
  apt?.counselor?._id, apt?.counselor?.id, typeof apt?.counselor === 'string' ? apt.counselor : undefined,
  apt?.counselorId, apt?.doctor_id, apt?.doctorId, apt?.doctor?._id, apt?.doctor?.id,
) || '') === String(doctorId);
const INACTIVE_BOOKING_STATUSES = new Set(['cancelled', 'canceled', 'rejected', 'completed', 'no-show', 'no_show']);

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

// onAddMoney: opens the patient's Wallet (Add Money) when the balance is too
// low to pay from the wallet; the button is hidden without it.
export default function DoctorBookingModal({ visible, doctorData, onClose, onBooked, onAddMoney }) {
  const incoming = doctorData || {};
  const doctorId = pickFirst(incoming.id, incoming._id);
  const doctor = {
    id: doctorId,
    name: pickFirst(incoming.name, incoming.fullName, 'Doctor'),
    specialty: pickFirst(incoming.specialization, incoming.specialty, ''),
    experience: incoming.experience ? (/year/i.test(String(incoming.experience)) ? incoming.experience : `${incoming.experience} Years Exp`) : '',
    rating: Number(incoming.rating) > 0 ? Number(incoming.rating).toFixed(1) : null,
    languages: Array.isArray(incoming.languages) ? incoming.languages.join(', ') : (incoming.languages || ''),
    nextAvailable: incoming.nextAvailable || '',
    // The fee saved in the doctor's profile before fees moved to clinics; only
    // a clinic that has no fee of its own yet still charges it.
    consultationFee: savedFee(incoming.consultationFee, incoming.fee, incoming.consultation_fee),
    // Every amount on this sheet is in the currency the doctor chose.
    currency: feeCurrencyOf(incoming) || 'INR',
    photo: typeof incoming.avatar === 'string' && /^(https?:|file:|data:)/.test(incoming.avatar) ? incoming.avatar : null,
  };

  const [step, setStep] = useState('select'); // select | payment | success
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
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
  const [paymentMethod, setPaymentMethod] = useState('');
  // The booked appointment still waiting for its card / UPI payment.
  const [requestId, setRequestId] = useState(null);
  // Bookings whose checkout took money (confirmation failed): never released.
  const chargedRef = useRef(new Set());
  const paymentOptions = useProviderPaymentOptions(doctorId, visible);
  const refreshPaymentOptions = paymentOptions.refresh;
  const wallet = useWalletBalance(visible);
  const [booking, setBooking] = useState(false);
  // { title, message, addMoney? } popup shown when Confirm & Book is blocked;
  // `addMoney` adds an Add Money button (wallet balance too low).
  const [bookAlert, setBookAlert] = useState(null);
  const [token, setToken] = useState(null);
  const [patientInfo, setPatientInfo] = useState(null);

  // Payment preferences can be changed from the doctor's device while this
  // sheet is open. Refresh silently while visible and immediately on resume.
  useEffect(() => {
    if (!visible) return undefined;
    const refresh = () => refreshPaymentOptions();
    const timer = setInterval(refresh, PAYMENT_OPTIONS_REFRESH_MS);
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearInterval(timer);
      appStateSub.remove();
    };
  }, [visible, refreshPaymentOptions]);

  // Reset everything each time the sheet opens for a doctor.
  useEffect(() => {
    if (!visible) return;
    setStep('select');
    setSelectedDate(null);
    setSelectedTime(null);
    setSelectedModeId('in-clinic');
    setClinicOpen(false);
    setModeOpen(false);
    setLocation(incoming.location || '');
    setPaymentMethod('');
    setRequestId(null);
    setBookAlert(null);
    setToken(null);
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
        // Times already taken by anyone, when the server reports them.
        setServerBooked(bookedSlotKeys(res.data?.bookedSlots, null));
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

  // Times this patient already has an active booking with this doctor. The
  // server refuses a second one ("This patient already has a booking with this
  // doctor at the selected date and time"), so those slots aren't offered.
  const [bookedSlots, setBookedSlots] = useState(() => new Set());
  const [serverBooked, setServerBooked] = useState(() => new Set());
  useEffect(() => {
    if (!visible || !doctorId) return undefined;
    let cancelled = false;
    setBookedSlots(new Set());
    api.get('/api/appointments', { headers: { 'Cache-Control': 'no-cache' } })
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res.data) ? res.data : (res.data?.appointments || res.data?.data || []);
        const keys = new Set();
        list.forEach((apt) => {
          if (!isSameDoctor(apt, doctorId) || INACTIVE_BOOKING_STATUSES.has(String(apt?.status || '').toLowerCase())) return;
          const key = bookingSlotKey(apt);
          if (key) keys.add(key);
        });
        setBookedSlots(keys);
      })
      .catch(() => { /* server still guards against a duplicate */ });
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
        const bookable = cursor > cutoff;
        if (bookable && !bookedSlots.has(`${iso}|${cursor}`) && !serverBooked.has(`${iso}|${cursor}`)) slots.set(cursor, { time: formatMinutes(cursor), minutes: cursor });
      }
    });
    return Array.from(slots.values()).sort((a, b) => a.minutes - b.minutes);
  };
  const slotsForDate = (date) => (date ? buildSlots(date.iso, date.weekday) : []);

  // Today through the last day of next month (India time), so the patient
  // can book into next month too.
  const calendarDates = useMemo(() => Array.from({ length: bookingWindowDays() }, (_, i) => {
    const d = new Date(`${todayIndia()}T12:00:00`);
    d.setDate(d.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return {
      date: d.getDate(),
      day: WEEKDAYS[d.getDay()],
      label: `${MONTHS[d.getMonth()]} ${d.getDate()}`,
      month: MONTHS[d.getMonth()],
      monthLong: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      iso,
      weekday: d.getDay(),
      status: buildSlots(iso, d.getDay()).length ? 'available' : 'unavailable',
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [ranges, unavailableDates, selectedClinicId, clockTick, selectedModeId, bookedSlots, serverBooked]);

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
  }, [clockTick, selectedDate?.iso, selectedModeId, bookedSlots, serverBooked]);

  // Both consultation modes show the same doctor-configured methods. The only
  // restriction is currency compatibility for the INR app wallet.
  const paymentMethods = paymentMethodsForBooking(paymentOptions.methods, doctor.currency);
  // Every method the doctor turned on, unusable ones shown disabled with the
  // server's reason (web ProviderPaymentChoices).
  const paymentGroups = paymentMethodGroups(paymentDisplayMethodsForBooking(paymentOptions.displayMethods, doctor.currency)
    .map((pm) => (pm.unavailableReason || paymentMethods.some((m) => m.id === pm.id) ? pm : { ...pm, unavailableReason: 'Not available for this booking.' })));
  const testMode = paymentOptions.mode === 'test';
  const methodsKey = paymentMethods.map((pm) => pm.id).join(',');
  const onlinePayment = isOnlinePayment(paymentMethod);
  useEffect(() => {
    // A booked appointment waiting for payment keeps the method it was booked with.
    if (requestId) return;
    if (!paymentMethods.some((pm) => pm.id === paymentMethod)) setPaymentMethod(paymentMethods[0]?.id || '');
  // paymentMethod: reopening the sheet clears it while the methods are unchanged.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [methodsKey, requestId, paymentMethod]);
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
      // A fee the doctor set for this clinic (Edit Clinic, 0 = free there)
      // wins over the profile fee, so one clinic can charge less or more.
      fee: savedFee(c.fee, c.consultation_fee, c.consultationFee) ?? doctor.consultationFee,
    }))
    : [{ id: null, name: 'No clinic available', address: incoming.location || '', days: '—', timings: '—', fee: doctor.consultationFee }];
  const hasClinics = apiClinics.length > 0;
  const selectedClinic = clinics.find((c) => c.id === selectedClinicId) || clinics[0];
  const modes = MODES;
  const selectedMode = modes.find((m) => m.id === selectedModeId) || modes[0];
  const totalFee = Number(selectedClinic?.fee) || 0;
  const money = (amount) => formatFee(Number(amount) || 0, doctor.currency);
  const feeText = (amount) => amount == null ? 'Not configured' : money(amount);
  const hasConfiguredFee = selectedClinic?.fee != null;

  // Regular bookings happen at the chosen clinic, so the location is the
  // clinic address (read-only).
  useEffect(() => {
    if (selectedClinic?.address) setLocation(selectedClinic.address);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClinic?.id]);

  const pt = patientInfo || {};
  const patientName = pickFirst(pt.full_name, pt.fullName, pt.name, 'You');
  const dateStr = selectedDate ? `${selectedDate.day}, ${selectedDate.label}` : '';
  const canContinue = !!selectedDate && !!selectedTime && hasClinics && hasConfiguredFee && !!location.trim();

  // Card / UPI: Razorpay checkout, where the patient enters their details.
  // Wallet: the server debits the wallet, no checkout.
  const pay = async (appointmentId) => {
    const result = await payForAppointment(appointmentId, paymentMethod, {
      name: pickFirst(pt.full_name, pt.fullName, pt.name),
      email: pt.email,
      contact: pickFirst(pt.phoneNumber, pt.phone, pt.phoneNum),
    });
    if (walletPayment) {
      if (result?.walletBalance != null) wallet.setBalance(result.walletBalance);
      else wallet.reload();
    }
    return result;
  };

  // Paying from the wallet needs the whole fee in it. Unknown balance (it
  // couldn't load): the server decides.
  const walletPayment = isWalletPayment(paymentMethod);
  const walletShortBy = wallet.balance != null ? Math.max(0, totalFee - wallet.balance) : 0;
  const walletTooLow = (pm) => isWalletPayment(pm) && walletShortBy > 0;
  const requestCharged = !!requestId && chargedRef.current.has(requestId);
  const openAddMoney = () => {
    setBookAlert(null);
    onClose?.();
    onAddMoney?.();
  };

  // Payment for the reserved booking didn't go through. When no money moved
  // (checkout closed or failed), the booking is cancelled
  // (PATCH /api/appointments/:id/cancel, as My Appointments does) so nothing
  // stays booked unpaid and the slot is free again. If the payment may have
  // gone through (confirmation pending), the booking is kept for a retry.
  // Cancels a reserved, unpaid booking. A refused cancel (e.g. 409: the server
  // already released it after the failed payment) is checked against the
  // patient's appointments: one that is gone or inactive counts as released.
  // Resolves { released, message } — message is the server's refusal.
  const releaseReservation = async (appointmentId) => {
    const id = String(appointmentId);
    try {
      await api.patch(`/api/appointments/${encodeURIComponent(id)}/cancel`, { source: 'online' });
      return { released: true, message: '' };
    } catch (error) {
      if (error?.response) console.warn('[booking] cancel refused', error.response.status, JSON.stringify(error.response.data));
      const message = error?.response?.data?.message || error?.response?.data?.error || '';
      try {
        const res = await api.get('/api/appointments', { headers: { 'Cache-Control': 'no-cache' } });
        const list = Array.isArray(res.data) ? res.data : (res.data?.appointments || res.data?.data || []);
        const apt = list.find((a) => String(pickFirst(a?._id, a?.id, a?.appointment_id)) === id);
        if (!apt || INACTIVE_BOOKING_STATUSES.has(String(apt.status || '').toLowerCase())) return { released: true, message: '' };
      } catch { /* status unknown: keep it reserved */ }
      return { released: false, message };
    }
  };

  const handlePaymentFailure = async (appointmentId, err) => {
    const id = String(appointmentId);
    // Once a checkout for this booking took money, it is never released here,
    // even if a later retry fails before checkout (e.g. the server refuses a
    // new order) — the patient or support settles it with the money in view.
    // The server released it already (POST /release, after checking that no
    // payment was captured), so the slot is free again.
    let released = Boolean(err?.slotReleased);
    if (released) chargedRef.current.delete(id);
    else if (err?.charged) chargedRef.current.add(id);
    if (!released && err?.notPaid && !chargedRef.current.has(id)) {
      // Not released: keep it reserved; the patient can retry payment.
      ({ released } = await releaseReservation(id));
    }
    if (released) {
      setRequestId(null);
      setBookAlert({
        title: PAY_FAILED,
        message: err?.message === SLOT_RELEASED
          ? SLOT_RELEASED
          : err?.cancelled
          ? 'You cancelled the payment, so no appointment was booked. You can try again.'
          : `${err?.message || 'Payment could not be completed.'} No appointment was booked — you can try again.`,
      });
      return;
    }
    setRequestId(String(appointmentId));
    setBookAlert({ title: PAY_FAILED, message: `${err?.message || 'Payment could not be completed.'} Your appointment is reserved and unpaid. You can retry payment.` });
  };

  const confirmBooking = async () => {
    if (booking) return;
    // Switched to cash after an online payment failed: release the reserved
    // (unpaid) booking, then book the same slot again with cash below.
    if (requestId && !onlinePayment) {
      if (chargedRef.current.has(requestId)) {
        setBookAlert({ title: BOOK_FAILED, message: 'A payment for this appointment may already have gone through, so it cannot be switched to cash. Please retry the payment or check My Appointments.' });
        return;
      }
      setBooking(true);
      setBookAlert(null);
      const { released, message } = await releaseReservation(requestId);
      if (!released) {
        setBooking(false);
        setBookAlert({ title: BOOK_FAILED, message: `Your unpaid reservation could not be released, so it cannot be switched to cash right now.${message ? ` ${message}` : ''} Please try again.` });
        return;
      }
      setRequestId(null);
      setBooking(false);
    }
    // Booked, payment confirmation still pending: only retry the payment.
    if (requestId && onlinePayment) {
      if (walletTooLow(paymentMethod)) {
        setBookAlert({
          title: 'Insufficient Wallet Balance',
          message: `Your wallet has ${money(wallet.balance)}. Add ${money(walletShortBy)} more, or choose another payment method to complete this booking.`,
          addMoney: true,
        });
        return;
      }
      setBooking(true);
      setBookAlert(null);
      try {
        await pay(requestId);
        setStep('success');
        onBooked?.();
      } catch (err) {
        await handlePaymentFailure(requestId, err);
      } finally {
        setBooking(false);
      }
      return;
    }
    if (!hasClinics) {
      setBookAlert({ title: BOOK_FAILED, message: 'This doctor has no clinic available, so the appointment cannot be booked.' });
      return;
    }
    if (!hasConfiguredFee) {
      setBookAlert({ title: BOOK_FAILED, message: 'This clinic has not configured a consultation fee yet.' });
      return;
    }
    if (!paymentMethods.some((pm) => pm.id === paymentMethod)) {
      setBookAlert({
        title: BOOK_FAILED,
        message: paymentOptions.error
          || (paymentOptions.loading ? 'Payment options are still loading. Please wait a moment.'
            : paymentOptions.unavailable.length ? `Online payment isn't available for this doctor right now: ${paymentOptions.unavailable[0].reason}`
              : 'This doctor has no payment method available yet.'),
      });
      return;
    }
    // Checked before booking, so a too-low wallet never reserves a slot.
    if (walletTooLow(paymentMethod)) {
      setBookAlert({
        title: 'Insufficient Wallet Balance',
        message: `Your wallet has ${money(wallet.balance)}. Add ${money(walletShortBy)} more to pay ${money(totalFee)} from your wallet, or choose another payment method.`,
        addMoney: true,
      });
      return;
    }
    // The slot may have passed while the user was on the payment step.
    if (!slotsForDate(selectedDate).some((x) => x.time === selectedTime)) {
      setSelectedTime(null);
      setStep('select');
      setBookAlert({ title: BOOK_FAILED, message: 'That time slot has already passed. Please choose an upcoming slot.' });
      return;
    }
    setBooking(true);
    setBookAlert(null);
    const formattedTime = to24Hour(selectedTime);
    const patientId = pickFirst(await AsyncStorage.getItem('userId'), pt._id, pt.id);
    const payload = {
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
        priority: 'normal',
      };
    let res;
    try {
      res = await api.post('/api/appointments', payload);
    } catch (err) {
      setBooking(false);
      handleBookError(err, formattedTime);
      return;
    }
    const data = res.data?.data || res.data || {};
    setToken(pickFirst(data.token, data.token_number, data.queue_token, data.appointment?.token_number) ?? null);
    if (!onlinePayment) {
      setBooking(false);
      setStep('success');
      onBooked?.();
      return;
    }
    // Card / UPI: the appointment is reserved; it's booked once paid.
    const appointmentId = pickFirst(data._id, data.id, data.appointment?._id, data.appointment?.id);
    if (!appointmentId) {
      setBooking(false);
      setBookAlert({ title: PAY_FAILED, message: 'Your appointment is reserved, but payment could not start. Please check My Appointments.' });
      return;
    }
    try {
      await pay(appointmentId);
      setStep('success');
      onBooked?.();
    } catch (err) {
      await handlePaymentFailure(appointmentId, err);
    } finally {
      setBooking(false);
    }
  };

  const handleBookError = (err, formattedTime) => {
    if (err?.response) console.warn('[booking] refused', err.response.status, JSON.stringify(err.response.data));
    // The server can reject a stale wallet option after the payment
    // environment changes. Refresh instead of blaming the doctor: wallet is a
    // platform method and is not controlled by doctor preferences.
    if (walletPayment && methodRefused(err)) {
      paymentOptions.refresh();
      setBookAlert({ title: BOOK_FAILED, message: 'Wallet payment is not available in the current payment environment. Payment options have been refreshed; please choose an available method.' });
      return;
    }
    const message = err?.response?.data?.message || err?.message || '';
    // A booking made elsewhere (web / another device) since the sheet opened:
    // hide that slot now and let the patient pick another time.
    if (/already has (a )?booking/i.test(message) && selectedDate?.iso && selectedTime) {
      const [h, m] = formattedTime.split(':').map(Number);
      setBookedSlots((prev) => new Set(prev).add(`${selectedDate.iso}|${h * 60 + m}`));
      setSelectedTime(null);
      setStep('select');
      setBookAlert({ title: 'Appointment Already Booked', message: 'You already have an appointment with this doctor at that time. Please choose another slot.' });
      return;
    }
    setBookAlert({ title: BOOK_FAILED, message: message || 'Failed to book appointment. Please try again.' });
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
      {header('Booked', '')}
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.successHero}>
          <View style={s.successIcon}><GradientFill /><Ionicons name="checkmark" size={38} color="#FFF" /></View>
          <Text style={s.successTitle}>Appointment Booked Successfully!</Text>
          <Text style={s.successSub}>A confirmation notification with all the details has been generated for you.</Text>
        </View>
        <LinearGradient colors={PATIENT_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.tokenCard}>
          <View style={s.flex}>
            <Text style={s.tokenLabel}>
              <Ionicons name="ticket-outline" size={13} color="#FFF" /> Token Number
            </Text>
            <Text style={s.tokenNote}>Arrive 15 minutes early</Text>
          </View>
          <Text style={s.tokenNum}>{token != null ? `#${token}` : 'Pending'}</Text>
        </LinearGradient>
        <View style={s.card}>
          <Row icon="person-outline" label="Patient" value={patientName} />
          <Row icon="medkit-outline" label="Doctor" value={doctor.name} />
          <Row icon="business-outline" label="Clinic" value={selectedClinic.name} />
          <Row icon="location-outline" label="Location" value={location || selectedClinic.address} />
          <Row icon={selectedMode.icon} label="Consultation Mode" value={selectedMode.name} />
          <Row icon="calendar-outline" label="Date" value={dateStr} />
          <Row icon="time-outline" label="Time" value={selectedTime} />
          <Row
            icon="wallet-outline"
            label="Payment"
            value={`${paymentMethods.find((pm) => pm.id === paymentMethod)?.label || paymentMethod}${onlinePayment ? ' · Paid' : ''}`}
            last={!(walletPayment && wallet.balance != null)}
          />
          {walletPayment && wallet.balance != null && (
            <Row icon="cash-outline" label="Wallet Balance Left" value={money(wallet.balance)} last />
          )}
          <View style={s.totalRow}><Text style={s.totalLabel}>{onlinePayment ? 'Amount Paid' : 'Total Fee'}</Text><Text style={s.totalValue}>{money(totalFee)}</Text></View>
        </View>
        <Text style={s.closingNote}>You can follow your token live in the Token tab. Closing shortly…</Text>
        <GradientButton label="Done" icon="checkmark" onPress={onClose} />
      </ScrollView>
    </View>
  );

  const renderPayment = () => (
    <View style={s.screen}>
      {/* Once booked and waiting for payment, the slot can't be changed here. */}
      {header('Review & Payment', 'Please review your appointment details before confirming', requestId ? null : () => setStep('select'))}
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
          {testMode && !walletPayment && (
            <View style={s.testBanner}>
              <Ionicons name="flask-outline" size={15} color="#B45309" />
              <Text style={s.testBannerText}>Razorpay test mode: use test payment details in secure checkout. No real money is charged.</Text>
            </View>
          )}
          {paymentOptions.loading && <ActivityIndicator color={PATIENT.primary} style={s.payLoading} />}
          {!!paymentOptions.error && <Text style={s.errorText}>{paymentOptions.error}</Text>}
          {!paymentOptions.loading && !paymentOptions.error && !paymentMethods.length && (
            <Text style={s.errorText}>This doctor has no payment method available yet.</Text>
          )}
          {paymentGroups.map((group) => {
            // A row is usable when one of its methods is; otherwise it stays
            // visible but disabled, with the server's reason (e.g. the doctor
            // hasn't finished card / UPI setup).
            const available = group.methods.filter((pm) => !pm.unavailableReason);
            const active = available.some((pm) => pm.id === paymentMethod);
            const reason = available.length ? '' : group.methods[0]?.unavailableReason;
            // Retrying a reserved booking: any online way can be tried (each
            // attempt makes its own order). Cash replaces the reservation with
            // a cash booking — unless a checkout may already have taken money.
            const locked = booking || !available.length || (requestCharged && !available.some((pm) => isOnlinePayment(pm.id)));
            const isWallet = group.id === 'wallet';
            return (
              <View key={group.id}>
                <Pressable
                  onPress={() => setPaymentMethod(available.find((pm) => pm.id === paymentMethod)?.id || available[0].id)}
                  disabled={locked}
                  style={[s.payMethod, active && s.payMethodActive, !!reason && s.payMethodUnavailable, locked && !active && !reason && s.payMethodLocked]}
                >
                  <View style={[s.payIcon, active && s.payIconActive, !!reason && s.payIconUnavailable]}>{active && <GradientFill />}<Ionicons name={group.icon} size={17} color={active ? '#FFF' : reason ? '#94A3B8' : PATIENT.primary} /></View>
                  <View style={s.flex}>
                    <Text style={[s.payLabel, active && s.payLabelActive, !!reason && s.payLabelUnavailable]}>{group.label}</Text>
                    {!!reason && <Text style={s.payReason}>{reason}</Text>}
                    {isWallet && !reason && (
                      <Text style={[s.walletBalance, walletTooLow('wallet') && s.walletBalanceLow]}>
                        {wallet.loading && wallet.balance == null
                          ? 'Checking balance…'
                          : wallet.balance == null
                            ? 'Balance unavailable'
                            : walletTooLow('wallet')
                              ? `Balance ${money(wallet.balance)} · ${money(walletShortBy)} short`
                              : `Balance ${money(wallet.balance)}`}
                      </Text>
                    )}
                  </View>
                  {reason
                    ? <Ionicons name="lock-closed-outline" size={18} color="#CBD5E1" />
                    : <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={20} color={active ? PATIENT.primary : '#CBD5E1'} />}
                </Pressable>
                {group.id === 'card' && active && (
                  <View style={s.payExpanded}>
                    {available.length > 1 && (
                      <View style={s.cardTypes}>
                        {available.map((pm) => {
                          const on = paymentMethod === pm.id;
                          return (
                            <Pressable key={pm.id} onPress={() => setPaymentMethod(pm.id)} disabled={booking} style={[s.cardType, on && s.cardTypeActive]}>
                              <Text style={[s.cardTypeText, on && s.cardTypeTextActive]}>{pm.label}</Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    )}
                    <Text style={s.payExpandedText}>
                      {testMode
                        ? 'Continue to Razorpay Checkout and use the official test card details.'
                        : 'Continue with “Enter card details & pay” to enter your card number, expiry and CVV in secure checkout.'}
                    </Text>
                  </View>
                )}
                {group.id === 'upi' && active && (
                  <View style={s.payExpanded}>
                    {testMode ? (
                      <Text style={s.payExpandedText}>
                        In Razorpay test checkout, enter UPI ID <Text style={s.payStrong}>success@razorpay</Text> for a successful test payment, or <Text style={s.payStrong}>failure@razorpay</Text> to test failure. No real money is charged.
                      </Text>
                    ) : (
                      <Text style={s.payExpandedText}>Choose your UPI app, such as Google Pay, PhonePe, Paytm or another supported app, in secure Razorpay checkout, and approve the payment in your app.</Text>
                    )}
                  </View>
                )}
              </View>
            );
          })}
          {walletPayment && walletShortBy > 0 && !!onAddMoney && (
            <Pressable onPress={openAddMoney} style={s.addMoneyLink} hitSlop={6}>
              <Ionicons name="add-circle-outline" size={16} color={PATIENT.primary} />
              <Text style={s.addMoneyText}>Add {money(walletShortBy)} to your wallet</Text>
            </Pressable>
          )}
          {walletPayment && (
            <Text style={s.payHint}>The appointment fee will be deducted from your wallet and recorded in your doctor's earnings wallet.</Text>
          )}
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
          <View style={s.feeRow}><Text style={s.feeLabel}>Consultation Fee</Text><Text style={s.feeValue}>{feeText(selectedClinic.fee)}</Text></View>
          <View style={s.totalRow}><Text style={s.totalLabel}>Total</Text><Text style={s.totalValue}>{money(totalFee)}</Text></View>
        </View>

        <View style={s.infoBox}>
          <Ionicons name="information-circle-outline" size={16} color="#166534" />
          <Text style={s.infoText}>
            {requestId && !onlinePayment
              ? 'Your unpaid reservation will be replaced by a cash booking for the same slot. Pay at the clinic.'
              : requestId
              ? 'Your appointment is reserved and unpaid. Complete the payment to book it.'
              : onlinePayment
                ? 'Your appointment is booked once the payment succeeds. All details will be stored in your dashboard.'
                : 'Your appointment will be reserved immediately upon confirmation. All details will be stored in your dashboard.'}
          </Text>
        </View>
      </ScrollView>
      <View style={s.footer}>
        <GradientButton
          label={booking
            ? (walletPayment ? 'Paying from wallet…' : onlinePayment ? 'Processing payment…' : 'Booking…')
            : `${requestId && onlinePayment ? 'Retry Payment' : walletPayment ? 'Pay from Wallet' : onlinePayment ? 'Pay & Book' : 'Confirm & Book'} · ${money(totalFee)}`}
          icon="lock-closed"
          onPress={confirmBooking}
          disabled={booking || paymentOptions.loading || !paymentMethod}
          loading={booking}
        />
      </View>
    </View>
  );

  const renderSelect = () => (
    <View style={s.screen}>
      {header('Book Appointment')}
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
            {!!doctor.nextAvailable && <Badge icon="time-outline" text={`Next available: ${doctor.nextAvailable}`} />}
          </View>
        </View>

        {/* Clinic details */}
        <View style={s.card}>
          <Text style={s.cardTitle}><Ionicons name="business-outline" size={15} color={PATIENT.primary} /> Clinic Details</Text>
          <Detail label="Location" value={selectedClinic.address || 'Not specified'} />
          <Detail label="Available Days" value={selectedClinic.days} />
          <Detail label="Timings" value={selectedClinic.timings} />
          <Detail label="Consultation Fee" value={feeText(selectedClinic.fee)} />
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
                  <Tag text={feeText(c.fee)} tone="green" />
                </View>
              </View>
              {selectedClinicId === c.id && <Ionicons name="checkmark-circle" size={20} color={PATIENT.primary} />}
            </Pressable>
          ))}
        </Selector>

        {/* Mode selector */}
        {/* Consultation mode */}
        <Selector
          eyebrow="CONSULTATION MODE"
          icon={selectedMode.icon.replace('-outline', '')}
          value={selectedMode.name}
          open={modeOpen}
          onToggle={() => { setModeOpen((o) => !o); setClinicOpen(false); }}
        >
          {modes.map((m) => (
            <Pressable key={m.id} style={[s.option, selectedModeId === m.id && s.optionActive]} onPress={() => { setSelectedModeId(m.id); setModeOpen(false); }}>
              <View style={s.modeIcon}><Ionicons name={m.icon} size={18} color={PATIENT.primary} /></View>
              <View style={s.flex}>
                <Text style={s.optionName}>{m.name}</Text>
                <Text style={s.optionSub}>{m.desc}</Text>
              </View>
              {selectedModeId === m.id && <Ionicons name="checkmark-circle" size={20} color={PATIENT.primary} />}
            </Pressable>
          ))}
        </Selector>

        {/* Date + time */}
        {(
          <View style={s.card}>
            <View style={s.dateHead}>
              <Text style={s.cardTitle}>Choose Appointment Date</Text>
              <Text style={s.monthLabel}>{(selectedDate || calendarDates[0])?.monthLong}</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.dates}>
              {calendarDates.map((d, i) => {
                const selected = selectedDate?.iso === d.iso;
                const unavailable = d.status === 'unavailable';
                // The first day of each new month carries its name.
                const newMonth = i > 0 && d.date === 1;
                return (
                  <Pressable
                    key={d.iso}
                    disabled={unavailable}
                    onPress={() => { setSelectedDate(d); setSelectedTime(null); }}
                    style={[s.dateCard, unavailable && s.dateCardOff, selected && s.dateCardSelected]}
                  >
                    {selected && <GradientFill />}
                    <Text style={[s.dateDay, selected && s.dateTextSelected]}>{newMonth ? d.month : d.day}</Text>
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
      </ScrollView>

      <View style={s.footer}>
        <View style={s.footerSummary}>
          <Text style={s.footerSummaryText} numberOfLines={1}>
            {selectedDate && selectedTime
              ? `${dateStr} • ${selectedTime}`
              : 'Select a date and time'}
          </Text>
          <Text style={s.footerFee}>{feeText(selectedClinic?.fee)}</Text>
        </View>
        <GradientButton
          label="Confirm Selection"
          icon="arrow-forward"
          onPress={() => canContinue && setStep('payment')}
          disabled={!canContinue}
        />
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={() => {
        if (bookAlert) setBookAlert(null);
        else if (step === 'payment' && !requestId) setStep('select');
        else onClose?.();
      }}
    >
      {/* A Modal is its own native window: give it its own safe-area context so
          the header clears the status bar / notch and the footer clears the
          home indicator / gesture bar. */}
      <SafeAreaProvider>
        <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
          {step === 'success' ? renderSuccess() : step === 'payment' ? renderPayment() : renderSelect()}
        </SafeAreaView>
        {/* Overlay, not a nested Modal: stacked Modals are unreliable on Android. */}
        {!!bookAlert && (
          <View style={s.alertBackdrop}>
            <View style={s.alertCard}>
              <View style={s.alertIcon}><Ionicons name="alert-circle" size={30} color="#DC2626" /></View>
              <Text style={s.alertTitle}>{bookAlert.title}</Text>
              <Text style={s.alertMessage}>{bookAlert.message}</Text>
              {bookAlert.addMoney && !!onAddMoney ? (
                <>
                  <View style={s.alertBtn}>
                    <GradientButton label="Add Money" icon="wallet-outline" onPress={openAddMoney} />
                  </View>
                  <Pressable onPress={() => setBookAlert(null)} hitSlop={8} style={s.alertCancel}>
                    <Text style={s.alertCancelText}>Choose another method</Text>
                  </Pressable>
                </>
              ) : (
                <View style={s.alertBtn}>
                  <GradientButton label="OK" icon="checkmark" onPress={() => setBookAlert(null)} />
                </View>
              )}
            </View>
          </View>
        )}
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
  input: { height: 46, borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 12, paddingHorizontal: 12, fontSize: 14, color: '#0F172A' },
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
  alertBackdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(15,23,42,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  alertCard: { width: '100%', maxWidth: 360, backgroundColor: '#FFF', borderRadius: 18, padding: 20, alignItems: 'center' },
  alertIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  alertTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A', textAlign: 'center' },
  alertMessage: { fontSize: 13.5, color: '#475569', textAlign: 'center', lineHeight: 20, marginTop: 6 },
  alertBtn: { alignSelf: 'stretch', marginTop: 18 },
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
  payLabel: { fontSize: 14, fontWeight: '700', color: '#334155' },
  payLabelActive: { color: '#0F172A', fontWeight: '800' },
  payMethodUnavailable: { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' },
  payIconUnavailable: { backgroundColor: '#F1F5F9' },
  payLabelUnavailable: { color: '#94A3B8' },
  payReason: { fontSize: 12, lineHeight: 17, color: '#B45309', fontWeight: '600', marginTop: 2 },
  payExpanded: { marginTop: 6, marginLeft: 4, padding: 10, borderRadius: 10, backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#DCFCE7' },
  payExpandedText: { fontSize: 12.5, lineHeight: 18, color: '#475569' },
  payStrong: { fontWeight: '800', color: '#0F172A' },
  cardTypes: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  cardType: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 9, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#FFF' },
  cardTypeActive: { borderColor: PATIENT.primary, backgroundColor: '#DCFCE7' },
  cardTypeText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  cardTypeTextActive: { color: PATIENT.primary, fontWeight: '800' },
  testBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 8, padding: 10, borderRadius: 10, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A' },
  testBannerText: { flex: 1, fontSize: 12.5, lineHeight: 18, color: '#92400E', fontWeight: '600' },
  walletBalance: { fontSize: 12, color: '#64748B', fontWeight: '600', marginTop: 2 },
  walletBalanceLow: { color: '#DC2626' },
  addMoneyLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: 10 },
  addMoneyText: { fontSize: 13, fontWeight: '800', color: PATIENT.primary },
  payLoading: { marginVertical: 12 },
  alertCancel: { marginTop: 12, paddingVertical: 4 },
  alertCancelText: { fontSize: 14, fontWeight: '700', color: '#64748B' },
  payMethodLocked: { opacity: 0.45 },
  payHint: { fontSize: 12.5, color: '#475569', lineHeight: 18, marginTop: 10 },
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
