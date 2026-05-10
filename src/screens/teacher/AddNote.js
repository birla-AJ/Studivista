import React, { useEffect, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, ScrollView,
    TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Keyboard,
} from 'react-native';
import { SIZES, SPACING, RADIUS, SHADOWS } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';
import Header from '../../components/Header';
import Button from '../../components/Button';
import { subscribeBatchesByTeacher, createNote } from '../../services/firestoreService';
import { useAuth } from '../../contexts/AuthContext';
import { Toast } from '../../components/Toast';

const AddNote = ({ navigation }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const { user, profile } = useAuth();
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [batches, setBatches] = useState([]);
    const [batchId, setBatchId] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!user?.uid) return;
        const unsub = subscribeBatchesByTeacher(user.uid, setBatches);
        return () => unsub?.();
    }, [user?.uid]);

    const selectedBatch = batches.find(b => b.id === batchId);

    const handleSave = async () => {
        if (!title.trim()) { Toast.warning('Please add a title for the note.', 'Title required'); return; }
        if (!body.trim()) { Toast.warning('Please write some content.', 'Note is empty'); return; }
        if (!batchId) { Toast.warning('Pick which batch should see this note.', 'Select a batch'); return; }

        setSaving(true);
        try {
            await createNote({
                title,
                body,
                batchId,
                batchName: selectedBatch?.name || '',
                teacherId: user.uid,
                teacherName: profile?.name || '',
            });
            navigation.goBack();
        } catch (e) {
            Toast.error(e?.message || 'Please try again.', 'Could not save note');
        } finally {
            setSaving(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <Header title="New Note" subtitle="Share with your batch" showBack onBack={() => navigation.goBack()} />

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView
                    style={styles.scroll}
                    contentContainerStyle={{ padding: SPACING.base, paddingBottom: SPACING.xxxl }}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    onScrollBeginDrag={Keyboard.dismiss}
                >
                    <Text style={styles.label}>Batch</Text>
                    {batches.length === 0 ? (
                        <Text style={styles.empty}>You don't have any batches yet.</Text>
                    ) : (
                        <View style={styles.chipsRow}>
                            {batches.map(b => {
                                const active = b.id === batchId;
                                return (
                                    <TouchableOpacity
                                        key={b.id}
                                        style={[styles.chip, active && styles.chipActive]}
                                        onPress={() => setBatchId(b.id)}
                                        activeOpacity={0.85}
                                    >
                                        <View style={[styles.chipDot, { backgroundColor: b.color || colors.primary }]} />
                                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{b.name}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}

                    <Text style={styles.label}>Title</Text>
                    <TextInput
                        style={styles.input}
                        placeholder="e.g. Chapter 3 summary"
                        placeholderTextColor={colors.textMuted}
                        value={title}
                        onChangeText={setTitle}
                        maxLength={120}
                    />

                    <Text style={styles.label}>Note</Text>
                    <TextInput
                        style={[styles.input, styles.bodyInput]}
                        placeholder="Write the note in any format. Bullets, steps, examples, links — anything goes."
                        placeholderTextColor={colors.textMuted}
                        value={body}
                        onChangeText={setBody}
                        multiline
                        textAlignVertical="top"
                    />

                    <Button label="Save Note" onPress={handleSave} loading={saving} size="lg" style={{ marginTop: SPACING.lg }} />
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const makeStyles = (colors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { flex: 1 },
    label: { fontSize: SIZES.sm, color: colors.textMuted, fontWeight: '700', marginTop: SPACING.md, marginBottom: SPACING.sm },
    empty: { color: colors.warning, fontSize: SIZES.sm, paddingVertical: SPACING.md },
    chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
    chip: {
        flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
        paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
        backgroundColor: colors.surface, borderRadius: RADIUS.full,
        borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    },
    chipActive: { borderColor: colors.primary, backgroundColor: colors.primary + '22' },
    chipDot: { width: 8, height: 8, borderRadius: 4 },
    chipText: { color: colors.text, fontSize: SIZES.sm, fontWeight: '600' },
    chipTextActive: { color: colors.text },
    input: {
        backgroundColor: colors.inputBg, borderRadius: RADIUS.lg,
        borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
        paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
        color: colors.text, fontSize: SIZES.md, ...SHADOWS.small,
    },
    bodyInput: { minHeight: 200, paddingTop: SPACING.md },
});

export default AddNote;
