const router   = require('express').Router();
const { v4 }   = require('uuid');
const { pool } = require('../config/db');
const auth     = require('../middleware/auth');
const { isAdmin, isTeacher } = require('../middleware/authorize');
const { normalize, normalizeList } = require('../utils/normalize');
const { createNotificationsForBatch } = require('../utils/notifications');

router.get('/', auth, async (req, res) => {
  try {
    const { teacherId, batchId } = req.query;
    if (!isAdmin(req.user) && !batchId) {
      if (!isTeacher(req.user) || teacherId !== req.user.uid) return res.status(403).json({ error: 'Not allowed.' });
    }
    if (!isAdmin(req.user) && batchId) {
      if (isTeacher(req.user)) {
        const batch = await pool.query('SELECT teacher_id FROM sv_batches WHERE id=$1', [batchId]);
        if (!batch.rows.length || batch.rows[0].teacher_id !== req.user.uid) return res.status(403).json({ error: 'Not allowed.' });
      } else {
        const user = await pool.query('SELECT batch_ids FROM sv_users WHERE uid=$1', [req.user.uid]);
        if (!(user.rows[0]?.batch_ids || []).includes(batchId)) return res.status(403).json({ error: 'Not allowed.' });
      }
    }
    const { rows } = teacherId
      ? await pool.query('SELECT * FROM sv_notes WHERE teacher_id=$1 ORDER BY created_at DESC', [teacherId])
      : batchId
        ? await pool.query('SELECT * FROM sv_notes WHERE batch_id=$1 ORDER BY created_at DESC', [batchId])
        : await pool.query('SELECT * FROM sv_notes ORDER BY created_at DESC');
    res.json(normalizeList(rows));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/by-batches', auth, async (req, res) => {
  try {
    const { batchIds } = req.body;
    if (!batchIds?.length) return res.json([]);
    if (!Array.isArray(batchIds)) return res.status(400).json({ error: 'batchIds must be an array.' });
    if (!isAdmin(req.user)) {
      if (isTeacher(req.user)) {
        const batches = await pool.query('SELECT id FROM sv_batches WHERE id=ANY($1) AND teacher_id=$2', [batchIds, req.user.uid]);
        if (batches.rows.length !== batchIds.length) return res.status(403).json({ error: 'Not allowed.' });
      } else {
        const user = await pool.query('SELECT batch_ids FROM sv_users WHERE uid=$1', [req.user.uid]);
        const allowedIds = user.rows[0]?.batch_ids || [];
        if (batchIds.some(id => !allowedIds.includes(id))) return res.status(403).json({ error: 'Not allowed.' });
      }
    }
    const { rows } = await pool.query('SELECT * FROM sv_notes WHERE batch_id=ANY($1) ORDER BY created_at DESC', [batchIds]);
    res.json(normalizeList(rows));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    if (!isAdmin(req.user) && !isTeacher(req.user)) return res.status(403).json({ error: 'Not allowed.' });
    const { title, body, batchId, batchName, teacherId, teacherName } = req.body;
    if (!title || !body || !batchId || !teacherId) return res.status(400).json({ error: 'title, body, batchId and teacherId required.' });
    if (!isAdmin(req.user) && teacherId !== req.user.uid) return res.status(403).json({ error: 'Not allowed.' });
    const id = v4();
    await pool.query(
      `INSERT INTO sv_notes (id,title,body,batch_id,batch_name,teacher_id,teacher_name) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, title.trim(), body.trim(), batchId, batchName||'', teacherId, teacherName||'']
    );
    const { rows } = await pool.query('SELECT * FROM sv_notes WHERE id=$1', [id]);
    const item = normalize(rows[0]);
    const io = req.app.get('io');
    io?.to('sub:notes').emit('data-update', { type: 'note-added', data: item });
    io?.to(`sub:notes:teacher:${teacherId}`).emit('data-update', { type: 'note-added', data: item });
    io?.to(`sub:notes:batch:${batchId}`).emit('data-update', { type: 'note-added', data: item });
    await createNotificationsForBatch(pool, io, batchId, {
      title: `New note: ${title.trim()}`,
      body: `${teacherName || 'Your teacher'} shared a note with ${batchName || 'your batch'}.`,
      type: 'note',
    });
    res.json(item);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const existing = await pool.query('SELECT teacher_id FROM sv_notes WHERE id=$1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Note not found.' });
    if (!isAdmin(req.user) && (!isTeacher(req.user) || existing.rows[0].teacher_id !== req.user.uid)) {
      return res.status(403).json({ error: 'Not allowed.' });
    }
    await pool.query('DELETE FROM sv_notes WHERE id=$1', [req.params.id]);
    const payload = { type: 'note-deleted', data: { id: req.params.id } };
    const io = req.app.get('io');
    io?.to('sub:notes').emit('data-update', payload);
    if (existing.rows[0]?.teacher_id) {
      io?.to(`sub:notes:teacher:${existing.rows[0].teacher_id}`).emit('data-update', payload);
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
