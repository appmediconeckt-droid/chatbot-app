/**
 * @format
 */

import { AppRegistry, LogBox } from 'react-native';
import App from './App';
import { name as appName } from './app.json';


// Suppress console warnings
LogBox.ignoreAllLogs(true);

AppRegistry.registerComponent(appName, () => App);
