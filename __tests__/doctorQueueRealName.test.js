// The doctor's queue shows an app patient's real (account) name, not the
// anonymous name the appointment rows carry — the same name the receptionist
// and the doctor's Patients tab show.
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn().mockResolvedValue(null) }));
jest.mock('../src/axiosConfig', () => ({
  __esModule: true,
  default: { get: jest.fn(), defaults: { baseURL: '' } },
}));

const paid = (overrides = {}) => ({
  appointment_date: '2026-10-30', appointment_time: '10:00', payment_status: 'paid', appointment_status: 'confirmed', ...overrides,
});

// A fresh module per test: the account names are cached for a minute.
const loadFeed = (routes) => {
  let api;
  let feed;
  jest.isolateModules(() => {
    api = require('../src/axiosConfig').default;
    feed = require('../src/features/doctor/dashboard/api/doctorAppointments');
  });
  api.get.mockImplementation((url, options = {}) => {
    const key = url === '/api/appointments' && options.params?.appointment_status ? `${url}?${options.params.appointment_status}` : url;
    const route = routes[key];
    if (route instanceof Error) return Promise.reject(route);
    return Promise.resolve({ data: route || [] });
  });
  return feed;
};

it('shows the account name instead of the anonymous name on an app booking', async () => {
  const feed = loadFeed({
    '/api/appointments': [paid({ _id: 'a1', patient_name: 'Viky', patient_id: 'u1' })],
    '/api/auth/users': { users: [{ _id: 'u1', fullName: 'Vishal' }] },
  });
  const [row] = await feed.loadDoctorAppointmentFeed('doctor-1');
  expect(feed.formatAppointment(row).name).toBe('Vishal');
});

it('finds the account id on a populated patient object too', async () => {
  const feed = loadFeed({
    '/api/appointments': [paid({ _id: 'a1', patient_name: 'Viky', patient: { _id: 'u1', fullName: 'Viky' } })],
    '/api/auth/users': { users: [{ _id: 'u1', fullName: 'Vishal' }] },
  });
  const [row] = await feed.loadDoctorAppointmentFeed('doctor-1');
  expect(feed.formatAppointment(row).name).toBe('Vishal');
});

it('keeps the typed name for walk-ins and QR bookings', async () => {
  const feed = loadFeed({
    '/api/appointments': [paid({ _id: 'q1', booking_source: 'qr', patient_name: 'Neha', patient_id: 'u2' })],
    '/api/walkin-appointments': [{ _id: 'w1', patient_name: 'Ravi', patient_id: 'u1', appointment_date: '2026-10-30' }],
    '/api/auth/users': { users: [{ _id: 'u1', fullName: 'Vishal' }, { _id: 'u2', fullName: 'Account Holder' }] },
  });
  const rows = await feed.loadDoctorAppointmentFeed('doctor-1');
  expect(rows.map((row) => feed.formatAppointment(row).name).sort()).toEqual(['Neha', 'Ravi']);
});

it('still loads the queue, with the names it was sent, when account names are unavailable', async () => {
  const feed = loadFeed({
    '/api/appointments': [paid({ _id: 'a1', patient_name: 'Viky', patient_id: 'u1' })],
    '/api/auth/users': new Error('403'),
  });
  const [row] = await feed.loadDoctorAppointmentFeed('doctor-1');
  expect(feed.formatAppointment(row).name).toBe('Viky');
});

it('doctor notifications name the patient by their real name, not the anonymous one', async () => {
  const feed = loadFeed({
    '/api/appointments': [paid({ _id: 'a1', patient_name: 'hjsk', patient: { _id: 'u1', fullName: 'hjsk' } })],
    '/api/auth/users': { users: [{ _id: 'u1', fullName: 'Shubham Kumar' }] },
  });
  await expect(feed.realNameNotificationText('a1', {
    title: 'New appointment request',
    body: 'hjsk requested an appointment for 30/10/2026, 5:00:00 pm.',
  })).resolves.toEqual({
    title: 'New appointment request',
    body: 'Shubham Kumar requested an appointment for 30/10/2026, 5:00:00 pm.',
  });
  // Only whole words are swapped, and unknown appointments are left alone.
  expect(feed.withRealPatientName('hjskx hjsk.', { real: 'Shubham', shown: ['hjsk'] })).toBe('hjskx Shubham.');
  await expect(feed.realNameNotificationText('missing', { title: 't', body: 'hjsk booked' })).resolves.toEqual({ title: 't', body: 'hjsk booked' });
});

it('fills the patient phone the doctor rows leave out from the desk view of the same booking', async () => {
  const feed = loadFeed({
    '/api/appointments': [paid({ _id: 'a1', patient_name: 'hjsk', patient: { _id: 'u1' } })],
    '/api/staff/appointments': { appointments: [{ id: 'a1', patientName: 'Shubham Kumar', phoneNumber: '+917489260421' }], total: 1 },
  });
  const [row] = await feed.loadDoctorAppointmentFeed('doctor-1');
  const formatted = feed.formatAppointment(row);
  expect(formatted.phone).toMatch(/7489260421/);
  expect(formatted.name).toBe('Shubham Kumar');
});

it('fills consent phone from the patient account when doctor and desk rows omit it', async () => {
  const feed = loadFeed({
    '/api/appointments': [paid({ _id: 'a1', patient_name: 'Viky', patient_id: 'u1' })],
    '/api/auth/users': { users: [{ _id: 'u1', fullName: 'Vishal', phoneNumber: '7489260421', phoneCountryCode: '+91' }] },
    '/api/staff/appointments': new Error('403'),
  });
  const [row] = await feed.loadDoctorAppointmentFeed('doctor-1');
  expect(feed.formatAppointment(row).phone).toMatch(/7489260421/);
});

it('reads consent phone from a populated patient_id object', () => {
  const feed = loadFeed({});
  const row = feed.formatAppointment(paid({ patient_id: { _id: 'u1', fullName: 'Vishal', phoneNumber: '7489260421' } }));
  expect(row.phone).toMatch(/7489260421/);
});

it('still loads the queue when the desk view is closed to the doctor', async () => {
  const feed = loadFeed({
    '/api/appointments': [paid({ _id: 'a1', patient_name: 'Viky', patient_id: 'u1' })],
    '/api/staff/appointments': new Error('403'),
  });
  const [row] = await feed.loadDoctorAppointmentFeed('doctor-1');
  expect(feed.formatAppointment(row).phone).toBe('N/A');
});

it('dates a booking by the day it was booked for, not the estimate the server moves forward', () => {
  const { formatAppointment, formatLocalDateKey } = require('../src/features/doctor/dashboard/api/doctorAppointments');
  // A pending 30 Oct booking the server re-estimated onto 31 Oct.
  const row = formatAppointment(paid({
    _id: 'a1', appointment_date: '2026-10-30', appointment_time: '17:45:00',
    estimated_start_at: '2026-10-31T12:15:00.000Z', patient_name: 'Shubham',
  }));
  expect(formatLocalDateKey(row.bookedDate)).toBe('2026-10-30');
});
