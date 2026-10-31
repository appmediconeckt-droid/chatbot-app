jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

import { canUpdatePatientAvailability, groupQueue, indiaToday, normalizeReceptionistAppointment, QUEUE_TABS } from '../src/features/receptionist/receptionistUtils';
import { formatAppointment, sortByToken } from '../src/features/doctor/dashboard/api/doctorAppointments';

const patient = { id: 'appointment', source: 'online', date: indiaToday(), status: 'confirmed', queueStatus: 'waiting', timing: {} };

test('receptionist can update waiting, called and Next patients', () => {
  for (const source of ['online', 'walkin']) {
    for (const queueStatus of ['booked', 'waiting', 'called', 'skipped']) {
      expect(canUpdatePatientAvailability({ ...patient, source, queueStatus })).toBe(true);
    }
  }
});

test('availability controls stop after consultation or closure', () => {
  for (const status of ['completed', 'cancelled', 'rejected', 'no-show', 'in-progress', 'in_consultation']) {
    expect(canUpdatePatientAvailability({ ...patient, status })).toBe(false);
    expect(canUpdatePatientAvailability({ ...patient, queueStatus: status })).toBe(false);
  }
  expect(canUpdatePatientAvailability({ ...patient, timing: { startedAt: new Date().toISOString() } })).toBe(false);
});

test('availability is normalized from consultation timing', () => {
  const availability = { status: 'unavailable', updatedAt: new Date().toISOString() };
  expect(normalizeReceptionistAppointment({ ...patient, consultation_timing: JSON.stringify({ availability }) }).availability).toEqual(availability);
  expect(formatAppointment({ ...patient, _id: 'appointment', consultation_timing: JSON.stringify({ availability }) }).availability).toEqual(availability);
});

test('a returned patient keeps their token place in the doctor queue', () => {
  const returned = { id: 'returned', name: 'Returned', tokenNumber: 5, availability: { status: 'available', returnedAt: new Date().toISOString() } };
  const waiting = { id: 'waiting', name: 'Waiting', tokenNumber: 2, availability: { status: 'available' } };
  expect(sortByToken([returned, waiting]).map((appt) => appt.id)).toEqual(['waiting', 'returned']);
});

test('receptionist has no Next tab and still sees skipped patients in Pending', () => {
  expect(QUEUE_TABS.map((tab) => tab.key)).not.toContain('next');
  const skipped = { ...patient, id: 'skipped', queueStatus: 'skipped' };
  expect(groupQueue([skipped]).pending).toContain(skipped);
});

test('patients marked Unavailable leave Pending for the Unavailable tab until marked Available', () => {
  expect(QUEUE_TABS.map((tab) => tab.key)).toEqual(['pending', 'unavailable', 'in-progress', 'completed', 'cancelled']);
  const away = { ...patient, id: 'away', availability: { status: 'unavailable', updatedAt: new Date().toISOString() } };
  const back = { ...patient, id: 'back', availability: { status: 'available', returnedAt: new Date().toISOString() } };
  const groups = groupQueue([away, back]);
  expect(groups.unavailable.map((row) => row.id)).toEqual(['away']);
  expect(groups.pending.map((row) => row.id)).toEqual(['back']);
  // Once with the doctor, the visit is In Progress whatever the availability says.
  const started = { ...away, id: 'started', timing: { startedAt: new Date().toISOString() } };
  expect(groupQueue([started])['in-progress'].map((row) => row.id)).toEqual(['started']);
});
