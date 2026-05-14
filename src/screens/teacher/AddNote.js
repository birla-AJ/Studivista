import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Alert,
    Keyboard,
    KeyboardAvoidingView,
    PermissionsAndroid,
    Platform,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { errorCodes, isErrorWithCode, pick, types } from '@react-native-documents/picker';
import AudioRecorderPlayer, {
    AudioEncoderAndroidType,
    AudioSourceAndroidType,
    AVEncoderAudioQualityIOSType,
    AVEncodingOption,
    AVModeIOSOption,
    OutputFormatAndroidType,
} from 'react-native-audio-recorder-player';
import { SIZES, SPACING, RADIUS, SHADOWS } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';
import Header from '../../components/Header';
import Button from '../../components/Button';
import AppIcon from '../../components/AppIcon';
import {
    subscribeBatchesByTeacher,
    subscribeClassesByTeacher,
    createNote,
} from '../../services/firestoreService';
import { useAuth } from '../../contexts/AuthContext';
import { Toast } from '../../components/Toast';
import { formatDateLabel, formatTimeLabel } from '../../utils/format';

const NOTE_TYPES = [
    { key: 'text', label: 'Text', icon: 'file-alt' },
    { key: 'pdf', label: 'PDF', icon: 'file-pdf' },
    { key: 'image', label: 'Image', icon: 'image' },
    { key: 'video', label: 'Video', icon: 'video' },
    { key: 'audio', label: 'Audio', icon: 'music' },
    { key: 'voice', label: 'Voice', icon: 'microphone' },
    { key: 'link', label: 'Link', icon: 'link' },
];

const PICKER_TYPES = {
    pdf: [types.pdf],
    image: [types.images],
    video: [types.video],
    audio: [types.audio],
};

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

const normalizeUploadUri = uri =>
    Platform.OS === 'android' && uri && !uri.includes('://') ? `file://${uri}` : uri;

