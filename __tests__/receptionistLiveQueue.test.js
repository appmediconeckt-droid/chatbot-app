import React from 'react';
import { act, create } from 'react-test-renderer';
import { LiveQueueSection } from '../src/features/receptionist/sections/DashboardSections';
import { ReceptionistVitalsProvider } from '../src/features/receptionist/ReceptionistVitalsContext';
import { indiaToday } from '../src/features/receptionist/receptionistUtils';

jest.mock('react-native', () => ({
  View: 'View', Text: 'Text', TextInput: 'TextInput', Pressable: 'Pressable',
  ScrollView: 'ScrollView', Modal: 'Modal', Image: 'Image', ActivityIndicator: 'ActivityIndicator',
  StyleSheet: { create: value => value }, Keyboard: { dismiss: jest.fn() },
  AppState: { addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
  useWindowDimensions: () => ({ width: 390, height: 844, scale: 1, fontScale: 1 }),
  Platform: { OS: 'android' }, Alert: { alert: jest.fn() }, Linking: { openURL: jest.fn() },
}));
jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');
jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../src/components/TranslatedText', () => 'Text');
jest.mock('../src/features/receptionist/components/EditProfileSheet', () => 'EditProfileSheet');
jest.mock('../src/axiosConfig', () => ({
  __esModule: true, API_BASE_URL: 'https://example.test', default: { get: jest.fn(), patch: jest.fn() },
}));

const row = (id, token, extra = {}) => ({
  id, source: 'online', date: indiaToday(), status: 'confirmed', queueStatus: 'waiting', patientName: `Patient ${token}`, token, ...extra,
});

const texts = (root) => root.root.findAllByType('Text')
  .map(node => [].concat(node.props.children).filter(v => typeof v === 'string' || typeof v === 'number').join(''))
  .filter(Boolean);

const render = async (data, props = {}) => {
  let root;
  await act(async () => {
    root = create(
      <ReceptionistVitalsProvider>
        <LiveQueueSection data={data} clinics={[]} onView={jest.fn()} onNavigate={jest.fn()} {...props} />
      </ReceptionistVitalsProvider>,
    );
  });
  return root;
};

test('shows the token with the doctor, next tokens, counts and wait estimate', async () => {
  const current = row('c1', 7, { status: 'in_progress', queueStatus: 'in_consultation' });
  const root = await render({
    currentPatients: [current],
    appointments: [current, row('w1', 8), row('w2', 9)],
    timing: { estimatedWaitMinutes: 15 },
  });
  const shown = texts(root);
  expect(shown).toEqual(expect.arrayContaining(['Now serving', '7', 'Patient 7', '#8', '#9', '15 min']));
});

test('shows an idle state and a clear queue when nobody is waiting', async () => {
  const root = await render({ currentPatients: [], appointments: [] });
  const shown = texts(root);
  expect(shown).toEqual(expect.arrayContaining(['No patient with the doctor', 'Queue is clear', '--']));
});

test('LED card opens the LED display section', async () => {
  const onNavigate = jest.fn();
  const root = await render({ currentPatients: [], appointments: [] }, { onNavigate });
  const button = root.root.findAllByType('Pressable').find(node => node.props.accessibilityRole === 'button');
  await act(async () => { button.props.onPress(); });
  expect(onNavigate).toHaveBeenCalledWith('led-display');
});
