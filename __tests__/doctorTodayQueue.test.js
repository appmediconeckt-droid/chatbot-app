import { formatDelay, isScheduledToday, isTodayAppointment } from '../src/features/doctor/dashboard/api/doctorAppointments';

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn() }));
jest.mock('../src/axiosConfig', () => ({ __esModule: true, default: { get: jest.fn(), defaults: { baseURL: '' } } }));

// 27 Oct 2026, 16:30 local.
const NOW = new Date(2026, 9, 27, 16, 30);

describe("doctor's today queue", () => {
  beforeAll(() => { jest.useFakeTimers(); jest.setSystemTime(NOW); });
  afterAll(() => jest.useRealTimers());

  // Shape of the QR walk-in that showed as "Up Next": booked 14 Oct, never
  // finished, and the server rolled its estimated start to today.
  const staleWalkIn = {
    appointment_date: '2026-10-14',
    appointment_time: '11:00:00',
    appointment_status: 'booked',
    booking_source: 'qr',
    created_at: '2026-10-14T05:40:50.503Z',
    original_appointment_at: '2026-10-14T05:30:00.000Z',
    estimated_start_at: new Date(2026, 9, 27, 17, 1).toISOString(),
    __appointmentSource: 'walkin',
  };

  it('keeps an old pending walk-in out of today even when its estimate rolled to today', () => {
    expect(isTodayAppointment(staleWalkIn)).toBe(false);
    expect(isScheduledToday({ __raw: staleWalkIn })).toBe(false);
  });

  it("keeps today's bookings, delayed or not", () => {
    const today = {
      appointment_date: '2026-10-27',
      original_appointment_at: new Date(2026, 9, 27, 11, 0).toISOString(),
      estimated_start_at: new Date(2026, 9, 27, 17, 1).toISOString(),
    };
    expect(isTodayAppointment(today)).toBe(true);
    expect(isTodayAppointment({ estimated_start_at: new Date(2026, 9, 27, 12, 0).toISOString() })).toBe(true);
  });

  it('still lists an open emergency from another day', () => {
    expect(isTodayAppointment({ ...staleWalkIn, priority: 'emergency' })).toBe(true);
  });
});

describe('queue delay label', () => {
  it('shows minutes up to 99, then hours, then days', () => {
    expect(formatDelay(5)).toBe('5 min');
    expect(formatDelay(90)).toBe('90 min');
    expect(formatDelay(99)).toBe('99 min');
    expect(formatDelay(100)).toBe('1 hour 40 min');
    expect(formatDelay(120)).toBe('2 hours');
    expect(formatDelay(152)).toBe('2 hours 32 min');
    expect(formatDelay(1440)).toBe('1 day');
    expect(formatDelay(20307)).toBe('14 days');
  });
});
