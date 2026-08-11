import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AuthorizationStatus,
  getMessaging,
  getToken,
  onMessage,
  onTokenRefresh,
  requestPermission,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';
import { PermissionsAndroid, Platform } from 'react-native';
import axiosInstance from '../axiosConfig';

const FCM_TOKEN_KEY = 'fcmToken';

const requestNotificationPermission = async messaging => {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    return PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
  }

  if (Platform.OS === 'ios') {
    return requestPermission(messaging);
  }

  return AuthorizationStatus.AUTHORIZED;
};

const saveToken = async token => {
  if (!token) return;

  await AsyncStorage.setItem(FCM_TOKEN_KEY, token);
  console.log('[PushNotification] FCM token:', token);

  const accessToken =
    (await AsyncStorage.getItem('accessToken')) ||
    (await AsyncStorage.getItem('token'));

  if (accessToken) {
    await axiosInstance.put('/api/notifications/token', { fcmToken: token });
  }
};

export const initializePushNotifications = () => {
  let unsubscribeMessage = () => {};
  let unsubscribeTokenRefresh = () => {};

  const initialize = async () => {
    try {
      const messaging = getMessaging();
      await requestNotificationPermission(messaging);
      await saveToken(await getToken(messaging));

      unsubscribeTokenRefresh = onTokenRefresh(messaging, token => {
        saveToken(token).catch(error => {
          console.warn('[PushNotification] Token refresh save failed:', error.message);
        });
      });

      unsubscribeMessage = onMessage(messaging, remoteMessage => {
        console.log('[PushNotification] Foreground message:', remoteMessage);
      });
    } catch (error) {
      console.warn(
        '[PushNotification] Setup failed. Check android/app/google-services.json:',
        error.message,
      );
    }
  };

  initialize();

  return () => {
    unsubscribeMessage();
    unsubscribeTokenRefresh();
  };
};

export const registerBackgroundMessageHandler = () => {
  try {
    const messaging = getMessaging();
    setBackgroundMessageHandler(messaging, async remoteMessage => {
      console.log('[PushNotification] Background message:', remoteMessage);
    });
  } catch (error) {
    console.warn('[PushNotification] Background setup failed:', error.message);
  }
};
