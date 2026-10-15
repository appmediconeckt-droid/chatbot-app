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
import axiosInstance from '../../axiosConfig';

export const fetchMe = async () => {
  const { data } = await axiosInstance.get('/api/auth/me');
  return data?.user || data?.data?.user || data;
};

export const fetchReceptionistDashboard = async ({ date, clinicId }) => {
  const { data } = await axiosInstance.get('/api/staff/receptionist/dashboard', {
    params: { date, clinic_id: clinicId || '' },
    timeout: 15000,
  });
  return data;
};

export const fetchStaffAppointments = async (params) => {
  const { data } = await axiosInstance.get('/api/staff/appointments', { params, timeout: 15000 });
  return data;
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
