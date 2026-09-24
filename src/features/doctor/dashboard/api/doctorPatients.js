// Port of the web "Patient Details" data layer
// (PatientAppointmentDetails/PatientDetailsPage.jsx): patients and their visit
// records are built from GET /api/appointments?doctor_id=<id>.
import axiosInstance from '../../../../axiosConfig';
import { getStoredDoctorUser, pickFirst } from './doctorAppointments';

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

const getPatient = (a) => a.patient || a.patient_data || a.user || {};
const getPatientId = (a) => {
  const p = getPatient(a);
  return pickFirst(a.patient_id, a.patientId, p.id, p._id, p.user_id, a.id);
};
const getProblem = (a) => pickFirst(
  a.problem, a.symptoms, a.reason, a.issue, a.health_issue, a.healthIssue, a.description, a.consultation_reason,
  'General consultation',
);

const parseMedicines = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const formatMedicines = (a) => {
  if (a.medicine && String(a.medicine).trim()) return String(a.medicine).trim();
  const medicines = parseMedicines(a.medicines);
  if (!medicines.length) return pickFirst(a.tablets, a.medication, 'N/A');
  return medicines.map((m) => {
    const timing = Array.isArray(m.timings) && m.timings.length ? m.timings.join(', ') : 'Timing not specified';
    const duration = m.durationValue ? ` - ${m.durationValue} ${m.durationType || 'days'}` : '';
    return `${m.name || 'Medicine'}${m.dosage ? ` - ${m.dosage}` : ''} (${timing})${duration}`;
  }).join('\n');
};

const getMedicineDuration = (a) => {
  const durations = parseMedicines(a.medicines)
    .filter((m) => m.durationValue)
    .map((m) => `${m.durationValue} ${m.durationType || 'Days'}`);
  return durations.length ? durations.join(', ') : pickFirst(a.days, a.duration, 'N/A');
};

const hasFollowUp = (a) => {
  const v = pickFirst(a.follow_up_required, a.followUpRequired);
  return v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'true' || Boolean(a.follow_up_date || a.followUpDate);
};

const normalizeRecord = (a, doctorName) => {
  const createdAt = pickFirst(a.appointment_date, a.date, a.created_at, a.createdAt);
  return {
    id: pickFirst(a.id, a._id),
    sortKey: new Date(createdAt || 0).getTime() || 0,
    date: formatDate(createdAt),
    time: formatTime(pickFirst(a.appointment_time, a.time, createdAt)),
    bp: pickFirst(a.bp, a.blood_pressure, 'N/A'),
    pulse: pickFirst(a.pulse, a.heart_rate, a.heartRate, 'N/A'),
    temperature: pickFirst(a.temperature, 'N/A'),
    problem: getProblem(a),
    diagnosis: pickFirst(a.diagnosis, 'N/A'),
    tablets: formatMedicines(a),
    days: getMedicineDuration(a),
    doctor: pickFirst(a.doctor_name, a.doctor?.name, a.doctor?.fullName, doctorName, 'Doctor'),
    prescription: pickFirst(a.prescription, a.advice, a.additional_notes, a.additionalNotes, a.notes, 'N/A'),
    followUp: hasFollowUp(a) ? formatDate(pickFirst(a.follow_up_date, a.followUpDate, a.follow_up, a.followUp)) : 'Not required',
    status: String(pickFirst(a.appointment_status, a.status, '')).toLowerCase(),
  };
};

const buildPatients = (appointments, doctorName) => {
  const byPatient = new Map();
  appointments.forEach((a) => {
    const p = getPatient(a);
    const patientId = String(getPatientId(a));
    const record = normalizeRecord(a, doctorName);
    const existing = byPatient.get(patientId) || {
      id: patientId,
      name: pickFirst(p.full_name, p.fullname, p.fullName, p.name, a.patient_name, a.name, 'Unknown Patient'),
      age: pickFirst(p.age, a.patient_age, a.age, 'N/A'),
      gender: pickFirst(p.patient_gender, p.gender, a.patient_gender, a.gender, 'N/A'),
      phone: pickFirst(p.patient_phone, p.phone, p.phoneNumber, a.patient_phone, a.phone_number, 'N/A'),
      bloodGroup: pickFirst(p.patient_blood_group, p.blood_group, p.bloodGroup, a.patient_blood_group, 'N/A'),
      records: [],
    };
    existing.records.push(record);
    existing.records.sort((x, y) => y.sortKey - x.sortKey);
    existing.lastVisit = existing.records[0]?.date || record.date;
    existing.lastVisitKey = existing.records[0]?.sortKey || 0;
    byPatient.set(patientId, existing);
  });
  return Array.from(byPatient.values());
};

export async function loadDoctorPatients() {
  const user = await getStoredDoctorUser();
  const doctorId = pickFirst(user?.doctor_id, user?.doctorId, user?.id, user?._id, user?.user_id, user?.userId);
  if (!doctorId) throw new Error('Doctor ID not found. Please login again.');
  const doctorName = pickFirst(user?.full_name, user?.fullName, user?.name);
  const response = await axiosInstance.get('/api/appointments', { params: { doctor_id: doctorId } });
  const appointments = unwrapApiArray(response.data).filter((a) => {
    const aDoctorId = pickFirst(a.doctor_id, a.doctorId, a.doctor?.id, a.doctor?._id);
    return !aDoctorId || String(aDoctorId) === String(doctorId);
  });
  return buildPatients(appointments, doctorName);
}
