import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Keyboard,
    KeyboardAvoidingView,
    Linking,
    PermissionsAndroid,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { errorCodes, isErrorWithCode, pick, types } from '@react-native-documents/picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AudioRecorderPlayer, {
    AudioEncoderAndroidType,
    AudioSourceAndroidType,
    AVEncoderAudioQualityIOSType,
    AVEncodingOption,
    AVModeIOSOption,
    OutputFormatAndroidType,
} from 'react-native-audio-recorder-player';
import { SERVER_URL } from '../config';
import { RADIUS, SIZES, SPACING } from '../theme';
import AppIcon from './AppIcon';
import {
    buildLiveClassFileMessage,
    buildLiveClassChatMessage,
    emitLiveClassChatMessage,
    subscribeLiveClassChat,
} from '../services/liveClassChatService';

const MAX_FILE_BYTES = 40 * 1024 * 1024;
const MIN_VOICE_MS = 700;
const CHAT_KEYBOARD_GAP = 6;

const recorderAudioSet = {
    AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
    AudioSourceAndroid: AudioSourceAndroidType.MIC,
    AudioEncodingBitRateAndroid: 96000,
    AudioSamplingRateAndroid: 44100,
    OutputFormatAndroid: OutputFormatAndroidType.MPEG_4,
    AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType.high,
    AVFormatIDKeyIOS: AVEncodingOption.aac,
    AVModeIOS: AVModeIOSOption.measurement,
    AVNumberOfChannelsKeyIOS: 1,
};

const bytesToLabel = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const cleanAlertMessage = (value, fallback) => {
    const text = typeof value === 'string' ? value : '';
    const cleaned = text
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<\/?[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&amp;/gi, '&')
        .replace(/\s+/g, ' ')
        .trim();

    if (/^Cannot\s+POST\s+\/chat-upload/i.test(cleaned)) {
        return 'Chat file upload is not available on the class server. Please restart the signaling server with the latest code.';
    }

    return cleaned || fallback;
};

const normalizeUploadUri = (uri) =>
    Platform.OS === 'android' && uri && !uri.includes('://') ? `file://${uri}` : uri;

