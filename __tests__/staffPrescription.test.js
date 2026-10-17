import React from 'react';
import { act, create } from 'react-test-renderer';
import api from '../src/axiosConfig';
import PatientsSection from '../src/features/receptionist/sections/PatientsSection';
import { RecButton } from '../src/features/receptionist/receptionistUi';
import { downloadConsultationPrescriptionPdf } from '../src/features/doctor/dashboard/utils/consultationPrescriptionPdf';

jest.mock('react-native', () => {
  const ReactMock = require('react');
  const TextInput = ReactMock.forwardRef((props, ref) => {
    const nativeInput = ReactMock.useRef({ focus: jest.fn() });
    ReactMock.useImperativeHandle(ref, () => nativeInput.current, []);
    return ReactMock.createElement('TextInput', { ...props, nativeInput: nativeInput.current });
  });
  return {
  View: 'View', Text: 'Text', TextInput, Pressable: 'Pressable',
  ScrollView: 'ScrollView', Modal: 'Modal', Image: 'Image', ActivityIndicator: 'ActivityIndicator',
  StyleSheet: { create: value => value }, Keyboard: { dismiss: jest.fn() },
  useWindowDimensions: () => ({ width: 390, height: 844, scale: 1, fontScale: 1 }),
  Platform: { OS: 'android' }, Alert: { alert: jest.fn() },
  };
});
jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../src/components/TranslatedText', () => 'Text');
jest.mock('../src/hooks/useKeyboardAwareScroll', () => ({
  __esModule: true, default: () => ({ scrollRef: { current: null }, frameInset: 0 }),
}));
jest.mock('../src/axiosConfig', () => ({
  __esModule: true, API_BASE_URL: 'https://example.test', default: { get: jest.fn(), patch: jest.fn() },
}));


jest.mock('react-native-linear-gradient', () => 'Gradient');
jest.mock('../src/features/doctor/dashboard/utils/consultationPrescriptionPdf', () => ({ downloadConsultationPrescriptionPdf: jest.fn() }));

const testDetails = { testName: 'CBC', completeBy: '2026-10-20', reason: 'Recorded reason', instructions: 'Fasting' };
const record = {
  id: 'visit-1', source: 'online', checkedDate: '2026-10-16', token: 4, hasPrescription: true,
  patient: { id: 'patient-1', name: 'Test patient', age: 42, phoneNumber: '1234567890', gender: 'Female' },
  doctor: { fullName: 'Dr. Staff' },
  prescription: {
    id: 'rx-1', doctorProfile: { fullName: 'Dr. Staff', qualification: 'MBBS', registrationNumber: 'REG-1' },
    medicines: [{ name: 'Medicine', strength: '500 mg', dosage: '1 tablet', instructions: 'After food' }],
    recommendedTests: JSON.stringify([testDetails]), diagnosis: 'Recorded diagnosis', additionalNotes: 'Recorded notes',
    source: 'appointment', verificationStatus: 'completed', prescriptionSignatureUrl: '/signature.png',
  },
};
let root;
const json = () => JSON.stringify(root.toJSON());
const pressAccessible = async prefix => {
  const button = root.root.findAllByType('Pressable').find(node => node.props.accessibilityLabel?.startsWith(prefix));
  if (!button) throw new Error(`Button missing: ${prefix}`);
  await act(async () => { await button.props.onPress(); });
};
const response = row => ({ data: { records: [row], total: 1, clinics: [], doctor: record.doctor, summary: { patients: 1, visits: 1, prescriptions: 1 } } });
beforeEach(() => { jest.clearAllMocks(); api.get.mockResolvedValue(response(record)); });
afterEach(async () => { if (root) await act(async () => root.unmount()); root = null; });

