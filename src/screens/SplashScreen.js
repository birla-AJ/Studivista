import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    View, Text, StyleSheet, Animated, Image, Easing, StatusBar,
} from 'react-native';
import { SIZES, SPACING, RADIUS, scale, screen } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../contexts/AuthContext';

const ROLE_ROUTES = {
    admin: 'AdminDashboard',
    teacher: 'TeacherDashboard',
    student: 'StudentDashboard',
};

const MIN_SPLASH_MS = 3000;

const SplashScreen = ({ navigation }) => {
    const { colors, isDark } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const { initializing, user, profile } = useAuth();

    const [minTimeElapsed, setMinTimeElapsed] = useState(false);

    const logoScale = useRef(new Animated.Value(0.4)).current;
    const logoOpacity = useRef(new Animated.Value(0)).current;
    const titleY = useRef(new Animated.Value(20)).current;
    const titleOpacity = useRef(new Animated.Value(0)).current;
    const ringScale = useRef(new Animated.Value(1)).current;
    const dotProgress = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        // Logo entrance
        Animated.parallel([
            Animated.spring(logoScale, { toValue: 1, tension: 40, friction: 7, useNativeDriver: true }),
            Animated.timing(logoOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]).start();

        // Title slide-up after a beat
        Animated.parallel([
            Animated.timing(titleY, { toValue: 0, duration: 600, delay: 350, useNativeDriver: true }),
            Animated.timing(titleOpacity, { toValue: 1, duration: 600, delay: 350, useNativeDriver: true }),
        ]).start();

        // Continuous logo ring pulse
        Animated.loop(
            Animated.sequence([
                Animated.timing(ringScale, {
                    toValue: 1.4, duration: 1400, easing: Easing.out(Easing.cubic), useNativeDriver: true,
                }),
                Animated.timing(ringScale, {
                    toValue: 1, duration: 0, useNativeDriver: true,
                }),
            ]),
        ).start();

        // Looping dots progress
        Animated.loop(
            Animated.timing(dotProgress, {
                toValue: 3, duration: 1200, easing: Easing.linear, useNativeDriver: false,
            }),
        ).start();

        // Minimum splash time
        const timer = setTimeout(() => setMinTimeElapsed(true), MIN_SPLASH_MS);
        return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (initializing || !minTimeElapsed) return;
        if (!user) {
            navigation.replace('RoleSelect');
            return;
        }
        if (profile?.role) {
            const target = ROLE_ROUTES[profile.role] || 'RoleSelect';
            navigation.replace(target);
        }
    }, [initializing, minTimeElapsed, user, profile, navigation]);

    const ringOpacity = ringScale.interpolate({
        inputRange: [1, 1.4],
        outputRange: [0.45, 0],
    });

    return (
        <View style={styles.container}>
            <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

            {/* Decorative blobs */}
            <View style={[styles.blob, styles.blobTopRight]} />
            <View style={[styles.blob, styles.blobBottomLeft]} />
            <View style={[styles.blob, styles.blobMid]} />

            <View style={styles.center}>
                {/* Pulsing rings behind the logo */}
                <Animated.View
                    style={[styles.ring, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]}
                />
                <Animated.View
                    style={[styles.ring, styles.ringInner, { opacity: ringOpacity, transform: [{ scale: ringScale }] }]}
                />

                <Animated.View
                    style={[styles.logoBox, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}
                >
                    <Image source={require('../assets/logo.png')} style={styles.logoImg} resizeMode="cover" />
                </Animated.View>

                <Animated.View
                    style={{ opacity: titleOpacity, transform: [{ translateY: titleY }], alignItems: 'center' }}
                >
                    <Text style={styles.title}>Studivista</Text>
                    <Text style={styles.tagline}>Learn · Grow · Succeed</Text>
                </Animated.View>
            </View>

            <View style={styles.bottom}>
                <View style={styles.dotsRow}>
                    {[0, 1, 2].map(i => {
                        const opacity = dotProgress.interpolate({
                            inputRange: [i, i + 0.3, i + 1],
                            outputRange: [0.25, 1, 0.25],
                            extrapolate: 'clamp',
                        });
                        return (
                            <Animated.View key={i} style={[styles.dot, { opacity }]} />
                        );
                    })}
                </View>
                <Text style={styles.version}>Version 1.0.0</Text>
            </View>
        </View>
    );
};

const makeStyles = (colors) => StyleSheet.create({
    container: {
        flex: 1, backgroundColor: colors.bg,
        alignItems: 'center', justifyContent: 'center',
    },
    blob: {
        position: 'absolute', borderRadius: 999,
    },
    blobTopRight: {
        width: scale(360), height: scale(360),
        backgroundColor: colors.primary + '14',
        top: -scale(120), right: -scale(120),
    },
    blobBottomLeft: {
        width: scale(280), height: scale(280),
        backgroundColor: colors.secondary + '12',
        bottom: -scale(60), left: -scale(80),
    },
    blobMid: {
        width: scale(160), height: scale(160),
        backgroundColor: colors.primary + '10',
        bottom: '38%', right: scale(40),
    },
    center: { alignItems: 'center', justifyContent: 'center' },
    ring: {
        position: 'absolute',
        width: scale(220), height: scale(220), borderRadius: 999,
        borderWidth: 2, borderColor: colors.primary,
    },
    ringInner: {
        width: scale(180), height: scale(180),
        borderColor: colors.primary + 'AA',
    },
    logoBox: {
        width: scale(150), height: scale(150),
        borderRadius: scale(36),
        backgroundColor: colors.surface,
        alignItems: 'center', justifyContent: 'center',
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 18 },
        shadowOpacity: 0.55, shadowRadius: 26, elevation: 18,
        marginBottom: SPACING.xl,
    },
    logoImg: {
        width: scale(126), height: scale(126),
        borderRadius: scale(28),
    },
    title: {
        fontSize: scale(38), fontWeight: '900',
        color: colors.text, letterSpacing: 1.2, marginBottom: SPACING.xs,
    },
    tagline: {
        fontSize: SIZES.md, color: colors.textMuted,
        fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase',
    },
    bottom: {
        position: 'absolute', bottom: SPACING.xxxl,
        alignItems: 'center', gap: SPACING.md,
    },
    dotsRow: { flexDirection: 'row', gap: SPACING.sm },
    dot: {
        width: scale(8), height: scale(8), borderRadius: scale(4),
        backgroundColor: colors.primary,
    },
    version: {
        color: colors.textMuted, fontSize: SIZES.xs,
        letterSpacing: 1,
    },
});

export default SplashScreen;
