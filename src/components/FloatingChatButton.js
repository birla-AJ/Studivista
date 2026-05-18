import React, { useEffect, useRef } from 'react';
import { Animated, TouchableOpacity, StyleSheet, Easing } from 'react-native';
import { StackActions } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { SPACING, SHADOWS, scale } from '../theme';
import AppIcon from './AppIcon';
import { useAuth } from '../contexts/AuthContext';

// Routes the FAB should NOT appear on:
//   - auth flow (Splash/Login)
//   - the AI chat itself (would be redundant)
//   - live-class flow (would clutter the call UI)
//   - full-screen video
const HIDDEN_ROUTES = new Set([
    'Splash', 'Login',
    'AIChat', 'LiveClass', 'Waiting', 'VideoPlayer',
]);

const FloatingChatButton = ({ currentRoute, navigationRef }) => {
    const { colors } = useTheme();
    const { profile } = useAuth();
    const pulse = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, {
                    toValue: 1.08, duration: 1000,
                    easing: Easing.out(Easing.ease), useNativeDriver: true,
                }),
                Animated.timing(pulse, {
                    toValue: 1, duration: 1000,
                    easing: Easing.in(Easing.ease), useNativeDriver: true,
                }),
            ]),
        ).start();
    }, [pulse]);

    if (!profile || HIDDEN_ROUTES.has(currentRoute)) return null;

    const onPress = () => {
        // Always push a fresh AIChat on top of the current screen so the back
        // button returns to where the user came from, even if AIChat was
        // already in the stack earlier.
        navigationRef.current?.dispatch(
            StackActions.push('AIChat', { role: profile?.role || 'student' }),
        );
    };

    return (
        <Animated.View
            pointerEvents="box-none"
            style={[styles.wrap, { transform: [{ scale: pulse }] }]}
        >
            <TouchableOpacity
                onPress={onPress}
                activeOpacity={0.85}
                style={[styles.fab, { backgroundColor: colors.primary }]}
            >
                <AppIcon name="robot" size={scale(22)} color="#FFFFFF" />
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    wrap: {
        position: 'absolute',
        right: SPACING.base,
        bottom: scale(90), // sits above the bottom tab bar (~80) on dashboard screens
        zIndex: 1000, elevation: 12,
    },
    fab: {
        width: scale(56), height: scale(56), borderRadius: scale(28),
        alignItems: 'center', justifyContent: 'center',
        ...SHADOWS.primary,
    },
});

export default FloatingChatButton;
