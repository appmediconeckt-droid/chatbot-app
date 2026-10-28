import axiosInstance from '../src/axiosConfig';
import {
  isAppointmentVisibleToDoctor,
  loadDoctorAppointmentFeed,
} from '../src/features/doctor/dashboard/api/doctorAppointments';

jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn().mockResolvedValue(null) }));
jest.mock('../src/axiosConfig', () => ({
  __esModule: true,
  default: { get: jest.fn(), defaults: { baseURL: '' } },
}));

const booking = (overrides = {}) => ({
  _id: 'appointment-1',
  appointment_date: '2026-10-29',
  appointment_time: '10:00',
  patient_name: 'Asha Rao',
  fee: 500,
  payment_method: 'upi',
  ...overrides,
});

describe('doctor appointment payment visibility', () => {
  beforeEach(() => jest.clearAllMocks());

  it('hides prepaid appointments until payment succeeds', () => {
    expect(isAppointmentVisibleToDoctor(booking())).toBe(false);
    expect(isAppointmentVisibleToDoctor(booking({ payment_status: 'pending' }))).toBe(false);
    expect(isAppointmentVisibleToDoctor(booking({ paymentStatus: 'failed' }))).toBe(false);
    expect(isAppointmentVisibleToDoctor(booking({ payment: { status: 'paid' } }))).toBe(true);
    expect(isAppointmentVisibleToDoctor(booking({ payment_status: 'captured' }))).toBe(true);
  });

  it('keeps cash, free and walk-in appointments visible', () => {
    expect(isAppointmentVisibleToDoctor(booking({ payment_method: 'cash' }))).toBe(true);
    expect(isAppointmentVisibleToDoctor(booking({ fee: 0 }))).toBe(true);
    expect(isAppointmentVisibleToDoctor(booking({ __appointmentSource: 'walkin' }))).toBe(true);
    expect(isAppointmentVisibleToDoctor(booking({ appointment_status: 'completed' }))).toBe(true);
    expect(isAppointmentVisibleToDoctor(booking({ appointment_status: 'cancelled' }))).toBe(true);
  });

  it('removes an unpaid UPI reservation from the doctor feed', async () => {
    axiosInstance.get
      .mockResolvedValueOnce({ data: { appointments: [
        booking({ _id: 'unpaid', payment_status: 'pending' }),
        booking({ _id: 'paid', payment_status: 'paid' }),
        booking({ _id: 'cash', payment_method: 'cash' }),
      ] } })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [] });

    const result = await loadDoctorAppointmentFeed('doctor-1');

    expect(result.map((item) => item._id)).toEqual(['paid', 'cash']);
  });
});
