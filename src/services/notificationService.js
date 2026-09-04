import {
  PermissionsAndroid,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosInstance from '../axiosConfig';
import {
  isCallNotificationData,
  normalizeCallType,
  notifyIncomingCallIntent,
} from './callNotificationBridge';
import { startIncomingRingtone } from '../hooks/useRingtone';

const NOTIFICATION_CHANNEL_ID = 'humaeli-default';
const INCOMING_CALL_CHANNEL_ID = 'humaeli-incoming-calls-v3';
const MISSED_CALL_NOTIFIED_KEY_PREFIX = 'missedCallNotification:';
export const PENDING_INCOMING_CALL_PUSH_KEY = 'pendingIncomingCallPush';
export const PENDING_NOTIFICATION_OPEN_KEY = 'pendingNotificationOpen';
export const NOTIFICATION_REPLY_ACTION_ID = 'reply-to-chat';
let firebaseMessagingApi;
let notifeeApi;
let backgroundHandlersRegistered = false;
let foregroundPressNavigation;

const getNotificationChatId = data =>
  data?.chatId || data?.chatID || data?.chat_id || data?.conversationId ||
  data?.conversation_id || data?.roomId || data?.room_id || '';

const isChatNotification = data => {
  const type = String(
    data?.type || data?.notificationType || data?.event || '',
  ).toUpperCase();
  if (!getNotificationChatId(data) || isIncomingCallNotification(data)) {
    return false;
  }
  return [
    'CHAT_MESSAGE',
    'CHAT',
    'MESSAGE',
    'NEW_MESSAGE',
  ].includes(type) || Boolean(
    data?.message || data?.content || data?.senderId || data?.sender_id,
  );
};

const isIncomingCallNotification = data => {
  return isCallNotificationData(data);
};

const getCallNotificationId = data => (
  data?.callId ||
  data?.call_id ||
  data?.id ||
  data?._id ||
  data?.call?.callId ||
  data?.call?.id ||
  data?.call?._id ||
  data?.callData?.callId ||
  data?.callData?.id ||
  data?.callData?._id ||
  null
);

const getCallNotificationName = data => (
  data?.name ||
  data?.callerName ||
  data?.senderName ||
  data?.title ||
  data?.from?.anonymous ||
  data?.from?.anonName ||
  data?.from?.anonymousName ||
  data?.from?.displayName ||
  data?.from?.fullName ||
  data?.initiator?.anonymous ||
  data?.initiator?.anonName ||
  data?.initiator?.anonymousName ||
  data?.initiator?.displayName ||
  data?.initiator?.fullName ||
  'Caller'
);

const persistIncomingCallPush = async (remoteMessage, source) => {
  const data = remoteMessage?.data || remoteMessage || {};
  await AsyncStorage.setItem(
    PENDING_INCOMING_CALL_PUSH_KEY,
    JSON.stringify({ ...data, receivedAt: Date.now() }),
  );
  await notifyIncomingCallIntent(remoteMessage, source);
};

const warnNativeNotificationsUnavailable = (error) => {
  console.log('[Push] Native notification module unavailable:', error?.message || error);
};

const getFirebaseMessagingApi = () => {
  if (firebaseMessagingApi !== undefined) return firebaseMessagingApi;
  try {
    firebaseMessagingApi = require('@react-native-firebase/messaging');
  } catch (error) {
    firebaseMessagingApi = null;
    warnNativeNotificationsUnavailable(error);
  }
  return firebaseMessagingApi;
};

const getMessagingInstance = () => {
  const api = getFirebaseMessagingApi();
  if (!api?.getMessaging) return null;
  try {
    return api.getMessaging();
  } catch (error) {
    warnNativeNotificationsUnavailable(error);
    return null;
  }
};

const getNotifeeApi = () => {
  if (notifeeApi !== undefined) return notifeeApi;
  try {
    notifeeApi = require('@notifee/react-native');
  } catch (error) {
    notifeeApi = null;
    warnNativeNotificationsUnavailable(error);
  }
  return notifeeApi;
};

/** Send Android notification inline-reply text without opening the app UI. */
export const handleNotificationReplyEvent = async ({ type, detail }) => {
  const notificationApi = getNotifeeApi();
  const notifee = notificationApi?.default || notificationApi;
  if (
    type !== notificationApi?.EventType?.ACTION_PRESS ||
    detail?.pressAction?.id !== NOTIFICATION_REPLY_ACTION_ID
  ) {
    return;
  }

  const reply = String(detail?.input || '').trim();
  const chatId = getNotificationChatId(detail?.notification?.data);
  if (!reply || !chatId) {
    console.warn('[Push] Notification reply ignored: missing text or chatId');
    return;
  }

  try {
    await axiosInstance.post(
      `/api/chat/chat/${encodeURIComponent(chatId)}/message`,
      { content: reply },
    );
    if (detail?.notification?.id) {
      await notifee?.cancelNotification?.(detail.notification.id);
    }
  } catch (error) {
    console.error(
      '[Push] Notification reply failed:',
      error?.response?.data || error?.message || error,
    );
  }
};

/** Persist a normal notification press so a cold-started app can navigate once
 * the NavigationContainer is ready. */
const handleNotificationPressEvent = async ({ type, detail }) => {
  const notificationApi = getNotifeeApi();
  if (
    type !== notificationApi?.EventType?.PRESS ||
    detail?.pressAction?.id !== 'default'
  ) {
    return;
  }

  const data = detail?.notification?.data || {};
  if (Object.keys(data).length) {
    if (isIncomingCallNotification(data)) {
      await notifyIncomingCallIntent(data, 'notification-press');
      return;
    }
    if (foregroundPressNavigation) {
      await handleNotificationNavigation(foregroundPressNavigation, { data });
      return;
    }
    await AsyncStorage.setItem(
      PENDING_NOTIFICATION_OPEN_KEY,
      JSON.stringify(data),
    );
  }
};

const handleNotifeeEvent = async event => {
  await handleNotificationReplyEvent(event);
  await handleNotificationPressEvent(event);
};

export const registerBackgroundNotificationHandler = () => {
  if (backgroundHandlersRegistered) return;

  const api = getFirebaseMessagingApi();
  const messaging = getMessagingInstance();
  const notificationApi = getNotifeeApi();
  const notifee = notificationApi?.default || notificationApi;

  try {
    if (notifee?.onBackgroundEvent) {
      notifee.onBackgroundEvent(handleNotifeeEvent);
    }
    if (notifee?.onForegroundEvent) {
      notifee.onForegroundEvent(handleNotifeeEvent);
    }

    if (api?.setBackgroundMessageHandler && messaging) {
      api.setBackgroundMessageHandler(
        messaging,
        async remoteMessage => {
          const data = remoteMessage?.data || {};
          if (isIncomingCallNotification(data)) {
            await persistIncomingCallPush(remoteMessage, 'background-push');
            startIncomingRingtone(true);
            await displaySystemNotification(remoteMessage);
            console.log('Background incoming call notification:', remoteMessage);
            return;
          }

          console.log('Background Notification:', remoteMessage);
          // Notification payloads are already displayed by Android while the
          // app is backgrounded/killed. Only data-only messages need Notifee
          // here, otherwise the same push is displayed twice.
          if (!remoteMessage.notification) {
            await displaySystemNotification(remoteMessage);
          }
        },
      );
    }
    backgroundHandlersRegistered = true;
  } catch (error) {
    warnNativeNotificationsUnavailable(error);
  }
};

/** Show an FCM message as a real device notification. */
export const displaySystemNotification = async remoteMessage => {
  const notificationApi = getNotifeeApi();
  const notifee = notificationApi?.default || notificationApi;
  const AndroidImportance = notificationApi?.AndroidImportance || {};
  const AndroidCategory = notificationApi?.AndroidCategory || {};
  const AndroidDefaults = notificationApi?.AndroidDefaults || {};
  const AndroidVisibility = notificationApi?.AndroidVisibility || {};
  const AndroidLaunchActivityFlag = notificationApi?.AndroidLaunchActivityFlag || {};
  if (!notifee?.displayNotification) return;

  const title =
    remoteMessage?.notification?.title ||
    remoteMessage?.data?.title ||
    'Humaeli';
  const body =
    remoteMessage?.notification?.body ||
    remoteMessage?.data?.body ||
    remoteMessage?.data?.message ||
    remoteMessage?.data?.content ||
    'You have a new notification';

  const data = Object.fromEntries(
    Object.entries(remoteMessage?.data || {}).map(([key, value]) => [
      key,
      String(value),
    ]),
  );
  const canReply = Platform.OS === 'android' && isChatNotification(data);
  const isIncomingCall =
    Platform.OS === 'android' && isIncomingCallNotification(data);

  if (Platform.OS === 'android') {
    await notifee.createChannel({
      id: NOTIFICATION_CHANNEL_ID,
      name: 'Humaeli notifications',
      description: 'Messages, appointments and account notifications',
      importance: AndroidImportance.HIGH,
      sound: 'default',
      vibration: true,
    });

    if (isIncomingCall) {
      await notifee.createChannel({
        id: INCOMING_CALL_CHANNEL_ID,
        name: 'Incoming calls',
        description: 'Full-screen incoming call alerts; ringtone is played by the app',
        importance: AndroidImportance.HIGH,
        vibration: false,
        lights: true,
        lightColor: '#22c55e',
        visibility: AndroidVisibility.PUBLIC,
      });
    }
  }

  const callLaunchFlags = [
    AndroidLaunchActivityFlag.NEW_TASK,
    AndroidLaunchActivityFlag.CLEAR_TOP,
    AndroidLaunchActivityFlag.SINGLE_TOP,
  ].filter(Boolean);
  const incomingCallPressAction = {
    id: 'default',
    mainComponent: 'HumaeliIncomingCall',
    ...(callLaunchFlags.length ? { launchActivityFlags: callLaunchFlags } : {}),
  };

  await notifee.displayNotification({
    title: String(title),
    body: String(body),
    data,
    android: {
      channelId: isIncomingCall
        ? INCOMING_CALL_CHANNEL_ID
        : NOTIFICATION_CHANNEL_ID,
      importance: AndroidImportance.HIGH,
      sound: isIncomingCall ? undefined : 'default',
      defaults: isIncomingCall && AndroidDefaults.LIGHTS
        ? [AndroidDefaults.LIGHTS]
        : undefined,
      visibility: isIncomingCall ? AndroidVisibility.PUBLIC : undefined,
      pressAction: isIncomingCall
        ? incomingCallPressAction
        : { id: 'default' },
      category: isIncomingCall ? AndroidCategory.CALL : undefined,
      fullScreenAction: isIncomingCall
        ? incomingCallPressAction
        : undefined,
      ongoing: isIncomingCall || undefined,
      autoCancel: !isIncomingCall,
      loopSound: false,
      timeoutAfter: isIncomingCall ? 60000 : undefined,
      actions: canReply
        ? [{
            title: 'Reply',
            pressAction: { id: NOTIFICATION_REPLY_ACTION_ID },
            input: { placeholder: 'Type your reply…' },
          }]
        : undefined,
    },
    ios: {
      sound: 'default',
      foregroundPresentationOptions: {
        alert: true,
        badge: true,
        sound: true,
        banner: true,
        list: true,
      },
    },
  });
};

/**
 * Notification permission
 */
export const requestNotificationPermission = async () => {
  try {
    const api = getFirebaseMessagingApi();
    const messaging = getMessagingInstance();
    const notificationApi = getNotifeeApi();
    const notifee = notificationApi?.default || notificationApi;
    const AndroidImportance = notificationApi?.AndroidImportance || {};
    const AndroidVisibility = notificationApi?.AndroidVisibility || {};

    if (Platform.OS === 'android') {
      if (!notifee?.createChannel) return false;
      await notifee.createChannel({
        id: NOTIFICATION_CHANNEL_ID,
        name: 'Humaeli notifications',
        description: 'Messages, appointments and account notifications',
        importance: AndroidImportance.HIGH,
        sound: 'default',
        vibration: true,
      });
      await notifee.createChannel({
        id: INCOMING_CALL_CHANNEL_ID,
        name: 'Incoming calls',
        description: 'Full-screen incoming call alerts; ringtone is played by the app',
        importance: AndroidImportance.HIGH,
        vibration: false,
        lights: true,
        lightColor: '#22c55e',
        visibility: AndroidVisibility.PUBLIC,
      });
    }

    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );

      if (result !== PermissionsAndroid.RESULTS.GRANTED) {
        console.log('❌ Notification permission denied');
        return false;
      }
    }

    console.log('✅ Notification permission granted');
    if (Platform.OS === 'ios' && api?.requestPermission && messaging) {
      const status = await api.requestPermission(messaging);
      const enabled =
        status === api.AuthorizationStatus.AUTHORIZED ||
        status === api.AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        console.log('[Push] Notification permission denied on iOS');
        return false;
      }
    }

    return true;
  } catch (error) {
    console.log('❌ Permission Error:', error);
    return false;
  }
};

