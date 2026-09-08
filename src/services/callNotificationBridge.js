import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_CALL_INTENT_KEY = 'pendingIncomingCallNotification';
const PENDING_CALL_PUSH_KEY = 'pendingIncomingCallPush';
const LAST_HANDLED_CALL_KEY = 'lastHandledIncomingCall';
const HANDLED_CALL_TTL_MS = 2 * 60 * 60 * 1000;
export const INCOMING_CALL_PRESENTATION_TTL_MS = 75 * 1000;

const TERMINAL_CALL_STATUSES = new Set([
  'ended',
  'rejected',
  'missed',
  'completed',
  'cancelled',
  'canceled',
  'expired',
  'timeout',
  'timed_out',
  'no_answer',
]);

const listeners = new Set();
const presentedCallIds = new Set();
let pendingIntent = null;
let globalCallUiActive = false;

const safeJsonParse = (value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return trimmed;
  try {
    return JSON.parse(trimmed);
  } catch (_) {
    return trimmed;
  }
};

export const normalizeCallType = (value) => {
  const type = String(value || '').trim().toLowerCase();
  if (type === 'audio' || type === 'voice' || type.includes('audio') || type.includes('voice')) {
    return 'voice';
  }
  return 'video';
};

export const normalizeNotificationData = (remoteMessageOrData) => {
  const raw =
    remoteMessageOrData?.data ||
    remoteMessageOrData?.notification?.data ||
    remoteMessageOrData ||
    {};

  return Object.entries(raw).reduce((acc, [key, value]) => {
    acc[key] = safeJsonParse(value);
    return acc;
  }, {});
};

const parseTimestampMs = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 10000000000 ? value * 1000 : value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d+$/.test(trimmed)) {
      const numeric = Number(trimmed);
      return numeric < 10000000000 ? numeric * 1000 : numeric;
    }
    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
};

const getCallIdFromData = (data = {}) => (
  data.callId ||
  data.call_id ||
  data.id ||
  data._id ||
  data.call?.callId ||
  data.call?.id ||
  data.call?._id ||
  data.data?.callId ||
  data.data?.call_id ||
  data.data?.id ||
  data.data?._id ||
  data.callData?.callId ||
  data.callData?.id ||
  data.callData?._id ||
  null
);

const getStatusFromData = (data = {}) => String(
  data.status ||
  data.callStatus ||
  data.call_status ||
  data.call?.status ||
  data.data?.status ||
  data.data?.callStatus ||
  data.data?.call?.status ||
  data.callData?.status ||
  ''
).trim().toLowerCase();

const getExpiresAtFromData = (data = {}) => parseTimestampMs(
  data.expiresAt ||
  data.expireAt ||
  data.expires_at ||
  data.call?.expiresAt ||
  data.data?.expiresAt ||
  data.callData?.expiresAt,
);

const getFreshnessTimestampFromData = (data = {}, options = {}) => {
  const includeSyntheticReceivedAt = options.includeSyntheticReceivedAt !== false;
  const timestamps = [
    includeSyntheticReceivedAt || !data._receivedAtIsSynthetic ? data.receivedAt : null,
    data.requestedAt,
    data.createdAt,
    data.timestamp,
    data.call?.receivedAt,
    data.call?.requestedAt,
    data.call?.createdAt,
    data.data?.receivedAt,
    data.data?.requestedAt,
    data.data?.createdAt,
    data.callData?.receivedAt,
    data.callData?.requestedAt,
    data.callData?.createdAt,
  ]
    .map(parseTimestampMs)
    .filter(Boolean);

  return timestamps.length ? Math.max(...timestamps) : null;
};

export const isFreshIncomingCallPayload = (payload, options = {}) => {
  const now = options.now || Date.now();
  const maxAgeMs = options.maxAgeMs || INCOMING_CALL_PRESENTATION_TTL_MS;
  const rawData = normalizeNotificationData(payload);
  const objectPayload = payload && typeof payload === 'object' ? payload : {};
  const data = { ...rawData, ...objectPayload };

  if (!getCallIdFromData(data) || !isCallNotificationData(data)) return false;

  const status = getStatusFromData(data);
  if (TERMINAL_CALL_STATUSES.has(status)) return false;

  const expiresAt = getExpiresAtFromData(data);
  if (expiresAt && expiresAt <= now) return false;

  const timestamp = getFreshnessTimestampFromData(data, options);
  if (!timestamp) return options.allowMissingTimestamp === true;

  const ageMs = now - timestamp;
  return ageMs >= -30000 && ageMs <= maxAgeMs;
};

