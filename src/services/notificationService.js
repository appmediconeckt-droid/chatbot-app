import {
  PermissionsAndroid,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosInstance from '../axiosConfig';

const NOTIFICATION_CHANNEL_ID = 'humaeli-default';
let firebaseMessagingApi;
let notifeeApi;

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

export const registerBackgroundNotificationHandler = () => {
  const api = getFirebaseMessagingApi();
  const messaging = getMessagingInstance();
  if (!api?.setBackgroundMessageHandler || !messaging) return;

  try {
    api.setBackgroundMessageHandler(
      messaging,
      async remoteMessage => {
        console.log('Background Notification:', remoteMessage);
        if (!remoteMessage.notification) {
          await displaySystemNotification(remoteMessage);
        }
      },
    );
  } catch (error) {
    warnNativeNotificationsUnavailable(error);
  }
};

/** Show an FCM message as a real device notification. */
export const displaySystemNotification = async remoteMessage => {
  const notificationApi = getNotifeeApi();
  const notifee = notificationApi?.default || notificationApi;
  const AndroidImportance = notificationApi?.AndroidImportance || {};
  if (!notifee?.displayNotification) return;

  const title =
    remoteMessage?.notification?.title ||
    remoteMessage?.data?.title ||
    'Humaeli';
  const body =
    remoteMessage?.notification?.body ||
    remoteMessage?.data?.body ||
    remoteMessage?.data?.message ||
    'You have a new notification';

  const data = Object.fromEntries(
    Object.entries(remoteMessage?.data || {}).map(([key, value]) => [
      key,
      String(value),
    ]),
  );

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

  await notifee.displayNotification({
    title: String(title),
    body: String(body),
    data,
    android: {
      channelId: NOTIFICATION_CHANNEL_ID,
      importance: AndroidImportance.HIGH,
      sound: 'default',
      pressAction: { id: 'default' },
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
      '/api/notifications/register-token',
      { userId, token, platform: Platform.OS },
    );

    const data = response.data;

    console.log('✅ FCM Token save response:', data);

    // In development only, ask the backend to send a real push immediately
    // after registration. Release builds will never send this login test.
    if (__DEV__) {
      const testResponse = await axiosInstance.post(
        '/api/notifications/test',
        { fcmToken: token },
      );
      console.log('[Push] Backend test response:', testResponse.data);
    }

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

    // The visible app already updates through its chat/socket UI. Suppress the
    // duplicate system banner here; FCM still displays notification payloads
    // automatically while the app is backgrounded or swiped away.
    console.log('[Push] Foreground system notification suppressed');
  });
};

/**
 * Background notification click
 */
export const listenForNotificationOpen = navigation => {
  const api = getFirebaseMessagingApi();
  const messaging = getMessagingInstance();
  if (!api?.onNotificationOpenedApp || !messaging) return () => {};

  return api.onNotificationOpenedApp(
    messaging,
    remoteMessage => {
      console.log(
        'Notification opened:',
        remoteMessage,
      );

      handleNotificationNavigation(
        navigation,
        remoteMessage,
      );
    },
  );
};

/**
 * App completely closed tha
 */
export const checkInitialNotification = async navigation => {
  try {
    const api = getFirebaseMessagingApi();
    const messaging = getMessagingInstance();
    if (!api?.getInitialNotification || !messaging) return;

    const remoteMessage =
      await api.getInitialNotification(messaging);

    if (remoteMessage) {
      console.log(
        'App opened from killed state:',
        remoteMessage,
      );

      handleNotificationNavigation(
        navigation,
        remoteMessage,
      );
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
const handleNotificationNavigation = (
  navigation,
  remoteMessage,
) => {
  const data = remoteMessage?.data;

  if (!data) {
    return;
  }

  if (data.type === 'CHAT_MESSAGE') {
    navigation?.navigate('Chat', {
      chatId: data.chatId,
    });
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
