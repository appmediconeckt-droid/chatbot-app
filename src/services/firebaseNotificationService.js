import {
  getMessaging,
  getToken,
  isDeviceRegisteredForRemoteMessages,
  onMessage,
  onTokenRefresh,
  registerDeviceForRemoteMessages,
  setAutoInitEnabled,
} from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  Alert,
  PermissionsAndroid,
  Platform,
} from 'react-native';

const messaging = getMessaging();

export const requestNotificationPermission = async () => {
  try {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const permission = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );

      console.log('Notification permission:', permission);

      return permission === PermissionsAndroid.RESULTS.GRANTED;
    }

    return true;
  } catch (error) {
    console.log('Notification permission error:', error);
    return false;
  }
};

export const getFCMToken = async () => {
  try {
    // Token creation does not depend on Android's notification-display
    // permission. Ensure Firebase Messaging is initialized/registered first,
    // then retry briefly because a fresh install may still be creating its
    // Firebase Installation ID when App starts.
    await setAutoInitEnabled(messaging, true);

    if (!isDeviceRegisteredForRemoteMessages(messaging)) {
      await registerDeviceForRemoteMessages(messaging);
    }

    let token = null;
    let lastError = null;
    for (let attempt = 1; attempt <= 3 && !token; attempt += 1) {
      try {
        token = await getToken(messaging);
      } catch (error) {
        lastError = error;
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
        }
      }
    }

    if (!token) {
      throw lastError || new Error('Firebase returned an empty FCM token');
    }

    await AsyncStorage.setItem('fcmToken', token);

    console.log('================================');
    console.log('FCM TOKEN (also saved as AsyncStorage fcmToken):');
    console.log(token);
    console.log('================================');

    return token;
  } catch (error) {
    console.log('FCM Token Error:', error);
    return null;
  }
};

export const foregroundNotificationListener = () => {
  return onMessage(messaging, async remoteMessage => {
    console.log('Foreground notification:', remoteMessage);

    Alert.alert(
      remoteMessage.notification?.title || 'Humaeli',
      remoteMessage.notification?.body || 'New notification',
    );
  });
};

export const tokenRefreshListener = callback => {
  return onTokenRefresh(messaging, async newToken => {
    await AsyncStorage.setItem('fcmToken', newToken);
    console.log('New FCM Token:', newToken);

    if (callback) {
      await callback(newToken);
    }
  });
};
