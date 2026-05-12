const router   = require('express').Router();
const { v4 }   = require('uuid');
const { pool } = require('../config/db');
const auth     = require('../middleware/auth');
const { isAdmin, isTeacher } = require('../middleware/authorize');
const { normalize, normalizeList } = require('../utils/normalize');
const { createNotificationsForBatch } = require('../utils/notifications');

const emit = (req, data) => req.app.get('io')?.to('sub:classes').emit('data-update', data);

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
      ? await pool.query('SELECT * FROM sv_classes WHERE teacher_id=$1 ORDER BY scheduled_at DESC', [teacherId])
      : batchId
        ? await pool.query('SELECT * FROM sv_classes WHERE batch_id=$1 ORDER BY scheduled_at DESC', [batchId])
        : await pool.query('SELECT * FROM sv_classes ORDER BY scheduled_at DESC');
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
    const { rows } = await pool.query('SELECT * FROM sv_classes WHERE batch_id=ANY($1) ORDER BY scheduled_at DESC', [batchIds]);
    res.json(normalizeList(rows));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    if (!isAdmin(req.user) && !isTeacher(req.user)) return res.status(403).json({ error: 'Not allowed.' });
    const { batchId, batchName, teacherId, teacherName, title, description, scheduledAt, durationMin, color } = req.body;
    if (!isAdmin(req.user) && teacherId !== req.user.uid) return res.status(403).json({ error: 'Not allowed.' });
    const id = v4();
    await pool.query(
      `INSERT INTO sv_classes (id,batch_id,batch_name,teacher_id,teacher_name,title,description,scheduled_at,duration_min,color) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, batchId, batchName, teacherId, teacherName, title, description||'', scheduledAt, Number(durationMin)||60, color||'#FF4B6E']
    );
    const { rows } = await pool.query('SELECT * FROM sv_classes WHERE id=$1', [id]);
    const item = normalize(rows[0]);
    const io = req.app.get('io');
    io?.to('sub:classes').emit('data-update', { type: 'class-added', data: item });
    io?.to(`sub:classes:batch:${batchId}`).emit('data-update', { type: 'class-added', data: item });
    io?.to(`sub:classes:teacher:${teacherId}`).emit('data-update', { type: 'class-added', data: item });
    await createNotificationsForBatch(pool, io, batchId, {
      title: `New class scheduled: ${title}`,
      body: `${teacherName || 'Your teacher'} scheduled ${title}.`,
      type: 'schedule',
      classId: id,
    });
    res.json(item);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id', auth, async (req, res) => {
  try {
    const existing = await pool.query('SELECT teacher_id FROM sv_classes WHERE id=$1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Class not found.' });
    if (!isAdmin(req.user) && (!isTeacher(req.user) || existing.rows[0].teacher_id !== req.user.uid)) {
      return res.status(403).json({ error: 'Not allowed.' });
    }
    const fieldMap = { title:'title', description:'description', scheduledAt:'scheduled_at',
      durationMin:'duration_min', color:'color', status:'status', batchId:'batch_id' };
    const sets = []; const vals = [req.params.id];
    for (const [k, v] of Object.entries(req.body)) {
      const col = fieldMap[k]; if (col) { sets.push(`${col}=$${vals.length+1}`); vals.push(v); }
    }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update.' });
    await pool.query(`UPDATE sv_classes SET ${sets.join(',')},updated_at=NOW() WHERE id=$1`, vals);
    emit(req, { type: 'class-updated', data: { id: req.params.id, ...req.body } });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/start', auth, async (req, res) => {
  try {
    const existing = await pool.query('SELECT * FROM sv_classes WHERE id=$1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Class not found.' });
    if (!isAdmin(req.user) && (!isTeacher(req.user) || existing.rows[0].teacher_id !== req.user.uid)) {
      return res.status(403).json({ error: 'Not allowed.' });
    }
    await pool.query(`UPDATE sv_classes SET status='live',started_at=NOW(),updated_at=NOW() WHERE id=$1`, [req.params.id]);
    emit(req, { type: 'class-updated', data: { id: req.params.id, status: 'live' } });
    const cls = existing.rows[0];
    if (cls.status !== 'live') {
      await createNotificationsForBatch(pool, req.app.get('io'), cls.batch_id, {
        title: `${cls.title || 'Class'} is live`,
        body: `${cls.teacher_name || 'Your teacher'} just started the class.`,
        type: 'class_start',
        classId: req.params.id,
      });
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/end', auth, async (req, res) => {
  try {
    const existing = await pool.query('SELECT * FROM sv_classes WHERE id=$1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Class not found.' });
    if (!isAdmin(req.user) && (!isTeacher(req.user) || existing.rows[0].teacher_id !== req.user.uid)) {
      return res.status(403).json({ error: 'Not allowed.' });
    }
    await pool.query(`UPDATE sv_classes SET status='completed',ended_at=NOW(),updated_at=NOW() WHERE id=$1`, [req.params.id]);
    emit(req, { type: 'class-updated', data: { id: req.params.id, status: 'completed' } });
    const cls = existing.rows[0];
    if (cls.status !== 'completed') {
      await createNotificationsForBatch(pool, req.app.get('io'), cls.batch_id, {
        title: `${cls.title || 'Class'} ended`,
        body: `${cls.teacher_name || 'Your teacher'} ended the class.`,
        type: 'class_end',
        classId: req.params.id,
      });
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/join', auth, async (req, res) => {
  try {
    const { studentId } = req.body;
    if (!isAdmin(req.user) && !isTeacher(req.user) && req.user.uid !== studentId) {
      return res.status(403).json({ error: 'Not allowed.' });
    }
    const c = await pool.query('SELECT joined_student_ids FROM sv_classes WHERE id=$1', [req.params.id]);
    const ids = [...new Set([...(c.rows[0]?.joined_student_ids||[]), studentId])];
    await pool.query('UPDATE sv_classes SET joined_student_ids=$1,updated_at=NOW() WHERE id=$2', [JSON.stringify(ids), req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
