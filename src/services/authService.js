import { fbAuth, db, FieldValue, getSecondaryAuth } from './firebase';

const usersCol = () => db.collection('users');

export const onAuthChanged = (cb) => fbAuth.onAuthStateChanged(cb);

export const signIn = async (email, password) => {
    const cred = await fbAuth.signInWithEmailAndPassword(email.trim(), password);
    return cred.user;
};

export const signOut = async () => {
    try {
        await fbAuth.signOut();
    } catch (e) {
        if (e?.code !== 'auth/no-current-user') throw e;
    }
};

export const getUserDoc = async (uid) => {
    const snap = await usersCol().doc(uid).get();
    return snap.exists() ? { uid, ...snap.data() } : null;
};

export const ensureAdminDoc = async (firebaseUser) => {
    const ref = usersCol().doc(firebaseUser.uid);
    const snap = await ref.get();
    if (snap.exists()) return { uid: firebaseUser.uid, ...snap.data() };

    const data = {
        email: firebaseUser.email,
        name: 'Admin',
        role: 'admin',
        status: 'active',
        createdAt: FieldValue.serverTimestamp(),
    };
    await ref.set(data);
    return { uid: firebaseUser.uid, ...data };
};

const createUserViaSecondaryApp = async ({ email, password }) => {
    const secondary = getSecondaryAuth();
    try {
        const cred = await secondary.createUserWithEmailAndPassword(email.trim(), password);
        await secondary.signOut();
        return cred.user;
    } catch (e) {
        try { await secondary.signOut(); } catch {}
        throw e;
    }
};

export const adminCreateTeacher = async ({ email, password, name, subject, createdByUid }) => {
    const newUser = await createUserViaSecondaryApp({ email, password });
    await usersCol().doc(newUser.uid).set({
        email: email.trim(),
        name: name.trim(),
        role: 'teacher',
        subject: subject || '',
        status: 'active',
        createdBy: createdByUid || null,
        batchIds: [],
        createdAt: FieldValue.serverTimestamp(),
    });
    return newUser.uid;
};

export const adminCreateStudent = async ({ email, password, name, createdByUid }) => {
    const newUser = await createUserViaSecondaryApp({ email, password });
    await usersCol().doc(newUser.uid).set({
        email: email.trim(),
        name: name.trim(),
        role: 'student',
        status: 'active',
        batchIds: [],
        createdBy: createdByUid || null,
        createdAt: FieldValue.serverTimestamp(),
    });
    return newUser.uid;
};

export const teacherCreateStudent = async ({ email, password, name, batchId, teacherUid }) => {
    const newUser = await createUserViaSecondaryApp({ email, password });
    await usersCol().doc(newUser.uid).set({
        email: email.trim(),
        name: name.trim(),
        role: 'student',
        status: 'active',
        teacherId: teacherUid || null,
        batchIds: batchId ? [batchId] : [],
        createdBy: teacherUid || null,
        createdAt: FieldValue.serverTimestamp(),
    });

    if (batchId) {
        await db.collection('batches').doc(batchId).update({
            studentIds: FieldValue.arrayUnion(newUser.uid),
        });
    }

    return newUser.uid;
};
