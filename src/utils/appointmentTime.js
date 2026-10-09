// Shared time helpers for the patient's appointment screens.

// "2:33 PM" — always 12-hour, whatever the phone's 24-hour setting, so the
// same appointment reads the same on every device. '' for an invalid date.
export const formatTime12 = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

// The next clean slot boundary (:00, :15, :30, :45) at least `leadMinutes`
// from `from`, seconds cleared — the default time offered when booking, so a
// booking doesn't land on an odd minute like 14:33.
export const nextSlotTime = (leadMinutes = 0, stepMinutes = 15, from = new Date()) => {
  const date = new Date(from.getTime() + leadMinutes * 60000);
  date.setSeconds(0, 0);
  const remainder = date.getMinutes() % stepMinutes;
  if (remainder) date.setMinutes(date.getMinutes() + (stepMinutes - remainder));
  return date;
};
