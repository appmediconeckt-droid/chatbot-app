import api from '../src/axiosConfig';
import { appointmentToDocument, buildConsultationDocumentHtml, prescriptionNumber } from '../src/utils/consultationPrescriptionDocument';
import { withBookingQr } from '../src/utils/prescriptionBookingQr';

jest.mock('../src/axiosConfig', () => ({ __esModule: true, API_BASE_URL: 'https://example.test', default: { get: jest.fn() } }));

const QR = 'data:image/png;base64,QUJD';

test('prescription number is the short RX-<last six of the record id>', () => {
  expect(prescriptionNumber({ id: 'appointment:6adc1f2e9b8c7d6e5f4a3b2c' })).toBe('RX-4A3B2C');
  expect(prescriptionNumber({ id: 'walkin:0ec8a4b2c1d0e9f8a7b6c5d4' })).toBe('RX-B6C5D4');
  expect(prescriptionNumber({ _id: 'ffffffffffffffffffffffff' })).toBe('RX-FFFFFF');
  expect(prescriptionNumber({ id: 'rx-full', prescriptionNumber: 'RX-SAVED' })).toBe('RX-SAVED');
  expect(prescriptionNumber({ id: 'rx-full' })).toBe('RX-FULL');
  // Never the "appointment" / source prefix, never a long number.
  expect(prescriptionNumber({ id: 'online-6ae43e2bfb146e966c99e208' })).toBe('RX-99E208');
  expect(prescriptionNumber({ id: 'appointment:visit-1' })).toBe('RX-VISIT1');
  expect(prescriptionNumber({ prescriptionNumber: 'RX-A-37FEUXZY3BFCSQM8EUK' })).toBe('RX-QM8EUK');
});

test('the page is the web document: letterhead, patient table, title and booking QR', async () => {
  api.get.mockResolvedValue({ data: { data: { profileQrCode: QR } } });
  const data = appointmentToDocument({
    id: 'appointment:6adc1f2e9b8c7d6e5f4a3b2c', diagnosis: 'Viral fever',
    doctorProfile: { _id: 'doctor-9', fullName: 'Dr. Web' }, patient: { name: 'Vishal' },
  });
  expect(data.doctorId).toBe('doctor-9');
  const html = buildConsultationDocumentHtml(await withBookingQr(data));
  expect(api.get).toHaveBeenCalledWith('/api/auth/doctor-qr/doctor-9', { timeout: 15000 });
  ['class="prescription-export"', 'Consulting doctor', 'Patient name', 'OPD / Token No.', 'RX-4A3B2C',
    'Consultation Prescription', '<strong>Diagnosis: </strong>Viral fever', 'Scan to book', `src="${QR}"`].forEach(value => expect(html).toContain(value));
});

test('a QR that cannot be loaded leaves the page without one', async () => {
  api.get.mockRejectedValue(new Error('offline'));
  const data = appointmentToDocument({ doctorProfile: { _id: 'doctor-offline', fullName: 'Dr. Web' } });
  const loaded = await withBookingQr(data);
  expect(loaded.bookingQr).toBe('');
  expect(buildConsultationDocumentHtml(loaded)).not.toContain('Scan to book');
});
