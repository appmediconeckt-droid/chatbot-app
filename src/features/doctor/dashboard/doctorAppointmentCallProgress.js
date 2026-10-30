import AsyncStorage from '@react-native-async-storage/async-storage';

export const MAX_UNANSWERED_APPOINTMENT_CALLS = 2;

export const appointmentCallProgressKey = (doctorId, appointment = {}) =>
  `doctor-appointment-calls:${doctorId || ''}:${appointment.appointmentSource || 'online'}:${appointment.apiId || appointment.id || ''}`;

export const unansweredAppointmentCalls = (calls = []) =>
  calls.filter((call) => call.finished && !call.answered).length;

export function updateAppointmentCallProgress(calls = [], callId, event) {
  if (!callId) return calls;
  const id = String(callId);
  const previous = calls.find((call) => call.id === id);
  if (!previous && event !== 'started' && event !== 'answered') return calls;
  const next = {
    ...(previous || { id, answered: false, finished: false }),
    ...(event === 'answered' ? { answered: true } : {}),
    ...(event === 'unanswered' ? { finished: true } : {}),
  };
  return previous ? calls.map((call) => (call.id === id ? next : call)) : [...calls, next];
}

export async function readAppointmentCallProgress(key) {
  try {
    const calls = JSON.parse((await AsyncStorage.getItem(key)) || '[]');
    return Array.isArray(calls)
      ? calls.filter((call) => typeof call?.id === 'string' && typeof call.answered === 'boolean' && typeof call.finished === 'boolean')
      : [];
  } catch {
    return [];
  }
}

export async function saveAppointmentCallProgress(key, calls = []) {
  try {
    if (calls.length) await AsyncStorage.setItem(key, JSON.stringify(calls));
    else await AsyncStorage.removeItem(key);
  } catch {
    return false;
  }
  return true;
}
