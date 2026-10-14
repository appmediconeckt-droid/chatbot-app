// The walk-in API stores only a few fields (no priority / is_emergency /
// emergency_reason), so an emergency walk-in is marked inside `symptoms`:
//   "[EMERGENCY] <reason> || <problem>"
// The patient's QR walk-in form writes it; the doctor's queue reads it to put
// the token first and show the reason. The tag itself is never displayed.
export const EMERGENCY_TAG = '[EMERGENCY]';
const SEPARATOR = '||';

export const tagEmergencySymptoms = (problem, reason) =>
  `${EMERGENCY_TAG} ${String(reason || '').trim()} ${SEPARATOR} ${String(problem || '').trim()}`;

export const parseEmergencySymptoms = (value) => {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text.startsWith(EMERGENCY_TAG)) return { isEmergency: false, reason: '', problem: text };
  const body = text.slice(EMERGENCY_TAG.length).trim();
  const split = body.indexOf(SEPARATOR);
  if (split < 0) return { isEmergency: true, reason: body, problem: '' };
  return {
    isEmergency: true,
    reason: body.slice(0, split).trim(),
    problem: body.slice(split + SEPARATOR.length).trim(),
  };
};

// The patient's problem without the tag (non-strings pass through unchanged).
export const stripEmergencyTag = (value) =>
  (typeof value === 'string' ? parseEmergencySymptoms(value).problem : value);
