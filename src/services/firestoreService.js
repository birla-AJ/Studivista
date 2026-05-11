import { db, FieldValue, documentId } from './firebase';

const usersCol = () => db.collection('users');
const batchesCol = () => db.collection('batches');
const classesCol = () => db.collection('classes');
const notesCol = () => db.collection('notes');

const warnSnapshotErr = (label) => (err) =>
    console.warn(`${label} snapshot error:`, err?.code, err?.message);

export const updateLastSeen = (uid) =>
    usersCol().doc(uid).update({ lastSeenAt: FieldValue.serverTimestamp() }).catch(() => {});

export const subscribeUsersByRole = (role, cb) =>
    usersCol().where('role', '==', role).onSnapshot(
        snap => { if (snap) cb(snap.docs.map(d => ({ uid: d.id, ...d.data() }))); },
        warnSnapshotErr('subscribeUsersByRole'),
    );

export const subscribeStudentsByBatch = (batchId, cb) =>
    usersCol()
        .where('role', '==', 'student')
        .where('batchIds', 'array-contains', batchId)
        .onSnapshot(
            snap => { if (snap) cb(snap.docs.map(d => ({ uid: d.id, ...d.data() }))); },
            warnSnapshotErr('subscribeStudentsByBatch'),
        );

export const subscribeBatches = (cb) =>
    batchesCol().onSnapshot(
        snap => { if (snap) cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))); },
        warnSnapshotErr('subscribeBatches'),
    );

export const subscribeBatchesByTeacher = (teacherId, cb) =>
    batchesCol().where('teacherId', '==', teacherId).onSnapshot(
        snap => { if (snap) cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))); },
        warnSnapshotErr('subscribeBatchesByTeacher'),
    );

export const subscribeBatchesByIds = (batchIds, cb) => {
    if (!batchIds || batchIds.length === 0) {
        cb([]);
        return () => {};
    }
    const ids = batchIds.slice(0, 30);
    return batchesCol()
        .where(documentId(), 'in', ids)
        .onSnapshot(
            snap => { if (snap) cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))); },
            warnSnapshotErr('subscribeBatchesByIds'),
        );
};

export const createBatch = async ({ name, subject, color, teacherId, teacherName, scheduleDays, scheduleTime, maxStudents }) => {
    const ref = await batchesCol().add({
        name,
        subject,
        color,
        teacherId: teacherId || null,
        teacherName: teacherName || '',
        scheduleDays: scheduleDays || [],
        scheduleTime: scheduleTime || '',
        maxStudents: Number(maxStudents) || 30,
        status: 'active',
        studentIds: [],
        createdAt: FieldValue.serverTimestamp(),
    });

    if (teacherId) {
        await usersCol().doc(teacherId).update({
            batchIds: FieldValue.arrayUnion(ref.id),
        });
    }

    return ref.id;
};

export const updateBatch = async (batchId, data) => {
    await batchesCol().doc(batchId).update(data);
};

export const deleteBatch = async (batchId) => {
    if (!batchId) return;
    // Remove the batch from every student who's enrolled in it,
    // unassign the teacher, then delete the batch doc itself.
    const studentsSnap = await usersCol()
        .where('batchIds', 'array-contains', batchId)
        .get();
    const batchSnap = await batchesCol().doc(batchId).get();
    const teacherId = batchSnap.exists() ? batchSnap.data()?.teacherId : null;

    const writer = db.batch();
    studentsSnap.forEach(d => {
        writer.update(d.ref, { batchIds: FieldValue.arrayRemove(batchId) });
    });
    if (teacherId) {
        writer.update(usersCol().doc(teacherId), { batchIds: FieldValue.arrayRemove(batchId) });
    }
    writer.delete(batchesCol().doc(batchId));
    await writer.commit();
};

export const subscribeClasses = (cb) =>
    classesCol().orderBy('scheduledAt', 'desc').onSnapshot(
        snap => { if (snap) cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))); },
        warnSnapshotErr('subscribeClasses'),
    );

export const subscribeClassesByTeacher = (teacherId, cb) =>
    classesCol()
        .where('teacherId', '==', teacherId)
        .onSnapshot(
            snap => {
                if (!snap) return;
                const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                list.sort((a, b) => (b.scheduledAt?.toMillis?.() || 0) - (a.scheduledAt?.toMillis?.() || 0));
                cb(list);
            },
            warnSnapshotErr('subscribeClassesByTeacher'),
        );

export const subscribeClassesByBatches = (batchIds, cb) => {
    if (!batchIds || batchIds.length === 0) {
        cb([]);
        return () => {};
    }
    const ids = batchIds.slice(0, 30);
    return classesCol()
        .where('batchId', 'in', ids)
        .onSnapshot(
            snap => {
                if (!snap) return;
                const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                list.sort((a, b) => (b.scheduledAt?.toMillis?.() || 0) - (a.scheduledAt?.toMillis?.() || 0));
                cb(list);
            },
            warnSnapshotErr('subscribeClassesByBatches'),
        );
};

