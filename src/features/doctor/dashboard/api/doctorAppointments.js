// Port of the web doctor dashboard's appointment layer
// (chatbot/src/Component/DoctorDashboard/appointmentFeed.js + the helpers at
// the top of Dashboard/DoctorDashboard.jsx). Same endpoints, params, status
// normalization and payloads, so both clients read and write identically.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isPrepaidAppointmentVisible } from '../../../../utils/appointmentPaymentVisibility';
import axiosInstance from '../../../../axiosConfig';
import { isPatientAccountDeleted } from '../../../../utils/deletedAccount';
import { parseEmergencySymptoms, stripEmergencyTag } from '../../../../utils/emergencyTag';
import { getAppointmentVitals } from '../../../../utils/appointmentVitals';
import { consultationData } from '../../../../utils/consultationData';
import { formatPhoneNumber } from '../../../../utils/countryCodes';
import { formatTime12 } from '../../../../utils/appointmentTime';

export const pickFirst = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== '');

const toMs = (value) => {
  if (value === undefined || value === null || value === '') return NaN;
  const n = Number(value);
  return Number.isFinite(n) ? n : Date.parse(value);
};

// Completed-visit timing. Start / Complete record the consultation in
// consultation_started_at / consultation_ended_at (or consultation_timing),
// not end_time / duration_ms, so fall back to those for the record screen.
const consultationTimes = (a) => {
  let timing = pickFirst(a?.consultation_timing, a?.consultationTiming) || {};
  if (typeof timing === 'string') {
    try { timing = JSON.parse(timing) || {}; } catch { timing = {}; }
  }
  const endTime = pickFirst(
    a?.end_time, a?.endTime, a?.consultation_ended_at, a?.consultationEndedAt,
    timing.endedAt, timing.ended_at, a?.completed_at, a?.completedAt,
  );
  const start = toMs(pickFirst(
    a?.consultation_started_at, a?.consultationStartedAt, timing.startedAt, timing.started_at,
  ));
  const paused = Number(pickFirst(timing.pausedMs, timing.paused_ms, timing.totalPausedMs, timing.total_paused_ms, 0)) || 0;
  const stored = Number(pickFirst(a?.duration_ms, a?.durationMs, timing.durationMs, timing.duration_ms, 0)) || 0;
  const derived = toMs(endTime) - start - paused;
  // Ignore implausible spans (Start never pressed, consultation left open > 12 h).
  const durationMs = stored || (Number.isFinite(derived) && derived > 0 && derived < 12 * 3600000 ? derived : 0);
  return { endTime, durationMs };
};

// ---- feed -----------------------------------------------------------------