/**
 * Firebase FCM Token
 */
export const getFCMToken = async () => {
  try {
    const api = getFirebaseMessagingApi();
    const messaging = getMessagingInstance();
    if (!api || !messaging) return null;

    if (!api.isDeviceRegisteredForRemoteMessages(messaging)) {
      await api.registerDeviceForRemoteMessages(messaging);
    }

    const token = await api.getToken(messaging);

    if (!token) {
      throw new Error('Firebase returned an empty FCM token');
    }
    await AsyncStorage.setItem('fcmToken', token);

    console.log('==========================');
    console.log('🔥 FCM TOKEN');
    console.log(token);
    console.log('==========================');

    return token;
  } catch (error) {
    console.log('❌ FCM token error:', error);
    return null;
  }
};

/**
 * FCM token backend ko save karega
 */
export const saveFCMTokenToBackend = async (
  userId,
  token,
  authToken,
) => {
  try {
    if (!userId || !token) {
      return;
    }

    const response = await axiosInstance.post(
      '/api/notifications/token',
      { userId, token, fcmToken: token, platform: Platform.OS },
    );

    const data = response.data;

    console.log('✅ FCM Token save response:', data);

    return data;
  } catch (error) {
    console.log('❌ FCM token backend save error:', error);
  }
};

/** Generate the token and register it once an authenticated user exists. */
export const syncPushNotificationToken = async () => {
  const [storedUserId, userDataRaw, accessToken, legacyToken] = await Promise.all([
    AsyncStorage.getItem('userId'),
    AsyncStorage.getItem('userData'),
    AsyncStorage.getItem('accessToken'),
    AsyncStorage.getItem('token'),
  ]);

  let userId = storedUserId;
  if (!userId && userDataRaw) {
    try {
      const userData = JSON.parse(userDataRaw);
      userId = userData?._id || userData?.id || null;
      if (userId) {
        await AsyncStorage.setItem('userId', String(userId));
      }
    } catch (error) {
      console.warn('[Push] Could not read user id from stored user data');
    }
  }

  const token = await getFCMToken();
  const authToken = accessToken || legacyToken;
  if (!token || !userId || !authToken) {
    if (token && (!userId || !authToken)) {
      console.log('FCM token generated; backend registration waits for login');
    }
    return token;
  }

  await saveFCMTokenToBackend(String(userId), token, authToken);
  return token;
};

