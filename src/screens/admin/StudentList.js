import React, { useEffect, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, SafeAreaView,
    TouchableOpacity, TextInput, ActivityIndicator,
} from 'react-native';
import { SIZES, SPACING, RADIUS, SHADOWS } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';
import Header from '../../components/Header';
import BottomTabBar from '../../components/BottomTabBar';
import AppIcon from '../../components/AppIcon';
import { subscribeUsersByRole, subscribeBatches } from '../../services/firestoreService';
import { formatJoined, isUserOnline } from '../../utils/format';

const StudentRow = ({ student, batchName }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeRowStyles(colors), [colors]);
    const online = isUserOnline(student);
    return (
        <View style={styles.studentRow}>
            <View style={styles.avatar}>
                <AppIcon name="graduation-cap" size={20} color={colors.studentColor} />
                <View style={[styles.presenceDot, { backgroundColor: online ? colors.success : colors.offline }]} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.studentName}>{student.name || '—'}</Text>
                <Text style={styles.studentEmail}>{student.email}</Text>
                <View style={styles.studentBatchRow}>
                    <AppIcon name="book-open" size={11} color={colors.textMuted} />
                    <Text style={styles.studentBatch}>
                        {batchName || 'Unassigned'} • Joined {formatJoined(student.createdAt)}
                    </Text>
                </View>
            </View>
            <View style={[styles.statusDot, { backgroundColor: colors.success + '22', borderColor: colors.success + '44' }]}>
                <Text style={[styles.statusText, { color: colors.success }]}>Active</Text>
            </View>
        </View>
    );
};

const StudentList = ({ navigation, route }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const filterBatchId = route?.params?.batchId;
    const [active, setActive] = useState('StudentList');
    const [search, setSearch] = useState('');
    const [students, setStudents] = useState(null);
    const [batches, setBatches] = useState([]);

    useEffect(() => {
        const u1 = subscribeUsersByRole('student', setStudents);
        const u2 = subscribeBatches(setBatches);
        return () => { u1?.(); u2?.(); };
    }, []);

    const batchById = useMemo(() => {
        const m = {};
        batches.forEach(b => { m[b.id] = b; });
        return m;
    }, [batches]);

    const handleNav = (screen) => {
        setActive(screen);
        navigation.navigate(screen);
    };

    const list = students || [];
    const filtered = list.filter(s => {
        const matchSearch = !search.trim() ||
            (s.name || '').toLowerCase().includes(search.toLowerCase()) ||
            (s.email || '').toLowerCase().includes(search.toLowerCase());
        const matchBatch = !filterBatchId || (s.batchIds || []).includes(filterBatchId);
        return matchSearch && matchBatch;
    });

    return (
        <SafeAreaView style={styles.container}>
            <Header
                title="Students"
                subtitle={students === null ? 'Loading…' : `${filtered.length} of ${list.length} students`}
                showBack
                onBack={() => navigation.goBack()}
                rightComponent={
                    <TouchableOpacity onPress={() => navigation.navigate('CreateStudent')} style={styles.addBtn}>
                        <Text style={styles.addBtnText}>+</Text>
                    </TouchableOpacity>
                }
            />

            <View style={styles.searchContainer}>
                <AppIcon name="search" size={16} color={colors.textMuted} style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search students..."
                    placeholderTextColor={colors.textMuted}
                    value={search}
                    onChangeText={setSearch}
                />
            </View>

            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                {students === null ? (
                    <View style={styles.empty}>
                        <ActivityIndicator color={colors.primary} />
                    </View>
                ) : filtered.length === 0 ? (
                    <View style={styles.empty}>
                        <AppIcon name="graduation-cap" size={48} color={colors.textMuted} />
                        <Text style={styles.emptyText}>No students found</Text>
                        <TouchableOpacity style={styles.cta} onPress={() => navigation.navigate('CreateStudent')}>
                            <Text style={styles.ctaText}>+ Create Student</Text>
                        </TouchableOpacity>
                    </View>
                ) : filtered.map(s => {
                    const firstBatchId = (s.batchIds || [])[0];
                    return (
                        <StudentRow key={s.uid} student={s} batchName={batchById[firstBatchId]?.name} />
                    );
                })}
                <View style={{ height: 100 }} />
            </ScrollView>

            <BottomTabBar activeScreen={active} onNavigate={handleNav} role="admin" />
        </SafeAreaView>
    );
};

const makeStyles = (colors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { flex: 1 },
    addBtn: { width: 34, height: 34, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
    addBtnText: { color: '#FFFFFF', fontSize: 22, fontWeight: '700', lineHeight: 28 },
    searchContainer: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.surface, borderRadius: RADIUS.md,
        marginHorizontal: SPACING.base, marginTop: SPACING.sm,
        paddingHorizontal: SPACING.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    },
    searchIcon: { marginRight: SPACING.sm },
    searchInput: { flex: 1, paddingVertical: SPACING.md, color: colors.text, fontSize: SIZES.md },
    empty: { alignItems: 'center', paddingTop: 80, gap: SPACING.md },
    emptyText: { color: colors.textMuted, fontSize: SIZES.base, fontWeight: '600' },
    cta: {
        backgroundColor: colors.primary, paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md, borderRadius: RADIUS.full, marginTop: SPACING.md,
    },
    ctaText: { color: '#FFFFFF', fontSize: SIZES.md, fontWeight: '700' },
});

const makeRowStyles = (colors) => StyleSheet.create({
    studentRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.surface, borderRadius: RADIUS.lg,
        padding: SPACING.md, marginHorizontal: SPACING.base, marginTop: SPACING.sm,
        gap: SPACING.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...SHADOWS.small,
    },
    avatar: {
        width: 46, height: 46, borderRadius: 23,
        backgroundColor: colors.studentColor + '22',
        alignItems: 'center', justifyContent: 'center',
        position: 'relative',
    },
    presenceDot: {
        position: 'absolute', bottom: 0, right: 0,
        width: 12, height: 12, borderRadius: 6,
        borderWidth: 2, borderColor: colors.surface,
    },
    studentName: { fontSize: SIZES.md, fontWeight: '700', color: colors.text },
    statusDot: { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.full, borderWidth: 1 },
    statusText: { fontSize: SIZES.xs, fontWeight: '700' },
    studentEmail: { fontSize: SIZES.sm, color: colors.textMuted, marginTop: 2 },
    studentBatchRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
    studentBatch: { fontSize: SIZES.xs, color: colors.textMuted },
});

export default StudentList;
