const { v4 } = require('uuid');
const { normalize } = require('./normalize');
const { sendToUser } = require('./fcm');

const createNotification = async (pool, io, data) => {
  const {
    userId,
    title,
    body,
    type = 'info',
    classId = null,
    batchId = null,
  } = data || {};

  if (!userId || !title || !body) return null;

  const id = v4();
  const { rows } = await pool.query(
    `INSERT INTO sv_notifications (id,user_id,title,body,type,class_id,batch_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING *`,
    [id, userId, title, body, type, classId, batchId],
  );

  const item = normalize(rows[0]);
  io?.to(`user:${userId}`).emit('notification', item);
  sendToUser(pool, userId, item).catch(err => {
    console.warn('[FCM] User push failed:', err.message);
  });
  return item;
};

const createNotificationsForUsers = async (pool, io, userIds, data) => {
  const ids = [...new Set((userIds || []).filter(Boolean))];
  const results = await Promise.all(
    ids.map(userId => createNotification(pool, io, { ...data, userId })),
  );
  return results.filter(Boolean);
};

const createNotificationsForBatch = async (pool, io, batchId, data) => {
  if (!batchId) return [];
  const { rows } = await pool.query(
    'SELECT student_ids FROM sv_batches WHERE id=$1',
    [batchId],
  );
  const studentIds = rows[0]?.student_ids || [];
  return createNotificationsForUsers(pool, io, studentIds, { ...data, batchId });
};

module.exports = {
  createNotification,
  createNotificationsForUsers,
  createNotificationsForBatch,
};
