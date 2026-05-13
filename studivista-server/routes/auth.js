require('dotenv').config();
const router   = require('express').Router();
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { v4 }   = require('uuid');
const { pool } = require('../config/db');
const authMw   = require('../middleware/auth');
const { isAdmin, isTeacher } = require('../middleware/authorize');
const { normalize } = require('../utils/normalize');
const { createNotification } = require('../utils/notifications');

const makeToken = (uid, role) =>
  jwt.sign({ uid, role }, process.env.JWT_SECRET, { expiresIn: '30d' });

const safeUser = (row) => {
  if (!row) return null;
  const { password: _p, ...rest } = row;
  return normalize(rest);
};

// ── Login ──────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required.' });
    const { rows } = await pool.query('SELECT * FROM sv_users WHERE email=$1', [email.trim().toLowerCase()]);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'User not found.' });
    if (user.status === 'inactive') return res.status(403).json({ error: 'Account inactive.' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Wrong password.' });
    res.json({ token: makeToken(user.uid, user.role), user: safeUser(user) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Ensure admin ──────────────────────────────────────────────────────────
router.post('/ensure-admin', async (req, res) => {
  try {
    const setupSecret = process.env.ADMIN_SETUP_SECRET;
    if (!setupSecret || req.headers['x-admin-setup-secret'] !== setupSecret) {
      return res.status(403).json({ error: 'Admin setup is disabled.' });
    }
    const { email, password } = req.body;
    if (!email) return res.status(400).json({ error: 'email required.' });
    const { rows } = await pool.query('SELECT * FROM sv_users WHERE email=$1', [email.trim().toLowerCase()]);
    if (rows.length > 0) {
      return res.json({ token: makeToken(rows[0].uid, rows[0].role), user: safeUser(rows[0]) });
    }
    const uid  = v4();
    const hash = await bcrypt.hash(password || 'admin123', 10);
    await pool.query(
      `INSERT INTO sv_users (uid,email,name,role,status,batch_ids,password) VALUES ($1,$2,'Admin','admin','active','[]',$3)`,
      [uid, email.trim().toLowerCase(), hash]
    );
    const { rows: newRows } = await pool.query('SELECT * FROM sv_users WHERE uid=$1', [uid]);
    res.json({ token: makeToken(uid, 'admin'), user: safeUser(newRows[0]) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Create user ───────────────────────────────────────────────────────────
router.post('/create-user', authMw, async (req, res) => {
  try {
    if (!isAdmin(req.user) && !isTeacher(req.user))
      return res.status(403).json({ error: 'Not allowed.' });
    const { email, password, name, role, subject, batchId, createdByUid } = req.body;
    const newRole = role || 'student';
    if (!email || !password || !name) return res.status(400).json({ error: 'email, password and name required.' });
    if (!['teacher', 'student'].includes(newRole)) return res.status(400).json({ error: 'Invalid role.' });
    if (isTeacher(req.user) && newRole !== 'student') return res.status(403).json({ error: 'Not allowed.' });
    const existing = await pool.query('SELECT uid FROM sv_users WHERE email=$1', [email.trim().toLowerCase()]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Email already exists.' });
    const uid  = v4();
    const hash = await bcrypt.hash(password, 10);
    const batchIds = batchId ? JSON.stringify([batchId]) : '[]';
    await pool.query(
      `INSERT INTO sv_users (uid,email,name,role,subject,status,batch_ids,created_by,password) VALUES ($1,$2,$3,$4,$5,'active',$6,$7,$8)`,
      [uid, email.trim().toLowerCase(), name.trim(), newRole, subject||'', batchIds, createdByUid||req.user.uid, hash]
    );
    if (batchId) {
      const b = await pool.query('SELECT name, student_ids FROM sv_batches WHERE id=$1', [batchId]);
      if (b.rows.length) {
        const ids = [...new Set([...(b.rows[0].student_ids||[]), uid])];
        await pool.query('UPDATE sv_batches SET student_ids=$1,updated_at=NOW() WHERE id=$2', [JSON.stringify(ids), batchId]);
        await createNotification(pool, req.app.get('io'), {
          userId: uid,
          title: `Added to ${b.rows[0].name || 'a batch'}`,
          body: `You have been enrolled in ${b.rows[0].name || 'a new batch'}.`,
          type: 'batch',
          batchId,
        });
      }
    }
    const io = req.app.get('io');
    io?.to(`sub:users:${newRole}`).emit('data-update', { type: 'user-added', data: { uid, name, email, role: newRole } });
    res.json({ uid, user: { uid, email, name, role: newRole, subject } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Me ────────────────────────────────────────────────────────────────────
router.get('/me', authMw, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM sv_users WHERE uid=$1', [req.user.uid]);
    if (!rows[0]) return res.status(404).json({ error: 'User not found.' });
    res.json(safeUser(rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
