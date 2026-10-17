import React from 'react';
import { act, create } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../src/axiosConfig';
import { getAppointmentVitals, hasAppointmentVitals, hasReceptionistVitals } from '../src/utils/appointmentVitals';
import { formatAppointment } from '../src/features/doctor/dashboard/api/doctorAppointments';
import { loadDoctorPatients } from '../src/features/doctor/dashboard/api/doctorPatients';
import AppointmentCard from '../src/features/doctor/dashboard/components/AppointmentCard';
import ActiveConsultationCard from '../src/features/doctor/dashboard/components/ActiveConsultationCard';
import PatientDetailScreen from '../src/features/doctor/dashboard/components/PatientDetailScreen';
import VisitDetailScreen from '../src/features/doctor/dashboard/components/VisitDetailScreen';
import CompleteAppointmentScreen from '../src/features/doctor/dashboard/components/CompleteAppointmentScreen';
import PatientVitalsButton from '../src/components/PatientVitalsButton';
import useLiveRefresh from '../src/hooks/useLiveRefresh';
import { fetchPatientVitals } from '../src/services/patientVitals';

jest.mock('react-native', () => ({
  View: 'View', Text: 'Text', TextInput: 'TextInput', TouchableOpacity: 'TouchableOpacity', Pressable: 'Pressable', ScrollView: 'ScrollView',
  Modal: 'Modal', ActivityIndicator: 'ActivityIndicator', StatusBar: 'StatusBar', RefreshControl: 'RefreshControl',
  Platform: { OS: 'android', select: options => options.android },
  StyleSheet: { create: value => value },
}));
jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');
jest.mock('../src/components/TranslatedText', () => 'Text');
jest.mock('../src/components/TranslatedTextInput', () => 'TextInput');
jest.mock('@react-native-community/datetimepicker', () => ({ __esModule: true, default: 'DateTimePicker', DateTimePickerAndroid: {} }));
jest.mock('../src/hooks/useKeyboardAwareScroll', () => ({ __esModule: true, default: () => ({ scrollRef: { current: null }, frameInset: 0 }) }));
jest.mock('react-native-linear-gradient', () => 'Gradient');
jest.mock('../src/features/doctor/dashboard/icons/AppIcon', () => 'Icon');
jest.mock('../src/features/doctor/dashboard/utils/consultationPrescriptionPdf', () => ({ downloadConsultationPrescriptionPdf: jest.fn() }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn() }));
jest.mock('../src/axiosConfig', () => ({
  __esModule: true, default: { defaults: { baseURL: 'https://example.test' }, get: jest.fn(), patch: jest.fn(), post: jest.fn() },
}));
jest.mock('../src/hooks/useLiveRefresh', () => {
  const React = require('react');
  return { __esModule: true, default: jest.fn(refresh => { React.useEffect(() => { void refresh(); }, [refresh]); }) };
});

const vitals = { blood_pressure: '120/80', pulse: 75, temperature: 37, temperature_unit: 'C', spo2: 98, respiratory_rate: 16, weight: 70, height: 175, pain_score: 0, notes: 'Measured before consultation', recorded_role: 'receptionist', recorded_at: '2026-10-15T09:00:00Z' };
const visit = { _id: 'visit-1', patient: { _id: 'patient-1', fullName: 'Test patient' }, counselor: { _id: 'doctor-1', fullName: 'Test doctor' }, appointment_date: '2026-10-15', appointment_time: '14:30', status: 'confirmed', vitals };
let root;
const render = async element => { await act(async () => { root = create(element); }); };
const text = () => JSON.stringify(root.toJSON(), (key, value) => key === '_owner' ? undefined : value);
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  AsyncStorage.getItem.mockResolvedValue(JSON.stringify({ _id: 'doctor-1', fullName: 'Test doctor' }));
  api.get.mockResolvedValue({ data: [visit] });
});
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  root = null;
  jest.useRealTimers();
});

test.each([vitals, JSON.stringify(vitals)])('doctor queue keeps all saved vitals for object/JSON records', saved => {
  const appointment = formatAppointment({ ...visit, vitals: saved });
  expect(appointment.bp).toBe('120/80');
  expect(appointment.temperature).toBe(37);
  expect(getAppointmentVitals(appointment)).toEqual(vitals);
  expect(hasReceptionistVitals(appointment)).toBe(true);
});

test('aliases, zero readings and Fahrenheit units survive normalization without appointment notes becoming measurement notes', () => {
  expect(getAppointmentVitals({ vitals: { bloodPressure: '118/78', heartRate: 80, temperature: 98.6, temperatureUnit: 'F', painScore: 0 } })).toMatchObject({ blood_pressure: '118/78', pulse: 80, temperature: 98.6, temperature_unit: 'F', pain_score: 0 });
  expect(hasAppointmentVitals({ vitals: { pain_score: 0 } })).toBe(true);
  expect(hasAppointmentVitals({ vitals: 'broken JSON' })).toBe(false);
  expect(hasAppointmentVitals({ bp: 'Not recorded', pulse: 'N/A' })).toBe(false);
  expect(getAppointmentVitals({ notes: 'Appointment booking notes', vitals: { pulse: 80 } }).notes).toBeUndefined();
});

