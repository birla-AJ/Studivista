import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Platform, Vibration,
    PermissionsAndroid, Modal,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    RTCPeerConnection, RTCView, mediaDevices,
    RTCSessionDescription, RTCIceCandidate,
} from 'react-native-webrtc';
import io from 'socket.io-client';
import InCallManager from 'react-native-incall-manager';
import { SERVER_URL, ICE_SERVERS } from '../../config';
import { SIZES, SPACING, RADIUS } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';
import AppIcon from '../../components/AppIcon';
import LiveClassChat from '../../components/LiveClassChat';
import { useAuth } from '../../contexts/AuthContext';
import { endLiveClass, markStudentJoined } from '../../services/firestoreService';
import { Toast } from '../../components/Toast';

// LiveClass — Teams-style live class.
// Mesh WebRTC: every participant publishes audio+video to every other.
// One screen sharer at a time (latest wins). Teacher has per-student mute/cam-off/remove.
// Two PCs per remote peer:  media_${id}  (audio+video),  screen_${id}  (screen-share-only).

const requestMediaPermissions = async () => {
    if (Platform.OS !== 'android') return true;
    try {
        const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.CAMERA,
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        ]);
        return Object.values(granted).every(s => s === PermissionsAndroid.RESULTS.GRANTED);
    } catch {
        return false;
    }
};

const SCREEN_SHARE_CONSTRAINTS = {
    video: {
        width: { ideal: 1280, max: 1280 },
        height: { ideal: 720, max: 720 },
        frameRate: { ideal: 15, max: 20 },
    },
    audio: false,
};

const tuneScreenShareSender = async (sender) => {
    if (!sender?.getParameters || !sender?.setParameters) return;
    try {
        const params = sender.getParameters() || {};
        params.degradationPreference = 'maintain-resolution';
        params.encodings = (params.encodings?.length ? params.encodings : [{}]).map(encoding => ({
            ...encoding,
            maxBitrate: 1400000,
            maxFramerate: 15,
        }));
        await sender.setParameters(params);
    } catch (err) {
        console.warn('[LiveClass] screen sender tuning skipped', err?.message);
    }
};

const getScreenShareStream = async () => {
    try {
        return await mediaDevices.getDisplayMedia(SCREEN_SHARE_CONSTRAINTS);
    } catch (err) {
        if (err?.message === 'Screen share cancelled') throw err;
        console.warn('[LiveClass] constrained screen capture failed, using default capture', err?.message);
        return mediaDevices.getDisplayMedia({ video: true });
    }
};

