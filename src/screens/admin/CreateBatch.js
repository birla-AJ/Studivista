import React, { useEffect, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity,
} from 'react-native';
import { SIZES, SPACING, RADIUS } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';
import Header from '../../components/Header';
import InputField from '../../components/InputField';
import Button from '../../components/Button';
import AppIcon from '../../components/AppIcon';
import { createBatch, updateBatch, subscribeUsersByRole } from '../../services/firestoreService';

const SUBJECTS = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'History', 'Computer Science'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const CreateBatch = ({ navigation, route }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const COLOR_LIST = useMemo(
        () => [colors.primary, colors.secondary, colors.success, colors.warning, '#9C27B0', '#00BCD4'],
        [colors],
    );
    const existing = route?.params?.batch;
    const [name, setName] = useState(existing?.name || '');
    const [subject, setSubject] = useState(existing?.subject || '');
    const [maxStudents, setMaxStudents] = useState(existing?.maxStudents?.toString() || '30');
    const [selectedDays, setSelectedDays] = useState(existing?.scheduleDays || ['Mon', 'Wed', 'Fri']);
    const [time, setTime] = useState(existing?.scheduleTime || '10:00 AM');
    const [selectedColor, setSelectedColor] = useState(existing?.color || COLOR_LIST[0]);
    const [teacherId, setTeacherId] = useState(existing?.teacherId || '');
    const [teachers, setTeachers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const unsub = subscribeUsersByRole('teacher', setTeachers);
        return () => unsub && unsub();
    }, []);

    const toggleDay = (day) => {
        setSelectedDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
    };

    const handleSave = async () => {
        setError('');
        if (!name.trim()) return setError('Batch name is required.');
        if (!subject) return setError('Pick a subject.');

        setLoading(true);
        try {
            const teacher = teachers.find(t => t.uid === teacherId);
            const payload = {
                name: name.trim(),
                subject,
                color: selectedColor,
                teacherId: teacher?.uid || null,
                teacherName: teacher?.name || '',
                scheduleDays: selectedDays,
                scheduleTime: time,
                maxStudents,
            };

            if (existing?.id) {
                await updateBatch(existing.id, payload);
            } else {
                await createBatch(payload);
            }
            navigation.goBack();
        } catch (e) {
            setError(e?.message || 'Could not save batch.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <Header title={existing ? 'Edit Batch' : 'Create Batch'} showBack onBack={() => navigation.goBack()} />

            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                <View style={[styles.previewCard, { borderTopColor: selectedColor }]}>
                    <View style={[styles.previewIcon, { backgroundColor: selectedColor + '20' }]}>
                        <AppIcon name="book-open" size={32} color={selectedColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.previewName}>{name || 'Batch Name'}</Text>
                        <Text style={styles.previewSubject}>{subject || 'Subject'}</Text>
                    </View>
                </View>

                <Text style={styles.sectionLabel}>Basic Information</Text>
                <InputField label="Batch Name" placeholder="e.g. Batch A - Mathematics" value={name} onChangeText={setName} icon="users" />
                <InputField label="Max Students" placeholder="e.g. 30" value={maxStudents} onChangeText={setMaxStudents} keyboardType="numeric" icon="sort-numeric-up" />

                <Text style={styles.fieldLabel}>Subject</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                    {SUBJECTS.map(s => (
                        <TouchableOpacity key={s} style={[styles.chip, subject === s && styles.chipActive]} onPress={() => setSubject(s)}>
                            <Text style={[styles.chipText, subject === s && styles.chipTextActive]}>{s}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                <Text style={styles.sectionLabel}>Assign Teacher</Text>
                {teachers.length === 0 ? (
                    <Text style={styles.notice}>No teachers yet. Add a teacher first to assign one.</Text>
                ) : (
                    teachers.map(t => (
                        <TouchableOpacity
                            key={t.uid}
                            style={[styles.teacherOption, teacherId === t.uid && { borderColor: selectedColor, backgroundColor: selectedColor + '12' }]}
                            onPress={() => setTeacherId(t.uid === teacherId ? '' : t.uid)}
                        >
                            <View style={[styles.teacherDot, { backgroundColor: colors.teacherColor + '22' }]}>
                                <AppIcon name="chalkboard-teacher" size={16} color={colors.teacherColor} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={styles.teacherName}>{t.name}</Text>
                                <Text style={styles.teacherInfo}>{t.email}{t.subject ? ` • ${t.subject}` : ''}</Text>
                            </View>
                            <View style={[styles.radio, teacherId === t.uid && { backgroundColor: selectedColor, borderColor: selectedColor }]} />
                        </TouchableOpacity>
                    ))
                )}

                <Text style={styles.sectionLabel}>Schedule</Text>
                <Text style={styles.fieldLabel}>Class Days</Text>
                <View style={styles.daysRow}>
                    {DAYS.map(day => (
                        <TouchableOpacity
                            key={day}
                            style={[styles.dayBtn, selectedDays.includes(day) && { backgroundColor: colors.primary }]}
                            onPress={() => toggleDay(day)}
                        >
                            <Text style={[styles.dayText, selectedDays.includes(day) && { color: '#FFFFFF' }]}>{day}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <InputField label="Class Time" placeholder="e.g. 10:00 AM" value={time} onChangeText={setTime} icon="clock" />

                <Text style={styles.sectionLabel}>Batch Color</Text>
                <View style={styles.colorRow}>
                    {COLOR_LIST.map(c => (
                        <TouchableOpacity
                            key={c}
                            style={[styles.colorDot, { backgroundColor: c }, selectedColor === c && styles.colorDotActive]}
                            onPress={() => setSelectedColor(c)}
                        >
                            {selectedColor === c && <AppIcon name="check" size={12} color="#FFFFFF" />}
                        </TouchableOpacity>
                    ))}
                </View>

                {!!error && <Text style={styles.error}>{error}</Text>}

                <View style={{ height: SPACING.xxl }} />
                <Button label={existing ? 'Update Batch' : 'Create Batch'} onPress={handleSave} loading={loading} size="lg" icon="users" />
                <View style={{ height: 60 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

const makeStyles = (colors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { flex: 1, paddingHorizontal: SPACING.base },
    previewCard: {
        backgroundColor: colors.surface, borderRadius: RADIUS.xl,
        padding: SPACING.base, marginVertical: SPACING.md,
        borderTopWidth: 3, flexDirection: 'row',
        alignItems: 'center', gap: SPACING.md,
        borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    },
    previewIcon: { width: 56, height: 56, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
    previewName: { fontSize: SIZES.lg, fontWeight: '800', color: colors.text },
    previewSubject: { fontSize: SIZES.sm, color: colors.textMuted, marginTop: 2 },
    sectionLabel: { fontSize: SIZES.base, fontWeight: '800', color: colors.text, marginTop: SPACING.lg, marginBottom: SPACING.md },
    fieldLabel: { fontSize: SIZES.sm, fontWeight: '600', color: colors.textMuted, marginBottom: SPACING.sm, letterSpacing: 0.3 },
    chipScroll: { marginBottom: SPACING.base },
    chip: {
        paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
        borderRadius: RADIUS.full, borderWidth: 1.5,
        borderColor: colors.border, marginRight: SPACING.sm,
        backgroundColor: colors.surface,
    },
    chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    chipText: { color: colors.textMuted, fontSize: SIZES.sm, fontWeight: '600' },
    chipTextActive: { color: '#FFFFFF' },
    teacherOption: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.surface, borderRadius: RADIUS.md,
        padding: SPACING.md, marginBottom: SPACING.sm,
        borderWidth: 1.5, borderColor: colors.border, gap: SPACING.md,
    },
    teacherDot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    teacherName: { fontSize: SIZES.md, fontWeight: '700', color: colors.text },
    teacherInfo: { fontSize: SIZES.xs, color: colors.textMuted, marginTop: 2 },
    radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border },
    daysRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.base, flexWrap: 'wrap' },
    dayBtn: {
        width: 42, height: 42, borderRadius: 12,
        backgroundColor: colors.surface, borderWidth: 1,
        borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
    },
    dayText: { fontSize: SIZES.xs, fontWeight: '700', color: colors.textMuted },
    colorRow: { flexDirection: 'row', gap: SPACING.md, marginBottom: SPACING.base },
    colorDot: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    colorDotActive: { borderWidth: 2.5, borderColor: colors.text },
    notice: { color: colors.textMuted, fontSize: SIZES.sm, padding: SPACING.md, textAlign: 'center' },
    error: { color: colors.danger, fontSize: SIZES.sm, fontWeight: '600', textAlign: 'center', marginTop: SPACING.md },
});

export default CreateBatch;
