import api from '../axiosConfig';

const endpointFor = (counselorId) => {
  if (!counselorId) throw new Error('Consultant ID is required');
  return `/api/notifications/availability-subscriptions/${encodeURIComponent(counselorId)}`;
};

export async function getAvailabilitySubscription(counselorId) {
  const response = await api.get(endpointFor(counselorId));
  const payload = response.data;
  const subscribed = payload?.subscribed ?? payload?.data?.subscribed;
  if (payload?.success === false || typeof subscribed !== 'boolean') {
    throw new Error('Could not read saved notification status');
  }
  return subscribed;
}

export async function setAvailabilitySubscription(counselorId, enabled) {
  const endpoint = endpointFor(counselorId);
  const response = enabled
    ? await api.post(endpoint, { counselorId })
    : await api.delete(endpoint);
  if (response.data?.success === false) {
    throw new Error('Availability subscription was not saved');
  }
  // Read back the persisted value; HTTP success alone does not prove it saved.
  return getAvailabilitySubscription(counselorId);
}
