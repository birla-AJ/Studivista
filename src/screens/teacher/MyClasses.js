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
import {
    subscribeClassesByTeacher, subscribeBatchesByTeacher,
    startLiveClass,
} from '../../services/firestoreService';
import { useAuth } from '../../contexts/AuthContext';
import { Toast } from '../../components/Toast';

// Each tab is a tappable summary card. `value` is the lower-case status used by
// the filter logic; `label` is what's shown to the user.
const FILTER_TABS = [
    { label: 'All',       value: 'All',       colorKey: 'primary' },
    { label: 'Live',      value: 'Live',      colorKey: 'danger' },
    { label: 'Scheduled', value: 'Scheduled', colorKey: 'warning' },
    { label: 'Done',      value: 'Completed', colorKey: 'success' },
];

const MyClasses = ({ navigation }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const { user } = useAuth();
    const [active, setActive] = useState('MyClasses');
    const [filter, setFilter] = useState('All');
    const [classes, setClasses] = useState(null);
    const [batches, setBatches] = useState([]);

    useEffect(() => {
        if (!user?.uid) return;
        const u1 = subscribeClassesByTeacher(user.uid, setClasses);
        const u2 = subscribeBatchesByTeacher(user.uid, setBatches);
        return () => { u1?.(); u2?.(); };
    }, [user?.uid]);

    const handleNav = (screen) => {
        setActive(screen);
        const routes = {
            TeacherDashboard: 'TeacherDashboard', Attendance: 'Attendance',
            Recordings: 'Recordings', TeacherStudents: 'TeacherStudents',
        };
        if (routes[screen]) navigation.navigate(screen);
    };

    const list = classes || [];
    const filtered = filter === 'All'
        ? list
        : list.filter(c => c.status === filter.toLowerCase());

    const handleStart = async (cls) => {
        try {
            await startLiveClass(cls.id);
            navigation.navigate('LiveClass', { cls });
        } catch (e) {
            Toast.error(e?.message || 'Please try again.', 'Could not start class');
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <Header
                title="My Classes"
                subtitle={classes === null ? 'Loading…' : `${list.length} total`}
                showBack
                onBack={() => navigation.goBack()}
                rightComponent={
                    <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('ScheduleClass')}>
                        <Text style={styles.addBtnText}>+</Text>
                    </TouchableOpacity>
                }
            />

            <View style={styles.summaryRow}>
                {FILTER_TABS.map(t => {
                    const color = colors[t.colorKey];
                    const count = t.value === 'All'
                        ? list.length
                        : list.filter(c => c.status === t.value.toLowerCase()).length;
                    const active = filter === t.value;
                    return (
                        <TouchableOpacity
                            key={t.value}
                            style={[
                                styles.summaryCard,
                                { borderTopColor: color },
                                active && { backgroundColor: color, borderColor: color },
                            ]}
                            onPress={() => setFilter(t.value)}
                            activeOpacity={0.85}
                        >
                            <Text style={[styles.summaryVal, { color: active ? '#FFFFFF' : color }]}>{count}</Text>
                            <Text style={[styles.summaryLbl, active && { color: '#FFFFFF' }]}>{t.label}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

                {classes === null ? (
                    <View style={styles.empty}><ActivityIndicator color={colors.primary} /></View>
                ) : filtered.length === 0 ? (
                    <View style={styles.empty}>
                        <AppIcon name="calendar-alt" size={56} color={colors.textMuted} />
                        <Text style={styles.emptyTitle}>No {filter} Classes</Text>
                        <Text style={styles.emptySub}>Schedule a new class to get started</Text>
                        <TouchableOpacity style={styles.scheduleBtn} onPress={() => navigation.navigate('ScheduleClass')}>
                            <Text style={styles.scheduleBtnText}>+ Schedule Class</Text>
                        </TouchableOpacity>
                    </View>
                ) : filtered.map(cls => {
                    const batch = batches.find(b => b.id === cls.batchId);
                    return (
                        <View key={cls.id}>
                            <ClassCard
                                cls={cls}
                                totalStudents={batch?.studentIds?.length || 0}
                                onPress={() => {
                                    if (cls.status === 'live') navigation.navigate('LiveClass', { cls });
                                    else navigation.navigate('ScheduleClass', { cls });
                                }}
                            />
                            {cls.status === 'scheduled' && (
                                <TouchableOpacity style={styles.startBtn} onPress={() => handleStart(cls)}>
                                    <AppIcon name="microphone" size={14} color="#FFFFFF" />
                                    <Text style={styles.startBtnText}>Start & Notify</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    );
                })}

                <View style={{ height: 100 }} />
            </ScrollView>

            <BottomTabBar activeScreen={active} onNavigate={handleNav} role="teacher" />
        </SafeAreaView>
    );
};

const makeStyles = (colors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { flex: 1, paddingHorizontal: SPACING.base },
    addBtn: { width: 34, height: 34, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    addBtnText: { color: '#FFFFFF', fontSize: 22, fontWeight: '700', lineHeight: 28 },
    summaryRow: {
        flexDirection: 'row', gap: SPACING.sm,
        paddingHorizontal: SPACING.base,
        marginTop: SPACING.md, marginBottom: SPACING.md,
    },
    summaryCard: {
        flex: 1, backgroundColor: colors.surface, borderRadius: RADIUS.lg,
        padding: SPACING.sm, alignItems: 'center',
        borderTopWidth: 3,
        borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
        ...SHADOWS.small,
    },
    summaryVal: { fontSize: SIZES.xl, fontWeight: '900' },
    summaryLbl: { fontSize: SIZES.xs, color: colors.textMuted, fontWeight: '600', marginTop: 2 },
    empty: { alignItems: 'center', paddingTop: 80, gap: SPACING.md },
    emptyTitle: { fontSize: SIZES.xl, fontWeight: '800', color: colors.text },
    emptySub: { fontSize: SIZES.md, color: colors.textMuted },
    scheduleBtn: { backgroundColor: colors.primary, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.md, borderRadius: RADIUS.full, marginTop: SPACING.md },
    scheduleBtnText: { color: '#FFFFFF', fontSize: SIZES.md, fontWeight: '700' },
    startBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: SPACING.sm, backgroundColor: colors.primary, borderRadius: RADIUS.lg,
        paddingVertical: SPACING.md, marginTop: -SPACING.sm, marginBottom: SPACING.md,
        ...SHADOWS.primary,
    },
    startBtnText: { color: '#FFFFFF', fontSize: SIZES.md, fontWeight: '800' },
});

export default MyClasses;
