/**
 * firestoreService.js
 * Data helpers backed by the Studivista API.
 *
 * KEY FIX: All timestamp fields from server (ISO strings) are wrapped into
 * Firestore-compatible objects with .toDate() and .toMillis() methods.
 * This is required because screens like ScheduleClass call:
 *   existing.scheduledAt.toDate().getDate()  ← direct call, no helper
 */
import { apiFetch, subscribeChannel, getSocket } from './api';

// ─── Timestamp wrapper ────────────────────────────────────────────────────
// Converts ISO string → { toDate(), toMillis() }
// Screens call .toDate() and .toMillis() exactly like Firestore Timestamps.
const TS_FIELDS = [
  'scheduledAt',
  'createdAt',
  'startedAt',
  'endedAt',
  'joinedAt',
  'updatedAt',
  'lastSeenAt',
  'fcmTokenUpdatedAt',
];

const wrapTs = iso => {
  if (!iso || typeof iso !== 'string') return iso;
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  return { toDate: () => date, toMillis: () => date.getTime(), _iso: iso };
};

// Apply to a single item — wraps all known timestamp fields
const wrapItem = item => {
  if (!item || typeof item !== 'object') return item;
  const out = { ...item };
  TS_FIELDS.forEach(f => {
    if (typeof out[f] === 'string') out[f] = wrapTs(out[f]);
  });
  return out;
};

const wrapList = arr => (arr || []).map(wrapItem);

// ─── Presence ─────────────────────────────────────────────────────────────
export const updateLastSeen = uid =>
  apiFetch(`/api/users/${uid}`, {
    method: 'PATCH',
    body: { lastSeenAt: new Date().toISOString() },
  }).catch(() => {});

// ─── Users ────────────────────────────────────────────────────────────────
export const subscribeUsersByRole = (role, cb) => {
  let list = [];
  apiFetch(`/api/users?role=${role}`)
    .then(d => {
      list = wrapList(d);
      cb(list);
    })
    .catch(() => {});
  return subscribeChannel(`users:${role}`, 'data-update', p => {
    if (p.type === 'user-added') list = [...list, wrapItem(p.data)];
    else if (p.type === 'user-updated')
      list = list.map(u =>
        u.uid === p.data.uid ? wrapItem({ ...u, ...p.data }) : u,
      );
    else if (p.type === 'user-deleted')
      list = list.filter(u => u.uid !== p.data.uid);
    cb(list);
  });
};

export const subscribeStudentsByBatch = (batchId, cb) => {
  let list = [];
  const load = () =>
    apiFetch('/api/users?role=student')
      .then(d => {
        list = wrapList(d).filter(u => u.batchIds?.includes(batchId));
        cb(list);
      })
      .catch(() => {});
  load();
  return subscribeChannel('batches', 'data-update', p => {
    if (p.type === 'batch-updated' && p.data.id === batchId) load();
  });
};

// ─── Batches ──────────────────────────────────────────────────────────────
export const subscribeBatches = cb => {
  let list = [];
  apiFetch('/api/batches')
    .then(d => {
      list = wrapList(d);
      cb(list);
    })
    .catch(() => {});
  return subscribeChannel('batches', 'data-update', p => {
    if (p.type === 'batch-added') list = [...list, wrapItem(p.data)];
    else if (p.type === 'batch-updated')
      list = list.map(b =>
        b.id === p.data.id ? wrapItem({ ...b, ...p.data }) : b,
      );
    else if (p.type === 'batch-deleted')
      list = list.filter(b => b.id !== p.data.id);
    cb(list);
  });
};

export const subscribeBatchesByTeacher = (teacherId, cb) => {
  let list = [];
  apiFetch(`/api/batches?teacherId=${teacherId}`)
    .then(d => {
      list = wrapList(d);
      cb(list);
    })
    .catch(() => {});
  return subscribeChannel('batches', 'data-update', p => {
    if (p.type === 'batch-added' && p.data.teacherId === teacherId)
      list = [...list, wrapItem(p.data)];
    else if (p.type === 'batch-updated')
      list = list.map(b =>
        b.id === p.data.id ? wrapItem({ ...b, ...p.data }) : b,
      );
    else if (p.type === 'batch-deleted')
      list = list.filter(b => b.id !== p.data.id);
    cb(list);
  });
};

