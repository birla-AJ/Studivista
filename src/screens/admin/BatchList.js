import React, { useEffect, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, SafeAreaView,
    TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { SIZES, SPACING, RADIUS, SHADOWS } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';
import Header from '../../components/Header';
import Button from '../../components/Button';
import BottomTabBar from '../../components/BottomTabBar';
import AppIcon from '../../components/AppIcon';
import { subscribeBatches } from '../../services/firestoreService';

const BatchCard = ({ batch, onPress, onManage }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeCardStyles(colors), [colors]);
    const studentCount = batch.studentIds?.length || 0;
    const max = Number(batch.maxStudents) || 30;
    const pct = Math.min(100, Math.round((studentCount / max) * 100));
    const color = batch.color || colors.primary;

    return (
        <TouchableOpacity style={[styles.batchCard, { borderTopColor: color }]} onPress={onPress} activeOpacity={0.85}>
            <View style={styles.batchHeader}>
                <View style={[styles.batchIcon, { backgroundColor: color + '20' }]}>
                    <AppIcon name="book-open" size={28} color={color} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.batchName} numberOfLines={1}>{batch.name}</Text>
                    <Text style={styles.batchSubject}>{batch.subject || '—'}</Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: colors.success + '22' }]}>
                    <Text style={[styles.statusText, { color: colors.success }]}>Active</Text>
                </View>
            </View>

            <View style={styles.teacherRow}>
                <AppIcon name="chalkboard-teacher" size={14} color={colors.textMuted} />
                <Text style={styles.teacherName}>{batch.teacherName || 'No teacher assigned'}</Text>
            </View>

            <View style={styles.batchStats}>
                <View style={styles.statItem}>
                    <Text style={[styles.statNum, { color }]}>{studentCount}</Text>
                    <Text style={styles.statLbl}>Students</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                    <Text style={[styles.statNum, { color }]}>{max}</Text>
                    <Text style={styles.statLbl}>Capacity</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                    <Text style={[styles.statNum, { color }]}>{pct}%</Text>
                    <Text style={styles.statLbl}>Full</Text>
                </View>
            </View>

            <View style={styles.progressWrap}>
                <View style={styles.progressBg}>
                    <View style={[styles.progressFill, { backgroundColor: color, width: `${pct}%` }]} />
                </View>
            </View>

            {(batch.scheduleDays?.length || batch.scheduleTime) && (
                <View style={styles.scheduleRow}>
                    <AppIcon name="calendar-week" size={12} color={colors.textMuted} />
                    <Text style={styles.schedule}>
                        {(batch.scheduleDays || []).join(', ')}{batch.scheduleTime ? ` • ${batch.scheduleTime}` : ''}
                    </Text>
                </View>
            )}

            <View style={styles.cardActions}>
                <Button label="Edit" onPress={onManage} variant="ghost" size="sm" style={{ flex: 1 }} />
                <Button label="View Students" onPress={onPress} variant="primary" size="sm" style={{ flex: 1 }} />
            </View>
        </TouchableOpacity>
    );
};

