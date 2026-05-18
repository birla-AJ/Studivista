/**
 * @format
 */

import { AppRegistry, Text, TextInput } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { TEXT_DEFAULTS } from './src/theme';

const applyDefaultTextProps = Component => {
  Component.defaultProps = Component.defaultProps || {};
  Component.defaultProps.allowFontScaling = false;
  Component.defaultProps.maxFontSizeMultiplier = 1;
  Component.defaultProps.style = [
    TEXT_DEFAULTS,
    Component.defaultProps.style,
  ].filter(Boolean);
};

applyDefaultTextProps(Text);
applyDefaultTextProps(TextInput);

try {
  const messaging = require('@react-native-firebase/messaging').default;
  messaging().setBackgroundMessageHandler(async () => {});
} catch (err) {
  console.warn('Firebase background messaging unavailable:', err.message);
}

AppRegistry.registerComponent(appName, () => App);