export const subscribeBatchesByIds = (batchIds, cb) => {
  if (!batchIds?.length) {
    cb([]);
    return () => {};
  }
  let list = [];
  apiFetch('/api/batches/by-ids', { method: 'POST', body: { ids: batchIds } })
    .then(d => {
      list = wrapList(d);
      cb(list);
    })
    .catch(() => {});
  return subscribeChannel('batches', 'data-update', p => {
    if (p.type === 'batch-added' && batchIds.includes(p.data.id))
      list = [...list, wrapItem(p.data)];
    else if (p.type === 'batch-updated' && batchIds.includes(p.data.id))
      list = list.map(b =>
        b.id === p.data.id ? wrapItem({ ...b, ...p.data }) : b,
      );
    else if (p.type === 'batch-deleted')
      list = list.filter(b => b.id !== p.data.id);
    cb(list);
  });
};

export const createBatch = data =>
  apiFetch('/api/batches', { method: 'POST', body: data });
export const updateBatch = (id, data) =>
  apiFetch(`/api/batches/${id}`, { method: 'PATCH', body: data });
export const deleteBatch = id =>
  apiFetch(`/api/batches/${id}`, { method: 'DELETE' });

export const addStudentsToBatch = (batchId, studentUids) =>
  apiFetch(`/api/batches/${batchId}/add-students`, {
    method: 'POST',
    body: { studentUids },
  });

export const removeStudentFromBatch = (batchId, studentUid) =>
  apiFetch(`/api/batches/${batchId}/remove-student`, {
    method: 'POST',
    body: { studentUid },
  });

// ─── Classes ──────────────────────────────────────────────────────────────
const patchClassList = (list, p) => {
  if (p.type === 'class-added') return [wrapItem(p.data), ...list];
  else if (p.type === 'class-updated')
    return list.map(c =>
      c.id === p.data.id ? wrapItem({ ...c, ...p.data }) : c,
    );
  return list;
};

export const subscribeClasses = cb => {
  let list = [];
  apiFetch('/api/classes')
    .then(d => {
      list = wrapList(d);
      cb(list);
    })
    .catch(() => {});
  return subscribeChannel('classes', 'data-update', p => {
    list = patchClassList(list, p);
    cb(list);
  });
};

export const subscribeClassesByTeacher = (teacherId, cb) => {
  let list = [];
  apiFetch(`/api/classes?teacherId=${teacherId}`)
    .then(d => {
      list = wrapList(d);
      cb(list);
    })
    .catch(() => {});
  return subscribeChannel(`classes:teacher:${teacherId}`, 'data-update', p => {
    list = patchClassList(list, p);
    cb(list);
  });
};

export const subscribeClassesByBatches = (batchIds, cb) => {
  if (!batchIds?.length) {
    cb([]);
    return () => {};
  }
  let list = [];
  apiFetch('/api/classes/by-batches', { method: 'POST', body: { batchIds } })
    .then(d => {
      list = wrapList(d);
      cb(list);
    })
    .catch(() => {});
  return subscribeChannel('classes', 'data-update', p => {
    if (p.type === 'class-added' && !batchIds.includes(p.data.batchId)) return;
    list = patchClassList(list, p);
    cb(list);
  });
};

// scheduledAt from ScheduleClass is already ISO string via Timestamp.fromDate() shim ✅
export const createClass = async data => {
  const result = await apiFetch('/api/classes', { method: 'POST', body: data });
  // createClass in original returns ref.id (string) — we return id
  return result.id || result;
};

export const startLiveClass = id =>
  apiFetch(`/api/classes/${id}/start`, { method: 'POST' });
export const endLiveClass = id =>
  apiFetch(`/api/classes/${id}/end`, { method: 'POST' });

export const markStudentJoined = (classId, studentId) =>
  apiFetch('/api/attendance/mark', {
    method: 'POST',
    body: { classId, studentId },
  });

