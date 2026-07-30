// Shared helpers to show call entries inside a chat thread (WhatsApp-style).
// Mirrors the web app (chatbot/src/.../ChatBox.jsx): it fetches the existing
// call-history API, filters to the current conversation peer, formats each call
// into a lightweight "call message", and merges it into the message timeline.
// No backend change is required — call records come from the same call-history
// endpoint the Calls tab already uses.
import axios, { API_BASE_URL } from '../axiosConfig';

const normalizeCallType = (value) => {
  const normalized = String(value || 'video').trim().toLowerCase();
  return normalized === 'audio' || normalized === 'voice' ? 'voice' : 'video';
};

// The history API returns the row from the current user's perspective:
// role === 'receiver' means the call came IN to us.
//
// `role` used to be the only signal, and anything that wasn't literally
// 'receiver' fell through to 'outgoing' - including a missing/blank role. That
// put such rows on the right for BOTH parties, and a missed *incoming* call then
// read as your own "Cancelled" and lost its red alert. So fall back to comparing
// the initiator id against the viewer, and only give up if neither is available.
const getCallDirection = (call, currentUserId) => {
  const role = String(call?.role || '').trim().toLowerCase();
  if (role === 'receiver') return 'incoming';
  if (role === 'initiator' || role === 'caller') return 'outgoing';

  const initiator =
    call?.callerId ?? call?.initiatorId ?? call?.from ?? call?.caller ?? null;
  if (initiator != null && currentUserId != null) {
    return String(initiator) === String(currentUserId) ? 'outgoing' : 'incoming';
  }

  // Genuinely undeterminable - don't assert a direction.
  return null;
};

const MISSED_STATUSES = ['missed', 'rejected', 'cancelled', 'canceled'];

export const isMissedCallStatus = (status) =>
  MISSED_STATUSES.includes(String(status || '').trim().toLowerCase());

// Turn raw call-history rows into chat-timeline items. Each item carries
// `isCall: true` and a `fullTime` so it can be merged/sorted alongside messages.
export const formatCallEntries = (history, peerId, currentUserId) => {
  const list = Array.isArray(history) ? history : [];

  return list
    .filter((call) => !peerId || String(call.withId) === String(peerId))
    .map((call) => {
      const timestamp = call.timestamp || call.createdAt;
      const dateValue = timestamp ? new Date(timestamp) : null;
      const validDate = dateValue && !Number.isNaN(dateValue.getTime());

      return {
        // Prefix so a call id can never collide with a message id in keyExtractor.
        id: `call_${call.id || `${timestamp}_${call.type}`}`,
        callId: call.id || call.callId || null,
        isCall: true,
        type: normalizeCallType(call.type),
        direction: getCallDirection(call, currentUserId),
        status: String(call.status || 'completed').trim().toLowerCase(),
        duration: Number(call.duration) > 0 ? Number(call.duration) : 0,
        time: validDate
          ? dateValue.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : '',
        fullTime: timestamp || new Date().toISOString(),
      };
    });
};

// Fetch + format the calls between `currentUserId` and `peerId`.
export const fetchChatCallEntries = async ({ currentUserId, peerId, token }) => {
  if (!currentUserId || !peerId) return [];

  try {
    const response = await axios.get(
      `${API_BASE_URL}/api/video/calls/history/${currentUserId}`,
      {
        params: { page: 1, limit: 100 },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      },
    );

    return formatCallEntries(response.data?.history, peerId, currentUserId);
  } catch (error) {
    // Non-fatal: if calls can't load, the chat still shows text messages.
    console.warn('Unable to load chat call history:', error?.message);
    return [];
  }
};

// Resolve a sortable timestamp. Optimistic (just-sent) messages have no
// `fullTime` yet — fall back to `createdAt`/`timestamp` (same keys the counselor
// screen sorts by), and only as a last resort to a single shared `now` so they
// stay pinned at the newest end instead of jumping to the top of the thread.
// `now` MUST be passed in (snapshotted once per sort) — calling Date.now()
// inside the comparator returns a different value on every comparison, which is
// an inconsistent comparator and can shuffle messages unpredictably.
const sortableTime = (item, now) => {
  const raw = item?.fullTime || item?.createdAt || item?.timestamp;
  const t = raw ? new Date(raw).getTime() : NaN;
  return Number.isNaN(t) ? now : t;
};

// Merge messages + call entries into one timeline. Returns newest-first so it can
// be handed straight to an inverted FlatList (both chat threads use `inverted`).
// Array.prototype.sort is stable, so items with equal timestamps keep their
// original order (messages before calls).
export const mergeTimelineForInverted = (messages = [], calls = []) => {
  const merged = [...messages, ...calls];
  const now = Date.now();
  merged.sort((a, b) => sortableTime(a, now) - sortableTime(b, now));
  return merged.reverse();
};

// Human label + color hints for a call bubble, shared by both screens.
export const describeCall = (item) => {
  const isOutgoing = item.direction === 'outgoing';
  // null direction => unknown. Treated as not-outgoing so a missed call still
  // surfaces on the peer's side with its alert, rather than being hidden as your
  // own cancellation.
  const directionKnown = item.direction === 'outgoing' || item.direction === 'incoming';
  const missed = isMissedCallStatus(item.status);

  let statusLabel;
  if (missed) {
    if (!directionKnown) statusLabel = 'Missed call';
    else if (isOutgoing) statusLabel = 'Cancelled';
    else if (item.status === 'rejected') statusLabel = 'Declined';
    else statusLabel = 'Missed';
  } else {
    statusLabel = 'Call ended';
  }

  let durationText = '';
  if (item.duration > 0) {
    const mins = Math.floor(item.duration / 60);
    const secs = item.duration % 60;
    durationText = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  }

  // A missed/declined incoming call is the only "alert" state (red).
  const isAlert = missed && !isOutgoing;

  return { isOutgoing, missed, isAlert, statusLabel, durationText };
};
