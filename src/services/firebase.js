import { getApp, getApps, initializeApp } from '@react-native-firebase/app';
import auth, { getAuth } from '@react-native-firebase/auth';
import firestore, { documentId } from '@react-native-firebase/firestore';
import messaging from '@react-native-firebase/messaging';

const SECONDARY_APP_NAME = 'Studivista-Secondary';

const getOrCreateSecondaryApp = () => {
    const existing = getApps().find(app => app.name === SECONDARY_APP_NAME);
    if (existing) return existing;
    const defaultOptions = getApp().options;
    return initializeApp(defaultOptions, SECONDARY_APP_NAME);
};

export const getSecondaryAuth = () => getAuth(getOrCreateSecondaryApp());

export const db = firestore();
export const fbAuth = auth();
export const fbMessaging = messaging();

export const FieldValue = firestore.FieldValue;
export const Timestamp = firestore.Timestamp;
export const FieldPath = firestore.FieldPath;
export { documentId };
