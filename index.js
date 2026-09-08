/**
 * @format
 */

import { AppRegistry, LogBox } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { registerBackgroundNotificationHandler } from './src/services/notificationService';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LanguageProvider } from './src/contexts/LanguageContext';
import { CallProvider } from './src/screens/user/VideoCall/CallProvider';
import GlobalIncomingCallController from './src/screens/user/VideoCall/GlobalIncomingCallController';

registerBackgroundNotificationHandler();


// Suppress console warnings
LogBox.ignoreAllLogs(true);

AppRegistry.registerComponent(appName, () => App);
AppRegistry.registerComponent('HumaeliIncomingCall', () => () => (
  <SafeAreaProvider>
    <LanguageProvider>
      <CallProvider>
        <GlobalIncomingCallController exitOnDismiss />
      </CallProvider>
    </LanguageProvider>
  </SafeAreaProvider>
));
