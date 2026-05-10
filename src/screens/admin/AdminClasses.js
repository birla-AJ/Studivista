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

const AdminClasses = ({ navigation }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [active, setActive] = useState('AdminClasses');
    const [selectedSubject, setSelectedSubject] = useState('All');
    const [classes, setClasses] = useState(null);
    const [batches, setBatches] = useState([]);

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

    const subjects = useMemo(() => {
        const set = new Set();
        batches.forEach(b => b.subject && set.add(b.subject));
        return ['All', ...Array.from(set)];
    }, [batches]);

    const list = classes || [];
    const filtered = selectedSubject === 'All'
        ? list
        : list.filter(c => {
            const batch = batches.find(b => b.id === c.batchId);
            return batch?.subject === selectedSubject;
        });

    const today = list.filter(c => {
        const d = tsToDate(c.scheduledAt);
        if (!d) return false;
        const now = new Date();
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
    });

    return (
        <SafeAreaView style={styles.container}>
            <Header title="All Classes" subtitle="Platform-wide schedule" showBack onBack={() => navigation.goBack()} />

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.batchFilterScroll}
                contentContainerStyle={{ paddingHorizontal: SPACING.base, gap: SPACING.sm }}
            >
                {subjects.map(b => (
                    <TouchableOpacity
                        key={b}
                        style={[styles.batchChip, selectedSubject === b && styles.batchChipActive]}
                        onPress={() => setSelectedSubject(b)}
                    >
                        <Text style={[styles.batchChipText, selectedSubject === b && { color: '#FFFFFF' }]}>{b}</Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                <View style={styles.statsRow}>
                    {[
                        { label: 'Live Now', val: list.filter(c => c.status === 'live').length, color: colors.primary, icon: 'circle' },
                        { label: 'Today', val: today.length, color: colors.secondary, icon: 'calendar-alt' },
                        { label: 'Upcoming', val: list.filter(c => c.status === 'scheduled').length, color: colors.warning, icon: 'clock' },
                        { label: 'Done', val: list.filter(c => c.status === 'completed').length, color: colors.success, icon: 'check-circle' },
                    ].map(s => (
                        <View key={s.label} style={[styles.statCard, { borderTopColor: s.color }]}>
                            <AppIcon name={s.icon} size={18} color={s.color} />
                            <Text style={[styles.statVal, { color: s.color }]}>{s.val}</Text>
                            <Text style={styles.statLbl}>{s.label}</Text>
                        </View>
                    ))}
                </View>

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
                        return (
                            <ClassCard
                                key={cls.id}
                                cls={cls}
                                totalStudents={batch?.studentIds?.length || 0}
                                onPress={() => {}}
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
    batchFilterScroll: { maxHeight: 52, marginTop: SPACING.sm, marginBottom: SPACING.sm },
    batchChip: {
        paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
        borderRadius: RADIUS.full, backgroundColor: colors.surface,
        borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    },
    batchChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    batchChipText: { color: colors.textMuted, fontSize: SIZES.sm, fontWeight: '600' },
    statsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
    statCard: {
        flex: 1, backgroundColor: colors.surface, borderRadius: RADIUS.lg,
        padding: SPACING.sm, alignItems: 'center', borderTopWidth: 3,
        gap: 3, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...SHADOWS.small,
    },
    statVal: { fontSize: SIZES.xl, fontWeight: '900' },
    statLbl: { fontSize: 9, color: colors.textMuted, fontWeight: '600', textAlign: 'center' },
    empty: { alignItems: 'center', paddingTop: 80, gap: SPACING.md },
    emptyTitle: { fontSize: SIZES.xl, fontWeight: '800', color: colors.text },
    emptySub: { color: colors.textMuted, fontSize: SIZES.sm, textAlign: 'center' },
});

export default AdminClasses;
