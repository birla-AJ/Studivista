require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const authMw = require('./middleware/auth');
const { isAdmin, isTeacher } = require('./middleware/authorize');
const { startClassReminderJob } = require('./jobs/classReminders');
const { pool } = require('./config/db');
const { initFirebase } = require('./utils/fcm');

const app = express();
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()).filter(Boolean)
  : ['*'];
const isWildcardCors = allowedOrigins.includes('*');
const corsOptions = {
  origin(origin, cb) {
    if (!origin || isWildcardCors || allowedOrigins.includes(origin)) {
      return cb(null, true);
    }
    return cb(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: isWildcardCors ? '*' : allowedOrigins,
    methods: corsOptions.methods,
    credentials: true,
  },
  maxHttpBufferSize: 1e8,
  pingTimeout: 20000,
  pingInterval: 10000,
});

app.use(express.json());
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ─── File Upload Setup ────────────────────────────────────────────────────
const uploadsDir = path.join(__dirname, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => {
    const safe = (file.originalname || 'file').replace(/[^a-zA-Z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 200 * 1024 * 1024 } });

app.use('/uploads', express.static(uploadsDir));

app.get('/download/:filename', (req, res) => {
  const storedName = path.basename(req.params.filename || '');
  const downloadName = path.basename(req.query.name || storedName || 'attachment');
  const filePath = path.join(uploadsDir, storedName);
  res.download(filePath, downloadName, err => {
    if (err && !res.headersSent) res.status(404).json({ error: 'File not found.' });
  });
});

// Chat file upload
const chatUpload = (req, res, next) => {
  upload.single('file')(req, res, err => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Max file size is 200MB.' });
    res.status(400).json({ error: err.message || 'Upload failed.' });
  });
};
const handleChatUpload = (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  res.json({
    name: req.file.originalname,
    type: req.file.mimetype || 'application/octet-stream',
    size: req.file.size,
    url: `${baseUrl}/uploads/${req.file.filename}`,
  });
};
app.post('/chat-upload', authMw, chatUpload, handleChatUpload);
app.post('/chat-uploade', authMw, chatUpload, handleChatUpload);

// ─── API Routes ───────────────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/users',         require('./routes/users'));
app.use('/api/batches',       require('./routes/batches'));
app.use('/api/classes',       require('./routes/classes'));
app.use('/api/notes',         require('./routes/notes'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/attendance',    require('./routes/attendance'));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', rooms: Object.keys(rooms).length, time: new Date().toISOString() });
});

// ─── In-memory room state ─────────────────────────────────────────────────
const rooms = {};
const pendingRequests = {};
const pendingScreenShareRequests = {};
const roomSharers = {};
const isHostRole = r => r === 'host' || r === 'teacher' || r === 'admin';
const canHost = user => isAdmin(user) || isTeacher(user);
const socketIdentity = socket => socket.user?.uid || socket.id;

// ─── Helper: emit real-time data update to subscribed clients ─────────────
// Clients subscribe to channels like 'sub:users:teacher', 'sub:batches', etc.
const emitUpdate = (channel, event, data) => {
  io.to(`sub:${channel}`).emit(event, data);
};
app.set('emitUpdate', emitUpdate);  // Share with routes

// ─── Socket.io ────────────────────────────────────────────────────────────
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('No token.'));
  try {
    socket.user = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch {
    return next(new Error('Invalid token.'));
  }
});

