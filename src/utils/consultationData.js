// Keep stored consultation notes and JSON lists compatible with the web client.
const parse = value => {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return value; }
};

export const consultationList = value => {
  const parsed = parse(value);
  return Array.isArray(parsed) ? parsed : [];
};

export function consultationData(record = {}) {
  const notes = parse(record.notes);
  const saved = notes?.__doctorConsultation === 1 && notes.details && typeof notes.details === 'object'
    ? notes.details : {};
  const result = { ...saved, ...record };
  for (const field of ['medicine', 'follow_up_date', 'additional_notes']) {
    if (result[field] === undefined || result[field] === null || result[field] === '') result[field] = saved[field];
  }
  result.medicines = consultationList(record.medicines);
  if (!result.medicines.length) result.medicines = consultationList(saved.medicines);
  result.recommendedTests = consultationList(record.recommendedTests || record.recommended_tests);
  if (!result.recommendedTests.length) result.recommendedTests = consultationList(saved.recommendedTests || saved.recommended_tests);
  if (notes?.__doctorConsultation === 1) result.notes = notes.originalNotes || '';
  return result;
}
