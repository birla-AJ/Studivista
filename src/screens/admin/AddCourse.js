import React, { useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, SafeAreaView,
    TouchableOpacity, TextInput, Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SIZES, SPACING, RADIUS, SHADOWS } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';
import Header from '../../components/Header';
import InputField from '../../components/InputField';
import Button from '../../components/Button';
import AppIcon from '../../components/AppIcon';
import { LEVEL_PALETTE, paletteForLevel, formatPrice } from '../../data/courses';

const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
const TYPES = [
    { key: 'Live',     icon: 'broadcast-tower', color: '#DC2626' },
    { key: 'Recorded', icon: 'play-circle',     color: '#2563EB' },
    { key: 'Hybrid',   icon: 'random',          color: '#7C3AED' },
];
const ICON_CHOICES = [
    'square-root-alt', 'atom', 'flask', 'comments', 'laptop-code',
    'palette', 'book', 'graduation-cap', 'globe', 'calculator',
    'microscope', 'language', 'music', 'briefcase', 'chart-line',
    'pen-nib', 'code', 'project-diagram',
];

const emptyModule  = () => ({ title: '', lessons: '', hours: '' });
const emptyLearning = () => '';

const AddCourse = ({ navigation }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);

    // Basic info
    const [title, setTitle] = useState('');
    const [subtitle, setSubtitle] = useState('');
    const [about, setAbout] = useState('');
    const [icon, setIcon] = useState(ICON_CHOICES[0]);
    const [level, setLevel] = useState('Beginner');
    const [type, setType] = useState('Live');
    const [language, setLanguage] = useState('English');

    // Instructor
    const [instructor, setInstructor] = useState('');
    const [instructorTitle, setInstructorTitle] = useState('');

    // Schedule / metrics
    const [durationWeeks, setDurationWeeks] = useState('');
    const [totalHours, setTotalHours] = useState('');
    const [lessons, setLessons] = useState('');
    const [schedule, setSchedule] = useState('');

    // Pricing
    const [price, setPrice] = useState('');
    const [originalPrice, setOriginalPrice] = useState('');

    // Dynamic lists
    const [learnings, setLearnings] = useState([emptyLearning(), emptyLearning(), emptyLearning()]);
    const [modules, setModules] = useState([emptyModule()]);

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const pal = paletteForLevel(level);

    const numericPrice = Number(price) || 0;
    const numericOriginal = Number(originalPrice) || 0;
    const discount = numericOriginal > numericPrice && numericOriginal > 0
        ? Math.round(((numericOriginal - numericPrice) / numericOriginal) * 100)
        : 0;

    const updateLearning = (idx, value) => {
        setLearnings(prev => prev.map((l, i) => (i === idx ? value : l)));
    };
    const addLearning = () => setLearnings(prev => [...prev, emptyLearning()]);
    const removeLearning = (idx) => setLearnings(prev => prev.filter((_, i) => i !== idx));

    const updateModule = (idx, key, value) => {
        setModules(prev => prev.map((m, i) => (i === idx ? { ...m, [key]: value } : m)));
    };
    const addModule = () => setModules(prev => [...prev, emptyModule()]);
    const removeModule = (idx) => setModules(prev => prev.filter((_, i) => i !== idx));

    const handleSave = async () => {
        setError('');
        if (!title.trim()) return setError('Course title is required.');
        if (!subtitle.trim()) return setError('Add a short subtitle.');
        if (!instructor.trim()) return setError('Instructor name is required.');
        if (!price) return setError('Set a course price.');
        if (!about.trim()) return setError('Add a short about description.');

        const cleanedLearnings = learnings.map(l => l.trim()).filter(Boolean);
        const cleanedModules = modules
            .map(m => ({
                title: m.title.trim(),
                lessons: Number(m.lessons) || 0,
                hours: Number(m.hours) || 0,
            }))
            .filter(m => m.title);

        if (cleanedLearnings.length === 0) return setError('Add at least one learning outcome.');
        if (cleanedModules.length === 0) return setError('Add at least one module to the curriculum.');

        const payload = {
            // id will be assigned by backend later
            title: title.trim(),
            subtitle: subtitle.trim(),
            instructor: instructor.trim(),
            instructorTitle: instructorTitle.trim(),
            icon,
            type,
            level,
            category: level,
            durationWeeks: Number(durationWeeks) || 0,
            totalHours: Number(totalHours) || 0,
            lessons: Number(lessons) || 0,
            schedule: schedule.trim(),
            language: language.trim(),
            price: Number(price) || 0,
            originalPrice: Number(originalPrice) || 0,
            about: about.trim(),
            learnings: cleanedLearnings,
            modules: cleanedModules,
            rating: 0,
            ratingCount: 0,
            students: 0,
        };

        setSubmitting(true);
        try {
            // TODO: backend integration — call your createCourse(payload) here.
            // For now we just log and show a success toast-style alert.
            console.log('New course payload:', payload);
            Alert.alert('Course saved (UI only)', 'Backend wiring pending. The payload was logged to the console.', [
                { text: 'OK', onPress: () => navigation.goBack() },
            ]);
        } catch (e) {
            setError(e?.message || 'Could not save course.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <Header title="Add Course" subtitle="Publish to the student catalogue" showBack onBack={() => navigation.goBack()} />

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* Live Preview */}
                <Text style={styles.previewLabel}>Student-side preview</Text>
                <LinearGradient
                    colors={pal.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.previewHero}
                >
                    <View style={styles.previewTopRow}>
                        <View style={[styles.previewLevelBadge, { backgroundColor: pal.onGradient === 'light' ? 'rgba(0,0,0,0.25)' : pal.rail }]}>
                            <Text style={styles.previewLevelText}>{level}</Text>
                        </View>
                        <View style={styles.previewTypePill}>
                            <View style={[styles.previewTypeDot, { backgroundColor: TYPES.find(t => t.key === type)?.color }]} />
                            <Text style={[styles.previewTypeText, { color: pal.onGradient === 'light' ? '#FFF' : pal.strong }]}>{type}</Text>
                        </View>
                    </View>
                    <View style={[styles.previewIcon, { backgroundColor: pal.onGradient === 'light' ? 'rgba(255,255,255,0.2)' : pal.rail }]}>
                        <AppIcon name={icon} size={28} color="#FFFFFF" />
                    </View>
                    <Text style={[styles.previewTitle, { color: pal.onGradient === 'light' ? '#FFF' : pal.strong }]} numberOfLines={2}>
                        {title || 'Course title'}
                    </Text>
                    <Text style={[styles.previewSubtitle, { color: pal.onGradient === 'light' ? 'rgba(255,255,255,0.85)' : colors.text }]} numberOfLines={2}>
                        {subtitle || 'A short tagline describing the course'}
                    </Text>
                    <View style={styles.previewFooter}>
                        <Text style={[styles.previewInstructor, { color: pal.onGradient === 'light' ? '#FFF' : pal.strong }]} numberOfLines={1}>
                            👤 {instructor || 'Instructor'}
                        </Text>
                        <View style={styles.previewPriceRow}>
                            {numericOriginal > 0 && (
                                <Text style={[styles.previewOldPrice, { color: pal.onGradient === 'light' ? 'rgba(255,255,255,0.7)' : colors.textMuted }]}>
                                    {formatPrice(numericOriginal)}
                                </Text>
                            )}
                            <Text style={[styles.previewPrice, { color: pal.onGradient === 'light' ? '#FFF' : pal.strong }]}>
                                {formatPrice(numericPrice)}
                            </Text>
                            {discount > 0 && (
                                <View style={styles.previewDiscount}>
                                    <Text style={styles.previewDiscountText}>{discount}% OFF</Text>
                                </View>
                            )}
                        </View>
                    </View>
                </LinearGradient>

                {/* SECTION: Basic info */}
                <SectionTitle colors={colors} icon="info-circle" label="Basic Information" />
                <InputField label="Course Title" placeholder="e.g. JEE Advanced Mathematics" value={title} onChangeText={setTitle} icon="book" />
                <InputField label="Subtitle" placeholder="e.g. Master Calculus, Algebra & Geometry" value={subtitle} onChangeText={setSubtitle} icon="align-left" />
                <InputField label="About" placeholder="Describe the course in 2-3 sentences..." value={about} onChangeText={setAbout} icon="file-alt" multiline numberOfLines={4} />
                <InputField label="Language" placeholder="e.g. English / Hindi" value={language} onChangeText={setLanguage} icon="globe" />

                {/* SECTION: Level */}
                <Text style={styles.fieldLabel}>Level</Text>
                <View style={styles.row}>
                    {LEVELS.map(lv => {
                        const active = level === lv;
                        const lvPal = LEVEL_PALETTE[lv];
                        return (
                            <TouchableOpacity
                                key={lv}
                                style={[styles.levelChip, active && { backgroundColor: lvPal.rail, borderColor: lvPal.rail }]}
                                onPress={() => setLevel(lv)}
                                activeOpacity={0.85}
                            >
                                <Text style={[styles.levelChipText, active && { color: '#FFFFFF' }]}>{lv}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* SECTION: Type */}
                <Text style={styles.fieldLabel}>Delivery Type</Text>
                <View style={styles.row}>
                    {TYPES.map(t => {
                        const active = type === t.key;
                        return (
                            <TouchableOpacity
                                key={t.key}
                                style={[styles.typeChip, active && { borderColor: t.color, backgroundColor: t.color + '15' }]}
                                onPress={() => setType(t.key)}
                                activeOpacity={0.85}
                            >
                                <AppIcon name={t.icon} size={12} color={active ? t.color : colors.textMuted} />
                                <Text style={[styles.typeChipText, active && { color: t.color, fontWeight: '800' }]}>{t.key}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* SECTION: Icon */}
                <Text style={styles.fieldLabel}>Course Icon</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.iconRow}>
                    {ICON_CHOICES.map(name => {
                        const active = icon === name;
                        return (
                            <TouchableOpacity
                                key={name}
                                style={[styles.iconCell, active && { backgroundColor: pal.rail, borderColor: pal.rail }]}
                                onPress={() => setIcon(name)}
                                activeOpacity={0.85}
                            >
                                <AppIcon name={name} size={20} color={active ? '#FFFFFF' : colors.textMuted} />
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                {/* SECTION: Instructor */}
                <SectionTitle colors={colors} icon="user-tie" label="Instructor" />
                <InputField label="Name" placeholder="e.g. Dr. Rajeev Sharma" value={instructor} onChangeText={setInstructor} icon="user" />
                <InputField label="Title / Credentials" placeholder="e.g. IIT Bombay • 12 yrs teaching" value={instructorTitle} onChangeText={setInstructorTitle} icon="award" />

                {/* SECTION: Schedule & metrics */}
                <SectionTitle colors={colors} icon="calendar-alt" label="Schedule & Stats" />
                <View style={styles.twoCol}>
                    <View style={{ flex: 1 }}>
                        <InputField label="Duration (weeks)" placeholder="e.g. 24" value={durationWeeks} onChangeText={setDurationWeeks} keyboardType="numeric" icon="clock" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <InputField label="Total Hours" placeholder="e.g. 180" value={totalHours} onChangeText={setTotalHours} keyboardType="numeric" icon="hourglass-half" />
                    </View>
                </View>
                <InputField label="Total Lessons" placeholder="e.g. 96" value={lessons} onChangeText={setLessons} keyboardType="numeric" icon="book" />
                <InputField label="Schedule" placeholder="e.g. Mon, Wed, Fri • 6:00 PM" value={schedule} onChangeText={setSchedule} icon="calendar-week" />

                {/* SECTION: Pricing */}
                <SectionTitle colors={colors} icon="rupee-sign" label="Pricing" />
                <View style={styles.twoCol}>
                    <View style={{ flex: 1 }}>
                        <InputField label="Price (₹)" placeholder="e.g. 12999" value={price} onChangeText={setPrice} keyboardType="numeric" icon="tag" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <InputField label="Original Price (₹)" placeholder="optional" value={originalPrice} onChangeText={setOriginalPrice} keyboardType="numeric" icon="tags" />
                    </View>
                </View>
                {discount > 0 && (
                    <View style={styles.discountBanner}>
                        <AppIcon name="bolt" size={12} color={colors.success} />
                        <Text style={styles.discountBannerText}>{discount}% discount will be displayed on the student card</Text>
                    </View>
                )}

                {/* SECTION: Learning outcomes */}
                <SectionTitle colors={colors} icon="check-circle" label="What students will learn" />
                {learnings.map((l, idx) => (
                    <View key={`learn-${idx}`} style={styles.learningRow}>
                        <View style={[styles.bullet, { backgroundColor: pal.rail }]}>
                            <Text style={styles.bulletText}>{idx + 1}</Text>
                        </View>
                        <TextInput
                            style={styles.learningInput}
                            placeholder={`Learning outcome ${idx + 1}`}
                            placeholderTextColor={colors.textMuted}
                            value={l}
                            onChangeText={(v) => updateLearning(idx, v)}
                        />
                        {learnings.length > 1 && (
                            <TouchableOpacity onPress={() => removeLearning(idx)} style={styles.removeBtn}>
                                <AppIcon name="times" size={14} color={colors.danger} />
                            </TouchableOpacity>
                        )}
                    </View>
                ))}
                <TouchableOpacity onPress={addLearning} style={styles.addRowBtn} activeOpacity={0.85}>
                    <AppIcon name="plus" size={12} color={colors.primary} />
                    <Text style={styles.addRowText}>Add learning outcome</Text>
                </TouchableOpacity>

                {/* SECTION: Curriculum */}
                <SectionTitle colors={colors} icon="list-ol" label="Curriculum (Modules)" />
                {modules.map((m, idx) => (
                    <View key={`mod-${idx}`} style={styles.moduleCard}>
                        <View style={styles.moduleHeader}>
                            <View style={[styles.moduleNum, { backgroundColor: pal.tile }]}>
                                <Text style={[styles.moduleNumText, { color: pal.strong }]}>{String(idx + 1).padStart(2, '0')}</Text>
                            </View>
                            <Text style={styles.moduleHeading}>Module {idx + 1}</Text>
                            {modules.length > 1 && (
                                <TouchableOpacity onPress={() => removeModule(idx)} style={styles.removeBtn}>
                                    <AppIcon name="trash" size={12} color={colors.danger} />
                                </TouchableOpacity>
                            )}
                        </View>
                        <TextInput
                            style={styles.moduleInput}
                            placeholder="Module title (e.g. Calculus Fundamentals)"
                            placeholderTextColor={colors.textMuted}
                            value={m.title}
                            onChangeText={(v) => updateModule(idx, 'title', v)}
                        />
                        <View style={styles.moduleStatsRow}>
                            <View style={styles.moduleStat}>
                                <AppIcon name="play-circle" size={11} color={colors.textMuted} />
                                <TextInput
                                    style={styles.moduleStatInput}
                                    placeholder="Lessons"
                                    placeholderTextColor={colors.textMuted}
                                    value={m.lessons}
                                    onChangeText={(v) => updateModule(idx, 'lessons', v)}
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={styles.moduleStatDivider} />
                            <View style={styles.moduleStat}>
                                <AppIcon name="clock" size={11} color={colors.textMuted} />
                                <TextInput
                                    style={styles.moduleStatInput}
                                    placeholder="Hours"
                                    placeholderTextColor={colors.textMuted}
                                    value={m.hours}
                                    onChangeText={(v) => updateModule(idx, 'hours', v)}
                                    keyboardType="numeric"
                                />
                            </View>
                        </View>
                    </View>
                ))}
                <TouchableOpacity onPress={addModule} style={styles.addRowBtn} activeOpacity={0.85}>
                    <AppIcon name="plus" size={12} color={colors.primary} />
                    <Text style={styles.addRowText}>Add module</Text>
                </TouchableOpacity>

                {!!error && (
                    <View style={styles.errorBox}>
                        <AppIcon name="exclamation-circle" size={14} color={colors.danger} />
                        <Text style={styles.errorText}>{error}</Text>
                    </View>
                )}

                <View style={{ height: SPACING.lg }} />
                <Button
                    label="Publish Course"
                    onPress={handleSave}
                    loading={submitting}
                    size="lg"
                    icon="check"
                />
                <Button
                    label="Cancel"
                    onPress={() => navigation.goBack()}
                    variant="ghost"
                    size="md"
                    style={{ marginTop: SPACING.md }}
                />
                <View style={{ height: 60 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

const SectionTitle = ({ colors, icon, label }) => (
    <View style={sectionStyles.row}>
        <View style={[sectionStyles.iconWrap, { backgroundColor: colors.primary + '18' }]}>
            <AppIcon name={icon} size={12} color={colors.primary} />
        </View>
        <Text style={[sectionStyles.label, { color: colors.text }]}>{label}</Text>
    </View>
);

const sectionStyles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.lg, marginBottom: SPACING.md },
    iconWrap: { width: 24, height: 24, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
    label: { fontSize: SIZES.base, fontWeight: '900', letterSpacing: 0.2 },
});

const makeStyles = (colors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scrollContent: { paddingHorizontal: SPACING.base, paddingBottom: SPACING.xxxl },

    previewLabel: {
        fontSize: SIZES.xs, fontWeight: '700', color: colors.textMuted,
        textTransform: 'uppercase', letterSpacing: 0.5,
        marginTop: SPACING.md, marginBottom: SPACING.sm,
    },
    previewHero: {
        borderRadius: RADIUS.xl, padding: SPACING.base,
        ...SHADOWS.medium,
    },
    previewTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    previewLevelBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 4, borderRadius: RADIUS.full },
    previewLevelText: { color: '#FFF', fontSize: 10, fontWeight: '900', letterSpacing: 0.4 },
    previewTypePill: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: 'rgba(255,255,255,0.7)',
        paddingHorizontal: SPACING.sm, paddingVertical: 4,
        borderRadius: RADIUS.full,
    },
    previewTypeDot: { width: 6, height: 6, borderRadius: 3 },
    previewTypeText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.3 },
    previewIcon: {
        width: 52, height: 52, borderRadius: 16,
        alignItems: 'center', justifyContent: 'center',
        marginTop: SPACING.md,
    },
    previewTitle: { fontSize: SIZES.lg, fontWeight: '900', marginTop: SPACING.sm },
    previewSubtitle: { fontSize: SIZES.xs, marginTop: 4, fontWeight: '500' },
    previewFooter: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginTop: SPACING.md, paddingTop: SPACING.sm,
        borderTopWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.3)',
        flexWrap: 'wrap', gap: SPACING.sm,
    },
    previewInstructor: { fontSize: SIZES.xs, fontWeight: '700', flex: 1 },
    previewPriceRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    previewOldPrice: { fontSize: 10, fontWeight: '700', textDecorationLine: 'line-through' },
    previewPrice: { fontSize: SIZES.md, fontWeight: '900' },
    previewDiscount: {
        backgroundColor: '#0F172A',
        paddingHorizontal: SPACING.sm, paddingVertical: 2,
        borderRadius: RADIUS.full,
    },
    previewDiscountText: { color: '#FFF', fontSize: 9, fontWeight: '900' },

    fieldLabel: {
        fontSize: SIZES.sm, fontWeight: '600', color: colors.textMuted,
        marginBottom: SPACING.sm, marginTop: SPACING.sm,
        letterSpacing: 0.3,
    },
    row: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap', marginBottom: SPACING.sm },
    twoCol: { flexDirection: 'row', gap: SPACING.md },

    levelChip: {
        paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
        borderRadius: RADIUS.full, borderWidth: 1.5,
        borderColor: colors.border, backgroundColor: colors.surface,
        flex: 1, alignItems: 'center',
    },
    levelChipText: { color: colors.textMuted, fontSize: SIZES.xs, fontWeight: '800', letterSpacing: 0.3 },

    typeChip: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6, paddingVertical: SPACING.sm,
        borderRadius: RADIUS.md, borderWidth: 1.5,
        borderColor: colors.border, backgroundColor: colors.surface,
    },
    typeChipText: { color: colors.textMuted, fontSize: SIZES.xs, fontWeight: '600' },

    iconRow: { gap: SPACING.sm, paddingVertical: SPACING.xs, paddingRight: SPACING.lg },
    iconCell: {
        width: 44, height: 44, borderRadius: RADIUS.md,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: colors.surface,
        borderWidth: 1.5, borderColor: colors.border,
    },

    discountBanner: {
        flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
        backgroundColor: colors.success + '15',
        borderRadius: RADIUS.md, padding: SPACING.sm,
        borderWidth: StyleSheet.hairlineWidth, borderColor: colors.success + '40',
        marginBottom: SPACING.sm,
    },
    discountBannerText: { color: colors.success, fontSize: SIZES.xs, fontWeight: '700' },

    learningRow: {
        flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
        backgroundColor: colors.surface, borderRadius: RADIUS.md,
        padding: SPACING.sm, paddingLeft: SPACING.md,
        marginBottom: SPACING.sm,
        borderWidth: 1, borderColor: colors.border,
    },
    bullet: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    bulletText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
    learningInput: { flex: 1, fontSize: SIZES.sm, color: colors.text, paddingVertical: SPACING.xs },
    removeBtn: { padding: SPACING.xs },

    addRowBtn: {
        flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
        alignSelf: 'flex-start',
        paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
        backgroundColor: colors.primary + '15',
        borderRadius: RADIUS.full,
        borderWidth: 1, borderColor: colors.primary + '44',
        marginTop: SPACING.xs,
    },
    addRowText: { color: colors.primary, fontSize: SIZES.xs, fontWeight: '800' },

    moduleCard: {
        backgroundColor: colors.surface, borderRadius: RADIUS.lg,
        padding: SPACING.md, marginBottom: SPACING.sm,
        borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
        ...SHADOWS.small,
    },
    moduleHeader: {
        flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
        marginBottom: SPACING.sm,
    },
    moduleNum: {
        width: 32, height: 32, borderRadius: RADIUS.sm,
        alignItems: 'center', justifyContent: 'center',
    },
    moduleNumText: { fontSize: SIZES.xs, fontWeight: '900' },
    moduleHeading: { flex: 1, fontSize: SIZES.sm, fontWeight: '800', color: colors.text },
    moduleInput: {
        fontSize: SIZES.sm, fontWeight: '600', color: colors.text,
        backgroundColor: colors.inputBg, borderRadius: RADIUS.md,
        paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
        borderWidth: 1, borderColor: colors.border,
        marginBottom: SPACING.sm,
    },
    moduleStatsRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.inputBg, borderRadius: RADIUS.md,
        borderWidth: 1, borderColor: colors.border,
    },
    moduleStat: {
        flex: 1, flexDirection: 'row', alignItems: 'center', gap: SPACING.xs,
        paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs,
    },
    moduleStatInput: { flex: 1, fontSize: SIZES.sm, color: colors.text, paddingVertical: SPACING.sm },
    moduleStatDivider: { width: 1, alignSelf: 'stretch', backgroundColor: colors.border },

    errorBox: {
        flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
        backgroundColor: colors.danger + '15',
        borderRadius: RADIUS.md, padding: SPACING.md,
        borderWidth: 1, borderColor: colors.danger + '44',
        marginTop: SPACING.md,
    },
    errorText: { flex: 1, color: colors.danger, fontSize: SIZES.sm, fontWeight: '700' },
});

export default AddCourse;
