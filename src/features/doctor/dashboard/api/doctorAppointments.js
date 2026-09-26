// Port of the web doctor dashboard's appointment layer
// (chatbot/src/Component/DoctorDashboard/appointmentFeed.js + the helpers at
// the top of Dashboard/DoctorDashboard.jsx). Same endpoints, params, status
// normalization and payloads, so both clients read and write identically.
import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosInstance from '../../../../axiosConfig';

export const pickFirst = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== '');

// ---- feed -----------------------------------------------------------------

const COLLECTION_KEYS = new Set([
  'data', 'appointments', 'online', 'online_appointments', 'onlineAppointments',
  'walkin', 'walk_in', 'walk_in_appointments', 'walkin_appointments',
  'walkInAppointments', 'walkinAppointments', 'walkins', 'followups',
  'followUps', 'follow_ups', 'result', 'results',
]);

export const normalizeApiList = (payload) => {
  const rows = [];
  const visited = new Set();
  const getSourceHint = (key, currentHint) => {
    const k = String(key || '').toLowerCase();
    if (k.includes('walkin') || k.includes('walk_in')) return 'walkin';
    if (k.includes('online')) return 'online';
    return currentHint;
  };
  const collect = (value, sourceHint = '') => {
    if (!value || typeof value !== 'object' || visited.has(value)) return;
    visited.add(value);
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item && typeof item === 'object') {
          rows.push(sourceHint ? { ...item, __appointmentSource: sourceHint } : item);
        }
      });
      return;
    }
    Object.entries(value).forEach(([key, nested]) => {
      if (COLLECTION_KEYS.has(key)) collect(nested, getSourceHint(key, sourceHint));
    });
  };
  collect(payload);
  return rows;
};

export const getAppointmentSource = (appointment) => {
  const rawType = String(pickFirst(
    appointment?.__appointmentSource, appointment?.appointment_source,
    appointment?.appointmentSource, appointment?.source, appointment?.record_type,
    appointment?.recordType, appointment?.appointment_type, appointment?.appointmentType,
    appointment?.booking_type, appointment?.bookingType, appointment?.consultation_mode,
    appointment?.consultationMode, appointment?.type, '',
  )).toLowerCase();
  const hasWalkInIdentity = Boolean(
    appointment?.walkin_appointment_id || appointment?.walkinAppointmentId ||
    appointment?.walkin_id || appointment?.walkinId,
  );
  return rawType.includes('walk') || hasWalkInIdentity ? 'walkin' : 'online';
};

// Online and walk-in tables can share numeric IDs — dedupe per source only.
const mergeAppointmentLists = (...lists) => {
  const records = new Map();
  const withoutId = [];
  lists.flat().forEach((a) => {
    const id = pickFirst(a.id, a._id, a.appointment_id, a.appointmentId,
      a.walkin_appointment_id, a.walkinAppointmentId, a.walkin_id, a.walkinId);
    if (id === undefined) withoutId.push(a);
    else records.set(`${getAppointmentSource(a)}:${id}`, a);
  });
  return [...records.values(), ...withoutId];
};

export const loadDoctorAppointmentFeed = async (doctorId) => {
  const params = { doctor_id: doctorId };
  const [online, walkins, completed] = await Promise.all([
    axiosInstance.get('/api/appointments', { params }),
    axiosInstance.get('/api/walkin-appointments', { params }),
    axiosInstance.get('/api/appointments', { params: { ...params, appointment_status: 'completed' } }),
  ]);
  return mergeAppointmentLists(
    normalizeApiList(online.data),
    normalizeApiList(completed.data),
    normalizeApiList(walkins.data).map((item) => ({ ...item, __appointmentSource: 'walkin' })),
  );
};

export const loadDoctorFollowUps = async (doctorId) => {
  const response = await axiosInstance.get('/api/followups', { params: { doctor_id: doctorId } });
  return normalizeApiList(response.data);
};

// ---- doctor identity ------------------------------------------------------

export const getStoredDoctorUser = async () => {
  try {
    return JSON.parse((await AsyncStorage.getItem('userData')) || 'null');
  } catch {
    return null;
  }
};