export const clearPendingIncomingCallStorage = async () => {
  pendingIntent = null;
  await Promise.all([
    AsyncStorage.removeItem(PENDING_CALL_INTENT_KEY),
    AsyncStorage.removeItem(PENDING_CALL_PUSH_KEY),
  ]);
};

const normalizeParty = (party, fallbackId, fallbackName, fallbackType, fallbackImage) => {
  if (party && typeof party === 'object') return party;
  if (!party && !fallbackId && !fallbackName) return null;
  return {
    id: party || fallbackId || null,
    displayName: fallbackName || (typeof party === 'string' ? party : null),
    fullName: fallbackName || (typeof party === 'string' ? party : null),
    type: fallbackType || null,
    profilePhoto: fallbackImage || null,
  };
};

export const isCallNotificationData = (data = {}) => {
  const presentation = String(data.presentation || data.presentAs || '').trim().toLowerCase();
  const notificationOnly =
    presentation === 'notification_only' ||
    String(data.notificationOnly || '').toLowerCase() === 'true';
  if (notificationOnly) return false;

  const type = String(data.type || data.notificationType || data.event || '').trim().toUpperCase();
  const callType = String(data.callType || data.call_type || data.mode || '').trim().toLowerCase();
  const hasCallId = Boolean(getCallIdFromData(data));

  if (type === 'VIDEO_CALL' || type === 'VOICE_CALL' || type === 'AUDIO_CALL' || type === 'INCOMING_CALL') {
    return true;
  }

  if (type.includes('CALL') && hasCallId) {
    return true;
  }

  return hasCallId && (callType.includes('video') || callType.includes('audio') || callType.includes('voice'));
};

const getNotificationStreamRoomId = (data = {}) => (
  data.streamCallId ||
  data.stream_call_id ||
  data.streamId ||
  data.roomId ||
  data.room_id ||
  data.channelId ||
  data.call?.streamCallId ||
  data.call?.roomId ||
  data.data?.streamCallId ||
  data.data?.roomId ||
  data.callData?.streamCallId ||
  data.callData?.roomId ||
  null
);

export const buildCallIntentFromNotification = (remoteMessageOrData, source = 'notification') => {
  const data = normalizeNotificationData(remoteMessageOrData);
  if (!isCallNotificationData(data)) return null;

  const callType =
    String(data.type || '').toUpperCase() === 'VOICE_CALL' || String(data.type || '').toUpperCase() === 'AUDIO_CALL'
      ? 'voice'
      : normalizeCallType(data.callType || data.call_type || data.mode || data.type);

  const callerName = data.callerName || data.name || data.title || data.senderName || null;
  const callerImage = data.callerImage || data.profilePhoto || data.image || data.avatar || null;
  const callerId = data.callerId || data.fromId || data.senderId || null;
  const callerType = data.callerRole || data.fromType || data.senderRole || null;
  const from = normalizeParty(data.from || data.initiator || data.sender, callerId, callerName, callerType, callerImage);
  const streamRoomId = getNotificationStreamRoomId(data);
  const payloadReceivedAt = parseTimestampMs(data.receivedAt || remoteMessageOrData?.receivedAt);

  return {
    source,
    receivedAt: payloadReceivedAt || Date.now(),
    _receivedAtIsSynthetic: !payloadReceivedAt,
    data,
    callId: getCallIdFromData(data),
    roomId: streamRoomId,
    streamCallId: streamRoomId,
    callType,
    name: callerName,
    image: callerImage,
    from,
    initiator: normalizeParty(data.initiator, callerId, callerName, callerType, callerImage),
    receiver: data.receiver || null,
    requestedAt: data.requestedAt || data.createdAt || null,
    expiresAt: data.expiresAt || null,
  };
};

