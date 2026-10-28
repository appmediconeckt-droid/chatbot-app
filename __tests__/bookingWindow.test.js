import { bookingWindowDays } from '../src/utils/doctorSlots';

describe('booking window (today through the end of next month)', () => {
  it('reaches the last day of next month', () => {
    expect(bookingWindowDays('2026-10-26')).toBe(36); // Oct 26 .. Nov 30
    expect(bookingWindowDays('2026-10-01')).toBe(61); // Oct 1 .. Nov 30
    expect(bookingWindowDays('2026-10-31')).toBe(31); // Oct 31 .. Nov 30
  });

  it('crosses the year and short months', () => {
    expect(bookingWindowDays('2026-12-15')).toBe(48); // Dec 15 .. Jan 31
    expect(bookingWindowDays('2027-01-31')).toBe(29); // Jan 31 .. Feb 28
    expect(bookingWindowDays('2028-01-31')).toBe(30); // Jan 31 .. Feb 29 (leap year)
  });

  it('always offers more than the old 7 days', () => {
    ['2026-10-31', '2027-01-31', '2026-12-31'].forEach((iso) => expect(bookingWindowDays(iso)).toBeGreaterThan(7));
  });
});
