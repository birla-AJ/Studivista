import React, { useMemo } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Alert,
} from 'react-native';
import { SIZES, SPACING, RADIUS } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import Header from '../components/Header';
import AppIcon from '../components/AppIcon';
import { deleteNote } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { formatJoined, formatTimeLabel } from '../utils/format';
import { Toast } from '../components/Toast';

const NoteDetail = ({ navigation, route }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const note = route?.params?.note;
    const { user, profile } = useAuth();
    const isOwner = profile?.role === 'admin' || (profile?.role === 'teacher' && user?.uid === note?.teacherId);

    if (!note) {
        return (
            <SafeAreaView style={styles.container}>
                <Header title="Note" showBack onBack={() => navigation.goBack()} />
                <Text style={styles.empty}>Note not found.</Text>
            </SafeAreaView>
        );
    }

    const handleDelete = () => {
        Alert.alert('Delete note?', 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    try {
                        await deleteNote(note.id);
                        navigation.goBack();
                    } catch (e) {
                        Toast.error(e?.message || 'Please try again.', 'Could not delete');
                    }
                },
            },
        ]);
    };

    return (
        <SafeAreaView style={styles.container}>
            <Header
                title="Note"
                subtitle={note.batchName || ''}
                showBack
                onBack={() => navigation.goBack()}
                rightComponent={isOwner ? (
                    <TouchableOpacity onPress={handleDelete}>
                        <AppIcon name="trash" size={18} color={colors.text} />
                    </TouchableOpacity>
                ) : null}
            />

            <ScrollView style={styles.scroll} contentContainerStyle={{ padding: SPACING.base, paddingBottom: SPACING.xxxl }}>
                <Text style={styles.title}>{note.title}</Text>

                <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                        <AppIcon name="user" size={12} color={colors.textMuted} />
                        <Text style={styles.metaText}>{note.teacherName || 'Teacher'}</Text>
                    </View>
                    <View style={styles.metaItem}>
                        <AppIcon name="calendar-alt" size={12} color={colors.textMuted} />
                        <Text style={styles.metaText}>
                            {formatJoined(note.createdAt)}{note.createdAt ? ` • ${formatTimeLabel(note.createdAt)}` : ''}
                        </Text>
                    </View>
                </View>

                <View style={styles.bodyCard}>
                    <Text style={styles.body}>{note.body}</Text>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const makeStyles = (colors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { flex: 1 },
    empty: { color: colors.textMuted, textAlign: 'center', marginTop: SPACING.xxxl, fontSize: SIZES.sm },
    title: { fontSize: SIZES.xl, fontWeight: '900', color: colors.text, marginBottom: SPACING.sm },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.md, marginBottom: SPACING.lg },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    metaText: { color: colors.textMuted, fontSize: SIZES.xs, fontWeight: '600' },
    bodyCard: {
        backgroundColor: colors.surface, borderRadius: RADIUS.lg,
        borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
        padding: SPACING.lg,
    },
    body: { color: colors.text, fontSize: SIZES.md, lineHeight: 24 },
});

export default NoteDetail;
