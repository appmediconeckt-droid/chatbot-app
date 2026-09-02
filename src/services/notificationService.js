import {
  PermissionsAndroid,
  Platform,
} from 'react-native';
import notifee, { AndroidImportance } from '@notifee/react-native';

import {
  getMessaging,
  getToken,
  onTokenRefresh,
  onMessage,
  onNotificationOpenedApp,
  getInitialNotification,
  AuthorizationStatus,
  isDeviceRegisteredForRemoteMessages,
  registerDeviceForRemoteMessages,
  requestPermission,
} from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosInstance from '../axiosConfig';

const messaging = getMessaging();
const NOTIFICATION_CHANNEL_ID = 'humaeli-default';

/** Show an FCM message as a real device notification. */
export const displaySystemNotification = async remoteMessage => {
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
    if (Platform.OS === 'ios') {
      const status = await requestPermission(messaging);
      const enabled =
        status === AuthorizationStatus.AUTHORIZED ||
        status === AuthorizationStatus.PROVISIONAL;

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
    if (!isDeviceRegisteredForRemoteMessages(messaging)) {
      await registerDeviceForRemoteMessages(messaging);
    }

    const token = await getToken(messaging);

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
  return onTokenRefresh(messaging, async newToken => {
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
  return onMessage(messaging, async remoteMessage => {
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
  return onNotificationOpenedApp(
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
    const remoteMessage =
      await getInitialNotification(messaging);

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