const COLLECTION_KEYS = new Set([
  'data', 'appointments', 'online', 'online_appointments', 'onlineAppointments',
  'walkin', 'walk_in', 'walk_in_appointments', 'walkin_appointments',
  'walkInAppointments', 'walkinAppointments', 'walkins', 'followups',
  'followUps', 'follow_ups', 'result', 'results', 'queue', 'waitingQueue',
  'waiting_queue', 'records', 'items', 'docs',
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

export const isAppointmentVisibleToDoctor = (appointment) => {
  return isPrepaidAppointmentVisible(appointment);
};

// Online and walk-in tables can share numeric IDs — dedupe per source only.
const mergeAppointmentLists = (...lists) => {
  const records = new Map();
  const withoutId = [];
  lists.flat().forEach((a) => {
    const id = pickFirst(a.id, a._id, a.appointment_id, a.appointmentId,
      a.walkin_appointment_id, a.walkinAppointmentId, a.walkin_id, a.walkinId);
    if (id === undefined) withoutId.push(a);
    else {
      const key = `${getAppointmentSource(a)}:${id}`;
      records.set(key, { ...(records.get(key) || {}), ...a });
    }
  });
  return [...records.values(), ...withoutId];
};

// Appointment rows sent to a doctor carry the patient's anonymous name (the
// server hides the full name from providers), while the receptionist sees the
// real one. The doctor's Patients tab reads account names from
// /api/auth/users; the queue uses the same names so an app patient shows by
// their real name. Cached for a minute because the queue polls often.
let accountNamesCache = { at: 0, names: null };
const loadPatientAccountNames = async () => {
  if (accountNamesCache.names && Date.now() - accountNamesCache.at < 60000) return accountNamesCache.names;
  const res = await axiosInstance.get('/api/auth/users', { params: { role: 'patient' } });
  const list = res?.data?.users || res?.data?.data || [];
  const names = new Map((Array.isArray(list) ? list : [])
    .map((u) => [String(pickFirst(u?._id, u?.id, '')), {
      name: String(pickFirst(u?.fullName, u?.full_name, u?.name, '')).trim(),
      phone: String(pickFirst(u?.phoneNumber, u?.phoneNum, u?.phone_number, u?.phone, u?.mobile, u?.contactNumber, u?.contact_number, '')).trim(),
      phoneCountryCode: String(pickFirst(u?.phoneCountryCode, u?.phone_country_code, u?.countryCode, '')).trim(),
    }])
    .filter(([id, account]) => id && (account.name || account.phone)));
  accountNamesCache = { at: Date.now(), names };
  return names;
};

// The patient's account id on an appointment — never the appointment's own id.
const patientAccountIdOf = (a) => {
  const fromObject = [a?.patient, a?.patient_id, a?.patientId, a?.patient_details, a?.patientData, a?.patient_data, a?.user]
    .filter((value) => value && typeof value === 'object')
    .map((value) => pickFirst(value._id, value.id, value.user_id, value.userId))
    .find((value) => value !== undefined);
  const plain = (value) => (value && typeof value !== 'object' ? value : undefined);
  const id = pickFirst(fromObject, plain(a?.patient_id), plain(a?.patientId), a?.patient_user_id, a?.patientUserId, plain(a?.patient));
  return id === undefined ? '' : String(id);
};

// Walk-ins have no account, and QR bookings keep the name given at booking
// (same rule as the Patients tab).
const withAccountName = (a, names) => {
  if (!names?.size || getAppointmentSource(a) === 'walkin') return a;
  if (String(pickFirst(a?.booking_source, a?.bookingSource, '')).toLowerCase() === 'qr') return a;
  const account = names.get(patientAccountIdOf(a));
  if (!account) return a;
  // Older cached/test values can still be a plain name string.
  if (typeof account === 'string') return account ? { ...a, __accountName: account } : a;
  return {
    ...a,
    __accountName: account.name || undefined,
    __accountPhone: /\d/.test(account.phone) ? account.phone : undefined,
    __accountPhoneCountryCode: account.phoneCountryCode || undefined,
  };
};

// ---- Real patient names in doctor notifications ----------------------------
// Pushes and in-app notifications name the patient by their anonymous name
// ("hjsk requested an appointment…"). The appointment they are about carries
// the patient's account, whose real name the queue already shows, so the
// anonymous name is swapped for it. appointmentId → { real, shown: [names] }.
let notificationNamesCache = { at: 0, map: null };
const loadAppointmentPatientNames = async ({ fresh = false } = {}) => {
  if (!fresh && notificationNamesCache.map && Date.now() - notificationNamesCache.at < 60000) return notificationNamesCache.map;
  const [res, names] = await Promise.all([axiosInstance.get('/api/appointments'), loadPatientAccountNames()]);
  const rows = Array.isArray(res?.data) ? res.data : res?.data?.appointments || res?.data?.data || [];
  const map = new Map();
  rows.forEach((a) => {
    const id = String(pickFirst(a?._id, a?.id, ''));
    const real = withAccountName(a, names).__accountName;
    if (!id || !real) return;
    const patient = a?.patient && typeof a.patient === 'object' ? a.patient : {};
    const shown = [a?.patient_name, a?.patientName, patient.anonymous, patient.anonName, patient.fullName, patient.name]
      .map((value) => String(value || '').trim())
      .filter((value) => value.length > 1 && value !== real);
    map.set(id, { real, shown: [...new Set(shown)] });
  });
  notificationNamesCache = { at: Date.now(), map };
  return map;
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// `text` with each name in entry.shown, as a whole word, replaced by entry.real.
export const withRealPatientName = (text, entry) => {
  if (!text || !entry?.real) return text;
  return entry.shown.reduce(
    (out, name) => out.replace(new RegExp(`(^|[^A-Za-z0-9])${escapeRegExp(name)}(?=$|[^A-Za-z0-9])`, 'g'), `$1${entry.real}`),
    String(text),
  );
};

// { title, body } of the notification about `appointmentId`, naming the
// patient by their real name; unchanged when that can't be worked out.
export const realNameNotificationText = async (appointmentId, { title, body }) => {
  if (!appointmentId) return { title, body };
  try {
    const key = String(appointmentId);
    let entry = (await loadAppointmentPatientNames()).get(key);
    // A push arrives right after booking, before the cached list has it
    // (refetched at most every few seconds, not once per notification).
    if (!entry && Date.now() - notificationNamesCache.at > 5000) {
      entry = (await loadAppointmentPatientNames({ fresh: true })).get(key);
    }
    return { title: withRealPatientName(title, entry), body: withRealPatientName(body, entry) };
  } catch {
    return { title, body };
  }
};

// The desk's view of today's bookings (GET /api/staff/appointments, open to
// the doctor too) carries each patient's phone number and real name, which
// doctor-facing rows can leave out — the consent form showed "N/A" for a
// patient who gave a number. appointment id → { phone, name }. The endpoint
// pages at 50 at most.
const loadStaffContacts = async (doctorId) => {
  const today = formatLocalDateKey(new Date());
  const params = { doctor_id: doctorId, from: today, to: today, limit: 50 };
  const first = await axiosInstance.get('/api/staff/appointments', { params });
  const rows = [...(first?.data?.appointments || [])];
  const pages = Math.min(5, Math.ceil((Number(first?.data?.total) || 0) / 50));
  for (let page = 2; page <= pages; page += 1) {
    const next = await axiosInstance.get('/api/staff/appointments', { params: { ...params, page } });
    rows.push(...(next?.data?.appointments || []));
  }
  return new Map(rows
    .map((row) => [String(pickFirst(row?.id, row?._id, '')), {
      phone: String(pickFirst(row?.phoneNumber, row?.phoneNum, row?.patientPhone, row?.patient_phone, row?.phone_number, row?.phone, row?.mobile, '')).trim(),
      name: String(pickFirst(row?.patientName, row?.patient_name, row?.name, '')).trim(),
    }])
    .filter(([id]) => id));
};

// Phone (and, failing the account lookup, the real name) from the desk's view.
// Walk-ins and QR bookings keep the name given at booking.
const withStaffContact = (a, contacts) => {
  const contact = contacts?.get(String(pickFirst(a?._id, a?.id, '')));
  if (!contact) return a;
  const keepsTypedName = getAppointmentSource(a) === 'walkin'
    || String(pickFirst(a?.booking_source, a?.bookingSource, '')).toLowerCase() === 'qr';
  return {
    ...a,
    __staffPhone: /\d/.test(contact.phone) ? contact.phone : undefined,
    __staffName: !keepsTypedName && contact.name && contact.name !== 'Patient' ? contact.name : undefined,
  };
};

// Same four requests as the web feed (appointmentFeed.js): the server now
// marks unattended appointments cancelled / no-show itself, and those rows
// come back through the appointment_status=cancelled list.
export const loadDoctorAppointmentFeed = async (doctorId) => {
  const params = { doctor_id: doctorId };
  await loadWalkinQueueState();
  const [online, walkins, completed, cancelled, doctorQueue, accountNames, staffContacts] = await Promise.all([
    axiosInstance.get('/api/appointments', { params }),
    axiosInstance.get('/api/walkin-appointments', { params }),
    axiosInstance.get('/api/appointments', { params: { ...params, appointment_status: 'completed' } }),
    // Optional: an older server without this filter must not break the queue.
    axiosInstance.get('/api/appointments', { params: { ...params, appointment_status: 'cancelled' } })
      .catch(() => ({ data: [] })),
    // The live queue endpoint is the authoritative source for today's booked
    // doctor appointments. Older deployments do not expose it, so keep the
    // generic appointment feed as a safe fallback.
    axiosInstance.get('/api/appointments/doctor/queue', { params })
      .catch(() => ({ data: [] })),
    // Optional: without it the queue still loads, with the names it was sent.
    loadPatientAccountNames().catch(() => null),
    // Optional too: an older server keeps this route to the reception desk.
    loadStaffContacts(doctorId).catch(() => null),
  ]);
  // Drop rows left behind by deleted patient accounts so they never reach the
  // queue, the overview counts or the appointments list as "Unknown".
  return mergeAppointmentLists(
    normalizeApiList(online.data),
    normalizeApiList(completed.data),
    normalizeApiList(cancelled.data),
    normalizeApiList(walkins.data).map((item) => withWalkinQueueState({ ...item, __appointmentSource: 'walkin' })),
    normalizeApiList(doctorQueue.data),
  ).filter((a) => !isPatientAccountDeleted(a) && isAppointmentVisibleToDoctor(a))
    .map((a) => withStaffContact(withAccountName(a, accountNames), staffContacts));
};

// The doctor's patient rating. The server keeps each one on its appointment
// (POST /api/appointments/:id/doctor-rating → appointment.doctorRating) and has
// no summary endpoint, so the average comes from the completed appointments.
// Resolves to { average, count } (0 / 0 when nobody has rated yet).
export const loadDoctorRatingSummary = async (doctorId) => {
  const { doctor } = await loadDoctorReviews(doctorId);
  return summarizeReviews(doctor);
};

// { average, count, distribution: { 5: n, 4: n, … } } for a review list.
export const summarizeReviews = (reviews) => {
  const count = reviews.length;
  const distribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  reviews.forEach((r) => { distribution[Math.round(r.stars)] += 1; });
  const average = count ? Math.round((reviews.reduce((sum, r) => sum + r.stars, 0) / count) * 10) / 10 : 0;
  return { average, count, distribution };
};

// Every patient review of this doctor and of their clinics, newest first.
// Both live on completed appointments (doctorRating / clinicRating:
// { stars, review, submittedAt }); there is no separate reviews endpoint.
export const loadDoctorReviews = async (doctorId) => {
  if (!doctorId) return { doctor: [], clinic: [] };
  const response = await axiosInstance.get('/api/appointments', {
    params: { doctor_id: doctorId, appointment_status: 'completed' },
  });
  const rows = normalizeApiList(response.data);
  const toReview = (a, rating, kind) => {
    const stars = Number(rating?.stars ?? rating?.rating);
    if (!Number.isFinite(stars) || stars < 1 || stars > 5) return null;
    const patient = a?.patient && typeof a.patient === 'object' ? a.patient : (a?.patient_details || {});
    const clinic = [a?.clinic, a?.clinic_id].find((v) => v && typeof v === 'object') || {};
    return {
      id: `${kind}-${pickFirst(a?._id, a?.id)}`,
      kind,
      stars,
      review: String(rating?.review || rating?.comment || '').trim(),
      submittedAt: pickFirst(rating?.submittedAt, a?.updatedAt, a?.updated_at, ''),
      patientName: pickFirst(a?.patient_name, a?.patientName, patient.fullName, patient.full_name, patient.name, 'Patient'),
      patientPhoto: pickFirst(patient.profilePhoto?.url, patient.profilePhoto, patient.avatar, ''),
      clinicName: pickFirst(a?.clinic_name, a?.clinicName, clinic.clinic_name, clinic.name, ''),
      visitDate: getAppointmentDateValue(a),
    };
  };
  const byNewest = (x, y) => (Date.parse(y.submittedAt) || 0) - (Date.parse(x.submittedAt) || 0);
  return {
    doctor: rows.map((a) => toReview(a, a?.doctorRating, 'doctor')).filter(Boolean).sort(byNewest),
    clinic: rows.map((a) => toReview(a, a?.clinicRating, 'clinic')).filter(Boolean).sort(byNewest),
  };
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
  user?.full_name, user?.fullName, user?.fullname, user?.name, user?.doctor_name,
  user?.user?.full_name, user?.user?.fullName, user?.user?.name,
  user?.data?.user?.full_name, user?.data?.user?.fullName, user?.data?.user?.name,
  'Doctor',
);

// "Dr. <name>", without doubling a "Dr"/"Dr." the doctor typed themselves.
export const formatDoctorDisplayName = (name) => {
  const bare = String(name || '').trim().replace(/^dr\.?\s+/i, '').trim();
  return `Dr. ${bare || 'Doctor'}`;
};

const apiOrigin = String(axiosInstance.defaults.baseURL || '').replace(/\/api\/?$/, '').replace(/\/+$/, '');

// The doctor's real profile photo as a loadable URL, or '' when there is none.
// The server stores it as { url } or a plain string, sometimes a relative
// upload path ("uploads/…"), which needs the API origin in front.
export const getDoctorPhotoUrl = (user) => {
  const raw = pickFirst(
    user?.profilePhoto?.url, user?.profilePhoto?.secure_url,
    typeof user?.profilePhoto === 'string' ? user.profilePhoto : undefined,
    user?.profile_photo?.url, typeof user?.profile_photo === 'string' ? user.profile_photo : undefined,
    user?.profilePic, user?.profile_image, user?.photo, user?.avatar, user?.image,
    user?.user?.profilePhoto?.url, user?.data?.user?.profilePhoto?.url,
  );
  if (!raw || typeof raw !== 'string') return '';
  const path = raw.trim().replace(/\\/g, '/');
  if (/^(https?:|data:|file:|content:)/i.test(path)) return path;
  return apiOrigin ? `${apiOrigin}/${path.replace(/^\/+/, '')}` : '';
};

// Specializations as readable text: ["Cardiology","Neurology"] ->
// "Cardiology, Neurology". Rendering the array directly glued the names
// together ("CardiologyNeurology"). Also takes a JSON-array string or a
// comma list from the server. Returns '' when there is nothing to show.
export const formatSpecialization = (value) => {
  let list = value;
  if (typeof list === 'string') {
    const text = list.trim();
    if (text.startsWith('[')) {
      try { list = JSON.parse(text); } catch { list = text; }
    }
    if (typeof list === 'string') list = list.split(',');
  }
  if (!Array.isArray(list)) return '';
  return list.map((item) => String(item ?? '').trim()).filter(Boolean).join(', ');
};

// Initials for the avatar fallback ("Dr. Vivek Raj" -> "VR").
export const getDoctorInitials = (name) => String(name || '')
  .replace(/^dr\.?\s+/i, '').trim().split(/\s+/).filter(Boolean)
  .slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'D';

// Logged-in doctor's name: the real session user (`userData`, written by
// Login/Signup/OTP/Google) first, then the older `doctorMockProfile` cache.
export const loadDoctorDisplayProfile = async () => {
  const user = await getStoredDoctorUser();
  let cached = null;
  try {
    cached = JSON.parse((await AsyncStorage.getItem('doctorMockProfile')) || 'null');
  } catch { /* ignore malformed cache */ }
  const name = pickFirst(
    getDoctorName(user) !== 'Doctor' ? getDoctorName(user) : undefined,
    getDoctorName(cached) !== 'Doctor' ? getDoctorName(cached) : undefined,
    'Doctor',
  );
  const specialization = pickFirst(
    formatSpecialization(user?.specialization), formatSpecialization(user?.speciality), formatSpecialization(user?.specialty),
    formatSpecialization(cached?.specialization), formatSpecialization(cached?.speciality), formatSpecialization(cached?.specialty), '',
  );
  const photo = getDoctorPhotoUrl(user) || getDoctorPhotoUrl(cached);
  return { name, specialization, photo };
};

// Saves the latest server copy of the doctor (GET /api/auth/me) into
// `userData`, so the header/sidebar show a photo or name changed later.
export const saveDoctorUser = async (serverUser) => {
  if (!serverUser || typeof serverUser !== 'object') return;
  const current = (await getStoredDoctorUser()) || {};
  await AsyncStorage.setItem('userData', JSON.stringify({ ...current, ...serverUser }));
};

// One /api/auth/me refresh per app session, shared by every header/sidebar.
let serverRefresh = null;
export const refreshDoctorUserOnce = () => {
  if (!serverRefresh) {
    serverRefresh = axiosInstance.get('/api/auth/me')
      .then(({ data }) => saveDoctorUser(data?.user || data?.data?.user))
      .catch(() => { serverRefresh = null; });
  }
  return serverRefresh;
};

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

// The day the appointment belongs to: its booked date. The server moves an
// unfinished queue entry's estimated_start_at forward every day, so a QR
// walk-in left pending on 13 Oct came back as "today" (17:01) and showed as
// Up Next. The estimate is only a fallback when nothing else dates it.
const getAppointmentDayValue = (a) => pickFirst(
  a?.original_appointment_at, a?.originalAppointmentAt,
  a?.appointment_date, a?.appointmentDate, a?.date, a?.booking_date, a?.bookingDate,
  a?.scheduled_date, a?.scheduledDate, a?.walkin_date, a?.walkinDate, a?.visit_date,
  a?.visitDate, a?.check_in_at, a?.checkInAt, a?.created_at, a?.createdAt,
  a?.estimated_start_at, a?.estimatedStartAt,
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

// An appointment's effective slot start (a delayed estimate wins). The queue
// card's time and the call window read it; queue order and pending expiry use
// the booked time instead (getBookedDateTime). Null when no time is known.
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

// Booked slot time, as the web dashboard reads it for queue order and pending
// expiry: the appointment's day plus its booked time field — a delayed
// estimated start does not move it. No booked time → end of that day.
const getBookedDateTime = (a, { endOfDayFallback = true } = {}) => {
  const dateKey = formatLocalDateKey(getAppointmentDayValue(a));
  if (!dateKey) return null;
  const timeValue = pickFirst(
    a?.appointment_time, a?.appointmentTime, a?.time, a?.scheduled_time, a?.scheduledTime,
    a?.slot_time, a?.slotTime, a?.check_in_time, a?.checkInTime,
  );
  if (timeValue) return parseTimeOnDate(dateKey, timeValue);
  // Patient bookings send one ISO booked date that carries the time too. Only
  // booked fields are read here, never the delayed estimated_start_at.
  const bookedDate = pickFirst(
    a?.original_appointment_at, a?.originalAppointmentAt, a?.appointment_date, a?.appointmentDate,
    a?.date, a?.booking_date, a?.bookingDate, a?.scheduled_date, a?.scheduledDate,
  );
  if (typeof bookedDate === 'string' && bookedDate.includes('T') && !isMidnightUtc(bookedDate)) {
    const d = new Date(bookedDate);
    if (isValidDate(d)) return d;
  }
  return endOfDayFallback ? parseTimeOnDate(dateKey, '23:59:59') : null;
};

// Emergency request from a patient (web: priority === 'emergency'). It jumps
// the queue and has no slot time — the clinic sees it as soon as it arrives.
export const isEmergencyAppointment = (a) => {
  const raw = a?.__raw || a;
  return String(pickFirst(raw?.priority, raw?.appointment_priority, raw?.appointmentPriority, '')).toLowerCase() === 'emergency'
    || raw?.is_emergency === true || raw?.isEmergency === true || Number(raw?.is_emergency) === 1
    || String(raw?.is_emergency) === 'true'
    // QR walk-ins: the walk-in API keeps only symptoms, which carry the tag.
    || parseEmergencySymptoms(raw?.symptoms).isEmergency;
};

// Booked for today by its own date — unlike isTodayAppointment, an open
// emergency from another day doesn't count (used for the Cancelled list).
export const isScheduledToday = (a) => {
  const value = getAppointmentDayValue(a?.__raw || a);
  return Boolean(value) && formatLocalDateKey(value) === formatLocalDateKey();
};

export const isTodayAppointment = (a) => {
  // An open emergency belongs in today's queue whatever day it was sent.
  if (isEmergencyAppointment(a)) return true;
  const value = getAppointmentDayValue(a);
  if (!value) return true;
  const key = formatLocalDateKey(value);
  return !key || key === formatLocalDateKey();
};

// A completed consultation counts for today when its appointment date — or
// the moment it was completed — is today. The completed feed returns every
// day's history, so the dashboard filters it with this.
// A queue delay in few digits: minutes up to 99, then hours, then days
// ("90 min", "1 hour 40 min", "2 hours", "14 days").
export const formatDelay = (minutes) => {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  if (total < 100) return `${total} min`;
  if (total < 24 * 60) {
    const hours = Math.floor(total / 60);
    const rest = total % 60;
    const hourText = `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    return rest ? `${hourText} ${rest} min` : hourText;
  }
  const days = Math.floor(total / (24 * 60));
  return `${days} ${days === 1 ? 'day' : 'days'}`;
};

export const isCompletedToday = (a) => {
  const today = formatLocalDateKey();
  const completedAt = pickFirst(a?.completed_at, a?.completedAt, a?.consultation_ended_at, a?.end_time);
  if (completedAt && formatLocalDateKey(completedAt) === today) return true;
  const value = getAppointmentDateValue(a);
  return Boolean(value) && formatLocalDateKey(value) === today;
};

const statusKey = (value) => String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');

// Web getAppointmentCancellationState (appointmentFeed.js). A persisted
// cancellation wins over stale queue metadata; a completed lifecycle wins
// over an old cancelled queue flag; a running consultation is never a no-show.
export const getAppointmentCancellationState = (a = {}) => {
  const raw = a?.__raw || a;
  const status = statusKey(getAppointmentSource(raw) === 'walkin'
    ? pickFirst(raw.appointment_status, raw.status, raw.walkin_status)
    : pickFirst(raw.status, raw.appointment_status, raw.walkin_status));
  const queueStatus = statusKey(pickFirst(raw.queue_status, raw.queueStatus));
  if (['canceled', 'cancelled'].includes(status)) return { cancelled: true, noShow: false, completed: false };
  if (['completed', 'complete', 'done'].includes(status)) return { cancelled: false, noShow: false, completed: true };
  if (['canceled', 'cancelled'].includes(queueStatus)) return { cancelled: true, noShow: false, completed: false };
  if (['in_progress', 'in_consultation', 'consulting', 'serving'].includes(status)
    || ['completed', 'in_progress', 'in_consultation'].includes(queueStatus)) {
    return { cancelled: false, noShow: false, completed: false };
  }
  return { cancelled: false, completed: false, noShow: status === 'no_show' || queueStatus === 'no_show' || Boolean(a?.isNoShow) };
};

// Web normalizeAppointmentStatus: the cancellation / completion history first,
// then queue_status (Next = 'skipped', backend no-show job = 'no_show'), then
// the appointment / walk-in status. A no-show is shown under Cancelled.
export const normalizeAppointmentStatus = (a, forcedStatus) => {
  if (!forcedStatus) {
    const history = getAppointmentCancellationState(a);
    if (history.cancelled) return 'cancelled';
    if (history.completed) return 'completed';
    // A consultation that has started and not ended IS in progress, even when
    // the row's own status still reads pending/confirmed — the server records
    // the lifecycle in the consultation_* fields. Without this the appointment
    // stayed in the Pending tab and offered "Start Consultation" again for a
    // consultation that was already running.
    const startedAt = pickFirst(
      a?.consultation_started_at, a?.consultationStartedAt,
      a?.consultation_timing?.startedAt, a?.consultationTiming?.startedAt,
    );
    const endedAt = pickFirst(
      a?.consultation_ended_at, a?.consultationEndedAt,
      a?.consultation_timing?.endedAt, a?.consultationTiming?.endedAt,
    );
    if (startedAt && !endedAt) return 'in-progress';
    const queue = statusKey(pickFirst(a?.queue_status, a?.queueStatus));
    if (['in_progress', 'in_consultation'].includes(queue)) return 'in-progress';
    if (queue === 'no_show') return 'cancelled';
    if (queue === 'skipped') return 'skipped';
    if (queue === 'completed') return 'completed';
    if (queue === 'cancelled' || queue === 'canceled') return 'cancelled';
  }
  const status = statusKey(pickFirst(forcedStatus, a?.appointment_status, a?.walkin_status, a?.status) || 'pending');
  if (status === 'completed' || status === 'complete') return 'completed';
  if (status === 'cancelled' || status === 'canceled') return 'cancelled';
  if (status === 'no_show') return 'cancelled';
  if (status === 'skipped') return 'skipped';
  if (status === 'confirmed' || status === 'accepted' || status === 'active') return 'confirmed';
  if (['in_progress', 'in_consultation'].includes(status)) return 'in-progress';
  return 'pending';
};

// Web isAppointmentStartTimeReached: walk-ins and emergencies can start at
// once; a booked appointment from its slot time on.
const clockMinutes = (value) => {
  const m = String(value || '').trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/i);
  if (!m) return null;
  let hours = Number(m[1]);
  const minutes = Number(m[2]);
  const meridiem = m[3]?.toUpperCase();
  if (minutes > 59 || hours > (meridiem ? 12 : 23) || (meridiem && hours < 1)) return null;
  if (meridiem === 'PM' && hours !== 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

export const isAppointmentStartTimeReached = (appt, nowMs = Date.now()) => {
  const raw = appt?.__raw || appt || {};
  if (getAppointmentSource(raw) === 'walkin') return true;
  if (isEmergencyAppointment(raw)) return true;
  const dateKey = String(pickFirst(raw.appointment_date, raw.appointmentDate, raw.date, raw.scheduled_date, raw.scheduledDate) || '').slice(0, 10);
  const minutes = clockMinutes(pickFirst(
    raw.appointment_time, raw.appointmentTime, raw.slot_start_time, raw.slotStartTime,
    raw.slot_time, raw.slotTime, raw.bookedSlotTime, raw.time,
  ));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || minutes == null) return false;
  const day = new Date(`${dateKey}T00:00:00`);
  if (Number.isNaN(day.getTime())) return false;
  return day.getTime() + minutes * 60000 <= nowMs;
};

export const getElapsedAppointmentDelay = (appt, nowMs = Date.now()) => {
  const raw = appt?.__raw || appt || {};
  if (getAppointmentSource(raw) === 'walkin' || isEmergencyAppointment(raw)) return 0;
  const start = getBookedDateTime(raw, { endOfDayFallback: false });
  if (!start) return 0;
  return Math.max(0, Math.floor((nowMs - start.getTime()) / 60000));
};

// Web "Next" in the consent form: online appointments keep their status and
// get queue_status 'skipped'; walk-ins take appointment_status (web parity).
export const getSkipPayload = (appt) =>
  getAppointmentSource(appt) === 'walkin'
    ? { appointment_status: 'skipped' }
    : { queue_status: 'skipped' };

// Works on raw API rows and on formatAppointment() output (both carry status).
// True once a pending online appointment's slot time has passed. (The doctor
// dashboard keeps these in today's queue so a late patient can still be seen.)
export const isExpiredPendingAppointment = (a, nowMs = Date.now()) => {
  if (normalizeAppointmentStatus(a) !== 'pending') return false;
  // Emergencies have no slot to miss; they wait until the doctor acts.
  if (isEmergencyAppointment(a)) return false;
  // Walk-ins stay queued until their status is changed explicitly.
  if (getAppointmentSource(a) === 'walkin') return false;
  const dt = getBookedDateTime(a.__raw || a);
  return dt ? dt.getTime() < nowMs : false;
};

// In-person consultations can only be started once the slot time arrives.
// Walk-ins are already at the clinic, and appointments without a known time
// can't be gated, so both are always startable.
export const isConsultationStartOpen = (appt, nowMs = Date.now()) => {
  if (!appt) return false;
  if (getAppointmentSource(appt) === 'walkin' || isEmergencyAppointment(appt)) return true;
  const dt = getAppointmentDateTime(appt.__raw || appt, { endOfDayFallback: false })
    // Last resort: the exact time string the card is showing.
    || parseTimeOnDate(formatLocalDateKey(appt.appointmentDate), appt.scheduledTime);
  return !dt || dt.getTime() <= nowMs;
};

// An emergency token keeps its slot time; only a slotless emergency reads 'Emergency'.
const formatAppointmentTime = (a) => {
  const start = getBookedDateTime(a, { endOfDayFallback: false });
  if (start) return formatTime12(start);
  if (isEmergencyAppointment(a)) return 'Emergency';
  return getAppointmentTimeValue(a) || 'Today';
};

export const formatAppointment = (a, forcedStatus) => {
  a = consultationData(a);
  const vitals = getAppointmentVitals(a);
  // Patient data is populated under different keys across queue, appointment,
  // staff and legacy responses. Merge every object so a phone nested in
  // `patient_id` or `patient_details` is not lost in the consent form.
  const patient = [a?.user, a?.patientData, a?.patient_data, a?.patient_details, a?.patient_id, a?.patient]
    .filter((value) => value && typeof value === 'object')
    .reduce((merged, value) => ({ ...merged, ...value }), {});
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
  let consultationTiming = a?.consultation_timing || a?.consultationTiming || {};
  if (typeof consultationTiming === 'string') {
    try { consultationTiming = JSON.parse(consultationTiming) || {}; } catch { consultationTiming = {}; }
  }
  return {
    __raw: a,
    __appointmentSource: appointmentSource,
    id: `${appointmentSource}-${apiId}`,
    apiId,
    doctorId: pickFirst(a?.doctor_id, a?.doctorId, a?.doctor?.id, a?.doctor?._id),
    appointmentSource,
    appointmentType: appointmentSource === 'walkin' ? 'Walk-in' : 'Online',
    consultationMode: String(pickFirst(a?.consultation_mode, a?.consultationMode, a?.mode, 'in-clinic')).toLowerCase(),
    appointmentDate: getAppointmentDateValue(a),
    // The day it was booked for. appointmentDate prefers the server's moving
    // estimate, which carries an unfinished booking forward to "today".
    bookedDate: getAppointmentDayValue(a),
    delayMinutes: Number(pickFirst(a?.delay_minutes, a?.delayMinutes, 0)),
    delayReason: pickFirst(a?.delay_reason, a?.delayReason),
    name: pickFirst(
      a?.__accountName, a?.__staffName, a?.patient_name, a?.patientName, a?.walkin_patient_name, a?.walkinPatientName,
      a?.visitor_name, a?.visitorName, a?.name, patient?.full_name, patient?.fullName, patient?.name, 'Unknown',
    ),
    gender: pickFirst(a?.gender, a?.patient_gender, patient?.gender, 'Not specified'),
    isEmergency: isEmergencyAppointment(a),
    emergencyReason: pickFirst(a?.emergency_reason, a?.emergencyReason, parseEmergencySymptoms(a?.symptoms).reason),
    issue: pickFirst(
      a?.emergency_reason, a?.emergencyReason, parseEmergencySymptoms(a?.symptoms).reason,
      a?.reason, a?.issue, stripEmergencyTag(a?.symptoms), a?.description, 'General Checkup',
    ),
    scheduledTime: formatAppointmentTime(a),
    status: normalizeAppointmentStatus(a, forcedStatus),
    availability: a?.availability || consultationTiming.availability || {},
    phone: formatPhoneNumber(pickFirst(
      a?.__staffPhone, a?.__accountPhone,
      a?.patient_phone, a?.patientPhone, a?.phone, a?.mobile, a?.phone_number, a?.phoneNumber, a?.contact_number,
      patient?.phone, patient?.mobile, patient?.phone_number, patient?.phoneNumber, patient?.contact_number, 'N/A',
    ), a?.phoneCountryCode || a?.phone_country_code || a?.__accountPhoneCountryCode || patient?.phoneCountryCode || patient?.phone_country_code),
    // Same field spread WalkInAppointmentsScreen accepts. `token` is only used
    // when it's a plain value — some endpoints nest a token-status object there.
    tokenNumber: pickFirst(
      a?.token_number, a?.tokenNumber, a?.token_no, a?.tokenNo, a?.queue_token, a?.queueToken,
      a?.walkin_token, a?.walkinToken, a?.appointment_token, a?.appointmentToken,
      typeof a?.token === 'object' ? a?.token?.myToken : a?.token,
    ),
    appointmentNo: pickFirst(a?.appointment_no, a?.appointmentNo, a?.appointment_number, a?.appointmentNumber),
    vitals,
    bp: pickFirst(vitals.blood_pressure, 'Not recorded'),
    temperature: vitals.temperature,
    bloodGroup: pickFirst(a?.blood_group, a?.bloodGroup, patient?.blood_group, patient?.bloodGroup, 'Not recorded'),
    patientId: pickFirst(
      patient?.user_id, patient?.userId, a?.patient_user_id, a?.patientUserId,
      a?.patient_id, a?.patientId, patient?.id, patient?._id,
    ),
    startTime: pickFirst(a?.start_time, a?.startTime),
    ...consultationTimes(a),
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

// Queue order: emergencies first (whoever sent it first), then token number
// ascending, then slot time. The dashboard then runs the queue session by
// session (utils/queueSlots), so inside each slot range it reads by token.
// Remaining ties fall back to name so the order never jumps between refreshes.
const getTokenNumber = (appt) => {
  const match = String(appt?.tokenNumber ?? '').match(/\d+/);
  return match ? Number(match[0]) : null;
};

const getStartMs = (appt) => {
  const dt = getBookedDateTime(appt?.__raw || appt);
  return dt ? dt.getTime() : 0;
};

// When the booking was made (ms), or 0 when the row doesn't say.
const getCreatedMs = (appt) => Date.parse(pickFirst(
  appt?.__raw?.created_at, appt?.__raw?.createdAt, appt?.created_at, appt?.createdAt,
)) || 0;

export const compareByToken = (a, b) => {
  // Emergencies always come first; among them, whoever sent it first.
  const ea = isEmergencyAppointment(a);
  const eb = isEmergencyAppointment(b);
  if (ea !== eb) return ea ? -1 : 1;
  if (ea && eb) {
    const ca = getCreatedMs(a);
    const cb = getCreatedMs(b);
    if (ca && cb && ca !== cb) return ca - cb;
  }
  const ta = getTokenNumber(a);
  const tb = getTokenNumber(b);
  if (ta !== null && tb !== null && ta !== tb) return ta - tb;
  const timeDiff = getStartMs(a) - getStartMs(b);
  if (timeDiff) return timeDiff;
  return String(a?.name || '').localeCompare(String(b?.name || ''));
};

export const sortByToken = (list = []) => [...list].sort(compareByToken);

// What the queue's slot heading reads (utils/queueSlots): the booked time in
// minutes from midnight on its day, and the clinic whose availability grid
// it is on.
export const getQueueSlotInfo = (appt) => {
  const raw = appt?.__raw || appt;
  const booked = getBookedDateTime(raw, { endOfDayFallback: false });
  const clinic = pickFirst(raw?.clinic_id, raw?.clinicId, raw?.clinic);
  return {
    emergency: isEmergencyAppointment(raw),
    minutes: booked ? booked.getHours() * 60 + booked.getMinutes() : null,
    iso: booked ? formatLocalDateKey(booked) : '',
    clinicId: clinic && typeof clinic === 'object' ? pickFirst(clinic._id, clinic.id) : clinic,
  };
};

export const isDoctorPendingAppointment = (appointment) =>
  ['pending', 'confirmed'].includes(appointment?.status);

export const isDoctorInProgressAppointment = (appointment) =>
  appointment?.status === 'in-progress';

// Readable label only — never a code cut from the database id (that produced
// meaningless labels like "Pa58" for appointments without a token).
export const getTokenLabel = (appt) => {
  if (isEmergencyAppointment(appt)) return appt?.tokenNumber ? `Emergency #${appt.tokenNumber}` : 'Emergency';
  if (appt?.tokenNumber) return `Token #${appt.tokenNumber}`;
  if (appt?.appointmentNo) return appt.appointmentNo;
  return getAppointmentSource(appt) === 'walkin' ? 'Walk-in' : 'No token';
};

// Doctors consult in the clinic or by video only. Appointments booked as
// voice / phone before that change are taken as video consultations, so the
// doctor still reaches the patient — by video call.
export const getRemoteConsultationMode = (appt) => {
  const mode = String(appt?.consultationMode || '').toLowerCase();
  if (mode.includes('video') || mode.includes('voice') || mode.includes('phone')) return 'video';
  return '';
};

// How the consultation happens, for the mode badge on queue cards:
//   video → remote consultation; walk-in → patient came to the clinic
//   without booking; anything else → a booked in-clinic visit.
export const getConsultationModeInfo = (appt) => {
  const remote = getRemoteConsultationMode(appt);
  if (remote === 'video') return { key: 'video', label: 'Video Consultation', icon: 'video' };
  if (getAppointmentSource(appt) === 'walkin') return { key: 'walkin', label: 'Walk-in Visit', icon: 'walk' };
  return { key: 'visit', label: 'In-clinic Visit', icon: 'pin' };
};

// Video / voice call window (same as the web dashboard): opens 15 min before
// the slot and closes 90 min after it.
//
// Computed from the real slot time (resolveScheduledStart), not by re-parsing
// the time *label* on the card, which is locale-formatted ("०५:०५ PM" on a
// Marathi phone, and could lose AM/PM).
export const CALL_OPENS_BEFORE_MIN = 15;
export const CALL_CLOSES_AFTER_MIN = 90;

export const getCallWindow = (appt, nowMs = Date.now()) => {
  const start = getAppointmentDateTime(appt?.__raw || appt, { endOfDayFallback: false })
    || parseTimeOnDate(formatLocalDateKey(appt?.appointmentDate), appt?.scheduledTime);
  if (!start) return { open: true, opensAt: null };
  const opensAt = new Date(start.getTime() - CALL_OPENS_BEFORE_MIN * 60000);
  const closesAt = new Date(start.getTime() + CALL_CLOSES_AFTER_MIN * 60000);
  return { open: nowMs >= opensAt.getTime() && nowMs <= closesAt.getTime(), opensAt };
};

export const isAppointmentCallWindowOpen = (appt, nowMs = Date.now()) => getCallWindow(appt, nowMs).open;

export const formatClockTime = (date) =>
  formatTime12(date);

// ---- writes ---------------------------------------------------------------

export const getAppointmentApiPath = (appt) =>
  `/api/${getAppointmentSource(appt) === 'walkin' ? 'walkin-appointments' : 'appointments'}/${encodeURIComponent(String(appt.apiId || appt.id))}`;

// Load the complete saved record; queue feeds can omit prescription lists.
export const loadAppointmentPrescription = async (appointment) => {
  const { data } = await axiosInstance.get(getAppointmentApiPath(appointment), { timeout: 15000 });
  const raw = data?.appointment || data?.data?.appointment || data?.data || data;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).length === 0) {
    throw new Error('Prescription details could not be loaded.');
  }
  const updated = formatAppointment({ ...raw, __appointmentSource: getAppointmentSource(appointment) });
  return { ...appointment, ...updated };
};

const normalizeWriteStatus = (status) => String(status || '').trim().toLowerCase().replace(/[\s-]+/g, '_');

const getWalkinWriteStatus = (status) => {
  const value = normalizeWriteStatus(status);
  if (value === 'in_progress') return 'in_consultation';
  if (value === 'complete') return 'completed';
  if (value === 'canceled') return 'cancelled';
  return value;
};

const getWalkinStatusCandidates = (status) => {
  const value = normalizeWriteStatus(status);
  // The web sends 'in-progress' for a walk-in start; the walk-in model's enum
  // rejects in_consultation, so that comes last.
  if (value === 'in_progress' || value === 'in_consultation') return ['in-progress', 'in_progress', 'IN_PROGRESS', 'in_consultation', 'IN_CONSULTATION'];
  if (value === 'completed' || value === 'complete') return ['completed', 'COMPLETED', 'complete', 'COMPLETE'];
  if (value === 'cancelled' || value === 'canceled') return ['cancelled', 'cancelled', 'CANCELLED', 'canceled', 'CANCELED'];
  if (value === 'skipped') return ['skipped', 'SKIPPED'];
  return [getWalkinWriteStatus(status), String(status || '').trim()].filter(Boolean);
};

// Walk-ins use the walk-in queue lifecycle (`in_consultation`), while online
// appointments keep the appointment lifecycle used by /api/appointments.
export const getStatusUpdatePayload = (appt, status, extraFields = {}) => {
  if (getAppointmentSource(appt) !== 'walkin') {
    return { ...extraFields, appointment_status: status };
  }
  const walkinStatus = getWalkinWriteStatus(status);
  return {
    ...extraFields,
    status: walkinStatus,
    ...(appt?.doctorId ? { doctor_id: appt.doctorId } : {}),
  };
};

const uniquePayloads = (payloads) => {
  const seen = new Set();
  return payloads.filter((payload) => {
    const key = JSON.stringify(payload);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const buildWalkinPatchPayloads = (appt, body = {}) => {
  const status = pickFirst(body.status, body.appointment_status, body.appointmentStatus, body.walkin_status, body.walkinStatus);
  if (!status) return [body];
  const base = { ...body };
  delete base.status;
  delete base.appointment_status;
  delete base.appointmentStatus;
  delete base.walkin_status;
  delete base.walkinStatus;
  const doctorId = pickFirst(base.doctor_id, base.doctorId, appt?.doctorId, appt?.__raw?.doctor_id, appt?.__raw?.doctorId);
  const withDoctor = doctorId ? { ...base, doctor_id: doctorId } : base;
  return uniquePayloads(
    getWalkinStatusCandidates(status).flatMap((candidate) => [
      { ...withDoctor, status: candidate },
      { ...withDoctor, appointment_status: candidate },
    ]),
  );
};

// ---- walk-in queue state kept on this device ----------------------------------
// The deployed walk-in model's appointment_status only takes booked / pending /
// confirmed / completed / cancelled: "skipped", "in-progress" and
// "in_consultation" are rejected with a 400 (the backend adds them, but that
// isn't deployed yet). Both are tried on the server first; when refused, a
// walk-in moved to Next, or whose consultation was started, is remembered on
// this device for the day, and the feed adds the matching queue_status /
// consultation_started_at to the row. Any status the server does save
// (start / skip / complete / cancel) clears it.
const WALKIN_QUEUE_KEY = 'doctorWalkinQueueState';
let walkinQueue = {}; // { [walk-in id]: { day, state: 'skipped' | 'in-progress', startedAt } }
const walkinKey = (a) => String(pickFirst(a?.apiId, a?.__raw?._id, a?.__raw?.id, a?._id, a?.id) ?? '');
const saveWalkinQueue = () =>
  AsyncStorage.setItem(WALKIN_QUEUE_KEY, JSON.stringify(walkinQueue)).catch(() => {});

export const loadWalkinQueueState = async () => {
  try {
    walkinQueue = JSON.parse((await AsyncStorage.getItem(WALKIN_QUEUE_KEY)) || '{}') || {};
  } catch {
    walkinQueue = {};
  }
  const today = formatLocalDateKey();
  walkinQueue = Object.fromEntries(Object.entries(walkinQueue).filter(([, entry]) => entry?.day === today));
};

const setWalkinQueueState = (appt, state) => {
  const key = walkinKey(appt);
  if (!key) return null;
  if (state) {
    walkinQueue[key] = { day: formatLocalDateKey(), state, startedAt: state === 'in-progress' ? new Date().toISOString() : null };
  } else if (walkinQueue[key]) {
    delete walkinQueue[key];
  } else {
    return null;
  }
  saveWalkinQueue();
  return walkinQueue[key] || null;
};

// A still-booked walk-in row with this device's Next / started state applied.
// Next / start kept only on this device (from when the server refused those
// statuses) is pushed to the server once per session, so the receptionist and
// the web see it too. Once the server saves it, the local entry is cleared.
const syncAttempted = new Set();
const syncWalkinQueueState = (row, entry) => {
  const attempt = `${walkinKey(row)}:${entry.state}`;
  if (syncAttempted.has(attempt)) return;
  syncAttempted.add(attempt);
  patchAppointment(row, { status: entry.state === 'skipped' ? 'skipped' : 'in-progress' }).catch(() => {});
};

const withWalkinQueueState = (row) => {
  const entry = walkinQueue[walkinKey(row)];
  if (!entry) return row;
  const status = statusKey(pickFirst(row.appointment_status, row.status));
  if (status && !['booked', 'pending', 'waiting'].includes(status)) {
    // Completed / cancelled on the server: the local state is done with.
    delete walkinQueue[walkinKey(row)];
    saveWalkinQueue();
    return row;
  }
  syncWalkinQueueState(row, entry);
  if (entry.state === 'skipped') return { ...row, queue_status: 'skipped' };
  if (entry.state === 'in-progress') return { ...row, consultation_started_at: entry.startedAt || new Date().toISOString() };
  return row;
};

// The saved row's status, to check the server really applied a change: the
// walk-in API answers 200 even for fields it ignores.
const savedWalkinStatus = (response) => {
  const saved = response?.data?.data || response?.data?.appointment || response?.data;
  const value = pickFirst(saved?.appointment_status, saved?.status);
  return value === undefined ? null : normalizeWriteStatus(value);
};

export const patchAppointment = async (appt, body) => {
  const path = getAppointmentApiPath(appt);
  if (getAppointmentSource(appt) !== 'walkin') return axiosInstance.patch(path, body);

  const requested = pickFirst(body?.status, body?.appointment_status, body?.appointmentStatus, body?.walkin_status, body?.walkinStatus);
  const requestedKey = requested ? normalizeWriteStatus(requested) : '';

  const payloads = buildWalkinPatchPayloads(appt, body);
  let lastError = null;
  for (const payload of payloads) {
    try {
      const response = await axiosInstance.patch(path, payload);
      const wanted = pickFirst(payload.status, payload.appointment_status);
      const saved = savedWalkinStatus(response);
      if (wanted && saved && saved !== normalizeWriteStatus(wanted)) {
        lastError = new Error('The clinic server did not save this status change.');
        continue;
      }
      if (requested) setWalkinQueueState(appt, null);
      return response;
    } catch (err) {
      lastError = err;
      const statusCode = err?.response?.status;
      if (statusCode !== 400 && statusCode !== 422) throw err;
    }
  }
  // Next / start refused by the server: keep it on this device (see walkinQueue).
  if (requestedKey === 'skipped') {
    setWalkinQueueState(appt, 'skipped');
    return { data: { success: true, localOnly: true } };
  }
  if (requestedKey === 'in_progress' || requestedKey === 'in_consultation') {
    const entry = setWalkinQueueState(appt, 'in-progress');
    return { data: { success: true, localOnly: true, data: { consultation_started_at: entry?.startedAt } } };
  }
  throw lastError;
};

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
