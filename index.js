/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

try {
  const messaging = require('@react-native-firebase/messaging').default;
  messaging().setBackgroundMessageHandler(async () => {});
} catch (err) {
  console.warn('Firebase background messaging unavailable:', err.message);
}

AppRegistry.registerComponent(appName, () => App);
