export const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];

// "a +ve" / "AB Positive" / "o-" → "A+" / "AB+" / "O-"; '' when not a group.
export const normalizeBloodGroup = (value) => {
  const text = String(value ?? '').trim().toUpperCase()
    .replace(/\s+/g, '')
    .replace(/(POSITIVE|POS|\+VE)$/, '+')
    .replace(/(NEGATIVE|NEG|-VE)$/, '-');
  return BLOOD_GROUPS.includes(text) ? text : '';
};

export const VITAL_FIELDS = [
  ['blood_group', 'Blood group', ''],
  ['blood_pressure', 'Blood pressure', 'mmHg'],
  ['pulse', 'Pulse', 'beats/min'],
  ['temperature', 'Temperature', ''],
  ['spo2', 'SpO₂', '%'],
  ['respiratory_rate', 'Breathing rate', 'breaths/min'],
  ['weight', 'Weight', 'kg'],
  ['height', 'Height', 'cm'],
  ['pain_score', 'Pain score', '/10'],
];

export const hasVitalValue = value => value !== undefined && value !== null
  && !['', 'n/a', 'not recorded', '--'].includes(String(value).trim().toLowerCase());

const first = (...values) => values.find(hasVitalValue);
const object = value => {
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { return {}; }
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
};

export function getAppointmentVitals(appointment = {}) {
  const raw = object(appointment.__raw);
  const stored = object(appointment.vitals ?? raw.vitals);
  const value = { ...raw, ...appointment, ...stored };
  return {
    blood_pressure: first(stored.blood_pressure, stored.bp, stored.bloodPressure, value.blood_pressure, value.bp, value.bloodPressure),
    pulse: first(stored.pulse, stored.heartRate, stored.heart_rate, value.pulse, value.heartRate, value.heart_rate),
    // Only from the recorded vitals — never the patient's own profile field.
    blood_group: normalizeBloodGroup(first(stored.blood_group, stored.bloodGroup)) || undefined,
    temperature: first(value.temperature, value.temp),
    temperature_unit: first(value.temperature_unit, value.temperatureUnit, 'C'),
    spo2: first(value.spo2, value.oxygen_saturation, value.oxygenSaturation),
    respiratory_rate: first(value.respiratory_rate, value.respiratoryRate),
    weight: value.weight,
    height: value.height,
    pain_score: first(value.pain_score, value.painScore),
    // Appointment notes describe the visit; only measurement notes belong here.
    notes: first(stored.notes, value.vitals_notes, value.vitalsNotes),
    recorded_at: first(value.recorded_at, value.recordedAt, value.vitals_recorded_at, value.vitalsRecordedAt),
    recorded_role: first(value.recorded_role, value.recordedRole, value.vitals_recorded_role, value.vitalsRecordedRole),
  };
}

export const hasAppointmentVitals = appointment => {
  if (!appointment) return false;
  const vitals = getAppointmentVitals(appointment);
  return VITAL_FIELDS.some(([key]) => hasVitalValue(vitals[key]));
};

export const hasReceptionistVitals = appointment => hasAppointmentVitals(appointment)
  && String(getAppointmentVitals(appointment).recorded_role || '').trim().toLowerCase() === 'receptionist';