/**
 * Firebase token change hone par
 */
export const listenForTokenRefresh = (
  userId,
  authToken,
) => {
  const api = getFirebaseMessagingApi();
  const messaging = getMessagingInstance();
  if (!api?.onTokenRefresh || !messaging) return () => {};

  return api.onTokenRefresh(messaging, async newToken => {
    await AsyncStorage.setItem('fcmToken', newToken);
    const currentUserId = userId || await AsyncStorage.getItem('userId');
    const currentAuthToken = authToken ||
      await AsyncStorage.getItem('accessToken') ||
      await AsyncStorage.getItem('token');
    console.log('🔥 New FCM Token:', newToken);

    await saveFCMTokenToBackend(
      currentUserId,
      newToken,
      currentAuthToken,
    );
  });
};

/**
 * App open hai aur notification aayi
 */
export const listenForForegroundNotifications = () => {
  const api = getFirebaseMessagingApi();
  const messaging = getMessagingInstance();
  if (!api?.onMessage || !messaging) return () => {};

  return api.onMessage(messaging, async remoteMessage => {
    console.log(
      '🔥 Foreground Notification:',
      remoteMessage,
    );

    if (isIncomingCallNotification(remoteMessage?.data || {})) {
      await notifyIncomingCallIntent(remoteMessage, 'foreground-push');
      return;
    }

    // Keep chat actionable in every app state.
    if (isChatNotification(remoteMessage?.data)) {
      await displaySystemNotification(remoteMessage);
      return;
    }

    console.log('[Push] Foreground non-chat notification suppressed');
  });
};

