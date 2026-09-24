jest.mock('../src/axiosConfig', () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
}));

import api from '../src/axiosConfig';
import { getAvailabilitySubscription, setAvailabilitySubscription } from '../src/services/availabilitySubscriptions';

const id = 'consultant-id';
const endpoint = `/api/notifications/availability-subscriptions/${id}`;

beforeEach(() => jest.resetAllMocks());

test('OFF deletes the consultant subscription and reads saved false', async () => {
  api.delete.mockResolvedValue({ data: { success: true } });
  api.get.mockResolvedValue({ data: { subscribed: false } });
  await expect(setAvailabilitySubscription(id, false)).resolves.toBe(false);
  expect(api.delete).toHaveBeenCalledWith(endpoint);
  expect(api.get).toHaveBeenCalledWith(endpoint);
  expect(api.delete.mock.invocationCallOrder[0]).toBeLessThan(api.get.mock.invocationCallOrder[0]);
  expect(api.post).not.toHaveBeenCalled();
});

test('ON posts the same consultant ID and reads saved true', async () => {
  api.post.mockResolvedValue({ data: { success: true } });
  api.get.mockResolvedValue({ data: { subscribed: true } });
  await expect(setAvailabilitySubscription(id, true)).resolves.toBe(true);
  expect(api.post).toHaveBeenCalledWith(endpoint, { counselorId: id });
  expect(api.get).toHaveBeenCalledWith(endpoint);
  expect(api.post.mock.invocationCallOrder[0]).toBeLessThan(api.get.mock.invocationCallOrder[0]);
});

test('does not invent OFF when the backend still reports ON', async () => {
  api.delete.mockResolvedValue({ data: { success: true } });
  api.get.mockResolvedValue({ data: { subscribed: true } });
  await expect(setAvailabilitySubscription(id, false)).resolves.toBe(true);
});

test('rejects malformed saved status instead of treating it as OFF', async () => {
  api.get.mockResolvedValue({ data: { success: true } });
  await expect(getAvailabilitySubscription(id)).rejects.toThrow('saved notification status');
});

test('does not report success when verification fails', async () => {
  api.post.mockResolvedValue({ data: { success: true } });
  api.get.mockRejectedValue(new Error('Network unavailable'));
  await expect(setAvailabilitySubscription(id, true)).rejects.toThrow('Network unavailable');
});

test('rejects backend mutation failure without claiming a saved value', async () => {
  api.delete.mockResolvedValue({ data: { success: false } });
  await expect(setAvailabilitySubscription(id, false)).rejects.toThrow('not saved');
  expect(api.get).not.toHaveBeenCalled();
});
