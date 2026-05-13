/**
 * notificationService.js
 * Same exported function names as original.
 *
 * Uses Socket.IO user rooms.
 * New:     uses Socket.io user rooms — server emits 'notification' event.
 */
import { Platform, PermissionsAndroid } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { apiFetch, disconnectSocket, getSocket } from './api';

let reconnectHandler = null;
let tokenRefreshUnsubscribe = null;
let currentFcmToken = null;

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
  try {
    await messaging().registerDeviceForRemoteMessages();
    const token = await messaging().getToken();
    await saveToken(token);
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
  socket.on('notification', cb);
  return () => socket.off('notification', cb);
};

// ── Stubs — same names as original so no screen changes needed ────────────
export const saveFcmTokenForUser = registerPushTokenForUser;
export const subscribeToBatchTopic = async batchId => {};
export const unsubscribeFromBatchTopic = async batchId => {};
