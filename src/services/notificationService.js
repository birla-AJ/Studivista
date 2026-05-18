/**
 * notificationService.js
 * Same exported function names as original.
 *
 * Uses Socket.IO user rooms.
 * New:     uses Socket.io user rooms — server emits 'notification' event.
 */
import { NativeModules, Platform, PermissionsAndroid } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch, disconnectSocket, getSocket } from './api';

const PUSH_PREF_KEY = 'studivista:push-notifications-enabled';
const IN_APP_PREF_KEY = 'studivista:in-app-notifications-enabled';

let reconnectHandler = null;
let tokenRefreshUnsubscribe = null;
let currentFcmToken = null;
let messagingModule = null;
let messagingUnavailableWarningShown = false;
const recentlySeenNotifications = new Map();

const shouldDeliverForegroundNotification = notification => {
  const id = notification?.id || notification?.data?.notificationId;
  if (!id) return true;

  const now = Date.now();
  for (const [key, seenAt] of recentlySeenNotifications) {
    if (now - seenAt > 30000) recentlySeenNotifications.delete(key);
  }
  if (recentlySeenNotifications.has(id)) return false;
  recentlySeenNotifications.set(id, now);
  return true;
};

const getBooleanPreference = async (key, fallback = true) => {
  try {
    const saved = await AsyncStorage.getItem(key);
    if (saved === null) return fallback;
    return saved === 'true';
  } catch {
    return fallback;
  }
};

const setBooleanPreference = async (key, enabled) => {
  await AsyncStorage.setItem(key, enabled ? 'true' : 'false');
};

export const isPushNotificationEnabled = () =>
  getBooleanPreference(PUSH_PREF_KEY, true);

export const setPushNotificationPreference = enabled =>
  setBooleanPreference(PUSH_PREF_KEY, enabled);

export const isInAppNotificationEnabled = () =>
  getBooleanPreference(IN_APP_PREF_KEY, true);

export const setInAppNotificationPreference = enabled =>
  setBooleanPreference(IN_APP_PREF_KEY, enabled);

const getMessaging = () => {
  if (!messagingModule) {
    try {
      messagingModule = require('@react-native-firebase/messaging').default;
    } catch (err) {
      if (!messagingUnavailableWarningShown) {
        const nativeModuleNames = Object.keys(NativeModules || {}).filter(name =>
          name.includes('Firebase') || name.includes('RNFB'),
        );
        console.warn(
          'Firebase native module unavailable; push token registration is disabled.',
          err.message,
          nativeModuleNames,
        );
        messagingUnavailableWarningShown = true;
      }
      return null;
    }
  }
  return messagingModule;
};

// ── Register user with their socket room ──────────────────────────────────
// Call this right after login (AuthContext does it automatically)
export const registerUserSocket = uid => {
  if (!uid) return;
  const socket = getSocket();
  const register = () => socket.emit('register-user', { userId: uid });
  register();
  if (reconnectHandler) socket.off('connect', reconnectHandler);
  reconnectHandler = register;
  socket.on('connect', register);
};

export const unregisterUserSocket = () => {
  reconnectHandler = null;
  disconnectSocket();
};

// ── Android 13+ permission ────────────────────────────────────────────────
export const requestNotificationPermission = async () => {
  let granted = true;
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    try {
      granted =
        (await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        )) === PermissionsAndroid.RESULTS.GRANTED;
    } catch {
      return false;
    }
  }
  if (Platform.OS === 'ios') {
    const messaging = getMessaging();
    if (!messaging) return false;
    const status = await messaging().requestPermission();
    granted =
      status === messaging.AuthorizationStatus.AUTHORIZED ||
      status === messaging.AuthorizationStatus.PROVISIONAL;
  }
  return granted;
};

const saveToken = async token => {
  if (!token) return;
  currentFcmToken = token;
  await apiFetch('/api/notifications/push-token', {
    method: 'POST',
    body: {
      token,
      platform: Platform.OS,
    },
  });
};

export const registerPushTokenForUser = async uid => {
  if (!uid) return null;
  const messaging = getMessaging();
  if (!messaging) return null;
  try {
    await messaging().registerDeviceForRemoteMessages();
    const token = await messaging().getToken();
    await saveToken(token);
    console.log('FCM token registered for user:', uid);
    if (tokenRefreshUnsubscribe) tokenRefreshUnsubscribe();
    tokenRefreshUnsubscribe = messaging().onTokenRefresh(nextToken => {
      saveToken(nextToken).catch(err => {
        console.warn('FCM token refresh save failed:', err.message);
      });
    });
    return token;
  } catch (err) {
    console.warn('FCM token registration failed:', err.message);
    return null;
  }
};

export const unregisterPushTokenForUser = async () => {
  if (tokenRefreshUnsubscribe) {
    tokenRefreshUnsubscribe();
    tokenRefreshUnsubscribe = null;
  }
  if (!currentFcmToken) {
    const messaging = getMessaging();
    if (messaging) {
      try {
        currentFcmToken = await messaging().getToken();
      } catch {}
    }
  }
  if (!currentFcmToken) return;
  try {
    await apiFetch('/api/notifications/push-token', {
      method: 'DELETE',
      body: { token: currentFcmToken },
    });
  } catch {}
  currentFcmToken = null;
};

// ── Listen for foreground notifications ───────────────────────────────────
// Original: fbMessaging.onMessage(cb) → returns unsubscribe fn
// New:      socket.on('notification', cb) → same return pattern ✅
export const onForegroundMessage = cb => {
  const socket = getSocket();
  const deliver = async notification => {
    if (!(await isInAppNotificationEnabled())) return;
    if (shouldDeliverForegroundNotification(notification)) cb(notification);
  };

  socket.on('notification', deliver);

  const messaging = getMessaging();
  const unsubscribeMessaging = messaging
    ? messaging().onMessage(remoteMessage => {
        const notification = remoteMessage?.notification || {};
        deliver({
          title: notification.title,
          body: notification.body,
          data: remoteMessage?.data || {},
        });
      })
    : null;

  return () => {
    socket.off('notification', deliver);
    if (unsubscribeMessaging) unsubscribeMessaging();
  };
};

// ── Stubs — same names as original so no screen changes needed ────────────
export const saveFcmTokenForUser = registerPushTokenForUser;
export const subscribeToBatchTopic = async batchId => {};
export const unsubscribeFromBatchTopic = async batchId => {};
