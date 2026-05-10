import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { RADIUS, SHADOWS } from '../theme';
import { useTheme } from '../theme/ThemeContext';

const Card = ({ children, style, onPress, elevated = false }) => {
    const { colors } = useTheme();
    const shadow = elevated ? SHADOWS.medium : SHADOWS.small;

    if (onPress) {
        return (
            <TouchableOpacity
                style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, shadow, style]}
                onPress={onPress}
                activeOpacity={0.8}
            >
                {children}
            </TouchableOpacity>
        );
    }
    return (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, shadow, style]}>
            {children}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        borderRadius: RADIUS.lg,
        padding: 16,
        marginBottom: 12,
        borderWidth: StyleSheet.hairlineWidth,
    },
});

export default Card;
