// Port of the web "Patient Details" data layer
// (PatientAppointmentDetails/PatientDetailsPage.jsx + patientRecordDetails.js):
// patients and their visit records are built from BOTH
//   GET /api/appointments?doctor_id=<id>
//   GET /api/walkin-appointments?doctor_id=<id>
// with the same field mapping as the web, so the app shows the same patients
// and details.
import axiosInstance from '../../../../axiosConfig';
import { getStoredDoctorUser, pickFirst } from './doctorAppointments';
import {
  getDoctorMedicines,
  getDoctorTests,
  unpackConsultationNotes,
} from '../../../../utils/consultationDetails';
import { isPatientAccountDeleted } from '../../../../utils/deletedAccount';
import { parseEmergencySymptoms, stripEmergencyTag } from '../../../../utils/emergencyTag';
import { getAppointmentVitals } from '../../../../utils/appointmentVitals';

const unwrapApiArray = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.appointments)) return payload.appointments;
  return [];
};

const formatDate = (value) => {
  if (!value) return 'N/A';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatTime = (value) => {
  if (!value) return 'N/A';
  if (/^\d{1,2}:\d{2}/.test(String(value))) {
    const [h, m] = String(value).split(':').map(Number);
    return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const asObject = (value) => (value && typeof value === 'object' ? value : {});

// Same as web patientCardDetails: patient info can sit in any of these, and
// `patient_id` is sometimes the populated patient object, not an id.
const getPatient = (a) => ({
  ...asObject(a.user), ...asObject(a.patient_data), ...asObject(a.patient_details),
  ...asObject(a.patient_id), ...asObject(a.patient),
});
// The patient's account id — never the appointment's own id. Walk-ins have
// no account, and falling back to the booking id made every walk-in visit a
// separate "patient".
const getPatientAccountId = (a) => {
  const p = getPatient(a);
  // Never fall back to an object: String({}) is "[object Object]", which used
  // to merge every patient with a populated patient_id into one.
  return pickFirst(
    p.id, p._id, p.user_id,
    typeof a.patient_id === 'string' || typeof a.patient_id === 'number' ? a.patient_id : undefined,
    a.patientId, typeof a.patient === 'string' ? a.patient : undefined,
  );
};

// Same person without an account id: same phone number (last 10 digits) and
// same name. The name is part of it so family members sharing one phone stay
// separate.
const getPhoneIdentity = (details) => {
  const digits = String(details.phone || '').replace(/\D/g, '').slice(-10);
  const name = String(details.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (digits.length < 10 || !name || name === 'unknown patient') return null;
  return `${digits}|${name}`;
};

const ageFromBirthDate = (value, today = new Date()) => {
  if (!value) return undefined;
  const birth = new Date(value);
  if (!Number.isFinite(birth.getTime()) || birth > today) return undefined;
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  if (today.getUTCMonth() < birth.getUTCMonth()
    || (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age;
};

const patientDetails = (a) => {
  const p = getPatient(a);
  return {
    name: pickFirst(p.fullName, p.full_name, p.fullname, p.name, a.patient_name, 'Unknown Patient'),
    age: pickFirst(
      ageFromBirthDate(p.dateOfBirth || p.date_of_birth || p.dob || a.date_of_birth || a.dob),
      p.age, a.patient_age, a.age, 'N/A',
    ),
    gender: pickFirst(p.gender, p.patient_gender, a.patient_gender, a.gender, 'N/A'),
    phone: pickFirst(p.phoneNumber, p.phone, p.phone_number, p.mobile, p.patient_phone, a.patient_phone, a.phone_number, a.phoneNumber, a.phone, 'N/A'),
    bloodGroup: pickFirst(p.bloodGroup, p.blood_group, p.patient_blood_group, a.patient_blood_group, a.bloodGroup, a.blood_group, 'N/A'),
  };
};

// Same as web appointmentVitals: vitals may also come as a JSON object/string.
const appointmentVitals = (a) => {
  const vitals = getAppointmentVitals(a);
  return {
    vitals,
    bp: pickFirst(vitals.blood_pressure, 'N/A'),
    pulse: pickFirst(vitals.pulse, 'N/A'),
    temperature: pickFirst(vitals.temperature, 'N/A'),
    temperatureUnit: vitals.temperature_unit,
    spo2: pickFirst(vitals.spo2, 'N/A'),
    respiratoryRate: pickFirst(vitals.respiratory_rate, 'N/A'),
    weight: pickFirst(vitals.weight, 'N/A'),
    height: pickFirst(vitals.height, 'N/A'),
    painScore: pickFirst(vitals.pain_score, 'N/A'),
    notes: pickFirst(vitals.notes, ''),
    recordedAt: pickFirst(vitals.recorded_at, ''),
    recordedRole: pickFirst(vitals.recorded_role, ''),
  };
};

const appointmentDoctorName = (a, doctorName) => {
  const doctor = asObject(a.counselor || a.doctor);
  return pickFirst(doctor.fullName, doctor.full_name, doctor.name, a.doctor_name, doctorName, 'Doctor');
};
const getProblem = (a) => pickFirst(
  a.problem, stripEmergencyTag(a.symptoms), a.reason, a.issue, a.health_issue, a.healthIssue, a.description, a.consultation_reason,
  'General consultation',
);

// One line per medicine, for the PDF fallback and anything that wants text.
const formatMedicines = (a, medicines) => {
  if (!medicines.length) return pickFirst(a.tablets, a.medication, 'N/A');
  return medicines.map((m) => {
    const timing = m.timings.length ? ` (${m.timings.join(', ')})` : '';
    const duration = m.duration ? ` - ${m.duration}` : '';
    return `${m.name}${m.dosage ? ` - ${m.dosage}` : ''}${timing}${duration}`;
  }).join('\n');
};

const getMedicineDuration = (a, medicines) => {
  const durations = [...new Set(medicines.map((m) => m.duration).filter(Boolean))];
  return durations.length ? durations.join(', ') : pickFirst(a.days, a.duration, 'N/A');
};

const text = (value) => (value === undefined || value === null ? '' : String(value).trim());

const hasFollowUp = (a) => {
  const v = pickFirst(a.follow_up_required, a.followUpRequired);
  return v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'true' || Boolean(a.follow_up_date || a.followUpDate);
};

const normalizeRecord = (raw, doctorName) => {
  // The doctor's consultation (medicines, tests, advice, follow-up…) is packed
  // as JSON in `notes` — the patient's Prescriptions screen unpacks it the
  // same way, so both sides show the same visit.
  const a = unpackConsultationNotes(raw);
  const createdAt = pickFirst(a.appointment_date, a.date, a.created_at, a.createdAt);
  const medicines = getDoctorMedicines(a);
  const advice = text(pickFirst(a.advice, a.instructions, a.prescription));
  const priority = text(pickFirst(a.priority, '')).toLowerCase();
  return {
    id: pickFirst(a.id, a._id),
    sortKey: new Date(createdAt || 0).getTime() || 0,
    date: formatDate(createdAt),
    time: formatTime(pickFirst(a.appointment_time, a.time, createdAt)),
    ...appointmentVitals(a),
    problem: getProblem(a),
    diagnosis: pickFirst(text(a.diagnosis), 'N/A'),
    medicines,
    tablets: formatMedicines(a, medicines),
    days: getMedicineDuration(a, medicines),
    tests: getDoctorTests(a),
    advice,
    additionalNotes: text(pickFirst(a.additional_notes, a.additionalNotes)),
    // What the patient wrote when booking (never the packed consultation).
    patientNotes: text(a.notes),
    doctor: appointmentDoctorName(a, doctorName),
    prescription: advice || 'N/A',
    followUp: hasFollowUp(a) ? formatDate(pickFirst(a.follow_up_date, a.followUpDate, a.follow_up, a.followUp)) : 'Not required',
    consultationMode: text(pickFirst(a.consultation_mode, a.consultationMode, a.mode)),
    tokenNumber: text(pickFirst(a.token_number, a.tokenNumber, a.token_no, a.token)),
    isEmergency: priority === 'emergency' || a.is_emergency === true || String(a.is_emergency) === 'true'
      || parseEmergencySymptoms(a.symptoms).isEmergency,
    emergencyReason: text(pickFirst(a.emergency_reason, a.emergencyReason, parseEmergencySymptoms(a.symptoms).reason)),
    status: String(pickFirst(a.appointment_status, a.status, '')).toLowerCase(),
    bookingSource: String(pickFirst(a.booking_source, a.bookingSource, '')).toLowerCase(),
  };
};

const MISSING = ['N/A', 'Unknown Patient', '', undefined, null];

const buildPatients = (appointments, doctorName) => {
  const byPatient = new Map();
  // Account id / phone+name → the patient key they belong to, so a patient's
  // walk-ins and app bookings all land on one card.
  const keyByAccount = new Map();
  const keyByPhone = new Map();
  appointments.forEach((a) => {
    const details = patientDetails(a);
    const accountId = getPatientAccountId(a);
    const accountKey = accountId !== undefined ? String(accountId) : null;
    const phoneKey = getPhoneIdentity(details);
    const patientId = (accountKey && keyByAccount.get(accountKey))
      || (phoneKey && keyByPhone.get(phoneKey))
      || accountKey
      || (phoneKey ? `phone:${phoneKey}` : `visit:${pickFirst(a.id, a._id)}`);
    if (accountKey && !keyByAccount.has(accountKey)) keyByAccount.set(accountKey, patientId);
    if (phoneKey && !keyByPhone.has(phoneKey)) keyByPhone.set(phoneKey, patientId);
    const record = normalizeRecord(a, doctorName);
    const existing = byPatient.get(patientId) || { id: patientId, ...details, records: [] };
    if (accountKey && !existing.accountId) existing.accountId = accountKey;
    // A later visit may carry details an earlier one lacked (web does the same).
    ['name', 'age', 'gender', 'phone', 'bloodGroup'].forEach((field) => {
      if (MISSING.includes(existing[field]) && !MISSING.includes(details[field])) existing[field] = details[field];
    });
    existing.records.push(record);
    existing.records.sort((x, y) => y.sortKey - x.sortKey);
    existing.lastVisit = existing.records[0]?.date || record.date;
    existing.lastVisitKey = existing.records[0]?.sortKey || 0;
    byPatient.set(patientId, existing);
  });
  return Array.from(byPatient.values());
};

// ---- Patients' current account names --------------------------------------
// Online appointments only carry the patient's alias, so a patient who renames
// themselves in their profile would keep showing the old name. Their live
// account is the source of truth:
//   GET /api/auth/users?role=patient → this doctor's patients (id + fullName)
// QR walk-in bookings are left alone: they keep the name entered at booking.

const loadPatientAccounts = async () => {
  const res = await axiosInstance.get('/api/auth/users', { params: { role: 'patient' } });
  const list = res.data?.users || res.data?.data || [];
  return (Array.isArray(list) ? list : [])
    .map((u) => ({ id: String(u?._id || u?.id || ''), fullName: String(u?.fullName || '').trim() }))
    .filter((u) => u.id && u.fullName);
};

export async function loadDoctorPatients() {
  const user = await getStoredDoctorUser();
  const doctorId = pickFirst(user?.doctor_id, user?.doctorId, user?.id, user?._id, user?.user_id, user?.userId);
  if (!doctorId) throw new Error('Doctor ID not found. Please login again.');
  const doctorName = pickFirst(user?.full_name, user?.fullName, user?.name);
  // Online and walk-in visits, like the web. One failing is not fatal.
  const [responses, accountsResult] = await Promise.all([
    Promise.allSettled(['/api/appointments', '/api/walkin-appointments']
      .map((path) => axiosInstance.get(path, { params: { doctor_id: doctorId } }))),
    loadPatientAccounts().catch(() => []),
  ]);
  if (responses.every((r) => r.status === 'rejected')) throw responses[0].reason;
  const belongsToDoctor = (a) => {
    const raw = pickFirst(a.doctor_id, a.doctorId, a.doctor?.id, a.doctor?._id, a.counselor?._id, a.counselor?.id);
    const aDoctorId = raw && typeof raw === 'object' ? pickFirst(raw._id, raw.id) : raw;
    return !aDoctorId || String(aDoctorId) === String(doctorId);
  };
  const online = responses[0].status === 'fulfilled'
    ? unwrapApiArray(responses[0].value.data).filter(belongsToDoctor) : [];
  const walkins = responses[1].status === 'fulfilled'
    ? unwrapApiArray(responses[1].value.data).filter(belongsToDoctor) : [];

  // Visits of deleted patient accounts are not shown (same as the queue).
  const patients = buildPatients([...online, ...walkins].filter((a) => !isPatientAccountDeleted(a)), doctorName);
  // Patients booked through the app show their current account name. QR
  // bookings keep the name given at booking: walk-ins have no account at all,
  // and a patient whose visits are all QR bookings is left as booked.
  const namesById = new Map(accountsResult.map((acc) => [acc.id, acc.fullName]));
  return patients.map((p) => {
    const allQr = p.records.length > 0 && p.records.every((r) => r.bookingSource === 'qr');
    const accountId = p.accountId || p.id;
    return namesById.has(accountId) && !allQr ? { ...p, name: namesById.get(accountId) } : p;
  // A patient with no name left anywhere is a deleted account: don't list it.
  }).filter((p) => p.name && p.name !== 'Unknown Patient');
}
