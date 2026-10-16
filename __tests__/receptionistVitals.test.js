import React from 'react';
import { act, create } from 'react-test-renderer';
import { Keyboard } from 'react-native';
import api from '../src/axiosConfig';
import { ReceptionistVitalsProvider } from '../src/features/receptionist/ReceptionistVitalsContext';
import { AppointmentRow, Badge, PatientDetailsSheet, RecButton } from '../src/features/receptionist/receptionistUi';
import AppointmentsSection from '../src/features/receptionist/sections/AppointmentsSection';
import { saveStaffAppointmentVitals } from '../src/features/receptionist/receptionistApi';
import { indiaToday } from '../src/features/receptionist/receptionistUtils';

jest.mock('react-native', () => {
  const React = require('react');
  const TextInput = React.forwardRef((props, ref) => {
    const nativeInput = React.useRef({ focus: jest.fn() });
    React.useImperativeHandle(ref, () => nativeInput.current, []);
    return React.createElement('TextInput', { ...props, nativeInput: nativeInput.current });
  });
  return {
  View: 'View', Text: 'Text', TextInput, Pressable: 'Pressable',
  ScrollView: 'ScrollView', Modal: 'Modal', Image: 'Image', ActivityIndicator: 'ActivityIndicator',
  StyleSheet: { create: value => value }, Keyboard: { dismiss: jest.fn() },
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
  __esModule: true, default: () => ({ ...mockKeyboardLayout, scrollRef: { current: null } }),
}));
jest.mock('../src/axiosConfig', () => ({
  __esModule: true, API_BASE_URL: 'https://example.test', default: { get: jest.fn(), patch: jest.fn() },
}));

const patient = { id: 'visit-1', source: 'online', date: indiaToday(), status: 'confirmed', queueStatus: 'waiting', patientName: 'Test patient', phoneNumber: '1234567890' };
const mockKeyboardLayout = { keyboardOpen: false };
const readings = { blood_pressure: '120/80', pulse: 75, pain_score: 0, recorded_at: '2026-10-15T10:00:00Z' };
let root;
const button = label => root.root.findAllByType(RecButton).find(node => node.props.label === label);
const press = async label => { await act(async () => { button(label).props.onPress(); }); };
const input = label => root.root.findAllByType('TextInput').find(node => node.props.accessibilityLabel === label);
const text = () => JSON.stringify(root.toJSON());
const renderAppointments = async (key = 'appointments') => {
  await act(async () => {
    const element = <ReceptionistVitalsProvider><AppointmentsSection key={key} clinicId="clinic-1" /></ReceptionistVitalsProvider>;
    if (root) root.update(element);
    else root = create(element);
  });
};
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockKeyboardLayout.keyboardOpen = false;
  mockKeyboardLayout.keyboardTop = 0;
  api.get.mockResolvedValue({ data: { appointments: [patient], total: 1, completed: 0, clinics: [], doctor: { fullName: 'Test doctor' } } });
});
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  root = null;
  jest.useRealTimers();
});

test('save then View retains readings across sheet closure, stale polls and tab remounts', async () => {
  api.patch.mockResolvedValue({ data: { success: true, vitals: readings } });
  await renderAppointments();
  await press('Add vitals');
  expect(input('Blood pressure')).toBeDefined();
  expect(button('Done')).toBeUndefined();
  expect(button('Cancel')).toBeUndefined();
  await act(async () => input('Blood pressure').props.onChangeText('120/80'));
  await act(async () => input('Pulse (beats/min)').props.onChangeText('75'));
  await press('Save vitals');
  expect(api.patch).toHaveBeenCalledWith('/api/staff/appointments/visit-1/vitals', {
    source: 'online', vitals: expect.objectContaining({ blood_pressure: '120/80', pulse: '75' }),
  });
  expect(root.root.findByType(PatientDetailsSheet).props.patient).toBeNull();
  expect(button('Edit vitals')).toBeDefined();
  await press('View');
  expect(text()).toContain('120/80');
  expect(text()).toContain('Recorded measurements');
  expect(input('Blood pressure')).toBeUndefined();
  await act(async () => jest.advanceTimersByTime(15000));
  expect(text()).toContain('120/80');
  await renderAppointments('remounted-tab');
  await press('View');
  expect(text()).toContain('120/80');
  expect(text()).toContain('Recorded measurements');
  await press('Edit vitals');
  expect(input('Blood pressure').props.value).toBe('120/80');
  expect(input('Pulse (beats/min)').props.value).toBe('75');
  expect(input('Pain score (0–10)').props.value).toBe('0');
});

test('fresh app state displays persisted API readings, including JSON records', async () => {
  api.get.mockResolvedValue({ data: { appointments: [{ ...patient, vitals: JSON.stringify(readings) }], total: 1, completed: 0, clinics: [], doctor: {} } });
  await renderAppointments();
  await press('View');
  expect(text()).toContain('Recorded measurements');
  expect(text()).toContain('120/80');
});

test.each(['online', 'walkin'])('Next patients can add, save and edit vitals for %s bookings', async source => {
  const nextPatient = { ...patient, source, status: source === 'walkin' ? 'skipped' : 'confirmed', queueStatus: 'skipped' };
  api.get.mockResolvedValue({ data: { appointments: [nextPatient], total: 1 } });
  api.patch.mockResolvedValue({ data: { success: true, vitals: readings } });
  await renderAppointments();
  expect(button('Add vitals')).toBeDefined();
  await press('Add vitals');
  await act(async () => input('Blood pressure').props.onChangeText('120/80'));
  await press('Save vitals');
  expect(api.patch).toHaveBeenCalledWith('/api/staff/appointments/visit-1/vitals', {
    source, vitals: expect.objectContaining({ blood_pressure: '120/80' }),
  });
  expect(root.root.findByType(PatientDetailsSheet).props.patient).toBeNull();
  await press('Edit vitals');
  expect(input('Blood pressure').props.value).toBe('120/80');
});

