import React, { useEffect, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SIZES, SPACING, RADIUS, SHADOWS } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';
import Header from '../../components/Header';
import BottomTabBar from '../../components/BottomTabBar';
import AppIcon from '../../components/AppIcon';
import {
    subscribeClassesByTeacher, subscribeBatchesByTeacher,
    subscribeAttendanceForClass, subscribeUsersByRole,
} from '../../services/firestoreService';
import { useAuth } from '../../contexts/AuthContext';
import { tsToDate, formatDateLabel, formatTimeLabel } from '../../utils/format';

const AttendanceScreen = ({ navigation }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const { user } = useAuth();
    const [active, setActive] = useState('Attendance');
    const [classes, setClasses] = useState([]);
    const [batches, setBatches] = useState([]);
    const [students, setStudents] = useState([]);
    const [selectedClassId, setSelectedClassId] = useState(null);
    const [attendance, setAttendance] = useState(null);

    useEffect(() => {
        if (!user?.uid) return;
        const u1 = subscribeClassesByTeacher(user.uid, setClasses);
        const u2 = subscribeBatchesByTeacher(user.uid, setBatches);
        const u3 = subscribeUsersByRole('student', setStudents);
        return () => { u1?.(); u2?.(); u3?.(); };
    }, [user?.uid]);

    useEffect(() => {
        const eligible = classes.filter(c => c.status === 'live' || c.status === 'completed');
        if (!selectedClassId && eligible.length > 0) {
            setSelectedClassId(eligible[0].id);
        }
    }, [classes, selectedClassId]);

    useEffect(() => {
        if (!selectedClassId) return;
        setAttendance(null);
        const unsub = subscribeAttendanceForClass(selectedClassId, setAttendance);
        return () => unsub && unsub();
    }, [selectedClassId]);

    const handleNav = (screen) => {
        setActive(screen);
        const routes = {
            TeacherDashboard: 'TeacherDashboard', MyClasses: 'MyClasses',
            Recordings: 'Recordings', TeacherStudents: 'TeacherStudents',
        };
        if (routes[screen]) navigation.navigate(screen);
    };

    const eligibleClasses = classes.filter(c => c.status === 'live' || c.status === 'completed');
    const selected = eligibleClasses.find(c => c.id === selectedClassId);
    const batch = batches.find(b => b.id === selected?.batchId);

    const studentsInBatch = useMemo(() => {
        if (!batch) return [];
        return students.filter(s => (s.batchIds || []).includes(batch.id));
    }, [batch, students]);

    const attMap = useMemo(() => {
        const m = {};
        (attendance || []).forEach(a => { m[a.studentId] = a; });
        return m;
    }, [attendance]);

    const present = (attendance || []).filter(a => a.status === 'present').length;
    const total = studentsInBatch.length;
    const absent = total - present;
    const pct = total > 0 ? Math.round((present / total) * 100) : 0;

    return (
        <SafeAreaView style={styles.container}>
            <Header title="Attendance" subtitle="Track student presence" showBack onBack={() => navigation.goBack()} />

            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.sectionLabel}>Select Class</Text>
                {eligibleClasses.length === 0 ? (
                    <View style={styles.empty}>
                        <Text style={styles.emptyText}>No live or completed classes yet.</Text>
                    </View>
                ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.classScroll}>
                        {eligibleClasses.map(cls => (
                            <TouchableOpacity
                                key={cls.id}
                                style={[
                                    styles.classChip,
                                    selectedClassId === cls.id && { borderColor: cls.color || colors.primary, backgroundColor: (cls.color || colors.primary) + '18' },
                                ]}
                                onPress={() => setSelectedClassId(cls.id)}
                            >
                                <Text
                                    style={[styles.classChipTitle, selectedClassId === cls.id && { color: cls.color || colors.primary }]}
                                    numberOfLines={1}
                                >
                                    {cls.title}
                                </Text>
                                <Text style={styles.classChipDate}>{formatDateLabel(cls.scheduledAt)} • {formatTimeLabel(cls.scheduledAt)}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                )}

                {selected && (
                    <>
                        <View style={styles.summaryCard}>
                            <View style={styles.summaryLeft}>
                                <Text style={styles.percentText}>{pct}%</Text>
                                <Text style={styles.percentLabel}>Attendance Rate</Text>
                                <View style={styles.progressBar}>
                                    <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: pct >= 75 ? colors.success : colors.warning }]} />
                                </View>
                            </View>

                            <View style={styles.summaryStats}>
                                {[
                                    { label: 'Present', val: present, color: colors.success },
                                    { label: 'Absent', val: absent, color: colors.danger },
                                    { label: 'Total', val: total, color: colors.secondary },
                                ].map(s => (
                                    <View key={s.label} style={styles.miniStat}>
                                        <Text style={[styles.miniStatVal, { color: s.color }]}>{s.val}</Text>
                                        <Text style={styles.miniStatLabel}>{s.label}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>

                        <Text style={styles.sectionLabel}>Student Records</Text>
                        {attendance === null ? (
                            <View style={styles.empty}><ActivityIndicator color={colors.primary} /></View>
                        ) : studentsInBatch.length === 0 ? (
                            <Text style={styles.emptyText}>No students in this batch.</Text>
                        ) : studentsInBatch.map(s => {
                            const a = attMap[s.uid];
                            const isPresent = !!a;
                            return (
                                <View key={s.uid} style={styles.attendanceRow}>
                                    <View style={[styles.avatar, { backgroundColor: (isPresent ? colors.success : colors.danger) + '22' }]}>
                                        <AppIcon name={isPresent ? 'check-circle' : 'times-circle'} size={20} color={isPresent ? colors.success : colors.danger} />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: SPACING.md }}>
                                        <Text style={styles.studentName}>{s.name || s.email}</Text>
                                        <Text style={styles.timeText}>
                                            {isPresent ? `Joined ${tsToDate(a.joinedAt)?.toLocaleTimeString?.([], { hour: '2-digit', minute: '2-digit' }) || '—'}` : 'Did not join'}
                                        </Text>
                                    </View>
                                    <View style={[styles.statusBadge, { backgroundColor: (isPresent ? colors.success : colors.danger) + '20', borderColor: (isPresent ? colors.success : colors.danger) + '44' }]}>
                                        <Text style={[styles.statusText, { color: isPresent ? colors.success : colors.danger }]}>
                                            {isPresent ? 'Present' : 'Absent'}
                                        </Text>
                                    </View>
                                </View>
                            );
                        })}
                    </>
                )}

                <View style={{ height: 100 }} />
            </ScrollView>

            <BottomTabBar activeScreen={active} onNavigate={handleNav} role="teacher" />
        </SafeAreaView>
    );
};