// ─── Attendance ───────────────────────────────────────────────────────────
// Used by AttendanceScreen.js (teacher view)
export const subscribeAttendanceForClass = (classId, cb) => {
  apiFetch(`/api/attendance/${classId}`)
    .then(d => cb(wrapList(d)))
    .catch(() => {});
  return subscribeChannel(`attendance:${classId}`, 'data-update', p => {
    if (p.type === 'attendance-marked') cb([wrapItem(p.data)]);
  });
};

// Used by StudentAttendance.js via dataShim.js:
//   db.collection('classes').doc(classId).collection('attendance').doc(studentId).onSnapshot(cb)
export const subscribeStudentAttendance = (classId, studentId, cb) => {
  apiFetch(`/api/attendance/${classId}`)
    .then(records => {
      const record = records.find(r => r.studentId === studentId) || null;
      cb(record ? wrapItem(record) : null);
    })
    .catch(() => cb(null));
  return subscribeChannel(`attendance:${classId}`, 'data-update', p => {
    if (
      p.type === 'attendance-marked' &&
      p.data.classId === classId &&
      p.data.studentId === studentId
    ) {
      cb(wrapItem(p.data));
    }
  });
};

// ─── Notifications ────────────────────────────────────────────────────────
export const subscribeNotificationsForUser = (uid, cb) => {
  let list = [];
  const publish = next => {
    list = next;
    cb(list);
  };
  apiFetch(`/api/notifications?userId=${uid}`)
    .then(d => {
      publish(wrapList(d));
    })
    .catch(() => {});
  const socket = getSocket();
  const createdHandler = notif => {
    if (notif?.userId !== uid) return;
    const item = wrapItem(notif);
    publish([item, ...list.filter(n => n.id !== item.id)]);
  };
  const readHandler = ({ id }) => {
    publish(list.map(n => (n.id === id ? { ...n, read: true } : n)));
  };
  const deletedHandler = ({ id }) => {
    publish(list.filter(n => n.id !== id));
  };
  socket.on('notification', createdHandler);
  socket.on('notification-read', readHandler);
  socket.on('notification-deleted', deletedHandler);
  return () => {
    socket.off('notification', createdHandler);
    socket.off('notification-read', readHandler);
    socket.off('notification-deleted', deletedHandler);
  };
};

export const writeNotification = data =>
  apiFetch('/api/notifications', { method: 'POST', body: data });
export const markNotificationRead = id =>
  apiFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
export const deleteNotification = id =>
  apiFetch(`/api/notifications/${id}`, { method: 'DELETE' });
export const fanOutNotificationToBatch = data =>
  apiFetch('/api/notifications/fan-out', { method: 'POST', body: data });

// ─── Notes ────────────────────────────────────────────────────────────────
export const subscribeNotesByTeacher = (teacherId, cb) => {
  let list = [];
  apiFetch(`/api/notes?teacherId=${teacherId}`)
    .then(d => {
      list = wrapList(d);
      cb(list);
    })
    .catch(() => {});
  return subscribeChannel(`notes:teacher:${teacherId}`, 'data-update', p => {
    if (p.type === 'note-added') list = [wrapItem(p.data), ...list];
    else if (p.type === 'note-deleted')
      list = list.filter(n => n.id !== p.data.id);
    cb(list);
  });
};

export const subscribeNotesByBatches = (batchIds, cb) => {
  if (!batchIds?.length) {
    cb([]);
    return () => {};
  }
  let list = [];
  apiFetch('/api/notes/by-batches', { method: 'POST', body: { batchIds } })
    .then(d => {
      list = wrapList(d);
      cb(list);
    })
    .catch(() => {});
  return subscribeChannel('notes', 'data-update', p => {
    if (p.type === 'note-added' && batchIds.includes(p.data.batchId))
      list = [wrapItem(p.data), ...list];
    else if (p.type === 'note-deleted')
      list = list.filter(n => n.id !== p.data.id);
    cb(list);
  });
};

// createNote in original returns ref.id (string)
export const createNote = async data => {
  const result = await apiFetch('/api/notes', { method: 'POST', body: data });
  return result.id || result;
};

export const deleteNote = id =>
  apiFetch(`/api/notes/${id}`, { method: 'DELETE' });