export const notifyIncomingCallIntent = async (remoteMessageOrData, source = 'notification') => {
  const intent = buildCallIntentFromNotification(remoteMessageOrData, source);
  if (!intent) return null;
  const isNotificationOpenReplay =
    source === 'cold-start' ||
    source === 'notification-open' ||
    source === 'notification-press';

  if (intent._receivedAtIsSynthetic && !isNotificationOpenReplay) {
    intent._receivedAtIsSynthetic = false;
  }

  if (isNotificationOpenReplay) {
    try {
      const pendingPushRaw = await AsyncStorage.getItem(PENDING_CALL_PUSH_KEY);
      const pendingPush = pendingPushRaw ? JSON.parse(pendingPushRaw) : null;
      if (
        pendingPush &&
        String(getCallIdFromData(pendingPush) || '') === String(intent.callId)
      ) {
        const storedReceivedAt = parseTimestampMs(pendingPush.receivedAt);
        if (storedReceivedAt) {
          intent.receivedAt = storedReceivedAt;
          intent._receivedAtIsSynthetic = false;
          intent.data = { ...intent.data, receivedAt: storedReceivedAt };
        }
      }
    } catch (_) {}
  }

  if (
    !isFreshIncomingCallPayload(intent, {
      includeSyntheticReceivedAt: !isNotificationOpenReplay,
      allowMissingTimestamp: !isNotificationOpenReplay,
    })
  ) {
    await clearPendingIncomingCallStorage();
    return null;
  }

  // A killed-state full-screen activity and the normal app can each receive
  // the same initial notification. Do not replay a call that was already
  // accepted by the dedicated call activity.
  const mayReplayHandledCall =
    listeners.size === 0 ||
    source === 'cold-start' ||
    source === 'notification-open' ||
    source === 'notification-press';
  if (mayReplayHandledCall) {
    try {
      const handledRaw = await AsyncStorage.getItem(LAST_HANDLED_CALL_KEY);
      const handled = handledRaw ? JSON.parse(handledRaw) : null;
      if (
        String(handled?.callId || '') === String(intent.callId) &&
        Date.now() - Number(handled?.handledAt || 0) < HANDLED_CALL_TTL_MS
      ) {
        await clearPendingIncomingCallStorage();
        return null;
      }
    } catch (_) {}
  }

  pendingIntent = intent;
  // Persist only when the app UI is not mounted (headless/killed-state push).
  // A live controller consumes the event immediately; retaining it would
  // replay an already-ended call on the next app launch.
  if (listeners.size === 0) {
    try {
      await AsyncStorage.setItem(PENDING_CALL_INTENT_KEY, JSON.stringify(intent));
    } catch (_) {}
  } else {
    pendingIntent = null;
    try {
      await AsyncStorage.removeItem(PENDING_CALL_INTENT_KEY);
    } catch (_) {}
  }

  listeners.forEach((listener) => {
    try {
      listener(intent);
    } catch (error) {
      console.warn('[CallNotification] listener failed:', error?.message || error);
    }
  });

  return intent;
};

export const markIncomingCallHandled = async (callId) => {
  if (!callId) return;

  pendingIntent = null;
  await Promise.all([
    AsyncStorage.setItem(
      LAST_HANDLED_CALL_KEY,
      JSON.stringify({ callId: String(callId), handledAt: Date.now() }),
    ),
    AsyncStorage.removeItem(PENDING_CALL_INTENT_KEY),
    AsyncStorage.removeItem(PENDING_CALL_PUSH_KEY),
  ]);
};

export const subscribeToIncomingCallIntents = (listener) => {
  listeners.add(listener);
  if (pendingIntent) {
    setTimeout(() => listener(pendingIntent), 0);
  }
  return () => listeners.delete(listener);
};

export const consumePendingIncomingCallIntent = async () => {
  if (pendingIntent) {
    const intent = pendingIntent;
    pendingIntent = null;
    try {
      await AsyncStorage.removeItem(PENDING_CALL_INTENT_KEY);
    } catch (_) {}
    if (isFreshIncomingCallPayload(intent)) return intent;
    await clearPendingIncomingCallStorage();
    return null;
  }

  try {
    const raw = await AsyncStorage.getItem(PENDING_CALL_INTENT_KEY);
    if (!raw) return null;
    await AsyncStorage.removeItem(PENDING_CALL_INTENT_KEY);
    const intent = JSON.parse(raw);
    if (isFreshIncomingCallPayload(intent)) return intent;
    await clearPendingIncomingCallStorage();
    return null;
  } catch (_) {
    return null;
  }
};

export const setGlobalCallUiActive = (active) => {
  globalCallUiActive = Boolean(active);
};

export const isGlobalCallUiActive = () => globalCallUiActive;

export const claimIncomingCallPresentation = (callId) => {
  const key = String(callId || '');
  if (!key || presentedCallIds.has(key)) return false;
  presentedCallIds.add(key);
  return true;
};

export const releaseIncomingCallPresentation = (callId) => {
  if (callId) presentedCallIds.delete(String(callId));
};
