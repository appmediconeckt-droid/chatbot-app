import axios from '../axiosConfig';
import { getAppointmentVitals, hasReceptionistVitals } from '../utils/appointmentVitals';

const list = payload => {
  if (Array.isArray(payload)) return payload;
  for (const key of ['appointments', 'data', 'results']) {
    if (payload?.[key]) return list(payload[key]);
  }
  return [];
};

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
