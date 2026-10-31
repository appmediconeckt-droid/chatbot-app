// Queue sections, one per doctor session, so the doctor and the reception
// desk see which session (slot range) each patient booked — the range once
// above that session's patients, not under every patient.
//
// Session timing comes from the doctor's availability (same endpoints as the
// booking modal and the doctor's calendar): with a 12:00–1:00 session,
// bookings at 12:10 and 12:45 sit under "12:00 PM – 1:00 PM".
import { useEffect, useState } from 'react';
import axiosInstance from '../axiosConfig';
import { minutesToLabel, nowMinutesIndia, sessionRangesForDay, todayIndia } from './doctorSlots';

const EMPTY_AVAILABILITY = { ranges: [], unavailableDates: [] };

const listOf = (data, keys) => {
  const found = [data, ...keys.map((key) => data?.[key]), data?.data?.ranges, data?.data?.existingRanges]
    .find(Array.isArray);
  return found || [];
};
const rangeKey = (range) => String(range?._id || range?.id || [
  range?.clinic_id, range?.date || range?.availability_date, range?.weekday, range?.start_time, range?.end_time,
].join('|'));

// The doctor's sessions. "/available" lists only ranges that still have free
// slots, so a session already running (or fully booked) is missing there —
// the saved ranges ("/ranges", as the doctor's calendar reads them) fill it in.
export const useDoctorAvailability = (doctorId) => {
  const [availability, setAvailability] = useState(EMPTY_AVAILABILITY);
  useEffect(() => {
    if (!doctorId) return undefined;
    let cancelled = false;
    const params = { doctor_id: doctorId };
    const get = (url) => Promise.resolve().then(() => axiosInstance.get(url, { params })).then((res) => res?.data, () => null);
    Promise.all([get('/api/availability/ranges'), get('/api/availability/available')]).then(([saved, open]) => {
      if (cancelled) return;
      const ranges = new Map();
      [...listOf(saved, ['existingRanges', 'ranges', 'availableRanges', 'data']),
        ...listOf(open, ['availableRanges', 'existingRanges', 'ranges', 'data'])]
        .forEach((range) => { if (range && !ranges.has(rangeKey(range))) ranges.set(rangeKey(range), range); });
      setAvailability({
        ranges: [...ranges.values()],
        unavailableDates: [...(saved?.unavailableDates || []), ...(open?.unavailableDates || [])],
      });
    });
    return () => { cancelled = true; };
  }, [doctorId]);
  return availability;
};

const weekdayOf = (iso) => new Date(`${iso}T12:00:00Z`).getUTCDay();

// The availability session holding one booking, or null.
const sessionOf = (info, availability) => {
  const iso = info.iso || todayIndia();
  const sessions = sessionRangesForDay({ ...availability, iso, weekday: weekdayOf(iso) });
  const own = sessions.filter((session) => !info.clinicId || !session.clinicId || session.clinicId === String(info.clinicId));
  return (own.length ? own : sessions).find((session) => info.minutes >= session.start && info.minutes < session.end) || null;
};

// Slot length (minutes) the doctor uses on that day — that date's ranges
// first, then any range of the clinic, then any range. Null when unknown.
const slotMinutesOf = (info, availability) => {
  const ranges = (availability.ranges || []).filter((range) => Number(range?.slot_duration) > 0);
  const sameClinic = (range) => !info.clinicId || !range.clinic_id || String(range.clinic_id) === String(info.clinicId);
  const sameDay = (range) => String(range.availability_date || range.date || '').slice(0, 10) === (info.iso || todayIndia());
  const range = ranges.find((r) => sameDay(r) && sameClinic(r)) || ranges.find(sameDay) || ranges.find(sameClinic) || ranges[0];
  return range ? Number(range.slot_duration) : null;
};

export const slotRangeLabel = (range) => (range.end != null
  ? `${minutesToLabel(range.start)} – ${minutesToLabel(range.end)}`
  : minutesToLabel(range.start));

const KIND_ORDER = { emergency: 0, session: 1, untimed: 2 };

// One section per doctor session (availability range), so the doctor and the
// desk can tell which session each patient booked: emergencies first, then
// sessions by date and start time, then bookings with no time. Inside a
// section the given (booking) order is kept. A booking outside every session
// gets its own slot (booked time + slot length). Without any availability the
// whole list is one section, from the earliest to the latest booking.
// `infoOf(row)` = { emergency, minutes, iso, clinicId }. Each section:
// { key, kind, start, end, rows, count, state } — state is 'current'
// (running now), 'past' (over, patients still waiting) or 'upcoming'.
export const groupQueueBySession = (rows, infoOf, availability = EMPTY_AVAILABILITY, {
  nowMinutes = nowMinutesIndia(), today = todayIndia(),
} = {}) => {
  const known = (availability.ranges || []).length > 0;
  const byKey = new Map();
  const add = (key, base, row) => {
    const section = byKey.get(key) || { key, ...base, rows: [] };
    section.rows.push(row);
    byKey.set(key, section);
    return section;
  };
  rows.forEach((row) => {
    const info = infoOf(row) || {};
    if (info.emergency) { add('emergency', { kind: 'emergency' }, row); return; }
    if (info.minutes == null) { add('untimed', { kind: 'untimed' }, row); return; }
    const iso = info.iso || today;
    if (!known) {
      const section = add('all', { kind: 'session', iso, start: info.minutes, end: info.minutes }, row);
      section.start = Math.min(section.start, info.minutes);
      section.end = Math.max(section.end, info.minutes);
      return;
    }
    const session = sessionOf(info, availability);
    if (session) { add(`${iso}|${session.start}`, { kind: 'session', iso, start: session.start, end: session.end }, row); return; }
    // Outside every session (e.g. the session was changed after booking).
    const length = slotMinutesOf(info, availability) || 0;
    add(`${iso}|at|${info.minutes}`, { kind: 'session', iso, start: info.minutes, end: info.minutes + length }, row);
  });
  return [...byKey.values()]
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]
      || String(a.iso || '').localeCompare(String(b.iso || ''))
      || (a.start ?? 0) - (b.start ?? 0))
    .map((section) => {
      const end = section.end != null && section.end > section.start ? section.end : null;
      let state = section.kind;
      if (section.kind === 'session') {
        if (section.iso !== today) state = section.iso < today ? 'past' : 'upcoming';
        else if (nowMinutes < section.start) state = 'upcoming';
        else if (end != null && nowMinutes >= end) state = 'past';
        else state = 'current';
      }
      return { ...section, end, count: section.rows.length, state };
    });
};

// The queue in the order the sections show it.
export const orderBySession = (rows, infoOf, availability, options) =>
  groupQueueBySession(rows, infoOf, availability, options).flatMap((section) => section.rows);
