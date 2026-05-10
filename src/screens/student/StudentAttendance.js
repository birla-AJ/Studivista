import React, { useEffect, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { SIZES, SPACING, RADIUS, SHADOWS } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';
import Header from '../../components/Header';
import BottomTabBar from '../../components/BottomTabBar';
import AppIcon from '../../components/AppIcon';
import { db } from '../../services/firebase';
import { subscribeClassesByBatches } from '../../services/firestoreService';
import { useAuth } from '../../contexts/AuthContext';
import { formatDateLabel, formatTimeLabel, tsToDate } from '../../utils/format';

const StudentAttendance = ({ navigation }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const { user, profile } = useAuth();
    const [active, setActive] = useState('StudentAttendance');
    const [classes, setClasses] = useState(null);
    const [attendance, setAttendance] = useState({});

    useEffect(() => {
        const ids = profile?.batchIds || [];
        if (ids.length === 0) {
            setClasses([]);
            return;
        }
        const u1 = subscribeClassesByBatches(ids, setClasses);
        return () => u1?.();
    }, [profile?.batchIds?.join(',')]);

    useEffect(() => {
        if (!user?.uid || !classes || classes.length === 0) return;
        const unsubs = [];
        classes.forEach(c => {
            if (c.status === 'live' || c.status === 'completed') {
                const u = db.collection('classes').doc(c.id).collection('attendance').doc(user.uid)
                    .onSnapshot(snap => {
                        setAttendance(prev => ({
                            ...prev,
                            [c.id]: snap.exists() ? { id: snap.id, ...snap.data() } : null,
                        }));
                    });
                unsubs.push(u);
            }
        });
        return () => unsubs.forEach(u => u && u());
    }, [user?.uid, classes]);

    const handleNav = (screen) => {
        setActive(screen);
        const routes = {
            StudentDashboard: 'StudentDashboard', JoinClass: 'JoinClass',
            StudentRecordings: 'StudentRecordings',
        };
        if (routes[screen]) navigation.navigate(routes[screen]);
    };

    const evaluated = (classes || []).filter(c => c.status === 'live' || c.status === 'completed');
    const presentCount = evaluated.filter(c => !!attendance[c.id]).length;
    const total = evaluated.length;
    const pct = total > 0 ? Math.round((presentCount / total) * 100) : 0;

    return (
        <SafeAreaView style={styles.container}>
            <Header title="My Attendance" subtitle="Track your class presence" showBack onBack={() => navigation.goBack()} />

            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                <View style={styles.summaryCard}>
                    <View style={styles.circleWrap}>
                        <View style={styles.outerRing}>
                            <View style={styles.innerCircle}>
                                <Text style={styles.percentText}>{pct}%</Text>
                                <Text style={styles.percentLabel}>Attendance</Text>
                            </View>
                        </View>
                    </View>

                    <View style={styles.summaryStats}>
                        <View style={[styles.miniStat, { borderLeftColor: colors.success }]}>
                            <Text style={[styles.miniVal, { color: colors.success }]}>{presentCount}</Text>
                            <Text style={styles.miniLabel}>Present</Text>
                        </View>
                        <View style={[styles.miniStat, { borderLeftColor: colors.danger }]}>
                            <Text style={[styles.miniVal, { color: colors.danger }]}>{total - presentCount}</Text>
                            <Text style={styles.miniLabel}>Absent</Text>
                        </View>
                        <View style={[styles.miniStat, { borderLeftColor: colors.secondary }]}>
                            <Text style={[styles.miniVal, { color: colors.secondary }]}>{total}</Text>
                            <Text style={styles.miniLabel}>Total</Text>
                        </View>
                    </View>

                    <View style={[
                        styles.statusMsg,
                        { backgroundColor: pct >= 75 ? colors.success + '18' : colors.warning + '18' },
                    ]}>
                        <Text style={[
                            styles.statusMsgText,
                            { color: pct >= 75 ? colors.success : colors.warning },
                        ]}>
                            {total === 0
                                ? 'No completed classes yet to evaluate.'
                                : pct >= 75
                                    ? 'Great! You meet the 75% minimum requirement.'
                                    : 'Your attendance is below 75%. Please improve.'}
                        </Text>
                    </View>
                </View>

                <Text style={styles.sectionTitle}>Class-wise Record</Text>
                {classes === null ? (
                    <View style={styles.empty}><ActivityIndicator color={colors.primary} /></View>
                ) : evaluated.length === 0 ? (
                    <Text style={styles.emptyText}>No completed classes yet.</Text>
                ) : evaluated.map(rec => {
                    const present = !!attendance[rec.id];
                    return (
                        <View key={rec.id} style={[styles.recordRow, { borderLeftColor: present ? colors.success : colors.danger }]}>
                            <View style={[styles.recordIcon, { backgroundColor: (present ? colors.success : colors.danger) + '20' }]}>
                                <AppIcon name={present ? 'check-circle' : 'times-circle'} size={20} color={present ? colors.success : colors.danger} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.recordTitle} numberOfLines={1}>{rec.title}</Text>
                                <Text style={styles.recordDate}>{formatDateLabel(rec.scheduledAt)} • {formatTimeLabel(rec.scheduledAt)}</Text>
                                {present && (
                                    <Text style={styles.recordMeta}>
                                        Joined {tsToDate(attendance[rec.id]?.joinedAt)?.toLocaleTimeString?.([], { hour: '2-digit', minute: '2-digit' }) || '—'}
                                    </Text>
                                )}
                            </View>
                            <View style={[
                                styles.recordBadge,
                                { backgroundColor: (present ? colors.success : colors.danger) + '20' },
                            ]}>
                                <Text style={[styles.recordBadgeText, { color: present ? colors.success : colors.danger }]}>
                                    {present ? 'Present' : 'Absent'}
                                </Text>
                            </View>
                        </View>
                    );
                })}

                <View style={{ height: 100 }} />
            </ScrollView>

            <BottomTabBar activeScreen={active} onNavigate={handleNav} role="student" />
        </SafeAreaView>
    );
};

