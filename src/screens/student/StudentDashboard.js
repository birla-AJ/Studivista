import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SIZES, SPACING, RADIUS, SHADOWS } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';
import Header from '../../components/Header';
import ClassCard from '../../components/ClassCard';
import BottomTabBar from '../../components/BottomTabBar';
import AppIcon from '../../components/AppIcon';
import {
    subscribeClassesByBatches,
    subscribeBatchesByIds,
    subscribeNotesByBatches,
    subscribeNotificationsForUser,
} from '../../services/firestoreService';
import { useAuth } from '../../contexts/AuthContext';
import { tsToDate } from '../../utils/format';

const StudentDashboard = ({ navigation }) => {
    const { colors, toggle, isDark } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [active, setActive] = useState('StudentDashboard');
    const { profile } = useAuth();
    const [classes, setClasses] = useState([]);
    const [batches, setBatches] = useState([]);
    const [notes, setNotes] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [unreadCount, setUnreadCount] = useState(0);
    const [notesLastSeen, setNotesLastSeen] = useState(0);
    const batchIds = useMemo(() => profile?.batchIds || [], [profile?.batchIds]);

    useEffect(() => {
        if (batchIds.length === 0) {
            setClasses([]); setBatches([]); setNotes([]);
            return;
        }
        const u1 = subscribeClassesByBatches(batchIds, setClasses);
        const u2 = subscribeBatchesByIds(batchIds, setBatches);
        const u3 = subscribeNotesByBatches(batchIds, setNotes);
        return () => { u1?.(); u2?.(); u3?.(); };
    }, [batchIds, refreshKey]);

    useEffect(() => {
        if (!profile?.uid) return;
        return subscribeNotificationsForUser(profile.uid, list => {
            setUnreadCount((list || []).filter(n => !n.read).length);
        });
    }, [profile?.uid]);

    useEffect(() => {
        const loadLastSeen = () => {
            AsyncStorage.getItem('notes_last_seen')
                .then(value => setNotesLastSeen(Number(value || 0)))
                .catch(() => setNotesLastSeen(0));
        };
        loadLastSeen();
        const unsub = navigation.addListener?.('focus', loadLastSeen);
        return unsub;
    }, [navigation]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        setRefreshKey(k => k + 1);
        setTimeout(() => setRefreshing(false), 800);
    }, []);

    const handleNav = (screen) => {
        setActive(screen);
        const routes = {
            JoinClass: 'JoinClass', StudentRecordings: 'StudentRecordings',
            StudentAttendance: 'StudentAttendance',
        };
        if (routes[screen]) navigation.navigate(routes[screen]);
    };

    const liveNow = classes.find(c => c.status === 'live');
    const upcoming = classes.filter(c => c.status === 'scheduled');
    const completed = classes.filter(c => c.status === 'completed');

    const todayCount = useMemo(() => classes.filter(c => {
        const d = tsToDate(c.scheduledAt);
        if (!d) return false;
        const now = new Date();
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    }).length, [classes]);

    const totalForBatch = (batchId) => batches.find(b => b.id === batchId)?.studentIds?.length || 0;
    const newNotesCount = useMemo(() => notes.filter(n => {
        const date = tsToDate(n.createdAt);
        return date && date.getTime() > notesLastSeen;
    }).length, [notes, notesLastSeen]);

    return (
        <SafeAreaView style={styles.container}>
            <Header
                title="Studivista"
                subtitle="Student Portal"
                rightComponent={
                    <View style={styles.rightRow}>
                        <TouchableOpacity onPress={toggle}>
                            <AppIcon name={isDark ? 'sun' : 'moon'} size={18} color={colors.text} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => navigation.navigate('Notifications')}>
                            <View style={{ position: 'relative' }}>
                                <AppIcon name="bell" size={20} color={colors.text} />
                                {unreadCount > 0 && <View style={styles.notifDot} />}
                            </View>
                        </TouchableOpacity>
                    </View>
                }
            />

            <ScrollView
                style={styles.scroll}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={colors.primary}
                        colors={[colors.primary]}
                    />
                }
            >
                <View style={styles.profileCard}>
                    <View style={styles.profileBadge}>
                        <AppIcon name="graduation-cap" size={24} color={colors.studentColor} />
                    </View>
                    <View style={{ flex: 1, marginLeft: SPACING.md }}>
                        <Text style={styles.greeting}>Hello,</Text>
                        <Text style={styles.studentName}>{profile?.name || '—'}</Text>
                        <View style={styles.inlineMeta}>
                            <AppIcon name="book-open" size={12} color={colors.textMuted} />
                            <Text style={styles.batch}>
                                {batches[0]?.name || 'No batch yet'}
                                {batches.length > 1 ? ` +${batches.length - 1}` : ''}
                            </Text>
                        </View>
                    </View>
                    <TouchableOpacity style={styles.joinBtn} onPress={() => navigation.navigate('JoinClass')}>
                        <Text style={styles.joinBtnText}>Join Class</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.statsRow}>
                    {[
                        { label: 'My Batches', value: batches.length, icon: 'users', color: colors.primary, screen: 'JoinClass' },
                        { label: 'Today', value: todayCount, icon: 'calendar-alt', color: colors.success, screen: 'JoinClass' },
                        { label: 'Upcoming', value: upcoming.length, icon: 'clock', color: colors.secondary, screen: 'JoinClass' },
                        { label: 'Completed', value: completed.length, icon: 'check-circle', color: colors.warning, screen: 'StudentRecordings' },
                    ].map(stat => (
                        <TouchableOpacity
                            key={stat.label}
                            style={[styles.statBox, { borderTopColor: stat.color }]}
                            onPress={() => navigation.navigate(stat.screen)}
                            activeOpacity={0.85}
                        >
                            <AppIcon name={stat.icon} size={20} color={stat.color} style={styles.statIcon} />
                            <Text style={[styles.statVal, { color: stat.color }]}>{stat.value}</Text>
                            <Text style={styles.statLbl}>{stat.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {liveNow && (
                    <>
                        <View style={styles.sectionTitleRow}>
                            <AppIcon name="circle" size={10} color={colors.primary} />
                            <Text style={styles.sectionTitle}>Class is Live!</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.liveBanner}
                            onPress={() => {
                                const inBatch = (profile?.batchIds || []).includes(liveNow.batchId);
                                const params = { roomId: liveNow.id, name: profile?.name || 'Student', cls: liveNow };
                                navigation.navigate(inBatch ? 'LiveClass' : 'Waiting', inBatch ? { ...params, role: 'student' } : params);
                            }}
                            activeOpacity={0.85}
                        >
                            <View style={styles.liveBannerLeft}>
                                <View style={styles.liveAnimDot} />
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.liveBannerTitle}>{liveNow.title}</Text>
                                    <Text style={styles.liveBannerSub}>
                                        {liveNow.teacherName} • {liveNow.joinedStudentIds?.length || 0} joined
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.joinNowBtn}>
                                <Text style={styles.joinNowText}>JOIN NOW</Text>
                            </View>
                        </TouchableOpacity>
                    </>
                )}

                {batches.length === 0 ? (
                    <View style={styles.noticeCard}>
                        <AppIcon name="info-circle" size={20} color={colors.warning} />
                        <Text style={styles.noticeText}>
                            You're not in any batch yet. Ask your teacher to add you to a batch.
                        </Text>
                    </View>
                ) : upcoming.length > 0 && (
                    <>
                        <View style={styles.sectionTitleRow}>
                            <AppIcon name="calendar-alt" size={14} color={colors.text} />
                            <Text style={styles.sectionTitle}>Upcoming Classes</Text>
                        </View>
                        {upcoming.slice(0, 3).map(cls => (
                            <ClassCard
                                key={cls.id}
                                cls={cls}
                                totalStudents={totalForBatch(cls.batchId)}
                                onPress={() => navigation.navigate('JoinClass', { cls })}
                            />
                        ))}
                    </>
                )}

                <Text style={styles.sectionTitle}>Quick Access</Text>
                <View style={styles.quickGrid}>
                    {[
                        { icon: 'broadcast-tower', label: 'Join Class', screen: 'JoinClass', color: colors.primary },
                        { icon: 'graduation-cap', label: 'Courses', screen: 'StudentCourses', color: '#7C3AED' },
                        { icon: 'sticky-note', label: 'Notes', screen: 'StudentNotes', color: colors.studentColor },
                        { icon: 'check-circle', label: 'My Attendance', screen: 'StudentAttendance', color: colors.success },
                        { icon: 'bell', label: 'Notifications', screen: 'Notifications', color: colors.warning },
                    ].map(a => (
                        <TouchableOpacity
                            key={a.label}
                            style={[styles.quickCard, { borderColor: a.color + '33' }]}
                            onPress={() => navigation.navigate(a.screen)}
                            activeOpacity={0.8}
                        >
                            {a.screen === 'StudentNotes' && newNotesCount > 0 && (
                                <View style={styles.quickBadge}>
                                    <Text style={styles.quickBadgeText}>{newNotesCount > 99 ? '99+' : newNotesCount}</Text>
                                </View>
                            )}
                            <View style={[styles.quickIcon, { backgroundColor: a.color + '20' }]}>
                                <AppIcon name={a.icon} size={28} color={a.color} />
                            </View>
                            <Text style={styles.quickLabel}>{a.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <Text style={styles.sectionTitle}>Notes from Teachers</Text>
                <TouchableOpacity
                    style={styles.notesChip}
                    onPress={() => navigation.navigate('StudentNotes')}
                    activeOpacity={0.85}
                >
                    <View style={[styles.noteIcon, { backgroundColor: colors.studentColor + '22' }]}>
                        <AppIcon name="sticky-note" size={18} color={colors.studentColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.notesChipTitle}>All Notes</Text>
                        <Text style={styles.notesChipSub}>
                            {notes.length === 0
                                ? 'No notes yet from your teachers'
                                : newNotesCount > 0
                                    ? `${newNotesCount} new of ${notes.length} note${notes.length === 1 ? '' : 's'}`
                                    : `${notes.length} note${notes.length === 1 ? '' : 's'} from your teachers`}
                        </Text>
                    </View>
                    <View style={[styles.notesCountPill, { backgroundColor: colors.studentColor }]}>
                        <Text style={styles.notesCountText}>{newNotesCount || notes.length}</Text>
                    </View>
                </TouchableOpacity>

                <View style={{ height: 100 }} />
            </ScrollView>

            <BottomTabBar activeScreen={active} onNavigate={handleNav} role="student" />
        </SafeAreaView>
    );
};

const makeStyles = (colors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { flex: 1, paddingHorizontal: SPACING.base },
    rightRow: { flexDirection: 'row', gap: SPACING.base, alignItems: 'center' },
    notifDot: {
        position: 'absolute', top: -2, right: -2,
        width: 8, height: 8, borderRadius: 4,
        backgroundColor: colors.primary, borderWidth: 1, borderColor: colors.headerBg,
    },
    profileCard: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.surface, borderRadius: RADIUS.xl,
        padding: SPACING.base, marginVertical: SPACING.md,
        borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    },
    profileBadge: {
        width: 52, height: 52, borderRadius: 18,
        backgroundColor: colors.studentColor + '20',
        alignItems: 'center', justifyContent: 'center',
    },
    greeting: { fontSize: SIZES.sm, color: colors.textMuted },
    studentName: { fontSize: SIZES.lg, fontWeight: '800', color: colors.text },
    batch: { fontSize: SIZES.sm, color: colors.textMuted },
    inlineMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
    joinBtn: { backgroundColor: colors.primary, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.full },
    joinBtnText: { color: '#FFFFFF', fontSize: SIZES.sm, fontWeight: '700' },
    statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.sm },
    statBox: {
        flex: 1, minWidth: '45%', backgroundColor: colors.surface,
        borderRadius: RADIUS.lg, padding: SPACING.md, borderTopWidth: 3, ...SHADOWS.small,
    },
    statIcon: { marginBottom: 4 },
    statVal: { fontSize: SIZES.xl, fontWeight: '900' },
    statLbl: { fontSize: SIZES.xs, color: colors.textMuted, fontWeight: '600', marginTop: 2 },
    sectionTitle: { fontSize: SIZES.base, fontWeight: '800', color: colors.text, marginTop: SPACING.base, marginBottom: SPACING.sm },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.base, marginBottom: SPACING.sm },
    liveBanner: {
        backgroundColor: colors.primary + '18', borderRadius: RADIUS.xl,
        padding: SPACING.base, marginBottom: SPACING.md,
        borderWidth: 1.5, borderColor: colors.primary + '44',
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    liveBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, flex: 1 },
    liveAnimDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary },
    liveBannerTitle: { fontSize: SIZES.md, fontWeight: '800', color: colors.text },
    liveBannerSub: { fontSize: SIZES.xs, color: colors.textMuted, marginTop: 2 },
    joinNowBtn: { backgroundColor: colors.primary, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.full },
    joinNowText: { color: '#FFFFFF', fontSize: SIZES.xs, fontWeight: '800', letterSpacing: 0.5 },
    noticeCard: {
        flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
        backgroundColor: colors.warning + '15', borderRadius: RADIUS.md,
        padding: SPACING.md, marginVertical: SPACING.md,
        borderWidth: 1, borderColor: colors.warning + '33',
    },
    noticeText: { flex: 1, color: colors.warning, fontSize: SIZES.sm, lineHeight: 20 },
    quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    quickCard: {
        flex: 1, minWidth: '45%', backgroundColor: colors.surface,
        borderRadius: RADIUS.lg, padding: SPACING.md, alignItems: 'center',
        gap: SPACING.sm, borderWidth: 1, ...SHADOWS.small,
        position: 'relative',
    },
    quickBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        minWidth: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 5,
        zIndex: 2,
    },
    quickBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
    quickIcon: { width: 56, height: 56, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
    quickLabel: { fontSize: SIZES.sm, color: colors.text, fontWeight: '700', textAlign: 'center' },
    sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.base, marginBottom: SPACING.sm },
    seeAll: { color: colors.primary, fontSize: SIZES.sm, fontWeight: '600' },
    notesChip: {
        flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
        backgroundColor: colors.surface, borderRadius: RADIUS.lg,
        padding: SPACING.md,
        borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
        ...SHADOWS.small,
    },
    noteIcon: {
        width: 40, height: 40, borderRadius: RADIUS.md,
        alignItems: 'center', justifyContent: 'center',
    },
    notesChipTitle: { color: colors.text, fontSize: SIZES.md, fontWeight: '800' },
    notesChipSub: { color: colors.textMuted, fontSize: SIZES.xs, marginTop: 2 },
    notesCountPill: {
        minWidth: 32, height: 28, borderRadius: 14,
        paddingHorizontal: SPACING.sm,
        alignItems: 'center', justifyContent: 'center',
    },
    notesCountText: { color: '#FFFFFF', fontSize: SIZES.sm, fontWeight: '900' },
});

export default StudentDashboard;
