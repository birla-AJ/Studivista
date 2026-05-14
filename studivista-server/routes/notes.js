const fs = require('fs');
const path = require('path');
const multer = require('multer');
const router = require('express').Router();
const { v4 } = require('uuid');
const { pool } = require('../config/db');
const auth = require('../middleware/auth');
const { isAdmin, isTeacher } = require('../middleware/authorize');
const { normalize, normalizeList } = require('../utils/normalize');
const { createNotificationsForBatch } = require('../utils/notifications');

const uploadsDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => {
    const safe = (file.originalname || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`);
  },
});

const upload = multer({ storage, limits: { fileSize: 200 * 1024 * 1024 } });

const NOTE_TYPES = new Set(['text', 'pdf', 'image', 'video', 'audio', 'voice', 'link']);
const FILE_TYPES = new Set(['pdf', 'image', 'video', 'audio', 'voice']);
const SIZE_LIMITS = {
  pdf: 25 * 1024 * 1024,
  image: 10 * 1024 * 1024,
  video: 200 * 1024 * 1024,
  audio: 50 * 1024 * 1024,
  voice: 50 * 1024 * 1024,
};

const noteUpload = (req, res, next) => {
  upload.single('file')(req, res, err => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'Max file size is 200MB.' });
    }
    return res.status(400).json({ error: err.message || 'Upload failed.' });
  });
};

const unlinkQuietly = filePath => {
  if (!filePath) return;
  fs.unlink(filePath, err => {
    if (err && err.code !== 'ENOENT') console.warn('[notes] File cleanup failed:', err.message);
  });
};

const storedPathFromUrl = fileUrl => {
  if (!fileUrl) return null;
  try {
    const pathname = fileUrl.startsWith('http') ? new URL(fileUrl).pathname : fileUrl;
    if (!pathname.startsWith('/uploads/')) return null;
    return path.join(uploadsDir, path.basename(pathname));
  } catch {
    return null;
  }
};

const noteItem = row => {
  const item = normalize(row);
  if (item && item.content === undefined) item.content = item.body || '';
  return item;
};

const noteList = rows => normalizeList(rows).map(item => ({
  ...item,
  content: item.content === undefined ? item.body || '' : item.content,
}));

const canAccessBatch = async (user, batchId) => {
  if (!batchId || isAdmin(user)) return true;
  if (isTeacher(user)) {
    const batch = await pool.query('SELECT teacher_id FROM sv_batches WHERE id=$1', [batchId]);
    return !!batch.rows.length && batch.rows[0].teacher_id === user.uid;
  }
  const { rows } = await pool.query('SELECT batch_ids FROM sv_users WHERE uid=$1', [user.uid]);
  return (rows[0]?.batch_ids || []).includes(batchId);
};

const validateClass = async (classId, batchId, user) => {
  if (!classId) return null;
  const { rows } = await pool.query('SELECT id,batch_id,teacher_id FROM sv_classes WHERE id=$1', [classId]);
  const cls = rows[0];
  if (!cls) return { error: 'Class not found.', status: 404 };
  if (batchId && cls.batch_id !== batchId) return { error: 'Class does not belong to this batch.', status: 400 };
  if (!isAdmin(user) && isTeacher(user) && cls.teacher_id !== user.uid) {
    return { error: 'Not allowed.', status: 403 };
  }
  return { classRow: cls };
};

const validateMime = (noteType, mime = '') => {
  if (noteType === 'pdf') return mime === 'application/pdf';
  if (noteType === 'image') return mime.startsWith('image/');
  if (noteType === 'video') return mime.startsWith('video/');
  if (noteType === 'audio') return mime.startsWith('audio/');
  if (noteType === 'voice') return mime.startsWith('audio/');
  return true;
};

router.get('/', auth, async (req, res) => {
  try {
    const { teacherId, batchId, classId } = req.query;

    if (classId) {
      const cls = await pool.query('SELECT batch_id FROM sv_classes WHERE id=$1', [classId]);
      if (!cls.rows.length) return res.status(404).json({ error: 'Class not found.' });
      if (!(await canAccessBatch(req.user, cls.rows[0].batch_id))) {
        return res.status(403).json({ error: 'Not allowed.' });
      }
      const { rows } = await pool.query('SELECT * FROM sv_notes WHERE class_id=$1 ORDER BY created_at DESC', [classId]);
      return res.json(noteList(rows));
    }

    if (!isAdmin(req.user) && !batchId) {
      if (!isTeacher(req.user) || teacherId !== req.user.uid) return res.status(403).json({ error: 'Not allowed.' });
    }
    if (batchId && !(await canAccessBatch(req.user, batchId))) {
      return res.status(403).json({ error: 'Not allowed.' });
    }

    const { rows } = teacherId
      ? await pool.query('SELECT * FROM sv_notes WHERE teacher_id=$1 ORDER BY created_at DESC', [teacherId])
      : batchId
        ? await pool.query('SELECT * FROM sv_notes WHERE batch_id=$1 ORDER BY created_at DESC', [batchId])
        : await pool.query('SELECT * FROM sv_notes ORDER BY created_at DESC');
    return res.json(noteList(rows));
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
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
    return res.json(noteList(rows));
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM sv_notes WHERE id=$1', [req.params.id]);
    const note = rows[0];
    if (!note) return res.status(404).json({ error: 'Note not found.' });
    if (!(await canAccessBatch(req.user, note.batch_id))) {
      return res.status(403).json({ error: 'Not allowed.' });
    }
    return res.json(noteItem(note));
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

router.post('/', auth, noteUpload, async (req, res) => {
  const cleanupUploaded = () => unlinkQuietly(req.file?.path);
  try {
    if (!isAdmin(req.user) && !isTeacher(req.user)) {
      cleanupUploaded();
      return res.status(403).json({ error: 'Not allowed.' });
    }

    const {
      title,
      body,
      content,
      batchId,
      batchName,
      teacherId = req.user.uid,
      teacherName,
      classId,
      fileUrl: linkUrl,
      durationSec,
      thumbUrl,
    } = req.body;
    const noteType = (req.body.noteType || 'text').trim();
    const textContent = typeof content === 'string' ? content : body;

    if (!title || !batchId) {
      cleanupUploaded();
      return res.status(400).json({ error: 'title and batchId required.' });
    }
    if (!NOTE_TYPES.has(noteType)) {
      cleanupUploaded();
      return res.status(400).json({ error: 'Invalid noteType.' });
    }
    if (!isAdmin(req.user) && teacherId !== req.user.uid) {
      cleanupUploaded();
      return res.status(403).json({ error: 'Not allowed.' });
    }
    if (!(await canAccessBatch(req.user, batchId))) {
      cleanupUploaded();
      return res.status(403).json({ error: 'Not allowed.' });
    }

    const classValidation = await validateClass(classId || null, batchId, req.user);
    if (classValidation?.error) {
      cleanupUploaded();
      return res.status(classValidation.status).json({ error: classValidation.error });
    }

    if (noteType === 'text' && !String(textContent || '').trim()) {
      cleanupUploaded();
      return res.status(400).json({ error: 'content is required for text notes.' });
    }
    if (FILE_TYPES.has(noteType) && !req.file) {
      return res.status(400).json({ error: 'file is required for this note type.' });
    }
    if (noteType === 'link' && !String(linkUrl || '').trim()) {
      cleanupUploaded();
      return res.status(400).json({ error: 'fileUrl is required for link notes.' });
    }
    if (req.file && !validateMime(noteType, req.file.mimetype || '')) {
      cleanupUploaded();
      return res.status(400).json({ error: `Uploaded file type does not match ${noteType}.` });
    }
    if (req.file && SIZE_LIMITS[noteType] && req.file.size > SIZE_LIMITS[noteType]) {
      cleanupUploaded();
      return res.status(413).json({ error: `File too large for type ${noteType}.` });
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const storedFileUrl = req.file ? `${baseUrl}/uploads/${req.file.filename}` : null;
    const fileUrl = noteType === 'link' ? String(linkUrl).trim() : storedFileUrl;
    const fileName = req.file?.originalname || null;
    const fileSize = req.file?.size || null;
    const id = v4();

    await pool.query(
      `INSERT INTO sv_notes
       (id,title,body,batch_id,batch_name,teacher_id,teacher_name,class_id,note_type,file_url,file_name,file_size,duration_sec,thumb_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        id,
        title.trim(),
        String(textContent || '').trim(),
        batchId,
        batchName || '',
        teacherId,
        teacherName || req.user.name || '',
        classId || null,
        noteType,
        fileUrl,
        fileName,
        fileSize,
        durationSec ? Number(durationSec) : null,
        thumbUrl || null,
      ],
    );

    const { rows } = await pool.query('SELECT * FROM sv_notes WHERE id=$1', [id]);
    const item = noteItem(rows[0]);
    const io = req.app.get('io');
    io?.to('sub:notes').emit('data-update', { type: 'note-added', data: item });
    io?.to(`sub:notes:teacher:${teacherId}`).emit('data-update', { type: 'note-added', data: item });
    io?.to(`sub:notes:batch:${batchId}`).emit('data-update', { type: 'note-added', data: item });
    if (classId) {
      io?.to(`sub:notes:class:${classId}`).emit('data-update', { type: 'note-added', data: item });
    }

    await createNotificationsForBatch(pool, io, batchId, {
      title: `New note: ${title.trim()}`,
      body: `${teacherName || req.user.name || 'Your teacher'} shared a new ${noteType} note.`,
      type: 'note',
      classId: classId || null,
      data: { noteId: id, screen: 'NoteDetail' },
    });

    return res.json(item);
  } catch (e) {
    cleanupUploaded();
    return res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    const existing = await pool.query('SELECT * FROM sv_notes WHERE id=$1', [req.params.id]);
    const note = existing.rows[0];
    if (!note) return res.status(404).json({ error: 'Note not found.' });
    if (!isAdmin(req.user) && (!isTeacher(req.user) || note.teacher_id !== req.user.uid)) {
      return res.status(403).json({ error: 'Not allowed.' });
    }

    await pool.query('DELETE FROM sv_notes WHERE id=$1', [req.params.id]);
    const payload = { type: 'note-deleted', data: { id: req.params.id } };
    const io = req.app.get('io');
    io?.to('sub:notes').emit('data-update', payload);
    if (note.teacher_id) io?.to(`sub:notes:teacher:${note.teacher_id}`).emit('data-update', payload);
    if (note.batch_id) io?.to(`sub:notes:batch:${note.batch_id}`).emit('data-update', payload);
    if (note.class_id) io?.to(`sub:notes:class:${note.class_id}`).emit('data-update', payload);
    if (note.note_type !== 'link') unlinkQuietly(storedPathFromUrl(note.file_url));

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

module.exports = router;
