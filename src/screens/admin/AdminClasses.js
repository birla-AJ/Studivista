import React, { useEffect, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SIZES, SPACING, RADIUS, SHADOWS } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';
import Header from '../../components/Header';
import ClassCard from '../../components/ClassCard';
import BottomTabBar from '../../components/BottomTabBar';
import AppIcon from '../../components/AppIcon';
import { subscribeBatches, subscribeClasses } from '../../services/firestoreService';
import { tsToDate } from '../../utils/format';
import { useAuth } from '../../contexts/AuthContext';
import { Toast } from '../../components/Toast';

// Deterministic color per subject — same subject always gets the same color.
const SUBJECT_PALETTE = [
    '#F2A636', // amber
    '#16A34A', // green
    '#2563EB', // blue
    '#9333EA', // purple
    '#DC2626', // red
    '#0891B2', // cyan
    '#EA580C', // orange
    '#DB2777', // pink
    '#65A30D', // lime
    '#7C3AED', // violet
];
const colorForSubject = (name) => {
    if (!name) return SUBJECT_PALETTE[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
    return SUBJECT_PALETTE[hash % SUBJECT_PALETTE.length];
};

const AdminClasses = ({ navigation }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const { profile } = useAuth();
    const [active, setActive] = useState('AdminClasses');
    const [selectedSubject, setSelectedSubject] = useState('All');
    const [statusFilter, setStatusFilter] = useState('All'); // All | Live | Today | Upcoming | Done
    const [classes, setClasses] = useState(null);
    const [batches, setBatches] = useState([]);

    const joinClass = (cls) => {
        if (cls.status !== 'live') {
            Toast.info('This class is not live right now.');
            return;
        }
        navigation.navigate('LiveClass', {
            cls,
            roomId: cls.id,
            name: profile?.name || 'Admin',
            role: 'admin',
        });
    };

    useEffect(() => {
        const u1 = subscribeClasses(setClasses);
        const u2 = subscribeBatches(setBatches);
        return () => { u1?.(); u2?.(); };
    }, []);

    const handleNav = (screen) => {
        setActive(screen);
        const routes = {
            AdminDashboard: 'AdminDashboard', BatchList: 'BatchList',
            StudentList: 'StudentList', TeacherList: 'TeacherList',
        };
        if (routes[screen]) navigation.navigate(screen);
    };

    // 'All' stays first, real subjects sorted alphabetically below it.
    const subjects = useMemo(() => {
        const set = new Set();
        batches.forEach(b => b.subject && set.add(b.subject));
        const sorted = Array.from(set).sort((a, b) => a.localeCompare(b));
        return ['All', ...sorted];
    }, [batches]);

    const list = classes || [];

    const isToday = (cls) => {
        const d = tsToDate(cls.scheduledAt);
        if (!d) return false;
        const now = new Date();
        return d.getFullYear() === now.getFullYear()
            && d.getMonth() === now.getMonth()
            && d.getDate() === now.getDate();
    };

    const today = list.filter(isToday);

    // Apply status filter first so the per-subject counts respect it.
    const statusOnly = (() => {
        switch (statusFilter) {
            case 'Live':     return list.filter(c => c.status === 'live');
            case 'Today':    return list.filter(isToday);
            case 'Upcoming': return list.filter(c => c.status === 'scheduled');
            case 'Done':     return list.filter(c => c.status === 'completed');
            default:         return list;
        }
    })();

    const filtered = selectedSubject === 'All'
        ? statusOnly
        : statusOnly.filter(c => {
            const batch = batches.find(b => b.id === c.batchId);
            return batch?.subject === selectedSubject;
        });

    const countForSubject = (subj) => {
        if (subj === 'All') return statusOnly.length;
        return statusOnly.filter(c => {
            const batch = batches.find(b => b.id === c.batchId);
            return batch?.subject === subj;
        }).length;
    };

    return (
        <SafeAreaView style={styles.container}>
            <Header title="All Classes" subtitle="Platform-wide schedule" showBack onBack={() => navigation.goBack()} />

            <View style={styles.subjectHeader}>
                <AppIcon name="filter" size={11} color={colors.textMuted} />
                <Text style={styles.subjectHeaderText}>Filter by subject</Text>
            </View>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.subjectScroll}
                contentContainerStyle={styles.subjectScrollContent}
            >
                {subjects.map(b => {
                    const isActive = selectedSubject === b;
                    const c = b === 'All' ? colors.primary : colorForSubject(b);
                    const count = countForSubject(b);
                    return (
                        <TouchableOpacity
                            key={b}
                            activeOpacity={0.85}
                            style={[
                                styles.subjectChip,
                                { backgroundColor: c + '15', borderColor: c + '44' },
                                isActive && {
                                    backgroundColor: c,
                                    borderColor: c,
                                    shadowColor: c,
                                    shadowOpacity: 0.35,
                                    shadowOffset: { width: 0, height: 6 },
                                    shadowRadius: 12,
                                    elevation: 6,
                                },
                            ]}
                            onPress={() => setSelectedSubject(b)}
                        >
                            <View style={[styles.subjectDot, { backgroundColor: isActive ? '#FFFFFF' : c }]} />
                            <Text style={[
                                styles.subjectChipText,
                                { color: c },
                                isActive && styles.subjectChipTextActive,
                            ]}>
                                {b}
                            </Text>
                            <View style={[
                                styles.subjectCountPill,
                                isActive
                                    ? { backgroundColor: 'rgba(255,255,255,0.25)' }
                                    : { backgroundColor: c + '22' },
                            ]}>
                                <Text style={[
                                    styles.subjectCountText,
                                    { color: isActive ? '#FFFFFF' : c },
                                ]}>{count}</Text>
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                <View style={styles.statsRow}>
                    {[
                        { label: 'Live Now', filterKey: 'Live',     val: list.filter(c => c.status === 'live').length,      color: colors.primary,   icon: 'circle' },
                        { label: 'Today',    filterKey: 'Today',    val: today.length,                                       color: colors.secondary, icon: 'calendar-alt' },
                        { label: 'Upcoming', filterKey: 'Upcoming', val: list.filter(c => c.status === 'scheduled').length, color: colors.warning,   icon: 'clock' },
                        { label: 'Done',     filterKey: 'Done',     val: list.filter(c => c.status === 'completed').length, color: colors.success,   icon: 'check-circle' },
                    ].map(s => {
                        const isActive = statusFilter === s.filterKey;
                        return (
                            <TouchableOpacity
                                key={s.label}
                                activeOpacity={0.85}
                                style={[
                                    styles.statCard,
                                    { borderTopColor: s.color },
                                    isActive && { backgroundColor: s.color, borderColor: s.color },
                                ]}
                                // Tap an active filter to clear it back to "All"
                                onPress={() => setStatusFilter(isActive ? 'All' : s.filterKey)}
                            >
                                <AppIcon name={s.icon} size={18} color={isActive ? '#FFFFFF' : s.color} />
                                <Text style={[styles.statVal, { color: isActive ? '#FFFFFF' : s.color }]}>{s.val}</Text>
                                <Text style={[styles.statLbl, isActive && { color: '#FFFFFF' }]}>{s.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {(statusFilter !== 'All' || selectedSubject !== 'All') && (
                    <View style={styles.filterIndicator}>
                        <Text style={styles.filterIndicatorText}>
                            Showing {filtered.length} of {list.length}
                            {statusFilter !== 'All' ? ` · ${statusFilter}` : ''}
                            {selectedSubject !== 'All' ? ` · ${selectedSubject}` : ''}
                        </Text>
                        <TouchableOpacity onPress={() => { setStatusFilter('All'); setSelectedSubject('All'); }}>
                            <Text style={styles.filterClear}>Clear</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {classes === null ? (
                    <View style={styles.empty}>
                        <ActivityIndicator color={colors.primary} />
                    </View>
                ) : filtered.length === 0 ? (
                    <View style={styles.empty}>
                        <AppIcon name="calendar-alt" size={56} color={colors.textMuted} />
                        <Text style={styles.emptyTitle}>No Classes Yet</Text>
                        <Text style={styles.emptySub}>Classes scheduled by teachers will appear here.</Text>
                    </View>
                ) : (
                    filtered.map(cls => {
                        const batch = batches.find(b => b.id === cls.batchId);
                        const subjectColor = batch?.subject ? colorForSubject(batch.subject) : colors.primary;
                        return (
                            <ClassCard
                                key={cls.id}
                                cls={cls}
                                color={subjectColor}
                                totalStudents={batch?.studentIds?.length || 0}
                                onPress={() => joinClass(cls)}
                            />
                        );
                    })
                )}

                <View style={{ height: 100 }} />
            </ScrollView>

            <BottomTabBar activeScreen={active} onNavigate={handleNav} role="admin" />
        </SafeAreaView>
    );
};

const makeStyles = (colors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { flex: 1, paddingHorizontal: SPACING.base },
    subjectHeader: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        marginTop: SPACING.md, marginBottom: SPACING.xs,
        paddingHorizontal: SPACING.base,
    },
    subjectHeaderText: {
        color: colors.textMuted, fontSize: SIZES.xs, fontWeight: '700',
        letterSpacing: 0.5, textTransform: 'uppercase',
    },
    subjectScroll: {
        flexGrow: 0,
        maxHeight: 56,
        marginBottom: SPACING.md,
    },
    subjectScrollContent: {
        paddingHorizontal: SPACING.base,
        paddingRight: SPACING.xl,   // breathing room so last chip isn't flush against edge
        paddingVertical: SPACING.xs,
        gap: SPACING.sm,
        alignItems: 'center',
    },
    subjectChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
        borderRadius: RADIUS.full,
        borderWidth: 1,
    },
    subjectDot: { width: 8, height: 8, borderRadius: 4 },
    subjectChipText: {
        fontSize: SIZES.sm, fontWeight: '700', letterSpacing: 0.2,
    },
    subjectChipTextActive: { color: '#FFFFFF' },
    subjectCountPill: {
        minWidth: 22, height: 20, borderRadius: 10,
        paddingHorizontal: 6,
        alignItems: 'center', justifyContent: 'center',
        marginLeft: 4,
    },
    subjectCountText: { fontSize: SIZES.xs, fontWeight: '900' },
    statsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
    statCard: {
        flex: 1, backgroundColor: colors.surface, borderRadius: RADIUS.lg,
        padding: SPACING.sm, alignItems: 'center', borderTopWidth: 3,
        gap: 3, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...SHADOWS.small,
    },
    statVal: { fontSize: SIZES.xl, fontWeight: '900' },
    statLbl: { fontSize: 9, color: colors.textMuted, fontWeight: '600', textAlign: 'center' },
    filterIndicator: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs,
        marginBottom: SPACING.sm,
    },
    filterIndicatorText: { color: colors.textMuted, fontSize: SIZES.xs, fontWeight: '600' },
    filterClear: { color: colors.primary, fontSize: SIZES.xs, fontWeight: '800' },
    empty: { alignItems: 'center', paddingTop: 80, gap: SPACING.md },
    emptyTitle: { fontSize: SIZES.xl, fontWeight: '800', color: colors.text },
    emptySub: { color: colors.textMuted, fontSize: SIZES.sm, textAlign: 'center' },
});

export default AdminClasses;
