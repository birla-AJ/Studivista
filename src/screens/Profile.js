import React, { useEffect, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity, Image, Alert, ActivityIndicator, Platform,
} from 'react-native';
import { errorCodes, isErrorWithCode, pick, types } from '@react-native-documents/picker';
import { SIZES, SPACING, RADIUS, SHADOWS } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import Header from '../components/Header';
import BottomTabBar from '../components/BottomTabBar';
import AppIcon from '../components/AppIcon';
import { useAuth } from '../contexts/AuthContext';
import { updateProfileAvatar } from '../services/authService';
import { Toast } from '../components/Toast';
import {
    subscribeBatches,
    subscribeBatchesByTeacher,
    subscribeBatchesByIds,
    subscribeUsersByRole,
    subscribeClasses,
    subscribeClassesByTeacher,
    subscribeClassesByBatches,
} from '../services/firestoreService';
import { formatJoined } from '../utils/format';

const Profile = ({ navigation }) => {
    const { colors, isDark, toggle } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const { user, profile, signOut, setSession } = useAuth();
    const [active, setActive] = useState('Profile');
    const [avatarSaving, setAvatarSaving] = useState(false);

    const [batches, setBatches] = useState([]);
    const [classes, setClasses] = useState([]);
    const [students, setStudents] = useState([]);
    const [teachers, setTeachers] = useState([]);

    const isAdmin = profile?.role === 'admin';
    const isTeacher = profile?.role === 'teacher';
    const isStudent = profile?.role === 'student';
    const role = profile?.role || 'student';
    const profileBatchIds = useMemo(() => profile?.batchIds || [], [profile]);

    // Live counts for the stats row.
    useEffect(() => {
        if (!user?.uid) return;
        if (isAdmin) {
            const u1 = subscribeBatches(setBatches);
            const u2 = subscribeUsersByRole('teacher', setTeachers);
            const u3 = subscribeUsersByRole('student', setStudents);
            const u4 = subscribeClasses(setClasses);
            return () => { u1?.(); u2?.(); u3?.(); u4?.(); };
        }
        if (isTeacher) {
            const u1 = subscribeBatchesByTeacher(user.uid, setBatches);
            const u2 = subscribeClassesByTeacher(user.uid, setClasses);
            const u3 = subscribeUsersByRole('student', setStudents);
            return () => { u1?.(); u2?.(); u3?.(); };
        }
        if (isStudent) {
            const u1 = subscribeBatchesByIds(profileBatchIds, setBatches);
            const u2 = subscribeClassesByBatches(profileBatchIds, setClasses);
            return () => { u1?.(); u2?.(); };
        }
    }, [user?.uid, isAdmin, isTeacher, isStudent, profileBatchIds]);

    const myBatchIds = useMemo(() => batches.map(b => b.id), [batches]);
    const myStudents = useMemo(
        () => students.filter(s => (s.batchIds || []).some(id => myBatchIds.includes(id))),
        [students, myBatchIds],
    );

    const stats = isAdmin
        ? [
            { label: 'Batches',  value: batches.length,  color: colors.primary },
            { label: 'Teachers', value: teachers.length, color: colors.teacherColor },
            { label: 'Students', value: students.length, color: colors.studentColor },
        ]
        : isTeacher
        ? [
            { label: 'Batches',  value: batches.length,        color: colors.primary },
            { label: 'Students', value: myStudents.length,     color: colors.secondary },
            { label: 'Classes',  value: classes.length,        color: colors.success },
        ]
        : [
            { label: 'Batches',  value: batches.length,        color: colors.primary },
            { label: 'Classes',  value: classes.length,        color: colors.success },
            { label: 'Joined',   value: classes.filter(c => (c.joinedStudentIds || []).includes(user?.uid)).length, color: colors.secondary },
        ];

    const initial = (profile?.name || profile?.email || '?').charAt(0).toUpperCase();
    const photoURL = profile?.avatar || profile?.photoURL;

    const normalizeUploadUri = uri =>
        Platform.OS === 'android' && uri && !uri.includes('://') ? `file://${uri}` : uri;

    const handleAvatarPress = async () => {
        if (avatarSaving) return;
        try {
            const [selected] = await pick({
                type: [types.images],
                allowMultiSelection: false,
            });
            if (!selected) return;

            setAvatarSaving(true);
            const nextProfile = await updateProfileAvatar(user.uid, {
                uri: normalizeUploadUri(selected.uri),
                name: selected.name || `profile-${user.uid}.jpg`,
                type: selected.type || 'image/jpeg',
            });
            await setSession(nextProfile);
            Toast.success('Profile picture saved.');
        } catch (e) {
            if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) return;
            Toast.error(e?.message || 'Could not save profile picture.', 'Profile picture');
        } finally {
            setAvatarSaving(false);
        }
    };

    const handleLogout = () => {
        Alert.alert('Log out?', 'Sign out of this account?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Sign out', style: 'destructive',
                onPress: async () => {
                    await signOut();
                    navigation.reset({
                        index: 0,
                        routes: [{ name: 'RoleSelect' }],
                    });
                },
            },
        ]);
    };

    const roleColor = isTeacher ? colors.teacherColor : isStudent ? colors.studentColor : colors.adminColor;
    const roleLabel = isTeacher ? 'Teacher' : isStudent ? 'Student' : 'Admin';

    return (
        <SafeAreaView style={styles.container}>
            <Header title="Profile" subtitle={profile?.email || ''} />

            <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
                {/* HERO CARD */}
                <View style={styles.hero}>
                    <TouchableOpacity
                        style={[styles.avatarRing, { borderColor: roleColor + '88' }]}
                        onPress={handleAvatarPress}
                        activeOpacity={0.82}
                        accessibilityRole="button"
                        accessibilityLabel="Change profile picture"
                        disabled={avatarSaving}
                    >
                        {photoURL ? (
                            <Image source={{ uri: photoURL }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: roleColor + '33' }]}>
                                <Text style={[styles.avatarInitial, { color: roleColor }]}>{initial}</Text>
                            </View>
                        )}
                        <View style={[styles.editAvatarBtn, { backgroundColor: colors.primary }]}>
                            {avatarSaving ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <AppIcon name="camera" size={12} color="#FFFFFF" />
                            )}
                        </View>
                    </TouchableOpacity>
                    <Text style={styles.name} numberOfLines={1}>{profile?.name || 'User'}</Text>
                    <View style={[styles.roleBadge, { backgroundColor: roleColor + '22', borderColor: roleColor + '55' }]}>
                        <Text style={[styles.roleText, { color: roleColor }]}>{roleLabel}</Text>
                    </View>
                    <Text style={styles.email} numberOfLines={1}>{profile?.email}</Text>
                </View>

                {/* STATS */}
                <View style={styles.statsRow}>
                    {stats.map(s => (
                        <View key={s.label} style={[styles.statCard, { borderTopColor: s.color }]}>
                            <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
                            <Text style={styles.statLabel}>{s.label}</Text>
                        </View>
                    ))}
                </View>

                {/* INFO */}
                <Text style={styles.sectionTitle}>Account</Text>
                <View style={styles.infoCard}>
                    <InfoRow icon="envelope" label="Email" value={profile?.email || '—'} colors={colors} />
                    {isTeacher && (
                        <InfoRow icon="book-open" label="Subject" value={profile?.subject || 'Not set'} colors={colors} />
                    )}
                    <InfoRow icon="user-tag" label="Role" value={roleLabel} colors={colors} />
                    <InfoRow
                        icon="calendar-alt"
                        label="Joined"
                        value={formatJoined(profile?.createdAt) || '—'}
                        colors={colors}
                        last
                    />
                </View>

                {/* SETTINGS */}
                <Text style={styles.sectionTitle}>Settings</Text>
                <TouchableOpacity style={styles.settingRow} onPress={toggle} activeOpacity={0.85}>
                    <View style={[styles.settingIcon, { backgroundColor: colors.primary + '22' }]}>
                        <AppIcon name={isDark ? 'sun' : 'moon'} size={16} color={colors.primary} />
                    </View>
                    <Text style={styles.settingLabel}>{isDark ? 'Light mode' : 'Dark mode'}</Text>
                    <AppIcon name="chevron-right" size={12} color={colors.textMuted} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.settingRow}
                    onPress={() => navigation.navigate('Notifications')}
                    activeOpacity={0.85}
                >
                    <View style={[styles.settingIcon, { backgroundColor: colors.warning + '22' }]}>
                        <AppIcon name="bell" size={16} color={colors.warning} />
                    </View>
                    <Text style={styles.settingLabel}>Notifications</Text>
                    <AppIcon name="chevron-right" size={12} color={colors.textMuted} />
                </TouchableOpacity>

                {/* LOGOUT */}
                <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
                    <AppIcon name="sign-out-alt" size={16} color={colors.danger} />
                    <Text style={[styles.logoutText, { color: colors.danger }]}>Sign out</Text>
                </TouchableOpacity>

                <Text style={styles.versionText}>Studivista · v1.0.0</Text>
            </ScrollView>

            <BottomTabBar activeScreen={active} onNavigate={setActive} role={role} />
        </SafeAreaView>
    );
};

