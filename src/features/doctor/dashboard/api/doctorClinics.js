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

const errorText = (err) => {
  const data = err?.response?.data;
  if (typeof data === 'string') return data;
  return data?.message || data?.error || err?.message || '';
};

// photo: { uri, type, fileName } from an image picker (optional).
// Resolves to the new clinic (or null) with `photoSkipped: true` when the
// server refused the photo and the clinic was saved without it.
export const createClinic = async (doctorId, { name, phone, location, photo }) => {
  const buildFormData = (withPhoto) => {
    const formData = new FormData();
    formData.append('doctor_id', String(doctorId));
    formData.append('clinic_name', name);
    formData.append('phone_number', phone || '');
    formData.append('location', location);
    if (withPhoto && photo?.uri) {
      const type = photo.type || 'image/jpeg';
      formData.append('clinic_photo', {
        uri: photo.uri,
        type,
        name: photo.fileName || `clinic-${Date.now()}.${(type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')}`,
      });
    }
    return formData;
  };
  const post = (formData) => axiosInstance.post('/api/clinics', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    // Send the FormData as-is and allow time for the image upload.
    transformRequest: (data) => data,
    timeout: 60000,
  });

  let response;
  let photoSkipped = false;
  try {
    response = await post(buildFormData(true));
  } catch (err) {
    // A server that doesn't take the `clinic_photo` field answers multer's
    // "Unexpected field": still save the clinic, just without the photo.
    if (!photo?.uri || !/Unexpected (file )?field|LIMIT_UNEXPECTED_FILE/i.test(errorText(err))) throw err;
    console.warn('[clinic-upload] photo refused by server:', err?.response?.status, errorText(err).slice(0, 200));
    response = await post(buildFormData(false));
    photoSkipped = true;
  }
  const created = response.data?.clinic || response.data?.data?.clinic || response.data?.data || response.data;
  if (!created || typeof created !== 'object') return null;
  return { ...normalizeClinic(created), photoSkipped };
};
