/**
 * @format
 */

import { AppRegistry, LogBox } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { registerBackgroundMessageHandler } from './src/services/pushNotificationService';

// Suppress console warnings
LogBox.ignoreAllLogs(true);

registerBackgroundMessageHandler();

AppRegistry.registerComponent(appName, () => App);
