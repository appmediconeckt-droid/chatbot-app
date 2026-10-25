import React from 'react';
import { act, create } from 'react-test-renderer';
import api from '../src/axiosConfig';
import { appointmentToDocument, doctorRxToDocument, buildConsultationDocumentHtml } from '../src/utils/consultationPrescriptionDocument';
import { formatAppointment, loadAppointmentPrescription } from '../src/features/doctor/dashboard/api/doctorAppointments';
import { loadDoctorPrescriptionDocument } from '../src/features/doctor/dashboard/api/doctorPrescription';
import VisitDetailScreen from '../src/features/doctor/dashboard/components/VisitDetailScreen';
import ConsultationPrescriptionModal from '../src/features/doctor/dashboard/components/ConsultationPrescriptionModal';
import CompleteAppointmentScreen from '../src/features/doctor/dashboard/components/CompleteAppointmentScreen';
import { downloadConsultationPrescriptionPdf } from '../src/features/doctor/dashboard/utils/consultationPrescriptionPdf';

jest.mock('react-native', () => ({
  View: 'View', Text: 'Text', TextInput: 'TextInput', Pressable: 'Pressable', TouchableOpacity: 'TouchableOpacity',
  ScrollView: 'ScrollView', Modal: 'Modal', Image: 'Image', ActivityIndicator: 'ActivityIndicator',
  Platform: { OS: 'android', select: options => options.android },
  StyleSheet: { create: value => value }, useWindowDimensions: () => ({ width: 390, height: 844 }),
  Alert: { alert: jest.fn() },
}));
jest.mock('../src/components/TranslatedText', () => 'Text');
jest.mock('../src/components/TranslatedTextInput', () => 'TextInput');
jest.mock('react-native-linear-gradient', () => 'Gradient');
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn() }));
jest.mock('../src/features/doctor/dashboard/icons/AppIcon', () => 'Icon');
jest.mock('../src/axiosConfig', () => ({ __esModule: true, API_BASE_URL: 'https://example.test', default: { defaults: { baseURL: 'https://example.test' }, get: jest.fn() } }));
jest.mock('../src/features/doctor/dashboard/utils/consultationPrescriptionPdf', () => ({ downloadConsultationPrescriptionPdf: jest.fn() }));
jest.mock('@react-native-community/datetimepicker', () => ({ __esModule: true, default: 'DateTimePicker', DateTimePickerAndroid: { open: jest.fn() } }));
jest.mock('../src/hooks/useKeyboardAwareScroll', () => ({ __esModule: true, default: () => ({ scrollRef: { current: null }, frameInset: 0 }) }));

const medicine = { name: 'Recorded medicine', dosage: 'Recorded dose', timings: ['Morning', 'Night'], durationValue: '5', durationType: 'Days' };
const test = { testName: 'Recorded test', completeBy: '2026-10-20', reason: 'Recorded reason', instructions: 'Recorded instructions' };
const raw = {
  id: 'visit-1', appointment_date: '2026-10-16', status: 'completed',
  patient: { fullName: 'Test Patient', gender: 'Female' },
  psychiatristSnapshot: { name: 'Dr. Test' }, diagnosis: 'Recorded diagnosis',
  medicines: JSON.stringify([medicine]), recommended_tests: JSON.stringify([test]),
  advice: 'Recorded advice', additional_notes: 'Recorded notes', follow_up_required: 'false',
};
let root;
const render = async element => { await act(async () => { root = create(element); }); };
const labelText = children => React.Children.toArray(children).map(child => typeof child === 'string' ? child : typeof child === 'number' ? String(child) : labelText(child.props?.children)).join('');
const press = async label => {
  const node = root.root.findAll(node => ['Pressable', 'TouchableOpacity'].includes(node.type)).find(node => labelText(node.props.children).includes(label));
  if (!node) throw new Error(`Button missing: ${label}`);
  await act(async () => { await node.props.onPress(); });
};
const mockAppointment = (appointment, doctor = { _id: 'doctor-1', fullName: 'Dr. Meera' }) => api.get.mockImplementation(path => Promise.resolve({ data: path === '/api/auth/me' ? { user: doctor } : { appointment } }));
beforeEach(() => { jest.clearAllMocks(); mockAppointment(raw); });
afterEach(async () => { if (root) await act(async () => { root.unmount(); }); root = undefined; });

