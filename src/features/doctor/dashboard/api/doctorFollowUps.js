// Port of the web Follow-Up/FollowUp.jsx data layer — same endpoints,
// params and payloads:
//   GET    /api/appointments?doctor_id=<id>   (patients to pick from)
//   GET    /api/followups?doctor_id=<id>
//   POST   /api/followups
//   PUT    /api/followups/:id
//   DELETE /api/followups/:id  { doctor_id }
import axiosInstance from '../../../../axiosConfig';
import { formatLocalDateKey, getDoctorIdFromUser, getStoredDoctorUser, normalizeApiList, pickFirst } from './doctorAppointments';

const getPatient = (record) => record?.patient || record?.patient_details || {};
const getDoctor = (record) => record?.doctor || record?.doctor_details || {};
const getPatientId = (record) => {
  const patient = getPatient(record);
  return pickFirst(record?.patient_id, record?.patientId, patient.id, patient._id, '');
};
const getDoctorIdOf = (record) => {
  const doctor = getDoctor(record);
  return pickFirst(record?.doctor_id, record?.doctorId, doctor.id, doctor._id);
};

export const normalizeFollowUpStatus = (value) => {
  const v = String(value || 'pending').toLowerCase();
  if (v === 'completed' || v === 'complete') return 'completed';
  if (v === 'scheduled' || v === 'booked') return 'scheduled';
  return 'pending';
};

export const normalizeFollowUpType = (value) => {
  const v = String(value || 'routine').toLowerCase();
  if (v === 'urgent') return 'urgent';
  if (v === 'consultation') return 'consultation';
  return 'routine';
};

// YYYY-MM-DD from any date string (web normalizeDateInput).
export const normalizeDateInput = (value) => {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return String(value);
  return formatLocalDateKey(value);
};

export const getCurrentDoctor = async () => {
  const user = await getStoredDoctorUser();
  return {
    id: pickFirst(user?.doctor_id, user?.doctorId, getDoctorIdFromUser(user)),
    name: pickFirst(user?.name, user?.full_name, user?.fullName, 'Doctor'),
  };
};

const buildAppointmentPatients = (appointments) => {
  const map = new Map();
  appointments.forEach((appointment) => {
    const patient = getPatient(appointment);
    const patientId = getPatientId(appointment);
    if (!patientId) return;
    const appointmentDate = pickFirst(appointment.appointment_date, appointment.date, appointment.created_at, '');
    const record = {
      id: patientId,
      appointmentId: pickFirst(appointment.id, appointment.appointment_id, appointment._id, ''),
      name: pickFirst(appointment.patient_name, patient.name, patient.full_name, patient.fullName, patient.patient_name, 'Unnamed Patient'),
      age: pickFirst(appointment.age, patient.age, 'N/A'),
      gender: pickFirst(appointment.gender, patient.gender),
      phone: pickFirst(appointment.phone_number, appointment.phone, patient.phone_number, patient.phone, patient.mobile, 'N/A'),
      lastVisit: appointmentDate,
      issue: pickFirst(appointment.symptoms, appointment.health_issue, appointment.problem, appointment.reason, appointment.notes, 'N/A'),
    };
    const existing = map.get(String(patientId));
    if (!existing || new Date(appointmentDate) > new Date(existing.lastVisit || 0)) map.set(String(patientId), record);
  });
  return Array.from(map.values());
};

export const loadAppointmentPatients = async (doctorId) => {
  const response = await axiosInstance.get('/api/appointments', { params: { doctor_id: doctorId } });
  const appointments = normalizeApiList(response.data).filter((apt) => {
    const aptDoctorId = getDoctorIdOf(apt);
    return !aptDoctorId || String(aptDoctorId) === String(doctorId);
  });
  return buildAppointmentPatients(appointments);
};