const makeStyles = (colors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { flex: 1, paddingHorizontal: SPACING.base },
    sectionLabel: { fontSize: SIZES.base, fontWeight: '800', color: colors.text, marginTop: SPACING.base, marginBottom: SPACING.sm },
    classScroll: { marginBottom: SPACING.md, maxHeight: 80 },
    classChip: {
        backgroundColor: colors.surface, borderRadius: RADIUS.lg,
        padding: SPACING.md, marginRight: SPACING.sm,
        borderWidth: 1.5, borderColor: colors.border, minWidth: 160,
    },
    classChipTitle: { fontSize: SIZES.sm, fontWeight: '700', color: colors.text, marginBottom: 3 },
    classChipDate: { fontSize: SIZES.xs, color: colors.textMuted },
    summaryCard: {
        backgroundColor: colors.surface, borderRadius: RADIUS.xl,
        padding: SPACING.base, flexDirection: 'row',
        gap: SPACING.base, marginBottom: SPACING.md,
        borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...SHADOWS.medium,
    },
    summaryLeft: { flex: 1 },
    percentText: { fontSize: 44, fontWeight: '900', color: colors.text },
    percentLabel: { fontSize: SIZES.sm, color: colors.textMuted, marginBottom: SPACING.sm },
    progressBar: { height: 8, backgroundColor: colors.surfaceSubtle, borderRadius: 4, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 4 },
    summaryStats: { justifyContent: 'space-between', gap: SPACING.sm },
    miniStat: { alignItems: 'center' },
    miniStatVal: { fontSize: SIZES.xl, fontWeight: '900' },
    miniStatLabel: { fontSize: SIZES.xs, color: colors.textMuted, fontWeight: '600' },
    attendanceRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.surface, borderRadius: RADIUS.lg,
        padding: SPACING.md, marginBottom: SPACING.sm,
        borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...SHADOWS.small,
    },
    avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    studentName: { fontSize: SIZES.md, fontWeight: '700', color: colors.text, marginBottom: 3 },
    timeText: { fontSize: SIZES.xs, color: colors.textMuted },
    statusBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.full, borderWidth: 1 },
    statusText: { fontSize: SIZES.xs, fontWeight: '700' },
    empty: { alignItems: 'center', paddingVertical: SPACING.lg },
    emptyText: { color: colors.textMuted, fontSize: SIZES.sm, textAlign: 'center', paddingVertical: SPACING.lg },
});

export default AttendanceScreen;
