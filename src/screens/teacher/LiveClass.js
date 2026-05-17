import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  Vibration,
  PermissionsAndroid,
  Modal,
  StatusBar,
  NativeModules,
  AppState,
  DeviceEventEmitter,
} from 'react-native';
import { StackActions, useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  RTCPeerConnection,
  RTCView,
  mediaDevices,
  RTCSessionDescription,
  RTCIceCandidate,
} from 'react-native-webrtc';
import io from 'socket.io-client';
import InCallManager from 'react-native-incall-manager';
import { SERVER_URL, ICE_SERVERS } from '../../config';
import { SIZES, SPACING, RADIUS } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';
import AppIcon from '../../components/AppIcon';
import LiveClassChat from '../../components/LiveClassChat';
import { useAuth } from '../../contexts/AuthContext';
import { useLiveClassPip } from '../../contexts/LiveClassPipContext';
import {
  endLiveClass,
  markStudentJoined,
} from '../../services/firestoreService';
import { Toast } from '../../components/Toast';
import { tsToDate } from '../../utils/format';

const Pip = NativeModules.StudivistaPip;
const VIDEO_CONTROLS_HIDE_DELAY_MS = 2000;

const setAutoPipEnabled = enabled => {
  if (Platform.OS !== 'android') return;
  try {
    Pip?.setAutoPipEnabled?.(enabled);
  } catch {}
};

const enterPip = () => {
  if (Platform.OS !== 'android') return;
  try {
    Pip?.enterPip?.();
  } catch {}
};

const setScreenOrientation = orientation => {
  if (Platform.OS !== 'android') return;
  try {
    Pip?.setOrientation?.(orientation);
  } catch {}
};

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
    return Object.values(granted).every(
      s => s === PermissionsAndroid.RESULTS.GRANTED,
    );
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

const tuneScreenShareSender = async sender => {
  if (!sender?.getParameters || !sender?.setParameters) return;
  try {
    const params = sender.getParameters() || {};
    params.degradationPreference = 'maintain-resolution';
    params.encodings = (params.encodings?.length ? params.encodings : [{}]).map(
      encoding => ({
        ...encoding,
        maxBitrate: 1400000,
        maxFramerate: 15,
      }),
    );
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
    console.warn(
      '[LiveClass] constrained screen capture failed, using default capture',
      err?.message,
    );
    return mediaDevices.getDisplayMedia({ video: true });
  }
};

// Helpers
const getInitial = name => (name || '?').charAt(0).toUpperCase();
const AVATAR_BG = [
  '#1d4e8a',
  '#793468',
  '#16a34a',
  '#b45309',
  '#7c3aed',
  '#0f766e',
];
const getAvatarColor = name =>
  AVATAR_BG[(name || '?').charCodeAt(0) % AVATAR_BG.length];
const isHostRole = role =>
  role === 'host' || role === 'teacher' || role === 'admin';

// ─────────────────────────────────────────────────────────────────────────────
const SPEAKING_AUDIO_LEVEL = 0.015;

const getStatsReports = stats => {
  if (!stats) return [];
  if (Array.isArray(stats)) return stats;
  const reports = [];
  if (typeof stats.forEach === 'function') {
    stats.forEach(report => reports.push(report));
    return reports;
  }
  return Object.values(stats);
};

const hasVoiceActivity = (stats, direction) =>
  getStatsReports(stats).some(report => {
    const type = report?.type;
    const isAudio =
      report?.kind === 'audio' ||
      report?.mediaType === 'audio' ||
      report?.trackKind === 'audio';
    const isExpectedDirection =
      direction === 'local'
        ? type === 'media-source' || type === 'outbound-rtp' || type === 'track'
        : type === 'inbound-rtp' || type === 'track';
    const level = Number(report?.audioLevel);
    return isAudio && isExpectedDirection && level > SPEAKING_AUDIO_LEVEL;
  });

const formatClassRunTime = totalSeconds => {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds || 0));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  const pad = n => String(n).padStart(2, '0');
  return hours > 0
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
};

