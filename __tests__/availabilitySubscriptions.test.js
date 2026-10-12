jest.mock('../src/axiosConfig', () => ({
  __esModule: true,
  default: { request: jest.fn() },
}));

import api from '../src/axiosConfig';
import {
  __resetAvailabilitySubscriptionStateForTests,
  getAvailabilitySubscription,
  setAvailabilitySubscription,
} from '../src/services/availabilitySubscriptions';

const id = 'consultant-id';
const endpoint = `/api/notifications/availability-subscriptions/${id}`;

beforeEach(() => {
  jest.resetAllMocks();
  __resetAvailabilitySubscriptionStateForTests();
});

test('OFF deletes the consultant subscription and reads saved false', async () => {
  api.request
    .mockResolvedValueOnce({ data: { success: true } })
    .mockResolvedValueOnce({ data: { subscribed: false } });
  await expect(setAvailabilitySubscription(id, false)).resolves.toBe(false);
  expect(api.request).toHaveBeenNthCalledWith(1, { method: 'delete', url: endpoint, data: undefined });
  expect(api.request).toHaveBeenNthCalledWith(2, { method: 'get', url: endpoint, data: undefined });
});

test('ON posts the same consultant ID and reads saved true', async () => {
  api.request
    .mockResolvedValueOnce({ data: { success: true } })
    .mockResolvedValueOnce({ data: { subscribed: true } });
  await expect(setAvailabilitySubscription(id, true)).resolves.toBe(true);
  expect(api.request).toHaveBeenNthCalledWith(1, {
    method: 'post',
    url: endpoint,
    data: { counselorId: id },
  });
  expect(api.request).toHaveBeenNthCalledWith(2, { method: 'get', url: endpoint, data: undefined });
});

test('does not invent OFF when the backend still reports ON', async () => {
  api.request
    .mockResolvedValueOnce({ data: { success: true } })
    .mockResolvedValueOnce({ data: { subscribed: true } });
  await expect(setAvailabilitySubscription(id, false)).resolves.toBe(true);
});

test('rejects malformed saved status instead of treating it as OFF', async () => {
  api.request.mockResolvedValue({ data: { success: true } });
  await expect(getAvailabilitySubscription(id)).rejects.toThrow('saved notification status');
});

test('does not report success when verification fails', async () => {
  api.request
    .mockResolvedValueOnce({ data: { success: true } })
    .mockRejectedValueOnce(new Error('Network unavailable'));
  await expect(setAvailabilitySubscription(id, true)).rejects.toThrow('Network unavailable');
});

test('rejects backend mutation failure without claiming a saved value', async () => {
  api.request.mockResolvedValue({ data: { success: false } });
  await expect(setAvailabilitySubscription(id, false)).rejects.toThrow('not saved');
  expect(api.request).toHaveBeenCalledTimes(1);
});
