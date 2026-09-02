/**
 * @format
 */

import { AppRegistry, LogBox } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { registerBackgroundNotificationHandler } from './src/services/notificationService';

registerBackgroundNotificationHandler();


// Suppress console warnings
LogBox.ignoreAllLogs(true);

AppRegistry.registerComponent(appName, () => App);
