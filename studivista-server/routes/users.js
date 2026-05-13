const router   = require('express').Router();
const { pool } = require('../config/db');
const auth     = require('../middleware/auth');
const { isAdmin, isTeacher } = require('../middleware/authorize');
const { normalize } = require('../utils/normalize');

const safeUser = (row) => { if (!row) return null; const { password: _p, ...r } = row; return normalize(r); };

router.get('/', auth, async (req, res) => {
  try {
    if (!isAdmin(req.user) && !isTeacher(req.user)) return res.status(403).json({ error: 'Not allowed.' });
    const { role } = req.query;
    const { rows } = role
      ? await pool.query('SELECT * FROM sv_users WHERE role=$1 ORDER BY created_at DESC', [role])
      : await pool.query('SELECT * FROM sv_users ORDER BY created_at DESC');
    res.json(rows.map(safeUser));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:uid', auth, async (req, res) => {
  try {
    if (!isAdmin(req.user) && !isTeacher(req.user) && req.user.uid !== req.params.uid) {
      return res.status(403).json({ error: 'Not allowed.' });
    }
    const { rows } = await pool.query('SELECT * FROM sv_users WHERE uid=$1', [req.params.uid]);
    if (!rows[0]) return res.status(404).json({ error: 'User not found.' });
    res.json(safeUser(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.patch('/:uid', auth, async (req, res) => {
  try {
    const ownFields = { lastSeenAt:'last_seen_at', fcmToken:'fcm_token', avatar:'avatar' };
    const adminFields = { ...ownFields, name:'name', subject:'subject', status:'status' };
    if (!isAdmin(req.user) && req.user.uid !== req.params.uid) return res.status(403).json({ error: 'Not allowed.' });
    const fieldMap = isAdmin(req.user) ? adminFields : ownFields;
    const sets = []; const vals = [req.params.uid];
    for (const [k, v] of Object.entries(req.body)) {
      const col = fieldMap[k];
      if (col) { sets.push(`${col}=$${vals.length+1}`); vals.push(v); }
    }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update.' });
    await pool.query(`UPDATE sv_users SET ${sets.join(',')},updated_at=NOW() WHERE uid=$1`, vals);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
