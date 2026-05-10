import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { db } from '../services/firebase';
import { onAuthChanged, ensureAdminDoc, signOut } from '../services/authService';
import { updateLastSeen } from '../services/firestoreService';
import {
    requestNotificationPermission, saveFcmTokenForUser,
    subscribeToBatchTopic, unsubscribeFromBatchTopic,
} from '../services/notificationService';

const ADMIN_EMAILS = ['admin@studivista.com'];

const AuthContext = createContext({ user: null, profile: null, initializing: true });

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [initializing, setInitializing] = useState(true);

    const profileUnsubRef = useRef(null);
    const subscribedTopicsRef = useRef(new Set());
    const presenceTimerRef = useRef(null);

    useEffect(() => {
        if (presenceTimerRef.current) clearInterval(presenceTimerRef.current);
        if (!user?.uid) return;
        // Mark online immediately, then heartbeat every 30s.
        updateLastSeen(user.uid);
        presenceTimerRef.current = setInterval(() => updateLastSeen(user.uid), 30000);
        return () => clearInterval(presenceTimerRef.current);
    }, [user?.uid]);

    useEffect(() => {
        const unsub = onAuthChanged(async (fbUser) => {
            if (profileUnsubRef.current) {
                profileUnsubRef.current();
                profileUnsubRef.current = null;
            }

            for (const t of subscribedTopicsRef.current) {
                unsubscribeFromBatchTopic(t.replace('batch_', ''));
            }
            subscribedTopicsRef.current = new Set();

            if (!fbUser) {
                setUser(null);
                setProfile(null);
                setInitializing(false);
                return;
            }

            setUser(fbUser);

            if (ADMIN_EMAILS.includes((fbUser.email || '').toLowerCase())) {
                try { await ensureAdminDoc(fbUser); } catch {}
            }

            profileUnsubRef.current = db.collection('users').doc(fbUser.uid).onSnapshot(
                snap => {
                    const data = snap && snap.exists() ? { uid: fbUser.uid, ...snap.data() } : null;
                    setProfile(data);
                    setInitializing(false);

                    if (data?.role === 'student' && Array.isArray(data.batchIds)) {
                        const desired = new Set(data.batchIds.map(b => `batch_${b}`));
                        for (const t of subscribedTopicsRef.current) {
                            if (!desired.has(t)) {
                                unsubscribeFromBatchTopic(t.replace('batch_', ''));
                                subscribedTopicsRef.current.delete(t);
                            }
                        }
                        for (const b of data.batchIds) {
                            const t = `batch_${b}`;
                            if (!subscribedTopicsRef.current.has(t)) {
                                subscribeToBatchTopic(b);
                                subscribedTopicsRef.current.add(t);
                            }
                        }
                    }
                },
                err => {
                    console.warn('users/{uid} snapshot error:', err?.code, err?.message);
                    setProfile(null);
                    setInitializing(false);
                },
            );

            await requestNotificationPermission();
            await saveFcmTokenForUser(fbUser.uid);
        });
        return () => {
            unsub && unsub();
            if (profileUnsubRef.current) profileUnsubRef.current();
        };
    }, []);

    const value = { user, profile, initializing, signOut };
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
