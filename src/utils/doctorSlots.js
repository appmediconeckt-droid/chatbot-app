// Bookable slots of a doctor, from the public
//   GET /api/availability/available?doctor_id=<id>
//   → { availableRanges, unavailableDates, bookedSlots }
// Same rules as the patient's DoctorBookingModal: a range applies to one date
// (`date` / `availability_date`) or, when recurring, to a weekday; a clinic's
// unavailable date blocks it; times are clinic-local (IST). Slots already
// booked, and on today any slot that has started, are left out.

const pad = (n) => String(n).padStart(2, '0');

// India date (YYYY-MM-DD) / minutes since midnight, right now.
export const todayIndia = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10);
export const nowMinutesIndia = () => {
  const d = new Date(Date.now() + 330 * 60000);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
};

// Days from `todayIso` (India) through the last day of next month — how far
// ahead a patient can book.
export const bookingWindowDays = (todayIso = todayIndia()) => {
  const [y, m, d] = todayIso.split('-').map(Number);
  const lastOfNextMonth = Date.UTC(y, m + 1, 0); // month m is next month (0-based)
  return Math.round((lastOfNextMonth - Date.UTC(y, m - 1, d)) / 86400000) + 1;
};

// The next `count` days from today (India), with their weekday.
export const upcomingDays = (count = 7) => Array.from({ length: count }, (_, i) => {
  const d = new Date(`${todayIndia()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + i);
  return { iso: d.toISOString().slice(0, 10), weekday: d.getUTCDay() };
});

export const minutesToTime24 = (minutes) => `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
export const minutesToLabel = (minutes) => {
  const h = Math.floor(minutes / 60);
  return `${h % 12 || 12}:${pad(minutes % 60)} ${h >= 12 ? 'PM' : 'AM'}`;
};

const toMinutes = (value) => {
  const m = /(\d{1,2}):(\d{2})\s*(AM|PM)?/i.exec(String(value || ''));
  if (!m) return null;
  let h = Number(m[1]);
  const ampm = (m[3] || '').toUpperCase();
  if (ampm === 'PM' && h !== 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  return h * 60 + Number(m[2]);
};

const sameClinic = (item, clinicId) => !clinicId || !item?.clinic_id || String(item.clinic_id) === String(clinicId);
const isUnavailableFlag = (range) => range.is_unavailable === true || Number(range.is_unavailable) === 1;

const rangesForDate = (ranges, unavailableDates, clinicId, iso, weekday) => {
  const blocked = (unavailableDates || []).some((item) =>
    sameClinic(item, clinicId) && String(item?.date || item?.unavailable_date || item).slice(0, 10) === iso);
  if (blocked) return [];
  return (ranges || []).filter((range) => {
    if (!sameClinic(range, clinicId) || isUnavailableFlag(range)) return false;
    const rangeDate = String(range.date || range.availability_date || '').slice(0, 10);
    const recurrence = String(range.recurrence || '').toLowerCase();
    return rangeDate
      ? rangeDate === iso
      : recurrence !== 'date' && range.weekday != null && range.weekday !== '' && Number(range.weekday) === weekday;
  });
};

// "YYYY-MM-DD|minutes" keys of booked slots. The API's entries can be plain
// strings ("2026-10-01T12:15", "2026-10-01 12:15") or objects with a date and
// a time under various names.
export const bookedSlotKeys = (bookedSlots, clinicId) => {
  const keys = new Set();
  (bookedSlots || []).forEach((entry) => {
    if (entry && typeof entry === 'object' && !sameClinic(entry, clinicId)) return;
    const text = typeof entry === 'string' ? entry : '';
    const iso = String(
      (entry && typeof entry === 'object'
        ? entry.date || entry.appointment_date || entry.appointmentDate || entry.slot_date
        : text) || '',
    ).slice(0, 10);
    const time = entry && typeof entry === 'object'
      ? entry.time || entry.appointment_time || entry.appointmentTime || entry.start_time || entry.slot_time
      : text.slice(11);
    const minutes = toMinutes(time);
    if (/^\d{4}-\d{2}-\d{2}$/.test(iso) && minutes != null) keys.add(`${iso}|${minutes}`);
  });
  return keys;
};

// "YYYY-MM-DD|minutes" of one appointment / walk-in row (clinic-local IST),
// or null when it has no usable date + time.
export const slotKeyOfAppointment = (apt) => {
  let iso = String(apt?.appointment_date || apt?.appointmentDate || '').slice(0, 10);
  let time = apt?.appointment_time || apt?.appointmentTime || '';
  if ((!iso || !time) && Number.isFinite(Date.parse(apt?.date))) {
    const ist = new Date(Date.parse(apt.date) + 330 * 60000).toISOString();
    iso = iso || ist.slice(0, 10);
    time = time || ist.slice(11, 16);
  }
  const minutes = toMinutes(time);
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && minutes != null ? `${iso}|${minutes}` : null;
};

const INACTIVE_STATUSES = new Set(['cancelled', 'canceled', 'rejected', 'completed', 'no-show', 'no_show']);

// Keys of a patient's own active appointments with one doctor.
export const ownBookedKeys = (appointments, doctorId) => {
  const keys = new Set();
  (appointments || []).forEach((apt) => {
    const docId = apt?.counselor?._id || apt?.counselor?.id
      || (typeof apt?.counselor === 'string' ? apt.counselor : '')
      || apt?.doctor_id || apt?.doctorId || apt?.doctor?._id || apt?.doctor?.id;
    if (String(docId || '') !== String(doctorId)) return;
    if (INACTIVE_STATUSES.has(String(apt?.status || '').toLowerCase())) return;
    const key = slotKeyOfAppointment(apt);
    if (key) keys.add(key);
  });
  return keys;
};

// The doctor's availability ranges (sessions) on one day, in minutes from
// midnight IST: [{ start, end, clinicId }]. Used to tell when a session is over.
export const sessionRangesForDay = ({ ranges, unavailableDates, iso, weekday }) =>
  rangesForDate(ranges, unavailableDates, null, iso, weekday)
    .map((range) => ({
      start: toMinutes(range.start_time),
      end: toMinutes(range.end_time),
      clinicId: range.clinic_id ? String(range.clinic_id) : '',
    }))
    .filter((r) => r.start != null && r.end != null && r.end > r.start);

// Minutes from midnight (IST) of an appointment's slot, or null.
export const slotMinutesOfAppointment = (apt) => {
  const key = slotKeyOfAppointment(apt);
  return key ? Number(key.split('|')[1]) : null;
};

// Bookable slots on one day: [{ minutes, time24: 'HH:MM', label: 'h:mm AM' }].
export const slotsForDay = ({ ranges, unavailableDates, booked, clinicId, iso, weekday }) => {
  const cutoff = iso === todayIndia() ? nowMinutesIndia() : -1;
  const slots = new Map();
  rangesForDate(ranges, unavailableDates, clinicId, iso, weekday).forEach((range) => {
    const start = toMinutes(range.start_time);
    const end = toMinutes(range.end_time);
    const duration = Math.max(1, Number(range.slot_duration || 15));
    if (start == null || end == null || end <= start) return;
    for (let cursor = start; cursor + duration <= end; cursor += duration) {
      if (cursor > cutoff && !booked?.has(`${iso}|${cursor}`)) {
        slots.set(cursor, { minutes: cursor, time24: minutesToTime24(cursor), label: minutesToLabel(cursor) });
      }
    }
  });
  return Array.from(slots.values()).sort((a, b) => a.minutes - b.minutes);
};
