import React, { useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SIZES, SPACING, RADIUS, SHADOWS } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';
import Header from '../../components/Header';
import AppIcon from '../../components/AppIcon';
import { getCourseById, paletteForLevel, formatPrice } from '../../data/courses';

const TAB_KEYS = ['Overview', 'Curriculum', 'Instructor'];

const CourseDetail = ({ navigation, route }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const courseId = route.params?.courseId;
    const course = useMemo(() => getCourseById(courseId), [courseId]);
    const [tab, setTab] = useState('Overview');

    if (!course) {
        return (
            <SafeAreaView style={styles.container}>
                <Header title="Course" showBack onBack={() => navigation.goBack()} />
                <View style={styles.notFound}>
                    <AppIcon name="exclamation-circle" size={32} color={colors.textMuted} />
                    <Text style={styles.notFoundText}>This course is no longer available.</Text>
                </View>
            </SafeAreaView>
        );
    }

    const pal = paletteForLevel(course.level);
    const discount = course.originalPrice
        ? Math.round(((course.originalPrice - course.price) / course.originalPrice) * 100)
        : 0;

    return (
        <SafeAreaView style={styles.container}>
            <Header title="Course Details" showBack onBack={() => navigation.goBack()} />

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 140 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Hero */}
                <LinearGradient
                    colors={pal.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.hero}
                >
                    {(() => {
                        const onLight = pal.onGradient === 'light';
                        const heroText = onLight ? '#FFFFFF' : pal.strong;
                        const heroMuted = onLight ? 'rgba(255,255,255,0.85)' : colors.text;
                        const dividerCol = onLight ? 'rgba(255,255,255,0.25)' : 'rgba(15,23,42,0.18)';
                        const pillBg = onLight ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.7)';
                        return (
                            <>
                                <View style={styles.heroTopRow}>
                                    <View style={[styles.levelBadge, { backgroundColor: onLight ? 'rgba(0,0,0,0.25)' : pal.rail }]}>
                                        <Text style={styles.levelBadgeText}>{course.level}</Text>
                                    </View>
                                    <View style={[styles.typeBadge, { backgroundColor: pillBg }]}>
                                        <View style={[styles.typeDot, { backgroundColor: course.type === 'Live' ? '#DC2626' : course.type === 'Hybrid' ? '#7C3AED' : '#2563EB' }]} />
                                        <Text style={[styles.typeBadgeText, { color: heroText }]}>{course.type}</Text>
                                    </View>
                                </View>
                                <View style={[styles.heroIcon, { backgroundColor: onLight ? 'rgba(255,255,255,0.18)' : pal.rail, borderWidth: onLight ? 1 : 0, borderColor: 'rgba(255,255,255,0.4)' }]}>
                                    <AppIcon name={course.icon} size={32} color="#FFFFFF" />
                                </View>
                                <Text style={[styles.heroTitle, { color: heroText }]}>{course.title}</Text>
                                <Text style={[styles.heroSubtitle, { color: heroMuted }]}>{course.subtitle}</Text>

                                <View style={[styles.heroStats, { borderColor: dividerCol }]}>
                                    <View style={styles.heroStat}>
                                        <AppIcon name="star" size={11} color="#FCD34D" />
                                        <Text style={[styles.heroStatVal, { color: heroText }]}>{course.rating.toFixed(1)}</Text>
                                        <Text style={[styles.heroStatLbl, { color: heroMuted }]}>({course.ratingCount})</Text>
                                    </View>
                                    <View style={[styles.heroStatDivider, { backgroundColor: dividerCol }]} />
                                    <View style={styles.heroStat}>
                                        <AppIcon name="user-graduate" size={11} color={heroText} />
                                        <Text style={[styles.heroStatVal, { color: heroText }]}>{course.students.toLocaleString('en-IN')}</Text>
                                        <Text style={[styles.heroStatLbl, { color: heroMuted }]}>students</Text>
                                    </View>
                                    <View style={[styles.heroStatDivider, { backgroundColor: dividerCol }]} />
                                    <View style={styles.heroStat}>
                                        <AppIcon name="globe" size={11} color={heroText} />
                                        <Text style={[styles.heroStatVal, { color: heroText }]}>{course.language}</Text>
                                    </View>
                                </View>
                            </>
                        );
                    })()}
                </LinearGradient>

                {/* Quick facts */}
                <View style={styles.factsGrid}>
                    {[
                        { icon: 'clock', label: 'Duration', value: `${course.durationWeeks} weeks` },
                        { icon: 'book', label: 'Lessons', value: `${course.lessons}` },
                        { icon: 'hourglass-half', label: 'Total', value: `${course.totalHours} hrs` },
                        { icon: 'calendar-alt', label: 'Schedule', value: course.schedule },
                    ].map(f => (
                        <View key={f.label} style={styles.factBox}>
                            <View style={[styles.factIcon, { backgroundColor: pal.tile }]}>
                                <AppIcon name={f.icon} size={14} color={pal.strong} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.factLabel}>{f.label}</Text>
                                <Text style={styles.factValue} numberOfLines={1}>{f.value}</Text>
                            </View>
                        </View>
                    ))}
                </View>

                {/* Tabs */}
                <View style={styles.tabs}>
                    {TAB_KEYS.map(name => {
                        const active = tab === name;
                        return (
                            <TouchableOpacity
                                key={name}
                                style={[styles.tab, active && styles.tabActive]}
                                onPress={() => setTab(name)}
                                activeOpacity={0.85}
                            >
                                <Text style={[styles.tabText, active && styles.tabTextActive]}>{name}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                <View style={{ paddingHorizontal: SPACING.base }}>
                    {tab === 'Overview' && (
                        <View>
                            <Text style={styles.sectionTitle}>About this course</Text>
                            <Text style={styles.aboutText}>{course.about}</Text>

                            <Text style={styles.sectionTitle}>What you'll learn</Text>
                            <View style={[styles.learnCard, { borderColor: pal.rail + '33', backgroundColor: pal.tile }]}>
                                {course.learnings.map((l, idx) => (
                                    <View key={idx} style={styles.learnItem}>
                                        <View style={[styles.checkCircle, { backgroundColor: pal.rail }]}>
                                            <AppIcon name="check" size={9} color="#FFFFFF" />
                                        </View>
                                        <Text style={styles.learnText}>{l}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    {tab === 'Curriculum' && (
                        <View>
                            <Text style={styles.sectionTitle}>Course curriculum</Text>
                            {course.modules.map((m, idx) => (
                                <View key={m.title} style={styles.moduleCard}>
                                    <View style={[styles.moduleNum, { backgroundColor: pal.tile }]}>
                                        <Text style={[styles.moduleNumText, { color: pal.strong }]}>{String(idx + 1).padStart(2, '0')}</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.moduleTitle} numberOfLines={2}>{m.title}</Text>
                                        <View style={styles.moduleMeta}>
                                            <AppIcon name="play-circle" size={10} color={colors.textMuted} />
                                            <Text style={styles.moduleMetaText}>{m.lessons} lessons</Text>
                                            <Text style={styles.moduleMetaDot}>•</Text>
                                            <AppIcon name="clock" size={10} color={colors.textMuted} />
                                            <Text style={styles.moduleMetaText}>{m.hours} hrs</Text>
                                        </View>
                                    </View>
                                    <AppIcon name="lock" size={12} color={colors.textMuted} />
                                </View>
                            ))}
                        </View>
                    )}

                    {tab === 'Instructor' && (
                        <View>
                            <Text style={styles.sectionTitle}>Your instructor</Text>
                            <View style={styles.instructorCard}>
                                <View style={[styles.instructorAvatar, { backgroundColor: pal.rail }]}>
                                    <Text style={styles.instructorInitial}>
                                        {course.instructor.split(' ').filter(Boolean).slice(-1)[0]?.[0] || '?'}
                                    </Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.instructorName}>{course.instructor}</Text>
                                    <Text style={styles.instructorTitle}>{course.instructorTitle}</Text>
                                    <View style={styles.instructorBadges}>
                                        <View style={[styles.iBadge, { backgroundColor: pal.tile }]}>
                                            <AppIcon name="star" size={9} color="#F59E0B" />
                                            <Text style={[styles.iBadgeText, { color: pal.strong }]}>{course.rating.toFixed(1)}</Text>
                                        </View>
                                        <View style={[styles.iBadge, { backgroundColor: pal.tile }]}>
                                            <AppIcon name="users" size={9} color={pal.strong} />
                                            <Text style={[styles.iBadgeText, { color: pal.strong }]}>
                                                {course.students.toLocaleString('en-IN')}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            </View>
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* Sticky Buy bar */}
            <View style={styles.buyBar}>
                <View style={{ flex: 1 }}>
                    {!!course.originalPrice && (
                        <Text style={styles.buyOriginal}>{formatPrice(course.originalPrice)}</Text>
                    )}
                    <View style={styles.buyPriceRow}>
                        <Text style={styles.buyPrice}>{formatPrice(course.price)}</Text>
                        {discount > 0 && (
                            <View style={styles.buyDiscount}>
                                <Text style={styles.buyDiscountText}>{discount}% OFF</Text>
                            </View>
                        )}
                    </View>
                </View>
                <TouchableOpacity
                    onPress={() => navigation.navigate('Payment', { courseId: course.id })}
                    activeOpacity={0.9}
                    style={styles.buyBtnShadow}
                >
                    <LinearGradient
                        colors={pal.gradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.buyBtn}
                    >
                        <AppIcon name="bolt" size={14} color="#FFFFFF" />
                        <Text style={styles.buyBtnText}>Buy for {formatPrice(course.price)}</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const makeStyles = colors => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
    notFoundText: { color: colors.textMuted, fontSize: SIZES.sm },

    hero: {
        margin: SPACING.base,
        marginBottom: SPACING.sm,
        borderRadius: RADIUS.xl,
        padding: SPACING.base,
    },
    heroTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    levelBadge: {
        paddingHorizontal: SPACING.sm,
        paddingVertical: 4,
        borderRadius: RADIUS.full,
    },
    levelBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.4 },
    typeBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: 'rgba(255,255,255,0.7)',
        paddingHorizontal: SPACING.sm, paddingVertical: 4,
        borderRadius: RADIUS.full,
    },
    typeDot: { width: 6, height: 6, borderRadius: 3 },
    typeBadgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.3 },

    heroIcon: {
        width: 64, height: 64, borderRadius: 20,
        alignItems: 'center', justifyContent: 'center',
        marginTop: SPACING.base,
        ...SHADOWS.small,
    },
    heroTitle: { fontSize: SIZES.title, fontWeight: '900', marginTop: SPACING.md, letterSpacing: 0.2 },
    heroSubtitle: { fontSize: SIZES.sm, color: colors.text, marginTop: 4, fontWeight: '500' },

    heroStats: {
        flexDirection: 'row', alignItems: 'center',
        marginTop: SPACING.base,
        paddingTop: SPACING.md,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(15,23,42,0.12)',
    },
    heroStat: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
    heroStatVal: { color: colors.text, fontSize: SIZES.xs, fontWeight: '900' },
    heroStatLbl: { color: colors.textMuted, fontSize: 10, fontWeight: '600' },
    heroStatDivider: { width: StyleSheet.hairlineWidth, height: 16, backgroundColor: 'rgba(15,23,42,0.18)' },

    factsGrid: {
        flexDirection: 'row', flexWrap: 'wrap',
        gap: SPACING.sm,
        paddingHorizontal: SPACING.base,
        marginTop: SPACING.sm,
    },
    factBox: {
        flex: 1, minWidth: '45%',
        flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
        backgroundColor: colors.surface,
        borderRadius: RADIUS.lg,
        padding: SPACING.md,
        borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    },
    factIcon: { width: 32, height: 32, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
    factLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
    factValue: { color: colors.text, fontSize: SIZES.sm, fontWeight: '800', marginTop: 1 },

    tabs: {
        flexDirection: 'row',
        gap: SPACING.xs,
        marginHorizontal: SPACING.base,
        marginTop: SPACING.base,
        backgroundColor: colors.surfaceSubtle,
        borderRadius: RADIUS.full,
        padding: 4,
        borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    },
    tab: { flex: 1, alignItems: 'center', paddingVertical: SPACING.sm, borderRadius: RADIUS.full },
    tabActive: { backgroundColor: colors.surface, ...SHADOWS.small },
    tabText: { color: colors.textMuted, fontSize: SIZES.xs, fontWeight: '800' },
    tabTextActive: { color: colors.text },

    sectionTitle: { fontSize: SIZES.base, fontWeight: '900', color: colors.text, marginTop: SPACING.base, marginBottom: SPACING.sm },
    aboutText: { fontSize: SIZES.sm, color: colors.textMuted, lineHeight: 22 },

    learnCard: {
        borderRadius: RADIUS.lg,
        padding: SPACING.md,
        borderWidth: StyleSheet.hairlineWidth,
        gap: SPACING.sm,
    },
    learnItem: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
    checkCircle: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
    learnText: { flex: 1, color: colors.text, fontSize: SIZES.sm, fontWeight: '600', lineHeight: 20 },

    moduleCard: {
        flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
        backgroundColor: colors.surface, borderRadius: RADIUS.lg,
        padding: SPACING.md, marginBottom: SPACING.sm,
        borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    },
    moduleNum: { width: 42, height: 42, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
    moduleNumText: { fontSize: SIZES.md, fontWeight: '900' },
    moduleTitle: { color: colors.text, fontSize: SIZES.sm, fontWeight: '800' },
    moduleMeta: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
    moduleMetaText: { color: colors.textMuted, fontSize: 10, fontWeight: '700' },
    moduleMetaDot: { color: colors.textMuted, fontSize: 10 },

    instructorCard: {
        flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
        backgroundColor: colors.surface, borderRadius: RADIUS.lg,
        padding: SPACING.base,
        borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    },
    instructorAvatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
    instructorInitial: { color: '#FFFFFF', fontSize: SIZES.xl, fontWeight: '900' },
    instructorName: { color: colors.text, fontSize: SIZES.md, fontWeight: '900' },
    instructorTitle: { color: colors.textMuted, fontSize: SIZES.xs, marginTop: 2 },
    instructorBadges: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
    iBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.full },
    iBadgeText: { fontSize: 10, fontWeight: '900' },

    buyBar: {
        position: 'absolute', left: 0, right: 0, bottom: 0,
        flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
        paddingHorizontal: SPACING.base,
        paddingTop: SPACING.md,
        paddingBottom: SPACING.base + 8,
        backgroundColor: colors.surface,
        borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
        ...SHADOWS.medium,
    },
    buyOriginal: { color: colors.textMuted, fontSize: 11, fontWeight: '700', textDecorationLine: 'line-through' },
    buyPriceRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    buyPrice: { color: colors.text, fontSize: SIZES.xxl, fontWeight: '900' },
    buyDiscount: { backgroundColor: '#0F172A', paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.full },
    buyDiscountText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.3 },
    buyBtnShadow: {
        borderRadius: RADIUS.full,
        ...SHADOWS.small,
    },
    buyBtn: {
        flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
        paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
        borderRadius: RADIUS.full,
    },
    buyBtnText: { color: '#FFFFFF', fontSize: SIZES.sm, fontWeight: '900', letterSpacing: 0.3 },
});

export default CourseDetail;
