import React, { useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, SafeAreaView,
} from 'react-native';
import { SIZES, SPACING, RADIUS } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';
import Header from '../../components/Header';
import InputField from '../../components/InputField';
import Button from '../../components/Button';
import AppIcon from '../../components/AppIcon';
import { adminCreateStudent } from '../../services/authService';
import { useAuth } from '../../contexts/AuthContext';
import { Toast } from '../../components/Toast';

// Create a student account only. Batch enrollment is a separate flow,
// done from BatchDetail → "Add Students".
const CreateStudent = ({ navigation }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const { user } = useAuth();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async () => {
        setError('');
        if (!name.trim()) return setError('Enter student name.');
        if (!email.trim()) return setError('Enter email.');
        if (password.length < 8) return setError('Password must be 8+ characters.');

        setLoading(true);
        try {
            await adminCreateStudent({ email, password, name, createdByUid: user?.uid });
            Toast.success(
                `${name} can now log in. Assign them to a batch from the batch screen.`,
                'Student created',
            );
            navigation.goBack();
        } catch (e) {
            const code = e?.code || '';
            const msg =
                code === 'auth/email-already-in-use' ? 'That email is already in use.' :
                code === 'auth/invalid-email' ? 'Email is not valid.' :
                code === 'auth/weak-password' ? 'Password is too weak.' :
                e?.message || 'Could not create student.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <Header title="Create Student" showBack onBack={() => navigation.goBack()} />

            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.sectionLabel}>Student Information</Text>

                <InputField
                    label="Full Name"
                    placeholder="Student's full name"
                    value={name}
                    onChangeText={setName}
                    icon="user"
                />
                <InputField
                    label="Email Address"
                    placeholder="student@example.com"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    icon="envelope"
                />
                <InputField
                    label="Initial Password"
                    placeholder="At least 8 characters"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    icon="lock"
                />

                <View style={styles.infoCard}>
                    <AppIcon name="info-circle" size={14} color={colors.secondary} />
                    <Text style={styles.infoText}>
                        Share the email and password with the student. After creating the account,
                        open a batch and use “Add Students” to enroll them.
                    </Text>
                </View>

                {!!error && <Text style={styles.error}>{error}</Text>}

                <Button
                    label="Create Student"
                    onPress={handleSave}
                    loading={loading}
                    size="lg"
                    icon="graduation-cap"
                    style={{ marginTop: SPACING.lg }}
                />
                <View style={{ height: 60 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

const makeStyles = (colors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { flex: 1, paddingHorizontal: SPACING.base },
    sectionLabel: { fontSize: SIZES.base, fontWeight: '800', color: colors.text, marginTop: SPACING.lg, marginBottom: SPACING.md },
    infoCard: {
        flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
        backgroundColor: colors.secondary + '15', borderRadius: RADIUS.md,
        padding: SPACING.md, marginTop: SPACING.md,
        borderWidth: 1, borderColor: colors.secondary + '33',
    },
    infoText: { flex: 1, fontSize: SIZES.sm, color: colors.secondary, lineHeight: 20 },
    error: { color: colors.danger, fontSize: SIZES.sm, fontWeight: '600', textAlign: 'center', marginTop: SPACING.md },
});

export default CreateStudent;
