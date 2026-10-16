// Staff directory — same backend contract as the web
// (chatbot/src/Component/DoctorDashboard/DoctorUserManagement):
//   GET    /api/staff?doctor_id=<id>        list
//   POST   /api/staff                       create (full_name, name, clinic_id, contact_number, …)
//   PUT    /api/staff/:id                   update
//   DELETE /api/staff/:id                   delete
//   GET    /api/clinics?doctor_id=<id>      clinics a staff member can belong to
// The server requires `full_name`/`name` and a `clinic_id`; sending the old
// camelCase shape (firstName/lastName) failed with "Staff name is required".
import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosInstance, { API_BASE_URL } from '../../../../axiosConfig';
import { getDoctorIdFromUser, getStoredDoctorUser } from '../api/doctorAppointments';
import { loadDoctorClinics } from '../api/doctorClinics';
import { clearStaffDocuments } from './staffDocuments';

// Web shift values and their hours (24h, end may wrap past midnight).
export const SHIFTS = [
  { key: 'Morning', label: '6:00 AM – 2:00 PM', start: 6, end: 14 },
  { key: 'Evening', label: '2:00 PM – 10:00 PM', start: 14, end: 22 },
  { key: 'Night', label: '10:00 PM – 6:00 AM', start: 22, end: 6 },
];
export const shiftInfo = (shift) => SHIFTS.find((s) => s.key === shift) || SHIFTS[0];

// The web's defaults when a shift is picked (staffProfileDetails defaultShiftTimes);
// the doctor can then set the exact start and end times.
export const DEFAULT_SHIFT_TIMES = {
  Morning: ['06:00', '14:00'],
  Evening: ['14:00', '22:00'],
  Night: ['22:00', '06:00'],
};

