import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, RefreshControl,
} from 'react-native';
import { SIZES, SPACING, RADIUS, SHADOWS } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';
import BottomTabBar from '../../components/BottomTabBar';
import Header from '../../components/Header';
import AppIcon from '../../components/AppIcon';
import { subscribeBatches, subscribeClasses, subscribeUsersByRole } from '../../services/firestoreService';
import { useAuth } from '../../contexts/AuthContext';
import { tsToDate } from '../../utils/format';

const StatCard = ({ label, value, icon, color, sub, onPress }) => {
    const { colors } = useTheme();
    return (
        <TouchableOpacity
            style={[
                cardStyles.statCard,
                { borderLeftColor: color, backgroundColor: colors.surface },
                SHADOWS.small,
            ]}
            onPress={onPress}
            activeOpacity={0.85}
            disabled={!onPress}
        >
            <AppIcon name={icon} size={22} color={color} style={cardStyles.statIcon} />
            <Text style={[cardStyles.statValue, { color }]}>{value}</Text>
            <Text style={[cardStyles.statLabel, { color: colors.textMuted }]}>{label}</Text>
            {sub ? <Text style={[cardStyles.statSub, { color: colors.textMuted }]}>{sub}</Text> : null}
        </TouchableOpacity>
    );
};

const cardStyles = StyleSheet.create({
    statCard: { flex: 1, minWidth: '45%', borderRadius: RADIUS.lg, padding: SPACING.md, borderLeftWidth: 3 },
    statIcon: { marginBottom: 4 },
    statValue: { fontSize: SIZES.xxl, fontWeight: '900' },
    statLabel: { fontSize: SIZES.xs, fontWeight: '600', marginTop: 2 },
    statSub: { fontSize: SIZES.xs, marginTop: 2 },
});

