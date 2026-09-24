// Calendar & Availability — screen-for-screen port of the web doctor calendar
// (chatbot/src/Component/DoctorDashboard/Calendar/Calendar.jsx, live render),
// in the app's clinician colors. Same tabs (Recurring Schedule / Specific
// Dates / Exceptions-Unavailable), date editor (Saved Slots + Add Slot +
// Save Slot / unavailable reason), multi-range "Add Time Ranges" modal,
// slot preview, local draft and status bar — and the same API contract:
//   GET    /api/clinics?doctor_id&role=doctor
//   GET    /api/availability/ranges?doctor_id&clinic_id
//   POST   /api/availability/ranges   { doctor_id, clinic_id, date | weekday, start_time, end_time, slot_duration }
//   DELETE /api/availability/ranges/:id
//   POST   /api/availability/unavailable { doctor_id, clinic_id, date, reason }
//   DELETE /api/availability/clear-date  { doctor_id, clinic_id, date }
//   DELETE /api/availability/clear-all   { doctor_id, clinic_id }
// Availability is also cached per doctor+clinic (web: localStorage,
// app: AsyncStorage `doctorAvailability:<doctorId>:<clinicId>`).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LinearGradient from 'react-native-linear-gradient';
import DateTimePicker from '@react-native-community/datetimepicker';
import AppIcon from '../icons/AppIcon';
import { useToast } from '../../../../components/common/ToastProvider';
import { colors, createDoctorStyles, doctorGradient, gradientDirection } from '../theme';
import axiosInstance from '../../../../axiosConfig';
import { getStoredDoctorUser, pickFirst } from '../api/doctorAppointments';
import { createClinic, unwrapApiArray } from '../api/doctorClinics';

// ---------------------------------------------------------------------------
// helpers (same as web)
// ---------------------------------------------------------------------------
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DATE_EDITOR_DURATIONS = [5, 10, 15, 20, 30];
const MULTI_RANGE_DURATIONS = [10, 15, 30, 45];
const CLINIC_COLORS = ['#0D9488', '#28a745', '#dc3545', '#ffc107', '#6f42c1'];

const formatDateKey = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const createEmptyTimeRange = () => ({ start: '', end: '', duration: 15 });

const normalizeClinic = (clinic, index) => ({
  id: pickFirst(clinic._id, clinic.clinic_id, clinic.clinicId, clinic.id, clinic.hospital_id, index),
  name: pickFirst(clinic.clinic_name, clinic.clinicName, clinic.hospital_name, clinic.hospitalName, clinic.name, 'Unnamed Clinic'),
  location: pickFirst(
    typeof clinic.location === 'string' ? clinic.location : undefined,
    clinic.address, clinic.clinic_address, clinic.hospital_address, 'Address not available',
  ),
  doctorId: pickFirst(clinic.doctor_id, clinic.doctorId, clinic.doctor?.id, clinic.doctor?._id, ''),
  color: CLINIC_COLORS[index % CLINIC_COLORS.length],
});

const WEEKDAY_NAME_MAP = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6,
};

const normalizeWeekday = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'number') return value;
  const raw = String(value).trim().toLowerCase();
  if (WEEKDAY_NAME_MAP[raw] !== undefined) return WEEKDAY_NAME_MAP[raw];
  const numeric = Number(raw);
  if (Number.isNaN(numeric)) return undefined;
  return numeric >= 1 && numeric <= 7 ? numeric % 7 : numeric;
};

const normalizeDateKey = (value) => {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return formatDateKey(date.getFullYear(), date.getMonth(), date.getDate());
};

