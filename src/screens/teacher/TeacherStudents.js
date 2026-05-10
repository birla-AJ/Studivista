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
import { subscribeUsersByRole, subscribeBatchesByTeacher } from '../../services/firestoreService';
import { useAuth } from '../../contexts/AuthContext';
import { formatJoined } from '../../utils/format';

const TeacherStudents = ({ navigation }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const { user } = useAuth();
    const [active, setActive] = useState('TeacherStudents');
    const [search, setSearch] = useState('');
    const [students, setStudents] = useState(null);
    const [batches, setBatches] = useState([]);

    useEffect(() => {
        if (!user?.uid) return;
        const u1 = subscribeUsersByRole('student', setStudents);
        const u2 = subscribeBatchesByTeacher(user.uid, setBatches);
        return () => { u1?.(); u2?.(); };
    }, [user?.uid]);

    const handleNav = (screen) => {
        setActive(screen);
        const routes = {
            TeacherDashboard: 'TeacherDashboard', MyClasses: 'MyClasses',
            Attendance: 'Attendance', Recordings: 'Recordings',
        };
        if (routes[screen]) navigation.navigate(screen);
    };

    const myBatchIds = useMemo(() => batches.map(b => b.id), [batches]);
    const batchById = useMemo(() => {
        const m = {};
        batches.forEach(b => { m[b.id] = b; });
        return m;
    }, [batches]);

    const myStudents = (students || []).filter(s =>
        (s.batchIds || []).some(bid => myBatchIds.includes(bid))
    );

    const filtered = myStudents.filter(s =>
        !search.trim() ||
        (s.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (s.email || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <SafeAreaView style={styles.container}>
            <Header
                title="My Students"
                subtitle={students === null ? 'Loading…' : `${myStudents.length} students across ${batches.length} batch${batches.length === 1 ? '' : 'es'}`}
                showBack
                onBack={() => navigation.goBack()}
                rightComponent={
                    <TouchableOpacity onPress={() => navigation.navigate('AddStudent')} style={styles.addBtn}>
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
                    <View style={styles.empty}><ActivityIndicator color={colors.primary} /></View>
                ) : batches.length === 0 ? (
                    <View style={styles.empty}>
                        <AppIcon name="users" size={48} color={colors.textMuted} />
                        <Text style={styles.emptyText}>No batches assigned</Text>
                        <Text style={styles.emptySub}>Ask the admin to assign you a batch.</Text>
                    </View>
                ) : filtered.length === 0 ? (
                    <View style={styles.empty}>
                        <AppIcon name="graduation-cap" size={48} color={colors.textMuted} />
                        <Text style={styles.emptyText}>No students yet</Text>
                        <Text style={styles.emptySub}>Add a student to one of your batches.</Text>
                        <TouchableOpacity style={styles.cta} onPress={() => navigation.navigate('AddStudent')}>
                            <Text style={styles.ctaText}>+ Add Student</Text>
                        </TouchableOpacity>
                    </View>
                ) : filtered.map(s => {
                    const myBatchId = (s.batchIds || []).find(b => myBatchIds.includes(b));
                    const batchName = batchById[myBatchId]?.name || '—';
                    return (
                        <View key={s.uid} style={styles.row}>
                            <View style={styles.avatar}>
                                <AppIcon name="graduation-cap" size={20} color={colors.studentColor} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.name}>{s.name || '—'}</Text>
                                <Text style={styles.email}>{s.email}</Text>
                                <View style={styles.metaRow}>
                                    <AppIcon name="book-open" size={11} color={colors.textMuted} />
                                    <Text style={styles.meta}>{batchName} • Joined {formatJoined(s.createdAt)}</Text>
                                </View>
                            </View>
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
    row: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.surface, borderRadius: RADIUS.lg,
        padding: SPACING.md, marginHorizontal: SPACING.base, marginTop: SPACING.sm,
        gap: SPACING.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...SHADOWS.small,
    },
    avatar: {
        width: 46, height: 46, borderRadius: 23,
        backgroundColor: colors.studentColor + '22',
        alignItems: 'center', justifyContent: 'center',
    },
    name: { fontSize: SIZES.md, fontWeight: '700', color: colors.text },
    email: { fontSize: SIZES.sm, color: colors.textMuted, marginTop: 2 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
    meta: { fontSize: SIZES.xs, color: colors.textMuted },
    empty: { alignItems: 'center', paddingTop: 80, gap: SPACING.md, paddingHorizontal: SPACING.lg },
    emptyText: { color: colors.text, fontSize: SIZES.lg, fontWeight: '700' },
    emptySub: { color: colors.textMuted, fontSize: SIZES.sm, textAlign: 'center' },
    cta: { backgroundColor: colors.primary, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md, borderRadius: RADIUS.full, marginTop: SPACING.md },
    ctaText: { color: '#FFFFFF', fontSize: SIZES.md, fontWeight: '700' },
});

export default TeacherStudents;
