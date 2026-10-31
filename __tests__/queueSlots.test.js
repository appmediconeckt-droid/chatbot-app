import { groupQueueBySession, orderBySession, slotRangeLabel } from '../src/utils/queueSlots';
import { groupQueue, queueDoctorId, rowSlotInfo, sortQueue } from '../src/features/receptionist/receptionistUtils';
import { sortByToken } from '../src/features/doctor/dashboard/api/doctorAppointments';

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn().mockResolvedValue(null) }));
jest.mock('../src/axiosConfig', () => ({ __esModule: true, default: { get: jest.fn(), defaults: { baseURL: '' } } }));

const today = '2026-10-30';
const availability = {
  ranges: [{ date: today, start_time: '12:00', end_time: '13:00', slot_duration: 5 }],
  unavailableDates: [],
};
const row = (id, time, token, createdAt, extra = {}) => ({ id, date: today, time, token, createdAt, ...extra });

test('receptionist queue: emergency first, then token number', () => {
  const rows = sortQueue([
    row('t9', '12:10:00', 9, '2026-10-30T09:00:00Z'),
    row('t4', '12:29:00', 4, '2026-10-30T11:05:00Z'),
    row('sos', '12:45:00', 12, '2026-10-30T11:50:00Z', { emergency: true }),
    row('t6', '12:25:00', 6, '2026-10-30T10:20:00Z'),
  ]);
  expect(rows.map((r) => r.id)).toEqual(['sos', 't4', 't6', 't9']);
});

test('receptionist queue falls back to slot time when tokens are missing', () => {
  const rows = sortQueue([row('b', '12:30', undefined), row('a', '12:05', undefined)]);
  expect(rows.map((r) => r.id)).toEqual(['a', 'b']);
});

test('receptionist In Progress goes by token too', () => {
  const started = { timing: { startedAt: '2026-10-30T12:00:00Z' } };
  const groups = groupQueue([
    row('t5', '12:05', 5, '2026-10-30T09:00:00Z', started),
    row('t2', '12:30', 2, '2026-10-30T11:00:00Z', started),
  ]);
  expect(groups['in-progress'].map((r) => r.id)).toEqual(['t2', 't5']);
});

test('doctor queue: emergency first, then token number', () => {
  const appt = (id, token, time, createdAt, extra = {}) => ({
    id, name: id, status: 'confirmed', tokenNumber: token,
    __raw: { appointment_date: today, appointment_time: time, created_at: createdAt, ...extra },
  });
  const rows = sortByToken([
    appt('t6', 6, '16:10', '2026-10-30T09:40:00Z'),
    appt('t4', 4, '16:00', '2026-10-30T10:05:00Z'),
    appt('t3', 3, '15:55', '2026-10-30T10:30:00Z'),
    appt('sos', 9, '16:45', '2026-10-30T11:50:00Z', { priority: 'emergency' }),
  ]);
  expect(rows.map((r) => r.id)).toEqual(['sos', 't3', 't4', 't6']);
});

const opts = (nowMinutes) => ({ nowMinutes, today });
const summary = (sections) => sections.map((s) => [s.kind === 'session' ? slotRangeLabel(s) : s.kind, s.state, s.rows.map((r) => r.id).join(',')]);

test('one heading per doctor session, not per patient, each in booking order', () => {
  const twoSessions = {
    ranges: [
      { availability_date: today, start_time: '15:30', end_time: '16:30', slot_duration: 5 },
      { availability_date: today, start_time: '17:00', end_time: '18:00', slot_duration: 5 },
    ],
    unavailableDates: [],
  };
  // Sorted the way the screens sort (emergency, token); #4b is in the 5 PM session.
  const rows = sortQueue([row('t6', '16:10', 6), row('t4b', '17:00', 4), row('t3', '15:55', 3), row('t4', '16:00', 4.1), row('sos', '17:20', 9, '', { emergency: true })]);
  expect(summary(groupQueueBySession(rows, rowSlotInfo, twoSessions, opts(16 * 60 + 27)))).toEqual([
    ['emergency', 'emergency', 'sos'],
    ['3:30 PM – 4:30 PM', 'current', 't3,t4,t6'],
    ['5:00 PM – 6:00 PM', 'upcoming', 't4b'],
  ]);
  expect(orderBySession(rows, rowSlotInfo, twoSessions, opts(16 * 60)).map((r) => r.id)).toEqual(['sos', 't3', 't4', 't6', 't4b']);
  const [, , later] = groupQueueBySession(rows, rowSlotInfo, twoSessions, opts(18 * 60 + 5));
  expect(later.state).toBe('past');
});

test('without availability the list is one section from the earliest to the latest booking', () => {
  const rows = [row('a', '12:29', 1), row('b', '12:10', 2), row('x', '', 3)];
  expect(summary(groupQueueBySession(rows, rowSlotInfo, undefined, opts(12 * 60 + 15)))).toEqual([
    ['12:10 PM – 12:29 PM', 'current', 'a,b'],
    ['untimed', 'untimed', 'x'],
  ]);
});

test('receptionist reads the doctor id for slot timing even when the dashboard doctor has only a name', () => {
  expect(queueDoctorId({ doctor: { _id: 'd1' } })).toBe('d1');
  expect(queueDoctorId({ doctor: { fullName: 'Dr. A' } }, { assignedDoctor: { _id: 'd2' } })).toBe('d2');
  expect(queueDoctorId({ doctor: { fullName: 'Dr. A' }, waiting: [{ doctor_id: 'd3' }] })).toBe('d3');
  expect(queueDoctorId({ appointments: [{ doctor: { _id: 'd4' } }] })).toBe('d4');
  expect(queueDoctorId({})).toBe('');
});

test('slot timing also reads the saved ranges, so a session already running still has its range', async () => {
  const React = require('react');
  const { act, create } = require('react-test-renderer');
  const api = require('../src/axiosConfig').default;
  const { useDoctorAvailability } = require('../src/utils/queueSlots');
  api.get.mockImplementation((url) => Promise.resolve({
    data: url === '/api/availability/ranges'
      ? { existingRanges: [{ _id: 'r1', date: today, start_time: '12:00', end_time: '13:00' }] }
      : { availableRanges: [{ _id: 'r2', date: today, start_time: '17:00', end_time: '18:00' }] },
  }));
  let seen;
  const Probe = () => { seen = useDoctorAvailability('d1'); return null; };
  let tree;
  await act(async () => { tree = create(React.createElement(Probe)); });
  expect(seen.ranges.map((r) => r._id)).toEqual(['r1', 'r2']);
  const [range] = groupQueueBySession([row('a', '12:29', 1)], rowSlotInfo, seen, opts(12 * 60 + 30));
  expect(slotRangeLabel(range)).toBe('12:00 PM – 1:00 PM');
  await act(async () => { tree.unmount(); });
});

test('a booking outside every session shows its own slot from the slot length, and is over once it passed', () => {
  const saved = {
    ranges: [{ availability_date: today, weekday: 5, start_time: '12:25', end_time: '13:25', slot_duration: 5 }],
    unavailableDates: [],
  };
  const [range] = groupQueueBySession([row('vishal', '10:35', 2)], rowSlotInfo, saved, opts(15 * 60 + 29));
  expect(slotRangeLabel(range)).toBe('10:35 AM – 10:40 AM');
  expect(range.state).toBe('past');
});
