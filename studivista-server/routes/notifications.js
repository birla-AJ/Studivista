const router   = require('express').Router();
const { v4 }   = require('uuid');
const { pool } = require('../config/db');
const auth     = require('../middleware/auth');
const { isAdmin, isTeacher } = require('../middleware/authorize');
const { normalizeList } = require('../utils/normalize');
const {
  createNotification,
  createNotificationsForBatch,
} = require('../utils/notifications');

router.get('/', auth, async (req, res) => {
  try {
    const { userId } = req.query;
    if (!isAdmin(req.user) && userId !== req.user.uid) return res.status(403).json({ error: 'Not allowed.' });
    const { rows } = userId
      ? await pool.query('SELECT * FROM sv_notifications WHERE user_id=$1 ORDER BY created_at DESC', [userId])
      : await pool.query('SELECT * FROM sv_notifications ORDER BY created_at DESC');
    res.json(normalizeList(rows));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    if (!isAdmin(req.user) && !isTeacher(req.user)) return res.status(403).json({ error: 'Not allowed.' });
    const { userId, title, body, type, classId, batchId } = req.body;
    const item = await createNotification(pool, req.app.get('io'), {
      userId, title, body, type: type || 'info', classId, batchId,
    });
    res.json(item);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/fan-out', auth, async (req, res) => {
  try {
    if (!isAdmin(req.user) && !isTeacher(req.user)) return res.status(403).json({ error: 'Not allowed.' });
    const { batchId, title, body, type, classId } = req.body;
    const b = await pool.query('SELECT student_ids, teacher_id FROM sv_batches WHERE id=$1', [batchId]);
    if (!b.rows.length) return res.status(404).json({ error: 'Batch not found.' });
    if (!isAdmin(req.user) && b.rows[0].teacher_id !== req.user.uid) return res.status(403).json({ error: 'Not allowed.' });
    const items = await createNotificationsForBatch(pool, req.app.get('io'), batchId, {
      title, body, type: type || 'info', classId,
    });
    res.json({ ok: true, count: items.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/push-token', auth, async (req, res) => {
  try {
    const { token, platform = '', deviceId = '' } = req.body || {};
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'token is required.' });
    }
    const id = v4();
    await pool.query(
      `INSERT INTO sv_user_push_tokens (id,user_id,token,platform,device_id,enabled)
       VALUES ($1,$2,$3,$4,$5,TRUE)
       ON CONFLICT (token)
       DO UPDATE SET user_id=$2,platform=$4,device_id=$5,enabled=TRUE,updated_at=NOW()`,
      [id, req.user.uid, token, platform, deviceId],
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/push-token', auth, async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'token is required.' });
    }
    await pool.query(
      `UPDATE sv_user_push_tokens
       SET enabled=FALSE,updated_at=NOW()
       WHERE token=$1 AND user_id=$2`,
      [token, req.user.uid],
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id/read', auth, async (req, res) => {
  try {
    const existing = await pool.query('SELECT user_id FROM sv_notifications WHERE id=$1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Notification not found.' });
    if (!isAdmin(req.user) && existing.rows[0].user_id !== req.user.uid) return res.status(403).json({ error: 'Not allowed.' });
    await pool.query('UPDATE sv_notifications SET read=TRUE WHERE id=$1', [req.params.id]);
    req.app.get('io')?.to(`user:${existing.rows[0].user_id}`).emit('notification-read', { id: req.params.id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const existing = await pool.query('SELECT user_id FROM sv_notifications WHERE id=$1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Notification not found.' });
    if (!isAdmin(req.user) && existing.rows[0].user_id !== req.user.uid) return res.status(403).json({ error: 'Not allowed.' });
    await pool.query('DELETE FROM sv_notifications WHERE id=$1', [req.params.id]);
    req.app.get('io')?.to(`user:${existing.rows[0].user_id}`).emit('notification-deleted', { id: req.params.id });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
