// Port of the web clinic calls (Calendar.jsx, ClinicAllView/ClinicPage.jsx,
// Setting/ClinicSetting/ClinicUpload.jsx):
//   GET  /api/clinics?doctor_id=<id>&role=doctor
//   POST /api/clinics  multipart { doctor_id, clinic_name, phone_number, location, clinic_photo? }
import axiosInstance from '../../../../axiosConfig';
import { pickFirst } from './doctorAppointments';

export const unwrapApiArray = (payload) => {
  const candidates = [
    payload, payload?.data, payload?.data?.data, payload?.clinics, payload?.ranges, payload?.existingRanges,
    payload?.availability, payload?.availabilities, payload?.availableDates, payload?.data?.clinics,
    payload?.data?.ranges, payload?.data?.existingRanges, payload?.users, payload?.appointments,
    payload?.departments, payload?.data?.users, payload?.data?.appointments, payload?.data?.departments, payload?.results,
  ];
  return candidates.find(Array.isArray) || [];
};

export const normalizeClinic = (clinic, index = 0) => ({
  id: String(pickFirst(clinic._id, clinic.clinic_id, clinic.clinicId, clinic.id, clinic.hospital_id, index)),
  name: pickFirst(clinic.clinic_name, clinic.clinicName, clinic.hospital_name, clinic.hospitalName, clinic.name, 'Unnamed Clinic'),
  location: pickFirst(clinic.location, clinic.address, clinic.clinic_address, clinic.hospital_address, 'Address not available'),
  phone: pickFirst(clinic.phone_number, clinic.phone, clinic.contact_number, ''),
  photo: pickFirst(clinic.clinic_photo?.url, clinic.clinic_photo, clinic.photo?.url, clinic.photo, clinic.image, clinic.logo, ''),
  doctorId: pickFirst(clinic.doctor_id, clinic.doctorId, clinic.doctor?.id, clinic.doctor?._id, ''),
  raw: clinic,
});

export const loadDoctorClinics = async (doctorId, role = 'doctor') => {
  const response = await axiosInstance.get('/api/clinics', { params: { doctor_id: doctorId, role } });
  return unwrapApiArray(response.data)
    .map(normalizeClinic)
    .filter((clinic) => !clinic.doctorId || String(clinic.doctorId) === String(doctorId));
};

// photo: { uri, type, fileName } from an image picker (optional).
export const createClinic = async (doctorId, { name, phone, location, photo }) => {
  const formData = new FormData();
  formData.append('doctor_id', String(doctorId));
  formData.append('clinic_name', name);
  formData.append('phone_number', phone || '');
  formData.append('location', location);
  if (photo?.uri) {
    formData.append('clinic_photo', {
      uri: photo.uri,
      type: photo.type || 'image/jpeg',
      name: photo.fileName || `clinic-${Date.now()}.jpg`,
    });
  }
  const response = await axiosInstance.post('/api/clinics', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  const created = response.data?.clinic || response.data?.data?.clinic || response.data?.data || response.data;
  return created && typeof created === 'object' ? normalizeClinic(created) : null;
};
