import { Platform, PermissionsAndroid } from 'react-native';
import { fbMessaging, db, FieldValue } from './firebase';

export const requestNotificationPermission = async () => {
    if (Platform.OS === 'android' && Platform.Version >= 33) {
        try {
            await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
        } catch {}
    }
    try {
        await fbMessaging.requestPermission();
    } catch {}
};

export const saveFcmTokenForUser = async (uid) => {
    if (!uid) return;
    try {
        const token = await fbMessaging.getToken();
        if (token) {
            await db.collection('users').doc(uid).update({
                fcmToken: token,
                fcmTokenUpdatedAt: FieldValue.serverTimestamp(),
            });
        }
    } catch {}
};

export const subscribeToBatchTopic = async (batchId) => {
    if (!batchId) return;
    try {
        await fbMessaging.subscribeToTopic(`batch_${batchId}`);
    } catch {}
};

export const unsubscribeFromBatchTopic = async (batchId) => {
    if (!batchId) return;
    try {
        await fbMessaging.unsubscribeFromTopic(`batch_${batchId}`);
    } catch {}
};

export const onForegroundMessage = (cb) => fbMessaging.onMessage(cb);