export const getDoctorIdFromUser = (user) => pickFirst(
  user?.id, user?._id, user?.doctor_id, user?.doctorId, user?.user_id, user?.userId,
  user?.user?.id, user?.user?._id, user?.data?.id, user?.data?._id,
  user?.data?.user?.id, user?.data?.user?._id,
);

export const getDoctorName = (user) => pickFirst(
  user?.name, user?.full_name, user?.fullName, user?.user?.name, user?.data?.user?.name, 'Doctor',
);

// ---- dates / status -------------------------------------------------------

export const formatLocalDateKey = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
};

const getAppointmentDateValue = (a) => pickFirst(
  a?.estimated_start_at, a?.estimatedStartAt, a?.original_appointment_at, a?.originalAppointmentAt,
  a?.appointment_date, a?.appointmentDate, a?.date, a?.booking_date, a?.bookingDate,
  a?.scheduled_date, a?.scheduledDate, a?.walkin_date, a?.walkinDate, a?.visit_date,
  a?.visitDate, a?.check_in_at, a?.checkInAt, a?.created_at, a?.createdAt,
);

const getAppointmentTimeValue = (a) => pickFirst(
  a?.appointment_time, a?.appointmentTime, a?.time, a?.scheduled_time, a?.scheduledTime,
  a?.slot_time, a?.slotTime, a?.start_time, a?.slot_start_time, a?.slotStartTime,
  a?.check_in_time, a?.checkInTime,
);

const isValidDate = (d) => d instanceof Date && !Number.isNaN(d.getTime());

// A date-only value serialised as UTC midnight ("2026-09-25T00:00:00.000Z")
// carries no real time of day — don't read 00:00 UTC (05:30 IST) as the slot.
const isMidnightUtc = (value) => /T00:00(:00(\.0+)?)?(Z|[+-]00:?00)$/.test(String(value));

// Accepts "14:30", "14:30:00", "2:30 PM" and "02:30 pm" on the given day.
const parseTimeOnDate = (dateKey, value) => {
  if (!dateKey || !value) return null;
  const match = String(value).trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i);
  if (!match) return null;
  let hours = Number(match[1]);
  if (match[4]?.toUpperCase() === 'PM' && hours !== 12) hours += 12;
  if (match[4]?.toUpperCase() === 'AM' && hours === 12) hours = 0;
  const dt = new Date(
    Number(dateKey.slice(0, 4)), Number(dateKey.slice(5, 7)) - 1, Number(dateKey.slice(8, 10)),
    hours, Number(match[2]), Number(match[3] || 0),
  );
  return isValidDate(dt) ? dt : null;
};

// The one place that decides an appointment's slot start. The queue card's
// time, the Start Consultation gate and the pending-expiry check all read it, so the
// time on screen is always the time Start unlocks. Null when no time is known.
const resolveScheduledStart = (a) => {
  const effective = pickFirst(a?.estimated_start_at, a?.estimatedStartAt, a?.original_appointment_at, a?.originalAppointmentAt);
  if (effective) {
    const d = new Date(effective);
    if (isValidDate(d)) return d;
  }
  const dateValue = getAppointmentDateValue(a);
  const dateKey = formatLocalDateKey(dateValue);
  if (!dateKey) return null;
  const timeValue = getAppointmentTimeValue(a);
  if (timeValue) {
    if (String(timeValue).includes('T')) {
      const d = new Date(timeValue);
      return isValidDate(d) ? d : null;
    }
    return parseTimeOnDate(dateKey, timeValue);
  }
  // Patient bookings send one ISO `date` that carries the time too.
  if (typeof dateValue === 'string' && dateValue.includes('T') && !isMidnightUtc(dateValue)) {
    const d = new Date(dateValue);
    if (isValidDate(d)) return d;
  }
  return null;
};

// `endOfDayFallback`: with no time on the appointment, treat it as 23:59:59
// (right for expiry). Pass false to get null instead when the time is unknown.
const getAppointmentDateTime = (a, { endOfDayFallback = true } = {}) => {
  const resolved = resolveScheduledStart(a);
  if (resolved || !endOfDayFallback) return resolved;
  const dateKey = formatLocalDateKey(getAppointmentDateValue(a));
  return dateKey ? parseTimeOnDate(dateKey, '23:59:59') : null;
};

