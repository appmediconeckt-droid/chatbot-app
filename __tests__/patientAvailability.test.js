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

test('returned patients move to the front of the doctor queue', () => {
  const returned = { id: 'returned', name: 'Returned', availability: { status: 'available', returnedAt: new Date().toISOString() } };
  const waiting = { id: 'waiting', name: 'Waiting', availability: { status: 'available' } };
  expect(sortByToken([waiting, returned])[0]).toBe(returned);
});

test('receptionist has no Next tab and still sees skipped patients in Pending', () => {
  expect(QUEUE_TABS.map((tab) => tab.key)).not.toContain('next');
  const skipped = { ...patient, id: 'skipped', queueStatus: 'skipped' };
  expect(groupQueue([skipped]).pending).toContain(skipped);
});
