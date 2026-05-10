import React, { useEffect, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, TextInput,
} from 'react-native';
import { SIZES, SPACING, RADIUS } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';
import Header from '../../components/Header';
import Button from '../../components/Button';
import AppIcon from '../../components/AppIcon';
import {
    subscribeBatches,
    subscribeUsersByRole,
    addStudentsToBatch,
} from '../../services/firestoreService';
import { useAuth } from '../../contexts/AuthContext';
import { Toast } from '../../components/Toast';

// Pick a batch + multi-select existing students to enroll. Does not create auth
// accounts — student accounts come from sign-up / out-of-band creation.
const AddStudent = ({ navigation, route }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const { user, profile } = useAuth();
    const initialBatchId = route?.params?.batchId || '';

    const [batchId, setBatchId] = useState(initialBatchId);
    const [batches, setBatches] = useState([]);
    const [students, setStudents] = useState([]);
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const u1 = subscribeBatches(setBatches);
        const u2 = subscribeUsersByRole('student', setStudents);
        return () => { u1 && u1(); u2 && u2(); };
    }, []);

    const visibleBatches = profile?.role === 'teacher'
        ? batches.filter(b => b.teacherId === user?.uid)
        : batches;

    const currentBatch = batches.find(b => b.id === batchId);
    const enrolledIds = useMemo(
        () => new Set(currentBatch?.studentIds || []),
        [currentBatch?.studentIds],
    );

    const term = search.trim().toLowerCase();
    const candidateStudents = students
        .filter(s => !enrolledIds.has(s.uid))
        .filter(s =>
            !term ||
            (s.name || '').toLowerCase().includes(term) ||
            (s.email || '').toLowerCase().includes(term),
        )
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    const toggle = (uid) => setSelected(prev => ({ ...prev, [uid]: !prev[uid] }));
    const selectedCount = Object.values(selected).filter(Boolean).length;

    const handleSave = async () => {
        setError('');
        if (!batchId) return setError('Pick a batch first.');
        const ids = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
        if (ids.length === 0) return setError('Select at least one student.');

        setLoading(true);
        try {
            await addStudentsToBatch(batchId, ids);
            Toast.success(
                `${ids.length} student${ids.length === 1 ? '' : 's'} added to ${currentBatch?.name || 'the batch'}.`,
                'Students added',
            );
            navigation.goBack();
        } catch (e) {
            setError(e?.message || 'Could not add students.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <Header title="Add Students to Batch" showBack onBack={() => navigation.goBack()} />

            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.sectionLabel}>Select Batch</Text>
                {visibleBatches.length === 0 ? (
                    <Text style={styles.notice}>
                        {profile?.role === 'teacher'
                            ? 'You do not own any batch yet. Ask the admin to create a batch and assign it to you.'
                            : 'No batches yet. Create a batch first.'}
                    </Text>
                ) : (
                    visibleBatches.map(batch => (
                        <TouchableOpacity
                            key={batch.id}
                            style={[
                                styles.batchOption,
                                batchId === batch.id && {
                                    borderColor: batch.color || colors.primary,
                                    backgroundColor: (batch.color || colors.primary) + '12',
                                },
                            ]}
                            onPress={() => setBatchId(batch.id)}
                        >
                            <View style={[styles.batchDot, { backgroundColor: batch.color || colors.primary }]} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.batchName}>{batch.name}</Text>
                                <Text style={styles.batchInfo}>
                                    {(batch.studentIds?.length || 0)}/{batch.maxStudents || '—'} students
                                </Text>
                            </View>
                            <View style={[styles.radio, batchId === batch.id && styles.radioActive]} />
                        </TouchableOpacity>
                    ))
                )}

                {batchId ? (
                    <>
                        <Text style={styles.sectionLabel}>
                            Pick Students {selectedCount > 0 && `(${selectedCount} selected)`}
                        </Text>

                        <View style={styles.searchBox}>
                            <AppIcon name="search" size={14} color={colors.textMuted} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="Search by name or email"
                                placeholderTextColor={colors.textMuted}
                                value={search}
                                onChangeText={setSearch}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        </View>

                        {candidateStudents.length === 0 ? (
                            <Text style={styles.notice}>
                                {students.length === 0
                                    ? 'No students yet.'
                                    : term
                                        ? 'No matches.'
                                        : 'All existing students are already in this batch.'}
                            </Text>
                        ) : (
                            candidateStudents.map(s => {
                                const checked = !!selected[s.uid];
                                return (
                                    <TouchableOpacity
                                        key={s.uid}
                                        style={[styles.studentRow, checked && styles.studentRowChecked]}
                                        onPress={() => toggle(s.uid)}
                                    >
                                        <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                                            {checked && <AppIcon name="check" size={11} color="#FFFFFF" />}
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.studentName}>{s.name || '—'}</Text>
                                            <Text style={styles.studentInfo}>{s.email}</Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })
                        )}
                    </>
                ) : (
                    <Text style={styles.notice}>Select a batch to view available students.</Text>
                )}

                {!!error && <Text style={styles.error}>{error}</Text>}

                <Button
                    label={
                        selectedCount > 0
                            ? `Add ${selectedCount} Student${selectedCount === 1 ? '' : 's'}`
                            : 'Add Students'
                    }
                    onPress={handleSave}
                    loading={loading}
                    size="lg"
                    icon="user-plus"
                    style={{ marginTop: SPACING.lg }}
                    disabled={selectedCount === 0 || !batchId}
                />
                <View style={{ height: 60 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

const makeStyles = (colors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { flex: 1, paddingHorizontal: SPACING.base },
    sectionLabel: { fontSize: SIZES.base, fontWeight: '800', color: colors.text, marginTop: SPACING.lg, marginBottom: SPACING.md },
    batchOption: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.surface, borderRadius: RADIUS.md,
        padding: SPACING.md, marginBottom: SPACING.sm,
        borderWidth: 1.5, borderColor: colors.border, gap: SPACING.md,
    },
    batchDot: { width: 10, height: 10, borderRadius: 5 },
    batchName: { fontSize: SIZES.md, fontWeight: '700', color: colors.text },
    batchInfo: { fontSize: SIZES.xs, color: colors.textMuted, marginTop: 2 },
    radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border },
    radioActive: { borderColor: colors.primary, backgroundColor: colors.primary },
    searchBox: {
        flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
        backgroundColor: colors.surface, borderRadius: RADIUS.md,
        paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
        borderWidth: 1, borderColor: colors.border, marginBottom: SPACING.md,
    },
    searchInput: { flex: 1, color: colors.text, fontSize: SIZES.sm, padding: 0 },
    studentRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.surface, borderRadius: RADIUS.md,
        padding: SPACING.md, marginBottom: SPACING.sm,
        borderWidth: 1.5, borderColor: colors.border, gap: SPACING.md,
    },
    studentRowChecked: { borderColor: colors.primary, backgroundColor: colors.primary + '12' },
    checkbox: {
        width: 22, height: 22, borderRadius: 6,
        borderWidth: 2, borderColor: colors.border,
        alignItems: 'center', justifyContent: 'center',
    },
    checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
    studentName: { fontSize: SIZES.md, fontWeight: '700', color: colors.text },
    studentInfo: { fontSize: SIZES.xs, color: colors.textMuted, marginTop: 2 },
    notice: { color: colors.textMuted, fontSize: SIZES.sm, padding: SPACING.md, textAlign: 'center' },
    error: { color: colors.danger, fontSize: SIZES.sm, fontWeight: '600', textAlign: 'center', marginTop: SPACING.md },
});

export default AddStudent;
