import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, TextInput } from 'react-native';
import { SIZES, SPACING, RADIUS, SHADOWS } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';
import Header from '../../components/Header';
import AppIcon from '../../components/AppIcon';
import { deleteNote, subscribeClassesByTeacher, subscribeNotesByTeacher } from '../../services/firestoreService';
import { useAuth } from '../../contexts/AuthContext';
import { formatDateLabel, formatJoined, formatTimeLabel, tsToDate } from '../../utils/format';
import { Toast } from '../../components/Toast';

const ICONS = {
    text: 'file-alt',
    pdf: 'file-pdf',
    image: 'image',
    video: 'video',
    audio: 'music',
    voice: 'microphone',
    link: 'link',
};

const bytesToLabel = bytes => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const noteTime = note => tsToDate(note.createdAt)?.getTime?.() || 0;

const TeacherNotes = ({ navigation }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const { user } = useAuth();
    const [notes, setNotes] = useState([]);
    const [classes, setClasses] = useState([]);
    const [query, setQuery] = useState('');

    useEffect(() => {
        if (!user?.uid) return;
        const u1 = subscribeNotesByTeacher(user.uid, setNotes);
        const u2 = subscribeClassesByTeacher(user.uid, setClasses);
        return () => { u1?.(); u2?.(); };
    }, [user?.uid]);

    const classMap = useMemo(() => {
        const map = new Map();
        classes.forEach(c => map.set(c.id, c));
        return map;
    }, [classes]);

    const classLabel = useCallback(classId => {
        const cls = classMap.get(classId);
        if (!cls) return 'Class notes';
        const date = cls.scheduledAt ? `${formatDateLabel(cls.scheduledAt)} ${formatTimeLabel(cls.scheduledAt)}` : '';
        return `${cls.title || 'Class'}${date ? ` - ${date}` : ''}`;
    }, [classMap]);

    const data = useMemo(() => {
        const q = query.trim().toLowerCase();
        const filtered = notes
            .filter(n => !q || (n.title || '').toLowerCase().includes(q))
            .sort((a, b) => noteTime(b) - noteTime(a));
        const classNotes = filtered.filter(n => n.classId);
        const batchNotes = filtered.filter(n => !n.classId);
        const grouped = new Map();
        classNotes.forEach(n => {
            if (!grouped.has(n.classId)) grouped.set(n.classId, []);
            grouped.get(n.classId).push(n);
        });
        return [
            ...Array.from(grouped.entries()).flatMap(([classId, items]) => [
                { id: `section-${classId}`, section: true, title: classLabel(classId), count: items.length },
                ...items,
            ]),
            ...(batchNotes.length ? [{ id: 'section-batch', section: true, title: 'Batch-level Notes', count: batchNotes.length }, ...batchNotes] : []),
        ];
    }, [notes, query, classLabel]);

    const confirmDelete = item => {
        Alert.alert('Delete note?', 'This deletes the note and its uploaded file.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    const previous = notes;
                    setNotes(prev => prev.filter(n => n.id !== item.id));
                    try {
                        await deleteNote(item.id);
                    } catch (e) {
                        setNotes(previous);
                        Toast.error(e?.message || 'Please try again.', 'Could not delete');
                    }
                },
            },
        ]);
    };

    const renderItem = ({ item }) => {
        if (item.section) {
            return (
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>{item.title}</Text>
                    <Text style={styles.sectionCount}>{item.count}</Text>
                </View>
            );
        }
        return (
            <TouchableOpacity
                style={styles.card}
                onPress={() => navigation.navigate('NoteDetail', { note: item })}
                activeOpacity={0.85}
            >
                <View style={styles.iconWrap}>
                    <AppIcon name={ICONS[item.noteType] || 'sticky-note'} size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                    <View style={styles.metaRow}>
                        {!!item.classId && (
                            <>
                                <Text style={styles.meta}>{classMap.get(item.classId)?.title || 'Class'}</Text>
                                <Text style={styles.meta}>-</Text>
                            </>
                        )}
                        <Text style={styles.meta}>{item.batchName || 'No batch'}</Text>
                        <Text style={styles.meta}>-</Text>
                        <Text style={styles.meta}>{formatJoined(item.createdAt)}</Text>
                    </View>
                    {!!(item.fileName || item.content || item.body) && (
                        <Text style={styles.preview} numberOfLines={1} ellipsizeMode="middle">
                            {item.fileName || item.content || item.body}
                        </Text>
                    )}
                </View>
                {!!item.fileSize && (
                    <View style={styles.sizeBadge}>
                        <Text style={styles.sizeText}>{bytesToLabel(item.fileSize)}</Text>
                    </View>
                )}
                <TouchableOpacity style={styles.deleteBtn} onPress={() => confirmDelete(item)}>
                    <AppIcon name="trash" size={14} color={colors.danger} />
                </TouchableOpacity>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <Header title="Notes" subtitle="Your shared notes" showBack onBack={() => navigation.goBack()} />

            <View style={styles.searchWrap}>
                <AppIcon name="search" size={14} color={colors.textMuted} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search notes"
                    placeholderTextColor={colors.textMuted}
                    value={query}
                    onChangeText={setQuery}
                />
                {!!query && (
                    <TouchableOpacity onPress={() => setQuery('')}>
                        <AppIcon name="times" size={14} color={colors.textMuted} />
                    </TouchableOpacity>
                )}
            </View>

            <FlatList
                data={data}
                keyExtractor={n => n.id}
                renderItem={renderItem}
                contentContainerStyle={{ padding: SPACING.base, paddingBottom: 120 }}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <AppIcon name="sticky-note" size={32} color={colors.textMuted} />
                        <Text style={styles.emptyText}>No notes yet. Tap + to create your first note.</Text>
                    </View>
                }
            />

            <TouchableOpacity
                style={styles.fab}
                onPress={() => navigation.navigate('AddNote')}
                activeOpacity={0.85}
            >
                <AppIcon name="plus" size={20} color="#FFFFFF" />
            </TouchableOpacity>
        </SafeAreaView>
    );
};

