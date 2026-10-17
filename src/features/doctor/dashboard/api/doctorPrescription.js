import axiosInstance from '../../../../axiosConfig';
import { appointmentToDocument } from '../../../../utils/consultationPrescriptionDocument';
import { getAppointmentSource, loadAppointmentPrescription } from './doctorAppointments';

// Queue cards and patient history must print the same saved consultation.
// Fetch the current profile too: signatures can be updated after booking.
export async function loadDoctorPrescriptionDocument(appointment) {
  const [record, account] = await Promise.all([
    loadAppointmentPrescription(appointment),
    axiosInstance.get('/api/auth/me', { timeout: 15000 }),
  ]);
  const doctor = account.data?.user || account.data?.data?.user;
  if (!doctor || !(doctor._id || doctor.id)) throw new Error('Doctor profile could not be loaded. Please retry.');
  const raw = record.__raw || record;
  const clinicValue = raw.clinic_id || raw.clinicId || appointment.__raw?.clinic_id;
  const clinicId = typeof clinicValue === 'object' ? clinicValue?._id || clinicValue?.id : clinicValue;
  let clinic = raw.clinic || null;
  if (clinicId) {
    const response = await axiosInstance.get(`/api/clinics/${encodeURIComponent(String(clinicId))}`, { timeout: 15000 });
    clinic = response.data?.clinic || response.data?.data?.clinic;
    if (!clinic) throw new Error('Clinic details could not be loaded. Please retry.');
    const owner = clinic.doctor_id?._id || clinic.doctor_id?.id || clinic.doctor_id;
    if (String(owner) !== String(doctor._id || doctor.id)) throw new Error('The appointment clinic does not belong to this doctor.');
  }
  const apiId = raw._id || raw.id || record.apiId || appointment.apiId;
  return appointmentToDocument({
    ...raw,
    // Normalized queue ids (online-123 / walkin-123) are UI keys, never Rx numbers.
    prescriptionNumber: raw.prescriptionNumber || `appointment:${apiId}`,
    doctorProfile: doctor,
    clinic,
    source: 'appointment',
    verificationStatus: ['completed', 'complete'].includes(String(record.status).toLowerCase()) ? 'completed' : raw.verificationStatus,
    patient: raw.patient || raw.patientSnapshot || { name: record.name, gender: record.gender, id: record.patientId, phone: record.phone },
    issue: raw.issue || raw.problem || record.issue,
    __appointmentSource: getAppointmentSource(appointment),
  }, doctor.fullName || doctor.name);
}
