// New-booking alerts for the receptionist. The portal re-reads the dashboard
// feed every few seconds; any booking that was not in the previous read is a
// new arrival, shown as a phone notification (emergencies called out). The
// first read only records what is already there, so opening the app does not
// replay the whole day.
import { useEffect, useRef } from 'react';
import { displaySystemNotification } from '../../../services/notificationService';
import { clockLabel, dedupeRows, indiaToday, patientKey } from '../receptionistUtils';
import { translatePhrase } from '../../../hooks/useSmartT';

const MAX_SINGLE_ALERTS = 3;

const feedRows = (data) => dedupeRows([...(data?.currentPatients || []), ...(data?.waiting || []), ...(data?.appointments || [])])
  .filter((row) => {
    const day = String(row.date || '').slice(0, 10);
    return !day || day === indiaToday();
  });

const describe = (row) => {
  // System notifications are drawn outside the app's text components, so the
  // words come from the dictionary here; the patient's name stays as written.
  const token = row.token != null && row.token !== '' ? translatePhrase(`Token #${row.token}`) : '';
  const when = row.time ? clockLabel(row.time) : '';
  const walkin = row.source === 'walkin';
  const kind = walkin ? translatePhrase('Walk-in') : translatePhrase('Online booking');
  const name = row.patientName || translatePhrase('Patient');
  return {
    title: row.emergency
      ? `🚨 ${translatePhrase('Emergency')}: ${name}`
      : `${walkin ? translatePhrase('New walk-in') : translatePhrase('New online booking')}: ${name}`,
    body: [kind, token, when].filter(Boolean).join(' · ') || translatePhrase('Added to today’s queue'),
  };
};

const notify = (title, body) => displaySystemNotification({
  notification: { title, body },
  data: { type: 'APPOINTMENT', source: 'receptionist-feed' },
}).catch(() => {});

export default function useBookingAlerts(data, clinic) {
  const seen = useRef(null);

  // Another clinic's queue is a fresh baseline, not a burst of "new" patients.
  useEffect(() => { seen.current = null; }, [clinic]);

  useEffect(() => {
    // The saved copy shown on open is not a live read: it must not become the
    // baseline, or the first fresh read would replay everything since then.
    if (!data || data.__fromCache) return;
    const rows = feedRows(data);
    if (!seen.current) {
      seen.current = new Set(rows.map(patientKey));
      return;
    }
    const fresh = rows.filter((row) => !seen.current.has(patientKey(row)));
    rows.forEach((row) => seen.current.add(patientKey(row)));
    if (!fresh.length) return;

    const emergencies = fresh.filter((row) => row.emergency);
    if (fresh.length <= MAX_SINGLE_ALERTS) {
      fresh.forEach((row) => { const { title, body } = describe(row); notify(title, body); });
      return;
    }
    emergencies.forEach((row) => { const { title, body } = describe(row); notify(title, body); });
    const others = fresh.length - emergencies.length;
    if (others > 0) notify(`${others} new patients in today’s queue`, 'Open the receptionist app to see the latest bookings.');
  }, [data]);
}