const LiveClass = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { user, profile } = useAuth();
  const isFocused = useIsFocused();
  const { updateLiveClassPip, clearLiveClassPip } = useLiveClassPip();

  const cls = useMemo(() => route?.params?.cls || {}, [route?.params?.cls]);
  const passedSocket = route?.params?.socket;
  const roomId = route?.params?.roomId || cls.id;
  const role = route?.params?.role || profile?.role || 'student';
  const isTeacher =
    isHostRole(role) ||
    profile?.role === 'teacher' ||
    profile?.role === 'admin';
  const myName = route?.params?.name || profile?.name || 'User';

  // ── Refs ──
  const socketRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const peerConnections = useRef({});
  const iceCandidateBuffer = useRef({});
  const remoteDescSet = useRef({});
  const connectedPeers = useRef(new Set());
  const screenSharerIdRef = useRef(null);
  const remoteStreamsRef = useRef({});
  const isLeavingRef = useRef(false);
  const isFocusedRef = useRef(false);
  const classEndedRef = useRef(false);
  const isTeacherRef = useRef(isTeacher);
  const liveNoticeTimerRef = useRef(null);
  const liveStartedAtRef = useRef(
    tsToDate(
      cls.startedAt || cls.started_at || route?.params?.startedAt,
    )?.getTime() || Date.now(),
  );

  // ── State ──
  const [status, setStatus] = useState('Connecting...');
  const [localStreamURL, setLocalStreamURL] = useState(null);
  const [micOn, setMicOn] = useState(false);
  const [localSpeaking, setLocalSpeaking] = useState(false);
  const [speakingPeerIds, setSpeakingPeerIds] = useState({});
  const [cameraOn, setCameraOn] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [handRaised, setHandRaised] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);

  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [senderScreenURL, setSenderScreenURL] = useState(null);
  const [screenSharerName, setScreenSharerName] = useState('');
  const [screenShareStreamURL, setScreenShareStreamURL] = useState(null);
  const [screenShareRequestPending, setScreenShareRequestPending] =
    useState(false);

  const [pendingJoins, setPendingJoins] = useState([]);
  const [pendingScreenShares, setPendingScreenShares] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [remoteStreamURLs, setRemoteStreamURLs] = useState({});
  const [leftToast, setLeftToast] = useState(null);
  const [liveNotice, setLiveNotice] = useState(null);
  const [classEnded, setClassEnded] = useState(false);
  const [liveSocket, setLiveSocket] = useState(null);
  const [chatVisible, setChatVisible] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [pinnedFeaturedSource, setPinnedFeaturedSource] = useState(null);
  const [videoControlsVisible, setVideoControlsVisible] = useState(true);
  const [fullscreenSource, setFullscreenSource] = useState(null);
  const [fullscreenControlsVisible, setFullscreenControlsVisible] =
    useState(true);
  const [fullscreenLandscape, setFullscreenLandscape] = useState(false);
  const [nativePipActive, setNativePipActive] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(() =>
    Math.floor((Date.now() - liveStartedAtRef.current) / 1000),
  );

  const micOnRef = useRef(false);
  const cameraOnRef = useRef(false);
  useEffect(() => {
    micOnRef.current = micOn;
  }, [micOn]);
  useEffect(() => {
    cameraOnRef.current = cameraOn;
  }, [cameraOn]);
  const isSharingScreenRef = useRef(false);
  useEffect(() => {
    isSharingScreenRef.current = isSharingScreen;
  }, [isSharingScreen]);
  useEffect(() => {
    isFocusedRef.current = isFocused;
  }, [isFocused]);
  useEffect(() => {
    classEndedRef.current = classEnded;
  }, [classEnded]);
  useEffect(() => {
    isTeacherRef.current = isTeacher;
  }, [isTeacher]);
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket?.connected || !roomId) return;
    socket.emit('join-room', {
      roomId,
      name: myName,
      role: isTeacher ? 'host' : 'participant',
    });
  }, [isTeacher, myName, roomId]);

  const showLiveNotice = useCallback(notice => {
    if (!notice?.message) return;
    setLiveNotice(notice);
    if (liveNoticeTimerRef.current) clearTimeout(liveNoticeTimerRef.current);
    liveNoticeTimerRef.current = setTimeout(() => {
      setLiveNotice(null);
      liveNoticeTimerRef.current = null;
    }, 3500);
  }, []);

  useEffect(
    () => () => {
      if (liveNoticeTimerRef.current) clearTimeout(liveNoticeTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    const updateElapsed = () => {
      setElapsedSeconds(
        Math.floor((Date.now() - liveStartedAtRef.current) / 1000),
      );
    };
    updateElapsed();
    if (classEnded) return undefined;
    const timer = setInterval(updateElapsed, 1000);
    return () => clearInterval(timer);
  }, [classEnded]);

  useEffect(() => {
    if (!videoControlsVisible) return undefined;
    const timer = setTimeout(
      () => setVideoControlsVisible(false),
      VIDEO_CONTROLS_HIDE_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [videoControlsVisible]);

  const showVideoControls = useCallback(() => {
    setVideoControlsVisible(true);
  }, []);

  useEffect(() => {
    if (!fullscreenSource?.streamURL) {
      setFullscreenControlsVisible(true);
      return undefined;
    }
    setFullscreenControlsVisible(true);
    return undefined;
  }, [fullscreenSource?.streamURL]);

  useEffect(() => {
    if (!fullscreenSource?.streamURL || !fullscreenControlsVisible) {
      return undefined;
    }
    const timer = setTimeout(
      () => setFullscreenControlsVisible(false),
      VIDEO_CONTROLS_HIDE_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [fullscreenControlsVisible, fullscreenSource?.streamURL]);

  const showFullscreenControls = useCallback(() => {
    setFullscreenControlsVisible(true);
  }, []);

  useEffect(() => {
    if (classEnded) return undefined;
    let cancelled = false;

    const checkSpeaking = async () => {
      try {
        const mediaEntries = Object.entries(peerConnections.current).filter(
          ([key]) => key.startsWith('media_'),
        );
        let nextLocalSpeaking = false;

        if (micOn && mediaEntries.length > 0) {
          for (const [, pc] of mediaEntries) {
            if (!pc?.getStats) continue;
            try {
              const stats = await pc.getStats();
              if (hasVoiceActivity(stats, 'local')) {
                nextLocalSpeaking = true;
                break;
              }
            } catch {}
          }
        }

        const nextSpeakingPeers = {};
        await Promise.all(
          participants.map(async participant => {
            if (participant.micOn === false) return;
            const pc = peerConnections.current[`media_${participant.id}`];
            if (!pc?.getStats) return;
            try {
              const stats = await pc.getStats();
              if (hasVoiceActivity(stats, 'remote')) {
                nextSpeakingPeers[participant.id] = true;
              }
            } catch {}
          }),
        );

        if (!cancelled) {
          setLocalSpeaking(nextLocalSpeaking);
          setSpeakingPeerIds(nextSpeakingPeers);
        }
      } catch {
        if (!cancelled) {
          setLocalSpeaking(false);
          setSpeakingPeerIds({});
        }
      }
    };

    checkSpeaking();
    const timer = setInterval(checkSpeaking, 650);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [classEnded, micOn, participants]);

  useEffect(() => () => clearLiveClassPip(), [clearLiveClassPip]);

  useEffect(() => {
    const enabled = isFocused && !classEnded && !isLeavingRef.current;
    setAutoPipEnabled(enabled);
    return () => setAutoPipEnabled(false);
  }, [classEnded, isFocused]);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const sub = AppState.addEventListener('change', nextState => {
      if (
        nextState === 'background' &&
        isFocusedRef.current &&
        !isLeavingRef.current &&
        !classEndedRef.current
      ) {
        enterPip();
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const sub = DeviceEventEmitter.addListener(
      'StudivistaPipModeChanged',
      value => setNativePipActive(value === true),
    );
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (isTeacher) return undefined;
    return navigation.addListener('beforeRemove', event => {
      if (isLeavingRef.current || classEnded) return;
      event.preventDefault();
      navigation.dispatch(StackActions.push('StudentDashboard'));
      Toast.info('Live class is running in mini view.', 'Mini view');
    });
  }, [classEnded, isTeacher, navigation]);

  // ─────────────────────────────────────────────────────────────────────
  const setRemoteStream = (peerId, stream) => {
    remoteStreamsRef.current[peerId] = stream;
    setRemoteStreamURLs(prev => ({ ...prev, [peerId]: stream.toURL() }));
  };
  const dropRemoteStream = peerId => {
    delete remoteStreamsRef.current[peerId];
    setRemoteStreamURLs(prev => {
      const next = { ...prev };
      delete next[peerId];
      return next;
    });
  };

  const sendMediaState = overrides => {
    socketRef.current?.emit('media-state', {
      micOn: overrides?.micOn ?? micOnRef.current,
      cameraOn: overrides?.cameraOn ?? cameraOnRef.current,
    });
  };

  const createMediaPC = peerId => {
    const key = `media_${peerId}`;
    if (peerConnections.current[key]) {
      try {
        peerConnections.current[key].close();
      } catch {}
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
          console.warn(
            '[LiveClass] addTrack failed for peer',
            peerId,
            t.kind,
            err?.message,
          );
        }
      });
    } else {
      console.warn(
        '[LiveClass] createMediaPC: localStreamRef is null, peer will get no media',
      );
    }
    pc.ontrack = event => {
      try {
        const stream = event.streams?.[0];
        if (stream) setRemoteStream(peerId, stream);
      } catch (err) {
        console.warn(
          '[LiveClass] ontrack handler failed',
          peerId,
          err?.message,
        );
      }
    };
    pc.onicecandidate = e => {
      if (e.candidate) {
        socketRef.current?.emit('ice-candidate', {
          to: peerId,
          candidate: e.candidate,
        });
      }
    };
    pc.oniceconnectionstatechange = () => {
      console.log('[LiveClass] media ICE state', peerId, pc.iceConnectionState);
    };
    return pc;
  };

  const sendMediaOfferTo = async peerId => {
    try {
      const pc = createMediaPC(peerId);
      await new Promise(r =>
        setTimeout(r, Platform.OS === 'android' ? 200 : 50),
      );
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current?.emit('offer', { to: peerId, offer });
    } catch (err) {
      console.warn(
        '[LiveClass] sendMediaOfferTo failed for',
        peerId,
        err?.message,
      );
    }
  };

  const sendScreenOfferTo = async (socket, peerId) => {
    if (!screenStreamRef.current) return;
    const key = `screen_${peerId}`;
    if (peerConnections.current[key]) {
      try {
        peerConnections.current[key].close();
      } catch {}
    }
    const pc = new RTCPeerConnection(ICE_SERVERS);
    peerConnections.current[key] = pc;
    iceCandidateBuffer.current[key] = [];
    remoteDescSet.current[key] = false;

    screenStreamRef.current.getTracks().forEach(t => {
      const sender = pc.addTrack(t, screenStreamRef.current);
      if (t.kind === 'video') tuneScreenShareSender(sender);
    });
    pc.onicecandidate = e => {
      if (e.candidate)
        socket.emit('screen-ice-candidate', {
          to: peerId,
          candidate: e.candidate,
        });
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
        Toast.error(
          'Camera and microphone access is required for live class.',
          'Permissions needed',
        );
        clearLiveClassPip();
        setTimeout(() => navigation.goBack(), 1500);
        return;
      }

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
        stream.getAudioTracks?.().forEach(t => {
          t.enabled = false;
        });
        stream.getVideoTracks?.().forEach(t => {
          t.enabled = false;
        });
        localStreamRef.current = stream;
        setLocalStreamURL(stream.toURL());
      } catch (e) {
        Toast.error(
          e?.message || 'Could not access camera or mic.',
          'Camera/Mic error',
        );
        clearLiveClassPip();
        setTimeout(() => navigation.goBack(), 1500);
        return;
      }

      try {
        InCallManager.start({ media: 'video' });
        InCallManager.setSpeakerphoneOn(true);
        InCallManager.setKeepScreenOn(true);
      } catch {}

      const token = await AsyncStorage.getItem('sv_token');
      const socket =
        passedSocket ||
        io(SERVER_URL, {
          transports: ['websocket'],
          auth: { token },
        });
      socketRef.current = socket;
      setLiveSocket(socket);

      const onConnected = () => {
        setStatus('Connected · ' + roomId);
        socket.emit('join-room', {
          roomId,
          name: myName,
          role: isTeacherRef.current ? 'host' : 'participant',
        });
        setTimeout(
          () => sendMediaState({ micOn: false, cameraOn: false }),
          300,
        );
      };
      if (socket.connected) {
        onConnected();
      } else {
        socket.on('connect', onConnected);
      }

      socket.on('connect_error', err => setStatus('Error: ' + err.message));
      socket.on('disconnect', () => setStatus('Disconnected'));

      socket.on('room-users', ({ users }) => {
        if (Array.isArray(users)) {
          users.forEach(id => {
            if (id !== socket.id) connectedPeers.current.add(id);
          });
        }
      });

      socket.on('existing-users', users => {
        console.log('[LiveClass] existing-users:', users?.length || 0);
        if (!Array.isArray(users)) return;
        const existing = users.filter(u => u?.userId && u.userId !== socket.id);
        existing.forEach(u => connectedPeers.current.add(u.userId));
        setParticipants(prev => {
          const seen = new Set(prev.map(p => p.id));
          const added = existing
            .filter(u => !seen.has(u.userId))
            .map(u => ({
              id: u.userId,
              name: u.name || 'User',
              role: u.userRole,
              micOn: false,
              cameraOn: false,
              handRaised: !!u.handRaised,
            }));
          return [...added, ...prev];
        });
        if (!localStreamRef.current) {
          console.warn(
            '[LiveClass] existing-users fired but local stream not ready yet',
          );
        }
        existing.forEach(u => sendMediaOfferTo(u.userId));
      });

      socket.on('user-joined', ({ userId, userRole, name }) => {
        if (!userId || userId === socket.id) return;
        connectedPeers.current.add(userId);
        setParticipants(prev => {
          if (prev.find(p => p.id === userId)) return prev;
          return [
            {
              id: userId,
              name: name || 'Student',
              role: userRole,
              micOn: false,
              cameraOn: false,
              handRaised: false,
            },
            ...prev,
          ];
        });
        if (isTeacherRef.current && !isHostRole(userRole)) {
          Vibration.vibrate(50);
        }
        setTimeout(() => sendMediaState(), 500);
        if (isSharingScreenRef.current && screenStreamRef.current) {
          sendScreenOfferTo(socket, userId);
          socket.emit('screen-share-started', { roomId, sharerName: myName });
        }
      });

      socket.on('user-left', ({ userId, name }) => {
        connectedPeers.current.delete(userId);
        ['media', 'screen'].forEach(prefix => {
          const key = `${prefix}_${userId}`;
          if (peerConnections.current[key]) {
            try {
              peerConnections.current[key].close();
            } catch {}
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
        setPendingScreenShares(prev => prev.filter(p => p.from !== userId));
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

      socket.on('class-ended', () => {
        if (isTeacherRef.current) return;
        isLeavingRef.current = true;
        setAutoPipEnabled(false);
        clearLiveClassPip();
        setClassEnded(true);
        setTimeout(() => navigation.goBack(), 2500);
      });

      socket.on('pending-join', ({ from, name }) => {
        if (!isTeacherRef.current) return;
        setPendingJoins(prev => {
          if (prev.find(p => p.from === from)) return prev;
          Vibration.vibrate(
            Platform.OS === 'android' ? [0, 200, 100, 200] : 400,
          );
          return [...prev, { from, name }];
        });
      });

      socket.on('media-state', ({ from, micOn: m, cameraOn: c }) => {
        setParticipants(prev =>
          prev.map(p =>
            p.id === from ? { ...p, micOn: !!m, cameraOn: !!c } : p,
          ),
        );
      });

      socket.on('hand-raise', ({ from, name, raised }) => {
        if (from === socket.id) {
          setHandRaised(!!raised);
          return;
        }
        setParticipants(prev =>
          prev.map(p => (p.id === from ? { ...p, handRaised: !!raised } : p)),
        );
        if (isTeacherRef.current && raised) {
          Vibration.vibrate(Platform.OS === 'android' ? 80 : 40);
          // showLiveNotice({
          //   type: 'hand',
          //   icon: 'hand-paper',
          //   title: 'Hand raised',
          //   message: `${name || 'Student'} raised their hand`,
          // });
          Toast.info(`${name || 'Student'} raised their hand.`, 'Hand raised');
        }
      });

      socket.on('force-mute', () => {
        const t = localStreamRef.current?.getAudioTracks?.()[0];
        if (t) t.enabled = false;
        setMicOn(false);
        if (!isTeacherRef.current)
          Toast.warning('The teacher has muted your microphone.', 'Muted');
        sendMediaState({ micOn: false });
      });
      socket.on('force-camera-off', () => {
        const t = localStreamRef.current?.getVideoTracks?.()[0];
        if (t) t.enabled = false;
        setCameraOn(false);
        if (!isTeacherRef.current)
          Toast.warning(
            'The teacher has turned off your camera.',
            'Camera off',
          );
        sendMediaState({ cameraOn: false });
      });
      socket.on('force-remove', () => {
        if (isTeacherRef.current) return;
        isLeavingRef.current = true;
        setAutoPipEnabled(false);
        clearLiveClassPip();
        Toast.error('You have been removed from the class.', 'Removed');
        setTimeout(() => navigation.goBack(), 2000);
      });

      socket.on('offer', async ({ from, offer }) => {
        console.log('[LiveClass] received offer from', from);
        try {
          const key = `media_${from}`;
          let pc = peerConnections.current[key];
          if (!pc) pc = createMediaPC(from);
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          remoteDescSet.current[key] = true;
          for (const c of iceCandidateBuffer.current[key] || []) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(c));
            } catch {}
          }
          iceCandidateBuffer.current[key] = [];
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('answer', { to: from, answer });
        } catch (err) {
          console.warn(
            '[LiveClass] offer handler failed for',
            from,
            err?.message,
          );
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
            try {
              await pc.addIceCandidate(new RTCIceCandidate(c));
            } catch {}
          }
          iceCandidateBuffer.current[key] = [];
        } catch (err) {
          console.warn(
            '[LiveClass] answer handler failed for',
            from,
            err?.message,
          );
        }
      });

      socket.on('ice-candidate', async ({ from, candidate }) => {
        try {
          const key = `media_${from}`;
          const pc = peerConnections.current[key];
          if (pc && remoteDescSet.current[key]) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } else {
            iceCandidateBuffer.current[key] =
              iceCandidateBuffer.current[key] || [];
            iceCandidateBuffer.current[key].push(candidate);
          }
        } catch (err) {
          console.warn(
            '[LiveClass] ice-candidate handler failed for',
            from,
            err?.message,
          );
        }
      });

      socket.on('screen-share-started', ({ sharerId, sharerName: sName }) => {
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

      const handleScreenSharePermissionRequest = ({ from, name }) => {
        if (!isTeacherRef.current || !from || from === socket.id) return;
        setPendingScreenShares(prev => {
          if (prev.find(p => p.from === from)) return prev;
          Vibration.vibrate(
            Platform.OS === 'android' ? [0, 160, 80, 160] : 350,
          );
          Toast.show({
            type: 'info',
            title: 'Screen share request',
            message: `${name || 'Student'} wants to share screen`,
            duration: 4500,
          });
          return [...prev, { from, name: name || 'Student' }];
        });
      };

      socket.on(
        'screen-share-permission-requested',
        handleScreenSharePermissionRequest,
      );
      socket.on(
        'screen-share-request-pending',
        handleScreenSharePermissionRequest,
      );
      socket.on(
        'screen-share-approval-request',
        handleScreenSharePermissionRequest,
      );

      socket.on('screen-share-approved', () => {
        if (isTeacherRef.current) return;
        setScreenShareRequestPending(false);
        Toast.success('Teacher approved screen share.', 'Approved');
        startScreenShare({ approved: true });
      });

      socket.on('screen-share-rejected', () => {
        if (isTeacherRef.current) return;
        setScreenShareRequestPending(false);
        Toast.warning('Teacher rejected screen share.', 'Request rejected');
      });

      socket.on(
        'screen-share-request',
        async ({ from, approvalRequest, name }) => {
          if (approvalRequest) {
            handleScreenSharePermissionRequest({ from, name });
            return;
          }
          await sendScreenOfferTo(socket, from);
        },
      );

      socket.on('screen-offer', async ({ from, offer }) => {
        const key = `screen_${from}`;
        if (peerConnections.current[key]) {
          try {
            peerConnections.current[key].close();
          } catch {}
        }
        const pc = new RTCPeerConnection(ICE_SERVERS);
        peerConnections.current[key] = pc;
        iceCandidateBuffer.current[key] = [];
        remoteDescSet.current[key] = false;

        pc.ontrack = event => {
          const stream = event.streams?.[0];
          if (stream) setScreenShareStreamURL(stream.toURL());
        };
        pc.onicecandidate = e => {
          if (e.candidate)
            socket.emit('screen-ice-candidate', {
              to: from,
              candidate: e.candidate,
            });
        };
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        remoteDescSet.current[key] = true;
        for (const c of iceCandidateBuffer.current[key] || []) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(c));
          } catch {}
        }
        iceCandidateBuffer.current[key] = [];
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('screen-answer', { to: from, answer });
      });

      socket.on('screen-answer', async ({ from, answer }) => {
        const pc = peerConnections.current[`screen_${from}`];
        if (pc)
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
      });

      socket.on('screen-ice-candidate', async ({ from, candidate }) => {
        const key = `screen_${from}`;
        const pc = peerConnections.current[key];
        if (pc && remoteDescSet.current[key]) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch {}
        } else {
          iceCandidateBuffer.current[key] =
            iceCandidateBuffer.current[key] || [];
          iceCandidateBuffer.current[key].push(candidate);
        }
      });

      if (!isTeacher && cls?.id && user?.uid) {
        markStudentJoined(cls.id, user.uid).catch(() => {});
      }
    })();

    return () => {
      cancelled = true;
      try {
        InCallManager.stop();
      } catch {}
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      Object.values(peerConnections.current).forEach(pc => {
        try {
          pc.close();
        } catch {}
      });
      peerConnections.current = {};
      iceCandidateBuffer.current = {};
      remoteDescSet.current = {};
      connectedPeerIds.clear();
      remoteStreamsRef.current = {};
      try {
        socketRef.current?.disconnect();
      } catch {}
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
    try {
      InCallManager.setSpeakerphoneOn(next);
    } catch {}
    setSpeakerOn(next);
  };
  const toggleHandRaise = () => {
    const next = !handRaised;
    setHandRaised(next);
    socketRef.current?.emit('hand-raise', {
      roomId,
      raised: next,
      name: myName,
    });
  };

  // ── Screen share ──
  const startScreenShare = async ({ approved = false } = {}) => {
    if (!isTeacher && !approved) {
      if (screenShareRequestPending) {
        Toast.info('Screen share request is waiting for teacher approval.');
        return;
      }
      setScreenShareRequestPending(true);
      const requestPayload = {
        roomId,
        name: myName,
      };
      socketRef.current?.emit(
        'screen-share-permission-request',
        requestPayload,
      );
      socketRef.current?.emit('screen-share-request-pending', requestPayload);
      socketRef.current?.emit('screen-share-approval-request', requestPayload);
      participants
        .filter(p => isHostRole(p.role))
        .forEach(p => {
          socketRef.current?.emit('screen-share-request', {
            to: p.id,
            ...requestPayload,
            approvalRequest: true,
          });
        });
      Toast.info('Request sent to teacher.', 'Screen share');
      return;
    }

    try {
      const screenStream = await getScreenShareStream();
      screenStreamRef.current = screenStream;
      setSenderScreenURL(screenStream.toURL());
      setIsSharingScreen(true);
      screenSharerIdRef.current = socketRef.current?.id;
      setScreenSharerName(myName);
      socketRef.current?.emit('screen-share-started', {
        roomId,
        sharerName: myName,
      });
      const peers = Array.from(connectedPeers.current);
      await Promise.allSettled(
        peers.map(peerId => sendScreenOfferTo(socketRef.current, peerId)),
      );
      screenStream.getTracks()[0].onended = () => stopScreenShare();
    } catch (e) {
      if (e.message !== 'Screen share cancelled') {
        Toast.error(
          e.message || 'Could not start screen share.',
          'Screen Share Error',
        );
      }
      setScreenShareRequestPending(false);
    }
  };
  const stopScreenShareInternal = () => {
    setScreenShareRequestPending(false);
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    setSenderScreenURL(null);
    setIsSharingScreen(false);
    Object.keys(peerConnections.current)
      .filter(k => k.startsWith('screen_'))
      .forEach(k => {
        try {
          peerConnections.current[k].close();
        } catch {}
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
  const approveJoin = peer => {
    socketRef.current?.emit('approve-join', { to: peer.from, roomId });
    setPendingJoins(prev => prev.filter(p => p.from !== peer.from));
  };
  const rejectJoin = peer => {
    socketRef.current?.emit('reject-join', { to: peer.from, roomId });
    setPendingJoins(prev => prev.filter(p => p.from !== peer.from));
  };

  // ── Teacher → student controls ──
  const approveScreenShare = peer => {
    socketRef.current?.emit('approve-screen-share', { to: peer.from, roomId });
    setPendingScreenShares(prev => prev.filter(p => p.from !== peer.from));
    Toast.success(`${peer.name || 'Student'} can share screen.`, 'Approved');
  };

  const rejectScreenShare = peer => {
    socketRef.current?.emit('reject-screen-share', { to: peer.from, roomId });
    setPendingScreenShares(prev => prev.filter(p => p.from !== peer.from));
    Toast.info('Screen share request rejected.');
  };

  const muteStudent = p =>
    socketRef.current?.emit('mute-student', { studentId: p.id });
  const camOffStudent = p =>
    socketRef.current?.emit('camera-off-student', { studentId: p.id });
  const removeStudent = p => {
    Alert.alert(
      'Remove student?',
      `Remove ${p.name || 'this student'} from the class?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            socketRef.current?.emit('remove-student', {
              studentId: p.id,
              roomId,
            });
            setParticipants(prev => prev.filter(x => x.id !== p.id));
          },
        },
      ],
    );
  };

  // ── End ──
  const handleEnd = () => {
    Alert.alert(
      isTeacher ? 'End class?' : 'Leave class?',
      isTeacher
        ? 'This will end the class for all students.'
        : 'You will leave the class.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: isTeacher ? 'End' : 'Leave',
          style: 'destructive',
          onPress: async () => {
            isLeavingRef.current = true;
            setAutoPipEnabled(false);
            clearLiveClassPip();
            if (isSharingScreen) stopScreenShare();
            if (isTeacher) {
              socketRef.current?.emit('class-ended', { roomId });
              if (cls?.id) {
                try {
                  await endLiveClass(cls.id);
                } catch {}
              }
            }
            navigation.goBack();
          },
        },
      ],
    );
  };

  // ── Render derivations ──
  const teacherInRoom = participants.find(
    p => p.role === 'host' || p.role === 'teacher',
  );
  const teacherCameraOn = !!teacherInRoom && teacherInRoom.cameraOn === true;
  const teacherStreamURL =
    teacherCameraOn && teacherInRoom
      ? remoteStreamURLs[teacherInRoom.id]
      : null;
  const screenFeaturedSource = screenShareStreamURL
    ? {
        streamURL: screenShareStreamURL,
        label: screenSharerName || 'Screen Share',
        fit: 'contain',
        mirror: false,
        kind: 'screen',
      }
    : isSharingScreen && senderScreenURL
    ? {
        streamURL: senderScreenURL,
        label: 'Your Screen',
        fit: 'contain',
        mirror: false,
        kind: 'screen',
      }
    : null;
  const teacherFeaturedSource = teacherStreamURL
    ? {
        streamURL: teacherStreamURL,
        label: teacherInRoom?.name || 'Teacher',
        fit: 'cover',
        mirror: false,
        kind: 'camera',
      }
    : null;
  const featuredSource =
    screenFeaturedSource || pinnedFeaturedSource || teacherFeaturedSource;
  const featuredStreamURL = featuredSource?.streamURL || null;
  const featuredLabel = featuredSource?.label || '';
  const featuredFit = featuredSource?.fit || 'cover';
  const featuredMirror = !!featuredSource?.mirror;
  const isScreenMode = featuredSource?.kind === 'screen';
  const defaultScreenPipSource = localStreamURL
    ? {
        streamURL: cameraOn ? localStreamURL : null,
        label: `${myName} (You)`,
        fit: 'cover',
        mirror: isFrontCamera,
        kind: 'camera',
      }
    : null;
  const screenPipSource =
    isScreenMode && pinnedFeaturedSource?.kind === 'camera'
      ? pinnedFeaturedSource
      : isScreenMode
      ? defaultScreenPipSource
      : null;
  const pipStreamURL = featuredStreamURL;
  const mainDisplayLabel = featuredLabel || 'You are live';
  const classRunTimeLabel = formatClassRunTime(elapsedSeconds);

  useEffect(() => {
    updateLiveClassPip({
      active: !classEnded,
      visible: !isFocused && !isLeavingRef.current && !classEnded,
      streamURL: pipStreamURL,
      label: mainDisplayLabel,
      placeholderText: mainDisplayLabel,
      sourceKind: featuredSource?.kind || 'fallback',
      fit: featuredStreamURL ? featuredFit : 'cover',
      mirror: featuredMirror,
      routeParams: {
        cls,
        roomId,
        role,
        name: myName,
      },
    });
  }, [
    classEnded,
    cls,
    featuredFit,
    featuredLabel,
    featuredMirror,
    featuredStreamURL,
    featuredSource?.kind,
    isFocused,
    isTeacher,
    mainDisplayLabel,
    myName,
    pipStreamURL,
    role,
    roomId,
    updateLiveClassPip,
  ]);

  useEffect(() => {
    if (!fullscreenSource) return;
    const { streamURL } = fullscreenSource;
    const stillValid =
      streamURL === featuredStreamURL ||
      streamURL === localStreamURL ||
      Object.values(remoteStreamURLs).includes(streamURL);
    if (!stillValid) setFullscreenSource(null);
  }, [fullscreenSource, featuredStreamURL, localStreamURL, remoteStreamURLs]);

  useEffect(() => {
    if (!fullscreenSource?.streamURL) {
      setScreenOrientation('unspecified');
      setFullscreenLandscape(false);
      return;
    }
    setScreenOrientation(fullscreenLandscape ? 'landscape' : 'unspecified');
    return () => setScreenOrientation('unspecified');
  }, [fullscreenLandscape, fullscreenSource?.streamURL]);

  useEffect(() => {
    if (!pinnedFeaturedSource) return;
    const { streamURL } = pinnedFeaturedSource;
    const stillValid =
      streamURL === localStreamURL ||
      Object.values(remoteStreamURLs).includes(streamURL);
    if (!stillValid) setPinnedFeaturedSource(null);
  }, [localStreamURL, pinnedFeaturedSource, remoteStreamURLs]);

  const closeFullscreen = useCallback(() => {
    setFullscreenSource(null);
    setFullscreenLandscape(false);
    setScreenOrientation('unspecified');
  }, []);

  const rotateFullscreen = useCallback(() => {
    setFullscreenLandscape(prev => !prev);
  }, []);

  const openChat = useCallback(() => {
    setFullscreenSource(null);
    setChatVisible(true);
    setUnreadChatCount(0);
    setLiveNotice(null);
  }, []);

  const handleIncomingChatMessage = useCallback(
    message => {
      if (chatVisible) return;
      Vibration.vibrate(Platform.OS === 'android' ? 60 : 35);
      showLiveNotice({
        type: 'chat',
        icon: 'comments',
        title: 'New chat message',
        message: `${message.senderName || 'User'}: ${
          message.text || 'Attachment'
        }`,
      });
    },
    [chatVisible, showLiveNotice],
  );

  useEffect(() => {
    if (chatVisible || unreadChatCount <= 0) return;
    Toast.show({
      type: 'info',
      title: 'New message',
      message: `${
        unreadChatCount > 9 ? '9+' : unreadChatCount
      } unread in class chat`,
      actionLabel: 'Open',
      onAction: openChat,
      duration: 4500,
    });
  }, [chatVisible, openChat, unreadChatCount]);

  const minimizeLiveClass = () => {
    navigation.dispatch(
      StackActions.push(isTeacher ? 'TeacherDashboard' : 'StudentDashboard'),
    );
    Toast.info('Live class is running in mini view.', 'Mini view');
  };

  // ─────────────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────────────────────────────────
  if (nativePipActive) {
    return (
      <View style={styles.nativePipContainer}>
        {featuredStreamURL ? (
          <RTCView
            streamURL={featuredStreamURL}
            style={styles.nativePipVideo}
            objectFit={featuredFit}
            mirror={featuredMirror}
            zOrder={1}
          />
        ) : (
          <View style={styles.nativePipFallback}>
            <AppIcon name="video" size={24} color="#FFFFFF" />
            <Text style={styles.nativePipTitle} numberOfLines={1}>
              {mainDisplayLabel}
            </Text>
          </View>
        )}
        <View style={styles.nativePipBadge}>
          <View style={styles.nativePipDot} />
          <Text style={styles.nativePipBadgeText}>LIVE</Text>
        </View>
        {!!featuredStreamURL && (
          <View style={styles.nativePipLabel}>
            <Text style={styles.nativePipLabelText} numberOfLines={1}>
              {mainDisplayLabel}
            </Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#060d16" />

      {/* ── TOP BAR ─────────────────────────────────────── */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={styles.leaveBtn}
          onPress={handleEnd}
          activeOpacity={0.8}
        >
          <AppIcon name="times" size={11} color={colors.danger} />
          <Text style={styles.leaveBtnText}>{isTeacher ? 'End' : 'Leave'}</Text>
        </TouchableOpacity>

        <View style={styles.topCenter}>
          <View style={styles.livePill}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>LIVE</Text>
          </View>
          <Text style={styles.classTitle} numberOfLines={1}>
            {cls.title || 'Live Class'}
          </Text>
          <Text style={styles.classSub}>
            {participants.length + 1} participants - {classRunTimeLabel}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.chatBtn, chatVisible && styles.chatBtnActive]}
            onPress={() => (chatVisible ? setChatVisible(false) : openChat())}
            activeOpacity={0.8}
          >
            <AppIcon name="comments" size={16} color={colors.primary} />
            {!chatVisible && unreadChatCount > 0 && (
              <View style={styles.chatBadge}>
                <Text style={styles.chatBadgeText}>
                  {unreadChatCount > 9 ? '9+' : unreadChatCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── LEFT TOAST ──────────────────────────────────── */}
      {leftToast && (
        <View style={styles.leaveToast}>
          <AppIcon name="sign-out-alt" size={11} color="#9ca3af" />
          <Text style={styles.leaveToastText}>{leftToast}</Text>
        </View>
      )}

      {liveNotice && (
        <TouchableOpacity
          style={styles.liveNotice}
          activeOpacity={0.86}
          onPress={liveNotice.type === 'chat' ? openChat : undefined}
        >
          <View style={styles.liveNoticeIcon}>
            <AppIcon
              name={liveNotice.icon || 'bell'}
              size={13}
              color={colors.primary}
            />
          </View>
          <View style={styles.liveNoticeBody}>
            <Text style={styles.liveNoticeTitle} numberOfLines={1}>
              {liveNotice.title}
            </Text>
            <Text style={styles.liveNoticeText} numberOfLines={2}>
              {liveNotice.message}
            </Text>
          </View>
          {liveNotice.type === 'chat' && (
            <Text style={styles.liveNoticeAction}>Open</Text>
          )}
        </TouchableOpacity>
      )}

      {/* ── PENDING JOIN REQUESTS (teacher only) ──────────── */}
      {isTeacher && pendingJoins.length > 0 && (
        <View style={styles.pendingBox}>
          <View style={styles.pendingHeader}>
            <AppIcon name="user-clock" size={13} color={colors.warning} />
            <Text style={styles.pendingTitle}>
              Join Requests ({pendingJoins.length})
            </Text>
          </View>
          {pendingJoins.map(p => (
            <View key={p.from} style={styles.pendingRow}>
              <View
                style={[
                  styles.pendingAvatar,
                  { backgroundColor: getAvatarColor(p.name) },
                ]}
              >
                <Text style={styles.pendingAvatarText}>
                  {getInitial(p.name)}
                </Text>
              </View>
              <Text style={styles.pendingName} numberOfLines={1}>
                {p.name}
              </Text>
              <View style={styles.pendingActions}>
                <TouchableOpacity
                  style={styles.approveBtn}
                  onPress={() => approveJoin(p)}
                >
                  <AppIcon name="check" size={11} color="#FFFFFF" />
                  <Text style={styles.approveBtnText}>Admit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rejectBtn}
                  onPress={() => rejectJoin(p)}
                >
                  <AppIcon name="times" size={12} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* ── MAIN AREA ────────────────────────────────────── */}
      {isTeacher && pendingScreenShares.length > 0 && (
        <View style={styles.pendingBox}>
          <View style={styles.pendingHeader}>
            <AppIcon name="desktop" size={13} color={colors.warning} />
            <Text style={styles.pendingTitle}>
              Screen Share Requests ({pendingScreenShares.length})
            </Text>
          </View>
          {pendingScreenShares.map(p => (
            <View key={p.from} style={styles.pendingRow}>
              <View
                style={[
                  styles.pendingAvatar,
                  { backgroundColor: getAvatarColor(p.name) },
                ]}
              >
                <Text style={styles.pendingAvatarText}>
                  {getInitial(p.name)}
                </Text>
              </View>
              <Text style={styles.pendingName} numberOfLines={1}>
                {p.name}
              </Text>
              <View style={styles.pendingActions}>
                <TouchableOpacity
                  style={styles.approveBtn}
                  onPress={() => approveScreenShare(p)}
                >
                  <AppIcon name="check" size={11} color="#FFFFFF" />
                  <Text style={styles.approveBtnText}>Allow</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rejectBtn}
                  onPress={() => rejectScreenShare(p)}
                >
                  <AppIcon name="times" size={12} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={styles.mainArea}>
        {/* Screen-share active banner */}
        {isScreenMode && (
          <View style={styles.screenBanner}>
            <AppIcon name="desktop" size={12} color="#60a5fa" />
            <Text style={styles.screenBannerText}>
              {isSharingScreen
                ? 'You are sharing your screen'
                : `${screenSharerName} is sharing`}
            </Text>
            {isSharingScreen && (
              <TouchableOpacity
                style={styles.stopShareBtn}
                onPress={stopScreenShare}
              >
                <Text style={styles.stopShareBtnText}>Stop</Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Featured / presenter area */}
        <View
          style={[styles.featuredBox, isScreenMode && styles.featuredBoxScreen]}
        >
          {featuredStreamURL ? (
            <>
              <RTCView
                streamURL={featuredStreamURL}
                style={styles.featuredVideo}
                objectFit={featuredFit}
                mirror={featuredMirror}
                zOrder={1}
              />
              <TouchableOpacity
                style={styles.videoControlTapTarget}
                onPress={showVideoControls}
                activeOpacity={1}
              />

              {/* Name tag */}
              <View style={styles.nameTag}>
                <AppIcon
                  name={isScreenMode ? 'desktop' : 'microphone'}
                  size={10}
                  color="#34d399"
                />
                <Text style={styles.nameTagText} numberOfLines={1}>
                  {featuredLabel}
                </Text>
              </View>

              {videoControlsVisible && (
                <>
                  {/* Expand to fullscreen */}
                  <TouchableOpacity
                    style={styles.expandBtn}
                    onPress={() =>
                      setFullscreenSource({
                        streamURL: featuredStreamURL,
                        label: featuredLabel,
                        fit: featuredFit,
                        mirror: featuredMirror,
                        kind: featuredSource?.kind,
                        sideSource: isScreenMode ? screenPipSource : null,
                      })
                    }
                  >
                    <AppIcon name="expand" size={12} color="#FFFFFF" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.expandBtn, styles.videoMiniPipBtn]}
                    onPress={minimizeLiveClass}
                    activeOpacity={0.85}
                  >
                    <AppIcon name="compress-alt" size={12} color="#FFFFFF" />
                  </TouchableOpacity>
                </>
              )}

              {/* PiP — own camera shown while in screen-share view */}
            </>
          ) : (
            <View style={styles.placeholderBox}>
              <View style={styles.placeholderIconWrap}>
                <AppIcon name="video" size={28} color="#2dd4a0" />
              </View>
              <Text style={styles.placeholderText}>You are live</Text>
              <Text style={styles.placeholderSub}>
                {isTeacher
                  ? 'Your camera appears below. Tap Share to share your screen.'
                  : 'Teacher video will appear here when the camera is on.'}
              </Text>
            </View>
          )}
        </View>

        {/* ── PARTICIPANT TILES STRIP ───────────────────── */}
        <ScrollView
          horizontal
          style={styles.tilesStrip}
          contentContainerStyle={styles.tilesStripContent}
          showsHorizontalScrollIndicator={false}
        >
          {/* Self tile */}
          <TouchableOpacity
            style={[styles.tile, localSpeaking && styles.tileSpeaking]}
            activeOpacity={0.85}
            disabled={!cameraOn || !localStreamURL}
            onPress={() =>
              setPinnedFeaturedSource({
                streamURL: localStreamURL,
                label: `${myName} (You)`,
                fit: 'cover',
                kind: 'camera',
                mirror: isFrontCamera,
              })
            }
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
              <View
                style={[
                  styles.tileVideo,
                  styles.tileFallback,
                  { backgroundColor: getAvatarColor(myName) + '55' },
                ]}
              >
                <Text style={styles.tileInitial}>{getInitial(myName)}</Text>
              </View>
            )}
            {/* Camera flip button */}
            <TouchableOpacity
              style={[
                styles.flipBtn,
                (!cameraOn || !localStreamURL) && styles.flipBtnDisabled,
              ]}
              onPress={flipCamera}
              disabled={!cameraOn || !localStreamURL}
              activeOpacity={0.8}
            >
              <AppIcon name="sync" size={10} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.tileFooter}>
              <Text style={styles.tileName} numberOfLines={1}>
                You
              </Text>
              <View style={styles.tileBadges}>
                {handRaised && (
                  <AppIcon name="hand-paper" size={9} color={colors.warning} />
                )}
                {micOn ? (
                  <AppIcon
                    name="microphone"
                    size={9}
                    color={localSpeaking ? colors.success : colors.textMuted}
                  />
                ) : (
                  <AppIcon
                    name="microphone-slash"
                    size={9}
                    color={colors.danger}
                  />
                )}
                {!cameraOn && (
                  <AppIcon name="video-slash" size={9} color={colors.danger} />
                )}
              </View>
            </View>
          </TouchableOpacity>

          {/* Remote participant tiles */}
          {participants.map(p => {
            const url = remoteStreamURLs[p.id];
            const camOn = p.cameraOn !== false;
            const mic = p.micOn !== false;
            const isStudent = p.role !== 'host' && p.role !== 'teacher';
            const isSpeaking = !!speakingPeerIds[p.id];
            return (
              <TouchableOpacity
                key={p.id}
                style={[styles.tile, isSpeaking && styles.tileSpeaking]}
                activeOpacity={0.85}
                disabled={!url || !camOn}
                onPress={() =>
                  setPinnedFeaturedSource({
                    streamURL: url,
                    label: p.name || 'Participant',
                    fit: 'cover',
                    kind: 'camera',
                    mirror: false,
                  })
                }
              >
                {url && camOn ? (
                  <RTCView
                    streamURL={url}
                    style={styles.tileVideo}
                    objectFit="cover"
                    zOrder={0}
                  />
                ) : (
                  <View
                    style={[
                      styles.tileVideo,
                      styles.tileFallback,
                      { backgroundColor: getAvatarColor(p.name) + '55' },
                    ]}
                  >
                    <Text style={styles.tileInitial}>{getInitial(p.name)}</Text>
                  </View>
                )}
                <View style={styles.tileFooter}>
                  <Text style={styles.tileName} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <View style={styles.tileBadges}>
                    {p.handRaised && (
                      <AppIcon
                        name="hand-paper"
                        size={9}
                        color={colors.warning}
                      />
                    )}
                    {mic ? (
                      <AppIcon
                        name="microphone"
                        size={9}
                        color={isSpeaking ? colors.success : colors.textMuted}
                      />
                    ) : (
                      <AppIcon
                        name="microphone-slash"
                        size={9}
                        color={colors.danger}
                      />
                    )}
                    {!camOn && (
                      <AppIcon
                        name="video-slash"
                        size={9}
                        color={colors.danger}
                      />
                    )}
                  </View>
                </View>
                {/* Teacher admin controls */}
                {isTeacher && isStudent && (
                  <View style={styles.tileControls}>
                    {mic && (
                      <TouchableOpacity
                        style={styles.tileCtrlBtn}
                        onPress={() => muteStudent(p)}
                      >
                        <AppIcon name="microphone" size={10} color="#FFFFFF" />
                      </TouchableOpacity>
                    )}
                    {camOn && (
                      <TouchableOpacity
                        style={styles.tileCtrlBtn}
                        onPress={() => camOffStudent(p)}
                      >
                        <AppIcon name="video" size={10} color="#FFFFFF" />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.tileCtrlBtn, styles.tileCtrlBtnDanger]}
                      onPress={() => removeStudent(p)}
                    >
                      <AppIcon name="user-times" size={10} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* ── FULLSCREEN MODAL ─────────────────────────────── */}
      <Modal
        visible={!!fullscreenSource?.streamURL}
        transparent={false}
        animationType="fade"
        supportedOrientations={[
          'portrait',
          'portrait-upside-down',
          'landscape',
          'landscape-left',
          'landscape-right',
        ]}
        onRequestClose={closeFullscreen}
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
          <TouchableOpacity
            style={styles.fullscreenTapTarget}
            onPress={showFullscreenControls}
            activeOpacity={1}
          />
          {fullscreenSource?.kind === 'screen' &&
            fullscreenSource?.sideSource && (
              <View style={styles.fullscreenPipBox}>
                {fullscreenSource.sideSource.streamURL ? (
                  <RTCView
                    streamURL={fullscreenSource.sideSource.streamURL}
                    style={styles.fullscreenPipVideo}
                    objectFit={fullscreenSource.sideSource.fit || 'cover'}
                    mirror={!!fullscreenSource.sideSource.mirror}
                    zOrder={2}
                  />
                ) : (
                  <View
                    style={[
                      styles.fullscreenPipVideo,
                      styles.fullscreenPipFallback,
                    ]}
                  >
                    <Text style={styles.pipInitial}>
                      {getInitial(fullscreenSource.sideSource.label)}
                    </Text>
                  </View>
                )}
              </View>
            )}
          {fullscreenControlsVisible && (
            <View style={styles.fullscreenTopBar}>
              <TouchableOpacity
                style={styles.fullscreenClose}
                onPress={closeFullscreen}
              >
                <AppIcon name="compress" size={14} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.fullscreenLabel} numberOfLines={1}>
                {fullscreenSource?.label || ''}
              </Text>
              <TouchableOpacity
                style={styles.fullscreenClose}
                onPress={rotateFullscreen}
              >
                <AppIcon name="sync" size={14} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>

      {/* ── CHAT PANEL ───────────────────────────────────── */}
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
        onIncomingMessage={handleIncomingChatMessage}
      />

      {/* ── CONTROL BAR ──────────────────────────────────── */}
      <View style={styles.controls}>
        {/* Mic */}
        <TouchableOpacity
          style={[
            styles.ctrlBtn,
            micOn && localSpeaking && styles.ctrlBtnActive,
          ]}
          onPress={toggleMic}
          activeOpacity={0.8}
        >
          <AppIcon
            name={micOn ? 'microphone' : 'microphone-slash'}
            size={18}
            color={
              micOn
                ? localSpeaking
                  ? colors.primary
                  : colors.textMuted
                : colors.textMuted
            }
          />
          <Text
            style={[
              styles.ctrlLabel,
              micOn && localSpeaking && styles.ctrlLabelActive,
            ]}
          >
            {micOn ? 'Mute' : 'Unmute'}
          </Text>
        </TouchableOpacity>

        {/* Camera */}
        <TouchableOpacity
          style={[styles.ctrlBtn, cameraOn && styles.ctrlBtnActive]}
          onPress={toggleCamera}
          activeOpacity={0.8}
        >
          <AppIcon
            name={cameraOn ? 'video' : 'video-slash'}
            size={18}
            color={cameraOn ? colors.primary : colors.textMuted}
          />
          <Text style={[styles.ctrlLabel, cameraOn && styles.ctrlLabelActive]}>
            {cameraOn ? 'Camera' : 'Start Cam'}
          </Text>
        </TouchableOpacity>

        {/* Speaker */}
        <TouchableOpacity
          style={[styles.ctrlBtn, speakerOn && styles.ctrlBtnActive]}
          onPress={toggleSpeaker}
          activeOpacity={0.8}
        >
          <AppIcon
            name={speakerOn ? 'volume-up' : 'volume-mute'}
            size={18}
            color={speakerOn ? colors.primary : colors.textMuted}
          />
          <Text style={[styles.ctrlLabel, speakerOn && styles.ctrlLabelActive]}>
            Speaker
          </Text>
        </TouchableOpacity>

        {/* Hand raise (student only) */}
        {!isTeacher && (
          <TouchableOpacity
            style={[styles.ctrlBtn, handRaised && styles.ctrlBtnActive]}
            onPress={toggleHandRaise}
            activeOpacity={0.8}
          >
            <AppIcon
              name="hand-paper"
              size={18}
              color={handRaised ? colors.primary : colors.textMuted}
            />
            <Text
              style={[styles.ctrlLabel, handRaised && styles.ctrlLabelActive]}
            >
              {handRaised ? 'Lower' : 'Raise'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Notes (teacher only) */}
        {isTeacher && (
          <TouchableOpacity
            style={styles.ctrlBtn}
            onPress={() => {
              if (!cls?.batchId) {
                Toast.warning(
                  'This class is missing a batch link.',
                  'Cannot add note',
                );
                return;
              }
              navigation.navigate('AddNote', {
                classId: cls.id,
                batchId: cls.batchId,
                batchName: cls.batchName,
                disallowVideo: true,
              });
            }}
            activeOpacity={0.8}
          >
            <AppIcon name="sticky-note" size={18} color={colors.textMuted} />
            <Text style={styles.ctrlLabel}>Notes</Text>
          </TouchableOpacity>
        )}

        {/* Screen share */}
        <TouchableOpacity
          style={[
            styles.ctrlBtn,
            (isSharingScreen || screenShareRequestPending) &&
              styles.ctrlBtnActive,
          ]}
          onPress={isSharingScreen ? stopScreenShare : startScreenShare}
          activeOpacity={0.8}
        >
          <AppIcon
            name="desktop"
            size={18}
            color={
              isSharingScreen || screenShareRequestPending
                ? colors.primary
                : colors.textMuted
            }
          />
          <Text
            style={[
              styles.ctrlLabel,
              (isSharingScreen || screenShareRequestPending) &&
                styles.ctrlLabelActive,
            ]}
          >
            {isSharingScreen
              ? 'Stop'
              : screenShareRequestPending
              ? 'Waiting'
              : 'Share'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── CLASS ENDED OVERLAY ───────────────────────────── */}
      {classEnded && (
        <View style={styles.endedOverlay}>
          <View style={styles.endedCard}>
            <View style={styles.endedIconBox}>
              <AppIcon name="check-circle" size={40} color="#FFFFFF" />
            </View>
            <Text style={styles.endedTitle}>Class Ended</Text>
            <Text style={styles.endedSub}>
              The teacher has ended this session. Thanks for joining!
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
const makeStyles = colors =>
  StyleSheet.create({
    // Root — uses theme background
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },

    // ── Top bar ───────────────────────────────────────────────────────────
    nativePipContainer: {
      flex: 1,
      backgroundColor: '#000000',
      position: 'relative',
      overflow: 'hidden',
    },
    nativePipVideo: {
      flex: 1,
      width: '100%',
      height: '100%',
      backgroundColor: '#000000',
    },
    nativePipFallback: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: '#181A22',
      paddingHorizontal: SPACING.sm,
    },
    nativePipTitle: {
      color: '#FFFFFF',
      fontSize: SIZES.sm,
      fontWeight: '800',
      textAlign: 'center',
    },
    nativePipBadge: {
      position: 'absolute',
      top: 8,
      left: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: RADIUS.full,
      backgroundColor: 'rgba(0,0,0,0.72)',
      zIndex: 3,
    },
    nativePipDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.danger,
    },
    nativePipBadgeText: {
      color: '#FFFFFF',
      fontSize: 9,
      fontWeight: '900',
    },
    nativePipLabel: {
      position: 'absolute',
      left: 8,
      right: 8,
      bottom: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: RADIUS.sm,
      backgroundColor: 'rgba(0,0,0,0.58)',
      zIndex: 3,
    },
    nativePipLabelText: {
      color: '#FFFFFF',
      fontSize: SIZES.xs,
      fontWeight: '800',
      textAlign: 'center',
    },

    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.md,
      paddingTop: SPACING.xxxl + 4,
      paddingBottom: SPACING.sm,
      backgroundColor: colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    leaveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.danger + '22',
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.danger + '55',
    },
    leaveBtnText: {
      color: colors.danger,
      fontSize: SIZES.xs,
      fontWeight: '700',
    },
    topCenter: {
      flex: 1,
      alignItems: 'center',
      paddingHorizontal: SPACING.sm,
    },
    livePill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: colors.success + '22',
      paddingHorizontal: SPACING.sm,
      paddingVertical: 3,
      borderRadius: RADIUS.full,
      marginBottom: 4,
      borderWidth: 1,
      borderColor: colors.success + '44',
    },
    liveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.success,
    },
    liveText: {
      color: colors.success,
      fontSize: 9,
      fontWeight: '800',
      letterSpacing: 1.2,
    },
    classTitle: {
      color: colors.text,
      fontSize: SIZES.sm,
      fontWeight: '700',
      textAlign: 'center',
    },
    classSub: {
      color: colors.textMuted,
      fontSize: 10,
      marginTop: 2,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: SPACING.xs,
    },
    chatBtn: {
      width: 40,
      height: 36,
      borderRadius: RADIUS.md,
      backgroundColor: colors.primary + '25',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      borderWidth: 1,
      borderColor: colors.primary + '25',
    },
    chatBtnActive: {
      backgroundColor: colors.primary + '25',
      borderColor: colors.primary + '55',
    },
    chatBadge: {
      position: 'absolute',
      top: -5,
      right: -5,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      backgroundColor: colors.warning,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 3,
    },
    chatBadgeText: {
      color: '#111',
      fontSize: 9,
      fontWeight: '900',
    },

    // ── Leave toast ────────────────────────────────────────────────────────
    leaveToast: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      backgroundColor: colors.surfaceElevated,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      marginHorizontal: SPACING.md,
      marginTop: SPACING.sm,
      borderRadius: RADIUS.md,
      alignSelf: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    leaveToastText: {
      color: colors.textMuted,
      fontSize: SIZES.xs,
      fontWeight: '600',
    },

    // ── Pending join requests ─────────────────────────────────────────────
    liveNotice: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      backgroundColor: colors.surfaceElevated,
      paddingHorizontal: SPACING.md,
      paddingVertical: SPACING.sm,
      marginHorizontal: SPACING.md,
      marginTop: SPACING.sm,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.primary + '33',
      elevation: 8,
      shadowColor: colors.overlay,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
    },
    liveNoticeIcon: {
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary + '18',
    },
    liveNoticeBody: {
      flex: 1,
    },
    liveNoticeTitle: {
      color: colors.text,
      fontSize: SIZES.xs,
      fontWeight: '900',
    },
    liveNoticeText: {
      color: colors.textMuted,
      fontSize: SIZES.xs,
      fontWeight: '600',
      marginTop: 1,
    },
    liveNoticeAction: {
      color: colors.primary,
      fontSize: SIZES.xs,
      fontWeight: '900',
    },

    pendingBox: {
      backgroundColor: colors.surface,
      marginHorizontal: SPACING.md,
      marginTop: SPACING.sm,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      borderWidth: 1,
      borderColor: colors.warning + '44',
    },
    pendingHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: SPACING.sm,
    },
    pendingTitle: {
      color: colors.warning,
      fontWeight: '700',
      fontSize: SIZES.sm,
    },
    pendingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
      paddingVertical: 7,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    pendingAvatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    pendingAvatarText: {
      color: '#fff',
      fontSize: SIZES.sm,
      fontWeight: '700',
    },
    pendingName: {
      color: colors.text,
      fontSize: SIZES.sm,
      fontWeight: '600',
      flex: 1,
    },
    pendingActions: {
      flexDirection: 'row',
      gap: SPACING.xs,
      alignItems: 'center',
    },
    approveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.success,
      paddingHorizontal: SPACING.md,
      paddingVertical: 6,
      borderRadius: RADIUS.sm,
    },
    approveBtnText: {
      color: '#FFFFFF',
      fontSize: SIZES.xs,
      fontWeight: '700',
    },
    rejectBtn: {
      backgroundColor: colors.danger,
      width: 30,
      height: 30,
      borderRadius: RADIUS.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // ── Main area ─────────────────────────────────────────────────────────
    mainArea: {
      flex: 1,
      paddingHorizontal: SPACING.xs,
      paddingTop: SPACING.xs,
    },

    // Screen share active banner
    screenBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.info + '18',
      paddingHorizontal: SPACING.md,
      paddingVertical: 7,
      borderRadius: RADIUS.md,
      marginBottom: SPACING.sm,
      borderWidth: 1,
      borderColor: colors.info + '33',
    },
    screenBannerText: {
      color: colors.info,
      fontSize: SIZES.xs,
      fontWeight: '600',
      flex: 1,
    },
    stopShareBtn: {
      backgroundColor: colors.danger,
      paddingHorizontal: SPACING.md,
      paddingVertical: 4,
      borderRadius: RADIUS.sm,
    },
    stopShareBtnText: {
      color: '#FFFFFF',
      fontSize: SIZES.xs,
      fontWeight: '700',
    },

    // Featured presenter / screen share area
    featuredBox: {
      backgroundColor: colors.surfaceSubtle,
      borderRadius: RADIUS.sm,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: SPACING.xs,
      position: 'relative',
    },
    featuredBoxScreen: {
      borderColor: colors.info + '55',
    },
    featuredVideo: {
      width: '100%',
      height: 228,
      backgroundColor: colors.surfaceSubtle,
    },
    videoControlTapTarget: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 2,
    },
    placeholderBox: {
      height: 228,
      justifyContent: 'center',
      alignItems: 'center',
      gap: SPACING.sm,
      paddingHorizontal: SPACING.xl,
    },
    placeholderIconWrap: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.success + '22',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
      borderWidth: 1,
      borderColor: colors.success + '33',
    },
    placeholderText: {
      color: colors.text,
      fontSize: SIZES.base,
      fontWeight: '700',
      textAlign: 'center',
    },
    placeholderSub: {
      color: colors.textMuted,
      fontSize: SIZES.sm,
      textAlign: 'center',
      lineHeight: 18,
    },

    // Name tag overlay on featured video
    nameTag: {
      position: 'absolute',
      bottom: 10,
      left: 10,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      backgroundColor: 'rgba(0,0,0,0.62)',
      paddingHorizontal: SPACING.sm,
      paddingVertical: 4,
      borderRadius: RADIUS.sm,
      zIndex: 3,
    },
    nameTagText: {
      color: '#FFFFFF',
      fontSize: SIZES.xs,
      fontWeight: '600',
    },

    // Expand to fullscreen button
    expandBtn: {
      position: 'absolute',
      top: 10,
      right: 10,
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: 'rgba(0,0,0,0.52)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.18)',
      zIndex: 4,
    },
    videoMiniPipBtn: {
      top: 46,
    },

    // PiP — own cam during screen share
    pipBox: {
      position: 'absolute',
      bottom: 10,
      right: 10,
      width: 74,
      height: 54,
      borderRadius: RADIUS.sm,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: colors.primary,
    },
    pipVideo: {
      width: '100%',
      height: '100%',
      backgroundColor: colors.surface,
    },
    pipFallback: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    pipInitial: {
      color: colors.text,
      fontSize: SIZES.base,
      fontWeight: '700',
    },

    // ── Participant tile strip ────────────────────────────────────────────
    tilesStrip: {
      flexGrow: 0,
    },
    tilesStripContent: {
      gap: SPACING.sm,
      paddingVertical: SPACING.xs,
      paddingBottom: SPACING.sm,
    },
    tile: {
      width: 118,
      backgroundColor: colors.surface,
      borderRadius: RADIUS.sm,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
      position: 'relative',
    },
    tileSpeaking: {
      borderColor: colors.success + '66',
    },
    tileVideo: {
      width: '100%',
      height: 86,
      backgroundColor: colors.surfaceSubtle,
    },
    tileFallback: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    tileInitial: {
      color: colors.text,
      fontSize: SIZES.xl,
      fontWeight: '800',
    },
    tileFooter: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: SPACING.sm,
      paddingVertical: 5,
    },
    tileName: {
      color: colors.text,
      fontSize: 10,
      fontWeight: '600',
      flex: 1,
      marginRight: 3,
    },
    tileBadges: {
      flexDirection: 'row',
      gap: 3,
    },
    flipBtn: {
      position: 'absolute',
      top: 5,
      right: 5,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: 'rgba(0,0,0,0.55)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.18)',
    },
    flipBtnDisabled: {
      opacity: 0.3,
    },
    tileControls: {
      position: 'absolute',
      top: 4,
      left: 4,
      flexDirection: 'column',
      gap: 3,
    },
    tileCtrlBtn: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: 'rgba(0,0,0,0.65)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    tileCtrlBtnDanger: {
      backgroundColor: colors.danger + 'CC',
    },

    // ── Chat notification popup ───────────────────────────────────────────
    // ── Fullscreen modal ──────────────────────────────────────────────────
    fullscreenContainer: {
      flex: 1,
      backgroundColor: '#000000',
    },
    fullscreenVideo: {
      flex: 1,
      width: '100%',
      height: '100%',
      backgroundColor: '#000',
    },
    fullscreenTapTarget: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 2,
    },
    fullscreenTopBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      zIndex: 5,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: SPACING.md,
      paddingTop: SPACING.xl,
      paddingBottom: SPACING.sm,
      backgroundColor: 'rgba(0,0,0,0.52)',
      gap: SPACING.sm,
    },
    fullscreenClose: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: 'rgba(255,255,255,0.14)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    fullscreenLabel: {
      flex: 1,
      color: '#FFFFFF',
      fontSize: SIZES.sm,
      fontWeight: '700',
    },

    // ── Control bar ───────────────────────────────────────────────────────
    fullscreenPipBox: {
      position: 'absolute',
      right: SPACING.md,
      bottom: SPACING.md,
      width: 128,
      height: 82,
      borderRadius: RADIUS.md,
      overflow: 'hidden',
      borderWidth: 2,
      borderColor: colors.primary,
      backgroundColor: '#111318',
      zIndex: 4,
    },
    fullscreenPipVideo: {
      width: '100%',
      height: '100%',
      backgroundColor: '#000000',
    },
    fullscreenPipFallback: {
      alignItems: 'center',
      justifyContent: 'center',
    },

    controls: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      paddingHorizontal: SPACING.xs,
      paddingVertical: SPACING.md,
      paddingBottom: SPACING.xl,
      backgroundColor: colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    ctrlBtn: {
      backgroundColor: 'transparent',
      paddingHorizontal: SPACING.sm,
      paddingVertical: SPACING.sm,
      borderRadius: RADIUS.md,
      alignItems: 'center',
      minWidth: 50,
      gap: 4,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    ctrlBtnActive: {
      backgroundColor: colors.primary + '25',
      borderColor: colors.primary + '25',
    },
    ctrlBtnEnd: {
      backgroundColor: colors.danger,
      borderColor: colors.danger,
    },
    ctrlLabel: {
      color: colors.textMuted,
      fontSize: 8,
      fontWeight: '700',
      textAlign: 'center',
    },
    ctrlLabelActive: {
      color: colors.primary,
    },

    // ── Class ended overlay ───────────────────────────────────────────────
    endedOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay,
      alignItems: 'center',
      justifyContent: 'center',
      padding: SPACING.xl,
      zIndex: 50,
    },
    endedCard: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.xl,
      padding: SPACING.xl,
      alignItems: 'center',
      maxWidth: 320,
      borderWidth: 1,
      borderColor: colors.border,
    },
    endedIconBox: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.success,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.md,
    },
    endedTitle: {
      color: colors.text,
      fontSize: SIZES.xxl,
      fontWeight: '900',
      marginBottom: SPACING.sm,
    },
    endedSub: {
      color: colors.textMuted,
      fontSize: SIZES.sm,
      textAlign: 'center',
      lineHeight: 20,
    },
  });

export default LiveClass;
