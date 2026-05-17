import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SIZES, SPACING, RADIUS, SHADOWS } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';
import Header from '../../components/Header';
import AppIcon from '../../components/AppIcon';
import { subscribeClassesByBatches, subscribeNotesByBatches } from '../../services/firestoreService';
import { useAuth } from '../../contexts/AuthContext';
import { formatDateLabel, formatJoined, formatTimeLabel, tsToDate } from '../../utils/format';

const TABS = ['All', 'By Class', 'Batch-level'];
const ICONS = {
    text: 'file-alt',
    pdf: 'file-pdf',
    image: 'image',
    video: 'video',
    audio: 'music',
    voice: 'microphone',
    link: 'link',
};

const TYPE_LABELS = {
    pdf: 'PDF Document',
    image: 'Image',
    video: 'Video',
    audio: 'Audio',
    voice: 'Voice Note',
    link: 'Link',
    text: 'Text Note',
};

const fileTypeLabel = note => {
    const base = TYPE_LABELS[note.noteType];
    const ext = (note.fileName || '').split('.').pop();
    if (ext && ext.length <= 5 && ext !== note.fileName) {
        return `${base || 'File'} • ${ext.toUpperCase()}`;
    }
    return base || 'File';
};

const previewFor = note => {
    if (note.fileName) return fileTypeLabel(note);
    return note.content || note.body || '';
};

// Vibrant palette — each entry pairs a deeper "rail" color with a lighter "tile" tint.
// Cards get a stable color based on classId / batchId so the same class always looks the same.
const PALETTE = [
    { rail: '#6366F1', tile: '#EEF2FF', strong: '#4F46E5' }, // indigo
    { rail: '#EC4899', tile: '#FCE7F3', strong: '#DB2777' }, // pink
    { rail: '#06B6D4', tile: '#CFFAFE', strong: '#0891B2' }, // cyan
    { rail: '#10B981', tile: '#D1FAE5', strong: '#059669' }, // emerald
    { rail: '#F59E0B', tile: '#FEF3C7', strong: '#D97706' }, // amber
    { rail: '#8B5CF6', tile: '#EDE9FE', strong: '#7C3AED' }, // violet
    { rail: '#14B8A6', tile: '#CCFBF1', strong: '#0D9488' }, // teal
    { rail: '#F43F5E', tile: '#FFE4E6', strong: '#E11D48' }, // rose
];
const BATCH_PALETTE = { rail: '#0F172A', tile: '#E2E8F0', strong: '#1E293B' }; // slate — for batch-level notes

const hashString = (str = '') => {
    let h = 0;
    for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) | 0;
    return Math.abs(h);
};

const paletteFor = note => {
    if (!note.classId) return BATCH_PALETTE;
    const key = note.classId || note.batchId || note.id || 'x';
    return PALETTE[hashString(key) % PALETTE.length];
};

const bytesToLabel = bytes => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const noteTime = note => tsToDate(note.createdAt)?.getTime?.() || 0;

