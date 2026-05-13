/**
 * Compatibility shims for older Firestore-style imports.
 *
 * Screens import { Timestamp, db, FieldValue } from this module while the
 * real data flow is handled by the custom Studivista API.
 */
import { subscribeStudentAttendance } from './firestoreService';

export const Timestamp = {
  fromDate: date => (date instanceof Date ? date.toISOString() : date),
  now: () => new Date().toISOString(),
};

export const FieldValue = {
  serverTimestamp: () => new Date().toISOString(),
  arrayUnion: (...items) => items,
  arrayRemove: item => item,
};

const makeDocStub = (collectionPath, docId) => ({
  collection: subCol => makeCollectionStub(`${collectionPath}/${docId}/${subCol}`),
  onSnapshot: () => () => {},
});

const makeCollectionStub = path => ({
  doc: id => ({
    ...makeDocStub(path, id),
    onSnapshot: cb => {
      const parts = path.split('/');
      if (parts[0] === 'classes' && parts[2] === 'attendance') {
        const classId = parts[1];
        return subscribeStudentAttendance(classId, id, record => {
          cb({
            exists: () => !!record,
            id,
            data: () => record || {},
          });
        });
      }
      return () => {};
    },
  }),
  onSnapshot: () => () => {},
  where: () => makeCollectionStub(path),
  orderBy: () => makeCollectionStub(path),
  add: async () => ({ id: 'stub' }),
  get: async () => ({ docs: [], empty: true, exists: () => false }),
});

export const db = {
  collection: name => makeCollectionStub(name),
  batch: () => ({ update: () => {}, commit: async () => {} }),
};

export const documentId = () => '__id__';
export const getSecondaryAuth = () => null;
export const fbAuth = null;
export const fbMessaging = null;
