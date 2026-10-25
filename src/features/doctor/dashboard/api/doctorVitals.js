import axiosInstance from '../../../../axiosConfig';
import { getAppointmentApiPath, getAppointmentSource } from './doctorAppointments';

// The vitals object a save response echoes back, or null when it did not.
const savedVitalsOf = (data) => {
  let value = data?.vitals ?? data?.appointment?.vitals ?? data?.data?.vitals ?? data?.data?.appointment?.vitals;
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { value = null; }
  }
  return value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length ? value : null;
};

// Doctor records (or corrects) vitals during the consultation. The appointment
// update is tried first — doctors can always PATCH their own appointments —
// then the receptionist's vitals route. A save only counts when the server
// echoes the vitals back, so an ignored field is never reported as saved.
export async function saveDoctorAppointmentVitals(appointment, vitals) {
  const response = await axiosInstance.patch(getAppointmentApiPath(appointment), { vitals });
  const saved = savedVitalsOf(response.data);
  if (response.data?.success !== false && saved) return saved;

  try {
    const id = String(appointment.apiId || appointment.id);
    const staff = await axiosInstance.patch(`/api/staff/appointments/${encodeURIComponent(id)}/vitals`, {
      source: getAppointmentSource(appointment) === 'walkin' ? 'walkin' : 'online',
      vitals,
    });
    const staffSaved = savedVitalsOf(staff.data);
    if (staff.data?.success !== false && staffSaved) return staffSaved;
  } catch (err) {
    if (![403, 404, 405].includes(err?.response?.status)) throw err;
  }
  throw new Error('The server did not save the vitals. Doctor vitals need to be enabled on the backend.');
}
