const router   = require('express').Router();
const { pool } = require('../config/db');
const auth     = require('../middleware/auth');
const { isAdmin, isTeacher } = require('../middleware/authorize');
const { normalizeList } = require('../utils/normalize');

router.get('/:classId', auth, async (req, res) => {
  try {
    const cls = await pool.query('SELECT batch_id, teacher_id FROM sv_classes WHERE id=$1', [req.params.classId]);
    if (!cls.rows.length) return res.status(404).json({ error: 'Class not found.' });
    if (!isAdmin(req.user)) {
      if (isTeacher(req.user)) {
        if (cls.rows[0].teacher_id !== req.user.uid) return res.status(403).json({ error: 'Not allowed.' });
      } else {
        const user = await pool.query('SELECT batch_ids FROM sv_users WHERE uid=$1', [req.user.uid]);
        if (!(user.rows[0]?.batch_ids || []).includes(cls.rows[0].batch_id)) {
          return res.status(403).json({ error: 'Not allowed.' });
        }
      }
    }
    const { rows } = await pool.query('SELECT * FROM sv_attendance WHERE class_id=$1', [req.params.classId]);
    res.json(normalizeList(rows));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/mark', auth, async (req, res) => {
  try {
    const { classId, studentId } = req.body;
    if (!isAdmin(req.user) && !isTeacher(req.user) && req.user.uid !== studentId) {
      return res.status(403).json({ error: 'Not allowed.' });
    }
    await pool.query(
      `INSERT INTO sv_attendance (class_id,student_id) VALUES ($1,$2) ON CONFLICT (class_id,student_id) DO NOTHING`,
      [classId, studentId]
    );
    const c = await pool.query('SELECT joined_student_ids FROM sv_classes WHERE id=$1', [classId]);
    const ids = [...new Set([...(c.rows[0]?.joined_student_ids||[]), studentId])];
    await pool.query('UPDATE sv_classes SET joined_student_ids=$1,updated_at=NOW() WHERE id=$2', [JSON.stringify(ids), classId]);
    req.app.get('io')?.to(`sub:attendance:${classId}`).emit('data-update', {
      type: 'attendance-marked', data: { classId, studentId, status: 'present' },
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