const bytesToLabel = bytes => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatMs = ms => {
    const seconds = Math.floor((ms || 0) / 1000);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

const requestRecordPermission = async () => {
    if (Platform.OS !== 'android') return true;
    const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    return result === PermissionsAndroid.RESULTS.GRANTED;
};

const AddNote = ({ navigation, route }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const { user, profile } = useAuth();
    const recorderRef = useRef(new AudioRecorderPlayer());
    const fixedBatchId = route?.params?.batchId || '';
    const fixedClassId = route?.params?.classId || '';
    const fixedBatchName = route?.params?.batchName || '';
    const disallowVideo = !!route?.params?.disallowVideo;

    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [linkUrl, setLinkUrl] = useState('');
    const [noteType, setNoteType] = useState('text');
    const [file, setFile] = useState(null);
    const [batches, setBatches] = useState([]);
    const [classes, setClasses] = useState([]);
    const [batchId, setBatchId] = useState(fixedBatchId);
    const [classId, setClassId] = useState(fixedClassId);
    const [saving, setSaving] = useState(false);
    const [progress, setProgress] = useState(0);
    const [recording, setRecording] = useState(false);
    const [recordMs, setRecordMs] = useState(0);

    useEffect(() => {
        if (!user?.uid) return;
        const u1 = subscribeBatchesByTeacher(user.uid, setBatches);
        const u2 = subscribeClassesByTeacher(user.uid, setClasses);
        return () => { u1?.(); u2?.(); };
    }, [user?.uid]);

    useEffect(() => () => {
        recorderRef.current.removeRecordBackListener();
        recorderRef.current.stopRecorder().catch(() => {});
    }, []);

    useEffect(() => {
        setFile(null);
        setContent('');
        setLinkUrl('');
        setProgress(0);
    }, [noteType]);

    const selectedBatch = batches.find(b => b.id === batchId);
    const selectedClass = classes.find(c => c.id === classId);
    const batchClasses = classes.filter(c => c.batchId === batchId);
    const canChooseBatch = !fixedBatchId;
    const selectableClasses = canChooseBatch ? classes : batchClasses;
    const availableTypes = disallowVideo ? NOTE_TYPES.filter(t => t.key !== 'video') : NOTE_TYPES;
    const batchNameForClass = cls => batches.find(b => b.id === cls.batchId)?.name || cls.batchName || 'Batch';

    const chooseFile = async () => {
        try {
            const [picked] = await pick({
                type: PICKER_TYPES[noteType] || [types.allFiles],
                allowMultiSelection: false,
            });
            if (picked) setFile(picked);
        } catch (e) {
            if (!isErrorWithCode(e) || e.code !== errorCodes.OPERATION_CANCELED) {
                Toast.error(e?.message || 'Could not pick file.', 'File picker');
            }
        }
    };

    const startRecording = async () => {
        if (!(await requestRecordPermission())) {
            Toast.warning('Microphone permission is required.', 'Permission needed');
            return;
        }
        try {
            setFile(null);
            setRecordMs(0);
            await recorderRef.current.startRecorder(undefined, recorderAudioSet, false);
            recorderRef.current.addRecordBackListener(e => {
                setRecordMs(e.currentPosition || 0);
            });
            setRecording(true);
        } catch (e) {
            Toast.error(e?.message || 'Could not start recording.', 'Voice note');
        }
    };

    const stopRecording = async () => {
        try {
            const uri = await recorderRef.current.stopRecorder();
            recorderRef.current.removeRecordBackListener();
            setRecording(false);
            if (uri) {
                setFile({
                    uri,
                    name: `voice-note-${Date.now()}.m4a`,
                    type: 'audio/m4a',
                    size: 0,
                });
            }
        } catch (e) {
            setRecording(false);
            Toast.error(e?.message || 'Could not stop recording.', 'Voice note');
        }
    };

    const validate = () => {
        if (!title.trim()) return 'Please add a title for the note.';
        if (!batchId) return 'Pick which batch should see this note.';
        if (noteType === 'text' && !content.trim()) return 'Please write some content.';
        if (noteType === 'link' && !linkUrl.trim()) return 'Please paste a link.';
        if (['pdf', 'image', 'video', 'audio', 'voice'].includes(noteType) && !file) {
            return noteType === 'voice' ? 'Record a voice memo first.' : 'Choose a file first.';
        }
        return '';
    };

    const handleSave = async () => {
        const message = validate();
        if (message) {
            Toast.warning(message, 'Missing details');
            return;
        }

        const formData = new FormData();
        formData.append('title', title.trim());
        formData.append('noteType', noteType);
        formData.append('batchId', selectedClass?.batchId || batchId);
        formData.append('batchName', selectedBatch?.name || selectedClass?.batchName || fixedBatchName || '');
        formData.append('teacherId', user.uid);
        formData.append('teacherName', profile?.name || '');
        if (classId) formData.append('classId', classId);
        if (noteType === 'text') formData.append('content', content.trim());
        if (noteType === 'link') formData.append('fileUrl', linkUrl.trim());
        if (file && noteType !== 'link' && noteType !== 'text') {
            formData.append('file', {
                uri: normalizeUploadUri(file.uri),
                name: file.name || `${noteType}-note`,
                type: file.type || (noteType === 'pdf' ? 'application/pdf' : 'application/octet-stream'),
            });
        }

        setSaving(true);
        setProgress(0);
        try {
            await createNote(formData, setProgress);
            Toast.success('Note published.');
            navigation.goBack();
        } catch (e) {
            Alert.alert('Could not publish note', e?.message || 'Please try again.');
        } finally {
            setSaving(false);
        }
    };

    const renderTypeInput = () => {
        if (noteType === 'text') {
            return (
                <>
                    <Text style={styles.label}>Note</Text>
                    <TextInput
                        style={[styles.input, styles.bodyInput]}
                        placeholder="Write the note content."
                        placeholderTextColor={colors.textMuted}
                        value={content}
                        onChangeText={setContent}
                        multiline
                        textAlignVertical="top"
                    />
                </>
            );
        }
        if (noteType === 'link') {
            return (
                <>
                    <Text style={styles.label}>Link</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="https://example.com/resource"
                        placeholderTextColor={colors.textMuted}
                        value={linkUrl}
                        onChangeText={setLinkUrl}
                        autoCapitalize="none"
                        keyboardType="url"
                    />
                </>
            );
        }
        if (noteType === 'voice') {
            return (
                <View style={styles.fileBox}>
                    <AppIcon name="microphone" size={26} color={colors.primary} />
                    <Text style={styles.fileTitle}>{recording ? `Recording ${formatMs(recordMs)}` : file ? file.name : 'Record a voice memo'}</Text>
                    <Text style={styles.fileSub}>{file ? 'Ready to upload' : 'Voice notes are saved as .m4a files.'}</Text>
                    <View style={styles.fileActions}>
                        <Button
                            label={recording ? 'Stop' : file ? 'Re-record' : 'Record'}
                            onPress={recording ? stopRecording : startRecording}
                            variant={recording ? 'danger' : 'primary'}
                        />
                    </View>
                </View>
            );
        }
        return (
            <View style={styles.fileBox}>
                <AppIcon name={NOTE_TYPES.find(t => t.key === noteType)?.icon || 'file-alt'} size={26} color={colors.primary} />
                <Text style={styles.fileTitle} numberOfLines={1} ellipsizeMode="middle">
                    {file?.name || `Choose ${noteType} file`}
                </Text>
                <Text style={styles.fileSub}>{file ? bytesToLabel(file.size) || file.type : 'Files upload to the class notes library.'}</Text>
                <View style={styles.fileActions}>
                    <Button label={file ? 'Change File' : 'Choose File'} onPress={chooseFile} />
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <Header title="New Note" subtitle={fixedClassId ? 'Attach to live class' : 'Share with your batch'} showBack onBack={() => navigation.goBack()} />

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={{ padding: SPACING.base, paddingBottom: SPACING.xxxl }}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    onScrollBeginDrag={Keyboard.dismiss}
                >
                    {canChooseBatch && (
                        <>
                            <Text style={styles.label}>Batch</Text>
                            {batches.length === 0 ? (
                                <Text style={styles.empty}>You don't have any batches yet.</Text>
                            ) : (
                                <View style={styles.chipsRow}>
                                    {batches.map(b => {
                                        const active = b.id === batchId;
                                        return (
                                            <TouchableOpacity
                                                key={b.id}
                                                style={[styles.chip, active && styles.chipActive]}
                                                onPress={() => { setBatchId(b.id); setClassId(''); }}
                                                activeOpacity={0.85}
                                            >
                                                <View style={[styles.chipDot, { backgroundColor: b.color || colors.primary }]} />
                                                <Text style={[styles.chipText, active && styles.chipTextActive]}>{b.name}</Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                            )}
                        </>
                    )}

                    {!fixedClassId && selectableClasses.length > 0 && (
                        <>
                            <Text style={styles.label}>Class link (optional)</Text>
                            {batchId && (
                                <TouchableOpacity
                                    style={[styles.classOption, !classId && styles.classOptionActive]}
                                    onPress={() => setClassId('')}
                                    activeOpacity={0.85}
                                >
                                    <View style={styles.classIcon}>
                                        <AppIcon name="users" size={14} color={colors.primary} />
                                    </View>
                                    <View style={styles.classTextWrap}>
                                        <Text style={styles.classTitle}>Batch-level note</Text>
                                        <Text style={styles.classSub}>{selectedBatch?.name || fixedBatchName || 'Selected batch'}</Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                            <View style={styles.classList}>
                                {selectableClasses.map(c => {
                                    const active = c.id === classId;
                                    return (
                                        <TouchableOpacity
                                            key={c.id}
                                            style={[styles.classOption, active && styles.classOptionActive]}
                                            onPress={() => {
                                                setClassId(c.id);
                                                if (c.batchId) setBatchId(c.batchId);
                                            }}
                                            activeOpacity={0.85}
                                        >
                                            <View style={styles.classIcon}>
                                                <AppIcon name="chalkboard-teacher" size={14} color={colors.primary} />
                                            </View>
                                            <View style={styles.classTextWrap}>
                                                <Text style={styles.classTitle} numberOfLines={1}>{c.title || 'Class'}</Text>
                                                <Text style={styles.classSub} numberOfLines={1}>
                                                    {batchNameForClass(c)}{c.scheduledAt ? ` - ${formatDateLabel(c.scheduledAt)} ${formatTimeLabel(c.scheduledAt)}` : ''}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </>
                    )}

                    <Text style={styles.label}>Type</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeRow}>
                        {availableTypes.map(t => {
                            const active = t.key === noteType;
                            return (
                                <TouchableOpacity
                                    key={t.key}
                                    style={[styles.typePill, active && styles.typePillActive]}
                                    onPress={() => setNoteType(t.key)}
                                    activeOpacity={0.85}
                                >
                                    <AppIcon name={t.icon} size={14} color={active ? '#FFFFFF' : colors.text} />
                                    <Text style={[styles.typeText, active && styles.typeTextActive]}>{t.label}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    <Text style={styles.label}>Title</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. Chapter 3 summary"
                        placeholderTextColor={colors.textMuted}
                        value={title}
                        onChangeText={setTitle}
                        maxLength={120}
                    />

                    {renderTypeInput()}

                    {saving && (
                        <View style={styles.progressTrack}>
                            <View style={[styles.progressFill, { width: `${Math.round(progress * 100)}%` }]} />
                        </View>
                    )}

                    <Button
                        label={saving ? `Publishing ${Math.round(progress * 100)}%` : 'Publish Note'}
                        onPress={handleSave}
                        loading={saving}
                        size="lg"
                        style={{ marginTop: SPACING.lg }}
                    />
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const makeStyles = colors => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { flex: 1 },
    label: { fontSize: SIZES.sm, color: colors.textMuted, fontWeight: '700', marginTop: SPACING.md, marginBottom: SPACING.sm },
    empty: { color: colors.warning, fontSize: SIZES.sm, paddingVertical: SPACING.md },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    chip: {
        flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
        maxWidth: '100%',
        paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
        backgroundColor: colors.surface, borderRadius: RADIUS.full,
        borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    },
    chipActive: { borderColor: colors.primary, backgroundColor: colors.primary + '22' },
    chipDot: { width: 8, height: 8, borderRadius: 4 },
    chipText: { color: colors.text, fontSize: SIZES.sm, fontWeight: '600' },
    chipTextActive: { color: colors.text },
    classList: { gap: SPACING.sm },
    classOption: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.md,
        backgroundColor: colors.surface,
        borderRadius: RADIUS.lg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        padding: SPACING.md,
        marginBottom: SPACING.sm,
    },
    classOptionActive: { borderColor: colors.primary, backgroundColor: colors.primary + '18' },
    classIcon: {
        width: 34,
        height: 34,
        borderRadius: RADIUS.md,
        backgroundColor: colors.primary + '18',
        alignItems: 'center',
        justifyContent: 'center',
    },
    classTextWrap: { flex: 1, minWidth: 0 },
    classTitle: { color: colors.text, fontSize: SIZES.sm, fontWeight: '900' },
    classSub: { color: colors.textMuted, fontSize: SIZES.xs, fontWeight: '600', marginTop: 2 },
    typeRow: { gap: SPACING.sm, paddingRight: SPACING.base },
    typePill: {
        height: 38,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingHorizontal: SPACING.md,
        borderRadius: RADIUS.full,
        backgroundColor: colors.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
    },
    typePillActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    typeText: { color: colors.text, fontSize: SIZES.sm, fontWeight: '800' },
    typeTextActive: { color: '#FFFFFF' },
    input: {
        backgroundColor: colors.inputBg, borderRadius: RADIUS.lg,
        borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
        paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
        color: colors.text, fontSize: SIZES.md, ...SHADOWS.small,
    },
    bodyInput: { minHeight: 190, paddingTop: SPACING.md },
    fileBox: {
        alignItems: 'center',
        gap: SPACING.sm,
        backgroundColor: colors.surface,
        borderRadius: RADIUS.lg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        padding: SPACING.lg,
        marginTop: SPACING.md,
    },
    fileTitle: { color: colors.text, fontSize: SIZES.md, fontWeight: '800', maxWidth: '100%' },
    fileSub: { color: colors.textMuted, fontSize: SIZES.xs, fontWeight: '600', textAlign: 'center' },
    fileActions: { marginTop: SPACING.sm, minWidth: 160 },
    progressTrack: {
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
        backgroundColor: colors.border,
        marginTop: SPACING.lg,
    },
    progressFill: { height: '100%', backgroundColor: colors.primary },
});

export default AddNote;
