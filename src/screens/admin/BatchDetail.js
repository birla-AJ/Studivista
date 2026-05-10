import React, { useEffect, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { SIZES, SPACING, RADIUS, SHADOWS } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';
import Header from '../../components/Header';
import Button from '../../components/Button';
import AppIcon from '../../components/AppIcon';
import {
    subscribeBatches,
    subscribeUsersByRole,
    removeStudentFromBatch,
} from '../../services/firestoreService';
import { isUserOnline } from '../../utils/format';
import { Toast } from '../../components/Toast';

// Per-batch view: header info, enrolled students, add/remove students.
// Reads `batch` from route.params or from the live snapshot if only `batchId` is passed.
const BatchDetail = ({ navigation, route }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const passedBatch = route?.params?.batch;
    const batchId = route?.params?.batchId || passedBatch?.id;

    const [batches, setBatches] = useState([]);
    const [students, setStudents] = useState(null);

    useEffect(() => {
        const u1 = subscribeBatches(setBatches);
        const u2 = subscribeUsersByRole('student', setStudents);
        return () => { u1?.(); u2?.(); };
    }, []);

    const batch = batches.find(b => b.id === batchId) || passedBatch;
    const color = batch?.color || colors.primary;

    const enrolled = useMemo(() => {
        if (!batch || !students) return [];
        const ids = new Set(batch.studentIds || []);
        return students.filter(s => ids.has(s.uid))
            .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [batch, students]);

    const handleRemove = (student) => {
        Alert.alert(
            'Remove from batch?',
            `Remove ${student.name || 'this student'} from ${batch?.name || 'this batch'}?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await removeStudentFromBatch(batch.id, student.uid);
                        } catch (e) {
                            Toast.error(e?.message || 'Could not remove student.', 'Error');
                        }
                    },
                },
            ],
        );
    };

    if (!batch) {
        return (
            <SafeAreaView style={styles.container}>
                <Header title="Batch" showBack onBack={() => navigation.goBack()} />
                <View style={styles.centered}><ActivityIndicator color={colors.primary} /></View>
            </SafeAreaView>
        );
    }

    const studentCount = enrolled.length;
    const max = Number(batch.maxStudents) || 30;

    return (
        <SafeAreaView style={styles.container}>
            <Header
                title={batch.name}
                subtitle={batch.subject || ''}
                showBack
                onBack={() => navigation.goBack()}
                rightComponent={
                    <TouchableOpacity
                        onPress={() => navigation.navigate('CreateBatch', { batch })}
                        style={styles.editBtn}
                    >
                        <AppIcon name="pen" size={14} color={colors.primary} />
                    </TouchableOpacity>
                }
            />

            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                <View style={[styles.headerCard, { borderTopColor: color }]}>
                    <View style={[styles.headerIcon, { backgroundColor: color + '20' }]}>
                        <AppIcon name="book-open" size={28} color={color} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.headerTitle}>{batch.name}</Text>
                        <Text style={styles.headerSubject}>{batch.subject || '—'}</Text>
                    </View>
                </View>

                <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                        <Text style={[styles.statValue, { color }]}>{studentCount}</Text>
                        <Text style={styles.statLabel}>Enrolled</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={[styles.statValue, { color }]}>{max}</Text>
                        <Text style={styles.statLabel}>Capacity</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={[styles.statValue, { color }]}>
                            {Math.max(0, max - studentCount)}
                        </Text>
                        <Text style={styles.statLabel}>Open Seats</Text>
                    </View>
                </View>

                <View style={styles.metaCard}>
                    <View style={styles.metaRow}>
                        <AppIcon name="chalkboard-teacher" size={14} color={colors.textMuted} />
                        <Text style={styles.metaText}>
                            {batch.teacherName || 'No teacher assigned'}
                        </Text>
                    </View>
                    {(batch.scheduleDays?.length || batch.scheduleTime) ? (
                        <View style={styles.metaRow}>
                            <AppIcon name="calendar-week" size={14} color={colors.textMuted} />
                            <Text style={styles.metaText}>
                                {(batch.scheduleDays || []).join(', ')}
                                {batch.scheduleTime ? ` • ${batch.scheduleTime}` : ''}
                            </Text>
                        </View>
                    ) : null}
                </View>

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Students ({studentCount})</Text>
                    <Button
                        label="+ Add Students"
                        onPress={() => navigation.navigate('AddStudent', { batchId: batch.id })}
                        variant="primary"
                        size="sm"
                    />
                </View>

                {students === null ? (
                    <View style={styles.empty}>
                        <ActivityIndicator color={colors.primary} />
                    </View>
                ) : enrolled.length === 0 ? (
                    <View style={styles.empty}>
                        <AppIcon name="graduation-cap" size={42} color={colors.textMuted} />
                        <Text style={styles.emptyText}>No students enrolled yet</Text>
                        <Text style={styles.emptySub}>
                            Tap “Add Students” to pick from existing students.
                        </Text>
                    </View>
                ) : (
                    enrolled.map(s => {
                        const online = isUserOnline(s);
                        return (
                            <View key={s.uid} style={styles.studentRow}>
                                <View style={styles.avatar}>
                                    <AppIcon name="graduation-cap" size={18} color={colors.studentColor} />
                                    <View style={[styles.presenceDot, { backgroundColor: online ? colors.success : colors.offline }]} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.studentName}>{s.name || '—'}</Text>
                                    <Text style={styles.studentEmail}>{s.email}</Text>
                                </View>
                                <TouchableOpacity onPress={() => handleRemove(s)} style={styles.removeBtn}>
                                    <AppIcon name="times" size={14} color={colors.danger} />
                                </TouchableOpacity>
                            </View>
                        );
                    })
                )}

                <View style={{ height: 80 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

const makeStyles = (colors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { flex: 1, paddingHorizontal: SPACING.base },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    editBtn: {
        width: 34, height: 34, borderRadius: 12,
        backgroundColor: colors.primary + '20',
        alignItems: 'center', justifyContent: 'center',
    },
    headerCard: {
        flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
        backgroundColor: colors.surface, borderRadius: RADIUS.xl,
        padding: SPACING.base, marginVertical: SPACING.md,
        borderTopWidth: 3,
        borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
        ...SHADOWS.small,
    },
    headerIcon: { width: 56, height: 56, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: SIZES.lg, fontWeight: '800', color: colors.text },
    headerSubject: { fontSize: SIZES.sm, color: colors.textMuted, marginTop: 2 },
    statsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
    statBox: {
        flex: 1, backgroundColor: colors.surface, borderRadius: RADIUS.lg,
        padding: SPACING.md, alignItems: 'center',
        borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
        ...SHADOWS.small,
    },
    statValue: { fontSize: SIZES.xxl, fontWeight: '900' },
    statLabel: { fontSize: SIZES.xs, color: colors.textMuted, fontWeight: '600', marginTop: 2 },
    metaCard: {
        backgroundColor: colors.surface, borderRadius: RADIUS.lg,
        padding: SPACING.md, gap: SPACING.sm, marginBottom: SPACING.md,
        borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    metaText: { fontSize: SIZES.sm, color: colors.textMuted, fontWeight: '600' },
    sectionHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginTop: SPACING.md, marginBottom: SPACING.sm,
    },
    sectionTitle: { fontSize: SIZES.base, fontWeight: '800', color: colors.text },
    empty: { alignItems: 'center', paddingVertical: 40, gap: SPACING.sm },
    emptyText: { color: colors.text, fontSize: SIZES.md, fontWeight: '700' },
    emptySub: { color: colors.textMuted, fontSize: SIZES.sm, textAlign: 'center', paddingHorizontal: SPACING.lg },
    studentRow: {
        flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
        backgroundColor: colors.surface, borderRadius: RADIUS.lg,
        padding: SPACING.md, marginBottom: SPACING.sm,
        borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
        ...SHADOWS.small,
    },
    avatar: {
        width: 42, height: 42, borderRadius: 21,
        backgroundColor: colors.studentColor + '22',
        alignItems: 'center', justifyContent: 'center', position: 'relative',
    },
    presenceDot: {
        position: 'absolute', bottom: 0, right: 0,
        width: 11, height: 11, borderRadius: 6,
        borderWidth: 2, borderColor: colors.surface,
    },
    studentName: { fontSize: SIZES.md, fontWeight: '700', color: colors.text },
    studentEmail: { fontSize: SIZES.xs, color: colors.textMuted, marginTop: 2 },
    removeBtn: {
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: colors.danger + '20',
        alignItems: 'center', justifyContent: 'center',
    },
});

export default BatchDetail;