const InfoRow = ({ icon, label, value, colors, last }) => (
    <View style={[infoRowStyles(colors).row, last && { borderBottomWidth: 0 }]}>
        <View style={infoRowStyles(colors).iconWrap}>
            <AppIcon name={icon} size={13} color={colors.textMuted} />
        </View>
        <Text style={infoRowStyles(colors).label}>{label}</Text>
        <Text style={infoRowStyles(colors).value} numberOfLines={1}>{value}</Text>
    </View>
);

const infoRowStyles = (colors) => StyleSheet.create({
    row: {
        flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
        paddingVertical: SPACING.md,
        borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
    },
    iconWrap: {
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: colors.surfaceSubtle,
        alignItems: 'center', justifyContent: 'center',
    },
    label: { fontSize: SIZES.sm, color: colors.textMuted, fontWeight: '600', minWidth: 70 },
    value: { fontSize: SIZES.sm, color: colors.text, fontWeight: '700', flex: 1, textAlign: 'right' },
});

const makeStyles = (colors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { flex: 1, paddingHorizontal: SPACING.base },

    hero: {
        alignItems: 'center', paddingVertical: SPACING.xl,
    },
    avatarRing: {
        width: 116, height: 116, borderRadius: 58,
        borderWidth: 3,
        alignItems: 'center', justifyContent: 'center',
        marginBottom: SPACING.md, position: 'relative',
        ...SHADOWS.medium,
    },
    avatar: { width: 100, height: 100, borderRadius: 50 },
    avatarFallback: { alignItems: 'center', justifyContent: 'center' },
    avatarInitial: { fontSize: 44, fontWeight: '900' },
    editAvatarBtn: {
        position: 'absolute', bottom: 4, right: 4,
        width: 28, height: 28, borderRadius: 14,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 2, borderColor: colors.bg,
    },
    name: { fontSize: SIZES.xxl, fontWeight: '900', color: colors.text, marginTop: SPACING.xs },
    roleBadge: {
        paddingHorizontal: SPACING.md, paddingVertical: 4,
        borderRadius: RADIUS.full, borderWidth: 1,
        marginTop: SPACING.sm,
    },
    roleText: { fontSize: SIZES.xs, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
    email: { fontSize: SIZES.sm, color: colors.textMuted, marginTop: SPACING.sm },

    statsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
    statCard: {
        flex: 1, backgroundColor: colors.surface, borderRadius: RADIUS.lg,
        padding: SPACING.md, alignItems: 'center',
        borderTopWidth: 3,
        borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
        ...SHADOWS.small,
    },
    statValue: { fontSize: SIZES.xxl, fontWeight: '900' },
    statLabel: { fontSize: SIZES.xs, color: colors.textMuted, fontWeight: '600', marginTop: 2 },

    sectionTitle: {
        fontSize: SIZES.base, fontWeight: '800', color: colors.text,
        marginTop: SPACING.lg, marginBottom: SPACING.sm,
    },
    infoCard: {
        backgroundColor: colors.surface, borderRadius: RADIUS.lg,
        paddingHorizontal: SPACING.md,
        borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
        ...SHADOWS.small,
    },

    settingRow: {
        flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
        backgroundColor: colors.surface, borderRadius: RADIUS.lg,
        padding: SPACING.md, marginBottom: SPACING.sm,
        borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
        ...SHADOWS.small,
    },
    settingIcon: {
        width: 36, height: 36, borderRadius: 18,
        alignItems: 'center', justifyContent: 'center',
    },
    settingLabel: { flex: 1, fontSize: SIZES.md, color: colors.text, fontWeight: '700' },

    logoutBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: SPACING.sm, backgroundColor: colors.danger + '15',
        borderRadius: RADIUS.lg, padding: SPACING.md, marginTop: SPACING.lg,
        borderWidth: 1, borderColor: colors.danger + '33',
    },
    logoutText: { fontSize: SIZES.md, fontWeight: '800' },

    versionText: {
        textAlign: 'center', color: colors.textMuted,
        fontSize: SIZES.xs, marginTop: SPACING.lg,
    },
});

export default Profile;
