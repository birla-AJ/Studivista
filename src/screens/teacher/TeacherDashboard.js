import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, RefreshControl,
} from 'react-native';
import { SIZES, SPACING, RADIUS, SHADOWS } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';
import Header from '../../components/Header';
import ClassCard from '../../components/ClassCard';
import BottomTabBar from '../../components/BottomTabBar';
import AppIcon from '../../components/AppIcon';
import {
    subscribeBatchesByTeacher, subscribeClassesByTeacher,
    subscribeUsersByRole, startLiveClass,
    subscribeNotesByTeacher,
    subscribeNotificationsForUser,
} from '../../services/firestoreService';
import { useAuth } from '../../contexts/AuthContext';
import { tsToDate } from '../../utils/format';
import { Toast } from '../../components/Toast';

const TeacherDashboard = ({ navigation }) => {
    const { colors, toggle, isDark } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [active, setActive] = useState('TeacherDashboard');
    const { user, profile } = useAuth();
    const [batches, setBatches] = useState([]);
    const [classes, setClasses] = useState([]);
    const [students, setStudents] = useState([]);
    const [notes, setNotes] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        if (!user?.uid) return;
        const u1 = subscribeBatchesByTeacher(user.uid, setBatches);
        const u2 = subscribeClassesByTeacher(user.uid, setClasses);
        const u3 = subscribeUsersByRole('student', setStudents);
        const u4 = subscribeNotesByTeacher(user.uid, setNotes);
        return () => { u1?.(); u2?.(); u3?.(); u4?.(); };
    }, [user?.uid, refreshKey]);

    useEffect(() => {
        if (!user?.uid) return;
        return subscribeNotificationsForUser(user.uid, list => {
            setUnreadCount((list || []).filter(n => !n.read).length);
        });
    }, [user?.uid]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        setRefreshKey(k => k + 1);
        setTimeout(() => setRefreshing(false), 800);
    }, []);

    const myBatchIds = useMemo(() => batches.map(b => b.id), [batches]);
    const myStudents = students.filter(s => (s.batchIds || []).some(b => myBatchIds.includes(b)));

    const todayClasses = classes.filter(c => {
        const d = tsToDate(c.scheduledAt);
        if (!d) return false;
        const now = new Date();
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    });
    const upcoming = classes.filter(c => c.status === 'scheduled');

    const handleNav = (screen) => {
        setActive(screen);
        const routes = {
            MyClasses: 'MyClasses', Attendance: 'Attendance',
            Recordings: 'Recordings', TeacherStudents: 'TeacherStudents',
        };
        if (routes[screen]) navigation.navigate(screen);
    };

    const handleStartClass = async (cls) => {
        try {
            await startLiveClass(cls.id);
            navigation.navigate('LiveClass', {
                cls,
                roomId: cls.id,
                name: profile?.name || 'Teacher',
                role: 'teacher',
            });
        } catch (e) {
            Toast.error(e?.message || 'Please try again.', 'Could not start class');
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <Header
                title="Studivista"
                subtitle="Teacher Portal"
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
                        <AppIcon name="chalkboard-teacher" size={24} color={colors.teacherColor} />
                    </View>
                    <View style={{ flex: 1, marginLeft: SPACING.md }}>
                        <Text style={styles.greeting}>Welcome,</Text>
                        <Text style={styles.teacherName}>{profile?.name || '—'}</Text>
                        {!!profile?.subject && (
                            <View style={styles.inlineMeta}>
                                <AppIcon name="square-root-alt" size={12} color={colors.textMuted} />
                                <Text style={styles.subject}>{profile.subject}</Text>
                            </View>
                        )}
                    </View>
                    <TouchableOpacity
                        style={styles.scheduleBtn}
                        onPress={() => navigation.navigate('ScheduleClass')}
                    >
                        <Text style={styles.scheduleBtnText}>+ Schedule</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.statsRow}>
                    {[
                        { label: "Today's Classes", value: todayClasses.length, icon: 'calendar-alt', color: colors.primary, screen: 'MyClasses' },
                        { label: 'My Students', value: myStudents.length, icon: 'graduation-cap', color: colors.secondary, screen: 'TeacherStudents' },
                        { label: 'My Batches', value: batches.length, icon: 'users', color: colors.success, screen: 'MyClasses' },
                        { label: 'Upcoming', value: upcoming.length, icon: 'clock', color: colors.warning, screen: 'MyClasses' },
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

                {todayClasses.length > 0 && (
                    <>
                        <View style={styles.sectionTitleRow}>
                            <AppIcon name="calendar-alt" size={14} color={colors.text} />
                            <Text style={styles.sectionTitle}>Today's Classes</Text>
                        </View>
                        {todayClasses.map(cls => {
                            const batch = batches.find(b => b.id === cls.batchId);
                            const total = batch?.studentIds?.length || 0;
                            return (
                                <View key={cls.id}>
                                    <ClassCard
                                        cls={cls}
                                        totalStudents={total}
                                        onPress={() => {
                                            if (cls.status === 'live') navigation.navigate('LiveClass', {
                                                cls,
                                                roomId: cls.id,
                                                name: profile?.name || 'Teacher',
                                                role: 'teacher',
                                            });
                                            else navigation.navigate('ScheduleClass', { cls });
                                        }}
                                    />
                                    {cls.status === 'scheduled' && (
                                        <TouchableOpacity style={styles.startBtn} onPress={() => handleStartClass(cls)}>
                                            <AppIcon name="microphone" size={14} color="#FFFFFF" />
                                            <Text style={styles.startBtnText}>Start Class & Notify Students</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                            );
                        })}
                    </>
                )}

                <Text style={styles.sectionTitle}>Quick Actions</Text>
                <View style={styles.quickActions}>
                    {[
                        { icon: 'calendar-alt', label: 'Schedule Class', screen: 'ScheduleClass', color: colors.primary },
                        { icon: 'graduation-cap', label: 'Add Student', screen: 'AddStudent', color: colors.studentColor },
                        { icon: 'sticky-note', label: 'Notes', screen: 'TeacherNotes', color: colors.warning },
                        { icon: 'check-circle', label: 'Attendance', screen: 'Attendance', color: colors.success },
                    ].map(a => (
                        <TouchableOpacity
                            key={a.label}
                            style={[styles.quickAction, { borderColor: a.color + '33' }]}
                            onPress={() => navigation.navigate(a.screen, a.params)}
                            activeOpacity={0.8}
                        >
                            <AppIcon name={a.icon} size={24} color={a.color} />
                            <Text style={styles.quickActionLabel}>{a.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {upcoming.length > 0 && (
                    <>
                        <View style={styles.sectionRow}>
                            <Text style={styles.sectionTitle}>Upcoming Classes</Text>
                            <TouchableOpacity onPress={() => navigation.navigate('MyClasses')}>
                                <Text style={styles.seeAll}>See all ›</Text>
                            </TouchableOpacity>
                        </View>
                        {upcoming.slice(0, 2).map(cls => {
                            const batch = batches.find(b => b.id === cls.batchId);
                            return (
                                <ClassCard
                                    key={cls.id}
                                    cls={cls}
                                    totalStudents={batch?.studentIds?.length || 0}
                                    onPress={() => navigation.navigate('ScheduleClass', { cls })}
                                />
                            );
                        })}
                    </>
                )}

                <Text style={styles.sectionTitle}>Notes</Text>
                <TouchableOpacity
                    style={styles.notesChip}
                    onPress={() => navigation.navigate('TeacherNotes')}
                    activeOpacity={0.85}
                >
                    <View style={[styles.noteIcon, { backgroundColor: colors.primary + '22' }]}>
                        <AppIcon name="sticky-note" size={18} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.notesChipTitle}>All Notes</Text>
                        <Text style={styles.notesChipSub}>
                            {notes.length === 0
                                ? 'No notes yet — tap to create one'
                                : `${notes.length} note${notes.length === 1 ? '' : 's'} for your batches`}
                        </Text>
                    </View>
                    <View style={[styles.notesCountPill, { backgroundColor: colors.primary }]}>
                        <Text style={styles.notesCountText}>{notes.length}</Text>
                    </View>
                </TouchableOpacity>

                <View style={{ height: 100 }} />
            </ScrollView>

            <BottomTabBar activeScreen={active} onNavigate={handleNav} role="teacher" />
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
        backgroundColor: colors.teacherColor + '20',
        alignItems: 'center', justifyContent: 'center',
    },
    greeting: { fontSize: SIZES.sm, color: colors.textMuted },
    teacherName: { fontSize: SIZES.lg, fontWeight: '800', color: colors.text },
    subject: { fontSize: SIZES.sm, color: colors.textMuted },
    inlineMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
    scheduleBtn: { backgroundColor: colors.primary, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.full },
    scheduleBtnText: { color: '#FFFFFF', fontSize: SIZES.sm, fontWeight: '700' },
    statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.sm },
    statBox: {
        flex: 1, minWidth: '45%', backgroundColor: colors.surface,
        borderRadius: RADIUS.lg, padding: SPACING.md, borderTopWidth: 3, ...SHADOWS.small,
    },
    statIcon: { marginBottom: 4 },
    statVal: { fontSize: SIZES.xxl, fontWeight: '900' },
    statLbl: { fontSize: SIZES.xs, color: colors.textMuted, fontWeight: '600', marginTop: 2 },
    sectionTitle: { fontSize: SIZES.base, fontWeight: '800', color: colors.text, marginTop: SPACING.base, marginBottom: SPACING.sm },
    sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.base, marginBottom: SPACING.sm },
    seeAll: { color: colors.primary, fontSize: SIZES.sm, fontWeight: '600' },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.base, marginBottom: SPACING.sm },
    startBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: SPACING.sm, backgroundColor: colors.primary, borderRadius: RADIUS.lg,
        paddingVertical: SPACING.md, marginTop: -SPACING.sm, marginBottom: SPACING.md,
        ...SHADOWS.primary,
    },
    startBtnText: { color: '#FFFFFF', fontSize: SIZES.md, fontWeight: '800' },
    quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    quickAction: {
        flex: 1, minWidth: '45%', backgroundColor: colors.surface,
        borderRadius: RADIUS.lg, padding: SPACING.md, alignItems: 'center',
        gap: SPACING.sm, borderWidth: 1, ...SHADOWS.small,
    },
    quickActionLabel: { fontSize: SIZES.sm, color: colors.text, fontWeight: '700', textAlign: 'center' },
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

export default TeacherDashboard;