export const isTodayAppointment = (a) => {
  const value = getAppointmentDateValue(a);
  if (!value) return true;
  const key = formatLocalDateKey(value);
  return !key || key === formatLocalDateKey();
};

export const normalizeAppointmentStatus = (a, forcedStatus) => {
  const raw = pickFirst(forcedStatus, a?.appointment_status, a?.walkin_status, a?.queue_status, a?.status);
  const status = String(raw || 'pending').toLowerCase().trim().replace(/\s+/g, '-');
  if (status === 'completed' || status === 'complete') return 'completed';
  if (status === 'cancelled' || status === 'canceled') return 'cancelled';
  if (status === 'confirmed' || status === 'accepted' || status === 'active') return 'confirmed';
  if (['in-progress', 'in_progress', 'in-consultation', 'in_consultation'].includes(status)) return 'in-progress';
  return 'pending';
};

// Works on raw API rows and on formatAppointment() output (both carry status).
// True once a pending online appointment's slot time has passed. The doctor
// dashboard must NOT drop these from the Pending queue, or a patient the
// doctor hasn't seen yet vanishes from today's queue.
export const isExpiredPendingAppointment = (a, nowMs = Date.now()) => {
  if (normalizeAppointmentStatus(a) !== 'pending') return false;
  // Walk-ins stay queued until their status is changed explicitly.
  if (getAppointmentSource(a) === 'walkin') return false;
  const dt = getAppointmentDateTime(a.__raw || a);
  return dt ? dt.getTime() < nowMs : false;
};

// In-person consultations can only be started once the slot time arrives.
// Walk-ins are already at the clinic, and appointments without a known time
// can't be gated, so both are always startable.
export const isConsultationStartOpen = (appt, nowMs = Date.now()) => {
  if (!appt) return false;
  if (getAppointmentSource(appt) === 'walkin') return true;
  const dt = getAppointmentDateTime(appt.__raw || appt, { endOfDayFallback: false })
    // Last resort: the exact time string the card is showing.
    || parseTimeOnDate(formatLocalDateKey(appt.appointmentDate), appt.scheduledTime);
  return !dt || dt.getTime() <= nowMs;
};

const formatAppointmentTime = (a) => {
  const start = resolveScheduledStart(a);
  if (start) return start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return getAppointmentTimeValue(a) || 'Today';
};

