import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity } from 'react-native';
import { SIZES, SPACING, RADIUS, SHADOWS } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';
import Header from '../../components/Header';
import AppIcon from '../../components/AppIcon';
import { subscribeNotesByTeacher } from '../../services/firestoreService';
import { useAuth } from '../../contexts/AuthContext';
import { formatJoined } from '../../utils/format';


const TeacherNotes = ({ navigation }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const { user } = useAuth();
    const [notes, setNotes] = useState([]);

    useEffect(() => {
        if (!user?.uid) return;
        const unsub = subscribeNotesByTeacher(user.uid, setNotes);
        return () => unsub?.();
    }, [user?.uid]);

    const renderItem = ({ item }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('NoteDetail', { note: item })}
            activeOpacity={0.85}
        >
            <View style={styles.iconWrap}>
                <AppIcon name="sticky-note" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.preview} numberOfLines={2}>{item.body}</Text>
                <View style={styles.metaRow}>
                    <Text style={styles.meta}>{item.batchName || 'No batch'}</Text>
                    <Text style={styles.meta}>•</Text>
                    <Text style={styles.meta}>{formatJoined(item.createdAt)}</Text>
                </View>
            </View>
            <AppIcon name="chevron-right" size={12} color={colors.textMuted} />
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <Header title="Notes" subtitle="Your shared notes" showBack onBack={() => navigation.goBack()} />

            <FlatList
                data={notes}
                keyExtractor={n => n.id}
                renderItem={renderItem}
                contentContainerStyle={{ padding: SPACING.base, paddingBottom: 120 }}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <AppIcon name="sticky-note" size={32} color={colors.textMuted} />
                        <Text style={styles.emptyText}>No notes yet. Tap + to create your first note.</Text>
                    </View>
                }
            />

            <TouchableOpacity
                style={styles.fab}
                onPress={() => navigation.navigate('AddNote')}
                activeOpacity={0.85}
            >
                <AppIcon name="plus" size={20} color="#FFFFFF" />
            </TouchableOpacity>
        </SafeAreaView>
    );
};

const makeStyles = (colors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    card: {
        flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
        backgroundColor: colors.surface, borderRadius: RADIUS.lg,
        padding: SPACING.md, marginBottom: SPACING.sm,
        borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...SHADOWS.small,
    },
    iconWrap: {
        width: 40, height: 40, borderRadius: RADIUS.md,
        backgroundColor: colors.primary + '22',
        alignItems: 'center', justifyContent: 'center',
    },
    title: { fontSize: SIZES.md, fontWeight: '800', color: colors.text, marginBottom: 2 },
    preview: { fontSize: SIZES.sm, color: colors.textMuted, lineHeight: 18 },
    metaRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
    meta: { fontSize: SIZES.xs, color: colors.textMuted, fontWeight: '600' },
    empty: { alignItems: 'center', gap: SPACING.md, paddingTop: SPACING.xxxl },
    emptyText: { color: colors.textMuted, fontSize: SIZES.sm, textAlign: 'center', paddingHorizontal: SPACING.xl },
    fab: {
        position: 'absolute', bottom: SPACING.xl, right: SPACING.xl,
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: colors.primary,
        alignItems: 'center', justifyContent: 'center',
        ...SHADOWS.primary,
    },
});

export default TeacherNotes;