const makeStyles = (colors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { flex: 1, paddingHorizontal: SPACING.base },
    summaryCard: {
        backgroundColor: colors.surface, borderRadius: RADIUS.xl,
        padding: SPACING.base, marginVertical: SPACING.md,
        borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...SHADOWS.medium,
        alignItems: 'center', gap: SPACING.md,
    },
    circleWrap: { alignItems: 'center', marginBottom: SPACING.sm },
    outerRing: {
        width: 140, height: 140, borderRadius: 70,
        borderWidth: 10, borderColor: colors.primary + '33',
        alignItems: 'center', justifyContent: 'center',
    },
    innerCircle: {
        width: 110, height: 110, borderRadius: 55,
        borderWidth: 8, borderColor: colors.primary,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: colors.surface,
    },
    percentText: { fontSize: 32, fontWeight: '900', color: colors.text },
    percentLabel: { fontSize: SIZES.xs, color: colors.textMuted, fontWeight: '600' },
    summaryStats: { flexDirection: 'row', gap: SPACING.md, width: '100%' },
    miniStat: {
        flex: 1, backgroundColor: colors.surfaceSubtle,
        borderRadius: RADIUS.md, padding: SPACING.md,
        borderLeftWidth: 3, alignItems: 'center',
    },
    miniVal: { fontSize: SIZES.xxl, fontWeight: '900' },
    miniLabel: { fontSize: SIZES.xs, color: colors.textMuted, fontWeight: '600', marginTop: 2 },
    statusMsg: { width: '100%', borderRadius: RADIUS.md, padding: SPACING.md },
    statusMsgText: { fontSize: SIZES.sm, fontWeight: '600', textAlign: 'center' },
    sectionTitle: { fontSize: SIZES.base, fontWeight: '800', color: colors.text, marginTop: SPACING.base, marginBottom: SPACING.sm },
    recordRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.surface, borderRadius: RADIUS.lg,
        padding: SPACING.md, marginBottom: SPACING.sm,
        borderLeftWidth: 3, gap: SPACING.md,
        borderTopWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, borderRightColor: colors.border, borderBottomColor: colors.border,
        ...SHADOWS.small,
    },
    recordIcon: { width: 44, height: 44, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
    recordTitle: { fontSize: SIZES.md, fontWeight: '700', color: colors.text, marginBottom: 2 },
    recordDate: { fontSize: SIZES.xs, color: colors.textMuted, marginBottom: 2 },
    recordMeta: { fontSize: SIZES.xs, color: colors.success, fontWeight: '600' },
    recordBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.full },
    recordBadgeText: { fontSize: SIZES.xs, fontWeight: '700' },
    empty: { alignItems: 'center', paddingVertical: SPACING.lg },
    emptyText: { color: colors.textMuted, textAlign: 'center', paddingVertical: SPACING.lg, fontSize: SIZES.sm },
});

export default StudentAttendance;
