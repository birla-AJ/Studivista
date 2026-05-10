import React, { useEffect, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, TextInput, ActivityIndicator,
} from 'react-native';
import { SIZES, SPACING, RADIUS, SHADOWS } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';
import Header from '../../components/Header';
import BottomTabBar from '../../components/BottomTabBar';
import AppIcon from '../../components/AppIcon';
import { subscribeUsersByRole, subscribeBatches } from '../../services/firestoreService';
import { isUserOnline } from '../../utils/format';

const TeacherList = ({ navigation }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [active, setActive] = useState('TeacherList');
    const [teachers, setTeachers] = useState(null);
    const [batches, setBatches] = useState([]);
    const [search, setSearch] = useState('');

    useEffect(() => {
        const u1 = subscribeUsersByRole('teacher', setTeachers);
        const u2 = subscribeBatches(setBatches);
        return () => { u1?.(); u2?.(); };
    }, []);

    const batchCountByTeacher = useMemo(() => {
        const m = {};
        batches.forEach(b => {
            if (!b.teacherId) return;
            m[b.teacherId] = (m[b.teacherId] || 0) + 1;
        });
        return m;
    }, [batches]);

    const handleNav = (screen) => {
        setActive(screen);
        navigation.navigate(screen);
    };

    const filtered = (teachers || []).filter(t =>
        !search.trim() ||
        (t.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (t.email || '').toLowerCase().includes(search.toLowerCase()),
    );

    return (
        <SafeAreaView style={styles.container}>
            <Header
                title="Teachers"
                subtitle={teachers === null ? 'Loading…' : `${teachers.length} total`}
                showBack
                onBack={() => navigation.goBack()}
                rightComponent={
                    <TouchableOpacity onPress={() => navigation.navigate('AddTeacher')} style={styles.addBtn}>
                        <Text style={styles.addBtnText}>+</Text>
                    </TouchableOpacity>
                }
            />

            <View style={styles.searchContainer}>
                <AppIcon name="search" size={16} color={colors.textMuted} style={styles.searchIcon} />
                <TextInput
                    style={styles.searchInput}
                    placeholder="Search teachers..."
                    placeholderTextColor={colors.textMuted}
                    value={search}
                    onChangeText={setSearch}
                />
            </View>

            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                {teachers === null ? (
                    <View style={styles.empty}>
                        <ActivityIndicator color={colors.primary} />
                    </View>
                ) : filtered.length === 0 ? (
                    <View style={styles.empty}>
                        <AppIcon name="chalkboard-teacher" size={48} color={colors.textMuted} />
                        <Text style={styles.emptyText}>No teachers yet</Text>
                        <Text style={styles.emptySub}>Add your first teacher to get started.</Text>
                        <TouchableOpacity style={styles.cta} onPress={() => navigation.navigate('AddTeacher')}>
                            <Text style={styles.ctaText}>+ Add Teacher</Text>
                        </TouchableOpacity>
                    </View>
                ) : filtered.map(t => (
                    <View key={t.uid} style={styles.row}>
                        <View style={styles.avatar}>
                            <AppIcon name="chalkboard-teacher" size={22} color={colors.teacherColor} />
                            <View style={[styles.presenceDot, { backgroundColor: isUserOnline(t) ? colors.success : colors.offline }]} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.name}>{t.name || '—'}</Text>
                            <Text style={styles.email}>{t.email}</Text>
                            <View style={styles.metaRow}>
                                {!!t.subject && (
                                    <View style={styles.metaItem}>
                                        <AppIcon name="book-open" size={11} color={colors.textMuted} />
                                        <Text style={styles.metaText}>{t.subject}</Text>
                                    </View>
                                )}
                                <View style={styles.metaItem}>
                                    <AppIcon name="users" size={11} color={colors.textMuted} />
                                    <Text style={styles.metaText}>
                                        {batchCountByTeacher[t.uid] || 0} batch{(batchCountByTeacher[t.uid] || 0) === 1 ? '' : 'es'}
                                    </Text>
                                </View>
                            </View>
                        </View>
                        <View style={[styles.statusPill, { backgroundColor: colors.success + '22', borderColor: colors.success + '44' }]}>
                            <Text style={[styles.statusText, { color: colors.success }]}>{t.status || 'active'}</Text>
                        </View>
                    </View>
                ))}
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
    row: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.surface, borderRadius: RADIUS.lg,
        padding: SPACING.md, marginHorizontal: SPACING.base,
        marginTop: SPACING.sm, gap: SPACING.md,
        borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...SHADOWS.small,
    },
    avatar: {
        width: 46, height: 46, borderRadius: 23,
        backgroundColor: colors.teacherColor + '22',
        alignItems: 'center', justifyContent: 'center',
        position: 'relative',
    },
    presenceDot: {
        position: 'absolute', bottom: 0, right: 0,
        width: 12, height: 12, borderRadius: 6,
        borderWidth: 2, borderColor: colors.surface,
    },
    name: { color: colors.text, fontSize: SIZES.md, fontWeight: '700' },
    email: { color: colors.textMuted, fontSize: SIZES.sm, marginTop: 2 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginTop: 4, flexWrap: 'wrap' },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    metaText: { color: colors.textMuted, fontSize: SIZES.xs, fontWeight: '600' },
    statusPill: { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.full, borderWidth: 1 },
    statusText: { fontSize: SIZES.xs, fontWeight: '700' },
    empty: { alignItems: 'center', paddingTop: 80, gap: SPACING.md },
    emptyText: { color: colors.text, fontSize: SIZES.lg, fontWeight: '700' },
    emptySub: { color: colors.textMuted, fontSize: SIZES.sm },
    cta: {
        backgroundColor: colors.primary, paddingHorizontal: SPACING.lg,
        paddingVertical: SPACING.md, borderRadius: RADIUS.full, marginTop: SPACING.md,
    },
    ctaText: { color: '#FFFFFF', fontSize: SIZES.md, fontWeight: '700' },
});

export default TeacherList;