test('pending and failed saves keep the sheet open and preserve entered readings', async () => {
  let rejectRequest;
  api.patch.mockImplementation(() => new Promise((resolve, reject) => { rejectRequest = reject; }));
  await renderAppointments();
  await press('Add vitals');
  await act(async () => input('Blood pressure').props.onChangeText('120/80'));
  const save = button('Save vitals').props.onPress;
  await act(async () => { save(); save(); });
  expect(api.patch).toHaveBeenCalledTimes(1);
  expect(button('Saving...').props.disabled).toBe(true);
  const modal = root.root.findAllByType('Modal').find(node => node.props.visible);
  await act(async () => modal.props.onRequestClose());
  expect(root.root.findByType(PatientDetailsSheet).props.patient).not.toBeNull();
  await act(async () => rejectRequest({ response: { data: { message: 'Save failed' } } }));
  expect(input('Blood pressure').props.value).toBe('120/80');
  expect(text()).toContain('Save failed');
  expect(button('Save vitals').props.disabled).toBe(false);
  api.patch.mockResolvedValue({ data: { success: true } });
  await press('Save vitals');
  expect(input('Blood pressure').props.value).toBe('120/80');
  expect(text()).toContain('server did not confirm saved vitals');
  expect(root.root.findByType(PatientDetailsSheet).props.patient).not.toBeNull();
});

test.each([{}, { vitals: {} }, { vitals: [] }, { success: false, vitals: readings }])('does not accept an unconfirmed save: %j', async data => {
  api.patch.mockResolvedValue({ data });
  await expect(saveStaffAppointmentVitals(patient, readings)).rejects.toThrow('server did not confirm');
});

test('newer server readings replace the last confirmed local readings', async () => {
  api.patch.mockResolvedValue({ data: { vitals: readings } });
  await renderAppointments();
  await press('Add vitals');
  await act(async () => input('Blood pressure').props.onChangeText('120/80'));
  await press('Save vitals');
  api.get.mockResolvedValue({ data: { appointments: [{ ...patient, vitals: { blood_pressure: '125/85', recorded_at: '2026-10-15T11:00:00Z' } }], total: 1, completed: 0, clinics: [], doctor: {} } });
  await act(async () => jest.advanceTimersByTime(15000));
  await press('View');
  expect(text()).toContain('125/85');
  expect(text()).not.toContain('120/80');
});

test('Next moves through vitals to notes without dismissing the keyboard', async () => {
  await renderAppointments();
  await press('Add vitals');
  const fields = root.root.findAllByType('TextInput').filter(node => node.props.accessibilityLabel);
  for (let index = 0; index < fields.length - 1; index++) {
    await act(async () => fields[index].props.onSubmitEditing());
    expect(fields[index + 1].props.nativeInput.focus).toHaveBeenCalledTimes(1);
  }
  expect(Keyboard.dismiss).not.toHaveBeenCalled();
  expect(root.root.findByType(PatientDetailsSheet).props.patient).not.toBeNull();
});

test('typing, keyboard resizing and polling retain the same native input and draft', async () => {
  await renderAppointments();
  await press('Add vitals');
  const originalInput = input('Blood pressure').props.nativeInput;
  mockKeyboardLayout.keyboardOpen = true;
  mockKeyboardLayout.keyboardTop = 480;
  await renderAppointments();
  for (const value of ['1', '12', '120', '120/', '120/8', '120/80']) {
    await act(async () => input('Blood pressure').props.onChangeText(value));
    expect(input('Blood pressure').props.nativeInput).toBe(originalInput);
  }
  await act(async () => jest.advanceTimersByTime(15000));
  expect(input('Blood pressure').props.nativeInput).toBe(originalInput);
  expect(input('Blood pressure').props.value).toBe('120/80');
  expect(Keyboard.dismiss).not.toHaveBeenCalled();
});

test.each(['completed', 'pending'])('shows %s once on an appointment card', async status => {
  api.get.mockResolvedValue({ data: { appointments: [{ ...patient, status, queueStatus: status }], total: 1 } });
  await renderAppointments();
  const card = root.root.findByType(AppointmentRow);
  expect(card.findAllByType(Badge).map(node => node.props.value)).toEqual([status]);
});

test('shows emergency reason on the card and full treatment in patient details', async () => {
  api.get.mockResolvedValue({ data: { appointments: [{
    ...patient, priority: 'emergency',
    symptoms: '[EMERGENCY] Severe breathing difficulty || Chest discomfort',
    notes: JSON.stringify({ __doctorConsultation: 1, originalNotes: 'Monitor symptoms', details: {
      diagnosis: 'Recorded diagnosis', advice: 'Recorded advice',
      medicines: [{ name: 'Recorded medicine', dosage: '5 mg', timings: ['Morning'], duration: '3 days' }],
      recommended_tests: ['Recorded test'], followUpDate: '2026-10-20',
    } }),
  }], total: 1 } });
  await renderAppointments();
  const card = root.root.findByType(AppointmentRow);
  expect(JSON.stringify(card.findAllByType('Text').map(node => node.props.children))).toContain('Severe breathing difficulty');
  await press('View');
  for (const value of ['Chest discomfort', 'Recorded diagnosis', 'Recorded advice', 'Recorded medicine', 'Recorded test', 'Monitor symptoms', '20 Oct 2026']) {
    expect(text()).toContain(value);
  }
  expect(text()).not.toContain('[EMERGENCY]');
});