const StudentNotes = ({ navigation }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const { profile } = useAuth();
    const [notes, setNotes] = useState([]);
    const [classes, setClasses] = useState([]);
    const [query, setQuery] = useState('');
    const [tab, setTab] = useState('All');
    const [lastSeen, setLastSeen] = useState(0);
    const batchIds = useMemo(() => profile?.batchIds || [], [profile?.batchIds]);
    const batchKey = batchIds.join(',');

    useEffect(() => {
        AsyncStorage.getItem('notes_last_seen')
            .then(value => setLastSeen(Number(value || 0)))
            .finally(() => AsyncStorage.setItem('notes_last_seen', String(Date.now())).catch(() => {}));
    }, []);

    useEffect(() => {
        const u1 = subscribeNotesByBatches(batchIds, setNotes);
        const u2 = subscribeClassesByBatches(batchIds, setClasses);
        return () => { u1?.(); u2?.(); };
    }, [batchIds, batchKey]);

    const classMap = useMemo(() => {
        const map = new Map();
        classes.forEach(c => map.set(c.id, c));
        return map;
    }, [classes]);

    const classLabel = useCallback(classId => {
        const cls = classMap.get(classId);
        if (!cls) return 'Class notes';
        const date = cls.scheduledAt ? `${formatDateLabel(cls.scheduledAt)} ${formatTimeLabel(cls.scheduledAt)}` : '';
        return `${cls.title || 'Class'}${date ? ` • ${date}` : ''}`;
    }, [classMap]);

    const filteredData = useMemo(() => {
        const q = query.trim().toLowerCase();
        const filtered = notes
            .filter(n => !q || (n.title || '').toLowerCase().includes(q))
            .sort((a, b) => noteTime(b) - noteTime(a));

        if (tab === 'Batch-level') return filtered.filter(n => !n.classId);
        if (tab === 'By Class') {
            const grouped = new Map();
            filtered.filter(n => n.classId).forEach(n => {
                const key = n.classId;
                if (!grouped.has(key)) grouped.set(key, []);
                grouped.get(key).push(n);
            });
            return Array.from(grouped.entries()).flatMap(([classId, items]) => [
                { id: `section-${classId}`, section: true, classId, title: classLabel(classId), count: items.length },
                ...items,
            ]);
        }
        return filtered;
    }, [notes, query, tab, classLabel]);

    const renderItem = ({ item }) => {
        if (item.section) {
            const pal = PALETTE[hashString(item.classId || '') % PALETTE.length];
            return (
                <View style={[styles.sectionHeader, { backgroundColor: pal.tile, borderColor: pal.rail + '55' }]}>
                    <View style={[styles.sectionDot, { backgroundColor: pal.rail }]} />
                    <Text style={[styles.sectionTitle, { color: pal.strong }]} numberOfLines={1}>{item.title}</Text>
                    <View style={[styles.sectionBadge, { backgroundColor: pal.rail }]}>
                        <Text style={styles.sectionBadgeText}>{item.count}</Text>
                    </View>
                </View>
            );
        }

        const pal = paletteFor(item);
        const unread = noteTime(item) > lastSeen;
        const isBatch = !item.classId;

        return (
            <TouchableOpacity
                style={styles.card}
                onPress={() => navigation.navigate('NoteDetail', { note: item })}
                activeOpacity={0.85}
            >
                <View style={[styles.rail, { backgroundColor: pal.rail }]} />
                <View style={[styles.iconWrap, { backgroundColor: pal.tile }]}>
                    <AppIcon name={ICONS[item.noteType] || 'sticky-note'} size={18} color={pal.strong} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.titleRow}>
                        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                        {unread && <View style={[styles.unreadDot, { backgroundColor: pal.rail }]} />}
                    </View>
                    <View style={styles.chipRow}>
                        {isBatch ? (
                            <View style={[styles.chip, { backgroundColor: pal.tile, borderColor: pal.rail + '40' }]}>
                                <AppIcon name="layer-group" size={9} color={pal.strong} />
                                <Text style={[styles.chipText, { color: pal.strong }]} numberOfLines={1}>
                                    {item.batchName || 'Batch'}
                                </Text>
                            </View>
                        ) : (
                            <View style={[styles.chip, { backgroundColor: pal.tile, borderColor: pal.rail + '40' }]}>
                                <AppIcon name="chalkboard" size={9} color={pal.strong} />
                                <Text style={[styles.chipText, { color: pal.strong }]} numberOfLines={1}>
                                    {classMap.get(item.classId)?.title || 'Class'}
                                </Text>
                            </View>
                        )}
                        {!!item.teacherName && (
                            <Text style={styles.meta} numberOfLines={1}>{item.teacherName}</Text>
                        )}
                    </View>
                    {!!previewFor(item) && (
                        <Text style={styles.preview} numberOfLines={1} ellipsizeMode="middle">
                            {previewFor(item)}
                        </Text>
                    )}
                    <View style={styles.bottomRow}>
                        <Text style={styles.timeText}>{formatJoined(item.createdAt)}</Text>
                        {!!item.fileSize && (
                            <View style={[styles.sizeBadge, { backgroundColor: pal.tile }]}>
                                <Text style={[styles.sizeText, { color: pal.strong }]}>{bytesToLabel(item.fileSize)}</Text>
                            </View>
                        )}
                    </View>
                </View>
                <AppIcon name="chevron-right" size={12} color={colors.textMuted} />
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <Header title="Notes" subtitle="Notes from your teachers" showBack onBack={() => navigation.goBack()} />

            <View style={styles.topContent}>
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
                <View style={styles.tabs}>
                    {TABS.map(name => {
                        const active = tab === name;
                        return (
                            <TouchableOpacity
                                key={name}
                                style={[styles.tab, active && styles.tabActive]}
                                onPress={() => setTab(name)}
                                activeOpacity={0.85}
                            >
                                <Text style={[styles.tabText, active && styles.tabTextActive]}>{name}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            <FlatList
                data={filteredData}
                keyExtractor={n => n.id}
                renderItem={renderItem}
                contentContainerStyle={{ padding: SPACING.base, paddingBottom: SPACING.xxxl }}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <AppIcon name="sticky-note" size={32} color={colors.textMuted} />
                        <Text style={styles.emptyText}>No notes yet.</Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
};

const makeStyles = colors => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    topContent: { paddingHorizontal: SPACING.base, paddingTop: SPACING.sm },
    searchWrap: {
        height: 48,
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        backgroundColor: colors.inputBg,
        borderRadius: RADIUS.full,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        paddingHorizontal: SPACING.base,
    },
    searchInput: { flex: 1, color: colors.text, fontSize: SIZES.sm, fontWeight: '600' },
    tabs: {
        flexDirection: 'row',
        gap: SPACING.xs,
        marginTop: SPACING.md,
        backgroundColor: colors.surfaceSubtle,
        borderRadius: RADIUS.full,
        padding: 4,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: SPACING.sm,
        borderRadius: RADIUS.full,
    },
    tabActive: {
        backgroundColor: colors.surface,
        ...SHADOWS.small,
    },
    tabText: { color: colors.textMuted, fontSize: SIZES.xs, fontWeight: '800' },
    tabTextActive: { color: colors.text },

    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm + 2,
        borderRadius: RADIUS.md,
        borderWidth: StyleSheet.hairlineWidth,
        marginTop: SPACING.md,
        marginBottom: SPACING.sm,
    },
    sectionDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    sectionTitle: { flex: 1, fontSize: SIZES.sm, fontWeight: '900', letterSpacing: 0.2 },
    sectionBadge: {
        minWidth: 22,
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: RADIUS.full,
        alignItems: 'center',
    },
    sectionBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },

    card: {
        flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
        backgroundColor: colors.surface, borderRadius: RADIUS.lg,
        padding: SPACING.md, paddingLeft: SPACING.md + 8,
        marginBottom: SPACING.sm,
        borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
        overflow: 'hidden',
        ...SHADOWS.small,
    },
    rail: {
        position: 'absolute',
        top: 0, bottom: 0, left: 0,
        width: 5,
    },
    iconWrap: {
        width: 44, height: 44, borderRadius: RADIUS.md,
        alignItems: 'center', justifyContent: 'center',
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    title: { flex: 1, fontSize: SIZES.md, fontWeight: '800', color: colors.text },
    unreadDot: { width: 8, height: 8, borderRadius: 4 },

    chipRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: 4, flexWrap: 'wrap' },
    chip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 3,
        borderRadius: RADIUS.full,
        borderWidth: StyleSheet.hairlineWidth,
        maxWidth: '70%',
    },
    chipText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.2 },
    meta: { fontSize: SIZES.xs, color: colors.textMuted, fontWeight: '600' },

    preview: { fontSize: SIZES.xs, color: colors.textMuted, lineHeight: 17, marginTop: 4 },
    bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
    timeText: { fontSize: 10, color: colors.textMuted, fontWeight: '700' },
    sizeBadge: {
        borderRadius: RADIUS.full,
        paddingHorizontal: SPACING.sm,
        paddingVertical: 3,
    },
    sizeText: { fontSize: 10, fontWeight: '900' },

    empty: { alignItems: 'center', gap: SPACING.md, paddingTop: SPACING.xxxl },
    emptyText: { color: colors.textMuted, fontSize: SIZES.sm, textAlign: 'center', paddingHorizontal: SPACING.xl },
});

export default StudentNotes;
