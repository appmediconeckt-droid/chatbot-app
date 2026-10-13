// A doctor's consultation details (medicines, tests, diagnosis, advice,
// follow-up…) as stored on an appointment. Shared by the patient's
// Prescriptions screen and the doctor's Patients → Visit Details, so both
// read the same data the same way.

export const parseJsonArray = value => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value.trim().startsWith('[')) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const splitTimings = value =>
  (Array.isArray(value) ? value : String(value || '').split(','))
    .map(t => String(t).trim())
    .filter(t => t && t !== 'Select timing');

// The doctor form's text line: "Name - 1 Tablet (Morning, Night) - 5 days".
const MEDICINE_LINE = /^(.+?) - (.+?) \((.*?)\) - (.+)$/;

// Doctor medicines as { name, dosage, timings[], duration }: the structured
// list from the Complete Appointment form, else parsed from the text lines
// older consultations (and the current Railway backend) keep.
export const getDoctorMedicines = appt => {
  const structured = parseJsonArray(appt?.medicines)
    .filter(m => m?.name)
    .map(m => {
      const durationValue = m.durationValue ?? m.duration;
      return {
        name: m.name,
        dosage: m.dosage || '',
        timings: splitTimings(m.timings || m.timeOfDay || m.timing),
        duration: durationValue
          ? `${durationValue} ${String(m.durationType || '').toLowerCase()}`.trim()
          : '',
      };
    });
  if (structured.length) return structured;
  return String(appt?.medicine || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const match = line.match(MEDICINE_LINE);
      if (!match) return { name: line, dosage: '', timings: [], duration: '' };
      return {
        name: match[1].trim(),
        dosage: match[2] === 'Dosage' ? '' : match[2].trim(),
        timings: splitTimings(match[3]),
        duration: match[4].includes('?') ? '' : match[4].trim(),
      };
    });
};

export const getDoctorTests = appt => {
  const tests = parseJsonArray(appt?.recommended_tests || appt?.recommendedTests)
    .map(t => (typeof t === 'string' ? t : t?.testName || t?.name))
    .filter(Boolean);
  if (tests.length) return tests;
  return appt?.testName ? [appt.testName] : [];
};

// The backend keeps the doctor's consultation details (medicine, follow-up,
// tests, notes) packed as JSON in `notes`. Newer backends unpack it in the
// response; older ones send it raw, so unpack it here too.
export const unpackConsultationNotes = appt => {
  if (typeof appt?.notes !== 'string') return appt;
  try {
    const packed = JSON.parse(appt.notes);
    if (packed?.__doctorConsultation === 1) {
      return { ...appt, ...packed.details, notes: packed.originalNotes };
    }
  } catch {
    // Plain-text patient notes.
  }
  return appt;
};