it('staff opens fresh prescription details and downloads all clinical/test fields displayed', async () => {
  await act(async () => { root = create(<PatientsSection />); });
  await pressAccessible('View visits for Test patient');
  api.get.mockResolvedValue(response({ ...record, prescription: { ...record.prescription, diagnosis: 'Updated diagnosis' } }));
  await pressAccessible('View Online visit');
  expect(api.get).toHaveBeenCalledTimes(2);
  ['Updated diagnosis', 'Patient ID', 'patient-1', 'Contact No.', '1234567890', '42 years', 'MBBS', 'REG-1', '500 mg', 'After food', 'CBC', 'Recorded reason', 'Fasting', 'Recorded notes', 'Doctor signature'].forEach(value => expect(json()).toContain(value));
  const download = root.root.findAllByType(RecButton).find(node => node.props.label === 'Download PDF');
  await act(async () => { await download.props.onPress(); });
  expect(downloadConsultationPrescriptionPdf).toHaveBeenCalledWith(expect.objectContaining({
    patientId: 'patient-1', patient: 'Test patient', age: '42', opd: '4', doctor: 'Dr. Staff',
    diagnosis: 'Updated diagnosis', tests: [testDetails], medicines: record.prescription.medicines,
    signature: 'https://example.test/signature.png',
  }));
});

it('keeps the visit list open with an error if refreshed prescription retrieval fails', async () => {
  await act(async () => { root = create(<PatientsSection />); });
  await pressAccessible('View visits for Test patient');
  api.get.mockRejectedValue(new Error('Connection failed'));
  await pressAccessible('View Online visit');
  expect(json()).toContain('Connection failed');
  expect(root.root.findAllByType(RecButton).some(node => node.props.label === 'Download PDF')).toBe(false);
});


it('does not reopen a prescription after staff closes its pending request', async () => {
  await act(async () => { root = create(<PatientsSection />); });
  await pressAccessible('View visits for Test patient');
  let resolve;
  api.get.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  let opening;
  const visit = root.root.findAllByType('Pressable').find(node => node.props.accessibilityLabel?.startsWith('View Online visit'));
  await act(async () => { opening = visit.props.onPress(); });
  const modal = root.root.findAllByType('Modal').slice(-1)[0];
  await act(async () => { modal.props.onRequestClose(); });
  await act(async () => { resolve(response(record)); await opening; });
  expect(root.root.findAllByType('Modal').slice(-1)[0].props.visible).toBe(false);
});

it('pages distinct patients and clamps the page after a refresh removes patients', async () => {
  const records = Array.from({ length: 21 }, (_, index) => ({
    ...record, id: `visit-${index}`, patient: { id: `patient-${index}`, name: `Patient ${index}` },
  }));
  api.get.mockResolvedValue({ data: { ...response(record).data, records, total: records.length } });
  await act(async () => { root = create(<PatientsSection refreshKey={0} />); });
  const cards = () => root.root.findAllByType('Pressable').filter(node => node.props.accessibilityLabel?.startsWith('View visits for'));
  expect(cards()).toHaveLength(10);
  await pressAccessible('Go to page 3');
  expect(cards()).toHaveLength(1);
  expect(cards()[0].props.accessibilityLabel).toContain('Patient 20');
  // Local patient pagination keeps all visits grouped without another API call.
  expect(api.get).toHaveBeenCalledTimes(1);
  api.get.mockResolvedValue(response(record));
  await act(async () => { root.update(<PatientsSection refreshKey={1} />); });
  expect(cards()).toHaveLength(1);
  expect(cards()[0].props.accessibilityLabel).toContain('Test patient');
  expect(root.root.findAllByType('Pressable').find(node => node.props.accessibilityLabel === 'Next page').props.disabled).toBe(true);
});

it('keeps pagination visible with both navigation buttons disabled for an empty result', async () => {
  api.get.mockResolvedValue({ data: { ...response(record).data, records: [], total: 0 } });
  await act(async () => { root = create(<PatientsSection />); });
  for (const label of ['Previous page', 'Next page']) {
    expect(root.root.findAllByType('Pressable').find(node => node.props.accessibilityLabel === label).props.disabled).toBe(true);
  }
});