it('reads web JSON medicine/test lists, doctor snapshot, and false follow-up after queue formatting', () => {
  const data = appointmentToDocument(formatAppointment(raw));
  expect(data).toMatchObject({ patient: 'Test Patient', doctor: 'Dr. Test', diagnosis: raw.diagnosis, medicines: [medicine], tests: [test], notes: 'Recorded notes', followUpRequired: false });
  expect(data.date).toBe('16 Oct 2026');
});

it('recovers consultation details stored by older web APIs', () => {
  const data = appointmentToDocument(formatAppointment({
    ...raw, medicines: [], recommended_tests: [], medicine: '', additional_notes: '',
    notes: JSON.stringify({ __doctorConsultation: 1, originalNotes: 'Patient note', details: {
      medicines: [medicine], recommendedTests: [test], medicine: 'Legacy medicine', additional_notes: 'Saved note', follow_up_date: '2026-10-20',
    } }),
  }));
  expect(data.medicines).toEqual([medicine]);
  expect(data.tests).toEqual([test]);
  expect(data.notes).toBe('Saved note');
  expect(data.followUp).toBe('2026-10-20');
});

it('handles legacy plain medicine and malformed collections without inventing doctor names', () => {
  const data = appointmentToDocument({ medicine: 'Legacy medicine', medicines: '{bad', recommendedTests: 'null' }, 'Dr. Doctor');
  expect(data).toMatchObject({ doctor: 'Doctor name not recorded', medicine: 'Legacy medicine', medicines: [], tests: [] });
  expect(doctorRxToDocument({ followUpRequired: 'false' }).followUpRequired).toBe(false);
});

it.each(['online', 'walkin'])('loads latest %s prescription from its appointment endpoint', async source => {
  const appt = formatAppointment({ ...raw, __appointmentSource: source });
  const result = await loadAppointmentPrescription(appt);
  expect(api.get).toHaveBeenCalledWith(`/api/${source === 'walkin' ? 'walkin-appointments' : 'appointments'}/visit-1`, { timeout: 15000 });
  expect(appointmentToDocument(result).medicines).toEqual([medicine]);
});

it('rejects invalid detail responses instead of showing a blank prescription', async () => {
  api.get.mockResolvedValue({ data: [] });
  await expect(loadAppointmentPrescription(formatAppointment(raw))).rejects.toThrow('Prescription details could not be loaded.');
});

it('shows the web sections/table and downloads the exact displayed record', async () => {
  await render(<ConsultationPrescriptionModal visible appointment={formatAppointment(raw)} doctorName="Dr. Meera" onClose={jest.fn()} />);
  const text = JSON.stringify(root.toJSON());
  ['Prescribing doctor', 'Dr. Meera', 'Medicine name', 'Strength', 'Dosage', 'Instructions', 'Duration', 'Morning, Night', '5 Days', 'Recorded test', 'Recorded notes', 'No follow-up scheduled'].forEach(value => expect(text).toContain(value));
  await press('Download PDF');
  expect(downloadConsultationPrescriptionPdf).toHaveBeenCalledWith(expect.objectContaining({ doctor: 'Dr. Meera', medicines: [medicine], tests: [test], notes: 'Recorded notes' }));
});

it('disables PDF during loading and recovers from a detail request failure with Retry', async () => {
  api.get.mockRejectedValueOnce(new Error('Connection failed'));
  await render(<ConsultationPrescriptionModal visible appointment={formatAppointment(raw)} onClose={jest.fn()} />);
  expect(JSON.stringify(root.toJSON())).toContain('Connection failed');
  const download = root.root.findAllByType('Pressable').find(node => node.props.disabled === true);
  expect(download).toBeDefined();
  await press('Retry');
  expect(JSON.stringify(root.toJSON())).toContain('Recorded diagnosis');
});

it('ignores an earlier patient response when another prescription is opened', async () => {
  let resolve;
  api.get.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  await render(<ConsultationPrescriptionModal visible appointment={formatAppointment(raw)} onClose={jest.fn()} />);
  const next = { ...raw, id: 'visit-2', patient: { fullName: 'Next Patient' } };
  mockAppointment(next);
  await act(async () => { root.update(<ConsultationPrescriptionModal visible appointment={formatAppointment(next)} onClose={jest.fn()} />); });
  await act(async () => { resolve({ data: { appointment: raw } }); });
  expect(JSON.stringify(root.toJSON())).toContain('Next Patient');
  expect(JSON.stringify(root.toJSON())).not.toContain('Test Patient');
});