const getDownloadUrl = (url, fileName) => {
    if (!url || !/^https?:\/\//i.test(url)) return '';
    const [base, query = ''] = url.split('?');
    const marker = '/uploads/';
    const markerIndex = base.indexOf(marker);
    if (markerIndex === -1) return url;

    const origin = base.slice(0, markerIndex);
    const storedName = base.slice(markerIndex + marker.length);
    const nextQuery = [
        query,
        fileName ? `name=${encodeURIComponent(fileName)}` : '',
    ].filter(Boolean).join('&');

    return `${origin}/download/${storedName}${nextQuery ? `?${nextQuery}` : ''}`;
};

const isMediaAttachment = (attachment) => {
    const type = attachment?.type || '';
    return type.startsWith('image/') || type.startsWith('video/') || type.startsWith('audio/');
};

const getAndroidViewIntentUrl = (uri, type) => {
    if (!uri || !/^https?:\/\//i.test(uri)) return '';
    const match = uri.match(/^(https?):\/\/(.+)$/i);
    if (!match) return '';
    return `intent://${match[2]}#Intent;scheme=${match[1]};action=android.intent.action.VIEW;type=${type || '*/*'};end`;
};

const uploadChatFile = async (file) => {
    const token = await AsyncStorage.getItem('sv_token');
    const formData = new FormData();
    formData.append('file', {
        uri: normalizeUploadUri(file.uri),
        name: file.name || 'Attachment',
        type: file.type || 'application/octet-stream',
    });

    const response = await fetch(`${SERVER_URL}/chat-upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
    });

    if (!response.ok) {
        const body = await response.text().catch(() => '');
        let message = body;
        try {
            const data = JSON.parse(body);
            message = data?.error || data?.message || body;
        } catch {
            message = body;
        }
        throw new Error(cleanAlertMessage(message, `Upload failed (${response.status})`));
    }

    return response.json();
};

const requestRecordPermission = async () => {
    if (Platform.OS !== 'android') return true;
    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    return result === PermissionsAndroid.RESULTS.GRANTED;
};

const formatVoiceTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const getAttachmentIcon = (attachment) => {
    const type = attachment?.type || '';
    const name = attachment?.name || '';
    if (type.startsWith('image/')) return 'image';
    if (type.startsWith('video/')) return 'video';
    if (type.startsWith('audio/')) return 'microphone';
    if (type.includes('pdf')) return 'file-pdf';
    if (type.includes('excel') || type.includes('spreadsheet') || /\.(xls|xlsx)$/i.test(name)) return 'file-excel';
    if (type.includes('zip') || /\.(zip|rar|7z)$/i.test(name)) return 'file-archive';
    if (/\.apk$/i.test(name)) return 'android';
    return 'file-alt';
};

const buildReplyPreview = (message) => {
    if (!message) return null;
    const attachment = message.attachment;
    const text = attachment ? attachment.name || message.text || 'Attachment' : message.text || 'Message';

    return {
        id: message.id,
        senderName: message.senderName || 'User',
        text,
        hasAttachment: !!attachment,
    };
};

const LiveClassChat = ({
    colors,
    socket,
    roomId,
    visible,
    userId,
    name,
    role,
    onClose,
    onUnreadChange,
    onIncomingMessage,
}) => {
    const { height: windowHeight } = useWindowDimensions();
    const insets = useSafeAreaInsets();
    const styles = useMemo(
        () => makeStyles(colors, insets.bottom),
        [colors, insets.bottom],
    );
    const listRef = useRef(null);
    const visibleRef = useRef(visible);
    const seenIdsRef = useRef(new Set());
    const recorderRef = useRef(new AudioRecorderPlayer());
    const [messages, setMessages] = useState([]);
    const [draft, setDraft] = useState('');
    const [attaching, setAttaching] = useState(false);
    const [recording, setRecording] = useState(false);
    const [recordMs, setRecordMs] = useState(0);
    const [replyTo, setReplyTo] = useState(null);
    const [keyboardOverlap, setKeyboardOverlap] = useState(0);

    useEffect(() => {
        visibleRef.current = visible;
        if (visible) {
            onUnreadChange?.(0);
            setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
        }
    }, [onUnreadChange, visible]);

    useEffect(() => {
        const unsubscribe = subscribeLiveClassChat(socket, roomId, (message) => {
            if (seenIdsRef.current.has(message.id)) return;
            seenIdsRef.current.add(message.id);
            setMessages(prev => [...prev, message]);
            const isMine = message.senderId === (userId || socket?.id);
            if (!visibleRef.current && !isMine) {
                onUnreadChange?.(count => count + 1);
                onIncomingMessage?.(message);
            }
        });
        return unsubscribe;
    }, [onIncomingMessage, onUnreadChange, roomId, socket, userId]);

    useEffect(() => () => {
        recorderRef.current.removeRecordBackListener();
        recorderRef.current.stopRecorder().catch(() => {});
    }, []);

    useEffect(() => {
        if (Platform.OS !== 'android') return undefined;

        const showSub = Keyboard.addListener('keyboardDidShow', event => {
            const screenY = event.endCoordinates?.screenY;
            const height = event.endCoordinates?.height || 0;
            const overlap = screenY
                ? Math.max(0, Math.round(windowHeight - screenY))
                : height;
            setKeyboardOverlap(overlap || height);
            setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
        });
        const hideSub = Keyboard.addListener('keyboardDidHide', () => {
            setKeyboardOverlap(0);
        });

        return () => {
            showSub.remove();
            hideSub.remove();
        };
    }, [windowHeight]);

    const sendMessage = () => {
        const text = draft.trim();
        if (!text || !socket) return;

        const message = buildLiveClassChatMessage({
            roomId,
            text,
            senderId: userId || socket.id,
            senderName: name,
            role,
            replyTo,
        });

        seenIdsRef.current.add(message.id);
        setMessages(prev => [...prev, message]);
        setDraft('');
        setReplyTo(null);
        emitLiveClassChatMessage(socket, message);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
    };

    const pickAndSendAttachment = async (type) => {
        if (!socket || attaching || recording) return;

        try {
            const [file] = await pick({
                type,
                allowMultiSelection: false,
            });
            if (!file) return;
            if (file.size && file.size > MAX_FILE_BYTES) {
                Alert.alert('File too large', 'Please share a file up to 40 MB.');
                return;
            }

            setAttaching(true);
            const uploaded = await uploadChatFile({
                uri: file.uri,
                name: file.name || 'Attachment',
                type: file.type || 'application/octet-stream',
            });
            const message = buildLiveClassFileMessage({
                roomId,
                file: {
                    name: uploaded.name || file.name || 'Attachment',
                    type: uploaded.type || file.type || 'application/octet-stream',
                    size: uploaded.size || file.size || 0,
                    url: uploaded.url,
                },
                senderId: userId || socket.id,
                senderName: name,
                role,
                replyTo,
            });

            seenIdsRef.current.add(message.id);
            setMessages(prev => [...prev, message]);
            setReplyTo(null);
            emitLiveClassChatMessage(socket, message);
            setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
        } catch (err) {
            if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) return;
            Alert.alert('Attachment', cleanAlertMessage(err?.message, 'Could not share this file.'));
        } finally {
            setAttaching(false);
        }
    };

    const sendAttachment = () => {
        if (!socket || attaching || recording) return;

        Alert.alert('Share attachment', 'Choose what you want to send.', [
            {
                text: 'Media',
                onPress: () => pickAndSendAttachment([types.images, types.video, types.audio]),
            },
            {
                text: 'File',
                onPress: () => pickAndSendAttachment([types.allFiles]),
            },
            { text: 'Cancel', style: 'cancel' },
        ]);
    };

    const startVoiceRecord = async () => {
        if (!socket || attaching || recording) return;
        try {
            const ok = await requestRecordPermission();
            if (!ok) {
                Alert.alert('Microphone needed', 'Please allow microphone access to record a voice note.');
                return;
            }

            setRecordMs(0);
            setRecording(true);
            await recorderRef.current.startRecorder(undefined, recorderAudioSet, false);
            recorderRef.current.addRecordBackListener((event) => {
                setRecordMs(event.currentPosition || 0);
            });
        } catch (err) {
            setRecording(false);
            recorderRef.current.removeRecordBackListener();
            Alert.alert('Voice note', cleanAlertMessage(err?.message, 'Could not start recording.'));
        }
    };

    const stopVoiceRecord = async () => {
        if (!recording) return;
        try {
            const durationMs = recordMs;
            const uri = await recorderRef.current.stopRecorder();
            recorderRef.current.removeRecordBackListener();
            setRecording(false);

            if (durationMs < MIN_VOICE_MS) {
                setRecordMs(0);
                return;
            }

            setAttaching(true);
            const extension = Platform.OS === 'android' ? 'm4a' : 'm4a';
            const uploaded = await uploadChatFile({
                uri,
                name: `Voice note ${formatVoiceTime(durationMs)}.${extension}`,
                type: 'audio/mp4',
            });
            const message = buildLiveClassFileMessage({
                roomId,
                file: {
                    name: uploaded.name || `Voice note ${formatVoiceTime(durationMs)}.${extension}`,
                    type: uploaded.type || 'audio/mp4',
                    size: uploaded.size || 0,
                    url: uploaded.url,
                },
                senderId: userId || socket?.id,
                senderName: name,
                role,
                replyTo,
            });

            seenIdsRef.current.add(message.id);
            setMessages(prev => [...prev, message]);
            emitLiveClassChatMessage(socket, message);
            setReplyTo(null);
            setRecordMs(0);
            setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
        } catch (err) {
            Alert.alert('Voice note', cleanAlertMessage(err?.message, 'Could not send this recording.'));
        } finally {
            setRecording(false);
            setAttaching(false);
        }
    };

    const openAttachment = async (attachment) => {
        const uri = attachment?.url || attachment?.dataUrl;
        if (!uri) {
            Alert.alert('Open file', 'This file is not available.');
            return;
        }

        try {
            if (Platform.OS === 'android' && isMediaAttachment(attachment)) {
                const intentUrl = getAndroidViewIntentUrl(uri, attachment?.type);
                if (intentUrl) {
                    await Linking.openURL(intentUrl);
                    return;
                }
            }
            await Linking.openURL(uri);
        } catch (err) {
            try {
                await Linking.openURL(uri);
            } catch {
                Alert.alert('Open file', cleanAlertMessage(err?.message, 'Could not open this file.'));
            }
        }
    };

    const downloadAttachment = async (attachment) => {
        const uri = attachment?.url;
        const downloadUrl = getDownloadUrl(uri, attachment?.name);
        if (!downloadUrl) {
            Alert.alert('Download file', 'This file can be opened, but it is not available for download from the server.');
            return;
        }

        try {
            await Linking.openURL(downloadUrl);
        } catch (err) {
            Alert.alert('Download file', cleanAlertMessage(err?.message, 'Could not start download.'));
        }
    };

    const renderItem = ({ item }) => {
        const isMine = item.senderId === (userId || socket?.id);
        const isTeacher = item.role === 'host' || item.role === 'teacher';
        const attachment = item.attachment;
        const attachmentUri = attachment?.url || attachment?.dataUrl;
        const isImage = attachment?.type?.startsWith('image/') && attachmentUri;
        const replied = item.replyTo;

        return (
            <View style={[styles.messageRow, isMine && styles.messageRowMine]}>
                <View style={[styles.messageStack, isMine && styles.messageStackMine]}>
                    <View style={[styles.bubble, isMine && styles.bubbleMine]}>
                        {!isMine && (
                            <Text style={[styles.sender, isTeacher && styles.teacherSender]} numberOfLines={1}>
                                {item.senderName || 'User'}{isTeacher ? ' - Teacher' : ''}
                            </Text>
                        )}
                        {replied && (
                            <View style={[styles.replyBox, isMine && styles.replyBoxMine]}>
                                <Text style={styles.replySender} numberOfLines={1}>
                                    {replied.senderName || 'User'}
                                </Text>
                                <Text style={styles.replyText} numberOfLines={2}>
                                    {replied.hasAttachment ? 'Attachment: ' : ''}{replied.text || 'Message'}
                                </Text>
                            </View>
                        )}
                        {attachment ? (
                            <View style={styles.attachmentBox}>
                                {isImage ? (
                                    <TouchableOpacity
                                        activeOpacity={0.82}
                                        onPress={() => openAttachment(attachment)}
                                    >
                                        <Image source={{ uri: attachmentUri }} style={styles.imagePreview} />
                                    </TouchableOpacity>
                                ) : (
                                    <View style={styles.fileIconBox}>
                                        <AppIcon name={getAttachmentIcon(attachment)} size={22} color={colors.primary} />
                                    </View>
                                )}
                                <View style={styles.fileInfo}>
                                    <Text
                                        style={[styles.fileName, isMine && styles.messageTextMine]}
                                        numberOfLines={2}
                                    >
                                        {attachment.name || item.text || 'Attachment'}
                                    </Text>
                                    <Text style={styles.fileMeta} numberOfLines={1}>
                                        {(attachment.type || 'file')}{attachment.size ? ` - ${bytesToLabel(attachment.size)}` : ''}
                                    </Text>
                                    <View style={styles.fileActions}>
                                        <TouchableOpacity
                                            style={[styles.fileActionBtn, styles.fileActionBtnPrimary]}
                                            onPress={() => openAttachment(attachment)}
                                        >
                                            <AppIcon name="external-link-alt" size={11} color={colors.primary} />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={styles.fileActionBtn}
                                            onPress={() => downloadAttachment(attachment)}
                                        >
                                            <AppIcon name="download" size={11} color={colors.textMuted} />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        ) : (
                            <Text style={[styles.messageText, isMine && styles.messageTextMine]}>{item.text}</Text>
                        )}
                    </View>
                    <TouchableOpacity
                        style={[styles.replyAction, isMine && styles.replyActionMine]}
                        onPress={() => setReplyTo(buildReplyPreview(item))}
                    >
                        <AppIcon name="reply" size={10} color={colors.textMuted} />
                        <Text style={styles.replyActionText}>Reply</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    if (!visible) return null;

    const Panel = Platform.OS === 'ios' ? KeyboardAvoidingView : View;
    const panelProps =
        Platform.OS === 'ios'
            ? { behavior: 'padding', keyboardVerticalOffset: 0 }
            : {};
    const keyboardOpen = keyboardOverlap > 0;
    const panelStyle = keyboardOpen
        ? [
            styles.panelKeyboardOpen,
            {
                bottom: keyboardOverlap + CHAT_KEYBOARD_GAP,
                height: Math.max(260, windowHeight - keyboardOverlap - SPACING.xl),
            },
          ]
        : null;

    return (
        <Panel
            style={[
                styles.panel,
                panelStyle,
            ]}
            {...panelProps}
        >
            <View style={styles.handleWrap}>
                <View style={styles.handle} />
            </View>
            <View style={styles.header}>
                <View style={styles.titleRow}>
                    <AppIcon name="comments" size={15} color={colors.primary} />
                    <Text style={styles.title}>Class Chat</Text>
                </View>
                <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                    <AppIcon name="times" size={14} color={colors.textMuted} />
                </TouchableOpacity>
            </View>

            <FlatList
                ref={listRef}
                data={messages}
                keyExtractor={item => item.id}
                renderItem={renderItem}
                style={styles.list}
                contentContainerStyle={messages.length ? styles.messages : styles.emptyMessages}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
                ListEmptyComponent={
                    <View style={styles.emptyBox}>
                        <AppIcon name="comment-dots" size={24} color={colors.textMuted} />
                        <Text style={styles.emptyText}>No messages yet</Text>
                    </View>
                }
            />

            <View style={styles.composerWrap}>
                {replyTo && (
                    <View style={styles.composerReply}>
                        <View style={styles.composerReplyText}>
                            <Text style={styles.replySender} numberOfLines={1}>
                                Replying to {replyTo.senderName || 'User'}
                            </Text>
                            <Text style={styles.replyText} numberOfLines={1}>
                                {replyTo.hasAttachment ? 'Attachment: ' : ''}{replyTo.text || 'Message'}
                            </Text>
                        </View>
                        <TouchableOpacity style={styles.cancelReplyBtn} onPress={() => setReplyTo(null)}>
                            <AppIcon name="times" size={11} color={colors.textMuted} />
                        </TouchableOpacity>
                    </View>
                )}
                <View style={styles.composer}>
                    <TouchableOpacity
                        style={[styles.attachBtn, attaching && styles.sendBtnDisabled]}
                        onPress={sendAttachment}
                        disabled={attaching}
                    >
                        {attaching ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                            <AppIcon name="paperclip" size={15} color={colors.primary} />
                        )}
                    </TouchableOpacity>
                    <TextInput
                        style={styles.input}
                        placeholder={recording ? `Recording ${formatVoiceTime(recordMs)}` : 'Message the class...'}
                        placeholderTextColor={colors.textMuted}
                        value={draft}
                        onChangeText={setDraft}
                        multiline
                        maxLength={500}
                        editable={!recording}
                    />
                    <TouchableOpacity
                        style={[styles.voiceBtn, recording && styles.voiceBtnActive]}
                        onPress={recording ? stopVoiceRecord : startVoiceRecord}
                        disabled={attaching}
                    >
                        <AppIcon name={recording ? 'stop' : 'microphone'} size={14} color={recording ? '#FFFFFF' : colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.sendBtn, !draft.trim() && styles.sendBtnDisabled]}
                        onPress={sendMessage}
                        disabled={!draft.trim()}
                    >
                        <AppIcon name="paper-plane" size={14} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
            </View>
        </Panel>
    );
};

const makeStyles = (colors, bottomInset = 0) => StyleSheet.create({
    panel: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: Math.max(bottomInset, SPACING.sm),
        zIndex: 20,
        height: '58%',
        backgroundColor: colors.surface,
        borderTopLeftRadius: RADIUS.lg,
        borderTopRightRadius: RADIUS.lg,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
        elevation: 18,
        shadowColor: colors.overlay,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.18,
        shadowRadius: 18,
    },
    panelKeyboardOpen: {
        borderRadius: RADIUS.md,
    },
    handleWrap: {
        alignItems: 'center',
        paddingTop: SPACING.sm,
        paddingBottom: SPACING.xs,
        backgroundColor: colors.surfaceElevated,
    },
    handle: {
        width: 42,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.borderStrong || colors.border,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.md,
        paddingTop: SPACING.xs,
        paddingBottom: SPACING.sm,
        backgroundColor: colors.surfaceElevated,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { color: colors.text, fontSize: SIZES.sm, fontWeight: '800' },
    closeBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surfaceSubtle,
        borderWidth: 1,
        borderColor: colors.border,
    },
    list: { flex: 1 },
    messages: { padding: SPACING.md, gap: 8 },
    emptyMessages: { flexGrow: 1, justifyContent: 'center', padding: SPACING.md },
    emptyBox: { alignItems: 'center', gap: SPACING.sm },
    emptyText: { color: colors.textMuted, fontSize: SIZES.sm, fontWeight: '600' },
    messageRow: {
        flexDirection: 'row',
        justifyContent: 'flex-start',
        paddingHorizontal: 2,
    },
    messageRowMine: { justifyContent: 'flex-end' },
    messageStack: {
        maxWidth: '82%',
        alignItems: 'flex-start',
    },
    messageStackMine: { alignItems: 'flex-end' },
    bubble: {
        backgroundColor: colors.surfaceSubtle,
        borderRadius: RADIUS.md,
        borderBottomLeftRadius: RADIUS.xs,
        paddingHorizontal: SPACING.sm,
        paddingVertical: SPACING.sm,
        borderWidth: 1,
        borderColor: colors.border,
    },
    bubbleMine: {
        backgroundColor: colors.primary + '25',
        borderColor: colors.primary + '44',
        borderBottomLeftRadius: RADIUS.md,
        borderBottomRightRadius: RADIUS.xs,
    },
    sender: { color: colors.textMuted, fontSize: 10, fontWeight: '800', marginBottom: 2 },
    teacherSender: { color: colors.warning },
    messageText: { color: colors.text, fontSize: SIZES.sm, lineHeight: 18 },
    messageTextMine: { color: colors.text, fontWeight: '600' },
    replyBox: {
        marginBottom: 6,
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderLeftWidth: 3,
        borderLeftColor: colors.primary,
        borderRadius: RADIUS.xs,
        backgroundColor: colors.surfaceElevated,
    },
    replyBoxMine: { borderLeftColor: colors.primary },
    replySender: { color: colors.text, fontSize: 10, fontWeight: '800' },
    replyText: { color: colors.textMuted, fontSize: 11, lineHeight: 15, marginTop: 1 },
    replyAction: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 6,
        marginLeft: 2,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: colors.surfaceSubtle,
        borderWidth: 1,
        borderColor: colors.border,
    },
    replyActionMine: {
        alignSelf: 'flex-end',
        marginLeft: 0,
        marginRight: 2,
    },
    replyActionText: { color: colors.textMuted, fontSize: 10, fontWeight: '800' },
    attachmentBox: {
        minWidth: 210,
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
    },
    imagePreview: {
        width: 72,
        height: 72,
        borderRadius: RADIUS.sm,
        backgroundColor: colors.surfaceElevated,
    },
    fileIconBox: {
        width: 46,
        height: 46,
        borderRadius: RADIUS.sm,
        backgroundColor: colors.primary + '25',
        alignItems: 'center',
        justifyContent: 'center',
    },
    fileInfo: { flex: 1 },
    fileName: { color: colors.text, fontSize: SIZES.sm, fontWeight: '800', lineHeight: 18 },
    fileMeta: { color: colors.textMuted, fontSize: 10, marginTop: 3 },
    fileActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 8,
    },
    fileActionBtn: {
        width: 30,
        height: 30,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 15,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surfaceElevated,
    },
    fileActionBtnPrimary: {
        borderColor: colors.primary + '44',
        backgroundColor: colors.primary + '25',
    },
    composerWrap: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border,
        backgroundColor: colors.surfaceElevated,
    },
    composerReply: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        marginHorizontal: SPACING.sm,
        marginTop: SPACING.sm,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 7,
        borderRadius: RADIUS.sm,
        backgroundColor: colors.primary + '14',
        borderWidth: 1,
        borderColor: colors.primary + '33',
    },
    composerReplyText: { flex: 1 },
    cancelReplyBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surfaceSubtle,
    },
    composer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: SPACING.sm,
        padding: SPACING.sm,
    },
    attachBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary + '25',
        borderWidth: 1,
        borderColor: colors.primary + '25',
    },
    voiceBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary + '25',
        borderWidth: 1,
        borderColor: colors.primary + '25',
    },
    voiceBtnActive: { backgroundColor: colors.danger, borderColor: colors.danger },
    input: {
        flex: 1,
        minHeight: 40,
        maxHeight: 84,
        paddingHorizontal: SPACING.md,
        paddingVertical: Platform.OS === 'ios' ? 10 : 7,
        borderRadius: RADIUS.md,
        backgroundColor: colors.inputBg,
        color: colors.text,
        fontSize: SIZES.sm,
        borderWidth: 1,
        borderColor: colors.border,
    },
    sendBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primary,
    },
    sendBtnDisabled: { opacity: 0.45 },
});

export default LiveClassChat;
