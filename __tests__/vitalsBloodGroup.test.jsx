/* eslint-env jest */
// Clinic staff (doctor and receptionist) record the patient's blood group in
// the Add vitals form; the patient only sees it.
import React from 'react';
import { act, create } from 'react-test-renderer';

jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');
jest.mock('../src/components/TranslatedText', () => 'Text');
jest.mock('../src/axiosConfig', () => ({ __esModule: true, default: { get: jest.fn(), defaults: { baseURL: '' } } }));

const api = require('../src/axiosConfig').default;
const VitalsForm = require('../src/components/VitalsForm').default;
const { canonicalVitals, hasAnyVitals } = require('../src/components/VitalsForm');
const { getAppointmentVitals, hasAppointmentVitals, normalizeBloodGroup } = require('../src/utils/appointmentVitals');
const { fetchRecordedBloodGroup } = require('../src/services/patientVitals');

const byLabel = (tree, label) => tree.root.findAll((n) => n.props?.accessibilityLabel === label && typeof n.props.onPress === 'function')[0];
const option = (tree, group) => byLabel(tree, `Blood group ${group}`);
const dropdown = (tree) => byLabel(tree, 'Blood group');
const shown = (tree) => tree.root.findAll((n) => n.type === 'Text' && n.props.translate === false)
  .map((n) => n.props.children).find((c) => c === 'Select blood group' || /^(A|B|AB|O)[+-]$/.test(c));
const saveButton = (tree) => tree.root.find((n) => n.props?.accessibilityRole === 'button' && !n.props.accessibilityLabel && typeof n.props.onPress === 'function');

test('blood group is a dropdown listing every group, and the picked one is saved', async () => {
  const onSubmit = jest.fn().mockResolvedValue();
  let tree;
  await act(async () => { tree = create(<VitalsForm onSubmit={onSubmit} />); });
  // Closed: just the field, no chips.
  expect(shown(tree)).toBe('Select blood group');
  expect(option(tree, 'B+')).toBeUndefined();

  await act(async () => { dropdown(tree).props.onPress(); });
  ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].forEach((group) => expect(option(tree, group)).toBeTruthy());
  await act(async () => { option(tree, 'B+').props.onPress(); });
  // Picking closes the list and the field shows the choice.
  expect(option(tree, 'B+')).toBeUndefined();
  expect(shown(tree)).toBe('B+');

  // Blood group alone is enough to save.
  await act(async () => { await saveButton(tree).props.onPress(); });
  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ blood_group: 'B+' }));

  // "Not recorded" clears it.
  await act(async () => { dropdown(tree).props.onPress(); });
  await act(async () => { byLabel(tree, 'Blood group not recorded').props.onPress(); });
  expect(shown(tree)).toBe('Select blood group');
  await act(async () => { tree.unmount(); });
});

test('editing vitals starts on the saved blood group', async () => {
  let tree;
  await act(async () => { tree = create(<VitalsForm initialVitals={{ bloodGroup: 'o +ve', pulse: 72 }} onSubmit={jest.fn()} />); });
  expect(shown(tree)).toBe('O+');
  await act(async () => { dropdown(tree).props.onPress(); });
  expect(option(tree, 'O+').props.accessibilityState.selected).toBe(true);
  await act(async () => { tree.unmount(); });
});

test('blood group is read from recorded vitals and normalised', () => {
  expect(normalizeBloodGroup('ab positive')).toBe('AB+');
  expect(normalizeBloodGroup('O-')).toBe('O-');
  expect(normalizeBloodGroup('unknown')).toBe('');
  expect(canonicalVitals({ blood_group: 'a-' }).blood_group).toBe('A-');
  expect(hasAnyVitals({ blood_group: 'A-' })).toBe(true);
  expect(getAppointmentVitals({ vitals: { blood_group: 'B-' } }).blood_group).toBe('B-');
  expect(hasAppointmentVitals({ vitals: { blood_group: 'B-' } })).toBe(true);
  // The patient's own profile field is not a recorded vital.
  expect(getAppointmentVitals({ bloodGroup: 'A+', vitals: { pulse: 70 } }).blood_group).toBeUndefined();
});

test('vitals saved without a blood group (server not keeping it yet) read "Not recorded"', () => {
  const saved = { vitals: { pulse: 72 } };
  expect(getAppointmentVitals(saved).blood_group).toBeUndefined();
  expect(hasAppointmentVitals(saved)).toBe(true);
});

test('the patient sees the blood group the clinic last recorded', async () => {
  api.get.mockResolvedValue({ data: { appointments: [
    { vitals: { blood_group: 'A+', recorded_at: '2026-10-01T10:00:00Z' } },
    { vitals: { blood_group: 'B+', recorded_at: '2026-10-29T10:00:00Z' } },
    { vitals: { pulse: 80, recorded_at: '2026-10-30T10:00:00Z' } },
  ] } });
  await expect(fetchRecordedBloodGroup()).resolves.toBe('B+');
  api.get.mockResolvedValue({ data: { appointments: [{ vitals: { pulse: 80 } }] } });
  await expect(fetchRecordedBloodGroup()).resolves.toBe('');
});
