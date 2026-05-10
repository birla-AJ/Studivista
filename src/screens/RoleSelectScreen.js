import React, { useMemo } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView, Image } from 'react-native';
import { SIZES, SPACING, RADIUS, SHADOWS } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import AppIcon from '../components/AppIcon';

const RoleSelectScreen = ({ navigation }) => {
    const { colors, toggle, isDark } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);

    const ROLES = [
        { id: 'admin', label: 'Admin', description: 'Manage teachers, students, and batches.', icon: 'user-shield', color: colors.adminColor },
        { id: 'teacher', label: 'Teacher', description: 'Run classes, take attendance, share recordings.', icon: 'chalkboard-teacher', color: colors.teacherColor },
        { id: 'student', label: 'Student', description: 'Join classes, track attendance, learn.', icon: 'user-graduate', color: colors.studentColor },
    ];

    const pickRole = (role) => navigation.navigate('Login', { role });

    return (
        <SafeAreaView style={styles.container}>
            {!isDark && (
                <Image source={require('../assets/logo.png')} style={styles.bgWatermark} resizeMode="contain" pointerEvents="none" />
            )}
            <View style={styles.bgCircle1} />
            <View style={styles.bgCircle2} />

            <TouchableOpacity onPress={toggle} style={styles.themeBtn} activeOpacity={0.7}>
                <AppIcon name={isDark ? 'sun' : 'moon'} size={18} color={colors.text} />
            </TouchableOpacity>

            <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                <View style={styles.header}>
                    <Image source={require('../assets/logo.png')} style={styles.logoImg} resizeMode="cover" />
                    <Text style={styles.title}>Who are you?</Text>
                    <Text style={styles.subtitle}>Pick your role to continue.</Text>
                </View>

                <View style={styles.cards}>
                    {ROLES.map(r => (
                        <TouchableOpacity
                            key={r.id}
                            activeOpacity={0.85}
                            style={styles.card}
                            onPress={() => pickRole(r.id)}
                        >
                            <View style={[styles.iconWrap, { backgroundColor: r.color + '22' }]}>
                                <AppIcon name={r.icon} size={26} color={r.color} />
                            </View>
                            <View style={styles.cardText}>
                                <Text style={styles.cardLabel}>{r.label}</Text>
                                <Text style={styles.cardDesc}>{r.description}</Text>
                            </View>
                            <AppIcon name="chevron-right" size={14} color={colors.textMuted} />
                        </TouchableOpacity>
                    ))}
                </View>

                <Text style={styles.footer}>
                    Admins are seeded by us. Teachers are added by an admin.
                    Students are added by their teacher.
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
};

const makeStyles = (colors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    bgWatermark: {
        position: 'absolute', alignSelf: 'center', top: '20%',
        width: '110%', height: '70%', opacity: 0.07,
    },
    bgCircle1: {
        position: 'absolute', width: 280, height: 280, borderRadius: 140,
        backgroundColor: colors.primary + '12', top: -90, right: -80,
    },
    bgCircle2: {
        position: 'absolute', width: 200, height: 200, borderRadius: 100,
        backgroundColor: colors.secondary + '10', bottom: 60, left: -60,
    },
    themeBtn: {
        position: 'absolute', top: SPACING.xxl, right: SPACING.lg, zIndex: 5,
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: colors.border,
    },
    scroll: { padding: SPACING.xl, paddingBottom: SPACING.xxxl, flexGrow: 1 },
    header: { alignItems: 'center', marginTop: SPACING.xl, marginBottom: SPACING.xxl },
    logoImg: {
        width: 96, height: 96, borderRadius: 24, marginBottom: SPACING.lg,
        ...SHADOWS.primary,
    },
    title: {
        fontSize: SIZES.title, fontWeight: '900', color: colors.text,
        textAlign: 'center', marginBottom: SPACING.xs,
    },
    subtitle: { fontSize: SIZES.md, color: colors.textMuted, textAlign: 'center' },
    cards: { gap: SPACING.md, marginTop: SPACING.md },
    card: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.surface, borderRadius: RADIUS.lg,
        padding: SPACING.lg, gap: SPACING.md,
        borderWidth: 1, borderColor: colors.border,
        ...SHADOWS.small,
    },
    iconWrap: {
        width: 52, height: 52, borderRadius: RADIUS.md,
        alignItems: 'center', justifyContent: 'center',
    },
    cardText: { flex: 1 },
    cardLabel: { fontSize: SIZES.lg, fontWeight: '800', color: colors.text, marginBottom: 2 },
    cardDesc: { fontSize: SIZES.sm, color: colors.textMuted, lineHeight: 18 },
    footer: {
        marginTop: SPACING.xl, fontSize: SIZES.xs, color: colors.textMuted,
        textAlign: 'center', lineHeight: 18,
    },
});

export default RoleSelectScreen;