export const displayMissedCallNotification = async (callData = {}, reason = 'missed') => {
  const notificationApi = getNotifeeApi();
  const notifee = notificationApi?.default || notificationApi;
  const AndroidImportance = notificationApi?.AndroidImportance || {};
  if (!notifee?.displayNotification) return;

  const rawData = callData?.data && typeof callData.data === 'object'
    ? { ...callData.data, ...callData }
    : callData;
  const callId = getCallNotificationId(rawData);
  const callType = normalizeCallType(rawData?.callType || rawData?.call_type || rawData?.type);
  const callerName = getCallNotificationName(rawData);

  if (callId) {
    const storageKey = `${MISSED_CALL_NOTIFIED_KEY_PREFIX}${callId}`;
    try {
      const alreadyShown = await AsyncStorage.getItem(storageKey);
      if (alreadyShown) return;
      await AsyncStorage.setItem(storageKey, String(Date.now()));
    } catch (_) {}
  }

  if (Platform.OS === 'android') {
    await notifee.createChannel({
      id: NOTIFICATION_CHANNEL_ID,
      name: 'Humaeli notifications',
      description: 'Messages, appointments and account notifications',
      importance: AndroidImportance.HIGH,
      sound: 'default',
      vibration: true,
    });
  }

  const title = callType === 'voice' ? 'Missed voice call' : 'Missed video call';
  const body = reason === 'ended'
    ? `${callerName} ended the call`
    : `${callerName} tried to call you`;

  await notifee.displayNotification({
    title,
    body,
    data: Object.fromEntries(
      Object.entries({
        ...rawData,
        type: 'MISSED_CALL',
        callType,
        callId: callId || '',
      }).map(([key, value]) => [key, String(value ?? '')]),
    ),
    android: Platform.OS === 'android'
      ? {
          channelId: NOTIFICATION_CHANNEL_ID,
          importance: AndroidImportance.HIGH,
          sound: 'default',
          pressAction: { id: 'default' },
          autoCancel: true,
        }
      : undefined,
    ios: {
      sound: 'default',
      foregroundPresentationOptions: {
        alert: true,
        badge: true,
        sound: true,
        banner: true,
        list: true,
      },
    },
  });
};

