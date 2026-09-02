/**
 * @format
 */

import { AppRegistry, LogBox } from 'react-native';
import {
  getMessaging,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';
import { displaySystemNotification } from './src/services/notificationService';

const messaging = getMessaging();

setBackgroundMessageHandler(
  messaging,
  async remoteMessage => {
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
