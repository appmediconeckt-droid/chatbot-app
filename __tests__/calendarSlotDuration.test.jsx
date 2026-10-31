/* eslint-env jest */
// The doctor's calendar uses one slot-duration list everywhere, and every add
// flow starts with the duration already used on the selected date — "Apply to
// Selected Dates" used to fall back to 15 min (and had no 5 min option).
import React from 'react';
import { StyleSheet } from 'react-native';
import { act, create } from 'react-test-renderer';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null), setItem: jest.fn().mockResolvedValue(null),
}));
jest.mock('../src/axiosConfig', () => ({
  __esModule: true,
  API_BASE_URL: 'https://example.test',
  default: { get: jest.fn(), post: jest.fn(), delete: jest.fn(), defaults: { baseURL: '' } },
}));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('react-native-image-picker', () => ({ launchImageLibrary: jest.fn() }));
jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('../src/components/TranslatedText', () => 'Text');
jest.mock('../src/components/TranslatedTextInput', () => 'TextInput');
jest.mock('../src/features/doctor/dashboard/icons/AppIcon', () => 'Icon');
jest.mock('../src/features/doctor/dashboard/components/TimePickerSheet', () => 'TimePickerSheet');
jest.mock('../src/features/doctor/dashboard/components/ClearAvailabilityModal', () => 'ClearAvailabilityModal');
jest.mock('../src/components/common/CountryPhoneInput', () => 'CountryPhoneInput');
jest.mock('../src/components/common/ToastProvider', () => ({ useToast: () => ({ showToast: jest.fn() }) }));
jest.mock('../src/components/common/KeyboardSheet', () => {
  const R = require('react');
  const pass = (name) => ({ children }) => R.createElement(name, null, children);
  return { KeyboardSheet: pass('KeyboardSheet'), KeyboardSheetOverlay: pass('KeyboardSheetOverlay'), KeyboardSheetScroll: pass('KeyboardSheetScroll') };
});
jest.mock('../src/features/doctor/dashboard/api/doctorAppointments', () => ({
  ...jest.requireActual('../src/features/doctor/dashboard/api/doctorAppointments'),
  getStoredDoctorUser: jest.fn().mockResolvedValue({ _id: 'd1' }),
}));

const api = require('../src/axiosConfig').default;
const CalendarAvailabilityScreen = require('../src/features/doctor/dashboard/components/CalendarAvailabilityScreen').default;

const flush = () => act(async () => { for (let i = 0; i < 8; i += 1) await Promise.resolve(); });
const textOf = (node) => (node.children || []).map((c) => (typeof c === 'string' ? c : textOf(c))).join('');
const pressableWith = (tree, label) => tree.root.findAll((n) => typeof n.props?.onPress === 'function' && textOf(n) === label)[0];
// The chip label is white when its chip is the chosen one.
const chosenDurations = (tree) => tree.root.findAll((n) => n.type === 'Text' && /^\d+ min$/.test(textOf(n)))
  .filter((n) => StyleSheet.flatten(n.props.style)?.color === '#FFF')
  .map(textOf);

beforeAll(() => {
  jest.useFakeTimers({ now: new Date(2026, 9, 30, 9, 0), doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask'] });
});
afterAll(() => jest.useRealTimers());

it('Apply to Selected Dates starts with the slot duration the selected date already uses', async () => {
  api.get.mockImplementation((url) => Promise.resolve({
    data: url === '/api/clinics'
      ? [{ _id: 'c1', clinic_name: 'Clinic', doctor_id: 'd1' }]
      : { data: [{ _id: 'r1', clinic_id: 'c1', availability_date: '2026-10-30', start_time: '12:25', end_time: '13:25', slot_duration: 5 }] },
  }));
  let tree;
  await act(async () => { tree = create(<CalendarAvailabilityScreen />); });
  await flush();

  // Tap the 30th: the date editor's new range starts at 5 min, like the saved one.
  await act(async () => { pressableWith(tree, '30').props.onPress(); });
  expect(chosenDurations(tree)).toEqual(['5 min']);

  await act(async () => { pressableWith(tree, 'Apply to Selected Dates').props.onPress(); });
  // Every duration chip list offers the same options, 5 min included, and
  // the new range in "Apply to Selected Dates" is on 5 min too.
  expect(chosenDurations(tree)).toEqual(['5 min', '5 min']);
  await act(async () => { tree.unmount(); });
});