export const createClass = async ({
    batchId, batchName, teacherId, teacherName, title, description,
    scheduledAt, durationMin, color,
}) => {
    const ref = await classesCol().add({
        batchId,
        batchName,
        teacherId,
        teacherName,
        title,
        description: description || '',
        scheduledAt,
        durationMin: Number(durationMin) || 60,
        color: color || '#FF4B6E',
        status: 'scheduled',
        joinedStudentIds: [],
        createdAt: FieldValue.serverTimestamp(),
    });
    return ref.id;
};

export const startLiveClass = async (classId) => {
    await classesCol().doc(classId).update({
        status: 'live',
        startedAt: FieldValue.serverTimestamp(),
    });
};

export const endLiveClass = async (classId) => {
    await classesCol().doc(classId).update({
        status: 'completed',
        endedAt: FieldValue.serverTimestamp(),
    });
};

export const markStudentJoined = async (classId, studentId) => {
    await classesCol().doc(classId).update({
        joinedStudentIds: FieldValue.arrayUnion(studentId),
    });
    await classesCol().doc(classId).collection('attendance').doc(studentId).set({
        studentId,
        status: 'present',
        joinedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
};

export const subscribeAttendanceForClass = (classId, cb) =>
    classesCol().doc(classId).collection('attendance').onSnapshot(
        snap => { if (snap) cb(snap.docs.map(d => ({ id: d.id, ...d.data() }))); },
        warnSnapshotErr('subscribeAttendanceForClass'),
    );

export const subscribeNotificationsForUser = (uid, cb) =>
    db.collection('notifications')
        .where('userId', '==', uid)
        .onSnapshot(
            snap => {
                if (!snap) return;
                const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
                cb(list);
            },
            warnSnapshotErr('subscribeNotificationsForUser'),
        );

export const writeNotification = async ({ userId, title, body, type, classId, batchId }) => {
    await db.collection('notifications').add({
        userId,
        title,
        body,
        type: type || 'info',
        classId: classId || null,
        batchId: batchId || null,
        read: false,
        createdAt: FieldValue.serverTimestamp(),
    });
};

export const markNotificationRead = async (notifId) => {
    await db.collection('notifications').doc(notifId).update({ read: true });
};

export const deleteNotification = async (notifId) => {
    await db.collection('notifications').doc(notifId).delete();
};

export const subscribeNotesByTeacher = (teacherId, cb) =>
    notesCol().where('teacherId', '==', teacherId).onSnapshot(
        snap => {
            if (!snap) return;
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
            cb(list);
        },
        warnSnapshotErr('subscribeNotesByTeacher'),
    );

export const subscribeNotesByBatches = (batchIds, cb) => {
    if (!batchIds || batchIds.length === 0) {
        cb([]);
        return () => {};
    }
    const ids = batchIds.slice(0, 30);
    return notesCol().where('batchId', 'in', ids).onSnapshot(
        snap => {
            if (!snap) return;
            const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
            cb(list);
        },
        warnSnapshotErr('subscribeNotesByBatches'),
    );
};

export const createNote = async ({ title, body, batchId, batchName, teacherId, teacherName }) => {
    const ref = await notesCol().add({
        title: title.trim(),
        body: body.trim(),
        batchId,
        batchName: batchName || '',
        teacherId,
        teacherName: teacherName || '',
        createdAt: FieldValue.serverTimestamp(),
    });
    return ref.id;
};

export const deleteNote = async (noteId) => {
    await notesCol().doc(noteId).delete();
};

export const removeStudentFromBatch = async (batchId, studentUid) => {
    await batchesCol().doc(batchId).update({
        studentIds: FieldValue.arrayRemove(studentUid),
    });
    await usersCol().doc(studentUid).update({
        batchIds: FieldValue.arrayRemove(batchId),
    });
};

export const addStudentsToBatch = async (batchId, studentUids) => {
    if (!batchId || !studentUids?.length) return;
    const batch = db.batch();
    batch.update(batchesCol().doc(batchId), {
        studentIds: FieldValue.arrayUnion(...studentUids),
    });
    studentUids.forEach(uid => {
        batch.update(usersCol().doc(uid), {
            batchIds: FieldValue.arrayUnion(batchId),
        });
    });
    await batch.commit();
};

export const fanOutNotificationToBatch = async ({ batchId, title, body, type, classId }) => {
    const batchSnap = await batchesCol().doc(batchId).get();
    const studentIds = batchSnap.data()?.studentIds || [];
    await Promise.all(
        studentIds.map(uid => writeNotification({ userId: uid, title, body, type, classId, batchId })),
    );
};