export const normalizeFollowUp = (followUp, index, appointmentPatients = [], doctorName = 'Doctor') => {
  const patient = getPatient(followUp);
  const doctor = getDoctor(followUp);
  const patientId = getPatientId(followUp);
  const matched = appointmentPatients.find((item) => String(item.id) === String(patientId));
  return {
    id: pickFirst(followUp.id, followUp.followup_id, followUp.follow_up_id, followUp._id, index),
    doctorId: getDoctorIdOf(followUp),
    patientId,
    appointmentId: pickFirst(followUp.appointment_id, followUp.appointmentId, ''),
    name: pickFirst(followUp.patient_name, patient.name, patient.full_name, patient.fullName, matched?.name, 'N/A'),
    age: pickFirst(followUp.age, patient.age, matched?.age, 'N/A'),
    gender: pickFirst(followUp.gender, patient.gender, matched?.gender),
    phone: pickFirst(followUp.phone_number, followUp.phone, patient.phone_number, patient.phone, matched?.phone, 'N/A'),
    lastVisit: pickFirst(followUp.last_visit, followUp.lastVisit, matched?.lastVisit, followUp.created_at),
    followUpDate: pickFirst(followUp.follow_up_date, followUp.followUpDate, followUp.date),
    followUpTime: pickFirst(followUp.followup_time, followUp.follow_up_time, followUp.followUpTime, followUp.time, ''),
    followUpStatus: normalizeFollowUpStatus(pickFirst(followUp.status, followUp.followup_status, followUp.followUpStatus)),
    followUpType: normalizeFollowUpType(pickFirst(followUp.follow_up_type, followUp.type, followUp.followup_type, followUp.followUpType)),
    notes: pickFirst(followUp.notes, followUp.reason, followUp.description, matched?.issue, 'N/A'),
    doctor: pickFirst(followUp.doctor_name, doctor.name, doctor.full_name, doctorName),
  };
};

// normalizeApiList gathers rows from every collection key in the payload
// (data / followups / results ...). When the backend returns the same list
// under several keys, each follow-up came back once per key — one saved
// follow-up showed up 3 times. Keep one row per server id (or, for rows with
// no id, per patient + appointment + date + time).
const dedupeFollowUps = (rows) => {
  const seen = new Set();
  return rows.filter((row) => {
    const serverId = pickFirst(row.id, row.followup_id, row.follow_up_id, row._id);
    const key = serverId !== undefined
      ? `id:${serverId}`
      : ['row', getPatientId(row), pickFirst(row.appointment_id, row.appointmentId, ''),
        pickFirst(row.follow_up_date, row.followUpDate, row.date, ''),
        pickFirst(row.followup_time, row.follow_up_time, row.followUpTime, row.time, '')].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const loadFollowUpsForDoctor = async (doctorId, appointmentPatients, doctorName) => {
  const response = await axiosInstance.get('/api/followups', { params: { doctor_id: doctorId } });
  return dedupeFollowUps(normalizeApiList(response.data))
    .map((row, index) => normalizeFollowUp(row, index, appointmentPatients, doctorName))
    .filter((fu) => !fu.doctorId || String(fu.doctorId) === String(doctorId));
};

export const createFollowUp = (doctorId, form, selectedPatient) => axiosInstance.post('/api/followups', {
  doctor_id: doctorId,
  patient_id: form.patientId,
  appointment_id: form.appointmentId || selectedPatient?.appointmentId || undefined,
  follow_up_date: form.followUpDate,
  follow_up_time: form.followUpTime || undefined,
  follow_up_type: form.followUpType,
  type: form.followUpType,
  status: 'pending',
  reason: form.notes || selectedPatient?.issue || '',
  notes: form.notes || selectedPatient?.issue || '',
});

// Full-record PUT, as the web sends for both status changes and edits.
export const updateFollowUp = (doctorId, followUp, changes = {}) => {
  const next = { ...followUp, ...changes };
  return axiosInstance.put(`/api/followups/${followUp.id}`, {
    doctor_id: doctorId,
    patient_id: next.patientId,
    appointment_id: next.appointmentId || undefined,
    follow_up_date: normalizeDateInput(next.followUpDate),
    follow_up_time: next.followUpTime || undefined,
    follow_up_type: next.followUpType,
    type: next.followUpType,
    status: next.followUpStatus,
    notes: next.notes,
  });
};

export const deleteFollowUp = (doctorId, id) =>
  axiosInstance.delete(`/api/followups/${id}`, { data: { doctor_id: doctorId } });

export const apiErrorMessage = (err, fallback) =>
  err?.response?.data?.message || err?.response?.data?.error || err?.message || fallback;