const makeStyles = colors => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    searchWrap: {
        height: 44,
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        backgroundColor: colors.inputBg,
        borderRadius: RADIUS.lg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        paddingHorizontal: SPACING.md,
        margin: SPACING.base,
        marginBottom: 0,
    },
    searchInput: { flex: 1, color: colors.text, fontSize: SIZES.sm, fontWeight: '600' },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: SPACING.sm,
        marginBottom: SPACING.sm,
    },
    sectionTitle: { color: colors.text, fontSize: SIZES.sm, fontWeight: '900' },
    sectionCount: { color: colors.textMuted, fontSize: SIZES.xs, fontWeight: '800' },
    card: {
        flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
        backgroundColor: colors.surface, borderRadius: RADIUS.lg,
        padding: SPACING.md, marginBottom: SPACING.sm,
        borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...SHADOWS.small,
    },
    iconWrap: {
        width: 40, height: 40, borderRadius: RADIUS.md,
        backgroundColor: colors.primary + '22',
        alignItems: 'center', justifyContent: 'center',
    },
    title: { fontSize: SIZES.md, fontWeight: '800', color: colors.text, marginBottom: 2 },
    preview: { fontSize: SIZES.xs, color: colors.textMuted, lineHeight: 17, marginTop: 3 },
    metaRow: { flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' },
    meta: { fontSize: SIZES.xs, color: colors.textMuted, fontWeight: '600' },
    sizeBadge: {
        borderRadius: RADIUS.full,
        backgroundColor: colors.primary + '18',
        paddingHorizontal: SPACING.sm,
        paddingVertical: 5,
    },
    sizeText: { color: colors.primary, fontSize: 10, fontWeight: '900' },
    deleteBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    empty: { alignItems: 'center', gap: SPACING.md, paddingTop: SPACING.xxxl },
    emptyText: { color: colors.textMuted, fontSize: SIZES.sm, textAlign: 'center', paddingHorizontal: SPACING.xl },
    fab: {
        position: 'absolute', bottom: SPACING.xl, right: SPACING.xl,
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: colors.primary,
        alignItems: 'center', justifyContent: 'center',
        ...SHADOWS.primary,
    },
});

export default TeacherNotes;