const BatchList = ({ navigation }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [active, setActive] = useState('BatchList');
    const [batches, setBatches] = useState(null);

    useEffect(() => {
        const unsub = subscribeBatches(setBatches);
        return () => unsub && unsub();
    }, []);

    const handleNav = (screen) => {
        setActive(screen);
        navigation.navigate(screen);
    };

    const list = batches || [];
    const totalStudents = list.reduce((a, b) => a + (b.studentIds?.length || 0), 0);

    return (
        <SafeAreaView style={styles.container}>
            <Header
                title="Batches"
                subtitle={batches === null ? 'Loading…' : `${list.length} Total Batches`}
                showBack
                onBack={() => navigation.goBack()}
                rightComponent={
                    <TouchableOpacity onPress={() => navigation.navigate('CreateBatch')} style={styles.addBtn}>
                        <Text style={styles.addBtnText}>+</Text>
                    </TouchableOpacity>
                }
            />

            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                <View style={styles.summaryRow}>
                    {[
                        { label: 'Total', value: list.length, color: colors.primary },
                        { label: 'Active', value: list.length, color: colors.success },
                        { label: 'Students', value: totalStudents, color: colors.secondary },
                    ].map(s => (
                        <View key={s.label} style={styles.summaryCard}>
                            <Text style={[styles.summaryVal, { color: s.color }]}>{s.value}</Text>
                            <Text style={styles.summaryLbl}>{s.label}</Text>
                        </View>
                    ))}
                </View>

                <View style={styles.listHeader}>
                    <Text style={styles.sectionTitle}>All Batches</Text>
                    <TouchableOpacity style={styles.createBtn} onPress={() => navigation.navigate('CreateBatch')}>
                        <Text style={styles.createBtnText}>+ Create Batch</Text>
                    </TouchableOpacity>
                </View>

                {batches === null ? (
                    <View style={styles.empty}>
                        <ActivityIndicator color={colors.primary} />
                    </View>
                ) : list.length === 0 ? (
                    <View style={styles.empty}>
                        <AppIcon name="users" size={48} color={colors.textMuted} />
                        <Text style={styles.emptyText}>No batches yet</Text>
                        <Text style={styles.emptySub}>Create a batch and assign a teacher to it.</Text>
                    </View>
                ) : list.map(batch => (
                    <BatchCard
                        key={batch.id}
                        batch={batch}
                        onPress={() => navigation.navigate('BatchDetail', { batch })}
                        onManage={() => navigation.navigate('CreateBatch', { batch })}
                    />
                ))}

                <View style={{ height: 100 }} />
            </ScrollView>

            <BottomTabBar activeScreen={active} onNavigate={handleNav} role="admin" />
        </SafeAreaView>
    );
};

const makeStyles = (colors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { flex: 1, paddingHorizontal: SPACING.base },
    addBtn: { width: 34, height: 34, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    addBtnText: { color: '#FFFFFF', fontSize: 22, fontWeight: '700', lineHeight: 28 },
    summaryRow: { flexDirection: 'row', gap: SPACING.sm, marginVertical: SPACING.md },
    summaryCard: { flex: 1, backgroundColor: colors.surface, borderRadius: RADIUS.lg, padding: SPACING.md, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...SHADOWS.small },
    summaryVal: { fontSize: SIZES.xxl, fontWeight: '900' },
    summaryLbl: { fontSize: SIZES.xs, color: colors.textMuted, fontWeight: '600', marginTop: 2 },
    listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
    sectionTitle: { fontSize: SIZES.base, fontWeight: '800', color: colors.text },
    createBtn: {
        backgroundColor: colors.primary + '20', paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs,
        borderRadius: RADIUS.full, borderWidth: 1, borderColor: colors.primary + '44',
    },
    createBtnText: { color: colors.primary, fontSize: SIZES.sm, fontWeight: '700' },
    empty: { alignItems: 'center', paddingVertical: 60, gap: SPACING.md },
    emptyText: { color: colors.text, fontSize: SIZES.lg, fontWeight: '700' },
    emptySub: { color: colors.textMuted, fontSize: SIZES.sm, textAlign: 'center' },
});

const makeCardStyles = (colors) => StyleSheet.create({
    batchCard: { backgroundColor: colors.surface, borderRadius: RADIUS.xl, padding: SPACING.base, marginBottom: SPACING.md, borderTopWidth: 3, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...SHADOWS.medium },
    batchHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.md },
    batchIcon: { width: 52, height: 52, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
    batchName: { fontSize: SIZES.base, fontWeight: '800', color: colors.text, marginBottom: 2 },
    batchSubject: { fontSize: SIZES.sm, color: colors.textMuted },
    statusPill: { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.full },
    statusText: { fontSize: SIZES.xs, fontWeight: '700' },
    teacherRow: {
        flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.md,
        backgroundColor: colors.surfaceSubtle, borderRadius: RADIUS.md, padding: SPACING.sm,
    },
    teacherName: { fontSize: SIZES.sm, color: colors.textMuted, fontWeight: '600' },
    batchStats: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: SPACING.sm },
    statItem: { alignItems: 'center' },
    statNum: { fontSize: SIZES.xl, fontWeight: '900' },
    statLbl: { fontSize: SIZES.xs, color: colors.textMuted, fontWeight: '600' },
    statDivider: { width: 1, backgroundColor: colors.border },
    progressWrap: { marginBottom: SPACING.sm },
    progressBg: { height: 6, backgroundColor: colors.surfaceSubtle, borderRadius: 3, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 3 },
    schedule: { fontSize: SIZES.sm, color: colors.textMuted },
    scheduleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.md },
    cardActions: { flexDirection: 'row', gap: SPACING.sm },
});

export default BatchList;