const AdminDashboard = ({ navigation }) => {
    const { colors, toggle, isDark } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [active, setActive] = useState('AdminDashboard');
    const { profile } = useAuth();
    const [teachers, setTeachers] = useState([]);
    const [students, setStudents] = useState([]);
    const [batches, setBatches] = useState([]);
    const [classes, setClasses] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        const u1 = subscribeUsersByRole('teacher', setTeachers);
        const u2 = subscribeUsersByRole('student', setStudents);
        const u3 = subscribeBatches(setBatches);
        const u4 = subscribeClasses(setClasses);
        return () => { u1?.(); u2?.(); u3?.(); u4?.(); };
    }, [refreshKey]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        setRefreshKey(k => k + 1);
        setTimeout(() => setRefreshing(false), 800);
    }, []);

    const ROUTES = {
        TeacherList: 'TeacherList', BatchList: 'BatchList',
        StudentList: 'StudentList', AdminClasses: 'AdminClasses',
    };
    const handleNav = (screen) => {
        setActive(screen);
        if (ROUTES[screen]) navigation.navigate(screen);
    };

    const liveClass = classes.find(c => c.status === 'live');
    const todayCount = classes.filter(c => {
        const d = tsToDate(c.scheduledAt);
        if (!d) return false;
        const now = new Date();
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    }).length;
    const activeBatches = batches.filter(b => b.status !== 'archived').length;

    return (
        <SafeAreaView style={styles.container}>
            <Header
                title="Studivista Admin"
                subtitle="Platform Overview"
                rightComponent={
                    <View style={styles.rightRow}>
                        <TouchableOpacity onPress={toggle}>
                            <AppIcon name={isDark ? 'sun' : 'moon'} size={18} color={colors.text} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => navigation.navigate('Notifications')}>
                            <AppIcon name="bell" size={20} color={colors.text} />
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
                <View style={styles.welcomeCard}>
                    <View style={styles.welcomeLeft}>
                        <Text style={styles.welcomeGreet}>Welcome,</Text>
                        <Text style={styles.welcomeName}>{profile?.name || 'Admin'}</Text>
                        <Text style={styles.welcomeSub}>{profile?.email}</Text>
                    </View>
                    <View style={styles.adminBadge}>
                        <AppIcon name="shield-alt" size={32} color={colors.adminColor} />
                    </View>
                </View>

                <Text style={styles.sectionTitle}>Overview</Text>
                <View style={styles.statsGrid}>
                    <StatCard label="Total Students" value={students.length} icon="graduation-cap" color={colors.studentColor} sub="enrolled" onPress={() => navigation.navigate('StudentList')} />
                    <StatCard label="Teachers" value={teachers.length} icon="chalkboard-teacher" color={colors.teacherColor} sub="active" onPress={() => navigation.navigate('TeacherList')} />
                    <StatCard label="Batches" value={activeBatches} icon="users" color={colors.primary} sub={`${batches.length} total`} onPress={() => navigation.navigate('BatchList')} />
                    <StatCard label="Classes Today" value={todayCount} icon="calendar-alt" color={colors.secondary} sub={liveClass ? '1 live now' : 'none live'} onPress={() => navigation.navigate('AdminClasses')} />
                </View>

                {liveClass && (
                    <>
                        <View style={styles.sectionTitleRow}>
                            <AppIcon name="circle" size={10} color={colors.primary} />
                            <Text style={styles.sectionTitle}>Live Right Now</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.liveCard}
                            onPress={() => navigation.navigate('LiveClass', {
                                cls: liveClass,
                                roomId: liveClass.id,
                                name: profile?.name || 'Admin',
                                role: 'admin',
                            })}
                            activeOpacity={0.85}
                        >
                            <View style={styles.livePulse}>
                                <Text style={styles.liveText}>LIVE</Text>
                            </View>
                            <Text style={styles.liveTitle}>{liveClass.title}</Text>
                            <Text style={styles.liveBatch}>{liveClass.batchName}</Text>
                            <View style={styles.liveStats}>
                                <View style={styles.liveStatRow}>
                                    <AppIcon name="users" size={12} color={colors.primary} />
                                    <Text style={styles.liveStat}>{(liveClass.joinedStudentIds || []).length} joined</Text>
                                </View>
                                <Text style={styles.liveStat}>👤 {liveClass.teacherName}</Text>
                            </View>
                        </TouchableOpacity>
                    </>
                )}

                <Text style={styles.sectionTitle}>Quick Actions</Text>
                <View style={styles.actionsGrid}>
                    {[
                        { icon: 'chalkboard-teacher', label: 'Add Teacher', screen: 'AddTeacher', color: colors.teacherColor },
                        { icon: 'users', label: 'Create Batch', screen: 'CreateBatch', color: colors.primary },
                        { icon: 'graduation-cap', label: 'Add Student', screen: 'CreateStudent', color: colors.studentColor },
                        { icon: 'calendar-alt', label: 'View Classes', screen: 'AdminClasses', color: colors.secondary },
                    ].map((a) => (
                        <TouchableOpacity
                            key={a.label}
                            style={[styles.actionCard, { borderColor: a.color + '33' }]}
                            onPress={() => navigation.navigate(a.screen)}
                            activeOpacity={0.8}
                        >
                            <View style={[styles.actionIcon, { backgroundColor: a.color + '20' }]}>
                                <AppIcon name={a.icon} size={24} color={a.color} />
                            </View>
                            <Text style={styles.actionLabel}>{a.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={styles.sectionRow}>
                    <Text style={styles.sectionTitle}>Recent Batches</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('BatchList')}>
                        <Text style={styles.seeAll}>See all ›</Text>
                    </TouchableOpacity>
                </View>

                {batches.length === 0 ? (
                    <Text style={styles.empty}>No batches yet. Create your first batch.</Text>
                ) : (
                    batches.slice(0, 3).map(batch => (
                        <TouchableOpacity
                            key={batch.id}
                            style={[styles.batchRow, { borderLeftColor: batch.color || colors.primary }]}
                            onPress={() => navigation.navigate('BatchDetail', { batch })}
                            activeOpacity={0.8}
                        >
                            <View style={[styles.batchDot, { backgroundColor: batch.color || colors.primary }]} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.batchName}>{batch.name}</Text>
                                <Text style={styles.batchInfo}>
                                    {(batch.studentIds?.length || 0)} students • {batch.teacherName || 'No teacher'}
                                </Text>
                            </View>
                            <Text style={styles.batchCount}>{batch.studentIds?.length || 0}/{batch.maxStudents || '—'}</Text>
                        </TouchableOpacity>
                    ))
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
    rightRow: { flexDirection: 'row', gap: SPACING.base, alignItems: 'center' },
    welcomeCard: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: colors.surface, borderRadius: RADIUS.xl,
        padding: SPACING.base, marginVertical: SPACING.md,
        borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    },
    welcomeLeft: { flex: 1 },
    welcomeGreet: { fontSize: SIZES.sm, color: colors.textMuted, marginBottom: 2 },
    welcomeName: { fontSize: SIZES.xl, fontWeight: '800', color: colors.text, marginBottom: 2 },
    welcomeSub: { fontSize: SIZES.sm, color: colors.textMuted },
    adminBadge: {
        width: 60, height: 60, borderRadius: 20,
        backgroundColor: colors.adminColor + '18',
        alignItems: 'center', justifyContent: 'center',
    },
    sectionTitle: {
        fontSize: SIZES.base, fontWeight: '800', color: colors.text,
        marginTop: SPACING.base, marginBottom: SPACING.sm,
    },
    sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.base, marginBottom: SPACING.sm },
    seeAll: { color: colors.primary, fontSize: SIZES.sm, fontWeight: '600' },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.sm },
    liveCard: {
        backgroundColor: colors.primary + '18', borderRadius: RADIUS.xl,
        borderWidth: 1.5, borderColor: colors.primary + '44',
        padding: SPACING.base, marginBottom: SPACING.md,
    },
    livePulse: {
        backgroundColor: colors.primary, paddingHorizontal: SPACING.sm,
        paddingVertical: 3, borderRadius: RADIUS.full,
        alignSelf: 'flex-start', marginBottom: SPACING.sm,
    },
    liveText: { color: '#FFFFFF', fontSize: SIZES.xs, fontWeight: '800', letterSpacing: 1 },
    liveTitle: { fontSize: SIZES.lg, fontWeight: '800', color: colors.text, marginBottom: 4 },
    liveBatch: { fontSize: SIZES.sm, color: colors.textMuted, marginBottom: SPACING.sm },
    liveStats: { flexDirection: 'row', gap: SPACING.base },
    liveStatRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    liveStat: { fontSize: SIZES.sm, color: colors.primary, fontWeight: '600' },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.base, marginBottom: SPACING.sm },
    actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.sm },
    actionCard: {
        flex: 1, minWidth: '45%',
        backgroundColor: colors.surface, borderRadius: RADIUS.lg,
        padding: SPACING.md, alignItems: 'center', gap: SPACING.sm,
        borderWidth: 1, ...SHADOWS.small,
    },
    actionIcon: { width: 52, height: 52, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
    actionLabel: { fontSize: SIZES.sm, color: colors.text, fontWeight: '700', textAlign: 'center' },
    batchRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.surface, borderRadius: RADIUS.lg,
        padding: SPACING.md, marginBottom: SPACING.sm,
        borderLeftWidth: 3, gap: SPACING.md, ...SHADOWS.small,
    },
    batchDot: { width: 8, height: 8, borderRadius: 4 },
    batchName: { fontSize: SIZES.md, fontWeight: '700', color: colors.text, marginBottom: 2 },
    batchInfo: { fontSize: SIZES.xs, color: colors.textMuted },
    batchCount: { fontSize: SIZES.sm, color: colors.textMuted, fontWeight: '600' },
    empty: { color: colors.textMuted, paddingVertical: SPACING.lg, textAlign: 'center', fontSize: SIZES.sm },
});

export default AdminDashboard;