test('doctor patient records preserve saved vitals for online and walk-in visits', async () => {
  api.get.mockImplementation(path => Promise.resolve({ data: path === '/api/auth/users' ? { users: [] }
    : path === '/api/walkin-appointments' ? { data: [{ ...visit, id: 'walkin-2', patient: undefined, patient_id: 'patient-1', patient_name: 'Test patient', doctor_id: 'doctor-1', vitals: JSON.stringify(vitals) }] }
      : [visit] }));
  const patients = await loadDoctorPatients();
  expect(patients).toHaveLength(1);
  expect(patients[0].records).toHaveLength(2);
  for (const record of patients[0].records) {
    expect(record.vitals).toEqual(vitals);
    expect(record.painScore).toBe(0);
    expect(record.spo2).toBe(98);
  }
});

test.each(['patient details', 'visit details', 'completion form'])('doctor %s displays the saved readings', async screen => {
  const item = formatAppointment(visit);
  const record = { ...vitals, vitals, id: 'visit-1', date: '15 Oct 2026', time: '14:30', bp: '120/80', temperatureUnit: 'C', respiratoryRate: 16, painScore: 0, recordedAt: vitals.recorded_at, medicines: [], tests: [], problem: 'Checkup', doctor: 'Test doctor', status: 'confirmed' };
  const patient = { name: 'Test patient', age: 30, gender: 'male', records: [record] };
  const element = screen === 'completion form' ? <CompleteAppointmentScreen patient={item} />
      : screen === 'patient details' ? <PatientDetailScreen patient={patient} />
        : <VisitDetailScreen patient={patient} record={record} />;
  await render(element);
  expect(text()).toContain('120/80');
  expect(text()).toContain('98');
  expect(text()).toContain('Measured before consultation');
});

test.each(['pending', 'in-progress', 'completed'])('dashboard %s queue cards do not display vitals', async status => {
  const item = { ...formatAppointment(visit), status };
  await render(<AppointmentCard item={item} isActive={status === 'in-progress'} />);
  expect(text()).not.toContain('120/80');
  expect(text()).not.toContain('Measured before consultation');
  expect(text()).not.toContain('Patient vitals');
});

test.each(['started', 'paused', 'break'])('active consultation in %s state does not display vitals', async status => {
  await render(<ActiveConsultationCard session={{ appt: formatAppointment(visit), startTime: Date.now(), accumulatedPauseMs: 0, status }} />);
  expect(text()).not.toContain('120/80');
  expect(text()).not.toContain('Measured before consultation');
  expect(text()).not.toContain('Patient vitals');
});

test('doctor completion keeps Fahrenheit readings accurate in its Celsius field', async () => {
  await render(<CompleteAppointmentScreen patient={formatAppointment({ ...visit, vitals: { ...vitals, temperature: 98.6, temperature_unit: 'F' } })} />);
  expect(text()).toContain('98.6 °F');
  const temperatureInput = root.root.findAllByType('TextInput').find(node => node.props.placeholder === '37.0');
  expect(temperatureInput.props.value).toBe('37');
});

test('user profile button appears only for receptionist readings, then opens all records read-only', async () => {
  api.get.mockResolvedValue({ data: [{ ...visit, vitals: null }, { ...visit, vitals: { pulse: 80, recorded_role: 'doctor' } }] });
  await render(<PatientVitalsButton />);
  expect(root.toJSON()).toBeNull();
  api.get.mockResolvedValue({ data: { appointments: [visit, { ...visit, _id: 'visit-2', appointment_date: '2026-10-14', vitals: { ...vitals, blood_pressure: '115/75', recorded_at: '2026-10-14T09:00:00Z' } }] } });
  await act(async () => useLiveRefresh.mock.calls.at(-1)[0]());
  expect(text()).toContain('View vitals');
  await act(async () => root.root.findAllByType('Pressable')[0].props.onPress());
  expect(root.root.findByType('Modal').props.visible).toBe(true);
  expect(text()).toContain('120/80');
  expect(text()).toContain('115/75');
  expect(root.root.findAllByType('TextInput')).toHaveLength(0);
  expect(api.patch).not.toHaveBeenCalled();
  expect(api.post).not.toHaveBeenCalled();
});

test('patient API rejects failed responses and excludes empty or unattributed records', async () => {
  api.get.mockResolvedValue({ data: { data: [visit, { vitals: {} }, { vitals: { recorded_role: 'receptionist', notes: 'Only notes' } }, { vitals: { pulse: 80 } }] } });
  expect(await fetchPatientVitals()).toHaveLength(1);
  expect(api.get).toHaveBeenCalledWith('/api/appointments');
  api.get.mockResolvedValue({ data: { success: false, message: 'Database unavailable' } });
  await expect(fetchPatientVitals()).rejects.toThrow('Database unavailable');
});

test('an API failure keeps existing user readings visible and offers retry', async () => {
  await render(<PatientVitalsButton />);
  api.get.mockRejectedValue(new Error('Network unavailable'));
  await act(async () => root.root.findAllByType('Pressable')[0].props.onPress());
  expect(text()).toContain('120/80');
  expect(text()).toContain('Network unavailable');
  expect(text()).toContain('Retry');
});
