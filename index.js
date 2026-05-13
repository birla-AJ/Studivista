/**
 * @format
 */

import { AppRegistry, NativeModules } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

if (NativeModules.RNFBAppModule && NativeModules.RNFBMessagingModule) {
  const messaging = require('@react-native-firebase/messaging').default;
  messaging().setBackgroundMessageHandler(async () => {});
}

AppRegistry.registerComponent(appName, () => App);
