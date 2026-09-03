import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_CALL_INTENT_KEY = 'pendingIncomingCallNotification';

const listeners = new Set();
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

export const isCallNotificationData = (data = {}) => {
  const type = String(data.type || data.notificationType || data.event || '').trim().toUpperCase();
  const callType = String(data.callType || data.call_type || data.mode || '').trim().toLowerCase();
  const hasCallId = Boolean(data.callId || data.call_id || data.id || data._id);

  if (type === 'VIDEO_CALL' || type === 'VOICE_CALL' || type === 'AUDIO_CALL' || type === 'INCOMING_CALL') {
    return true;
  }

  if (type.includes('CALL') && hasCallId) {
    return true;
  }

  return hasCallId && (callType.includes('video') || callType.includes('audio') || callType.includes('voice'));
};

export const buildCallIntentFromNotification = (remoteMessageOrData, source = 'notification') => {
  const data = normalizeNotificationData(remoteMessageOrData);
  if (!isCallNotificationData(data)) return null;

  const callType =
    data.type === 'VOICE_CALL' || data.type === 'AUDIO_CALL'
      ? 'voice'
      : normalizeCallType(data.callType || data.call_type || data.mode || data.type);

  return {
    source,
    receivedAt: Date.now(),
    data,
    callId: data.callId || data.call_id || data.id || data._id || null,
    roomId: data.roomId || data.room_id || data.channelId || null,
    callType,
    name: data.callerName || data.name || data.title || data.senderName || null,
    image: data.callerImage || data.profilePhoto || data.image || data.avatar || null,
    from: data.from || data.initiator || data.sender || null,
    initiator: data.initiator || data.from || null,
    receiver: data.receiver || null,
    requestedAt: data.requestedAt || data.createdAt || null,
    expiresAt: data.expiresAt || null,
  };
};

export const notifyIncomingCallIntent = async (remoteMessageOrData, source = 'notification') => {
  const intent = buildCallIntentFromNotification(remoteMessageOrData, source);
  if (!intent) return null;

  pendingIntent = intent;
  try {
    await AsyncStorage.setItem(PENDING_CALL_INTENT_KEY, JSON.stringify(intent));
  } catch (_) {}

  listeners.forEach((listener) => {
    try {
      listener(intent);
    } catch (error) {
      console.warn('[CallNotification] listener failed:', error?.message || error);
    }
  });

  return intent;
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
    return intent;
  }

  try {
    const raw = await AsyncStorage.getItem(PENDING_CALL_INTENT_KEY);
    if (!raw) return null;
    await AsyncStorage.removeItem(PENDING_CALL_INTENT_KEY);
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
};

export const setGlobalCallUiActive = (active) => {
  globalCallUiActive = Boolean(active);
};

export const isGlobalCallUiActive = () => globalCallUiActive;
