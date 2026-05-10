import React, { useEffect, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity,
} from 'react-native';
import { SIZES, SPACING, RADIUS } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';
import Header from '../../components/Header';
import InputField from '../../components/InputField';
import Button from '../../components/Button';
import { subscribeBatchesByTeacher, createClass, fanOutNotificationToBatch } from '../../services/firestoreService';
import { useAuth } from '../../contexts/AuthContext';
import { Timestamp } from '../../services/firebase';
import { Toast } from '../../components/Toast';

const DURATIONS = [30, 45, 60, 90, 120];

const pad = (n) => String(n).padStart(2, '0');

const ScheduleClass = ({ navigation, route }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const existing = route?.params?.cls;
    const { user, profile } = useAuth();

    const initialDate = (() => {
        const d = new Date();
        d.setMinutes(0, 0, 0);
        d.setHours(d.getHours() + 1);
        return d;
    })();

    const [title, setTitle] = useState(existing?.title || '');
    const [description, setDescription] = useState(existing?.description || '');
    const [batchId, setBatchId] = useState(existing?.batchId || '');
    const [batches, setBatches] = useState([]);
    const [dateStr, setDateStr] = useState(
        existing?.scheduledAt
            ? `${pad(existing.scheduledAt.toDate().getDate())}/${pad(existing.scheduledAt.toDate().getMonth() + 1)}/${existing.scheduledAt.toDate().getFullYear()}`
            : `${pad(initialDate.getDate())}/${pad(initialDate.getMonth() + 1)}/${initialDate.getFullYear()}`
    );
    const [timeStr, setTimeStr] = useState(
        existing?.scheduledAt
            ? `${pad(existing.scheduledAt.toDate().getHours())}:${pad(existing.scheduledAt.toDate().getMinutes())}`
            : `${pad(initialDate.getHours())}:${pad(initialDate.getMinutes())}`
    );
    const [durationMin, setDurationMin] = useState(existing?.durationMin || 60);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!user?.uid) return;
        const unsub = subscribeBatchesByTeacher(user.uid, setBatches);
        return () => unsub && unsub();
    }, [user?.uid]);

    const handleSchedule = async () => {
        setError('');
        if (!title.trim()) return setError('Enter a class title.');
        if (!batchId) return setError('Pick a batch.');

        const dateMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(dateStr.trim());
        const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(timeStr.trim());
        if (!dateMatch) return setError('Date must be DD/MM/YYYY.');
        if (!timeMatch) return setError('Time must be HH:MM (24h).');

        const [, dd, mm, yyyy] = dateMatch;
        const [, hh, min] = timeMatch;
        const scheduled = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(min), 0, 0);
        if (isNaN(scheduled.getTime())) return setError('Invalid date/time.');

        setLoading(true);
        try {
            const batch = batches.find(b => b.id === batchId);
            const classId = await createClass({
                batchId,
                batchName: batch?.name || '',
                teacherId: user.uid,
                teacherName: profile?.name || '',
                title: title.trim(),
                description,
                scheduledAt: Timestamp.fromDate(scheduled),
                durationMin,
                color: batch?.color || colors.primary,
            });

            // Notify every student in the batch that a new class is scheduled.
            const dateLabel = scheduled.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
            const timeLabel = scheduled.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
            try {
                await fanOutNotificationToBatch({
                    batchId,
                    title: `New class scheduled: ${title.trim()}`,
                    body: `${profile?.name || 'Your teacher'} • ${dateLabel} at ${timeLabel}`,
                    type: 'schedule',
                    classId,
                });
            } catch (notifErr) {
                console.warn('schedule notification failed:', notifErr?.code, notifErr?.message);
            }

            Toast.success('Students enrolled in this batch have been notified.', 'Class scheduled');
            navigation.goBack();
        } catch (e) {
            setError(e?.message || 'Could not schedule class.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <Header title={existing ? 'Edit Class' : 'Schedule Class'} showBack onBack={() => navigation.goBack()} />

            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.sectionLabel}>Class Information</Text>
                <InputField label="Class Title" placeholder="e.g. Calculus - Chapter 3" value={title} onChangeText={setTitle} icon="book" />
                <InputField
                    label="Description (optional)"
                    placeholder="What will be covered?"
                    value={description}
                    onChangeText={setDescription}
                    icon="sticky-note"
                    multiline
                    numberOfLines={3}
                />

                <Text style={styles.sectionLabel}>Select Batch</Text>
                {batches.length === 0 ? (
                    <Text style={styles.notice}>You have no batches yet. Ask the admin to assign you a batch.</Text>
                ) : batches.map(batch => (
                    <TouchableOpacity
                        key={batch.id}
                        style={[styles.batchOption, batchId === batch.id && { borderColor: batch.color || colors.primary, backgroundColor: (batch.color || colors.primary) + '12' }]}
                        onPress={() => setBatchId(batch.id)}
                    >
                        <View style={[styles.batchColorDot, { backgroundColor: batch.color || colors.primary }]} />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.batchName}>{batch.name}</Text>
                            <Text style={styles.batchInfo}>{batch.studentIds?.length || 0} students</Text>
                        </View>
                        <View style={[styles.radio, batchId === batch.id && { backgroundColor: batch.color || colors.primary, borderColor: batch.color || colors.primary }]} />
                    </TouchableOpacity>
                ))}

                <Text style={styles.sectionLabel}>Date & Time</Text>
                <InputField label="Date (DD/MM/YYYY)" placeholder="DD/MM/YYYY" value={dateStr} onChangeText={setDateStr} icon="calendar-alt" keyboardType="numbers-and-punctuation" />
                <InputField label="Time (HH:MM, 24h)" placeholder="HH:MM" value={timeStr} onChangeText={setTimeStr} icon="clock" keyboardType="numbers-and-punctuation" />

                <Text style={styles.fieldLabel}>Duration</Text>
                <View style={styles.durationRow}>
                    {DURATIONS.map(d => (
                        <TouchableOpacity
                            key={d}
                            style={[styles.durationBtn, durationMin === d && styles.durationBtnActive]}
                            onPress={() => setDurationMin(d)}
                        >
                            <Text style={[styles.durationText, durationMin === d && { color: '#FFFFFF' }]}>{d} min</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {!!error && <Text style={styles.error}>{error}</Text>}

                <View style={{ height: SPACING.xl }} />
                <Button label={existing ? 'Update Class' : 'Schedule Class'} onPress={handleSchedule} loading={loading} size="lg" icon="calendar-alt" />
                <View style={{ height: 60 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

const makeStyles = (colors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { flex: 1, paddingHorizontal: SPACING.base },
    sectionLabel: { fontSize: SIZES.base, fontWeight: '800', color: colors.text, marginTop: SPACING.lg, marginBottom: SPACING.md },
    fieldLabel: { fontSize: SIZES.sm, fontWeight: '600', color: colors.textMuted, marginBottom: SPACING.sm, letterSpacing: 0.3 },
    batchOption: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.surface, borderRadius: RADIUS.md,
        padding: SPACING.md, marginBottom: SPACING.sm,
        borderWidth: 1.5, borderColor: colors.border, gap: SPACING.md,
    },
    batchColorDot: { width: 10, height: 10, borderRadius: 5 },
    batchName: { fontSize: SIZES.md, fontWeight: '700', color: colors.text },
    batchInfo: { fontSize: SIZES.xs, color: colors.textMuted, marginTop: 2 },
    radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.border },
    durationRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.base },
    durationBtn: {
        paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
        borderRadius: RADIUS.md, backgroundColor: colors.surface,
        borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    },
    durationBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    durationText: { color: colors.textMuted, fontSize: SIZES.sm, fontWeight: '600' },
    notice: { color: colors.textMuted, fontSize: SIZES.sm, padding: SPACING.md, textAlign: 'center' },
    error: { color: colors.danger, fontSize: SIZES.sm, fontWeight: '600', textAlign: 'center', marginTop: SPACING.md },
});

export default ScheduleClass;
