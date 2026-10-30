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

  it('keeps a server-enrolled queue booking visible even while payment is pending', () => {
    expect(isAppointmentVisibleToDoctor(booking({
      payment_status: 'pending',
      queue_status: 'booked',
      token_number: 2,
    }))).toBe(true);
  });

  it('keeps cash, free and walk-in appointments visible', () => {
    expect(isAppointmentVisibleToDoctor(booking({ payment_method: 'cash' }))).toBe(true);
    expect(isAppointmentVisibleToDoctor(booking({ fee: 0 }))).toBe(false);
    expect(isAppointmentVisibleToDoctor(booking({ __appointmentSource: 'walkin' }))).toBe(true);
    expect(isAppointmentVisibleToDoctor(booking({ appointment_status: 'completed' }))).toBe(false);
    expect(isAppointmentVisibleToDoctor(booking({ appointment_status: 'cancelled' }))).toBe(false);
    expect(isAppointmentVisibleToDoctor(booking({ appointment_status: 'completed', payment_status: 'paid' }))).toBe(true);
  });

  it('removes an unpaid UPI reservation from the doctor feed', async () => {
    axiosInstance.get.mockImplementation((url, options = {}) => {
      if (url === '/api/appointments' && !options.params?.appointment_status) {
        return Promise.resolve({ data: { appointments: [
        booking({ _id: 'unpaid', payment_status: 'pending' }),
        booking({ _id: 'paid', payment_status: 'paid' }),
        booking({ _id: 'cash', payment_method: 'cash' }),
        ] } });
      }
      return Promise.resolve({ data: [] });
    });

    const result = await loadDoctorAppointmentFeed('doctor-1');

    expect(result.map((item) => item._id)).toEqual(['paid', 'cash']);
  });

  it("loads today's booked appointment from the dedicated doctor queue", async () => {
    axiosInstance.get.mockImplementation((url) => Promise.resolve({
      data: url === '/api/appointments/doctor/queue'
        ? { appointments: [booking({ _id: 'queued', payment_status: 'paid', appointment_status: 'confirmed' })] }
        : [],
    }));

    const result = await loadDoctorAppointmentFeed('doctor-1');

    expect(axiosInstance.get).toHaveBeenCalledWith(
      '/api/appointments/doctor/queue',
      { params: { doctor_id: 'doctor-1' } },
    );
    expect(result.map((item) => item._id)).toEqual(['queued']);
  });

  it('keeps payment verification when the live queue returns a partial duplicate', async () => {
    axiosInstance.get.mockImplementation((url, options = {}) => {
      if (url === '/api/appointments' && !options.params?.appointment_status) {
        return Promise.resolve({ data: [booking({ _id: 'paid', payment_status: 'paid' })] });
      }
      if (url === '/api/appointments/doctor/queue') {
        return Promise.resolve({ data: { queue: [{ _id: 'paid', payment_method: 'upi', queue_status: 'waiting' }] } });
      }
      return Promise.resolve({ data: [] });
    });

    const result = await loadDoctorAppointmentFeed('doctor-1');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ _id: 'paid', payment_status: 'paid', queue_status: 'waiting' });
  });

  it('keeps an unpaid duplicate after the server admits it into the live queue', async () => {
    axiosInstance.get.mockImplementation((url, options = {}) => {
      if (url === '/api/appointments' && !options.params?.appointment_status) {
        return Promise.resolve({ data: [booking({ _id: 'queued-pending', payment_status: 'pending' })] });
      }
      if (url === '/api/appointments/doctor/queue') {
        return Promise.resolve({ data: { queue: [{
          _id: 'queued-pending', payment_method: 'upi', queue_status: 'booked', token_number: 3,
        }] } });
      }
      return Promise.resolve({ data: [] });
    });

    const result = await loadDoctorAppointmentFeed('doctor-1');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      _id: 'queued-pending', payment_status: 'pending', queue_status: 'booked', token_number: 3,
    });
  });
});