const LiveClass = ({ navigation, route }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const { user, profile } = useAuth();

    const cls = route?.params?.cls || {};
    const passedSocket = route?.params?.socket;
    const roomId = route?.params?.roomId || cls.id;
    const role = route?.params?.role || profile?.role || 'student';
    const isTeacher = role === 'teacher' || profile?.role === 'admin';
    const myName = route?.params?.name || profile?.name || 'User';

    // ── Refs ──
    const socketRef = useRef(null);
    const localStreamRef = useRef(null);       // own camera+mic
    const screenStreamRef = useRef(null);      // own screen capture
    const peerConnections = useRef({});        // 'media_${id}' or 'screen_${id}'
    const iceCandidateBuffer = useRef({});
    const remoteDescSet = useRef({});
    const connectedPeers = useRef(new Set());
    const screenSharerIdRef = useRef(null);
    const remoteStreamsRef = useRef({});       // { [peerId]: MediaStream }

    // ── State ──
    const [status, setStatus] = useState('Connecting...');
    const [localStreamURL, setLocalStreamURL] = useState(null);
    const [micOn, setMicOn] = useState(true);
    const [cameraOn, setCameraOn] = useState(true);
    const [speakerOn, setSpeakerOn] = useState(true);
    const [isFrontCamera, setIsFrontCamera] = useState(true);

    const [isSharingScreen, setIsSharingScreen] = useState(false);
    const [senderScreenURL, setSenderScreenURL] = useState(null);
    const [screenSharerName, setScreenSharerName] = useState('');
    const [screenShareStreamURL, setScreenShareStreamURL] = useState(null);

    const [pendingJoins, setPendingJoins] = useState([]);
    const [participants, setParticipants] = useState([]); // { id, name, role, micOn, cameraOn }
    const [remoteStreamURLs, setRemoteStreamURLs] = useState({});
    const [leftToast, setLeftToast] = useState(null);
    const [classEnded, setClassEnded] = useState(false);
    const [liveSocket, setLiveSocket] = useState(null);
    const [chatVisible, setChatVisible] = useState(false);
    const [unreadChatCount, setUnreadChatCount] = useState(0);
    const [chatNotificationVisible, setChatNotificationVisible] = useState(false);
    // null when no fullscreen view is open. Otherwise: { streamURL, label, fit, mirror }
    const [fullscreenSource, setFullscreenSource] = useState(null);

    // Use refs that lag behind state, so socket handlers see fresh values
    const micOnRef = useRef(true);
    const cameraOnRef = useRef(true);
    useEffect(() => { micOnRef.current = micOn; }, [micOn]);
    useEffect(() => { cameraOnRef.current = cameraOn; }, [cameraOn]);
    const isSharingScreenRef = useRef(false);
    useEffect(() => { isSharingScreenRef.current = isSharingScreen; }, [isSharingScreen]);

    // ─────────────────────────────────────────────────────────────────────
    const setRemoteStream = (peerId, stream) => {
        remoteStreamsRef.current[peerId] = stream;
        setRemoteStreamURLs(prev => ({ ...prev, [peerId]: stream.toURL() }));
    };
    const dropRemoteStream = (peerId) => {
        delete remoteStreamsRef.current[peerId];
        setRemoteStreamURLs(prev => {
            const next = { ...prev };
            delete next[peerId];
            return next;
        });
    };

    const sendMediaState = (overrides) => {
        socketRef.current?.emit('media-state', {
            micOn: overrides?.micOn ?? micOnRef.current,
            cameraOn: overrides?.cameraOn ?? cameraOnRef.current,
        });
    };

    const createMediaPC = (peerId) => {
        const key = `media_${peerId}`;
        if (peerConnections.current[key]) {
            try { peerConnections.current[key].close(); } catch {}
        }
        const pc = new RTCPeerConnection(ICE_SERVERS);
        peerConnections.current[key] = pc;
        iceCandidateBuffer.current[key] = [];
        remoteDescSet.current[key] = false;

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(t => {
                try {
                    pc.addTrack(t, localStreamRef.current);
                } catch (err) {
                    console.warn('[LiveClass] addTrack failed for peer', peerId, t.kind, err?.message);
                }
            });
        } else {
            console.warn('[LiveClass] createMediaPC: localStreamRef is null, peer will get no media');
        }
        pc.ontrack = (event) => {
            try {
                const stream = event.streams?.[0];
                if (stream) setRemoteStream(peerId, stream);
            } catch (err) {
                console.warn('[LiveClass] ontrack handler failed', peerId, err?.message);
            }
        };
        pc.onicecandidate = (e) => {
            if (e.candidate) {
                socketRef.current?.emit('ice-candidate', { to: peerId, candidate: e.candidate });
            }
        };
        pc.oniceconnectionstatechange = () => {
            console.log('[LiveClass] media ICE state', peerId, pc.iceConnectionState);
        };
        return pc;
    };

    const sendMediaOfferTo = async (peerId) => {
        try {
            const pc = createMediaPC(peerId);
            await new Promise(r => setTimeout(r, Platform.OS === 'android' ? 200 : 50));
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socketRef.current?.emit('offer', { to: peerId, offer });
        } catch (err) {
            console.warn('[LiveClass] sendMediaOfferTo failed for', peerId, err?.message);
        }
    };

    const sendScreenOfferTo = async (socket, peerId) => {
        if (!screenStreamRef.current) return;
        const key = `screen_${peerId}`;
        if (peerConnections.current[key]) {
            try { peerConnections.current[key].close(); } catch {}
        }
        const pc = new RTCPeerConnection(ICE_SERVERS);
        peerConnections.current[key] = pc;
        iceCandidateBuffer.current[key] = [];
        remoteDescSet.current[key] = false;

        screenStreamRef.current.getTracks().forEach(t => {
            const sender = pc.addTrack(t, screenStreamRef.current);
            if (t.kind === 'video') tuneScreenShareSender(sender);
        });
        pc.onicecandidate = (e) => {
            if (e.candidate) socket.emit('screen-ice-candidate', { to: peerId, candidate: e.candidate });
        };
        await new Promise(r => setTimeout(r, Platform.OS === 'android' ? 150 : 50));
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('screen-offer', { to: peerId, offer });
    };

    // ─────────────────────────────────────────────────────────────────────
    useEffect(() => {
        let cancelled = false;
        const connectedPeerIds = connectedPeers.current;

        (async () => {
            const ok = await requestMediaPermissions();
            if (!ok) {
                Toast.error('Camera and microphone access is required for live class.', 'Permissions needed');
                setTimeout(() => navigation.goBack(), 1500);
                return;
            }

            // Acquire local cam+mic before any signaling — so peers immediately
            // get our tracks when they connect.
            try {
                const stream = await mediaDevices.getUserMedia({
                    audio: true,
                    video: {
                        facingMode: 'user',
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                        frameRate: { ideal: 24 },
                    },
                });
                if (cancelled) {
                    stream.getTracks().forEach(t => t.stop());
                    return;
                }
                localStreamRef.current = stream;
                setLocalStreamURL(stream.toURL());
            } catch (e) {
                Toast.error(e?.message || 'Could not access camera or mic.', 'Camera/Mic error');
                setTimeout(() => navigation.goBack(), 1500);
                return;
            }

            // Route audio to loudspeaker by default — phones default to earpiece.
            try {
                InCallManager.start({ media: 'video' });
                InCallManager.setSpeakerphoneOn(true);
                InCallManager.setKeepScreenOn(true);
            } catch {}

            const token = await AsyncStorage.getItem('sv_token');
            const socket = passedSocket || io(SERVER_URL, {
                transports: ['websocket'],
                auth: { token },
            });
            socketRef.current = socket;
            setLiveSocket(socket);

            const onConnected = () => {
                setStatus('Connected · ' + roomId);
                socket.emit('join-room', { roomId, name: myName, role: isTeacher ? 'host' : 'participant' });
                // Tell others our initial cam/mic state
                setTimeout(() => sendMediaState({ micOn: true, cameraOn: true }), 300);
            };
            if (socket.connected) {
                onConnected();
            } else {
                socket.on('connect', onConnected);
            }

            socket.on('connect_error', (err) => setStatus('Error: ' + err.message));
            socket.on('disconnect', () => setStatus('Disconnected'));

            // ── Room participants ──
            socket.on('room-users', ({ users }) => {
                if (Array.isArray(users)) {
                    users.forEach(id => { if (id !== socket.id) connectedPeers.current.add(id); });
                }
            });

            socket.on('existing-users', (users) => {
                console.log('[LiveClass] existing-users:', users?.length || 0);
                if (!Array.isArray(users)) return;
                users.forEach(u => connectedPeers.current.add(u.userId));
                setParticipants(prev => {
                    const seen = new Set(prev.map(p => p.id));
                    const added = users
                        .filter(u => !seen.has(u.userId))
                        .map(u => ({
                            id: u.userId, name: u.name || 'User',
                            role: u.userRole, micOn: true, cameraOn: true,
                        }));
                    return [...added, ...prev];
                });
                // We're the new joiner — initiate media offers to existing peers.
                if (!localStreamRef.current) {
                    console.warn('[LiveClass] existing-users fired but local stream not ready yet');
                }
                users.forEach(u => sendMediaOfferTo(u.userId));
            });

            socket.on('user-joined', ({ userId, userRole, name }) => {
                connectedPeers.current.add(userId);
                setParticipants(prev => {
                    if (prev.find(p => p.id === userId)) return prev;
                    return [{
                        id: userId, name: name || 'Student', role: userRole,
                        micOn: true, cameraOn: true,
                    }, ...prev];
                });
                if (isTeacher && userRole !== 'host' && userRole !== 'teacher') {
                    Vibration.vibrate(50);
                }
                // Re-broadcast my media state so the new joiner sees correct icons
                setTimeout(() => sendMediaState(), 500);
                // If I'm currently sharing screen, push it to the new joiner
                if (isSharingScreenRef.current && screenStreamRef.current) {
                    sendScreenOfferTo(socket, userId);
                    socket.emit('screen-share-started', { roomId, sharerName: myName });
                }
                // Note: don't initiate a media offer here — the new joiner will
                // offer to us on their 'existing-users' event. Avoids glare.
            });

            socket.on('user-left', ({ userId, name }) => {
                connectedPeers.current.delete(userId);
                ['media', 'screen'].forEach(prefix => {
                    const key = `${prefix}_${userId}`;
                    if (peerConnections.current[key]) {
                        try { peerConnections.current[key].close(); } catch {}
                        delete peerConnections.current[key];
                        delete iceCandidateBuffer.current[key];
                        delete remoteDescSet.current[key];
                    }
                });
                dropRemoteStream(userId);
                if (screenSharerIdRef.current === userId) {
                    screenSharerIdRef.current = null;
                    setScreenSharerName('');
                    setScreenShareStreamURL(null);
                }
                let leaverName = name;
                setPendingJoins(prev => prev.filter(p => p.from !== userId));
                setParticipants(prev => {
                    const found = prev.find(p => p.id === userId);
                    if (found && !leaverName) leaverName = found.name;
                    return prev.filter(p => p.id !== userId);
                });
                if (isTeacher && leaverName) {
                    setLeftToast(`${leaverName} left the class`);
                    setTimeout(() => setLeftToast(null), 2500);
                }
            });

            // Teacher emits this when ending the class — students show "Class ended" overlay.
            socket.on('class-ended', () => {
                if (isTeacher) return;
                setClassEnded(true);
                setTimeout(() => navigation.goBack(), 2500);
            });

            // ── Pending joins (out-of-batch students) ──
            socket.on('pending-join', ({ from, name }) => {
                if (!isTeacher) return;
                setPendingJoins(prev => {
                    if (prev.find(p => p.from === from)) return prev;
                    Vibration.vibrate(Platform.OS === 'android' ? [0, 200, 100, 200] : 400);
                    return [...prev, { from, name }];
                });
            });

            // ── Peers' media state (mic/cam icons) ──
            socket.on('media-state', ({ from, micOn: m, cameraOn: c }) => {
                setParticipants(prev =>
                    prev.map(p => p.id === from ? { ...p, micOn: !!m, cameraOn: !!c } : p),
                );
            });

            // ── Teacher → student: forced controls ──
            // Teacher can only mute (one-way). Student decides when to unmute.
            socket.on('force-mute', () => {
                const t = localStreamRef.current?.getAudioTracks?.()[0];
                if (t) t.enabled = false;
                setMicOn(false);
                if (!isTeacher) Toast.warning('The teacher has muted your microphone.', 'Muted');
                sendMediaState({ micOn: false });
            });
            // Teacher can only turn OFF a student's camera (one-way). The
            // student decides whether/when to turn it back on themselves.
            socket.on('force-camera-off', () => {
                const t = localStreamRef.current?.getVideoTracks?.()[0];
                if (t) t.enabled = false;
                setCameraOn(false);
                if (!isTeacher) Toast.warning('The teacher has turned off your camera.', 'Camera off');
                sendMediaState({ cameraOn: false });
            });
            socket.on('force-remove', () => {
                if (isTeacher) return;
                Toast.error('You have been removed from the class.', 'Removed');
                setTimeout(() => navigation.goBack(), 2000);
            });

            // ── WebRTC: media (audio + video) ──
            socket.on('offer', async ({ from, offer }) => {
                console.log('[LiveClass] received offer from', from);
                try {
                    const key = `media_${from}`;
                    let pc = peerConnections.current[key];
                    if (!pc) pc = createMediaPC(from);
                    await pc.setRemoteDescription(new RTCSessionDescription(offer));
                    remoteDescSet.current[key] = true;
                    for (const c of iceCandidateBuffer.current[key] || []) {
                        try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
                    }
                    iceCandidateBuffer.current[key] = [];
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    socket.emit('answer', { to: from, answer });
                } catch (err) {
                    console.warn('[LiveClass] offer handler failed for', from, err?.message);
                }
            });

            socket.on('answer', async ({ from, answer }) => {
                console.log('[LiveClass] received answer from', from);
                try {
                    const key = `media_${from}`;
                    const pc = peerConnections.current[key];
                    if (!pc) return;
                    await pc.setRemoteDescription(new RTCSessionDescription(answer));
                    remoteDescSet.current[key] = true;
                    for (const c of iceCandidateBuffer.current[key] || []) {
                        try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
                    }
                    iceCandidateBuffer.current[key] = [];
                } catch (err) {
                    console.warn('[LiveClass] answer handler failed for', from, err?.message);
                }
            });

            socket.on('ice-candidate', async ({ from, candidate }) => {
                try {
                    const key = `media_${from}`;
                    const pc = peerConnections.current[key];
                    if (pc && remoteDescSet.current[key]) {
                        await pc.addIceCandidate(new RTCIceCandidate(candidate));
                    } else {
                        iceCandidateBuffer.current[key] = iceCandidateBuffer.current[key] || [];
                        iceCandidateBuffer.current[key].push(candidate);
                    }
                } catch (err) {
                    console.warn('[LiveClass] ice-candidate handler failed for', from, err?.message);
                }
            });

            // ── WebRTC: screen share ──
            socket.on('screen-share-started', ({ sharerId, sharerName: sName }) => {
                // If someone else started sharing while I was sharing, stop my share.
                if (sharerId !== socket.id && isSharingScreenRef.current) {
                    stopScreenShareInternal();
                }
                screenSharerIdRef.current = sharerId;
                setScreenSharerName(sName || '');
            });

            socket.on('screen-share-stopped', () => {
                screenSharerIdRef.current = null;
                setScreenSharerName('');
                setScreenShareStreamURL(null);
            });

            socket.on('screen-share-active', ({ sharerId, sharerName: sName }) => {
                screenSharerIdRef.current = sharerId;
                setScreenSharerName(sName || '');
                socket.emit('screen-share-request', { to: sharerId });
            });

            socket.on('screen-share-request', async ({ from }) => {
                await sendScreenOfferTo(socket, from);
            });

            socket.on('screen-offer', async ({ from, offer }) => {
                const key = `screen_${from}`;
                if (peerConnections.current[key]) {
                    try { peerConnections.current[key].close(); } catch {}
                }
                const pc = new RTCPeerConnection(ICE_SERVERS);
                peerConnections.current[key] = pc;
                iceCandidateBuffer.current[key] = [];
                remoteDescSet.current[key] = false;

                pc.ontrack = (event) => {
                    const stream = event.streams?.[0];
                    if (stream) setScreenShareStreamURL(stream.toURL());
                };
                pc.onicecandidate = (e) => {
                    if (e.candidate) socket.emit('screen-ice-candidate', { to: from, candidate: e.candidate });
                };
                await pc.setRemoteDescription(new RTCSessionDescription(offer));
                remoteDescSet.current[key] = true;
                for (const c of iceCandidateBuffer.current[key] || []) {
                    try { await pc.addIceCandidate(new RTCIceCandidate(c)); } catch {}
                }
                iceCandidateBuffer.current[key] = [];
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                socket.emit('screen-answer', { to: from, answer });
            });

            socket.on('screen-answer', async ({ from, answer }) => {
                const pc = peerConnections.current[`screen_${from}`];
                if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
            });

            socket.on('screen-ice-candidate', async ({ from, candidate }) => {
                const key = `screen_${from}`;
                const pc = peerConnections.current[key];
                if (pc && remoteDescSet.current[key]) {
                    try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
                } else {
                    iceCandidateBuffer.current[key] = iceCandidateBuffer.current[key] || [];
                    iceCandidateBuffer.current[key].push(candidate);
                }
            });

            // Mark Firestore attendance for the student
            if (!isTeacher && cls?.id && user?.uid) {
                markStudentJoined(cls.id, user.uid).catch(() => {});
            }
        })();

        return () => {
            cancelled = true;
            try { InCallManager.stop(); } catch {}
            localStreamRef.current?.getTracks().forEach(t => t.stop());
            screenStreamRef.current?.getTracks().forEach(t => t.stop());
            Object.values(peerConnections.current).forEach(pc => { try { pc.close(); } catch {} });
            peerConnections.current = {};
            iceCandidateBuffer.current = {};
            remoteDescSet.current = {};
            connectedPeerIds.clear();
            remoteStreamsRef.current = {};
            try { socketRef.current?.disconnect(); } catch {}
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Local toggles ──
    const toggleMic = () => {
        const t = localStreamRef.current?.getAudioTracks?.()[0];
        if (!t) return;
        t.enabled = !t.enabled;
        setMicOn(t.enabled);
        sendMediaState({ micOn: t.enabled });
    };
    const toggleCamera = () => {
        const t = localStreamRef.current?.getVideoTracks?.()[0];
        if (!t) return;
        t.enabled = !t.enabled;
        setCameraOn(t.enabled);
        sendMediaState({ cameraOn: t.enabled });
    };
    const flipCamera = () => {
        const t = localStreamRef.current?.getVideoTracks?.()[0];
        if (!t) {
            Toast.warning('Camera is not ready yet.');
            return;
        }
        try {
            t._switchCamera();
            setIsFrontCamera(prev => !prev);
        } catch (err) {
            Toast.error(err?.message || 'Could not flip camera.', 'Flip failed');
        }
    };
    const toggleSpeaker = () => {
        const next = !speakerOn;
        try { InCallManager.setSpeakerphoneOn(next); } catch {}
        setSpeakerOn(next);
    };

    // ── Screen share ──
    const startScreenShare = async () => {
        try {
            const screenStream = await getScreenShareStream();
            screenStreamRef.current = screenStream;
            setSenderScreenURL(screenStream.toURL());
            setIsSharingScreen(true);
            screenSharerIdRef.current = socketRef.current?.id;
            setScreenSharerName(myName);

            socketRef.current?.emit('screen-share-started', { roomId, sharerName: myName });
            const peers = Array.from(connectedPeers.current);
            await Promise.allSettled(peers.map(peerId => sendScreenOfferTo(socketRef.current, peerId)));
            screenStream.getTracks()[0].onended = () => stopScreenShare();
        } catch (e) {
            if (e.message !== 'Screen share cancelled') {
                Toast.error(e.message || 'Could not start screen share.', 'Screen Share Error');
            }
        }
    };
    const stopScreenShareInternal = () => {
        screenStreamRef.current?.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
        setSenderScreenURL(null);
        setIsSharingScreen(false);
        Object.keys(peerConnections.current)
            .filter(k => k.startsWith('screen_'))
            .forEach(k => {
                try { peerConnections.current[k].close(); } catch {}
                delete peerConnections.current[k];
                delete iceCandidateBuffer.current[k];
                delete remoteDescSet.current[k];
            });
    };
    const stopScreenShare = () => {
        stopScreenShareInternal();
        socketRef.current?.emit('screen-share-stopped', { roomId });
    };

    // ── Pending joins ──
    const approveJoin = (peer) => {
        socketRef.current?.emit('approve-join', { to: peer.from, roomId });
        setPendingJoins(prev => prev.filter(p => p.from !== peer.from));
    };
    const rejectJoin = (peer) => {
        socketRef.current?.emit('reject-join', { to: peer.from, roomId });
        setPendingJoins(prev => prev.filter(p => p.from !== peer.from));
    };

    // ── Teacher → student controls ──
    const muteStudent = (p) =>
        socketRef.current?.emit('mute-student', { studentId: p.id });
    const camOffStudent = (p) =>
        socketRef.current?.emit('camera-off-student', { studentId: p.id });
    const removeStudent = (p) => {
        Alert.alert('Remove student?', `Remove ${p.name || 'this student'} from the class?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove', style: 'destructive',
                onPress: () => {
                    socketRef.current?.emit('remove-student', { studentId: p.id, roomId });
                    setParticipants(prev => prev.filter(x => x.id !== p.id));
                },
            },
        ]);
    };

    // ── End ──
    const handleEnd = () => {
        Alert.alert(isTeacher ? 'End class?' : 'Leave class?',
            isTeacher ? 'This will end the class.' : 'You will leave the class.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: isTeacher ? 'End' : 'Leave', style: 'destructive',
                onPress: async () => {
                    if (isSharingScreen) stopScreenShare();
                    if (isTeacher) {
                        // Tell students the class is ending so they can see a graceful message
                        socketRef.current?.emit('class-ended', { roomId });
                        if (cls?.id) { try { await endLiveClass(cls.id); } catch {} }
                    }
                    navigation.goBack();
                },
            },
        ]);
    };

    // ── Render derivations ──
    const teacherInRoom = participants.find(p => p.role === 'host' || p.role === 'teacher');
    const featuredStreamURL = screenShareStreamURL
        || (isSharingScreen ? senderScreenURL : null)
        || (teacherInRoom ? remoteStreamURLs[teacherInRoom.id] : null);
    const featuredLabel = screenShareStreamURL
        ? `🖥 ${screenSharerName || 'Screen Share'}`
        : isSharingScreen
            ? '🖥 Your Screen'
            : teacherInRoom ? `👨‍🏫 ${teacherInRoom.name || 'Teacher'}` : '';
    const featuredFit = screenShareStreamURL || isSharingScreen ? 'contain' : 'cover';

    // Close fullscreen if the source stream goes away (sharer left, peer left, etc.)
    useEffect(() => {
        if (!fullscreenSource) return;
        const { streamURL } = fullscreenSource;
        const stillValid = streamURL === featuredStreamURL
            || streamURL === localStreamURL
            || Object.values(remoteStreamURLs).includes(streamURL);
        if (!stillValid) setFullscreenSource(null);
    }, [fullscreenSource, featuredStreamURL, localStreamURL, remoteStreamURLs]);

    useEffect(() => {
        if (chatVisible || unreadChatCount <= 0) {
            setChatNotificationVisible(false);
            return undefined;
        }

        setChatNotificationVisible(true);
        const timer = setTimeout(() => setChatNotificationVisible(false), 4500);
        return () => clearTimeout(timer);
    }, [chatVisible, unreadChatCount]);

    const openChat = () => {
        setFullscreenSource(null);
        setChatVisible(true);
        setUnreadChatCount(0);
        setChatNotificationVisible(false);
    };

    const renderChatNotification = (fullscreen = false) => {
        if (chatVisible || unreadChatCount <= 0 || !chatNotificationVisible) return null;
        return (
            <TouchableOpacity
                style={[
                    styles.chatNotification,
                    fullscreen && styles.chatNotificationFullscreen,
                ]}
                onPress={openChat}
                activeOpacity={0.86}
            >
                <View style={styles.chatNotificationIcon}>
                    <AppIcon name="comments" size={15} color="#111111" />
                </View>
                <View style={styles.chatNotificationTextWrap}>
                    <Text style={styles.chatNotificationTitle} numberOfLines={1}>
                        New chat message
                    </Text>
                    <Text style={styles.chatNotificationSub} numberOfLines={1}>
                        {unreadChatCount > 9 ? '9+' : unreadChatCount} unread
                    </Text>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            {/* TOP BAR */}
            <View style={styles.topBar}>
                <TouchableOpacity onPress={handleEnd} style={styles.leaveBtn}>
                    <View style={styles.leaveContent}>
                        <AppIcon name="times" size={12} color={colors.danger} />
                        <Text style={styles.leaveBtnText}>Leave</Text>
                    </View>
                </TouchableOpacity>
                <View style={styles.topCenter}>
                    <View style={styles.livePill}>
                        <Text style={styles.liveText}>● LIVE</Text>
                    </View>
                    <Text style={styles.classTitle} numberOfLines={1}>{cls.title || 'Live Class'}</Text>
                    <Text style={styles.classSub} numberOfLines={1}>{status}</Text>
                </View>
                <TouchableOpacity
                    style={[styles.headerChatBtn, chatVisible && styles.headerChatBtnActive]}
                    onPress={() => (chatVisible ? setChatVisible(false) : openChat())}
                >
                    <View style={styles.chatIconWrap}>
                        <AppIcon name="comments" size={17} color="#FFFFFF" />
                        {!chatVisible && unreadChatCount > 0 && (
                            <View style={styles.chatBadge}>
                                <Text style={styles.chatBadgeText}>
                                    {unreadChatCount > 9 ? '9+' : unreadChatCount}
                                </Text>
                            </View>
                        )}
                    </View>
                </TouchableOpacity>
            </View>

            {/* Transient toast: "X left the class" — teacher view */}
            {leftToast && (
                <View style={styles.toast}>
                    <AppIcon name="sign-out-alt" size={12} color="#FFFFFF" />
                    <Text style={styles.toastText}>{leftToast}</Text>
                </View>
            )}

            {/* Pending join requests (teacher only) */}
            {isTeacher && pendingJoins.length > 0 && (
                <View style={styles.pendingBox}>
                    <Text style={styles.pendingTitle}>Join Requests ({pendingJoins.length})</Text>
                    {pendingJoins.map(p => (
                        <View key={p.from} style={styles.pendingRow}>
                            <Text style={styles.pendingName} numberOfLines={1}>{p.name}</Text>
                            <View style={{ flexDirection: 'row', gap: SPACING.sm }}>
                                <TouchableOpacity style={styles.approveBtn} onPress={() => approveJoin(p)}>
                                    <Text style={styles.approveBtnText}>Approve</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.rejectBtn} onPress={() => rejectJoin(p)}>
                                    <Text style={styles.rejectBtnText}>Reject</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </View>
            )}

            {/* MAIN AREA */}
            <View style={styles.mainArea}>
                <View style={styles.featuredBox}>
                    {featuredStreamURL ? (
                        <>
                            <View style={styles.featuredHeader}>
                                <Text style={styles.featuredLabel} numberOfLines={1}>{featuredLabel}</Text>
                                <View style={styles.featuredHeaderActions}>
                                    <TouchableOpacity
                                        style={styles.featuredIconBtn}
                                        onPress={() => setFullscreenSource({
                                            streamURL: featuredStreamURL,
                                            label: featuredLabel,
                                            fit: featuredFit,
                                            mirror: false,
                                        })}
                                    >
                                        <AppIcon name="expand" size={12} color="#FFFFFF" />
                                    </TouchableOpacity>
                                    {isSharingScreen && (
                                        <TouchableOpacity style={styles.stopShareBtn} onPress={stopScreenShare}>
                                            <Text style={styles.stopShareBtnText}>Stop</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            </View>
                            <RTCView
                                streamURL={featuredStreamURL}
                                style={styles.featuredVideo}
                                objectFit={featuredFit}
                                zOrder={1}
                            />
                        </>
                    ) : (
                        <View style={styles.placeholderBox}>
                            <Text style={styles.placeholderEmoji}>🎥</Text>
                            <Text style={styles.placeholderText}>
                                {isTeacher ? 'You are live' : 'Waiting for the teacher'}
                            </Text>
                            <Text style={styles.placeholderSub}>
                                Camera tiles below. Tap Share to share your screen.
                            </Text>
                        </View>
                    )}
                </View>

                {/* TILES STRIP — self + remotes */}
                <ScrollView
                    horizontal
                    style={styles.tilesStrip}
                    contentContainerStyle={styles.tilesStripContent}
                    showsHorizontalScrollIndicator={false}
                >
                    {/* Self tile */}
                    <TouchableOpacity
                        style={styles.tile}
                        activeOpacity={0.85}
                        disabled={!cameraOn || !localStreamURL}
                        onPress={() => setFullscreenSource({
                            streamURL: localStreamURL,
                            label: `🎥 ${myName} (You)`,
                            fit: 'cover',
                            mirror: isFrontCamera,
                        })}
                    >
                        {cameraOn && localStreamURL ? (
                            <RTCView
                                streamURL={localStreamURL}
                                style={styles.tileVideo}
                                objectFit="cover"
                                mirror={isFrontCamera}
                                zOrder={0}
                            />
                        ) : (
                            <View style={[styles.tileVideo, styles.tileFallback]}>
                                <Text style={styles.tileInitial}>
                                    {(myName || '?').charAt(0).toUpperCase()}
                                </Text>
                            </View>
                        )}
                        <TouchableOpacity
                            style={[
                                styles.selfFlipBtn,
                                (!cameraOn || !localStreamURL) && styles.selfFlipBtnDisabled,
                            ]}
                            onPress={flipCamera}
                            disabled={!cameraOn || !localStreamURL}
                            activeOpacity={0.85}
                        >
                            <AppIcon name="sync" size={12} color="#FFFFFF" />
                        </TouchableOpacity>
                        <View style={styles.tileFooter}>
                            <Text style={styles.tileName} numberOfLines={1}>You</Text>
                            <View style={styles.tileBadges}>
                                {!micOn && <AppIcon name="microphone-slash" size={10} color={colors.danger} />}
                                {!cameraOn && <AppIcon name="video-slash" size={10} color={colors.danger} />}
                            </View>
                        </View>
                    </TouchableOpacity>

                    {/* Remote tiles */}
                    {participants.map(p => {
                        const url = remoteStreamURLs[p.id];
                        const camOn = p.cameraOn !== false;
                        const mic = p.micOn !== false;
                        const isStudent = p.role !== 'host' && p.role !== 'teacher';
                        const tappable = !!url && camOn;
                        return (
                            <TouchableOpacity
                                key={p.id}
                                style={styles.tile}
                                activeOpacity={0.85}
                                disabled={!tappable}
                                onPress={() => setFullscreenSource({
                                    streamURL: url,
                                    label: `${p.role === 'host' || p.role === 'teacher' ? '👨‍🏫' : '🎓'} ${p.name || 'Participant'}`,
                                    fit: 'cover',
                                    mirror: false,
                                })}
                            >
                                {url && camOn ? (
                                    <RTCView
                                        streamURL={url}
                                        style={styles.tileVideo}
                                        objectFit="cover"
                                        zOrder={0}
                                    />
                                ) : (
                                    <View style={[styles.tileVideo, styles.tileFallback]}>
                                        <Text style={styles.tileInitial}>
                                            {(p.name || '?').charAt(0).toUpperCase()}
                                        </Text>
                                    </View>
                                )}
                                <View style={styles.tileFooter}>
                                    <Text style={styles.tileName} numberOfLines={1}>{p.name}</Text>
                                    <View style={styles.tileBadges}>
                                        {!mic && <AppIcon name="microphone-slash" size={10} color={colors.danger} />}
                                        {!camOn && <AppIcon name="video-slash" size={10} color={colors.danger} />}
                                    </View>
                                </View>
                                {isTeacher && isStudent && (
                                    <View style={styles.tileActions}>
                                        {mic && (
                                            <TouchableOpacity
                                                style={styles.tileActionBtn}
                                                onPress={() => muteStudent(p)}
                                            >
                                                <AppIcon name="microphone" size={11} color="#FFFFFF" />
                                            </TouchableOpacity>
                                        )}
                                        {camOn && (
                                            <TouchableOpacity
                                                style={styles.tileActionBtn}
                                                onPress={() => camOffStudent(p)}
                                            >
                                                <AppIcon name="video" size={11} color="#FFFFFF" />
                                            </TouchableOpacity>
                                        )}
                                        <TouchableOpacity
                                            style={[styles.tileActionBtn, styles.tileActionBtnDanger]}
                                            onPress={() => removeStudent(p)}
                                        >
                                            <AppIcon name="user-times" size={11} color="#FFFFFF" />
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* Fullscreen modal — works for the featured stream OR any tapped tile */}
            {renderChatNotification()}

            <Modal
                visible={!!fullscreenSource?.streamURL}
                transparent={false}
                animationType="fade"
                supportedOrientations={['portrait', 'landscape']}
                onRequestClose={() => setFullscreenSource(null)}
            >
                <View style={styles.fullscreenContainer}>
                    {fullscreenSource?.streamURL && (
                        <RTCView
                            streamURL={fullscreenSource.streamURL}
                            style={styles.fullscreenVideo}
                            objectFit={fullscreenSource.fit || 'contain'}
                            mirror={!!fullscreenSource.mirror}
                            zOrder={0}
                        />
                    )}
                    <View style={styles.fullscreenTopBar}>
                        <Text style={styles.fullscreenLabel} numberOfLines={1}>{fullscreenSource?.label || ''}</Text>
                        <TouchableOpacity
                            style={styles.fullscreenCloseBtn}
                            onPress={() => setFullscreenSource(null)}
                        >
                            <AppIcon name="compress" size={15} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>
                    {renderChatNotification(true)}
                </View>
            </Modal>

            {/* Class chat panel */}
            <LiveClassChat
                colors={colors}
                socket={liveSocket}
                roomId={roomId}
                visible={chatVisible}
                userId={user?.uid}
                name={myName}
                role={isTeacher ? 'teacher' : 'participant'}
                onClose={() => setChatVisible(false)}
                onUnreadChange={setUnreadChatCount}
            />

            {/* CONTROL BAR */}
            <View style={styles.controls}>
                <TouchableOpacity
                    style={[styles.ctrlBtn, !micOn && styles.ctrlBtnOff]}
                    onPress={toggleMic}
                >
                    <AppIcon name={micOn ? 'microphone' : 'microphone-slash'} size={18} color="#FFFFFF" />
                    <Text style={styles.ctrlLabel}>{micOn ? 'Mute' : 'Unmute'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.ctrlBtn, !cameraOn && styles.ctrlBtnOff]}
                    onPress={toggleCamera}
                >
                    <AppIcon name={cameraOn ? 'video' : 'video-slash'} size={18} color="#FFFFFF" />
                    <Text style={styles.ctrlLabel}>{cameraOn ? 'Stop Cam' : 'Start Cam'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.ctrlBtn, !speakerOn && styles.ctrlBtnOff]}
                    onPress={toggleSpeaker}
                >
                    <AppIcon name={speakerOn ? 'volume-up' : 'volume-mute'} size={18} color="#FFFFFF" />
                    <Text style={styles.ctrlLabel}>Speaker</Text>
                </TouchableOpacity>

                {isTeacher && (
                    <TouchableOpacity
                        style={styles.ctrlBtn}
                        onPress={() => {
                            if (!cls?.batchId) {
                                Toast.warning('This class is missing a batch link.', 'Cannot add note');
                                return;
                            }
                            navigation.navigate('AddNote', {
                                classId: cls.id,
                                batchId: cls.batchId,
                                batchName: cls.batchName,
                                disallowVideo: true,
                            });
                        }}
                    >
                        <AppIcon name="sticky-note" size={18} color="#FFFFFF" />
                        <Text style={styles.ctrlLabel}>Notes</Text>
                    </TouchableOpacity>
                )}

                <TouchableOpacity
                    style={[styles.ctrlBtn, isSharingScreen && styles.ctrlBtnActive]}
                    onPress={isSharingScreen ? stopScreenShare : startScreenShare}
                >
                    <AppIcon name="desktop" size={18} color="#FFFFFF" />
                    <Text style={styles.ctrlLabel}>{isSharingScreen ? 'Stop' : 'Share'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.ctrlBtn, styles.ctrlBtnEnd]}
                    onPress={handleEnd}
                >
                    <AppIcon name="phone" size={18} color="#FFFFFF" />
                    <Text style={styles.ctrlLabel}>{isTeacher ? 'End' : 'Leave'}</Text>
                </TouchableOpacity>
            </View>

            {/* Class-ended overlay (student view) */}
            {classEnded && (
                <View style={styles.endedOverlay}>
                    <View style={styles.endedCard}>
                        <View style={styles.endedIconBox}>
                            <AppIcon name="check-circle" size={42} color="#FFFFFF" />
                        </View>
                        <Text style={styles.endedTitle}>Class Ended</Text>
                        <Text style={styles.endedSub}>The teacher has ended the class. Thanks for joining.</Text>
                    </View>
                </View>
            )}
        </View>
    );
};

const makeStyles = (colors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0D0F1A' },
    topBar: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: SPACING.md, paddingTop: SPACING.xxxl, paddingBottom: SPACING.sm,
        backgroundColor: '#0D0F1A',
    },
    leaveBtn: {
        backgroundColor: colors.danger + '22', paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm, borderRadius: RADIUS.md,
    },
    leaveBtnText: { color: colors.danger, fontSize: SIZES.sm, fontWeight: '700' },
    leaveContent: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    topCenter: { flex: 1, alignItems: 'center' },
    headerChatBtn: {
        width: 44, height: 36, borderRadius: RADIUS.md,
        backgroundColor: '#2a2a2a',
        alignItems: 'center', justifyContent: 'center',
    },
    headerChatBtnActive: { backgroundColor: colors.primary },
    chatIconWrap: { position: 'relative' },
    chatBadge: {
        position: 'absolute', top: -8, right: -11,
        minWidth: 16, height: 16, borderRadius: 8,
        backgroundColor: colors.warning,
        alignItems: 'center', justifyContent: 'center',
        paddingHorizontal: 3,
    },
    chatBadgeText: { color: '#111111', fontSize: 9, fontWeight: '900' },
    chatNotification: {
        position: 'absolute',
        top: 112,
        right: SPACING.md,
        zIndex: 30,
        elevation: 30,
        maxWidth: 230,
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 7,
        borderRadius: RADIUS.md,
        backgroundColor: 'rgba(16,18,26,0.94)',
        borderWidth: 1,
        borderColor: colors.warning + '88',
    },
    chatNotificationFullscreen: {
        top: SPACING.xxxl + 56,
        right: SPACING.md,
        zIndex: 60,
        elevation: 60,
    },
    chatNotificationIcon: {
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.warning,
    },
    chatNotificationTextWrap: { flex: 1, minWidth: 0 },
    chatNotificationTitle: { color: '#FFFFFF', fontSize: SIZES.xs, fontWeight: '900' },
    chatNotificationSub: { color: '#D4D6E0', fontSize: 10, fontWeight: '700', marginTop: 1 },
    livePill: {
        backgroundColor: colors.primary, paddingHorizontal: SPACING.sm,
        paddingVertical: 2, borderRadius: RADIUS.full, marginBottom: 3,
    },
    liveText: { color: '#FFFFFF', fontSize: SIZES.xs, fontWeight: '800', letterSpacing: 1 },
    classTitle: { color: '#FFFFFF', fontSize: SIZES.md, fontWeight: '700', textAlign: 'center' },
    classSub: { color: '#888', fontSize: SIZES.xs, marginTop: 2 },

    pendingBox: {
        backgroundColor: '#1a1a1a', marginHorizontal: SPACING.md, borderRadius: RADIUS.lg,
        padding: SPACING.md, borderWidth: 1, borderColor: colors.warning + '44',
        marginBottom: SPACING.sm,
    },
    pendingTitle: { color: colors.warning, fontWeight: '800', fontSize: SIZES.md, marginBottom: SPACING.sm },
    pendingRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingVertical: SPACING.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#333',
    },
    pendingName: { color: '#FFFFFF', fontSize: SIZES.sm, fontWeight: '600', flex: 1, marginRight: SPACING.sm },
    approveBtn: { backgroundColor: colors.success, paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: RADIUS.sm },
    approveBtnText: { color: '#FFFFFF', fontSize: SIZES.xs, fontWeight: '700' },
    rejectBtn: { backgroundColor: colors.danger, paddingHorizontal: SPACING.md, paddingVertical: 6, borderRadius: RADIUS.sm },
    rejectBtnText: { color: '#FFFFFF', fontSize: SIZES.xs, fontWeight: '700' },

    mainArea: { flex: 1, paddingHorizontal: SPACING.md },
    featuredBox: {
        backgroundColor: '#000', borderRadius: RADIUS.lg, overflow: 'hidden',
        borderWidth: 2, borderColor: colors.primary, marginBottom: SPACING.sm,
    },
    featuredHeader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
        backgroundColor: '#1e1b4b',
    },
    featuredLabel: { color: '#FFFFFF', fontWeight: 'bold', fontSize: SIZES.sm, flex: 1 },
    featuredVideo: { width: '100%', height: 280, backgroundColor: '#000' },
    featuredHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    featuredIconBtn: {
        width: 30, height: 30, borderRadius: 15,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.14)',
    },
    fullscreenContainer: { flex: 1, backgroundColor: '#000000' },
    fullscreenVideo: { flex: 1, width: '100%', height: '100%', backgroundColor: '#000000' },
    fullscreenTopBar: {
        position: 'absolute', left: 0, right: 0, top: 0, zIndex: 5,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: SPACING.md,
        paddingTop: SPACING.xl, paddingBottom: SPACING.sm,
        backgroundColor: 'rgba(0,0,0,0.55)',
    },
    fullscreenLabel: {
        flex: 1, color: '#FFFFFF', fontSize: SIZES.sm, fontWeight: '800',
        marginRight: SPACING.md,
    },
    fullscreenCloseBtn: {
        width: 40, height: 40, borderRadius: 20,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.16)',
    },
    stopShareBtn: {
        backgroundColor: colors.danger, paddingHorizontal: SPACING.md,
        paddingVertical: 5, borderRadius: RADIUS.md,
    },
    stopShareBtnText: { color: '#FFFFFF', fontSize: SIZES.xs, fontWeight: 'bold' },
    placeholderBox: {
        height: 280, justifyContent: 'center', alignItems: 'center',
        padding: SPACING.lg,
    },
    placeholderEmoji: { fontSize: 56, marginBottom: SPACING.md },
    placeholderText: { color: '#FFFFFF', fontSize: SIZES.base, fontWeight: 'bold', marginBottom: SPACING.xs },
    placeholderSub: { color: '#777', fontSize: SIZES.sm, textAlign: 'center' },

    tilesStrip: { flexGrow: 0, marginTop: SPACING.xs },
    tilesStripContent: { gap: SPACING.sm, paddingVertical: SPACING.sm },
    tile: {
        width: 130, backgroundColor: '#1a1a1a',
        borderRadius: RADIUS.md, overflow: 'hidden',
        borderWidth: 1, borderColor: '#2a2a2a',
        position: 'relative',
    },
    tileVideo: { width: '100%', height: 100, backgroundColor: '#000' },
    tileFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary + '33' },
    tileInitial: { color: '#FFFFFF', fontSize: SIZES.xxl, fontWeight: '800' },
    tileFooter: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: SPACING.sm, paddingVertical: 4,
    },
    tileName: { color: '#FFFFFF', fontSize: SIZES.xs, fontWeight: '700', flex: 1, marginRight: 4 },
    tileBadges: { flexDirection: 'row', gap: 4 },
    selfFlipBtn: {
        position: 'absolute',
        top: 6,
        right: 6,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(0,0,0,0.72)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.22)',
    },
    selfFlipBtnDisabled: { opacity: 0.4 },
    tileActions: {
        position: 'absolute', top: 4, right: 4,
        flexDirection: 'column', gap: 4,
    },
    tileActionBtn: {
        width: 24, height: 24, borderRadius: 12,
        backgroundColor: 'rgba(0,0,0,0.7)',
        alignItems: 'center', justifyContent: 'center',
    },
    tileActionBtnDanger: { backgroundColor: colors.danger + 'CC' },

    controls: {
        flexDirection: 'row', justifyContent: 'space-around',
        paddingHorizontal: SPACING.sm, paddingVertical: SPACING.md,
        paddingBottom: SPACING.lg, backgroundColor: '#1a1a1a',
        borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#333',
    },
    ctrlBtn: {
        backgroundColor: '#2a2a2a',
        paddingHorizontal: SPACING.sm, paddingVertical: SPACING.sm,
        borderRadius: RADIUS.md, alignItems: 'center', minWidth: 56, gap: 3,
    },
    ctrlBtnOff: { backgroundColor: colors.danger + '88' },
    ctrlBtnActive: { backgroundColor: colors.primary, borderWidth: 2, borderColor: colors.primary },
    ctrlBtnEnd: { backgroundColor: colors.danger },
    ctrlLabel: { color: '#FFFFFF', fontSize: 9, fontWeight: '700' },

    toast: {
        flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
        backgroundColor: 'rgba(0,0,0,0.85)',
        paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
        marginHorizontal: SPACING.md, marginBottom: SPACING.sm,
        borderRadius: RADIUS.md, alignSelf: 'center',
    },
    toastText: { color: '#FFFFFF', fontSize: SIZES.xs, fontWeight: '600' },

    endedOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.85)',
        alignItems: 'center', justifyContent: 'center',
        padding: SPACING.xl,
    },
    endedCard: {
        backgroundColor: colors.surface,
        borderRadius: RADIUS.xl, padding: SPACING.xl,
        alignItems: 'center', maxWidth: 360,
        borderWidth: 1, borderColor: colors.border,
    },
    endedIconBox: {
        width: 72, height: 72, borderRadius: 36,
        backgroundColor: colors.success,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: SPACING.md,
    },
    endedTitle: {
        fontSize: SIZES.xxl, fontWeight: '900',
        color: colors.text, marginBottom: SPACING.xs, textAlign: 'center',
    },
    endedSub: {
        fontSize: SIZES.sm, color: colors.textMuted,
        textAlign: 'center', lineHeight: 20,
    },
});

export default LiveClass;
