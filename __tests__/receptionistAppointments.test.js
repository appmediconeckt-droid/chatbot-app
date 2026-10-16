import { appointmentStatuses, canRecordVitals, emergencyReasonOf, indiaToday, normalizeReceptionistAppointment } from '../src/features/receptionist/receptionistUtils';

test.each([
  { status: 'confirmed', queueStatus: 'skipped' },
  { status: 'skipped', queueStatus: 'skipped' },
  { appointment_status: 'skipped', queue_status: 'waiting' },
])('allows vitals for today\'s Next patient: %j', statuses => {
  expect(canRecordVitals({ date: indiaToday(), ...statuses })).toBe(true);
});

test.each([
  { status: 'completed' },
  { status: 'cancelled' },
  { queueStatus: 'in_progress' },
  { queueStatus: 'called' },
  { timing: { startedAt: '2026-10-15T06:00:00Z' } },
  { consultation_timing: JSON.stringify({ started_at: '2026-10-15T06:00:00Z' }) },
  { consultation_ended_at: '2026-10-15T06:30:00Z' },
  { date: '2000-01-01' },
])('keeps vitals read-only when a Next record is not eligible: %j', changes => {
  expect(canRecordVitals({ date: indiaToday(), status: 'confirmed', queueStatus: 'skipped', ...changes })).toBe(false);
});

test('deduplicates status aliases and keeps distinct booking and queue states', () => {
  expect(appointmentStatuses({ status: 'complete', queueStatus: 'Completed' })).toEqual(['completed']);
  expect(appointmentStatuses({ status: 'canceled', queueStatus: 'cancelled' })).toEqual(['cancelled']);
  expect(appointmentStatuses({ status: 'confirmed', queueStatus: 'waiting' })).toEqual(['confirmed', 'waiting']);
  expect(appointmentStatuses({})).toEqual([]);
});

test('normalizes patient details, emergency reason and consultation timing from staff records', () => {
  const row = normalizeReceptionistAppointment({
    _id: 'visit-1', patient: { fullName: 'Test patient', phoneNumber: '1234567890', age: 0, gender: 'Female' },
    appointment_date: '2026-10-15', appointment_time: '11:30', clinic_id: 'clinic-1', token_number: 0,
    appointment_status: 'confirmed', queue_status: 'called',
    symptoms: '[EMERGENCY] Breathing difficulty || Chest discomfort',
    consultation_timing: JSON.stringify({ started_at: '2026-10-15T06:00:00Z' }),
  });
  expect(row).toMatchObject({
    id: 'visit-1', patientName: 'Test patient', phoneNumber: '1234567890', age: 0, gender: 'Female',
    date: '2026-10-15', time: '11:30', clinicId: 'clinic-1', token: 0,
    status: 'confirmed', queueStatus: 'called', emergency: true,
    emergencyReason: 'Breathing difficulty', symptoms: 'Chest discomfort',
    timing: { startedAt: '2026-10-15T06:00:00Z' },
  });
});

test('uses the explicit emergency reason before a legacy symptom tag', () => {
  expect(emergencyReasonOf({ emergencyReason: ' ', emergency_reason: 'Current reason', symptoms: '[EMERGENCY] Old reason || Symptoms' })).toBe('Current reason');
  expect(normalizeReceptionistAppointment({ emergency: 'false', symptoms: 'Headache' }).emergency).toBe(false);
});
