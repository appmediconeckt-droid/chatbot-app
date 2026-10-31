// A doctor's notification opens the screen it is about — from the in-app list
// and from a tapped push alike.
jest.mock('../src/axiosConfig', () => ({ __esModule: true, default: { get: jest.fn(), defaults: { baseURL: '' } } }));
jest.mock('../src/services/socketService', () => ({ on: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn().mockResolvedValue(null) }));
jest.mock('../src/hooks/useRingtone', () => ({ startIncomingRingtone: jest.fn() }));
jest.mock('../src/services/notificationPreferences', () => ({ shouldDeliverNotification: jest.fn().mockResolvedValue(true) }));

const { doctorNotificationTarget } = require('../src/features/doctor/dashboard/api/doctorNotifications');

test('a new appointment request opens that appointment', () => {
  expect(doctorNotificationTarget({ type: 'appointment', title: 'New appointment request', actionUrl: '/counselor/appointments', appointmentId: 'a1' })).toBe('appointment');
  expect(doctorNotificationTarget({ type: 'APPOINTMENT' })).toBe('appointment');
  expect(doctorNotificationTarget({ title: 'Emergency request from a patient' })).toBe('appointment');
  expect(doctorNotificationTarget({ type: 'system', appointmentId: 'a2' })).toBe('appointment');
});

test('payments, reviews, follow-ups, staff and availability open their own screens', () => {
  expect(doctorNotificationTarget({ type: 'payment', title: 'Payment received for appointment', appointmentId: 'a1' })).toBe('earnings');
  expect(doctorNotificationTarget({ type: 'review', title: 'New rating' })).toBe('reviews');
  expect(doctorNotificationTarget({ type: 'follow_up', title: 'Follow-up due', appointmentId: 'a1' })).toBe('followUps');
  expect(doctorNotificationTarget({ type: 'staff', title: 'Receptionist joined' })).toBe('staffManagement');
  expect(doctorNotificationTarget({ type: 'availability', title: 'Slots updated' })).toBe('calendar');
});

test('anything else stays on the notifications list', () => {
  expect(doctorNotificationTarget({ type: 'system', title: 'Welcome to Humaeli' })).toBeNull();
  expect(doctorNotificationTarget()).toBeNull();
});

test('a doctor tapping an appointment push lands on that appointment', async () => {
  const AsyncStorage = require('@react-native-async-storage/async-storage');
  AsyncStorage.getItem.mockImplementation((key) => Promise.resolve(key === 'userRole' ? 'doctor' : null));
  const { handleNotificationNavigation } = require('../src/services/notificationService');
  const navigation = { navigate: jest.fn() };
  await handleNotificationNavigation(navigation, { data: { type: 'APPOINTMENT', title: 'New appointment request', appointmentId: 'a1' } });
  expect(navigation.navigate).toHaveBeenCalledWith('DoctorDashboard', {
    notificationOpen: expect.objectContaining({ target: 'appointment', appointmentId: 'a1' }),
  });
  expect(navigation.navigate).not.toHaveBeenCalledWith('MyAppointments');
});
