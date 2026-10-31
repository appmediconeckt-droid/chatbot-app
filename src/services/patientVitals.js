import axios from '../axiosConfig';
import { getAppointmentVitals, hasReceptionistVitals } from '../utils/appointmentVitals';

const list = payload => {
  if (Array.isArray(payload)) return payload;
  for (const key of ['appointments', 'data', 'results']) {
    if (payload?.[key]) return list(payload[key]);
  }
  return [];
};

// The blood group clinic staff (doctor or receptionist) last recorded in this
// patient's vitals, or '' when none was. The patient can only see it.
export async function fetchRecordedBloodGroup() {
  const { data } = await axios.get('/api/appointments');
  const recorded = list(data)
    .map(appointment => getAppointmentVitals(appointment))
    .filter(vitals => vitals.blood_group)
    .sort((a, b) => (Date.parse(b.recorded_at) || 0) - (Date.parse(a.recorded_at) || 0));
  return recorded[0]?.blood_group || '';
}

export async function fetchPatientVitals() {
  // This authenticated endpoint is already scoped to the signed-in patient.
  const { data } = await axios.get('/api/appointments');
  if (data?.success === false) throw new Error(data.message || 'Vitals could not be loaded.');
  return list(data).filter(hasReceptionistVitals).map(appointment => ({
    ...appointment,
    vitals: getAppointmentVitals(appointment),
  })).sort((a, b) => (
    (Date.parse(b.vitals.recorded_at || b.appointment_date || b.date) || 0)
    - (Date.parse(a.vitals.recorded_at || a.appointment_date || a.date) || 0)
  ));
}
