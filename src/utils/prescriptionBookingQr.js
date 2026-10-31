// The doctor's appointment-booking QR for the prescription letterhead — the
// web's loadPrescriptionBookingQr (GET /api/auth/doctor-qr/:doctorId), one
// request per doctor. Unlike the web, a QR that cannot be loaded does not stop
// the download: the page is printed without it.
import axiosInstance from '../axiosConfig';

const requests = new Map();

const loadBookingQr = (doctorId) => {
  if (!requests.has(doctorId)) {
    const pending = Promise.resolve()
      .then(() => axiosInstance.get(`/api/auth/doctor-qr/${encodeURIComponent(doctorId)}`, { timeout: 15000 }))
      .then((response) => {
        const data = response?.data?.data;
        const qr = data?.profileQrCode || data?.doctorQrCode;
        if (typeof qr !== 'string' || !/^data:image\/png;base64,/i.test(qr)) throw new Error('Booking QR unavailable');
        return qr;
      })
      .catch((error) => { requests.delete(doctorId); throw error; });
    requests.set(doctorId, pending);
  }
  return requests.get(doctorId);
};

// Document data (appointmentToDocument shape) with `bookingQr` filled in.
export const withBookingQr = async (data = {}) => {
  if (data.bookingQr || !data.doctorId) return data;
  try {
    return { ...data, bookingQr: await loadBookingQr(data.doctorId) };
  } catch {
    return data;
  }
};