it('keeps printed document fields escaped and includes web test details', () => {
  const html = buildConsultationDocumentHtml({ ...appointmentToDocument(raw), advice: '<script>bad</script>' });
  expect(html).toContain('&lt;script&gt;bad&lt;/script&gt;');
  expect(html).toContain('Recorded instructions');
  expect(html).toContain('Recorded notes');
});

it('allows adding/removing recommended tests and submits all test fields with medicines', async () => {
  const onSave = jest.fn();
  await render(<CompleteAppointmentScreen patient={formatAppointment(raw)} onSave={onSave} onCancel={jest.fn()} />);
  const fill = async (placeholder, value) => {
    const input = root.root.findAllByType('TextInput').find(node => node.props.placeholder === placeholder);
    await act(async () => { input.props.onChangeText(value); });
  };
  await fill('Enter detailed diagnosis...', 'Diagnosis');
  await fill('Enter any additional advice or instructions...', 'Advice');
  await fill('e.g. Paracetamol 500mg', 'Medicine');
  await fill('e.g. 1 Tablet', 'Dose');
  await fill('5', '5');
  await press('Morning');
  await press('Add Test');
  await fill('e.g., CBC, Blood Sugar, X-Ray', 'Test one');
  await fill('Why this test is required', 'Reason');
  await fill('e.g., 8 hours fasting', 'Instructions');
  await press('Add Test');
  const remove = root.root.findByProps({ accessibilityLabel: 'Remove test 2' });
  await act(async () => { remove.props.onPress(); });
  await press('Complete Consultation');
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
    medicines: [expect.objectContaining({ name: 'Medicine', durationValue: '5', durationType: 'Days' })],
    recommendedTests: [{ testName: 'Test one', completeBy: null, reason: 'Reason', instructions: 'Instructions' }],
  }));
});


const detailed = {
  ...raw, id: 'rx-full', source: 'appointment', verificationStatus: 'completed', token_number: 0,
  doctorProfile: { fullName: 'Dr. Profile', qualification: ['MBBS', 'MD'], specialization: ['Psychiatry'], registrationNumber: 'REG-123', email: 'doctor@example.test', prescriptionSignature: '/uploads/signature.png' },
  patient: { id: 'patient-123', name: 'Full Patient', age: 0, gender: 'Female', phoneNumber: '9876543210', medicalInfo: { weight: 65, allergies: ['Penicillin', 'Dust'] } },
  clinic: { clinic_name: 'Test Clinic', location: 'Test Address', phone_number: '1234567890' },
  vitals: { weight: 64 },
  medicines: [{ ...medicine, strength: '500 mg', instructions: 'After food' }],
};

it('retains every web letterhead, patient and medicine field in both patient view and print', async () => {
  const data = appointmentToDocument(detailed);
  expect(data).toMatchObject({
    doctor: 'Dr. Profile', qualification: 'MBBS, MD', specialization: 'Psychiatry', registration: 'REG-123',
    clinic: 'Test Clinic', address: 'Test Address', doctorPhone: '+91 1234567890', doctorEmail: 'doctor@example.test',
    prescriptionId: 'rx-full', opd: '0', patientId: 'patient-123', age: '0', phone: '+91 9876543210', weight: '64',
    allergies: 'Penicillin, Dust', signature: 'https://example.test/uploads/signature.png',
  });
  const patientData = doctorRxToDocument({ document: data, clinic: { name: 'Another Clinic' } });
  expect(patientData).toEqual(data);
  mockAppointment(detailed, { _id: 'doctor-1', ...detailed.doctorProfile });
  await render(<ConsultationPrescriptionModal visible appointment={formatAppointment(detailed)} onClose={jest.fn()} />);
  const text = JSON.stringify(root.toJSON());
  const html = buildConsultationDocumentHtml(data);
  ['Patient ID', 'Age / Gender', 'Contact No.', 'Weight', 'Allergies', 'Prescription No.', 'OPD / Token No.', 'Strength', 'Instructions', 'REG-123', 'patient-123', '500 mg', 'After food', 'Test Clinic', 'Penicillin, Dust'].forEach(value => {
    expect(text).toContain(value);
    expect(html).toContain(value);
  });
  expect(html).toContain('alt="Doctor signature"');
  await press('Download PDF');
  expect(downloadConsultationPrescriptionPdf).toHaveBeenCalledWith(expect.objectContaining({ patientId: 'patient-123', weight: '64', medicines: detailed.medicines }));
});