/**
 * Background notification click
 */
export const listenForNotificationOpen = navigation => {
  const api = getFirebaseMessagingApi();
  const messaging = getMessagingInstance();
  foregroundPressNavigation = navigation;
  if (!api?.onNotificationOpenedApp || !messaging) {
    return () => {
      foregroundPressNavigation = undefined;
    };
  }

  const unsubscribe = api.onNotificationOpenedApp(
    messaging,
    remoteMessage => {
      console.log(
        'Notification opened:',
        remoteMessage,
      );

      if (isIncomingCallNotification(remoteMessage?.data || {})) {
        void notifyIncomingCallIntent(remoteMessage, 'notification-open');
      } else {
        void handleNotificationNavigation(navigation, remoteMessage);
      }
    },
  );
  return () => {
    foregroundPressNavigation = undefined;
    unsubscribe();
  };
};

/**
 * App completely closed tha
 */
export const checkInitialNotification = async navigation => {
  try {
    const api = getFirebaseMessagingApi();
    const messaging = getMessagingInstance();
    if (!api?.getInitialNotification || !messaging) return;

    const [remoteMessage, pendingDataRaw] = await Promise.all([
      api.getInitialNotification(messaging),
      AsyncStorage.getItem(PENDING_NOTIFICATION_OPEN_KEY),
    ]);

    if (remoteMessage) {
      console.log(
        'App opened from killed state:',
        remoteMessage,
      );

      if (isIncomingCallNotification(remoteMessage?.data || {})) {
        await notifyIncomingCallIntent(remoteMessage, 'cold-start');
      } else {
        await handleNotificationNavigation(navigation, remoteMessage);
      }
      await AsyncStorage.removeItem(PENDING_NOTIFICATION_OPEN_KEY);
    } else if (pendingDataRaw) {
      await AsyncStorage.removeItem(PENDING_NOTIFICATION_OPEN_KEY);
      await handleNotificationNavigation(navigation, {
        data: JSON.parse(pendingDataRaw),
      });
    }
  } catch (error) {
    console.log(
      'Initial notification error:',
      error,
    );
  }
};

/**
 * Notification click ke according screen open
 */
export const handleNotificationNavigation = async (
  navigation,
  remoteMessage,
) => {
  const data = remoteMessage?.data;

  if (!data) {
    return;
  }

  if (isChatNotification(data)) {
    const role = String(
      data?.recipientRole ||
      data?.role ||
      (await AsyncStorage.getItem('userRole')) ||
      '',
    ).toLowerCase();
    const chatId = getNotificationChatId(data);
    if (/counsell?or/.test(role)) {
      navigation?.navigate('SMSInput', {
        chatId,
        selectedUser: {
          id: data?.senderId || data?.userId,
          name: data?.senderName || data?.title || 'User',
          chatId,
        },
      });
    } else {
      navigation?.navigate('ChatBox', { chatId });
    }
    return;
  }

  if (data.type === 'APPOINTMENT') {
    navigation?.navigate('MyAppointments');
  }

  if (data.type === 'PRESCRIPTION') {
    navigation?.navigate('Prescription');
  }

  if (data.type === 'VIDEO_CALL') {
    navigation?.navigate('CallScreen', {
      callId: data.callId,
    });
  }
};
