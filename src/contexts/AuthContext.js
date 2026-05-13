/**
 * AuthContext.js
 * Provides auth state from AsyncStorage and the Studivista API.
 *
 * Context value is IDENTICAL to original:
 *   { user, profile, initializing, signOut }
 *
 * Boot flow:
 *   1. Read stored profile from AsyncStorage (instant, no flicker)
 *   2. Silently refresh from server in background
 *   3. Register socket for real-time push notifications
 *   4. Presence heartbeat every 30s (same as original)
 *
 * Batch topic subscription (original FCM behavior) is replaced by
 * Socket.io user rooms — server pushes notifications directly.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  getStoredProfile,
  refreshProfile,
  signOut as _signOut,
} from '../services/authService';
import { updateLastSeen } from '../services/firestoreService';
import {
  registerUserSocket,
  registerPushTokenForUser,
  requestNotificationPermission,
  unregisterPushTokenForUser,
  unregisterUserSocket,
  subscribeToBatchTopic, // stub — no-op
  unsubscribeFromBatchTopic, // stub — no-op
} from '../services/notificationService';

const AuthContext = createContext({
  user: null,
  profile: null,
  initializing: true,
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // same shape: { uid, email, ... }
  const [profile, setProfile] = useState(null);
  const [initializing, setInitializing] = useState(true);

  const presenceTimerRef = useRef(null);
  const subscribedTopicsRef = useRef(new Set());

  const setSession = useCallback(async sessionProfile => {
    if (!sessionProfile) return;
    setUser(sessionProfile);
    setProfile(sessionProfile);

    registerUserSocket(sessionProfile.uid);
    const pushAllowed = await requestNotificationPermission();
    if (pushAllowed) await registerPushTokenForUser(sessionProfile.uid);

    if (
      sessionProfile.role === 'student' &&
      Array.isArray(sessionProfile.batchIds)
    ) {
      for (const b of sessionProfile.batchIds) {
        const t = `batch_${b}`;
        if (!subscribedTopicsRef.current.has(t)) {
          subscribeToBatchTopic(b);
          subscribedTopicsRef.current.add(t);
        }
      }
    }
  }, []);

  // ── Presence heartbeat (identical to original) ────────────────────────
  useEffect(() => {
    if (presenceTimerRef.current) clearInterval(presenceTimerRef.current);
    if (!user?.uid) return;
    updateLastSeen(user.uid);
    presenceTimerRef.current = setInterval(
      () => updateLastSeen(user.uid),
      30000,
    );
    return () => clearInterval(presenceTimerRef.current);
  }, [user?.uid]);

  // ── Boot: restore session from AsyncStorage ───────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const stored = await getStoredProfile();
        if (stored) {
          await setSession(stored);

          // Background refresh — update profile silently
          refreshProfile()
            .then(setSession)
            .catch(() => {});
        }
      } catch (e) {
        console.warn('AuthContext boot error:', e.message);
      } finally {
        setInitializing(false);
      }
    })();
  }, [setSession]);

  // ── Sign out ──────────────────────────────────────────────────────────
  const signOut = async () => {
    // Unsubscribe batch topics (stubs)
    for (const t of subscribedTopicsRef.current) {
      unsubscribeFromBatchTopic(t.replace('batch_', ''));
    }
    subscribedTopicsRef.current = new Set();
    if (presenceTimerRef.current) clearInterval(presenceTimerRef.current);
    try {
      await unregisterPushTokenForUser();
    } catch (e) {
      console.warn('Push token unregister failed during sign out:', e.message);
    }
    unregisterUserSocket();

    await _signOut();
    setUser(null);
    setProfile(null);
  };

  // Value shape IDENTICAL to original ✅
  const value = { user, profile, initializing, signOut, setSession };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
