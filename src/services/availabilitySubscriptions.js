import api from '../axiosConfig';

// "Notify me when this consultant comes online". The backend exposes the same
// handler on two URLs (Humaeli-backend-update notificationRoutes.js):
//   /api/notifications/availability-subscriptions/:counselorId
//   /api/notifications/counselors/:counselorId/online-subscription
// Some deployed servers have neither (404 "Cannot GET"). We probe once, use
// whichever URL exists, and if none does, report the feature as unsupported
// instead of firing a failing request for every consultant card.
const PATHS = [
  (id) => `/api/notifications/availability-subscriptions/${encodeURIComponent(id)}`,
  (id) => `/api/notifications/counselors/${encodeURIComponent(id)}/online-subscription`,
];

let workingPathIndex = null; // index into PATHS once a URL answered
let unsupported = false; // true once every URL returned 404
let probePromise = null; // shared first probe so parallel cards don't all 404

const unsupportedError = () => Object.assign(
  new Error('Online notifications are not available on this server yet.'),
  { code: 'UNSUPPORTED' },
);

export const isAvailabilitySubscriptionUnsupported = (error) => error?.code === 'UNSUPPORTED';

const is404 = (error) => error?.response?.status === 404;

async function request(method, counselorId, body) {
  if (!counselorId) throw new Error('Consultant ID is required');
  if (unsupported) throw unsupportedError();

  if (workingPathIndex != null) {
    return api.request({ method, url: PATHS[workingPathIndex](counselorId), data: body });
  }

  // First call (or first calls in parallel): find which URL exists.
  if (!probePromise) {
    probePromise = (async () => {
      for (let i = 0; i < PATHS.length; i += 1) {
        try {
          const response = await api.request({ method, url: PATHS[i](counselorId), data: body });
          workingPathIndex = i;
          return { response, index: i };
        } catch (error) {
          if (!is404(error)) throw error;
        }
      }
      unsupported = true;
      throw unsupportedError();
    })();
    try {
      return (await probePromise).response;
    } catch (error) {
      if (!unsupported) probePromise = null; // real error: allow a retry later
      throw error;
    }
  }

  // Another call is probing: wait for it, then use the URL it found.
  try {
    await probePromise;
  } catch (error) {
    if (unsupported) throw unsupportedError();
    throw error; // network / server error — not "missing route"
  }
  if (workingPathIndex == null) throw unsupportedError();
  return api.request({ method, url: PATHS[workingPathIndex](counselorId), data: body });
}

export async function getAvailabilitySubscription(counselorId) {
  const response = await request('get', counselorId);
  const payload = response.data;
  const subscribed = payload?.subscribed ?? payload?.data?.subscribed;
  if (payload?.success === false || typeof subscribed !== 'boolean') {
    throw new Error('Could not read saved notification status');
  }
  return subscribed;
}

export async function setAvailabilitySubscription(counselorId, enabled) {
  const response = enabled
    ? await request('post', counselorId, { counselorId })
    : await request('delete', counselorId);
  if (response.data?.success === false) {
    throw new Error('Availability subscription was not saved');
  }
  // Read back the persisted value; HTTP success alone does not prove it saved.
  return getAvailabilitySubscription(counselorId);
}
