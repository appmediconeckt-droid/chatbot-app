/**
 * @format
 */

import { AppRegistry, LogBox } from 'react-native';
import App from './App';
import { name as appName } from './app.json';


import {
  getMessaging,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';
const messaging = getMessaging();

setBackgroundMessageHandler(
  messaging,
  async remoteMessage => {
    console.log(
      'Background notification received:',
      remoteMessage,
    );
  },
);

// Suppress console warnings
LogBox.ignoreAllLogs(true);

AppRegistry.registerComponent(appName, () => App);
