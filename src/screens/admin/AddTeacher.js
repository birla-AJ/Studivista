import React, { useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity,
} from 'react-native';
import { SIZES, SPACING, RADIUS } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';
import Header from '../../components/Header';
import InputField from '../../components/InputField';
import Button from '../../components/Button';
import AppIcon from '../../components/AppIcon';
import { adminCreateTeacher } from '../../services/authService';
import { useAuth } from '../../contexts/AuthContext';
import { Toast } from '../../components/Toast';

const SUBJECTS = ['Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'History', 'Computer Science'];

const AddTeacher = ({ navigation }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const { user } = useAuth();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [subject, setSubject] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async () => {
        setError('');
        if (!name.trim()) return setError('Enter teacher name.');
        if (!email.trim()) return setError('Enter email.');
        if (password.length < 8) return setError('Password must be 8+ characters.');

        setLoading(true);
        try {
            await adminCreateTeacher({ email, password, name, subject, createdByUid: user?.uid });
            Toast.success(`${name} can now log in with their email and password.`, 'Teacher added');
            navigation.goBack();
        } catch (e) {
            const code = e?.code || '';
            const msg =
                code === 'auth/email-already-in-use' ? 'That email is already in use.' :
                code === 'auth/invalid-email' ? 'Email is not valid.' :
                code === 'auth/weak-password' ? 'Password is too weak.' :
                e?.message || 'Could not add teacher.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <Header title="Add Teacher" showBack onBack={() => navigation.goBack()} />

            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.sectionLabel}>Teacher Information</Text>

                <InputField label="Full Name" placeholder="e.g. Sarah Johnson" value={name} onChangeText={setName} icon="user" />
                <InputField label="Email Address" placeholder="teacher@example.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" icon="envelope" />
                <InputField label="Initial Password" placeholder="At least 8 characters" value={password} onChangeText={setPassword} secureTextEntry icon="lock" />

                <Text style={styles.fieldLabel}>Subject (optional)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
                    {SUBJECTS.map(s => (
                        <TouchableOpacity key={s} style={[styles.chip, subject === s && styles.chipActive]} onPress={() => setSubject(s)}>
                            <Text style={[styles.chipText, subject === s && styles.chipTextActive]}>{s}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                <View style={styles.infoCard}>
                    <AppIcon name="info-circle" size={14} color={colors.secondary} />
                    <Text style={styles.infoText}>
                        Share the email and password with the teacher. They sign in directly using these credentials.
                    </Text>
                </View>

                {!!error && <Text style={styles.error}>{error}</Text>}

                <Button label="Add Teacher" onPress={handleSave} loading={loading} size="lg" icon="chalkboard-teacher" style={{ marginTop: SPACING.lg }} />
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
    infoCard: {
        flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
        backgroundColor: colors.secondary + '15', borderRadius: RADIUS.md,
        padding: SPACING.md, marginTop: SPACING.sm,
        borderWidth: 1, borderColor: colors.secondary + '33',
    },
    infoText: { flex: 1, fontSize: SIZES.sm, color: colors.secondary, lineHeight: 20 },
    error: { color: colors.danger, fontSize: SIZES.sm, fontWeight: '600', textAlign: 'center', marginTop: SPACING.md },
});

export default AddTeacher;
