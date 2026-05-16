/**
 * authService.js
 * Auth helpers backed by the Studivista API.
 *
 * Original exports used by screens:
 *   signIn, signOut, getUserDoc, ensureAdminDoc,
 *   adminCreateTeacher, adminCreateStudent, teacherCreateStudent
 *
 * NOTE: onAuthChanged is no longer needed — AuthContext now
 * uses an AsyncStorage session.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch, SERVER_URL } from './api';

const TOKEN_KEY = 'sv_token';
const PROFILE_KEY = 'sv_profile';

// ── Login ─────────────────────────────────────────────────────────────────
// Returns { uid, name, email, role, ... }.
export const signIn = async (email, password) => {
  const data = await apiFetch('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  console.log('Login successful, received user:', data.user);
  await AsyncStorage.setItem(TOKEN_KEY, data.token);
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(data.user));
  return data.user; // has .uid — LoginScreen does fbUser.uid ✅
};

// ── Sign out ──────────────────────────────────────────────────────────────
export const signOut = async () => {
  await AsyncStorage.multiRemove([TOKEN_KEY, PROFILE_KEY]);
};

// ── Get user doc by uid ───────────────────────────────────────────────────
// LoginScreen: const userDoc = await getUserDoc(fbUser.uid)
export const getUserDoc = async uid => {
  try {
    return await apiFetch(`/api/users/${uid}`);
  } catch {
    return null;
  }
};

// ── Ensure admin profile exists ───────────────────────────────────────────
// LoginScreen: ensureAdminDoc(fbUser) where fbUser = { uid, email, ... }
// Original created a Firestore doc; we ensure the server has the profile.
export const ensureAdminDoc = async fbUser => {
  try {
    const data = await apiFetch('/api/auth/ensure-admin', {
      method: 'POST',
      body: { email: fbUser.email, password: 'Admin@123' },
    });
    // Save fresh token if returned
    if (data.token) {
      await AsyncStorage.setItem(TOKEN_KEY, data.token);
      await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(data.user));
    }
    return data.user;
  } catch {
    return null;
  }
};

// ── Restore session from AsyncStorage (used by AuthContext on boot) ───────
export const getStoredProfile = async () => {
  const raw = await AsyncStorage.getItem(PROFILE_KEY);
  return raw ? JSON.parse(raw) : null;
};

// ── Refresh profile from server ───────────────────────────────────────────
export const refreshProfile = async () => {
  const user = await apiFetch('/api/auth/me');
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(user));
  return user;
};

export const updateProfileAvatar = async (uid, file) => {
  if (!uid) throw new Error('User is missing.');
  if (!file?.uri) throw new Error('Choose an image first.');

  const token = await AsyncStorage.getItem(TOKEN_KEY);
  const formData = new FormData();
  formData.append('file', {
    uri: file.uri,
    name: file.name || `profile-${Date.now()}.jpg`,
    type: file.type || 'image/jpeg',
  });

  const uploaded = await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${SERVER_URL}/chat-upload`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.onload = () => {
      let parsed = {};
      try {
        parsed = JSON.parse(xhr.responseText || '{}');
      } catch {
        parsed = {};
      }
      if (xhr.status < 300) resolve(parsed);
      else reject(new Error(parsed.error || `HTTP ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('Profile picture upload failed.'));
    xhr.send(formData);
  });

  if (!uploaded?.url) throw new Error('Upload did not return an image URL.');
  await apiFetch(`/api/users/${uid}`, {
    method: 'PATCH',
    body: { avatar: uploaded.url },
  });

  return refreshProfile();
};

// ── Admin: create teacher ─────────────────────────────────────────────────
export const adminCreateTeacher = async ({
  email,
  password,
  name,
  subject,
  createdByUid,
}) => {
  const data = await apiFetch('/api/auth/create-user', {
    method: 'POST',
    body: { email, password, name, role: 'teacher', subject, createdByUid },
  });
  return data.uid || data.user?.uid;
};

// ── Admin: create student ─────────────────────────────────────────────────
export const adminCreateStudent = async ({
  email,
  password,
  name,
  createdByUid,
}) => {
  const data = await apiFetch('/api/auth/create-user', {
    method: 'POST',
    body: { email, password, name, role: 'student', createdByUid },
  });
  return data.uid;
};

// ── Teacher: create student in a batch ───────────────────────────────────
export const teacherCreateStudent = async ({
  email,
  password,
  name,
  batchId,
  teacherUid,
}) => {
  const data = await apiFetch('/api/auth/create-user', {
    method: 'POST',
    body: {
      email,
      password,
      name,
      role: 'student',
      batchId,
      createdByUid: teacherUid,
    },
  });
  return data.uid;
};

// ── Stub: kept so any leftover import doesn't crash ───────────────────────
// Original AuthContext used onAuthChanged — new AuthContext doesn't need it
export const onAuthChanged = cb => {
  getStoredProfile().then(profile =>
    cb(profile ? { uid: profile.uid, email: profile.email } : null),
  );
  return () => {};
};
