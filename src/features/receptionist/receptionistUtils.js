// Display helpers, ported from the web portal (receptionistView.js,
// receptionistDisplay.js, staffProfileDetails.js, appointmentCancellation.js).
import { parseEmergencySymptoms } from '../../utils/emergencyTag';
import { isPatientAccountDeleted } from '../../utils/deletedAccount';

// The clinic runs on India time, whatever the phone's own zone is.
const indiaNow = () => new Date(Date.now() + 330 * 60000);

export const indiaToday = () => indiaNow().toISOString().slice(0, 10);

export const displayTime = (value) => {
  if (!value) return '--';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '--';
  const ist = new Date(d.getTime() + 330 * 60000);
  const h = ist.getUTCHours();
  const m = String(ist.getUTCMinutes()).padStart(2, '0');
  return `${h % 12 || 12}:${m} ${h >= 12 ? 'PM' : 'AM'}`;
};

// "2026-10-14" → "14 Oct 2026"
export const dateLabel = (value) => {
  const key = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return 'Not recorded';
  const [y, mo, d] = key.split('-').map(Number);
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][mo - 1];
  return `${String(d).padStart(2, '0')} ${month} ${y}`;
};


export const statusLabel = (value) =>
  String(value || 'Not recorded').replace(/[_-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export const clinicName = (clinics, id) =>
  (clinics || []).find((row) => String(row._id || row.id) === String(id))?.clinic_name || 'Unassigned';

export const patientKey = (row) => `${row.source}:${row.id}`;

export const emergencyReasonOf = (row = {}) =>
  [row.emergencyReason, row.emergency_reason, row.emergency?.reason, parseEmergencySymptoms(row.symptoms).reason]
    .find((value) => typeof value === 'string' && value.trim())?.trim() || '';

// A booking left behind by a deleted patient account: the server keeps the
// row but no longer populates the patient, so it arrives as a nameless
// "Patient" with no phone or account id and still reads "Pending / Booked".
// Walk-ins always carry the typed-in name, so they are never treated as orphans.
const PLACEHOLDER_NAMES = new Set(['', 'patient', 'unknown', 'unknown patient', 'deleted user', 'user']);
export const isOrphanedBooking = (row = {}) => {
  const patient = row.patient && typeof row.patient === 'object' ? row.patient : {};
  if (isPatientAccountDeleted(row)) return true;
  if (String(row.source || '').toLowerCase() === 'walkin') return false;
  const name = String(row.patientName || patient.fullName || patient.name || row.patient_name || '').trim().toLowerCase();
  const phone = String(row.phoneNumber || patient.phoneNumber || patient.phone || row.phone_number || row.contact_number || '').replace(/\D/g, '');
  const accountId = patient._id || patient.id || patient.user_id || patient.userId || row.patient_id || row.patientId || row.user_id || row.userId;
  return PLACEHOLDER_NAMES.has(name) && !phone && !accountId;
};

// Staff feeds have used both snake_case and camelCase fields. Preserve the
// original record and expose the same fields to every receptionist screen.
export const normalizeReceptionistAppointment = (row = {}) => {
  const patient = row.patient && typeof row.patient === 'object' ? row.patient : {};
  const symptoms = parseEmergencySymptoms(row.symptoms);
  const timing = timingOf(row.timing || row.consultation_timing || row.consultationTiming);
  return {
    ...row,
    id: row.id ?? row._id,
    patientName: row.patientName || patient.fullName || patient.name || row.patient_name || 'Patient',
    phoneNumber: row.phoneNumber || patient.phoneNumber || row.phone_number || row.contact_number || '',
    age: row.age ?? patient.age,
    gender: row.gender || patient.gender,
    date: row.date || row.appointment_date,
    time: row.time || row.appointment_time,
    clinicId: row.clinicId ?? row.clinic_id,
    token: row.token ?? row.token_number ?? row.tokenNumber,
    status: row.status || row.appointment_status,
    queueStatus: row.queueStatus || row.queue_status,
    emergency: [true, 1, '1', 'true'].includes(row.emergency)
      || Boolean(row.emergency && typeof row.emergency === 'object')
      || row.priority === 'emergency' || symptoms.isEmergency,
    emergencyReason: emergencyReasonOf(row),
    symptoms: typeof row.symptoms === 'string' ? symptoms.problem : row.symptoms,
    timing: {
      ...timing,
      startedAt: timing.startedAt || timing.started_at || row.consultation_started_at,
      endedAt: timing.endedAt || timing.ended_at || row.consultation_ended_at,
    },
  };
};

// Booking and queue state often contain the same status. Keep distinct states
// while treating the API's alternate spellings as one label.
export const appointmentStatuses = (row = {}) => {
  const canonical = (value) => {
    const status = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
    return ({ complete: 'completed', canceled: 'cancelled' })[status] || status;
  };
  return [...new Set([row.status, row.queueStatus].map(canonical).filter(Boolean))];
};

// Vitals are taken before the doctor sees the patient: editable for today's
// waiting and Next (skipped) appointments, read-only once the visit is in
// progress (consultation started, or in the In Progress queue tab) or finished.
const activeVitalsStatuses = new Set(['pending', 'confirmed', 'booked', 'accepted', 'scheduled', 'waiting', 'checked_in', 'skipped']);
const vitalsStatus = (value) => String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
const timingOf = (value) => {
  if (typeof value !== 'string') return value || {};
  try { return JSON.parse(value) || {}; } catch { return {}; }
};

export const canRecordVitals = (patient) => {
  if (!patient) return false;
  const appointmentStatus = vitalsStatus(patient.appointment_status || patient.status);
  const queueStatus = vitalsStatus(patient.queueStatus || patient.queue_status);
  const timings = [patient.timing, patient.consultation_timing, patient.consultationTiming].map(timingOf);
  return String(patient.date || patient.appointment_date || '').slice(0, 10) === indiaToday()
    && Boolean(appointmentStatus || queueStatus)
    && (!appointmentStatus || activeVitalsStatuses.has(appointmentStatus))
    && (!queueStatus || activeVitalsStatuses.has(queueStatus))
    && queueBucket(patient) !== 'in-progress'
    && !patient.consultation_started_at && !patient.consultation_ended_at
    && timings.every((t) => !t.startedAt && !t.started_at && !t.endedAt && !t.ended_at);
};

export const staffIdentity = (profile = {}) =>
  profile.staffId || profile.staff_id || profile.assistantId || profile.technicianId || profile.housekeepingStaffId
  || profile.supervisorId || profile.managerId || profile.billingId || profile._id || profile.id || 'Not assigned';

export const staffShiftTiming = (profile = {}) => {
  const start = profile.shiftStartTime || profile.shift_start_time;
  const end = profile.shiftEndTime || profile.shift_end_time;
  if (start && end) return `${start} - ${end}`;
  return profile.shiftTime || profile.shift_time || 'Not assigned';
};

export const assignedClinicId = (profile) =>
  String(profile?.clinic_id?._id || profile?.clinic_id?.id || profile?.clinic_id || '');

export const assignedDoctorId = (profile) =>
  String(profile?.assignedDoctor?._id || profile?.assignedDoctor?.id || profile?.assignedDoctor || '');

// Same rule as the web: only a booking nobody has started can be cancelled.
export const canCancelAppointment = (appointment) => {
  if (!appointment) return false;
  const status = String(appointment.appointment_status || appointment.status || '').toLowerCase();
  const queue = String(appointment.queue_status || appointment.queueStatus || '').toLowerCase();
  let timing = appointment.consultation_timing || appointment.consultationTiming || appointment.timing || {};
  if (typeof timing === 'string') {
    try { timing = JSON.parse(timing); } catch { return false; }
  }
  return ['pending', 'confirmed', 'booked', 'accepted'].includes(status)
    && !['in_progress', 'in-progress', 'completed', 'canceled', 'cancelled'].includes(queue)
    && !appointment.consultation_started_at && !appointment.consultation_ended_at
    && !timing?.startedAt && !timing?.started_at && !timing?.endedAt && !timing?.ended_at;
};

// The LED page lives on the backend root: <server>/display/clinic/:doctorClinicId
export const clinicDisplayUrl = (baseUrl, doctorClinicId) => {
  const id = String(doctorClinicId || '');
  if (!/^[a-zA-Z0-9_-]{1,191}$/.test(id)) return '';
  const base = String(baseUrl || '').replace(/\/+$/, '').replace(/\/api$/, '');
  return base ? `${base}/display/clinic/${encodeURIComponent(id)}` : '';
};

export const selectDisplayClinic = (clinics, currentId, preferredClinicId) =>
  clinics.find((row) => row.doctorClinicId === currentId)?.doctorClinicId
  || clinics.find((row) => String(row.clinicId || row.clinic?.id) === String(preferredClinicId || ''))?.doctorClinicId
  || clinics[0]?.doctorClinicId || '';

export const APPOINTMENT_STATUSES = ['all', 'completed', 'pending', 'confirmed', 'booked', 'waiting', 'called', 'in_progress', 'canceled', 'rejected', 'skipped', 'no_show'];

export const PASSWORD_RULES = [
  ['At least 8 characters', (value) => value.length >= 8],
  ['Uppercase letter', (value) => /[A-Z]/.test(value)],
  ['Lowercase letter', (value) => /[a-z]/.test(value)],
  ['A number', (value) => /\d/.test(value)],
  ['A special character', (value) => /[^A-Za-z0-9]/.test(value)],
];

// ---- Today's queue (same buckets and order as the doctor's queue) ----------

const key = (value) => String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');

// One booking can come back twice (e.g. in more than one list, or as the same
// visit from two sources): keep the first of each booking / token+name+time.
export const dedupeRows = (rows = []) => {
  const seen = new Set();
  return rows.filter((row) => {
    const ids = [patientKey(row)];
    if (row.token != null && row.token !== '') {
      ids.push(`t:${row.date || ''}|${row.token}|${key(row.patientName)}|${row.time || ''}`);
    }
    if (ids.some((id) => seen.has(id))) return false;
    ids.forEach((id) => seen.add(id));
    return true;
  });
};

// pending | in-progress | next | completed | cancelled — the doctor's queue tabs.
export const queueBucket = (row = {}) => {
  const status = key(row.status);
  const queue = key(row.queueStatus);
  if (['cancelled', 'canceled', 'rejected', 'no_show'].includes(status) || ['cancelled', 'canceled', 'no_show'].includes(queue)) return 'cancelled';
  if (status === 'completed' || status === 'complete' || queue === 'completed') return 'completed';
  if (['in_progress', 'in_consultation', 'called', 'serving'].includes(queue) || status === 'in_progress'
    || (row.timing?.startedAt && !row.timing?.endedAt)) return 'in-progress';
  if (queue === 'skipped' || status === 'skipped') return 'next';
  return 'pending';
};

const tokenNumber = (row) => {
  const n = Number(row.token);
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
};

// Emergency first, then token, then appointment time.
export const sortQueue = (rows = []) => [...rows].sort((a, b) =>
  (b.emergency ? 1 : 0) - (a.emergency ? 1 : 0)
  || tokenNumber(a) - tokenNumber(b)
  || String(a.time || '').localeCompare(String(b.time || '')));

export const QUEUE_TABS = [
  { key: 'pending', label: 'Pending' },
  { key: 'in-progress', label: 'In Progress' },
  { key: 'next', label: 'Next' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

export const groupQueue = (rows = []) => {
  const groups = { pending: [], 'in-progress': [], next: [], completed: [], cancelled: [] };
  dedupeRows(rows).forEach((row) => groups[queueBucket(row)].push(row));
  Object.keys(groups).forEach((name) => { groups[name] = sortQueue(groups[name]); });
  return groups;
};

// The account photo — the server may name the field differently per record.
export const profilePhotoOf = (profile = {}) =>
  profile.profilePhoto || profile.profile_photo || profile.photo || profile.image || profile.avatar || profile.profileImage || null;

// "11:00:00" / "14:30" → "11:00 AM" / "2:30 PM" (other text passes through).
export const clockLabel = (value) => {
  const m = String(value || '').match(/^(\d{1,2}):(\d{2})/);
  if (!m) return value || '';
  const h = Number(m[1]);
  return `${h % 12 || 12}:${m[2]} ${h >= 12 ? 'PM' : 'AM'}`;
};
