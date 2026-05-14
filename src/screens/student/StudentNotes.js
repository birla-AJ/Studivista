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
        return `${cls.title || 'Class'}${date ? ` - ${date}` : ''}`;
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
                { id: `section-${classId}`, section: true, title: classLabel(classId), count: items.length },
                ...items,
            ]);
        }
        return filtered;
    }, [notes, query, tab, classLabel]);

    const renderItem = ({ item }) => {
        if (item.section) {
            return (
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>{item.title}</Text>
                    <Text style={styles.sectionCount}>{item.count}</Text>
                </View>
            );
        }
        const unread = noteTime(item) > lastSeen;
        return (
            <TouchableOpacity
                style={[styles.card, unread && styles.cardUnread]}
                onPress={() => navigation.navigate('NoteDetail', { note: item })}
                activeOpacity={0.85}
            >
                <View style={styles.iconWrap}>
                    <AppIcon name={ICONS[item.noteType] || 'sticky-note'} size={18} color={colors.studentColor} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                    <View style={styles.metaRow}>
                        <Text style={styles.meta}>{item.teacherName || 'Teacher'}</Text>
                        <Text style={styles.meta}>-</Text>
                        {!!item.classId && (
                            <>
                                <Text style={styles.meta}>{classMap.get(item.classId)?.title || 'Class'}</Text>
                                <Text style={styles.meta}>-</Text>
                            </>
                        )}
                        <Text style={styles.meta}>{item.batchName || 'Batch'}</Text>
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
        height: 44,
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        backgroundColor: colors.inputBg,
        borderRadius: RADIUS.lg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        paddingHorizontal: SPACING.md,
    },
    searchInput: { flex: 1, color: colors.text, fontSize: SIZES.sm, fontWeight: '600' },
    tabs: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
    tab: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: SPACING.sm,
        borderRadius: RADIUS.full,
        backgroundColor: colors.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
    },
    tabActive: { backgroundColor: colors.studentColor, borderColor: colors.studentColor },
    tabText: { color: colors.text, fontSize: SIZES.xs, fontWeight: '900' },
    tabTextActive: { color: '#FFFFFF' },
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
    cardUnread: { borderLeftWidth: 4, borderLeftColor: colors.studentColor },
    iconWrap: {
        width: 40, height: 40, borderRadius: RADIUS.md,
        backgroundColor: colors.studentColor + '22',
        alignItems: 'center', justifyContent: 'center',
    },
    title: { fontSize: SIZES.md, fontWeight: '800', color: colors.text, marginBottom: 2 },
    preview: { fontSize: SIZES.xs, color: colors.textMuted, lineHeight: 17, marginTop: 3 },
    metaRow: { flexDirection: 'row', gap: 6, marginTop: 2, flexWrap: 'wrap' },
    meta: { fontSize: SIZES.xs, color: colors.textMuted, fontWeight: '600' },
    sizeBadge: {
        borderRadius: RADIUS.full,
        backgroundColor: colors.studentColor + '18',
        paddingHorizontal: SPACING.sm,
        paddingVertical: 5,
    },
    sizeText: { color: colors.studentColor, fontSize: 10, fontWeight: '900' },
    empty: { alignItems: 'center', gap: SPACING.md, paddingTop: SPACING.xxxl },
    emptyText: { color: colors.textMuted, fontSize: SIZES.sm, textAlign: 'center', paddingHorizontal: SPACING.xl },
});

export default StudentNotes;
