import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Linking,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Pdf from 'react-native-pdf';
import RNBlobUtil from 'react-native-blob-util';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import { SIZES, SPACING, RADIUS, SHADOWS } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import Header from '../components/Header';
import AppIcon from '../components/AppIcon';
import { deleteNote, getNote } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { formatJoined, formatTimeLabel } from '../utils/format';
import { Toast } from '../components/Toast';

const typeMeta = {
    text: { label: 'Text', icon: 'file-alt', mime: 'text/plain' },
    pdf: { label: 'PDF', icon: 'file-pdf', mime: 'application/pdf' },
    image: { label: 'Image', icon: 'image', mime: 'image/*' },
    video: { label: 'Video', icon: 'video', mime: 'video/mp4' },
    audio: { label: 'Audio', icon: 'music', mime: 'audio/*' },
    voice: { label: 'Voice', icon: 'microphone', mime: 'audio/m4a' },
    link: { label: 'Link', icon: 'link', mime: 'text/uri-list' },
};

const bytesToLabel = bytes => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatMs = ms => {
    const seconds = Math.floor((ms || 0) / 1000);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

const NoteDetail = ({ navigation, route }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const playerRef = useRef(new AudioRecorderPlayer());
    const initialNote = route?.params?.note || null;
    const noteId = route?.params?.noteId || initialNote?.id;
    const [note, setNote] = useState(initialNote);
    const [loading, setLoading] = useState(!initialNote && !!noteId);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [downloading, setDownloading] = useState(false);
    const [pages, setPages] = useState(0);
    const [currentPage, setCurrentPage] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [position, setPosition] = useState(0);
    const [duration, setDuration] = useState(0);
    const { user, profile } = useAuth();

    const noteType = note?.noteType || 'text';
    const meta = typeMeta[noteType] || typeMeta.text;
    const isOwner = profile?.role === 'admin' || (profile?.role === 'teacher' && user?.uid === note?.teacherId);

    useEffect(() => {
        let alive = true;
        if (!initialNote && noteId) {
            setLoading(true);
            getNote(noteId)
                .then(item => { if (alive) setNote(item); })
                .catch(e => Toast.error(e?.message || 'Could not load note.', 'Note unavailable'))
                .finally(() => { if (alive) setLoading(false); });
        }
        return () => { alive = false; };
    }, [initialNote, noteId]);

    useEffect(() => () => {
        playerRef.current.removePlayBackListener();
        playerRef.current.stopPlayer().catch(() => {});
    }, []);

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <Header title="Note" showBack onBack={() => navigation.goBack()} />
                <View style={styles.center}>
                    <ActivityIndicator color={colors.primary} />
                    <Text style={styles.empty}>Loading note...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (!note) {
        return (
            <SafeAreaView style={styles.container}>
                <Header title="Note" showBack onBack={() => navigation.goBack()} />
                <Text style={styles.empty}>Note not found.</Text>
            </SafeAreaView>
        );
    }

    const stopAudio = async () => {
        playerRef.current.removePlayBackListener();
        await playerRef.current.stopPlayer().catch(() => {});
        setPlaying(false);
        setPosition(0);
    };

    const toggleAudio = async () => {
        if (playing) {
            await stopAudio();
            return;
        }
        try {
            await playerRef.current.startPlayer(note.fileUrl);
            setPlaying(true);
            playerRef.current.addPlayBackListener(e => {
                setPosition(e.currentPosition || 0);
                setDuration(e.duration || note.durationSec * 1000 || 0);
                if (e.duration && e.currentPosition >= e.duration) stopAudio();
            });
        } catch (e) {
            Toast.error(e?.message || 'Could not play audio.', 'Playback failed');
        }
    };

    const handleDelete = () => {
        Alert.alert('Delete note?', 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    try {
                        await deleteNote(note.id);
                        navigation.goBack();
                    } catch (e) {
                        Toast.error(e?.message || 'Please try again.', 'Could not delete');
                    }
                },
            },
        ]);
    };

    const downloadNote = async () => {
        if (!note.fileUrl || noteType === 'link') return;
        const fileName = note.fileName || `${note.title || 'studivista-note'}.${noteType}`;
        const destPath = `${RNBlobUtil.fs.dirs.DownloadDir}/${fileName}`;
        setDownloading(true);
        setDownloadProgress(0);
        try {
            const token = await AsyncStorage.getItem('sv_token');
            await RNBlobUtil.config({
                path: destPath,
                addAndroidDownloads: {
                    useDownloadManager: true,
                    notification: true,
                    title: fileName,
                    description: 'Studivista note',
                    mime: meta.mime,
                },
            })
                .fetch('GET', note.fileUrl, token ? { Authorization: `Bearer ${token}` } : {})
                .progress((received, total) => {
                    if (total) setDownloadProgress(received / total);
                });
            Toast.success(fileName, 'Saved to Downloads');
        } catch (e) {
            Toast.error(e?.message || 'Download failed.', 'Download failed');
        } finally {
            setDownloading(false);
        }
    };

    const renderBody = () => {
        if (noteType === 'text') {
            return (
                <View style={styles.bodyCard}>
                    <Text style={styles.body}>{note.content || note.body}</Text>
                </View>
            );
        }
        if (noteType === 'pdf') {
            return (
                <View style={styles.viewer}>
                    <Pdf
                        source={{ uri: note.fileUrl }}
                        style={styles.pdf}
                        trustAllCerts={false}
                        onLoadComplete={count => setPages(count)}
                        onPageChanged={page => setCurrentPage(page)}
                        onError={e => Toast.error(e?.message || 'Could not render PDF.', 'PDF error')}
                    />
                    {pages > 0 && <Text style={styles.viewerFooter}>Page {currentPage || 1} of {pages}</Text>}
                </View>
            );
        }
        if (noteType === 'image') {
            return (
                <ScrollView style={styles.viewer} maximumZoomScale={4} minimumZoomScale={1} contentContainerStyle={styles.imageWrap}>
                    <Image source={{ uri: note.fileUrl }} style={styles.image} resizeMode="contain" />
                </ScrollView>
            );
        }
        if (noteType === 'video') {
            return (
                <TouchableOpacity
                    style={styles.playCard}
                    onPress={() => navigation.navigate('VideoPlayer', { url: note.fileUrl, title: note.title })}
                    activeOpacity={0.85}
                >
                    <AppIcon name="play-circle" size={54} color={colors.primary} />
                    <Text style={styles.playTitle}>Play video</Text>
                    <Text style={styles.playSub} numberOfLines={1} ellipsizeMode="middle">{note.fileName || note.fileUrl}</Text>
                </TouchableOpacity>
            );
        }
        if (noteType === 'audio' || noteType === 'voice') {
            const pct = duration ? Math.min(1, position / duration) : 0;
            return (
                <View style={styles.playCard}>
                    <TouchableOpacity style={styles.roundBtn} onPress={toggleAudio}>
                        <AppIcon name={playing ? 'pause' : 'play'} size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Text style={styles.playTitle}>{playing ? 'Playing' : meta.label}</Text>
                    <View style={styles.audioTrack}>
                        <View style={[styles.audioFill, { width: `${pct * 100}%` }]} />
                    </View>
                    <Text style={styles.playSub}>{formatMs(position)} / {formatMs(duration || (note.durationSec || 0) * 1000)}</Text>
                </View>
            );
        }
        if (noteType === 'link') {
            return (
                <View style={styles.bodyCard}>
                    <Text style={styles.linkText} numberOfLines={2}>{note.fileUrl}</Text>
                    <TouchableOpacity style={styles.openBtn} onPress={() => Linking.openURL(note.fileUrl)}>
                        <AppIcon name="external-link-alt" size={14} color="#FFFFFF" />
                        <Text style={styles.openBtnText}>Open Link</Text>
                    </TouchableOpacity>
                </View>
            );
        }
        return null;
    };

    return (
        <SafeAreaView style={styles.container}>
            <Header
                title="Note"
                subtitle={note.batchName || ''}
                showBack
                onBack={() => navigation.goBack()}
                rightComponent={isOwner ? (
                    <TouchableOpacity onPress={handleDelete}>
                        <AppIcon name="trash" size={18} color={colors.text} />
                    </TouchableOpacity>
                ) : null}
            />

            <ScrollView style={styles.scroll} contentContainerStyle={{ padding: SPACING.base, paddingBottom: SPACING.xxxl }}>
                <View style={styles.typeRow}>
                    <View style={styles.typePill}>
                        <AppIcon name={meta.icon} size={14} color={colors.primary} />
                        <Text style={styles.typeText}>{meta.label}</Text>
                    </View>
                    {!!note.fileSize && <Text style={styles.sizeText}>{bytesToLabel(note.fileSize)}</Text>}
                </View>
                <Text style={styles.title}>{note.title}</Text>

                <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                        <AppIcon name="user" size={12} color={colors.textMuted} />
                        <Text style={styles.metaText}>{note.teacherName || 'Teacher'}</Text>
                    </View>
                    <View style={styles.metaItem}>
                        <AppIcon name="calendar-alt" size={12} color={colors.textMuted} />
                        <Text style={styles.metaText}>
                            {formatJoined(note.createdAt)}{note.createdAt ? ` - ${formatTimeLabel(note.createdAt)}` : ''}
                        </Text>
                    </View>
                </View>

                {renderBody()}

                {!!note.fileUrl && noteType !== 'link' && (
                    <>
                        {downloading && (
                            <View style={styles.progressTrack}>
                                <View style={[styles.progressFill, { width: `${Math.round(downloadProgress * 100)}%` }]} />
                            </View>
                        )}
                        <TouchableOpacity style={styles.downloadBtn} onPress={downloadNote} disabled={downloading}>
                            <AppIcon name="download" size={14} color="#FFFFFF" />
                            <Text style={styles.downloadText}>{downloading ? `Downloading ${Math.round(downloadProgress * 100)}%` : 'Download'}</Text>
                        </TouchableOpacity>
                    </>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

const makeStyles = colors => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { flex: 1 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
    empty: { color: colors.textMuted, textAlign: 'center', marginTop: SPACING.xxxl, fontSize: SIZES.sm },
    typeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
    typePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        alignSelf: 'flex-start',
        backgroundColor: colors.primary + '18',
        borderRadius: RADIUS.full,
        paddingHorizontal: SPACING.md,
        paddingVertical: 6,
    },
    typeText: { color: colors.primary, fontSize: SIZES.xs, fontWeight: '900' },
    sizeText: { color: colors.textMuted, fontSize: SIZES.xs, fontWeight: '800' },
    title: { fontSize: SIZES.xl, fontWeight: '900', color: colors.text, marginBottom: SPACING.sm },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginBottom: SPACING.lg },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    metaText: { color: colors.textMuted, fontSize: SIZES.xs, fontWeight: '600' },
    bodyCard: {
        backgroundColor: colors.surface, borderRadius: RADIUS.lg,
        borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
        padding: SPACING.lg,
    },
    body: { color: colors.text, fontSize: SIZES.md, lineHeight: 24 },
    viewer: {
        height: 520,
        backgroundColor: colors.surface,
        borderRadius: RADIUS.lg,
        overflow: 'hidden',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
    },
    pdf: { flex: 1, width: '100%', backgroundColor: colors.surface },
    viewerFooter: { color: colors.textMuted, fontSize: SIZES.xs, fontWeight: '700', textAlign: 'center', padding: SPACING.sm },
    imageWrap: { minHeight: 520, alignItems: 'center', justifyContent: 'center' },
    image: { width: '100%', height: 500 },
    playCard: {
        minHeight: 210,
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.sm,
        backgroundColor: colors.surface,
        borderRadius: RADIUS.lg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        padding: SPACING.lg,
        ...SHADOWS.small,
    },
    playTitle: { color: colors.text, fontSize: SIZES.md, fontWeight: '900' },
    playSub: { color: colors.textMuted, fontSize: SIZES.xs, fontWeight: '600', textAlign: 'center' },
    roundBtn: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    audioTrack: {
        width: '100%',
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
        backgroundColor: colors.border,
    },
    audioFill: { height: '100%', backgroundColor: colors.primary },
    linkText: { color: colors.primary, fontSize: SIZES.sm, fontWeight: '700', marginBottom: SPACING.md },
    openBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.sm,
        backgroundColor: colors.primary,
        borderRadius: RADIUS.md,
        padding: SPACING.md,
    },
    openBtnText: { color: '#FFFFFF', fontSize: SIZES.sm, fontWeight: '800' },
    progressTrack: {
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
        backgroundColor: colors.border,
        marginTop: SPACING.lg,
    },
    progressFill: { height: '100%', backgroundColor: colors.primary },
    downloadBtn: {
        marginTop: SPACING.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: SPACING.sm,
        backgroundColor: colors.primary,
        borderRadius: RADIUS.md,
        padding: SPACING.md,
    },
    downloadText: { color: '#FFFFFF', fontSize: SIZES.sm, fontWeight: '900' },
});

export default NoteDetail;