export const formatAppointment = (a, forcedStatus) => {
  const patient = a?.patient || a?.patientData || a?.user || {};
  const appointmentSource = getAppointmentSource(a);
  const followUp = a?.followup || a?.follow_up || a?.followUp || {};
  const rawFollowUpDate = pickFirst(
    a?.follow_up_date, a?.followUpDate, a?.followup_date, a?.next_follow_up_date,
    a?.nextFollowUpDate, followUp?.follow_up_date, followUp?.followUpDate, followUp?.date,
  );
  const rawFollowUpRequired = pickFirst(
    a?.follow_up_required, a?.followUpRequired, a?.followup_required, followUp?.required, Boolean(rawFollowUpDate),
  );
  const apiId = pickFirst(
    a?.id, a?._id, a?.appointment_id, a?.appointmentId,
    a?.walkin_appointment_id, a?.walkinAppointmentId, a?.walkin_id, a?.walkinId,
  );
  return {
    __raw: a,
    __appointmentSource: appointmentSource,
    id: `${appointmentSource}-${apiId}`,
    apiId,
    appointmentSource,
    appointmentType: appointmentSource === 'walkin' ? 'Walk-in' : 'Online',
    consultationMode: String(pickFirst(a?.consultation_mode, a?.consultationMode, a?.mode, 'in-clinic')).toLowerCase(),
    appointmentDate: getAppointmentDateValue(a),
    delayMinutes: Number(pickFirst(a?.delay_minutes, a?.delayMinutes, 0)),
    delayReason: pickFirst(a?.delay_reason, a?.delayReason),
    name: pickFirst(
      a?.patient_name, a?.patientName, a?.walkin_patient_name, a?.walkinPatientName,
      a?.visitor_name, a?.visitorName, a?.name, patient?.full_name, patient?.fullName, patient?.name, 'Unknown',
    ),
    gender: pickFirst(a?.gender, a?.patient_gender, patient?.gender, 'Not specified'),
    issue: pickFirst(a?.reason, a?.issue, a?.symptoms, a?.description, 'General Checkup'),
    scheduledTime: formatAppointmentTime(a),
    status: normalizeAppointmentStatus(a, forcedStatus),
    phone: pickFirst(
      a?.patient_phone, a?.patientPhone, a?.phone, a?.mobile, a?.phone_number, a?.phoneNumber,
      patient?.phone, patient?.mobile, patient?.phone_number, patient?.phoneNumber, 'N/A',
    ),
    // Same field spread WalkInAppointmentsScreen accepts. `token` is only used
    // when it's a plain value — some endpoints nest a token-status object there.
    tokenNumber: pickFirst(
      a?.token_number, a?.tokenNumber, a?.token_no, a?.tokenNo, a?.queue_token, a?.queueToken,
      a?.walkin_token, a?.walkinToken, a?.appointment_token, a?.appointmentToken,
      typeof a?.token === 'object' ? a?.token?.myToken : a?.token,
    ),
    appointmentNo: pickFirst(a?.appointment_no, a?.appointmentNo, a?.appointment_number, a?.appointmentNumber),
    bp: pickFirst(a?.blood_pressure, a?.bp, a?.bloodPressure, 'Not recorded'),
    temperature: pickFirst(a?.temperature, a?.temp),
    bloodGroup: pickFirst(a?.blood_group, a?.bloodGroup, patient?.blood_group, patient?.bloodGroup, 'Not recorded'),
    patientId: pickFirst(
      patient?.user_id, patient?.userId, a?.patient_user_id, a?.patientUserId,
      a?.patient_id, a?.patientId, patient?.id, patient?._id,
    ),
    startTime: pickFirst(a?.start_time, a?.startTime),
    endTime: pickFirst(a?.end_time, a?.endTime),
    durationMs: Number(pickFirst(a?.duration_ms, a?.durationMs, 0)) || 0,
    diagnosis: a?.diagnosis,
    medicine: a?.medicine,
    advice: a?.advice,
    additionalNotes: pickFirst(a?.additional_notes, a?.additionalNotes),
    consultationTiming: a?.consultation_timing,
    followUpRequired:
      rawFollowUpRequired === true || rawFollowUpRequired === 1 || rawFollowUpRequired === '1' ||
      String(rawFollowUpRequired).toLowerCase() === 'true' || Boolean(rawFollowUpDate),
    followUpDate: rawFollowUpDate ? formatLocalDateKey(rawFollowUpDate) : '',
  };
};

// Queue order: token number ascending ("Token #3" before "#12"); appointments
// without a token go after all tokened ones. Ties (or no tokens at all) fall
// back to slot time, then name, so the order never jumps between refreshes.
const getTokenNumber = (appt) => {
  const match = String(appt?.tokenNumber ?? '').match(/\d+/);
  return match ? Number(match[0]) : null;
};

const getStartMs = (appt) => {
  const dt = getAppointmentDateTime(appt?.__raw || appt);
  return dt ? dt.getTime() : Number.MAX_SAFE_INTEGER;
};

export const compareByToken = (a, b) => {
  const ta = getTokenNumber(a);
  const tb = getTokenNumber(b);
  if (ta !== null && tb !== null && ta !== tb) return ta - tb;
  if ((ta === null) !== (tb === null)) return ta === null ? 1 : -1;
  const timeDiff = getStartMs(a) - getStartMs(b);
  if (timeDiff) return timeDiff;
  return String(a?.name || '').localeCompare(String(b?.name || ''));
};

export const sortByToken = (list = []) => [...list].sort(compareByToken);

export const getTokenLabel = (appt) => {
  if (appt?.tokenNumber) return `Token #${appt.tokenNumber}`;
  if (appt?.appointmentNo) return appt.appointmentNo;
  return `P${String(appt?.apiId || appt?.id || '').padStart(3, '0').slice(-3)}`;
};

