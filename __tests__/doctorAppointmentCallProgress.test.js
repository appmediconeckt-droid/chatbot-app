jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

import {
  MAX_UNANSWERED_APPOINTMENT_CALLS,
  unansweredAppointmentCalls,
  updateAppointmentCallProgress,
} from '../src/features/doctor/dashboard/doctorAppointmentCallProgress';

test('Next is reached after two distinct unanswered calls', () => {
  let calls = updateAppointmentCallProgress([], 'first', 'started');
  calls = updateAppointmentCallProgress(calls, 'first', 'unanswered');
  expect(unansweredAppointmentCalls(calls)).toBe(1);
  calls = updateAppointmentCallProgress(calls, 'second', 'started');
  calls = updateAppointmentCallProgress(calls, 'second', 'unanswered');
  expect(unansweredAppointmentCalls(calls)).toBe(MAX_UNANSWERED_APPOINTMENT_CALLS);
});

test('duplicate events for one call do not consume another attempt', () => {
  let calls = updateAppointmentCallProgress([], 'first', 'started');
  calls = updateAppointmentCallProgress(calls, 'first', 'unanswered');
  calls = updateAppointmentCallProgress(calls, 'first', 'unanswered');
  expect(unansweredAppointmentCalls(calls)).toBe(1);
  expect(calls).toHaveLength(1);
});

test('an answered call is never counted as unanswered', () => {
  let calls = updateAppointmentCallProgress([], 'answered', 'started');
  calls = updateAppointmentCallProgress(calls, 'answered', 'answered');
  calls = updateAppointmentCallProgress(calls, 'answered', 'unanswered');
  expect(unansweredAppointmentCalls(calls)).toBe(0);
});

test('failed initiation and unrelated termination do not count', () => {
  expect(updateAppointmentCallProgress([], null, 'started')).toEqual([]);
  expect(updateAppointmentCallProgress([], 'unknown', 'unanswered')).toEqual([]);
});