it.each(['pending', 'rejected', undefined])('hides unapproved signatures with status %s', verificationStatus => {
  const data = appointmentToDocument({ ...detailed, verificationStatus });
  expect(data.signature).toBe('');
  expect(buildConsultationDocumentHtml(data)).not.toContain('alt="Doctor signature"');
});

it('supports verified chat signatures, snapshot patient fields and clinic enrichment', () => {
  const data = appointmentToDocument({ ...detailed, source: 'chat', verificationStatus: 'verified', patient: undefined, patientSnapshot: detailed.patient });
  expect(data.patientId).toBe('patient-123');
  expect(data.signature).toContain('/uploads/signature.png');
  const enriched = doctorRxToDocument({ document: { ...data, clinic: '', address: '', doctorPhone: '', opd: '' }, tokenNumber: 3, clinic: { name: 'Enriched Clinic', location: 'Enriched Address', phone: '55555' } });
  expect(enriched).toMatchObject({ clinic: 'Enriched Clinic', address: 'Enriched Address', doctorPhone: '+91 55555', opd: '3' });
});


it.each(['online', 'walkin'])('doctor %s PDF exactly matches the patient document including current clinic/profile signature', async source => {
  const doctor = { _id: 'doctor-1', ...detailed.doctorProfile };
  const clinic = { ...detailed.clinic, _id: 'clinic-1', doctor_id: 'doctor-1' };
  const appointment = { ...detailed, issue: 'Recorded issue', clinic_id: 'clinic-1', __appointmentSource: source };
  api.get.mockImplementation(path => Promise.resolve({ data: path === '/api/auth/me' ? { user: doctor } : path === '/api/clinics/clinic-1' ? { clinic } : { appointment } }));
  const data = await loadDoctorPrescriptionDocument(formatAppointment(appointment));
  const patientDocument = appointmentToDocument({ ...appointment, id: 'appointment:rx-full', doctorProfile: doctor, clinic }, doctor.fullName);
  expect(data).toEqual(patientDocument);
  expect(buildConsultationDocumentHtml(data)).toBe(buildConsultationDocumentHtml(doctorRxToDocument({ document: patientDocument })));
  expect(api.get).toHaveBeenCalledWith(`/api/${source === 'walkin' ? 'walkin-appointments' : 'appointments'}/rx-full`, { timeout: 15000 });
});

it('doctor patient Visit Details downloads the same complete document shown on screen', async () => {
  mockAppointment(detailed, { _id: 'doctor-1', ...detailed.doctorProfile });
  await render(<VisitDetailScreen patient={{ name: 'Full Patient' }} record={{ __raw: detailed, id: 'rx-full', date: '16 Oct 2026', doctor: 'Dr. Profile', medicines: [], tests: [] }} onBack={jest.fn()} />);
  ['Prescription No.', 'REG-123', 'patient-123', '500 mg', 'After food'].forEach(value => expect(JSON.stringify(root.toJSON())).toContain(value));
  await press('Download Prescription');
  expect(downloadConsultationPrescriptionPdf).toHaveBeenCalledWith(expect.objectContaining({
    prescriptionId: 'appointment:rx-full', patientId: 'patient-123', medicines: detailed.medicines, signature: 'https://example.test/uploads/signature.png',
  }));
});

it('does not enable downloading a header with another doctor clinic', async () => {
  api.get.mockImplementation(path => Promise.resolve({ data: path === '/api/auth/me' ? { user: { _id: 'doctor-1' } } : path === '/api/clinics/clinic-1' ? { clinic: { doctor_id: 'another-doctor' } } : { appointment: { ...raw, clinic_id: 'clinic-1' } } }));
  await render(<ConsultationPrescriptionModal visible appointment={formatAppointment(raw)} onClose={jest.fn()} />);
  expect(JSON.stringify(root.toJSON())).toContain('does not belong to this doctor');
  expect(downloadConsultationPrescriptionPdf).not.toHaveBeenCalled();
});
