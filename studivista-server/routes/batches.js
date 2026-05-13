const router   = require('express').Router();
const { v4 }   = require('uuid');
const { pool } = require('../config/db');
const auth     = require('../middleware/auth');
const { isAdmin, isTeacher } = require('../middleware/authorize');
const { normalize, normalizeList } = require('../utils/normalize');
const {
  createNotification,
  createNotificationsForUsers,
} = require('../utils/notifications');

const emit = (req, data) => req.app.get('io')?.to('sub:batches').emit('data-update', data);

router.get('/', auth, async (req, res) => {
  try {
    const { teacherId } = req.query;
    if (!isAdmin(req.user)) {
      if (isTeacher(req.user)) {
        if (!teacherId || teacherId !== req.user.uid) return res.status(403).json({ error: 'Not allowed.' });
      } else {
        return res.status(403).json({ error: 'Not allowed.' });
      }
    }
    const { rows } = teacherId
      ? await pool.query('SELECT * FROM sv_batches WHERE teacher_id=$1 ORDER BY created_at DESC', [teacherId])
      : await pool.query('SELECT * FROM sv_batches ORDER BY created_at DESC');
    res.json(normalizeList(rows));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/by-ids', auth, async (req, res) => {
  try {
    const { ids } = req.body;
    if (!ids?.length) return res.json([]);
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids must be an array.' });
    if (!isAdmin(req.user) && !isTeacher(req.user)) {
      const user = await pool.query('SELECT batch_ids FROM sv_users WHERE uid=$1', [req.user.uid]);
      const allowedIds = user.rows[0]?.batch_ids || [];
      if (ids.some(id => !allowedIds.includes(id))) return res.status(403).json({ error: 'Not allowed.' });
    }
    const { rows } = await pool.query('SELECT * FROM sv_batches WHERE id=ANY($1)', [ids]);
    const filtered = isTeacher(req.user) && !isAdmin(req.user)
      ? rows.filter(row => row.teacher_id === req.user.uid)
      : rows;
    res.json(normalizeList(filtered));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', auth, async (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: 'Not allowed.' });
    const { name, subject, color, teacherId, teacherName, scheduleDays, scheduleTime, maxStudents } = req.body;
    const id = v4();
    await pool.query(
      `INSERT INTO sv_batches (id,name,subject,color,teacher_id,teacher_name,schedule_days,schedule_time,max_students) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, name, subject, color, teacherId||null, teacherName||'', JSON.stringify(scheduleDays||[]), scheduleTime||'', Number(maxStudents)||30]
    );
    if (teacherId) {
      const u = await pool.query('SELECT batch_ids FROM sv_users WHERE uid=$1', [teacherId]);
      if (u.rows.length) {
        const bids = [...new Set([...(u.rows[0].batch_ids||[]), id])];
        await pool.query('UPDATE sv_users SET batch_ids=$1 WHERE uid=$2', [JSON.stringify(bids), teacherId]);
      }
    }
    const { rows } = await pool.query('SELECT * FROM sv_batches WHERE id=$1', [id]);
    const item = normalize(rows[0]);
    emit(req, { type: 'batch-added', data: item });
    if (teacherId) {
      await createNotification(pool, req.app.get('io'), {
        userId: teacherId,
        title: `Assigned to ${name}`,
        body: `You have been assigned to teach ${name}.`,
        type: 'batch',
        batchId: id,
      });
    }
    res.json(item);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:id', auth, async (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: 'Not allowed.' });
    const before = await pool.query('SELECT * FROM sv_batches WHERE id=$1', [req.params.id]);
    if (!before.rows.length) return res.status(404).json({ error: 'Batch not found.' });
    const fieldMap = { name:'name', subject:'subject', color:'color', teacherId:'teacher_id',
      teacherName:'teacher_name', scheduleDays:'schedule_days', scheduleTime:'schedule_time',
      maxStudents:'max_students', status:'status' };
    const sets = []; const vals = [req.params.id];
    for (const [k, v] of Object.entries(req.body)) {
      const col = fieldMap[k];
      if (!col) continue;
      if (k === 'scheduleDays' && !Array.isArray(v)) {
        return res.status(400).json({ error: 'scheduleDays must be an array.' });
      }
      const value = k === 'scheduleDays'
        ? JSON.stringify(v || [])
        : k === 'maxStudents'
          ? Number(v) || 30
          : v;
      sets.push(`${col}=$${vals.length+1}`);
      vals.push(value);
    }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update.' });
    await pool.query(`UPDATE sv_batches SET ${sets.join(',')},updated_at=NOW() WHERE id=$1`, vals);
    emit(req, { type: 'batch-updated', data: { id: req.params.id, ...req.body } });
    if (req.body.teacherId && req.body.teacherId !== before.rows[0].teacher_id) {
      await createNotification(pool, req.app.get('io'), {
        userId: req.body.teacherId,
        title: `Assigned to ${req.body.name || before.rows[0].name}`,
        body: `You have been assigned to teach ${req.body.name || before.rows[0].name}.`,
        type: 'batch',
        batchId: req.params.id,
      });
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    if (!isAdmin(req.user)) return res.status(403).json({ error: 'Not allowed.' });
    await pool.query('DELETE FROM sv_batches WHERE id=$1', [req.params.id]);
    emit(req, { type: 'batch-deleted', data: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/add-students', auth, async (req, res) => {
  try {
    const { studentUids } = req.body;
    const batchId = req.params.id;
    const b = await pool.query('SELECT name, student_ids, teacher_id FROM sv_batches WHERE id=$1', [batchId]);
    if (!b.rows.length) return res.status(404).json({ error: 'Batch not found.' });
    if (!isAdmin(req.user) && (!isTeacher(req.user) || b.rows[0].teacher_id !== req.user.uid)) {
      return res.status(403).json({ error: 'Not allowed.' });
    }
    if (!Array.isArray(studentUids)) return res.status(400).json({ error: 'studentUids must be an array.' });
    const merged = [...new Set([...(b.rows[0]?.student_ids||[]), ...studentUids])];
    await pool.query('UPDATE sv_batches SET student_ids=$1,updated_at=NOW() WHERE id=$2', [JSON.stringify(merged), batchId]);
    await Promise.all(studentUids.map(async uid => {
      const u = await pool.query('SELECT batch_ids FROM sv_users WHERE uid=$1', [uid]);
      if (u.rows.length) {
        const bids = [...new Set([...(u.rows[0].batch_ids||[]), batchId])];
        await pool.query('UPDATE sv_users SET batch_ids=$1 WHERE uid=$2', [JSON.stringify(bids), uid]);
      }
    }));
    emit(req, { type: 'batch-updated', data: { id: batchId, studentIds: merged } });
    await createNotificationsForUsers(pool, req.app.get('io'), studentUids, {
      title: `Added to ${b.rows[0].name || 'a batch'}`,
      body: `You have been enrolled in ${b.rows[0].name || 'a new batch'}.`,
      type: 'batch',
      batchId,
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/remove-student', auth, async (req, res) => {
  try {
    const { studentUid } = req.body;
    const batchId = req.params.id;
    const b = await pool.query('SELECT name, student_ids, teacher_id FROM sv_batches WHERE id=$1', [batchId]);
    if (!b.rows.length) return res.status(404).json({ error: 'Batch not found.' });
    if (!isAdmin(req.user) && (!isTeacher(req.user) || b.rows[0].teacher_id !== req.user.uid)) {
      return res.status(403).json({ error: 'Not allowed.' });
    }
    const ids = (b.rows[0]?.student_ids||[]).filter(u => u !== studentUid);
    await pool.query('UPDATE sv_batches SET student_ids=$1,updated_at=NOW() WHERE id=$2', [JSON.stringify(ids), batchId]);
    const u = await pool.query('SELECT batch_ids FROM sv_users WHERE uid=$1', [studentUid]);
    if (u.rows.length) {
      const bids = (u.rows[0].batch_ids||[]).filter(id => id !== batchId);
      await pool.query('UPDATE sv_users SET batch_ids=$1 WHERE uid=$2', [JSON.stringify(bids), studentUid]);
    }
    emit(req, { type: 'batch-updated', data: { id: batchId, studentIds: ids } });
    await createNotification(pool, req.app.get('io'), {
      userId: studentUid,
      title: `Removed from ${b.rows[0].name || 'batch'}`,
      body: `You are no longer enrolled in ${b.rows[0].name || 'this batch'}.`,
      type: 'batch',
      batchId,
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
