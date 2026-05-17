import React, { useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity, TextInput,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SIZES, SPACING, RADIUS, SHADOWS } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';
import Header from '../../components/Header';
import AppIcon from '../../components/AppIcon';
import { COURSES, COURSE_CATEGORIES, LEVEL_PALETTE, paletteForLevel, formatPrice } from '../../data/courses';

// Tab pill colors — `All` stays neutral slate, the rest pick up their level palette.
const TAB_PALETTE = {
    All:          { tile: '#E2E8F0', strong: '#0F172A', rail: '#0F172A' },
    Beginner:     LEVEL_PALETTE.Beginner,
    Intermediate: LEVEL_PALETTE.Intermediate,
    Advanced:     LEVEL_PALETTE.Advanced,
};

const TYPE_META = {
    Live:     { icon: 'broadcast-tower', color: '#DC2626' },
    Recorded: { icon: 'play-circle',     color: '#2563EB' },
    Hybrid:   { icon: 'random',          color: '#7C3AED' },
};

const StudentCourses = ({ navigation }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const [query, setQuery] = useState('');
    const [category, setCategory] = useState('All');

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return COURSES.filter(c => {
            if (category !== 'All' && c.category !== category) return false;
            if (!q) return true;
            return (
                c.title.toLowerCase().includes(q) ||
                c.subtitle.toLowerCase().includes(q) ||
                c.instructor.toLowerCase().includes(q)
            );
        });
    }, [query, category]);

    const renderCard = ({ item }) => {
        const pal = paletteForLevel(item.level);
        const type = TYPE_META[item.type] || TYPE_META.Recorded;
        const discount = item.originalPrice
            ? Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)
            : 0;

        return (
            <TouchableOpacity
                style={styles.card}
                activeOpacity={0.9}
                onPress={() => navigation.navigate('CourseDetail', { courseId: item.id })}
            >
                <LinearGradient
                    colors={pal.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.coverBand}
                >
                    <View style={[styles.coverIcon, { backgroundColor: pal.rail }]}>
                        <AppIcon name={item.icon} size={24} color="#FFFFFF" />
                    </View>
                    <View style={styles.coverTopRow}>
                        <View style={[styles.typePill, { backgroundColor: type.color }]}>
                            <AppIcon name={type.icon} size={9} color="#FFFFFF" />
                            <Text style={styles.typePillText}>{item.type}</Text>
                        </View>
                        {discount > 0 && (
                            <View style={styles.discountPill}>
                                <Text style={styles.discountText}>{discount}% OFF</Text>
                            </View>
                        )}
                    </View>
                    <View style={[
                        styles.levelPill,
                        { backgroundColor: pal.onGradient === 'light' ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.65)', borderColor: pal.onGradient === 'light' ? 'rgba(255,255,255,0.45)' : pal.rail + '55' },
                    ]}>
                        <Text style={[
                            styles.levelText,
                            { color: pal.onGradient === 'light' ? '#FFFFFF' : pal.strong },
                        ]}>
                            {item.level}
                        </Text>
                    </View>
                </LinearGradient>

                <View style={styles.body}>
                    <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
                    <Text style={styles.subtitle} numberOfLines={1}>{item.subtitle}</Text>

                    <View style={styles.instructorRow}>
                        <View style={[styles.instructorDot, { backgroundColor: pal.rail }]} />
                        <Text style={styles.instructor} numberOfLines={1}>{item.instructor}</Text>
                    </View>

                    <View style={styles.metaRow}>
                        <View style={styles.metaItem}>
                            <AppIcon name="clock" size={10} color={colors.textMuted} />
                            <Text style={styles.metaText}>{item.durationWeeks} weeks</Text>
                        </View>
                        <View style={styles.metaDivider} />
                        <View style={styles.metaItem}>
                            <AppIcon name="book" size={10} color={colors.textMuted} />
                            <Text style={styles.metaText}>{item.lessons} lessons</Text>
                        </View>
                        <View style={styles.metaDivider} />
                        <View style={styles.metaItem}>
                            <AppIcon name="hourglass-half" size={10} color={colors.textMuted} />
                            <Text style={styles.metaText}>{item.totalHours}h</Text>
                        </View>
                    </View>

                    <View style={styles.footerRow}>
                        <View style={styles.ratingRow}>
                            <AppIcon name="star" size={11} color="#F59E0B" />
                            <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
                            <Text style={styles.ratingCount}>({item.ratingCount})</Text>
                        </View>
                        <View style={styles.priceCol}>
                            {!!item.originalPrice && (
                                <Text style={styles.originalPrice}>{formatPrice(item.originalPrice)}</Text>
                            )}
                            <Text style={[styles.price, { color: pal.strong }]}>{formatPrice(item.price)}</Text>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            <Header title="Courses" subtitle="Explore and enrol" showBack onBack={() => navigation.goBack()} />

            <View style={styles.topContent}>
                <View style={styles.searchWrap}>
                    <AppIcon name="search" size={14} color={colors.textMuted} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Search courses, topics, instructors"
                        placeholderTextColor={colors.textMuted}
                        value={query}
                        onChangeText={setQuery}
                    />
                    {!!query && (
                        <TouchableOpacity onPress={() => setQuery('')}>
                            <AppIcon name="times" size={14} color={colors.textMuted} />
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.tabs}>
                    {COURSE_CATEGORIES.map(name => {
                        const active = category === name;
                        const pal = TAB_PALETTE[name];
                        return (
                            <TouchableOpacity
                                key={name}
                                style={[
                                    styles.tab,
                                    active && styles.tabActive,
                                    active && { backgroundColor: pal.tile, borderColor: pal.rail + '55' },
                                ]}
                                onPress={() => setCategory(name)}
                                activeOpacity={0.85}
                            >
                                <Text
                                    style={[
                                        styles.tabText,
                                        active && { color: pal.strong },
                                    ]}
                                >
                                    {name}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            <FlatList
                data={filtered}
                keyExtractor={c => c.id}
                renderItem={renderCard}
                contentContainerStyle={{ paddingHorizontal: SPACING.base, paddingBottom: SPACING.xxxl }}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <AppIcon name="search" size={32} color={colors.textMuted} />
                        <Text style={styles.emptyText}>No courses match your search.</Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
};

const makeStyles = colors => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    topContent: { paddingHorizontal: SPACING.base, paddingTop: SPACING.sm },
    searchWrap: {
        height: 48,
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        backgroundColor: colors.inputBg,
        borderRadius: RADIUS.full,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        paddingHorizontal: SPACING.base,
    },
    searchInput: { flex: 1, color: colors.text, fontSize: SIZES.sm, fontWeight: '600' },

    tabs: {
        flexDirection: 'row',
        gap: SPACING.xs,
        marginTop: SPACING.md,
        marginBottom: SPACING.base,
        backgroundColor: colors.surfaceSubtle,
        borderRadius: RADIUS.full,
        padding: 4,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: SPACING.sm,
        borderRadius: RADIUS.full,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'transparent',
    },
    tabActive: {
        ...SHADOWS.small,
    },
    tabText: { color: colors.textMuted, fontSize: SIZES.xs, fontWeight: '800' },

    card: {
        backgroundColor: colors.surface,
        borderRadius: RADIUS.xl,
        marginBottom: SPACING.md,
        overflow: 'hidden',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        ...SHADOWS.small,
    },
    coverBand: {
        height: 110,
        padding: SPACING.md,
        justifyContent: 'space-between',
    },
    coverTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    coverIcon: {
        position: 'absolute',
        right: SPACING.md,
        bottom: -22,
        width: 56, height: 56, borderRadius: 28,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 4, borderColor: colors.surface,
    },
    typePill: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: SPACING.sm, paddingVertical: 4,
        borderRadius: RADIUS.full,
    },
    typePillText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.4 },
    discountPill: {
        backgroundColor: '#0F172A',
        paddingHorizontal: SPACING.sm,
        paddingVertical: 4,
        borderRadius: RADIUS.full,
    },
    discountText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.3 },
    levelPill: {
        alignSelf: 'flex-start',
        paddingHorizontal: SPACING.sm,
        paddingVertical: 3,
        borderRadius: RADIUS.full,
        borderWidth: StyleSheet.hairlineWidth,
    },
    levelText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },

    body: { padding: SPACING.md, paddingTop: SPACING.lg },
    title: { fontSize: SIZES.lg, fontWeight: '900', color: colors.text },
    subtitle: { fontSize: SIZES.xs, color: colors.textMuted, marginTop: 2 },

    instructorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.sm },
    instructorDot: { width: 6, height: 6, borderRadius: 3 },
    instructor: { fontSize: SIZES.xs, color: colors.text, fontWeight: '700' },

    metaRow: {
        flexDirection: 'row', alignItems: 'center',
        marginTop: SPACING.sm,
        paddingVertical: SPACING.sm,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
    },
    metaItem: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
    metaDivider: { width: StyleSheet.hairlineWidth, height: 14, backgroundColor: colors.border },
    metaText: { fontSize: 10, color: colors.textMuted, fontWeight: '700' },

    footerRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        marginTop: SPACING.md,
    },
    ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    ratingText: { color: colors.text, fontSize: SIZES.sm, fontWeight: '900' },
    ratingCount: { color: colors.textMuted, fontSize: 10, fontWeight: '600' },
    priceCol: { alignItems: 'flex-end' },
    originalPrice: { color: colors.textMuted, fontSize: 10, fontWeight: '600', textDecorationLine: 'line-through' },
    price: { fontSize: SIZES.lg, fontWeight: '900', letterSpacing: 0.2 },

    empty: { alignItems: 'center', gap: SPACING.md, paddingTop: SPACING.xxxl },
    emptyText: { color: colors.textMuted, fontSize: SIZES.sm, textAlign: 'center', paddingHorizontal: SPACING.xl },
});

export default StudentCourses;