io.on('connection', socket => {
  console.log('Connected:', socket.id);
  if (socket.user?.uid) {
    socket.userId = socket.user.uid;
    socket.join(`user:${socket.user.uid}`);
  }

  // ── Real-time subscriptions (replaces Firestore onSnapshot) ──────────────
  socket.on('subscribe', ({ channel }) => {
    if (channel) {
      socket.join(`sub:${channel}`);
    }
  });

  socket.on('unsubscribe', ({ channel }) => {
    if (channel) socket.leave(`sub:${channel}`);
  });

  // ── Join-request flow (out-of-batch student) ──────────────────────────────
  socket.on('request-join', ({ roomId, name }) => {
    if (!roomId) return;
    socket.pendingRoom = roomId;
    socket.displayName = name;
    if (!pendingRequests[roomId]) pendingRequests[roomId] = [];
    if (!pendingRequests[roomId].find(r => r.socketId === socket.id)) {
      pendingRequests[roomId].push({ socketId: socket.id, name });
    }
    io.to(roomId).emit('pending-join', { from: socket.id, name });
    io.to(roomId).emit('join-request', { socketId: socket.id, name });
  });

  socket.on('approve-join', ({ to, studentId, roomId }) => {
    if (!canHost(socket.user)) return;
    const target = to || studentId;
    if (!target) return;
    io.to(target).emit('join-approved', { roomId });
    if (pendingRequests[roomId]) {
      pendingRequests[roomId] = pendingRequests[roomId].filter(r => r.socketId !== target);
    }
  });

  socket.on('reject-join', ({ to, studentId, roomId }) => {
    if (!canHost(socket.user)) return;
    const target = to || studentId;
    if (!target) return;
    io.to(target).emit('join-rejected');
    if (pendingRequests[roomId]) {
      pendingRequests[roomId] = pendingRequests[roomId].filter(r => r.socketId !== target);
    }
  });

  // ── Join room ─────────────────────────────────────────────────────────────
  socket.on('join-room', ({ roomId, role, name }) => {
    if (!roomId) return;
    role = canHost(socket.user) ? 'host' : 'participant';
    if (!rooms[roomId]) rooms[roomId] = {};

    const identity = socketIdentity(socket);
    if (socket.roomId === roomId && rooms[roomId][socket.id]) {
      rooms[roomId][socket.id] = { ...rooms[roomId][socket.id], role, name, identity };
      socket.userRole = role;
      socket.displayName = name;
      return;
    }

    Object.entries(rooms[roomId]).forEach(([id, info]) => {
      if (id === socket.id || info.identity !== identity) return;
      const staleSocket = io.sockets.sockets.get(id);
      if (staleSocket) {
        staleSocket.leave(roomId);
        staleSocket.roomId = null;
      }
      delete rooms[roomId][id];
      socket.to(roomId).emit('user-left', { userId: id, userRole: info.role, name: info.name });
    });

    const existingIds = Object.keys(rooms[roomId]).filter(id => id !== socket.id);
    const existingDetailed = Object.entries(rooms[roomId])
      .filter(([id]) => id !== socket.id)
      .map(([id, info]) => ({
      userId: id, userRole: info.role, name: info.name, handRaised: !!info.handRaised,
    }));

    socket.emit('room-users', { users: existingIds });
    socket.emit('existing-users', existingDetailed);
    socket.to(roomId).emit('user-joined', { userId: socket.id, userRole: role, name });

    rooms[roomId][socket.id] = { role, name, identity, handRaised: false };
    socket.join(roomId);
    socket.roomId = roomId;
    socket.userRole = role;
    socket.displayName = name;

    if (roomSharers[roomId] && roomSharers[roomId].sharerId !== socket.id) {
      socket.emit('screen-share-active', roomSharers[roomId]);
    }
    if (isHostRole(role) && pendingRequests[roomId]?.length > 0) {
      pendingRequests[roomId].forEach(req => {
        socket.emit('pending-join', { from: req.socketId, name: req.name });
        socket.emit('join-request', { socketId: req.socketId, name: req.name });
      });
    }
    if (isHostRole(role) && pendingScreenShareRequests[roomId]?.length > 0) {
      pendingScreenShareRequests[roomId].forEach(req => {
        socket.emit('screen-share-permission-requested', {
          from: req.socketId,
          name: req.name,
        });
      });
    }
    console.log(`${name} (${role}) joined room ${roomId}`);
  });

  // ── Chat ──────────────────────────────────────────────────────────────────
  socket.on('chat-message', ({ roomId, message, name }) => {
    io.to(roomId).emit('chat-message', {
      id: Date.now().toString(), senderId: socket.id,
      name, message, type: 'text', timestamp: Date.now(),
    });
  });

  socket.on('live-chat-message', payload => {
    const roomId = payload?.roomId || socket.roomId;
    const attachment = payload?.attachment || payload?.message?.attachment || null;
    const replyTo = payload?.replyTo || payload?.message?.replyTo || null;
    const rawText = payload?.text || payload?.message?.text || payload?.message || payload?.body || '';
    const text = typeof rawText === 'string' ? rawText : '';
    if (!roomId || (!text.trim() && !attachment)) return;

    const message = {
      id: payload.id || `${socket.id}-${Date.now()}`,
      roomId,
      text: text.trim() || attachment?.name || 'Attachment',
      senderId: payload.senderId || socket.id,
      senderName: payload.senderName || payload.name || socket.displayName || 'User',
      role: payload.role || socket.userRole || 'participant',
      createdAt: payload.createdAt || Date.now(),
      replyTo,
      attachment,
    };
    io.to(roomId).emit('live-chat-message', message);
  });

  socket.on('chat-media', ({ roomId, name, fileName, fileType, fileData }) => {
    io.to(roomId).emit('chat-media', {
      id: Date.now().toString(), senderId: socket.id,
      name, fileName, fileType, fileData, type: 'media', timestamp: Date.now(),
    });
  });

  socket.on('chat-voice', ({ roomId, name, voiceData, duration }) => {
    io.to(roomId).emit('chat-voice', {
      id: Date.now().toString(), senderId: socket.id,
      name, voiceData, duration, type: 'voice', timestamp: Date.now(),
    });
  });

  // ── WebRTC signaling ──────────────────────────────────────────────────────
  socket.on('offer',          ({ to, offer })      => io.to(to).emit('offer',          { from: socket.id, offer }));
  socket.on('answer',         ({ to, answer })     => io.to(to).emit('answer',         { from: socket.id, answer }));
  socket.on('ice-candidate',  ({ to, candidate })  => io.to(to).emit('ice-candidate',  { from: socket.id, candidate }));

  // ── Screen share signaling ────────────────────────────────────────────────
  socket.on('screen-share-started', ({ roomId, sharerName }) => {
    if (!roomId) return;
    roomSharers[roomId] = { sharerId: socket.id, sharerName };
    socket.to(roomId).emit('screen-share-started', { sharerId: socket.id, sharerName });
  });
  socket.on('screen-share-stopped', ({ roomId }) => {
    if (roomSharers[roomId]?.sharerId === socket.id) delete roomSharers[roomId];
    socket.to(roomId).emit('screen-share-stopped', { sharerId: socket.id });
  });
  const handleScreenSharePermissionRequest = ({ roomId, name }) => {
    const targetRoom = roomId || socket.roomId;
    if (!targetRoom) return;
    if (!pendingScreenShareRequests[targetRoom]) pendingScreenShareRequests[targetRoom] = [];
    if (!pendingScreenShareRequests[targetRoom].find(r => r.socketId === socket.id)) {
      pendingScreenShareRequests[targetRoom].push({
        socketId: socket.id,
        name: name || socket.displayName || 'Student',
      });
    }
    io.to(targetRoom).emit('screen-share-permission-requested', {
      from: socket.id,
      name: name || socket.displayName || 'Student',
    });
    io.to(targetRoom).emit('screen-share-request-pending', {
      from: socket.id,
      name: name || socket.displayName || 'Student',
    });
    io.to(targetRoom).emit('screen-share-approval-request', {
      from: socket.id,
      name: name || socket.displayName || 'Student',
    });
  };
  socket.on('screen-share-permission-request', handleScreenSharePermissionRequest);
  socket.on('screen-share-request-pending', handleScreenSharePermissionRequest);
  socket.on('screen-share-approval-request', handleScreenSharePermissionRequest);
  socket.on('approve-screen-share', ({ to, roomId }) => {
    if (!canHost(socket.user)) return;
    const targetRoom = roomId || socket.roomId;
    if (!to || !targetRoom) return;
    if (pendingScreenShareRequests[targetRoom]) {
      pendingScreenShareRequests[targetRoom] =
        pendingScreenShareRequests[targetRoom].filter(r => r.socketId !== to);
    }
    io.to(to).emit('screen-share-approved', { roomId: targetRoom });
  });
  socket.on('reject-screen-share', ({ to, roomId }) => {
    if (!canHost(socket.user)) return;
    const targetRoom = roomId || socket.roomId;
    if (!to || !targetRoom) return;
    if (pendingScreenShareRequests[targetRoom]) {
      pendingScreenShareRequests[targetRoom] =
        pendingScreenShareRequests[targetRoom].filter(r => r.socketId !== to);
    }
    io.to(to).emit('screen-share-rejected', { roomId: targetRoom });
  });
  socket.on('screen-share-request', ({ to, ...payload }) => {
    if (!to) return;
    io.to(to).emit('screen-share-request', { from: socket.id, ...payload });
  });
  socket.on('screen-offer',         ({ to, offer })   => io.to(to).emit('screen-offer',   { from: socket.id, offer }));
  socket.on('screen-answer',        ({ to, answer })  => io.to(to).emit('screen-answer',  { from: socket.id, answer }));
  socket.on('screen-ice-candidate', ({ to, candidate }) => io.to(to).emit('screen-ice-candidate', { from: socket.id, candidate }));

  // ── Host controls ─────────────────────────────────────────────────────────
  socket.on('mute-student',       ({ studentId }) => { if (canHost(socket.user)) io.to(studentId).emit('force-mute'); });
  socket.on('unmute-student',     ({ studentId }) => { if (canHost(socket.user)) io.to(studentId).emit('force-unmute'); });
  socket.on('camera-off-student', ({ studentId }) => { if (canHost(socket.user)) io.to(studentId).emit('force-camera-off'); });
  socket.on('remove-student', ({ studentId, roomId }) => {
    if (!canHost(socket.user)) return;
    io.to(studentId).emit('force-remove');
    if (rooms[roomId]) delete rooms[roomId][studentId];
    socket.to(roomId).emit('user-left', { userId: studentId, userRole: 'student' });
  });
  socket.on('media-state', ({ micOn, cameraOn }) => {
    if (socket.roomId) socket.to(socket.roomId).emit('media-state', { from: socket.id, micOn, cameraOn });
  });

  socket.on('hand-raise', ({ roomId, raised, name }) => {
    const targetRoom = roomId || socket.roomId;
    if (!targetRoom) return;
    const handRaised = !!raised;
    if (rooms[targetRoom]?.[socket.id]) {
      rooms[targetRoom][socket.id].handRaised = handRaised;
    }
    io.to(targetRoom).emit('hand-raise', {
      from: socket.id,
      name: name || socket.displayName || 'Student',
      raised: handRaised,
    });
  });

  socket.on('class-ended', ({ roomId }) => {
    if (!canHost(socket.user)) return;
    if (roomId) socket.to(roomId).emit('class-ended');
  });

  // ── Push notification (replaces FCM) ─────────────────────────────────────
  // Each user joins their own room so server can push to them directly
  socket.on('register-user', ({ userId }) => {
    const ownUserId = socket.user?.uid;
    if (ownUserId && (!userId || userId === ownUserId)) {
      socket.userId = ownUserId;
      socket.join(`user:${ownUserId}`);
    }
  });

  // ── Disconnect ────────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    const { roomId, userRole, displayName } = socket;
    if (socket.pendingRoom && pendingRequests[socket.pendingRoom]) {
      pendingRequests[socket.pendingRoom] = pendingRequests[socket.pendingRoom].filter(r => r.socketId !== socket.id);
      if (pendingRequests[socket.pendingRoom].length === 0) delete pendingRequests[socket.pendingRoom];
    }
    Object.keys(pendingScreenShareRequests).forEach(id => {
      pendingScreenShareRequests[id] = pendingScreenShareRequests[id].filter(r => r.socketId !== socket.id);
      if (pendingScreenShareRequests[id].length === 0) delete pendingScreenShareRequests[id];
    });
    if (roomId && rooms[roomId]) {
      if (roomSharers[roomId]?.sharerId === socket.id) {
        delete roomSharers[roomId];
        socket.to(roomId).emit('screen-share-stopped', { sharerId: socket.id });
      }
      delete rooms[roomId][socket.id];
      socket.to(roomId).emit('user-left', { userId: socket.id, userRole, name: displayName });
      if (Object.keys(rooms[roomId]).length === 0) {
        delete rooms[roomId];
        delete pendingRequests[roomId];
        delete pendingScreenShareRequests[roomId];
        delete roomSharers[roomId];
      }
    }
    console.log('Disconnected:', socket.id, displayName || '');
  });
});

// Export io for use in routes
app.set('io', io);
initFirebase();
startClassReminderJob({ pool, io });

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error('❌ Port already in use.'); process.exit(1);
  } else throw err;
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log(`✅ Studivista server running on port ${PORT}`));