const toMinutesOfDay = (value) => {
  const m = String(value || '').match(/^(\d{1,2}):(\d{2})/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};

// "14:00" → "2:00 PM"
export const formatClock12 = (value) => {
  const minutes = toMinutesOfDay(value);
  if (minutes === null) return '';
  const h = Math.floor(minutes / 60);
  return `${h % 12 || 12}:${String(minutes % 60).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

export const shiftTimeLabel = (start, end) =>
  start && end ? `${formatClock12(start)} – ${formatClock12(end)}` : '';

// On shift now — by the saved start/end times when there are any, else by
// the shift's default hours.
export const isOnShiftNow = (shift, now = new Date(), startTime, endTime) => {
  const startMin = toMinutesOfDay(startTime);
  const endMin = toMinutesOfDay(endTime);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  if (startMin !== null && endMin !== null && startMin !== endMin) {
    return startMin < endMin ? nowMin >= startMin && nowMin < endMin : nowMin >= startMin || nowMin < endMin;
  }
  const { start, end } = shiftInfo(shift);
  const h = now.getHours();
  return start < end ? h >= start && h < end : h >= start || h < end;
};

// Staff photos. Sent to the server as `profilePhoto`; also remembered on this
// device per staff record, so a photo still shows if the server doesn't
// store/return the field.
const PHOTO_CACHE_KEY = 'doctorStaffPhotos';
let photoCache = null;

const loadPhotoCache = async () => {
  if (photoCache) return photoCache;
  try {
    photoCache = JSON.parse((await AsyncStorage.getItem(PHOTO_CACHE_KEY)) || '{}') || {};
  } catch {
    photoCache = {};
  }
  return photoCache;
};

const rememberPhoto = async (rawId, uri) => {
  if (!rawId) return;
  const cache = await loadPhotoCache();
  if (uri) cache[rawId] = uri;
  else delete cache[rawId];
  AsyncStorage.setItem(PHOTO_CACHE_KEY, JSON.stringify(cache)).catch(() => {});
};

// <Image source={{ uri }}> needs a string: the server can send the photo as an
// object ({ url } …) or a relative upload path, and a non-string uri crashes
// the staff screens ("Error while updating property 'src' … RCTImageView").
const photoUri = (value) => {
  const uri = typeof value === 'string'
    ? value
    : value && typeof value === 'object'
      ? value.url || value.uri || value.secure_url || value.location || value.path || ''
      : '';
  if (typeof uri !== 'string' || !uri.trim()) return '';
  const trimmed = uri.trim();
  if (/^(https?:|file:|content:|data:image\/)/i.test(trimmed)) return trimmed;
  if (/^\/?[\w./-]+\.(jpe?g|png|webp|gif|heic)$/i.test(trimmed)) {
    return `${API_BASE_URL.replace(/\/+$/, '')}/${trimmed.replace(/^\/+/, '')}`;
  }
  return '';
};

const serverPhoto = (doc) =>
  [doc?.profilePhoto, doc?.profile_photo, doc?.photo, doc?.image].map(photoUri).find(Boolean) || '';

// Role ids the backend uses (web docStaffRoleCards / roleLabels).
export const ROLE_LABELS = {
  nurse: 'Nurse',
  assistant: 'Medical Assistant',
  technician: 'Lab Technician',
  billing: 'Billing',
  housekeeping: 'Housekeeping',
  supervisor: 'Supervisor',
  receptionist: 'Receptionist',
  manager: 'Department Manager',
};
const STAFF_ROLE_VALUES = ['staff', ...Object.keys(ROLE_LABELS)];

// Login password generated for a new staff member: 10 characters with at
// least one upper, lower, digit and symbol. Look-alike characters
// (I/l/1, O/0) are left out so it can be read out or typed from a message.
const PASSWORD_SETS = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghijkmnpqrstuvwxyz', '23456789', '@#$%&*!?'];
const randomIndex = (max) => {
  const cryptoApi = global.crypto;
  if (cryptoApi?.getRandomValues) return cryptoApi.getRandomValues(new Uint32Array(1))[0] % max;
  return Math.floor(Math.random() * max);
};
const pickChar = (set) => set[randomIndex(set.length)];

export const generateStaffPassword = (length = 10) => {
  const all = PASSWORD_SETS.join('');
  const chars = PASSWORD_SETS.map(pickChar);
  while (chars.length < length) chars.push(pickChar(all));
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomIndex(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
};

const ROLE_KEYS_BY_LABEL = Object.fromEntries(Object.entries(ROLE_LABELS).map(([key, label]) => [label, key]));
// Older app builds used these ids; map them onto the backend ones.
const LEGACY_ROLE_KEYS = { medicalAssistant: 'assistant', labTechnician: 'technician', billingStaff: 'billing', 'Billing Staff': 'billing' };

const toTitleCase = (value = '') => String(value).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  .replace(/\b\w/g, (c) => c.toUpperCase());

export const roleKeyToLabel = (key) => ROLE_LABELS[key] || toTitleCase(key || 'Staff');
export const roleLabelToKey = (label) => LEGACY_ROLE_KEYS[label] || ROLE_KEYS_BY_LABEL[label] || label;

const normalizeStatus = (value) => {
  const status = String(value || 'active').toLowerCase();
  if (status.includes('suspend') || status.includes('block') || status === 'inactive') return 'Suspended';
  if (status.includes('leave') || status.includes('off')) return 'On Leave';
  return 'Active';
};

const normalizeVerification = (value) => {
  const v = String(value ?? '').toLowerCase();
  if (!v || v.includes('pending') || v.includes('unverified') || v === 'false') return 'Pending Docs';
  return 'Verified';
};

const getNestedArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  return [
    payload?.data, payload?.users, payload?.staff, payload?.members, payload?.results,
    payload?.data?.users, payload?.data?.staff, payload?.data?.members, payload?.data?.results,
  ].find(Array.isArray) || [];
};

const avatarFor = (name) => `https://ui-avatars.com/api/?background=0D9488&color=fff&name=${encodeURIComponent(name || 'Staff')}`;

// Web normalizeStaffRow, returning the fields the app's staff screens read.
export function normalizeStaff(doc = {}) {
  const first = doc.first_name || doc.firstName || '';
  const last = doc.last_name || doc.lastName || '';
  const name = doc.full_name || doc.fullName || doc.name || [first, last].filter(Boolean).join(' ') || 'Staff Member';
  const [firstName, ...rest] = name.split(/\s+/);
  const rawId = doc.id || doc._id || doc.user_id || doc.staff_id;
  const roleKey = roleLabelToKey(String(doc.role || doc.user_role || doc.staff_role || doc.designation || '').toLowerCase()) || '';
  // Older builds could cache a non-string photo; only a valid uri is used.
  const cached = rawId ? photoUri(photoCache?.[rawId]) : '';
  return {
    raw: doc,
    rawId,
    id: doc.employee_id || doc.employeeId || doc.staff_code || doc.code || (rawId ? `#MC-${String(rawId).slice(-4)}` : ''),
    name,
    firstName: first || firstName || '',
    lastName: last || rest.join(' '),
    email: doc.email || doc.email_address || '',
    phone: doc.contact_number || doc.phone || doc.phone_number || doc.mobile || '',
    department: toTitleCase(doc.department || doc.department_name || 'General'),
    role: roleKeyToLabel(roleKey),
    roleKey,
    clinicId: String(doc.clinic_id || doc.clinicId || ''),
    clinicName: doc.clinic_name || doc.clinicName || '',
    shift: toTitleCase(doc.shift || doc.shift_preference || 'Morning'),
    // Exact shift timings (web: shift_start_time / shift_end_time / shift_time).
    shiftStartTime: doc.shift_start_time || doc.shiftStartTime
      || String(doc.shift_time || doc.shiftTime || '').split(' - ')[0]
      || DEFAULT_SHIFT_TIMES[toTitleCase(doc.shift || doc.shift_preference || 'Morning')]?.[0] || '',
    shiftEndTime: doc.shift_end_time || doc.shiftEndTime
      || String(doc.shift_time || doc.shiftTime || '').split(' - ')[1]
      || DEFAULT_SHIFT_TIMES[toTitleCase(doc.shift || doc.shift_preference || 'Morning')]?.[1] || '',
    verification: normalizeVerification(doc.verification ?? doc.emailVerified ?? doc.is_verified ?? doc.verified),
    status: normalizeStatus(doc.status || doc.account_status),
    employmentStatus: doc.employmentStatus || doc.employment_status || 'Full-Time',
    joinDate: String(doc.hire_date || doc.hireDate || doc.join_date || doc.joinDate || doc.createdAt || '').slice(0, 10),
    image: serverPhoto(doc) || cached || avatarFor(name),
    hasPhoto: Boolean(serverPhoto(doc) || cached),
  };
}

const getDoctorId = async () => getDoctorIdFromUser(await getStoredDoctorUser());

// The created/updated record comes back under different keys per server.
const pickRecord = (data) => data?.user || data?.data || data?.staff || data;

export const fetchStaff = async () => {
  await loadPhotoCache();
  const doctorId = await getDoctorId();
  const { data } = await axiosInstance.get('/api/staff', { params: { doctor_id: doctorId || undefined } });
  return getNestedArray(data)
    .filter((doc) => {
      const role = String(doc.role || doc.user_role || doc.staff_role || doc.designation || '').toLowerCase();
      return !role || STAFF_ROLE_VALUES.includes(role) || ROLE_LABELS[role];
    })
    .map(normalizeStaff);
};

// Same loader as Clinic Settings, so a clinic saved there always shows up here.
// (getNestedArray only knows staff-list keys and missed `clinics` / `data.clinics`.)
export const fetchClinics = async () => {
  const doctorId = await getDoctorId();
  if (!doctorId) return [];
  const clinics = await loadDoctorClinics(String(doctorId));
  return clinics.map(({ id, name, location }) => ({ id, name, location }));
};

// `form`: { clinicId, firstName, lastName, email, phone, role, department,
// shift, dateOfBirth, gender, hireDate, password }. `photo`: data URI or null.
// `password` is the generated login password: the staff member signs in on
// the main Login page with `email` + `password`, and `role` routes them to
// the staff dashboard.
export const createStaff = async (form, photo = null) => {
  await loadPhotoCache();
  const fullName = `${form.firstName || ''} ${form.lastName || ''}`.trim();
  const body = {
    full_name: fullName,
    name: fullName,
    clinic_id: form.clinicId,
    email: form.email,
    contact_number: form.phone,
    role: roleLabelToKey(form.role),
    department: form.department,
    shift: form.shift,
    shift_start_time: form.shiftStartTime || undefined,
    shift_end_time: form.shiftEndTime || undefined,
    shift_time: form.shiftStartTime && form.shiftEndTime ? `${form.shiftStartTime} - ${form.shiftEndTime}` : undefined,
    date_of_birth: form.dateOfBirth || undefined,
    gender: form.gender || undefined,
    hire_date: form.hireDate || undefined,
    password: form.password || generateStaffPassword(),
    ...(photo ? { profilePhoto: photo } : {}),
  };
  const { data } = await axiosInstance.post('/api/staff', body);
  const record = pickRecord(data) || {};
  const created = normalizeStaff({ ...body, ...record });
  if (photo) await rememberPhoto(created.rawId, serverPhoto(record) || photo);
  // The server emails the login details to the new staff member. If it says
  // the email failed, the screen falls back to showing / sharing them.
  const emailFlag = [data?.emailSent, data?.mailSent, data?.credentialsSent, data?.email_sent, data?.data?.emailSent]
    .find((value) => value !== undefined && value !== null);
  return { ...normalizeStaff({ ...body, ...record }), credentialsEmailed: emailFlag === undefined ? null : Boolean(emailFlag) };
};

// `changes`: { fullName, clinicId, email, phone, department, role, shift,
// status }. `photo`: undefined = unchanged, data URI = new photo.
export const updateStaff = async (rawId, changes, photo) => {
  await loadPhotoCache();
  const body = {
    full_name: changes.fullName,
    name: changes.fullName,
    clinic_id: changes.clinicId || undefined,
    email: changes.email,
    contact_number: changes.phone,
    department: changes.department,
    role: roleLabelToKey(changes.role),
    shift: changes.shift,
    shift_start_time: changes.shiftStartTime || undefined,
    shift_end_time: changes.shiftEndTime || undefined,
    shift_time: changes.shiftStartTime && changes.shiftEndTime ? `${changes.shiftStartTime} - ${changes.shiftEndTime}` : undefined,
    status: changes.status,
    isActive: (changes.status || 'Active') === 'Active',
    ...(photo ? { profilePhoto: photo } : {}),
  };
  // Same request as the web (PUT /api/staff/:id). If the server answers
  // "Cannot PUT" (404 — no such route), retry once as PATCH on the same path.
  let data;
  try {
    ({ data } = await axiosInstance.put(`/api/staff/${rawId}`, body));
  } catch (err) {
    if (err?.response?.status !== 404) throw err;
    try {
      ({ data } = await axiosInstance.patch(`/api/staff/${rawId}`, body));
    } catch (patchErr) {
      if (![404, 405].includes(patchErr?.response?.status)) throw patchErr;
      const missing = new Error('Staff update is not available on the server yet.');
      missing.response = { status: 404, data: { message: 'Staff update is not available on the server yet (no update route for /api/staff/:id).' } };
      throw missing;
    }
  }
  const record = pickRecord(data) || {};
  if (photo) await rememberPhoto(rawId, serverPhoto(record) || photo);
  return normalizeStaff({ id: rawId, ...body, ...record });
};

export const deleteStaff = async (rawId) => {
  await axiosInstance.delete(`/api/staff/${rawId}`);
  await rememberPhoto(rawId, null);
  await clearStaffDocuments(rawId);
};
