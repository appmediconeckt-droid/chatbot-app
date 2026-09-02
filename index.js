/**
 * @format
 */

import { AppRegistry, LogBox } from 'react-native';
import {
  getMessaging,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from './App';
import { name as appName } from './app.json';
import {
  displaySystemNotification,
  handleNotificationReplyEvent,
  PENDING_INCOMING_CALL_PUSH_KEY,
} from './src/services/notificationService';

const messaging = getMessaging();

// Runs headlessly when the user replies from an Android notification, so the
// reply can be sent without launching the application UI.
notifee.onBackgroundEvent(handleNotificationReplyEvent);
notifee.onForegroundEvent(handleNotificationReplyEvent);

setBackgroundMessageHandler(
  messaging,
  async remoteMessage => {
    const data = remoteMessage?.data || {};
    if (
      String(data.type || '').toUpperCase() === 'INCOMING_CALL' &&
      data.callId
    ) {
      await AsyncStorage.setItem(
        PENDING_INCOMING_CALL_PUSH_KEY,
        JSON.stringify({ ...data, receivedAt: Date.now() }),
      );
    }

    console.log(
      '🔥 Background Notification:',
      remoteMessage,
    );

    // FCM automatically displays messages containing a `notification` payload
    // while the app is backgrounded. Data-only messages need a local system
    // notification, otherwise they stay invisible in the notification tray.
    if (!remoteMessage.notification) {
      await displaySystemNotification(remoteMessage);
    }
  },
);

// Suppress console warnings
LogBox.ignoreAllLogs(true);

AppRegistry.registerComponent(appName, () => App);
