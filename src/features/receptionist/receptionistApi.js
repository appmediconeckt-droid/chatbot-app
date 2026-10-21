// Receptionist portal — same endpoints as the web portal
// (chatbot/src/Component/Receptionist + StaffDashboard):
//   GET   /api/auth/me                              the receptionist's account
//   GET   /api/staff/receptionist/dashboard         today's queue, summary, doctor, clinics
//   GET   /api/staff/appointments                   all appointments (filters + paging)
//   PATCH /api/appointments/:id/cancel              receptionist cancels a booking
//   GET   /api/staff/patient-history                completed visits + prescriptions
//   GET   /api/qr/doctors/:doctorId/clinics         the doctor's clinic LED displays
//   GET   /api/qr/walkin/:doctorClinicId/queue      what an LED display shows
//   POST  /api/auth/changePassword                  update the sign-in password
//   PATCH /api/auth/update/:id                      edit own name / phone / photo
import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosInstance, { API_BASE_URL, TUNNEL_HEADERS } from '../../axiosConfig';
import { appointmentStatuses, dedupeRows, indiaToday, isOrphanedBooking, normalizeReceptionistAppointment } from './receptionistUtils';

// Normalised rows minus bookings orphaned by a deleted patient account.
const liveRows = (rows) => (rows || []).filter((row) => !isOrphanedBooking(row)).map(normalizeReceptionistAppointment);

export const fetchMe = async () => {
  const { data } = await axiosInstance.get('/api/auth/me');
  return data?.user || data?.data?.user || data;
};

// The receptionist edits their own name / phone / photo with the same request
// every other role uses: PATCH /api/auth/update/:id as multipart (fetch, like
// DoctorEditProfileScreen — the photo goes up as a file part).
export const updateMyProfile = async (profile, { fullName, phoneNumber, photo }) => {
  const userId = profile?._id || profile?.id || (await AsyncStorage.getItem('userId'));
  const accessToken = (await AsyncStorage.getItem('accessToken')) || (await AsyncStorage.getItem('token'));
  if (!userId || !accessToken) throw new Error('Your session is incomplete. Please sign in again.');
  const form = new FormData();
  form.append('fullName', fullName);
  const digits = String(phoneNumber || '').replace(/\D/g, '');
  if (digits) {
    form.append('phoneNumber', digits);
    form.append('phoneNum', digits);
  }
  if (photo?.uri) {
    form.append('profilePhoto', { uri: photo.uri, type: photo.type || 'image/jpeg', name: photo.fileName || `profile-${Date.now()}.jpg` });
  }
  const response = await fetch(`${API_BASE_URL}/api/auth/update/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: { ...TUNNEL_HEADERS, Authorization: `Bearer ${accessToken}` },
    body: form,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.success === false) throw new Error(data?.message || data?.error || 'Profile could not be updated. Please try again.');
  return data?.user || data?.data?.user || data?.data || {};
};

export const fetchReceptionistDashboard = async ({ date, clinicId }) => {
  const { data } = await axiosInstance.get('/api/staff/receptionist/dashboard', {
    params: { date, clinic_id: clinicId || '' },
    timeout: 15000,
  });
  return {
    ...data,
    appointments: liveRows(data.appointments),
    currentPatients: liveRows(data.currentPatients),
    waiting: liveRows(data.waiting),
  };
};

// Collect the complete matching result before removing deleted accounts or
// duplicates. Subtracting only the current page's removed rows from the server
// total makes the number of pages change as the user navigates.
export const fetchStaffAppointments = async (params = {}) => {
  const today = indiaToday();
  const from = params.from && params.from > today ? params.from : today;
  if (params.to && params.to < from) {
    return { appointments: [], total: 0, completed: 0, clinics: [] };
  }
  const limit = 10;
  const query = { ...params, from, page: 1, limit };
  const { data } = await axiosInstance.get('/api/staff/appointments', { params: query, timeout: 15000 });
  const rows = [...(data.appointments || [])];
  const total = Math.max(rows.length, Number(data.total) || 0);
  for (let page = 2; page <= Math.ceil(total / limit); page += 1) {
    const response = await axiosInstance.get('/api/staff/appointments', {
      params: { ...query, page }, timeout: 15000,
    });
    rows.push(...(response.data.appointments || []));
  }
  // Enforce the calendar-day cutoff locally too, in case the API ignores from.
  // Keep all of today's appointments, even after their individual slot time.
  const appointments = dedupeRows(liveRows(rows)).filter((row) => {
    const date = String(row.date || '').slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= from
      && (!params.to || date <= params.to);
  });
  return {
    ...data,
    appointments,
    total: appointments.length,
    completed: appointments.filter((row) => appointmentStatuses(row).includes('completed')).length,
  };
};

export const cancelStaffAppointment = (row) =>
  axiosInstance.patch(`/api/appointments/${encodeURIComponent(row.id)}/cancel`, { source: row.source || 'online' });

export const saveStaffAppointmentVitals = async (row, vitals) => {
  const response = await axiosInstance.patch(`/api/staff/appointments/${encodeURIComponent(row.id)}/vitals`, {
    source: row.source || 'online',
    vitals,
  });
  const saved = response.data?.vitals;
  if (response.data?.success === false || !saved || typeof saved !== 'object'
      || Array.isArray(saved) || !Object.keys(saved).length) {
    throw new Error('The server did not confirm saved vitals. Please try again.');
  }
  return response;
};

export const fetchPatientHistory = async (params) => {
  const { data } = await axiosInstance.get('/api/staff/patient-history', { params, timeout: 15000 });
  return data;
};

export const fetchDoctorDisplays = async (doctorId) => {
  const { data } = await axiosInstance.get(`/api/qr/doctors/${encodeURIComponent(doctorId)}/clinics`);
  return data?.data?.clinics || [];
};

export const fetchDisplayQueue = async (doctorClinicId) => {
  const { data } = await axiosInstance.get(`/api/qr/walkin/${encodeURIComponent(doctorClinicId)}/queue`);
  return data;
};

export const changePassword = (oldPassword, newPassword) =>
  axiosInstance.post('/api/auth/changePassword', { oldPassword, newPassword }, { timeout: 15000 });

export const apiError = (err, fallback) =>
  err?.response?.data?.message || err?.response?.data?.error || fallback;
