const path = require('path');
const admin = require('firebase-admin');

let initialized = false;
let initAttempted = false;

const getServiceAccountPath = () => {
  const configured = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!configured) return null;
  return path.isAbsolute(configured)
    ? configured
    : path.resolve(__dirname, '..', configured);
};

const initFirebase = () => {
  if (initialized) return true;
  if (initAttempted) return false;
  initAttempted = true;

  const serviceAccountPath = getServiceAccountPath();
  if (!serviceAccountPath) {
    console.warn('[FCM] FIREBASE_SERVICE_ACCOUNT_PATH is not configured. Push sends are disabled.');
    return false;
  }

  try {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    initialized = true;
    console.log('[FCM] Firebase Admin initialized.');
    return true;
  } catch (err) {
    console.warn('[FCM] Firebase Admin initialization failed:', err.message);
    return false;
  }
};

const stringifyData = data => {
  const out = {};
  Object.entries(data || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    out[key] = String(value);
  });
  return out;
};

const disableToken = async (pool, token) => {
  if (!pool || !token) return;
  try {
    await pool.query(
      'UPDATE sv_user_push_tokens SET enabled=FALSE,updated_at=NOW() WHERE token=$1',
      [token],
    );
  } catch (err) {
    console.warn('[FCM] Failed to disable invalid token:', err.message);
  }
};

const isPermanentTokenError = code =>
  code === 'messaging/registration-token-not-registered' ||
  code === 'messaging/invalid-registration-token' ||
  code === 'messaging/invalid-argument';

const sendToToken = async (pool, token, notification) => {
  if (!initFirebase()) return { ok: false, skipped: true };
  const {
    title,
    body,
    id,
    type = 'info',
    classId = '',
    batchId = '',
  } = notification || {};

  if (!token || !title || !body) return { ok: false, skipped: true };

  try {
    const messageId = await admin.messaging().send({
      token,
      notification: { title, body },
      data: stringifyData({
        notificationId: id,
        type,
        classId,
        batchId,
      }),
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
          },
        },
      },
    });
    return { ok: true, messageId };
  } catch (err) {
    if (isPermanentTokenError(err.code)) {
      await disableToken(pool, token);
    }
    console.warn('[FCM] Push send failed:', err.code || err.message);
    return { ok: false, error: err.message };
  }
};

const sendToUser = async (pool, userId, notification) => {
  if (!userId) return [];
  const { rows } = await pool.query(
    'SELECT token FROM sv_user_push_tokens WHERE user_id=$1 AND enabled=TRUE',
    [userId],
  );
  const tokens = [...new Set(rows.map(row => row.token).filter(Boolean))];
  if (!tokens.length) {
    console.warn(`[FCM] No enabled push tokens for user ${userId}.`);
    return [];
  }
  return Promise.all(tokens.map(token => sendToToken(pool, token, notification)));
};

module.exports = {
  initFirebase,
  sendToUser,
};