const normalizeTimeValue = (value) => {
  if (!value) return '';
  const raw = String(value);
  if (/^\d{2}:\d{2}/.test(raw)) return raw.slice(0, 5);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return raw;
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

const normalizeRange = (range) => ({
  id: pickFirst(range.id, range.range_id, range._id),
  clientId: pickFirst(range.clientId, range.client_id, range.local_id),
  date: normalizeDateKey(pickFirst(range.date, range.available_date, range.availability_date, range.specific_date, range.unavailable_date, '')),
  weekday: normalizeWeekday(pickFirst(range.weekday, range.day_of_week, range.week_day, range.day, range.day_name, range.dayName)),
  start: normalizeTimeValue(pickFirst(range.start, range.start_time, range.startTime, range.from_time, range.fromTime, range.from, range.start_date, range.startDate, '')),
  end: normalizeTimeValue(pickFirst(range.end, range.end_time, range.endTime, range.to_time, range.toTime, range.to, range.end_date, range.endDate, '')),
  duration: Number(pickFirst(range.duration, range.slot_duration, range.slotDuration, 15)),
  clinicId: pickFirst(range.clinic_id, range.clinicId, range.hospital_id, range.hospitalId, range.clinic?.id, range.hospital?.id, ''),
  clinicName: pickFirst(range.clinic_name, range.clinicName, range.hospital_name, range.hospitalName, range.clinic?.name, range.hospital?.name, ''),
  blocked: Boolean(range.blocked || range.is_unavailable || range.unavailable || range.status === 'unavailable'),
  reason: pickFirst(range.reason, range.unavailable_reason, range.note, ''),
});

const getRecordSlots = (record) => {
  const slots = pickFirst(record.slots, record.time_slots, record.timeSlots, record.ranges, record.timings, record.availability_slots);
  return Array.isArray(slots) && slots.length ? slots : [record];
};

const normalizeSlotRecord = (slot) => (typeof slot === 'string' || typeof slot === 'number' ? { time: String(slot) } : slot || {});

const getRecordWeekdays = (record) => {
  const values = pickFirst(record.weekdays, record.week_days, record.available_days, record.days, record.day_names);
  if (Array.isArray(values)) return values.map(normalizeWeekday).filter((item) => item !== undefined);
  const single = normalizeWeekday(pickFirst(record.weekday, record.day_of_week, record.week_day, record.day, record.day_name, record.dayName));
  return single === undefined ? [] : [single];
};

const expandAvailabilityRecords = (records) => {
  const expanded = [];
  records.forEach((record) => {
    const dates = [record.date, record.available_date, record.availability_date, record.specific_date, record.unavailable_date].filter(Boolean);
    const weekdays = getRecordWeekdays(record);
    const slots = getRecordSlots(record);
    if (dates.length) {
      dates.forEach((date) => slots.forEach((slot) => expanded.push({ ...record, ...normalizeSlotRecord(slot), date })));
      return;
    }
    if (weekdays.length) {
      weekdays.forEach((weekday) => slots.forEach((slot) => expanded.push({ ...record, ...normalizeSlotRecord(slot), weekday })));
      return;
    }
    expanded.push(record);
  });
  return expanded;
};

const isUsableTimeRange = (range) => {
  if (!/^\d{2}:\d{2}$/.test(range?.start || '') || !/^\d{2}:\d{2}$/.test(range?.end || '')) return false;
  const [sh, sm] = range.start.split(':').map(Number);
  const [eh, em] = range.end.split(':').map(Number);
  return eh * 60 + em > sh * 60 + sm;
};

// One server id can be shared by several windows of the same day — never use
// the id alone as identity (morning and evening must stay separate).
const mergeAvailabilityRanges = (...rangeGroups) => {
  const normalizedRanges = rangeGroups.flat().filter(Boolean)
    .flatMap((record) => expandAvailabilityRecords([record]))
    .map(normalizeRange);
  const usableByServerId = new Map();
  normalizedRanges.forEach((range) => {
    if (range.id !== undefined && range.id !== null && isUsableTimeRange(range)) {
      const id = String(range.id);
      usableByServerId.set(id, [...(usableByServerId.get(id) || []), range]);
    }
  });
  const merged = new Map();
  normalizedRanges.forEach((rawRange, index) => {
    let range = rawRange;
    if (!isUsableTimeRange(range) && range.id !== undefined && range.id !== null) {
      const candidates = usableByServerId.get(String(range.id)) || [];
      if (candidates.length === 1) {
        const c = candidates[0];
        range = {
          ...range,
          date: range.date || c.date,
          weekday: range.weekday ?? c.weekday,
          clinicId: range.clinicId || c.clinicId,
          clinicName: range.clinicName || c.clinicName,
          start: c.start,
          end: c.end,
          duration: c.duration,
        };
      }
    }
    const target = range.date || `weekday:${range.weekday ?? 'unknown'}`;
    const key = [target, range.start, range.end, Number(range.duration || 15), range.blocked, range.clinicId || ''].join('|');
    const existing = merged.get(key);
    if (!existing || (!existing.id && range.id)) merged.set(key || range.clientId || `range:${index}`, range);
  });
  return Array.from(merged.values());
};

const toMinutes = (time) => {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
};

const rangesOverlap = (left, right) => {
  if (!isUsableTimeRange(left) || !isUsableTimeRange(right)) return false;
  return toMinutes(left.start) < toMinutes(right.end) && toMinutes(right.start) < toMinutes(left.end);
};

const getRangeConflict = (candidate, existingRanges = []) => {
  const duplicate = existingRanges.find(
    (r) => normalizeTimeValue(r.start) === normalizeTimeValue(candidate.start) && normalizeTimeValue(r.end) === normalizeTimeValue(candidate.end),
  );
  if (duplicate) return 'This exact time range is already available.';
  const overlap = existingRanges.find((r) => rangesOverlap(candidate, r));
  if (overlap) return `This range overlaps the existing ${overlap.start} - ${overlap.end} availability.`;
  return '';
};

const sortAvailabilityRanges = (ranges = []) =>
  [...ranges].sort((a, b) => normalizeTimeValue(a.start).localeCompare(normalizeTimeValue(b.start)));

const getDaysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();

const isPastDate = (year, month, day) => {
  const today = new Date();
  const check = new Date(year, month, day);
  today.setHours(0, 0, 0, 0);
  check.setHours(0, 0, 0, 0);
  return check < today;
};

const isPastDateTime = (year, month, day, hour, minute) => new Date(year, month, day, hour, minute) < new Date();

const timeToDate = (hhmm) => {
  const d = new Date();
  if (hhmm) {
    const [h, m] = hhmm.split(':').map(Number);
    d.setHours(h, m, 0, 0);
  } else {
    d.setHours(9, 0, 0, 0);
  }
  return d;
};

const dateToTime = (date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

const formatTime12h = (hhmm) => {
  if (!hhmm) return '--:--';
  const [h, m] = hhmm.split(':').map(Number);
  const meridiem = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${meridiem}`;
};

const apiMessage = (error, fallback) => error?.response?.data?.message || error?.response?.data?.error || fallback;

// ---------------------------------------------------------------------------
// screen
// ---------------------------------------------------------------------------
export default function CalendarAvailabilityScreen() {
  const { showToast } = useToast();
  const [doctorId, setDoctorId] = useState('');
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [activeCalendarTab, setActiveCalendarTab] = useState('specific');
  const [selectedDays, setSelectedDays] = useState([]);
  const [recurringWeekdays, setRecurringWeekdays] = useState([]);
  const [availabilityDateMap, setAvailabilityDateMap] = useState({});
  const [availabilityWeekdayMap, setAvailabilityWeekdayMap] = useState({});
  const [editingTarget, setEditingTarget] = useState(null);
  const [newRange, setNewRange] = useState({ start: '', end: '', duration: 15 });
  const [slotPreview, setSlotPreview] = useState([]);
  const [showAddTimeModal, setShowAddTimeModal] = useState(false);
  const [additionalTimeRows, setAdditionalTimeRows] = useState([createEmptyTimeRange()]);
  const [unavailableReason, setUnavailableReason] = useState('');

  const [clinics, setClinics] = useState([]);
  const [selectedClinic, setSelectedClinic] = useState(null);
  const [showClinicDropdown, setShowClinicDropdown] = useState(false);
  const [showNewClinicForm, setShowNewClinicForm] = useState(false);
  const [newClinic, setNewClinic] = useState({ name: '', phone: '', location: '' });
  const [savingClinic, setSavingClinic] = useState(false);
  const [apiStatus, setApiStatus] = useState('idle');
  const [apiError, setApiError] = useState('');
  const [busy, setBusy] = useState(false);
  // { context: 'row' | 'newRange', index?, field: 'start' | 'end' }
  const [picker, setPicker] = useState(null);

  const selectedClinicIdRef = useRef(null);
  selectedClinicIdRef.current = selectedClinic?.id;
  const availabilityStorageKey = `doctorAvailability:${doctorId || 'doctor'}:${selectedClinic?.id || 'clinic'}`;

  const month = currentDate.getMonth();
  const year = currentDate.getFullYear();

  useEffect(() => {
    getStoredDoctorUser().then((user) => {
      const id = pickFirst(user?.doctor_id, user?.doctorId, user?.id, user?._id, user?.user_id, user?.userId, '');
      if (id) setDoctorId(String(id));
      else setApiError('Doctor id not found. Please login again.');
    });
  }, []);

  // ---- local cache ------------------------------------------------------
  const getLocalAvailability = useCallback(async () => {
    try {
      return JSON.parse((await AsyncStorage.getItem(availabilityStorageKey)) || '{}');
    } catch {
      return {};
    }
  }, [availabilityStorageKey]);

  const saveLocalAvailability = useCallback((ranges, dateMap) => {
    AsyncStorage.setItem(
      availabilityStorageKey,
      JSON.stringify({ ranges, dateMap, savedAt: new Date().toISOString() }),
    ).catch(() => {});
  }, [availabilityStorageKey]);

  const getAllLocalRanges = (dateMap = availabilityDateMap, weekdayMap = availabilityWeekdayMap) => {
    const dateRanges = Object.entries(dateMap).flatMap(([date, info]) => (info?.ranges || []).map((r) => ({ ...r, date })));
    const weekdayRanges = Object.entries(weekdayMap).flatMap(([w, ranges]) => (ranges || []).map((r) => ({ ...r, weekday: Number(w) })));
    return [...dateRanges, ...weekdayRanges];
  };

  // ---- loading ----------------------------------------------------------
  const loadClinics = useCallback(async () => {
    if (!doctorId) return;
    try {
      setApiStatus('loading');
      setApiError('');
      const response = await axiosInstance.get('/api/clinics', { params: { doctor_id: doctorId, role: 'doctor' } });
      const doctorClinics = unwrapApiArray(response.data)
        .map(normalizeClinic)
        .filter((c) => !c.doctorId || String(c.doctorId) === String(doctorId));
      setClinics(doctorClinics);
      setSelectedClinic((current) => doctorClinics.find((c) => String(c.id) === String(current?.id)) || doctorClinics[0] || null);
      setApiStatus('succeeded');
    } catch (error) {
      setApiStatus('failed');
      setApiError(apiMessage(error, 'Failed to load clinics'));
    }
  }, [doctorId]);

  useEffect(() => { loadClinics(); }, [loadClinics]);

  const applyAvailabilityRanges = useCallback((ranges, clinic, viewMonth, viewYear) => {
    const nextDateMap = {};
    const nextWeekdayMap = {};
    const nextSelectedDays = new Set();
    const nextWeekdays = new Set();
    expandAvailabilityRecords(ranges).map(normalizeRange).forEach((range) => {
      const belongs =
        !range.clinicId || !clinic?.id ||
        String(range.clinicId) === String(clinic.id) ||
        (range.clinicName && clinic?.name && String(range.clinicName).toLowerCase() === String(clinic.name).toLowerCase());
      if (!belongs) return;
      if (!range.date && (range.weekday === undefined || range.weekday === null || range.weekday === '')) return;
      if (range.date) {
        const date = new Date(`${range.date}T00:00:00`);
        const dateKey = Number.isNaN(date.getTime()) ? range.date : formatDateKey(date.getFullYear(), date.getMonth(), date.getDate());
        const info = nextDateMap[dateKey] || { ranges: [], blocked: false };
        nextDateMap[dateKey] = {
          ...info,
          blocked: info.blocked || range.blocked,
          ranges: range.blocked ? info.ranges : [...info.ranges, range],
        };
        if (!Number.isNaN(date.getTime()) && date.getMonth() === viewMonth && date.getFullYear() === viewYear) {
          nextSelectedDays.add(date.getDate());
        }
      } else {
        const weekday = normalizeWeekday(range.weekday);
        if (weekday === undefined) return;
        nextWeekdayMap[weekday] = [...(nextWeekdayMap[weekday] || []), range];
        nextWeekdays.add(weekday);
      }
    });
    Object.keys(nextDateMap).forEach((key) => { nextDateMap[key].ranges = sortAvailabilityRanges(nextDateMap[key].ranges); });
    Object.keys(nextWeekdayMap).forEach((key) => { nextWeekdayMap[key] = sortAvailabilityRanges(nextWeekdayMap[key]); });
    setAvailabilityDateMap(nextDateMap);
    setAvailabilityWeekdayMap(nextWeekdayMap);
    setSelectedDays(Array.from(nextSelectedDays).sort((a, b) => a - b));
    setRecurringWeekdays(Array.from(nextWeekdays).sort((a, b) => a - b));
  }, []);

  const applyUnavailableDates = useCallback((payload, localDateMap, clinic) => {
    const apiDates = [
      ...(Array.isArray(payload?.unavailableDates) ? payload.unavailableDates : []),
      ...(Array.isArray(payload?.data?.unavailableDates) ? payload.data.unavailableDates : []),
      ...(Array.isArray(payload?.unavailable_dates) ? payload.unavailable_dates : []),
      ...(Array.isArray(payload?.data?.unavailable_dates) ? payload.data.unavailable_dates : []),
    ];
    const localBlocked = Object.entries(localDateMap || {})
      .filter(([, info]) => Boolean(info?.blocked))
      .map(([date, info]) => ({ date, clinic_id: clinic?.id, reason: info?.reason || '' }));
    const all = [...apiDates, ...localBlocked];
    if (!all.length) return;
    setAvailabilityDateMap((prev) => {
      const next = { ...prev };
      all.forEach((item) => {
        const dateValue = typeof item === 'string' ? item : pickFirst(item.date, item.unavailable_date, item.unavailableDate);
        const dateKey = normalizeDateKey(dateValue);
        if (!dateKey) return;
        const itemClinicId = typeof item === 'object' ? pickFirst(item.clinic_id, item.clinicId, item.hospital_id, item.hospitalId, '') : '';
        const belongs = itemClinicId ? String(itemClinicId) === String(clinic?.id) : Boolean(localDateMap?.[dateKey]?.blocked);
        if (!belongs) return;
        const info = next[dateKey] || { ranges: [], blocked: false };
        next[dateKey] = {
          ...info,
          blocked: true,
          reason: typeof item === 'object' ? pickFirst(item.reason, item.unavailable_reason, item.note, '') : info.reason || '',
        };
      });
      return next;
    });
  }, []);

  const loadAvailabilityRanges = useCallback(async () => {
    if (!doctorId || !selectedClinic?.id) return;
    const clinic = selectedClinic;
    const local = await getLocalAvailability();
    const localDateRanges = Object.entries(local.dateMap || {}).flatMap(([date, info]) => (info?.ranges || []).map((r) => ({ ...r, date })));
    try {
      const response = await axiosInstance.get('/api/availability/ranges', {
        params: { doctor_id: doctorId, clinic_id: clinic.id },
      });
      if (String(selectedClinicIdRef.current) !== String(clinic.id)) return;
      applyAvailabilityRanges(mergeAvailabilityRanges(unwrapApiArray(response.data), local.ranges || [], localDateRanges), clinic, month, year);
      applyUnavailableDates(response.data, local.dateMap || {}, clinic);
    } catch (error) {
      if (String(selectedClinicIdRef.current) !== String(clinic.id)) return;
      applyAvailabilityRanges(mergeAvailabilityRanges(local.ranges || [], localDateRanges), clinic, month, year);
      setAvailabilityDateMap((prev) => {
        const next = { ...prev };
        Object.entries(local.dateMap || {}).forEach(([date, info]) => {
          next[date] = { ...(next[date] || { ranges: [] }), blocked: Boolean(info?.blocked), reason: info?.reason || '' };
        });
        return next;
      });
      setApiError(apiMessage(error, 'Showing locally saved availability. Backend ranges could not be loaded.'));
    }
  }, [doctorId, selectedClinic, month, year, getLocalAvailability, applyAvailabilityRanges, applyUnavailableDates]);

  useEffect(() => { loadAvailabilityRanges(); }, [loadAvailabilityRanges]);

  // ---- selection --------------------------------------------------------
  const changeMonth = (dir) => setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + dir, 1));

  const toggleRecurringWeekday = (w) =>
    setRecurringWeekdays((prev) => (prev.includes(w) ? prev.filter((x) => x !== w) : [...prev, w].sort((a, b) => a - b)));

  const getRangesForDateOrWeek = (y, m, day) => {
    const dateKey = formatDateKey(y, m, day);
    const info = availabilityDateMap[dateKey] || {};
    if (info.blocked) return [];
    if ((info.ranges || []).length) return info.ranges;
    return availabilityWeekdayMap[new Date(y, m, day).getDay()] || [];
  };

  const openEditorForDate = (y, m, day) => {
    if (isPastDate(y, m, day)) {
      Alert.alert('Calendar', 'Cannot edit past dates');
      return;
    }
    const dateKey = formatDateKey(y, m, day);
    setEditingTarget({ type: 'date', key: dateKey, year: y, month: m, day });
    setNewRange({ start: '', end: '', duration: 15 });
    setUnavailableReason(availabilityDateMap[dateKey]?.reason || '');
    setSelectedDays([day]);
  };

  // ---- saving -----------------------------------------------------------
  const createRangePayload = (range, target) => ({
    doctor_id: doctorId,
    clinic_id: String(selectedClinic.id),
    ...(target?.type === 'date' ? { date: target.key } : { weekday: Number(target?.key) }),
    start_time: normalizeTimeValue(range.start),
    end_time: normalizeTimeValue(range.end),
    slot_duration: Number(range.duration || 15),
  });

  const persistRange = async (range, target) => {
    if (!selectedClinic?.id) {
      const error = new Error('Please select a clinic loaded from the API before adding availability.');
      setApiError(error.message);
      throw error;
    }
    const clientId = `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const fallback = normalizeRange({
      ...range,
      id: clientId,
      clientId,
      clinic_id: selectedClinic.id,
      ...(target?.type === 'date' ? { date: target.key } : { weekday: target?.key }),
    });
    try {
      const response = await axiosInstance.post('/api/availability/ranges', createRangePayload(range, target));
      const d = response.data;
      const created = d?.range || d?.data?.range || d?.existingRanges?.[0] || d?.data?.existingRanges?.[0] || d?.data || d || {};
      return normalizeRange({
        ...created,
        id: pickFirst(created.id, created.range_id, created._id, fallback.id),
        clientId: pickFirst(created.clientId, created.client_id, fallback.clientId),
        date: normalizeDateKey(pickFirst(created.date, created.available_date, created.availability_date, fallback.date)),
        weekday: normalizeWeekday(pickFirst(created.weekday, created.day_of_week, created.week_day, fallback.weekday)),
        start: normalizeTimeValue(pickFirst(created.start, created.start_time, created.startTime, fallback.start)),
        end: normalizeTimeValue(pickFirst(created.end, created.end_time, created.endTime, fallback.end)),
        duration: Number(pickFirst(created.duration, created.slot_duration, fallback.duration, 15)),
        clinic_id: selectedClinic.id,
      });
    } catch (error) {
      setApiError(apiMessage(error, 'Availability range could not be saved to the backend.'));
      throw error;
    }
  };

  // Date editor "Save Slot".
  const saveRange = async () => {
    if (!editingTarget) return;
    if (!newRange.start || !newRange.end) return Alert.alert('Calendar', 'Start and End time required');
    const [sh, sm] = newRange.start.split(':').map(Number);
    if (editingTarget.type === 'date' && isPastDateTime(editingTarget.year, editingTarget.month, editingTarget.day, sh, sm)) {
      return Alert.alert('Calendar', 'Cannot add time in the past');
    }
    if (!(toMinutes(newRange.end) > toMinutes(newRange.start))) return Alert.alert('Calendar', 'End time must be after Start time');
    const existing = editingTarget.type === 'date'
      ? availabilityDateMap[editingTarget.key]?.ranges || []
      : availabilityWeekdayMap[editingTarget.key] || [];
    const conflict = getRangeConflict(newRange, existing);
    if (conflict) return Alert.alert('Calendar', conflict);
    try {
      setBusy(true);
      const savedRange = await persistRange(newRange, editingTarget);
      if (editingTarget.type === 'date') {
        const key = editingTarget.key;
        setAvailabilityDateMap((prev) => {
          const info = prev[key] ? { ...prev[key] } : { ranges: [], blocked: false };
          const next = { ...prev, [key]: { ...info, ranges: sortAvailabilityRanges([...(info.ranges || []), savedRange]), blocked: false } };
          saveLocalAvailability(getAllLocalRanges(next, availabilityWeekdayMap), next);
          return next;
        });
      } else {
        const w = editingTarget.key;
        setAvailabilityWeekdayMap((prev) => {
          const next = { ...prev, [w]: sortAvailabilityRanges([...(prev[w] || []), savedRange]) };
          saveLocalAvailability(getAllLocalRanges(availabilityDateMap, next), availabilityDateMap);
          return next;
        });
      }
      // Keep the editor open so more ranges can be added.
      setNewRange({ start: '', end: '', duration: 15 });
      showToast('Slot saved');
    } catch (error) {
      Alert.alert('Calendar', apiMessage(error, error?.message || 'Failed to save availability range'));
    } finally {
      setBusy(false);
    }
  };

  const removeRange = async (index) => {
    if (!editingTarget) return;
    if (editingTarget.type === 'date') {
      if (isPastDate(editingTarget.year, editingTarget.month, editingTarget.day)) return Alert.alert('Calendar', 'Cannot modify past dates');
      const key = editingTarget.key;
      const range = (availabilityDateMap[key]?.ranges || [])[index];
      if (range?.id && !String(range.id).startsWith('local-')) {
        try {
          await axiosInstance.delete(`/api/availability/ranges/${range.id}`);
        } catch (error) {
          return Alert.alert('Calendar', apiMessage(error, 'Failed to delete range'));
        }
      }
      setAvailabilityDateMap((prev) => {
        const info = prev[key] || { ranges: [], blocked: false };
        const next = { ...prev, [key]: { ...info, ranges: (info.ranges || []).filter((_, i) => i !== index), blocked: info.blocked || false } };
        saveLocalAvailability(getAllLocalRanges(next, availabilityWeekdayMap), next);
        return next;
      });
    } else {
      const w = editingTarget.key;
      const range = (availabilityWeekdayMap[w] || [])[index];
      if (range?.id && !String(range.id).startsWith('local-')) {
        try {
          await axiosInstance.delete(`/api/availability/ranges/${range.id}`);
        } catch (error) {
          return Alert.alert('Calendar', apiMessage(error, 'Failed to delete range'));
        }
      }
      setAvailabilityWeekdayMap((prev) => {
        const next = { ...prev, [w]: (prev[w] || []).filter((_, i) => i !== index) };
        saveLocalAvailability(getAllLocalRanges(availabilityDateMap, next), availabilityDateMap);
        return next;
      });
    }
  };

  // Recurring card trash icon: delete one weekday range (web weekday editor).
  const removeRangeForWeekday = async (w, index) => {
    const range = (availabilityWeekdayMap[w] || [])[index];
    if (range?.id && !String(range.id).startsWith('local-')) {
      try {
        await axiosInstance.delete(`/api/availability/ranges/${range.id}`);
      } catch (error) {
        return Alert.alert('Calendar', apiMessage(error, 'Failed to delete range'));
      }
    }
    setAvailabilityWeekdayMap((prev) => {
      const next = { ...prev, [w]: (prev[w] || []).filter((_, i) => i !== index) };
      saveLocalAvailability(getAllLocalRanges(availabilityDateMap, next), availabilityDateMap);
      return next;
    });
  };

  const toggleBlockDate = async (dateKey, y, m, day) => {
    if (isPastDate(y, m, day)) return Alert.alert('Calendar', 'Cannot modify past dates');
    const currentlyBlocked = Boolean(availabilityDateMap[dateKey]?.blocked);
    setBusy(true);
    try {
      if (currentlyBlocked) {
        await axiosInstance.delete('/api/availability/clear-date', {
          data: { doctor_id: doctorId, clinic_id: selectedClinic.id, date: dateKey },
        });
      } else {
        await axiosInstance.post('/api/availability/unavailable', {
          doctor_id: doctorId, clinic_id: selectedClinic.id, date: dateKey, reason: unavailableReason,
        });
      }
    } catch {
      setApiError('Unavailable date saved locally. Backend unavailable API is not available right now.');
    } finally {
      setBusy(false);
    }
    setAvailabilityDateMap((prev) => {
      const info = prev[dateKey] ? { ...prev[dateKey] } : { ranges: [], blocked: false };
      const next = { ...prev, [dateKey]: { ...info, blocked: !info.blocked, reason: currentlyBlocked ? '' : unavailableReason } };
      saveLocalAvailability(getAllLocalRanges(next), next);
      return next;
    });
  };

  // "Add Time Ranges" modal → save every row to the selected dates / weekdays.
  const saveAdditionalTimeRows = async (targetType) => {
    const rows = additionalTimeRows.map((r) => ({
      start: normalizeTimeValue(r.start),
      end: normalizeTimeValue(r.end),
      duration: Number(r.duration || 15),
    }));
    if (rows.some((r) => !r.start || !r.end)) return Alert.alert('Calendar', 'Please fill Start Time and End Time for every time range.');
    if (rows.some((r) => !isUsableTimeRange(r))) return Alert.alert('Calendar', 'Every End Time must be after its Start Time.');
    if (rows.some((r) => !(r.duration > 0))) return Alert.alert('Calendar', 'Every Slot Duration must be a positive number.');
    const sortedRows = sortAvailabilityRanges(rows);
    for (let i = 0; i < sortedRows.length; i += 1) {
      const conflict = getRangeConflict(sortedRows[i], sortedRows.slice(0, i));
      if (conflict) return Alert.alert('Calendar', `Time range ${i + 1}: ${conflict}`);
    }

    setBusy(true);
    try {
      if (targetType === 'weekday') {
        if (!recurringWeekdays.length) return Alert.alert('Calendar', 'Please select at least one recurring weekday first.');
        const nextWeekdayMap = { ...availabilityWeekdayMap };
        for (const weekday of recurringWeekdays) {
          const combined = [...(nextWeekdayMap[weekday] || [])];
          for (const range of sortedRows) {
            const conflict = getRangeConflict(range, combined);
            if (conflict) {
              setAvailabilityWeekdayMap(nextWeekdayMap);
              return Alert.alert('Calendar', `${DAYS[weekday]}: ${conflict}`);
            }
            try {
              combined.push(await persistRange(range, { type: 'weekday', key: weekday }));
            } catch (error) {
              setAvailabilityWeekdayMap(nextWeekdayMap);
              return Alert.alert('Calendar', apiMessage(error, `Failed to save ${DAYS[weekday]} availability range.`));
            }
          }
          nextWeekdayMap[weekday] = sortAvailabilityRanges(combined);
        }
        setAvailabilityWeekdayMap(nextWeekdayMap);
        saveLocalAvailability(getAllLocalRanges(availabilityDateMap, nextWeekdayMap), availabilityDateMap);
      } else {
        if (!selectedDays.length) return Alert.alert('Calendar', 'Please select at least one calendar date first.');
        const nextDateMap = { ...availabilityDateMap };
        for (const day of selectedDays) {
          if (isPastDate(year, month, day)) continue;
          const dateKey = formatDateKey(year, month, day);
          const info = nextDateMap[dateKey] ? { ...nextDateMap[dateKey] } : { ranges: [], blocked: false };
          const combined = [...(info.ranges || [])];
          for (const range of sortedRows) {
            const [h, mi] = range.start.split(':').map(Number);
            if (isPastDateTime(year, month, day, h, mi)) {
              setAvailabilityDateMap(nextDateMap);
              return Alert.alert('Calendar', `Cannot add a past time for ${dateKey}.`);
            }
            const conflict = getRangeConflict(range, combined);
            if (conflict) {
              setAvailabilityDateMap(nextDateMap);
              return Alert.alert('Calendar', `${dateKey}: ${conflict}`);
            }
            try {
              combined.push(await persistRange(range, { type: 'date', key: dateKey }));
            } catch (error) {
              setAvailabilityDateMap(nextDateMap);
              return Alert.alert('Calendar', apiMessage(error, `Failed to save ${dateKey} availability range.`));
            }
          }
          nextDateMap[dateKey] = { ...info, blocked: false, ranges: sortAvailabilityRanges(combined) };
        }
        setAvailabilityDateMap(nextDateMap);
        saveLocalAvailability(getAllLocalRanges(nextDateMap, availabilityWeekdayMap), nextDateMap);
      }
      setAdditionalTimeRows([createEmptyTimeRange()]);
      setShowAddTimeModal(false);
      showToast('Availability ranges saved');
    } finally {
      setBusy(false);
    }
  };

  // ---- slots ------------------------------------------------------------
  const generateSlotsForRange = (y, m, day, range) => {
    if (!range?.start || !range?.end) return [];
    const [sh, sm] = range.start.split(':').map(Number);
    const [eh, em] = range.end.split(':').map(Number);
    let start = new Date(y, m, day, sh, sm);
    const end = new Date(y, m, day, eh, em);
    const duration = Number(range.duration || 15);
    const res = [];
    while (start.getTime() + duration * 60000 <= end.getTime()) {
      res.push({ time: `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}` });
      start = new Date(start.getTime() + duration * 60000);
    }
    return res;
  };

  const generateAllSlots = () => {
    const final = [];
    for (let d = 1; d <= getDaysInMonth(month, year); d += 1) {
      const dateKey = formatDateKey(year, month, d);
      const info = availabilityDateMap[dateKey] || {};
      const weekly = availabilityWeekdayMap[new Date(year, month, d).getDay()] || [];
      if (info.blocked) {
        final.push({ date: dateKey, slots: [], blocked: true, reason: info.reason || 'Doctor unavailable' });
        continue;
      }
      const ranges = (info.ranges || []).length ? info.ranges : weekly;
      const filtered = ranges.filter((r) => !r.clinicId || String(r.clinicId) === String(selectedClinic?.id));
      const slots = filtered.flatMap((r) => generateSlotsForRange(year, month, d, r));
      const unique = Array.from(new Map(slots.map((s) => [s.time, s])).values()).sort((a, b) => a.time.localeCompare(b.time));
      if (unique.length) final.push({ date: dateKey, slots: unique });
    }
    setSlotPreview(final);
    if (!final.length) {
      Alert.alert('Calendar', `No valid time ranges found for ${selectedClinic?.name || 'the selected hospital'}. Please add Start Time, End Time and Slot Duration first.`);
    }
  };

  const clearAll = () => {
    Alert.alert('Clear All', 'Clear selected days, weekdays and availability?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          try {
            setBusy(true);
            await axiosInstance.delete('/api/availability/clear-all', { data: { doctor_id: doctorId, clinic_id: selectedClinic?.id } });
          } catch (error) {
            setBusy(false);
            return Alert.alert('Calendar', apiMessage(error, 'Failed to clear availability'));
          }
          setBusy(false);
          setSelectedDays([]);
          setRecurringWeekdays([]);
          setAvailabilityDateMap((current) => {
            const next = Object.fromEntries(
              Object.entries(current).filter(([, v]) => v.blocked).map(([d, v]) => [d, { ...v, ranges: [] }]),
            );
            saveLocalAvailability([], next);
            return next;
          });
          setAvailabilityWeekdayMap({});
          setSlotPreview([]);
          setEditingTarget(null);
          setShowAddTimeModal(false);
        },
      },
    ]);
  };

  const saveDraft = () => {
    saveLocalAvailability(getAllLocalRanges(), availabilityDateMap);
    showToast('Draft saved on this device');
  };

  const selectClinic = (clinic) => {
    setSelectedClinic(clinic);
    // Never show the previous clinic's availability while the new one loads.
    setAvailabilityDateMap({});
    setAvailabilityWeekdayMap({});
    setSelectedDays([]);
    setRecurringWeekdays([]);
    setSlotPreview([]);
    setEditingTarget(null);
    setShowClinicDropdown(false);
    setShowNewClinicForm(false);
  };

  const createNewClinic = async () => {
    if (!newClinic.name.trim() || !newClinic.location.trim()) return showToast('Clinic name and location are required');
    try {
      setSavingClinic(true);
      const entry = await createClinic(doctorId, {
        name: newClinic.name.trim(),
        phone: newClinic.phone.trim(),
        location: newClinic.location.trim(),
      });
      setNewClinic({ name: '', phone: '', location: '' });
      if (entry) {
        const clinic = { ...entry, color: CLINIC_COLORS[clinics.length % CLINIC_COLORS.length] };
        setClinics((current) => [...current, clinic]);
        selectClinic(clinic);
      } else {
        await loadClinics();
        setShowClinicDropdown(false);
      }
      showToast('Clinic added');
    } catch (error) {
      showToast(apiMessage(error, 'Failed to create clinic'));
    } finally {
      setSavingClinic(false);
    }
  };

  // ---- multi-range rows ---------------------------------------------------
  const updateAdditionalTimeRow = (index, field, value) =>
    setAdditionalTimeRows((rows) => rows.map((r, i) => (i === index ? { ...r, [field]: field === 'duration' ? Number(value) : value } : r)));
  const addAdditionalTimeRow = () => setAdditionalTimeRows((rows) => [...rows, createEmptyTimeRange()]);
  const removeAdditionalTimeRow = (index) => setAdditionalTimeRows((rows) => (rows.length === 1 ? rows : rows.filter((_, i) => i !== index)));

  const onPickTime = (event, selected) => {
    const current = picker;
    if (Platform.OS === 'android') setPicker(null);
    if (!current || event?.type === 'dismissed' || !selected) return;
    const value = dateToTime(selected);
    if (current.context === 'row') updateAdditionalTimeRow(current.index, current.field, value);
    else setNewRange((prev) => ({ ...prev, [current.field]: value }));
  };

  const pickerValue = () => {
    if (!picker) return new Date();
    const raw = picker.context === 'row' ? additionalTimeRows[picker.index]?.[picker.field] : newRange[picker.field];
    return timeToDate(raw);
  };

  const renderTimePicker = () => (picker ? (
    <View>
      <DateTimePicker value={pickerValue()} mode="time" is24Hour={false} display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onPickTime} />
      {Platform.OS === 'ios' && (
        <Pressable style={s.pickerDone} onPress={() => setPicker(null)}><Text style={s.pickerDoneText}>Done</Text></Pressable>
      )}
    </View>
  ) : null);

  // ---- derived view state -------------------------------------------------
  const monthName = MONTH_NAMES[month];
  const monthDays = getDaysInMonth(month, year);
  const firstDayIndex = new Date(year, month, 1).getDay();
  const prevMonthDays = getDaysInMonth(month === 0 ? 11 : month - 1, month === 0 ? year - 1 : year);
  const calendarCells = [
    ...Array.from({ length: firstDayIndex }, (_, i) => ({ day: prevMonthDays - firstDayIndex + i + 1, muted: true })),
    ...Array.from({ length: monthDays }, (_, i) => ({ day: i + 1, muted: false })),
  ];
  while (calendarCells.length % 7 !== 0) {
    calendarCells.push({ day: calendarCells.length - firstDayIndex - monthDays + 1, muted: true });
  }
  const weeks = [];
  for (let i = 0; i < calendarCells.length; i += 7) weeks.push(calendarCells.slice(i, i + 7));

  const selectedDateLabel = selectedDays.length
    ? `${monthName} ${selectedDays[0]}, ${year}`
    : `${monthName} ${new Date().getDate()}, ${year}`;
  const configuredDatesCount = Object.values(availabilityDateMap).filter((item) => item?.ranges?.length).length;
  const recurringConfiguredCount = Object.values(availabilityWeekdayMap).filter((r) => r?.length).length;
  const blockedCount = Object.values(availabilityDateMap).filter((item) => item?.blocked).length;
  const visibleSlotPreview = slotPreview.filter((entry) => {
    const info = availabilityDateMap[entry.date] || {};
    if (activeCalendarTab === 'unavailable') return Boolean(entry.blocked || info.blocked);
    if (activeCalendarTab === 'specific') return !entry.blocked && Boolean(info.ranges?.length);
    const weekday = new Date(`${entry.date}T00:00:00`).getDay();
    return !entry.blocked && !info.ranges?.length && Boolean(availabilityWeekdayMap[weekday]?.length);
  });

  const editingInfo = editingTarget ? availabilityDateMap[editingTarget.key] || { ranges: [], blocked: false } : null;
  const saveAllDisabled = activeCalendarTab === 'recurring' ? recurringWeekdays.length === 0 : selectedDays.length === 0;

  // ---- render -------------------------------------------------------------
  return (
    <View style={s.screen}>
      <View style={s.header}>
        <View style={s.flex}>
          <Text style={s.title}>Calendar &amp; Availability</Text>
          <Text style={s.subtitle}>Recurring &amp; date-specific availability</Text>
        </View>
        <Pressable style={s.clearAllBtn} onPress={clearAll} disabled={!selectedClinic || busy}>
          <Text style={s.clearAllText}>Clear All</Text>
        </Pressable>
      </View>

      <Pressable style={s.clinicBar} onPress={() => setShowClinicDropdown(true)}>
        <View style={[s.clinicDot, { backgroundColor: selectedClinic?.color || colors.blue }]} />
        <Text style={s.clinicBarText} numberOfLines={1}>
          {apiStatus === 'loading' ? 'Loading clinics…' : selectedClinic?.name || 'Add a clinic to get started'}
        </Text>
        <AppIcon name="chevron-down" size={14} color="#667085" />
      </Pressable>

      <View style={s.tabs}>
        {[
          ['recurring', 'Recurring Schedule'],
          ['specific', 'Specific Dates'],
          ['unavailable', 'Exceptions / Unavailable'],
        ].map(([key, label]) => (
          <Pressable key={key} style={[s.tab, activeCalendarTab === key && s.tabActive]} onPress={() => setActiveCalendarTab(key)}>
            <Text style={[s.tabText, activeCalendarTab === key && s.tabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView style={s.flex} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <Text style={s.tabHelp}>
          {activeCalendarTab === 'recurring' && 'Select weekdays to create a schedule that repeats every week.'}
          {activeCalendarTab === 'specific' && 'Select a calendar date to add or update slots for that date.'}
          {activeCalendarTab === 'unavailable' && 'Select a calendar date to mark it unavailable or make it available again.'}
        </Text>

        {!!apiError && <Text style={s.apiNote}>{apiError}</Text>}

        {/* Month card */}
        <View style={s.card}>
          <View style={s.monthRow}>
            <Text style={s.month}>{monthName} {year}</Text>
            <Pressable onPress={() => changeMonth(-1)} hitSlop={8} style={s.monthBtn}>
              <AppIcon name="chevron-left" size={16} color="#344054" strokeWidth={2.2} />
            </Pressable>
            <Pressable onPress={() => changeMonth(1)} hitSlop={8} style={s.monthBtn}>
              <AppIcon name="chevron-right" size={16} color="#344054" strokeWidth={2.2} />
            </Pressable>
          </View>
          <View style={s.legend}>
            <View style={[s.legendDot, s.legendConfigured]} /><Text style={s.legendText}>Configured</Text>
            <View style={[s.legendDot, s.legendSelected]} /><Text style={s.legendText}>Selected</Text>
            <View style={[s.legendDot, s.legendEmpty]} /><Text style={s.legendText}>Empty</Text>
          </View>
          <View style={s.week}>
            {DAYS.map((d) => <Text key={d} style={s.dayHead}>{d.toUpperCase()}</Text>)}
          </View>
          {weeks.map((week, row) => (
            <View key={row} style={s.week}>
              {week.map((cell, col) => {
                const dateKey = !cell.muted ? formatDateKey(year, month, cell.day) : '';
                const weekday = !cell.muted ? new Date(year, month, cell.day).getDay() : null;
                const info = !cell.muted ? availabilityDateMap[dateKey] || {} : {};
                const recurringRanges = !cell.muted ? availabilityWeekdayMap[weekday] || [] : [];
                const isBlocked = Boolean(info.blocked);
                const isRecurring = !cell.muted && (recurringWeekdays.includes(weekday) || recurringRanges.length > 0);
                const specificCount = (info.ranges || []).length;
                const recurringCount = recurringRanges.length;
                const isConfigured = !cell.muted && (activeCalendarTab === 'specific'
                  ? specificCount > 0
                  : activeCalendarTab === 'recurring' ? recurringCount > 0 : isBlocked);
                const isPast = !cell.muted && isPastDate(year, month, cell.day);
                const rangeCount = activeCalendarTab === 'specific' ? specificCount : activeCalendarTab === 'recurring' ? recurringCount : 0;
                const tabSelected = activeCalendarTab === 'recurring' ? recurringWeekdays.includes(weekday) : !cell.muted && selectedDays.includes(cell.day);
                return (
                  <Pressable
                    key={`${cell.day}-${col}`}
                    disabled={cell.muted || isPast}
                    onPress={() => {
                      if (activeCalendarTab === 'recurring') toggleRecurringWeekday(weekday);
                      else openEditorForDate(year, month, cell.day);
                    }}
                    style={[
                      s.cell,
                      isConfigured && s.cellConfigured,
                      activeCalendarTab === 'recurring' && isRecurring && s.cellRecurring,
                      activeCalendarTab === 'unavailable' && isBlocked && s.cellUnavailable,
                      tabSelected && s.cellSelected,
                      (cell.muted || isPast) && s.cellDisabled,
                    ]}
                  >
                    <Text style={[s.cellDay, cell.muted && s.cellDayMuted, tabSelected && s.cellDaySelected]}>{cell.day}</Text>
                    {!cell.muted && activeCalendarTab === 'unavailable' && isBlocked && <Text style={s.cellUnavailableLabel} numberOfLines={1}>Unavail.</Text>}
                    {!cell.muted && activeCalendarTab !== 'unavailable' && rangeCount > 0 && (
                      <Text style={s.cellRanges} numberOfLines={1}>{rangeCount} {rangeCount === 1 ? 'range' : 'ranges'}</Text>
                    )}
                    {!cell.muted && activeCalendarTab === 'recurring' && tabSelected && rangeCount === 0 && (
                      <Text style={s.cellRanges} numberOfLines={1}>Weekly</Text>
                    )}
                    {!cell.muted && !isPast && !tabSelected && !isConfigured && (
                      <Text style={s.cellEmpty} numberOfLines={1}>{activeCalendarTab === 'unavailable' ? 'Avail.' : '—'}</Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        {/* Side panel (below the calendar on mobile) */}
        {activeCalendarTab !== 'recurring' ? (
          <View style={s.card}>
            <View style={s.sideTitle}>
              <View style={s.flex}>
                <Text style={s.cardTitle}>{activeCalendarTab === 'unavailable' ? 'Unavailable Dates' : selectedDateLabel}</Text>
                <Text style={s.cardSub}>
                  {activeCalendarTab === 'unavailable' ? `${blockedCount} dates blocked` : `${selectedDays.length || 0} days selected`}
                </Text>
              </View>
              <AppIcon name={activeCalendarTab === 'unavailable' ? 'warning' : 'calendar'} size={18} color={colors.blue} />
            </View>
            <View style={s.divider} />
            {activeCalendarTab === 'unavailable' ? (
              <Text style={s.emptyNote}>Tap any date on the calendar to add an unavailable reason and block / unblock that date.</Text>
            ) : (
              <>
                <Text style={s.sectionLabel}>Time Ranges</Text>
                {selectedDays.length ? (
                  getRangesForDateOrWeek(year, month, selectedDays[0]).length ? (
                    getRangesForDateOrWeek(year, month, selectedDays[0]).map((range, index) => (
                      <View key={`${range.start}-${index}`} style={s.rangeRow}>
                        <AppIcon name="clock" size={13} color="#667085" />
                        <Text style={s.rangeText}>{formatTime12h(range.start)}</Text>
                        <Text style={s.rangeArrow}>→</Text>
                        <Text style={s.rangeText}>{formatTime12h(range.end)}</Text>
                        <Text style={s.rangeDuration}>{range.duration}m</Text>
                      </View>
                    ))
                  ) : (
                    <Text style={s.emptyNote}>No saved ranges for selected date.</Text>
                  )
                ) : (
                  <Text style={s.emptyNote}>Tap any calendar date to edit availability or mark unavailable.</Text>
                )}
                <Pressable onPress={() => setShowAddTimeModal(true)}>
                  <Text style={s.addLink}>＋ Add Another Range</Text>
                </Pressable>
                <View style={s.divider} />
                <Pressable style={s.primaryWrap} onPress={() => setShowAddTimeModal(true)}>
                  <LinearGradient colors={doctorGradient} {...gradientDirection} style={s.primary}>
                    <Text style={s.primaryText}>Apply to Selected Dates</Text>
                  </LinearGradient>
                </Pressable>
              </>
            )}
          </View>
        ) : (
          <View style={s.card}>
            <Text style={s.cardTitle}>Recurring Rules</Text>
            <Text style={s.cardSub}>Select days</Text>
            <Text style={s.help}>Repeat these timings weekly on selected days.</Text>
            <View style={s.weekdayPills}>
              {DAYS.map((day, index) => {
                const active = recurringWeekdays.includes(index);
                return (
                  <Pressable key={day} onPress={() => toggleRecurringWeekday(index)} style={[s.weekdayPill, active && s.weekdayPillActive]}>
                    <Text style={[s.weekdayPillText, active && s.weekdayPillTextActive]}>{day[0]}</Text>
                  </Pressable>
                );
              })}
            </View>
            {recurringWeekdays.map((w) => (availabilityWeekdayMap[w] || []).length > 0 && (
              <View key={w} style={s.weekdayRanges}>
                <Text style={s.weekdayRangesTitle}>{DAYS[w]}</Text>
                {(availabilityWeekdayMap[w] || []).map((range, index) => (
                  <View key={`${w}-${range.start}-${index}`} style={s.rangeRow}>
                    <AppIcon name="clock" size={13} color="#667085" />
                    <Text style={s.rangeText}>{formatTime12h(range.start)}</Text>
                    <Text style={s.rangeArrow}>→</Text>
                    <Text style={s.rangeText}>{formatTime12h(range.end)}</Text>
                    <Text style={s.rangeDuration}>{range.duration}m</Text>
                    <Pressable hitSlop={8} style={s.rangeDelete} onPress={() => removeRangeForWeekday(w, index)}>
                      <AppIcon name="trash" size={13} color="#DC2626" />
                    </Pressable>
                  </View>
                ))}
              </View>
            ))}
            <Pressable style={s.secondary} onPress={() => setShowAddTimeModal(true)}>
              <Text style={s.secondaryText}>Apply to weekdays</Text>
            </Pressable>
          </View>
        )}

        {/* Slot preview */}
        <Text style={s.previewTitle}>Slot Preview — {selectedClinic?.name || 'Clinic'}</Text>
        <View style={s.card}>
          {visibleSlotPreview.length === 0 ? (
            <View style={s.previewEmpty}>
              <AppIcon name="calendar" size={24} color="#94A3B8" />
              <Text style={s.emptyNote}>No slots generated yet. Configure availability and tap</Text>
              <Pressable onPress={generateAllSlots}><Text style={s.addLink}>Generate Slots</Text></Pressable>
              <Text style={s.emptyNote}>to preview.</Text>
            </View>
          ) : (
            visibleSlotPreview.map((entry, index) => (
              <View key={`${entry.date}-${index}`} style={s.previewGroup}>
                <View style={s.previewHead}>
                  <Text style={s.previewDate}>{entry.date}</Text>
                  <Text style={s.previewCount}>{entry.blocked ? 'Unavailable' : `${entry.slots?.length || 0} slots`}</Text>
                </View>
                {entry.blocked ? (
                  <Text style={s.blockedText}>⊘ {entry.reason || 'Doctor unavailable'}</Text>
                ) : (
                  <View style={s.previewChips}>
                    {entry.slots.map((slot, i) => (
                      <View key={`${slot.time}-${i}`} style={s.previewChip}><Text style={s.previewChipText}>{slot.time}</Text></View>
                    ))}
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Bottom bar */}
      <View style={s.bottomBar}>
        <View style={s.statusMeta}>
          <Text style={s.statusText}>● Selected dates: {selectedDays.length}</Text>
          <Text style={s.statusText}>● Configured dates: {configuredDatesCount}</Text>
          <Text style={s.statusText}>● Weekly days: {recurringConfiguredCount}</Text>
          <Text style={[s.statusText, s.statusPending]}>● Pending changes: {selectedDays.length}</Text>
        </View>
        <View style={s.bottomActions}>
          <Pressable style={s.outlineBtn} onPress={() => setSlotPreview([])}><Text style={s.outlineBtnText}>Clear Preview</Text></Pressable>
          <Pressable style={s.outlineBtn} onPress={saveDraft}><Text style={s.outlineBtnText}>Save Draft</Text></Pressable>
          <Pressable style={s.generateWrap} onPress={generateAllSlots}>
            <LinearGradient colors={doctorGradient} {...gradientDirection} style={s.generate}>
              <Text style={s.generateText}>↯ Generate Slots</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </View>

      {busy && <View style={s.busyOverlay}><ActivityIndicator size="large" color={colors.blue} /></View>}

      {/* Clinic dropdown */}
      <Modal visible={showClinicDropdown} transparent animationType="slide" onRequestClose={() => setShowClinicDropdown(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <Text style={s.modalTitle}>Select Clinic</Text>
            <ScrollView style={s.clinicList}>
              {clinics.map((clinic) => {
                const active = String(clinic.id) === String(selectedClinic?.id);
                return (
                  <Pressable key={clinic.id} style={[s.clinicRow, active && s.clinicRowActive]} onPress={() => selectClinic(clinic)}>
                    <View style={[s.clinicDot, { backgroundColor: clinic.color }]} />
                    <View style={s.flex}>
                      <Text style={s.clinicRowName}>{clinic.name}</Text>
                      <Text style={s.clinicRowLocation}>{clinic.location}</Text>
                    </View>
                    {active && <Text style={[s.selectedBadge, { backgroundColor: clinic.color }]}>Selected</Text>}
                  </Pressable>
                );
              })}
              {!clinics.length && apiStatus !== 'loading' && <Text style={s.emptyNote}>No clinics yet — add your first one below.</Text>}
            </ScrollView>
            {showNewClinicForm ? (
              <View style={s.newClinicForm}>
                <TextInput style={s.input} placeholder="Clinic name" placeholderTextColor="#94A3B8" value={newClinic.name} onChangeText={(v) => setNewClinic((p) => ({ ...p, name: v }))} />
                <TextInput style={s.input} placeholder="Phone (optional)" placeholderTextColor="#94A3B8" keyboardType="phone-pad" value={newClinic.phone} onChangeText={(v) => setNewClinic((p) => ({ ...p, phone: v }))} />
                <TextInput style={s.input} placeholder="Address / location" placeholderTextColor="#94A3B8" value={newClinic.location} onChangeText={(v) => setNewClinic((p) => ({ ...p, location: v }))} />
                <View style={s.modalActions}>
                  <Pressable style={s.outlineBtnFlex} onPress={() => setShowNewClinicForm(false)}><Text style={s.outlineBtnText}>Cancel</Text></Pressable>
                  <Pressable style={s.solidBtn} onPress={createNewClinic} disabled={savingClinic}>
                    {savingClinic ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.solidBtnText}>Save Clinic</Text>}
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable style={s.addClinicBtn} onPress={() => setShowNewClinicForm(true)}>
                <AppIcon name="plus" size={14} color={colors.blue} />
                <Text style={s.addLink}>Add a new clinic</Text>
              </Pressable>
            )}
            <Pressable style={s.modalClose} onPress={() => { setShowClinicDropdown(false); setShowNewClinicForm(false); }}>
              <Text style={s.modalCloseText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Add Time Ranges (multi-range) */}
      <Modal visible={showAddTimeModal} transparent animationType="slide" onRequestClose={() => setShowAddTimeModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <View style={s.flex}>
                <Text style={s.modalTitle}>Add Time Ranges</Text>
                <Text style={s.cardSub}>Add separate windows such as morning, afternoon and evening.</Text>
              </View>
              <Pressable onPress={() => setShowAddTimeModal(false)} hitSlop={8}><AppIcon name="x" size={18} color="#667085" /></Pressable>
            </View>
            <ScrollView style={s.modalScroll} keyboardShouldPersistTaps="handled">
              {additionalTimeRows.map((range, index) => (
                <View key={index} style={s.multiRow}>
                  <View style={s.multiRowHead}>
                    <Text style={s.rangeNumber}>Range {index + 1}</Text>
                    <Pressable
                      onPress={() => removeAdditionalTimeRow(index)}
                      disabled={additionalTimeRows.length === 1}
                      hitSlop={8}
                      style={additionalTimeRows.length === 1 && s.disabled}
                    >
                      <AppIcon name="trash" size={15} color="#DC2626" />
                    </Pressable>
                  </View>
                  <View style={s.timeFields}>
                    <TimeField label="Start Time" value={range.start} onPress={() => setPicker({ context: 'row', index, field: 'start' })} />
                    <TimeField label="End Time" value={range.end} onPress={() => setPicker({ context: 'row', index, field: 'end' })} />
                  </View>
                  <Text style={s.fieldLabel}>Slot Duration</Text>
                  <View style={s.durationRow}>
                    {MULTI_RANGE_DURATIONS.map((mins) => (
                      <Pressable key={mins} onPress={() => updateAdditionalTimeRow(index, 'duration', mins)} style={[s.durationChip, range.duration === mins && s.durationChipActive]}>
                        <Text style={[s.durationChipText, range.duration === mins && s.durationChipTextActive]}>{mins} min</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))}
              <Pressable onPress={addAdditionalTimeRow}><Text style={s.addLink}>＋ Add another time range</Text></Pressable>
              {picker?.context === 'row' && renderTimePicker()}
            </ScrollView>
            <View style={s.modalActions}>
              <Pressable style={s.outlineBtnFlex} onPress={() => setShowAddTimeModal(false)}><Text style={s.outlineBtnText}>Done</Text></Pressable>
              <Pressable
                style={[s.solidBtn, s.solidBtnWide, (saveAllDisabled || busy) && s.disabled]}
                disabled={saveAllDisabled || busy}
                onPress={() => saveAdditionalTimeRows(activeCalendarTab === 'recurring' ? 'weekday' : 'date')}
              >
                <Text style={s.solidBtnText}>
                  {activeCalendarTab === 'specific'
                    ? 'Save all ranges to dates'
                    : activeCalendarTab === 'recurring' ? 'Save all ranges to weekdays' : 'Save availability ranges'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Date editor: Saved Slots + Add Slot + Save Slot / unavailable */}
      <Modal visible={editingTarget?.type === 'date'} transparent animationType="slide" onRequestClose={() => setEditingTarget(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalSheet}>
            {editingTarget?.type === 'date' && (
              <>
                <View style={s.modalHeader}>
                  <View style={s.flex}>
                    <Text style={s.modalTitle}>{editingTarget.key}</Text>
                    <Text style={s.cardSub}>{selectedClinic?.name} availability for this date.</Text>
                  </View>
                  <Pressable onPress={() => setEditingTarget(null)} hitSlop={8}><AppIcon name="x" size={18} color="#667085" /></Pressable>
                </View>
                <ScrollView style={s.modalScroll} keyboardShouldPersistTaps="handled">
                  {activeCalendarTab === 'unavailable' && (
                    <View>
                      <Text style={s.fieldLabel}>Unavailable reason</Text>
                      <TextInput
                        style={s.textArea}
                        value={unavailableReason}
                        onChangeText={setUnavailableReason}
                        placeholder="e.g., Emergency, leave, conference, hospital duty..."
                        placeholderTextColor="#94A3B8"
                        multiline
                        textAlignVertical="top"
                      />
                      <Pressable
                        style={[s.solidBtn, s.fullBtn, !editingInfo?.blocked && s.dangerBtn]}
                        disabled={busy}
                        onPress={() => toggleBlockDate(editingTarget.key, editingTarget.year, editingTarget.month, editingTarget.day)}
                      >
                        <Text style={s.solidBtnText}>{editingInfo?.blocked ? 'Mark Available Again' : 'Mark Unavailable for This Date'}</Text>
                      </Pressable>
                      {editingInfo?.blocked && (
                        <Text style={s.emptyNote}>This override applies only to {editingTarget.key}. Weekly availability remains active for other matching days.</Text>
                      )}
                    </View>
                  )}

                  {activeCalendarTab === 'specific' && (
                    <>
                      <Text style={s.sectionLabel}>Saved Slots</Text>
                      {(editingInfo?.ranges || []).length ? (
                        editingInfo.ranges.map((range, index) => (
                          <View key={`${range.start}-${range.end}-${index}`} style={s.rangeRow}>
                            <AppIcon name="clock" size={13} color="#667085" />
                            <Text style={s.rangeText}>{formatTime12h(range.start)}</Text>
                            <Text style={s.rangeArrow}>→</Text>
                            <Text style={s.rangeText}>{formatTime12h(range.end)}</Text>
                            <Text style={s.rangeDuration}>{range.duration}m</Text>
                            <Pressable onPress={() => removeRange(index)} hitSlop={8} style={s.rangeDelete}>
                              <AppIcon name="trash" size={13} color="#DC2626" />
                            </Pressable>
                          </View>
                        ))
                      ) : (
                        <Text style={s.emptyNote}>No date-specific slots. Weekly slots may still apply unless this date is unavailable.</Text>
                      )}

                      {!editingInfo?.blocked ? (
                        <>
                          <Text style={[s.sectionLabel, s.sectionSpaced]}>Add Slot for This Date</Text>
                          <View style={s.timeFields}>
                            <TimeField label="Start Time" value={newRange.start} onPress={() => setPicker({ context: 'newRange', field: 'start' })} />
                            <TimeField label="End Time" value={newRange.end} onPress={() => setPicker({ context: 'newRange', field: 'end' })} />
                          </View>
                          <Text style={s.fieldLabel}>Slot Duration</Text>
                          <View style={s.durationRow}>
                            {DATE_EDITOR_DURATIONS.map((mins) => (
                              <Pressable key={mins} onPress={() => setNewRange((p) => ({ ...p, duration: mins }))} style={[s.durationChip, newRange.duration === mins && s.durationChipActive]}>
                                <Text style={[s.durationChipText, newRange.duration === mins && s.durationChipTextActive]}>{mins} min</Text>
                              </Pressable>
                            ))}
                          </View>
                          {picker?.context === 'newRange' && renderTimePicker()}
                        </>
                      ) : (
                        <Text style={s.blockedText}>This date is marked unavailable. Use the Exceptions / Unavailable tab to make it available again.</Text>
                      )}
                    </>
                  )}
                </ScrollView>
                <View style={s.modalActions}>
                  <Pressable style={s.outlineBtnFlex} onPress={() => setEditingTarget(null)}><Text style={s.outlineBtnText}>Close</Text></Pressable>
                  {activeCalendarTab === 'specific' && !editingInfo?.blocked && (
                    <Pressable
                      style={[s.solidBtn, s.solidBtnWide, (!newRange.start || !newRange.end || busy) && s.disabled]}
                      disabled={!newRange.start || !newRange.end || busy}
                      onPress={saveRange}
                    >
                      <Text style={s.solidBtnText}>Save Slot</Text>
                    </Pressable>
                  )}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function TimeField({ label, value, onPress }) {
  return (
    <View style={s.timeField}>
      <Text style={s.fieldLabel}>{label}</Text>
      <Pressable style={s.timeButton} onPress={onPress}>
        <AppIcon name="clock" size={13} color="#667085" />
        <Text style={[s.timeButtonText, !value && s.placeholder]}>{value ? formatTime12h(value) : '--:--'}</Text>
      </Pressable>
    </View>
  );
}

const s = createDoctorStyles({
  screen: { flex: 1, backgroundColor: '#F0FDFA' },
  flex: { flex: 1 },
  header: { minHeight: 60, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#D7DEE9', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, gap: 10 },
  title: { fontSize: 19, fontWeight: '800', color: '#0D9488' },
  subtitle: { fontSize: 12, color: '#667085', marginTop: 2 },
  clearAllBtn: { height: 34, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FCA5A5', alignItems: 'center', justifyContent: 'center' },
  clearAllText: { fontSize: 13, fontWeight: '700', color: '#DC2626' },
  clinicBar: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#D7DEE9', paddingHorizontal: 14, height: 42 },
  clinicDot: { width: 10, height: 10, borderRadius: 5 },
  clinicBarText: { flex: 1, fontSize: 13.5, fontWeight: '700', color: '#17243A' },
  tabs: { flexDirection: 'row', backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#D7DEE9' },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent', paddingHorizontal: 4 },
  tabActive: { borderBottomColor: colors.blue },
  tabText: { fontSize: 12, fontWeight: '600', color: '#667085', textAlign: 'center' },
  tabTextActive: { color: colors.blue, fontWeight: '800' },
  content: { padding: 10, paddingBottom: 16 },
  tabHelp: { fontSize: 12.5, color: '#475467', marginBottom: 8, marginHorizontal: 2 },
  apiNote: { fontSize: 12.5, color: '#B45309', backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 8, padding: 8, marginBottom: 8 },
  card: { backgroundColor: '#FFF', borderWidth: 1, borderColor: '#CAD3E1', borderRadius: 10, padding: 12, marginBottom: 12 },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  month: { flex: 1, fontSize: 18, fontWeight: '700', color: '#17243A' },
  monthBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F4F8', alignItems: 'center', justifyContent: 'center' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', marginTop: 10, marginBottom: 6, gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 3, borderWidth: 1 },
  legendConfigured: { backgroundColor: '#CCFBF1', borderColor: colors.brightBlue },
  legendSelected: { backgroundColor: colors.blue, borderColor: colors.blue },
  legendEmpty: { backgroundColor: '#FFF', borderColor: '#CAD3E1' },
  legendText: { fontSize: 12, color: '#667085', marginRight: 10 },
  week: { flexDirection: 'row' },
  dayHead: { width: '14.285%', textAlign: 'center', fontSize: 10.5, fontWeight: '700', color: '#667085', paddingVertical: 6 },
  cell: { width: '14.285%', minHeight: 54, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 5, borderWidth: 1, borderColor: '#EEF1F5', borderRadius: 7 },
  cellConfigured: { backgroundColor: '#CCFBF1', borderColor: colors.brightBlue },
  cellRecurring: { backgroundColor: '#E6FBF8' },
  cellUnavailable: { backgroundColor: '#FEE2E2', borderColor: '#EF4444' },
  cellSelected: { backgroundColor: colors.blue, borderColor: colors.blue },
  cellDisabled: { opacity: 0.4 },
  cellDay: { fontSize: 14, fontWeight: '600', color: '#25344A' },
  cellDayMuted: { color: '#C5CBD5' },
  cellDaySelected: { color: '#FFF' },
  cellRanges: { fontSize: 9, fontWeight: '700', color: '#0F766E', marginTop: 2 },
  cellUnavailableLabel: { fontSize: 9, fontWeight: '700', color: '#DC2626', marginTop: 2 },
  cellEmpty: { fontSize: 9, color: '#98A2B3', marginTop: 2 },
  sideTitle: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { fontSize: 17, fontWeight: '700', color: '#17243A' },
  cardSub: { fontSize: 12.5, color: colors.blue, marginTop: 3 },
  divider: { height: 1, backgroundColor: '#EEF1F5', marginVertical: 10 },
  sectionLabel: { fontSize: 14, fontWeight: '700', color: '#344054', marginBottom: 8 },
  sectionSpaced: { marginTop: 14 },
  rangeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#D7DEE9', borderRadius: 8, paddingHorizontal: 10, height: 40, marginBottom: 7, backgroundColor: '#FAFBFD' },
  rangeText: { fontSize: 13.5, fontWeight: '600', color: '#344054' },
  rangeArrow: { fontSize: 13, color: '#98A2B3' },
  rangeDuration: { fontSize: 12, color: colors.blue, marginLeft: 6 },
  rangeDelete: { marginLeft: 'auto' },
  emptyNote: { fontSize: 12.5, color: '#667085', lineHeight: 18, textAlign: 'center', marginVertical: 4 },
  addLink: { fontSize: 14, fontWeight: '700', color: colors.blue, marginVertical: 8 },
  primaryWrap: {},
  primary: { height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
  help: { fontSize: 13, color: '#667085', marginTop: 6 },
  weekdayPills: { flexDirection: 'row', justifyContent: 'space-between', marginVertical: 14 },
  weekdayPill: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: '#CDD5E1', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF' },
  weekdayPillActive: { backgroundColor: colors.blue, borderColor: colors.blue },
  weekdayPillText: { fontSize: 14, fontWeight: '600', color: '#344054' },
  weekdayPillTextActive: { color: '#FFF', fontWeight: '800' },
  weekdayRanges: { marginBottom: 8 },
  weekdayRangesTitle: { fontSize: 13, fontWeight: '700', color: '#17243A', marginBottom: 6 },
  secondary: { height: 44, borderWidth: 1, borderColor: '#99F6E4', borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paleBlue, marginTop: 4 },
  secondaryText: { fontSize: 14, fontWeight: '700', color: colors.blue },
  previewTitle: { fontSize: 16, fontWeight: '700', color: colors.blue, marginBottom: 8, marginHorizontal: 2 },
  previewEmpty: { alignItems: 'center', paddingVertical: 18, gap: 2 },
  previewGroup: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#EEF1F5', gap: 6 },
  previewHead: { flexDirection: 'row', justifyContent: 'space-between' },
  previewDate: { fontSize: 14, fontWeight: '700', color: '#17243A' },
  previewCount: { fontSize: 12.5, fontWeight: '600', color: colors.blue },
  previewChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  previewChip: { paddingHorizontal: 9, height: 26, borderRadius: 13, backgroundColor: colors.paleBlue, alignItems: 'center', justifyContent: 'center' },
  previewChipText: { fontSize: 12, fontWeight: '600', color: colors.blue },
  blockedText: { fontSize: 13, fontWeight: '600', color: '#EF4444', marginTop: 6 },
  bottomBar: { backgroundColor: '#FFF', borderTopWidth: 1, borderTopColor: '#D7DEE9', paddingHorizontal: 10, paddingTop: 6, paddingBottom: 8 },
  statusMeta: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 10, rowGap: 2, marginBottom: 6 },
  statusText: { fontSize: 11, color: '#475467' },
  statusPending: { color: '#B45309' },
  bottomActions: { flexDirection: 'row', gap: 7 },
  outlineBtn: { paddingHorizontal: 10, height: 42, borderWidth: 1, borderColor: '#C8D1DF', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  outlineBtnFlex: { flex: 1, height: 44, borderWidth: 1, borderColor: '#C8D1DF', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  outlineBtnText: { fontSize: 13, fontWeight: '600', color: '#344054' },
  generateWrap: { flex: 1 },
  generate: { height: 42, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  generateText: { fontSize: 13.5, fontWeight: '700', color: '#FFF' },
  busyOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(255,255,255,0.45)', alignItems: 'center', justifyContent: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, maxHeight: '88%' },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#17243A' },
  modalScroll: { flexGrow: 0 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  modalClose: { marginTop: 12, alignItems: 'center', paddingVertical: 6 },
  modalCloseText: { fontSize: 13.5, fontWeight: '700', color: '#667085' },
  solidBtn: { flex: 1, height: 44, borderRadius: 8, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  solidBtnWide: { flex: 1.6 },
  solidBtnText: { fontSize: 13.5, fontWeight: '700', color: '#FFF', textAlign: 'center' },
  fullBtn: { flex: 0, width: '100%', marginVertical: 10 },
  dangerBtn: { backgroundColor: '#DC2626' },
  disabled: { opacity: 0.45 },
  multiRow: { borderWidth: 1, borderColor: '#D7DEE9', borderRadius: 10, padding: 10, marginBottom: 10 },
  multiRowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  rangeNumber: { fontSize: 13, fontWeight: '800', color: colors.blue },
  timeFields: { flexDirection: 'row', gap: 10 },
  timeField: { flex: 1 },
  fieldLabel: { fontSize: 12.5, fontWeight: '700', color: '#344054', marginBottom: 5, marginTop: 6 },
  timeButton: { height: 42, borderWidth: 1, borderColor: '#C7D0DF', borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10 },
  timeButtonText: { fontSize: 14, color: '#17243A' },
  placeholder: { color: '#94A3B8' },
  durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  durationChip: { paddingHorizontal: 11, height: 32, borderRadius: 16, borderWidth: 1, borderColor: '#C7D0DF', alignItems: 'center', justifyContent: 'center' },
  durationChipActive: { backgroundColor: colors.paleBlue, borderColor: colors.blue },
  durationChipText: { fontSize: 12.5, fontWeight: '600', color: '#667085' },
  durationChipTextActive: { color: colors.blue },
  textArea: { minHeight: 80, borderWidth: 1, borderColor: '#D5DAE3', borderRadius: 10, padding: 10, fontSize: 13.5, color: '#17243A' },
  pickerDone: { alignSelf: 'flex-end', paddingVertical: 6, paddingHorizontal: 12 },
  pickerDoneText: { fontSize: 14, fontWeight: '700', color: colors.blue },
  clinicList: { maxHeight: 280 },
  clinicRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#EEF1F5', borderRadius: 8 },
  clinicRowActive: { backgroundColor: '#F0FDFA' },
  clinicRowName: { fontSize: 14, fontWeight: '700', color: '#17243A' },
  clinicRowLocation: { fontSize: 12, color: '#667085', marginTop: 2 },
  selectedBadge: { fontSize: 11, fontWeight: '700', color: '#FFF', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
  addClinicBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 6 },
  newClinicForm: { marginTop: 10, gap: 10 },
  input: { height: 44, borderWidth: 1, borderColor: '#D5DAE3', borderRadius: 10, paddingHorizontal: 12, fontSize: 13.5, color: '#17243A' },
});
