import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, FlatList, TouchableOpacity } from 'react-native';
import { SIZES, SPACING, RADIUS, SHADOWS } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';
import Header from '../../components/Header';
import AppIcon from '../../components/AppIcon';
import { subscribeNotesByBatches } from '../../services/firestoreService';
import { useAuth } from '../../contexts/AuthContext';
import { formatJoined } from '../../utils/format';


const StudentNotes = ({ navigation }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const { profile } = useAuth();
    const [notes, setNotes] = useState([]);

    useEffect(() => {
        const ids = profile?.batchIds || [];
        const unsub = subscribeNotesByBatches(ids, setNotes);
        return () => unsub?.();
    }, [profile?.batchIds?.join(',')]);

    const renderItem = ({ item }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('NoteDetail', { note: item })}
            activeOpacity={0.85}
        >
            <View style={styles.iconWrap}>
                <AppIcon name="sticky-note" size={18} color={colors.studentColor} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.preview} numberOfLines={2}>{item.body}</Text>
                <View style={styles.metaRow}>
                    <Text style={styles.meta}>{item.teacherName || 'Teacher'}</Text>
                    <Text style={styles.meta}>•</Text>
                    <Text style={styles.meta}>{item.batchName || 'Batch'}</Text>
                    <Text style={styles.meta}>•</Text>
                    <Text style={styles.meta}>{formatJoined(item.createdAt)}</Text>
                </View>
            </View>
            <AppIcon name="chevron-right" size={12} color={colors.textMuted} />
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <Header title="Notes" subtitle="Notes from your teachers" showBack onBack={() => navigation.goBack()} />

            <FlatList
                data={notes}
                keyExtractor={n => n.id}
                renderItem={renderItem}
                contentContainerStyle={{ padding: SPACING.base, paddingBottom: SPACING.xxxl }}
                ListEmptyComponent={
                    <View style={styles.empty}>
                        <AppIcon name="sticky-note" size={32} color={colors.textMuted} />
                        <Text style={styles.emptyText}>No notes yet. Your teachers will share notes here.</Text>
                    </View>
                }
            />
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
        backgroundColor: colors.studentColor + '22',
        alignItems: 'center', justifyContent: 'center',
    },
    title: { fontSize: SIZES.md, fontWeight: '800', color: colors.text, marginBottom: 2 },
    preview: { fontSize: SIZES.sm, color: colors.textMuted, lineHeight: 18 },
    metaRow: { flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' },
    meta: { fontSize: SIZES.xs, color: colors.textMuted, fontWeight: '600' },
    empty: { alignItems: 'center', gap: SPACING.md, paddingTop: SPACING.xxxl },
    emptyText: { color: colors.textMuted, fontSize: SIZES.sm, textAlign: 'center', paddingHorizontal: SPACING.xl },
});

export default StudentNotes;
