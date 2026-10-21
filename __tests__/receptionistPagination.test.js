import React from 'react';
import { AppState } from 'react-native';
import { act, create } from 'react-test-renderer';
import api from '../src/axiosConfig';
import { fetchStaffAppointments } from '../src/features/receptionist/receptionistApi';
import AppointmentsSection from '../src/features/receptionist/sections/AppointmentsSection';
import ListPagination from '../src/features/receptionist/components/ListPagination';

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn() }));
jest.mock('../src/axiosConfig', () => ({ __esModule: true, default: { get: jest.fn() } }));
jest.mock('react-native-vector-icons/Ionicons', () => 'Icon');
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');
jest.mock('../src/components/TranslatedText', () => 'Text');
jest.mock('../src/components/common/ResponsiveLayout', () => ({ ResponsiveGrid: 'Grid', useResponsiveLayout: () => ({ isWide: false }) }));
jest.mock('../src/features/receptionist/receptionistUi', () => ({
  AlertBox: 'AlertBox', AppointmentRow: 'AppointmentRow', Card: 'Card', CardHeading: 'CardHeading',
  Empty: 'Empty', OptionSheet: 'OptionSheet', PatientDetailsSheet: 'PatientDetailsSheet', SelectField: 'SelectField', REC: {},
}));

const booking = (id, changes = {}) => ({ id: String(id), source: 'online', patientName: `Patient ${id}`, phoneNumber: '1234567890', date: '2026-10-15', status: 'booked', ...changes });
let root;
beforeEach(() => {
  AppState.currentState = 'active';
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-15T12:00:00+05:30'));
  api.get.mockReset();
});
afterEach(async () => {
  if (root) await act(async () => root.unmount());
  root = null;
  jest.useRealTimers();
});
const serveRows = rows => api.get.mockImplementation((url, { params }) => Promise.resolve({
  data: { appointments: rows.slice((params.page - 1) * 10, params.page * 10), total: rows.length, completed: 999, clinics: [] },
}));

test('23 appointments stay on three pages, with ten, ten and three records and no navigation requests', async () => {
  serveRows(Array.from({ length: 23 }, (_, i) => booking(i)));
  await act(async () => { root = create(<AppointmentsSection />); });
  const pager = () => root.root.findByType(ListPagination);
  expect(api.get).toHaveBeenCalledTimes(3);
  expect(pager().props.total).toBe(23);
  expect(root.root.findAllByType('AppointmentRow')).toHaveLength(10);
  await act(async () => pager().props.onPageChange(2));
  expect(pager().props.total).toBe(23);
  expect(pager().props.page).toBe(2);
  expect(root.root.findAllByType('AppointmentRow')).toHaveLength(10);
  expect(root.root.findAll(node => node.props.accessibilityLabel === 'Go to page 3').length).toBeGreaterThan(0);
  await act(async () => pager().props.onPageChange(3));
  expect(root.root.findAllByType('AppointmentRow')).toHaveLength(3);
  expect(api.get).toHaveBeenCalledTimes(3);
  await act(async () => pager().props.onPageChange(1));
  expect(root.root.findAllByType('AppointmentRow')[0].props.row.id).toBe('0');
});

test('removes orphans and duplicates across all server pages before counting and slicing', async () => {
  const rows = Array.from({ length: 23 }, (_, i) => booking(i));
  rows[12] = { id: 'orphan', patient: null };
  rows[13] = booking(13, { patientName: 'Deleted user', phoneNumber: '' });
  rows[14] = booking(0);
  serveRows(rows);
  const result = await fetchStaffAppointments({ page: 2 });
  expect(result.total).toBe(20);
  expect(result.appointments).toHaveLength(20);
  expect(result.completed).toBe(0);
  expect(api.get.mock.calls.map(([, options]) => options.params.page)).toEqual([1, 2, 3]);
});

test('keeps today after its appointment time and future dates, hides yesterday even if the API ignores from', async () => {
  serveRows([
    booking(1, { date: '2026-10-14', status: 'completed' }),
    booking(2, { time: '08:00', status: 'completed' }),
    booking(3, { date: '2026-10-16' }),
  ]);
  const result = await fetchStaffAppointments({ from: '2026-10-01' });
  expect(result.appointments.map(row => row.id)).toEqual(['2', '3']);
  expect(result.completed).toBe(1);
  expect(api.get.mock.calls[0][1].params.from).toBe('2026-10-15');
});

test('refresh after India midnight hides the previous day and clamps the selected page', async () => {
  jest.setSystemTime(new Date('2026-10-15T23:59:55+05:30'));
  serveRows([...Array.from({ length: 20 }, (_, i) => booking(i)), booking(20, { date: '2026-10-16' })]);
  await act(async () => { root = create(<AppointmentsSection />); });
  await act(async () => root.root.findByType(ListPagination).props.onPageChange(3));
  await act(async () => { await jest.advanceTimersByTimeAsync(15000); });
  const pager = root.root.findByType(ListPagination);
  expect(pager.props.page).toBe(1);
  expect(pager.props.total).toBe(1);
  expect(root.root.findAllByType('AppointmentRow')[0].props.row.id).toBe('20');
});

test('past-only date range is empty and does not request historical appointments', async () => {
  expect(await fetchStaffAppointments({ to: '2026-10-14' })).toMatchObject({ total: 0, appointments: [] });
  expect(api.get).not.toHaveBeenCalled();
});

test('failed later page rejects the collection instead of publishing a partial total', async () => {
  api.get.mockResolvedValueOnce({ data: { total: 23, appointments: Array.from({ length: 10 }, (_, i) => booking(i)) } });
  api.get.mockRejectedValueOnce(new Error('Offline'));
  await expect(fetchStaffAppointments()).rejects.toThrow('Offline');
});

test('India midnight expires old rows even when refresh fails offline', async () => {
  jest.setSystemTime(new Date('2026-10-15T23:59:55+05:30'));
  serveRows([booking(1), booking(2, { date: '2026-10-16' })]);
  await act(async () => { root = create(<AppointmentsSection />); });
  api.get.mockRejectedValue(new Error('Offline'));
  await act(async () => { await jest.advanceTimersByTimeAsync(5000); });
  expect(root.root.findByType(ListPagination).props.total).toBe(1);
  expect(root.root.findAllByType('AppointmentRow').map(node => node.props.row.id)).toEqual(['2']);
});
