import React, { useEffect, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, ScrollView,
    TouchableOpacity, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { SIZES, SPACING } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import InputField from '../components/InputField';
import Button from '../components/Button';
import AppIcon from '../components/AppIcon';
import { signIn, getUserDoc, ensureAdminDoc } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';

const ROLE_ROUTES = {
    admin: 'AdminDashboard',
    teacher: 'TeacherDashboard',
    student: 'StudentDashboard',
};

const ROLE_LABELS = { admin: 'Admin', teacher: 'Teacher', student: 'Student' };

const LoginScreen = ({ navigation, route }) => {
    const { colors, toggle, isDark } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const selectedRole = route?.params?.role;
    const roleLabel = ROLE_LABELS[selectedRole];
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { user, profile } = useAuth();

    useEffect(() => {
        if (user && profile?.role) {
            const target = ROLE_ROUTES[profile.role];
            if (target) navigation.replace(target);
        }
    }, [user, profile, navigation]);

    const handleLogin = async () => {
        setError('');
        if (!email.trim() || !password) {
            setError('Enter email and password.');
            return;
        }
        setLoading(true);
        try {
            const fbUser = await signIn(email, password);

            let userDoc = await getUserDoc(fbUser.uid);

            if (!userDoc && fbUser.email?.toLowerCase() === 'admin@studivista.com') {
                userDoc = await ensureAdminDoc(fbUser);
            }

            if (!userDoc) {
                setError('No account profile found. Contact your administrator.');
                setLoading(false);
                return;
            }

            const target = ROLE_ROUTES[userDoc.role];
            if (!target) {
                setError(`Unknown role: ${userDoc.role}`);
                setLoading(false);
                return;
            }
            navigation.replace(target);
        } catch (e) {
            const code = e?.code || '';
            const msg =
                code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found'
                    ? 'Invalid email or password.'
                    : code === 'auth/invalid-email'
                        ? 'Email is not valid.'
                        : code === 'auth/too-many-requests'
                            ? 'Too many attempts. Try again later.'
                            : e?.message || 'Sign-in failed.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {!isDark && (
                <Image source={require('../assets/logo.png')} style={styles.bgWatermark} resizeMode="contain" pointerEvents="none" />
            )}

            <TouchableOpacity onPress={toggle} style={styles.themeBtn} activeOpacity={0.7}>
                <AppIcon name={isDark ? 'sun' : 'moon'} size={18} color={colors.text} />
            </TouchableOpacity>

            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
                    <View style={styles.headerArea}>
                        <Image source={require('../assets/logo.png')} style={styles.logoImg} resizeMode="cover" />
                        <Text style={styles.title}>
                            {roleLabel ? `Sign in as\n${roleLabel}` : 'Welcome to\nStudivista'}
                        </Text>
                        <Text style={styles.subtitle}>Sign in with the credentials provided to you</Text>
                    </View>

                    <View style={styles.form}>
                        <InputField
                            label="Email Address"
                            placeholder="Enter your email"
                            icon="envelope"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                        <InputField
                            label="Password"
                            placeholder="Enter your password"
                            icon="lock"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />

                        {!!error && <Text style={styles.error}>{error}</Text>}

                        <Button
                            label="Sign In"
                            onPress={handleLogin}
                            loading={loading}
                            size="lg"
                            style={styles.submitBtn}
                        />

                        <Text style={styles.helper}>
                            Admins are seeded by us. Teachers are added by an admin.
                            Students are added by their teacher.
                        </Text>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const makeStyles = (colors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    bgWatermark: {
        position: 'absolute', alignSelf: 'center', top: '20%',
        width: '110%', height: '70%', opacity: 0.07,
    },
    themeBtn: {
        position: 'absolute', top: SPACING.xxl, right: SPACING.lg, zIndex: 5,
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
        borderWidth: 1, borderColor: colors.border,
    },
    scroll: { padding: SPACING.xl, paddingBottom: SPACING.xxxl },
    headerArea: { alignItems: 'center', marginBottom: SPACING.xxl, paddingTop: SPACING.xl },
    logoImg: {
        width: 96, height: 96, borderRadius: 24, marginBottom: SPACING.md,
        shadowColor: colors.primary, shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4, shadowRadius: 16, elevation: 10,
    },
    title: {
        fontSize: SIZES.title, fontWeight: '900', color: colors.text,
        textAlign: 'center', lineHeight: 36, marginBottom: SPACING.sm,
    },
    subtitle: { fontSize: SIZES.md, color: colors.textMuted, textAlign: 'center' },
    form: { marginBottom: SPACING.xl },
    submitBtn: { marginTop: SPACING.md },
    error: {
        color: colors.danger, fontSize: SIZES.sm, fontWeight: '600',
        textAlign: 'center', marginTop: SPACING.sm, marginBottom: -SPACING.xs,
    },
    helper: {
        marginTop: SPACING.xl, fontSize: SIZES.xs, color: colors.textMuted,
        textAlign: 'center', lineHeight: 18,
    },
});

export default LoginScreen;
