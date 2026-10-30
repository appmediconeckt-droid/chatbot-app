import React from 'react';
import { act, create } from 'react-test-renderer';
import LedDisplaySection from '../src/features/receptionist/sections/LedDisplaySection';
import { fetchDisplayQueue, fetchDoctorDisplays } from '../src/features/receptionist/receptionistApi';

jest.mock('react-native', () => ({
  View: 'View', Text: 'Text', TextInput: 'TextInput', Pressable: 'Pressable',
  ScrollView: 'ScrollView', Modal: 'Modal', Image: 'Image', ActivityIndicator: 'ActivityIndicator',
  StyleSheet: { create: value => value }, Keyboard: { dismiss: jest.fn() },
  AppState: { currentState: 'active', addEventListener: jest.fn(() => ({ remove: jest.fn() })) },
  useWindowDimensions: () => ({ width: 390, height: 844, scale: 1, fontScale: 1 }),
  Platform: { OS: 'android' }, Alert: { alert: jest.fn() }, Linking: { openURL: jest.fn(() => Promise.resolve()) },
  Share: { share: jest.fn(() => Promise.resolve()) },
}));
jest.mock('react-native/Libraries/Components/Clipboard/Clipboard', () => ({ setString: jest.fn() }));
jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');
jest.mock('react-native-linear-gradient', () => 'LinearGradient');
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../src/components/TranslatedText', () => 'Text');
jest.mock('../src/axiosConfig', () => ({
  __esModule: true, API_BASE_URL: 'https://example.test/api', default: { get: jest.fn(), patch: jest.fn() },
}));
jest.mock('../src/features/receptionist/receptionistApi', () => ({
  apiError: (_err, fallback) => fallback,
  fetchDoctorDisplays: jest.fn(),
  fetchDisplayQueue: jest.fn(),
}));

const profile = { assignedDoctor: 'doc-1', assignedDoctorName: 'Dr Test' };

const texts = (root) => root.root.findAllByType('Text')
  .map(node => [].concat(node.props.children).filter(v => typeof v === 'string' || typeof v === 'number').join(''))
  .filter(Boolean);

const render = async () => {
  let root;
  await act(async () => {
    root = create(<LedDisplaySection profile={profile} clinic="" onNavigate={jest.fn()} />);
  });
  await act(async () => {});
  return root;
};

afterEach(() => { jest.clearAllMocks(); });

test('shows the clinic, the live TV preview and the LED link', async () => {
  jest.useFakeTimers();
  fetchDoctorDisplays.mockResolvedValue([{ doctorClinicId: 'dc-1', clinic: { name: 'City Clinic', room: '2' } }]);
  fetchDisplayQueue.mockResolvedValue({
    current: { token: 14, status: 'in_progress' }, nextTokens: [15, 16], waitingCount: 3, completedCount: 9, estimatedWaitMinutes: 20,
  });
  const root = await render();
  const shown = texts(root);
  expect(shown).toEqual(expect.arrayContaining([
    'City Clinic - Room 2', 'NOW SERVING', '14', '15', '16', '3', '9', '20 min',
    'https://example.test/display/clinic/dc-1',
  ]));
  act(() => { root.unmount(); });
  jest.useRealTimers();
});

test('shows an empty state with reload when the doctor has no display', async () => {
  fetchDoctorDisplays.mockResolvedValue([]);
  const root = await render();
  expect(texts(root)).toEqual(expect.arrayContaining(['No clinic display available', 'Reload displays']));
  expect(fetchDisplayQueue).not.toHaveBeenCalled();
});