export const getRemoteConsultationMode = (appt) => {
  const mode = String(appt?.consultationMode || '').toLowerCase();
  if (mode.includes('video')) return 'video';
  if (mode.includes('voice') || mode.includes('phone')) return 'voice';
  return '';
};

// How the consultation happens, for the mode badge on queue cards:
//   video / voice → remote consultation; walk-in → patient came to the clinic
//   without booking; anything else → a booked in-clinic visit.
export const getConsultationModeInfo = (appt) => {
  const remote = getRemoteConsultationMode(appt);
  if (remote === 'video') return { key: 'video', label: 'Video Consultation', icon: 'video' };
  if (remote === 'voice') return { key: 'voice', label: 'Voice Consultation', icon: 'phone' };
  if (getAppointmentSource(appt) === 'walkin') return { key: 'walkin', label: 'Walk-in Visit', icon: 'walk' };
  return { key: 'visit', label: 'In-clinic Visit', icon: 'pin' };
};

// Video / voice call window: opens 15 min before the slot and stays open for
// the rest of that day, so a doctor running late can still call the patient.
//
// Computed from the real slot time (resolveScheduledStart). It used to re-parse
// the time *label* on the card, which is locale-formatted ("०५:०५ PM" on a
// Marathi phone, and could lose AM/PM) — so the button could stay disabled
// right through the slot — and it shut 90 min after the slot, after which a
// late remote appointment could never be called or finished.
export const CALL_OPENS_BEFORE_MIN = 15;

export const getCallWindow = (appt, nowMs = Date.now()) => {
  const start = getAppointmentDateTime(appt?.__raw || appt, { endOfDayFallback: false })
    || parseTimeOnDate(formatLocalDateKey(appt?.appointmentDate), appt?.scheduledTime);
  if (!start) return { open: true, opensAt: null };
  const opensAt = new Date(start.getTime() - CALL_OPENS_BEFORE_MIN * 60000);
  const endOfDay = new Date(start);
  endOfDay.setHours(23, 59, 59, 999);
  return { open: nowMs >= opensAt.getTime() && nowMs <= endOfDay.getTime(), opensAt };
};

export const isAppointmentCallWindowOpen = (appt, nowMs = Date.now()) => getCallWindow(appt, nowMs).open;

export const formatClockTime = (date) =>
  date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// ---- writes ---------------------------------------------------------------

export const getAppointmentApiPath = (appt) =>
  `/api/${getAppointmentSource(appt) === 'walkin' ? 'walkin-appointments' : 'appointments'}/${appt.apiId || appt.id}`;

// Walk-ins take `status` (lowercase); online appointments take `appointment_status`.
export const getStatusUpdatePayload = (appt, status, extraFields = {}) =>
  getAppointmentSource(appt) === 'walkin'
    ? { ...extraFields, status: status.toLowerCase() }
    : { ...extraFields, appointment_status: status };

export const patchAppointment = (appt, body) => axiosInstance.patch(getAppointmentApiPath(appt), body);

// Breaks: server returns snake_case { id, started_at, expected_end_at }.
export const parseServerBreak = (payload) => {
  const b = payload?.break || payload?.data?.break || payload?.data || payload;
  if (!b) return null;
  const startMs = new Date(pickFirst(b.started_at, b.startedAt) || Date.now()).getTime();
  const endMs = new Date(pickFirst(b.expected_end_at, b.expectedEndAt) || 0).getTime();
  return { id: pickFirst(b.id, b._id), startMs, endMs, durationMs: Math.max(0, endMs - startMs) };
};

export const fetchActiveBreak = async () => {
  const response = await axiosInstance.get('/api/doctor-breaks/active');
  if (!response.data?.active || !response.data?.break) return null;
  return parseServerBreak(response.data);
};

export const startBreak = async (minutes) => {
  const response = await axiosInstance.post('/api/doctor-breaks/start', {
    duration_minutes: minutes,
    reason: 'Personal break',
  });
  const parsed = parseServerBreak(response.data);
  if (parsed && !parsed.endMs) parsed.endMs = Date.now() + minutes * 60000;
  return parsed;
};

export const endBreak = (breakId) => axiosInstance.patch(`/api/doctor-breaks/${breakId}/end`, {});
