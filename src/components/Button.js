import React, { useMemo } from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { RADIUS, SIZES, SPACING, SHADOWS, TEXT_DEFAULTS } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import AppIcon from './AppIcon';

const Button = ({
    label,
    onPress,
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    icon,
    style,
}) => {
    const { colors } = useTheme();
    const variants = useMemo(() => ({
        primary: { bg: colors.primary, text: '#FFFFFF', border: colors.primary, shadow: SHADOWS.primary },
        secondary: { bg: colors.secondary, text: '#FFFFFF', border: colors.secondary, shadow: SHADOWS.secondary },
        outline: { bg: 'transparent', text: colors.primary, border: colors.primary, shadow: {} },
        ghost: { bg: colors.primary + '18', text: colors.primary, border: 'transparent', shadow: {} },
        danger: { bg: colors.danger, text: '#FFFFFF', border: colors.danger, shadow: SHADOWS.primary },
        success: { bg: colors.success, text: '#FFFFFF', border: colors.success, shadow: {} },
        dark: { bg: colors.surface, text: colors.text, border: colors.border, shadow: {} },
    }), [colors]);
    const sizes = {
        sm: { py: SPACING.xs + 2, px: SPACING.md, fontSize: SIZES.sm, radius: RADIUS.sm },
        md: { py: SPACING.md, px: SPACING.lg, fontSize: SIZES.base, radius: RADIUS.md },
        lg: { py: SPACING.base, px: SPACING.xl, fontSize: SIZES.base, radius: RADIUS.lg },
        full: { py: SPACING.base, px: SPACING.xl, fontSize: SIZES.base, radius: RADIUS.full },
    };

    const v = variants[variant] || variants.primary;
    const s = sizes[size] || sizes.md;

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled || loading}
            activeOpacity={0.82}
            style={[
                styles.btn,
                {
                    backgroundColor: disabled ? colors.border : v.bg,
                    borderColor: v.border,
                    paddingVertical: s.py,
                    paddingHorizontal: s.px,
                    borderRadius: s.radius,
                    opacity: disabled ? 0.6 : 1,
                },
                v.shadow,
                style,
            ]}
        >
            {loading ? (
                <ActivityIndicator color={v.text} size="small" />
            ) : (
                <View style={styles.content}>
                    {icon ? <AppIcon name={icon} size={s.fontSize} color={v.text} /> : null}
                    <Text style={[styles.label, { color: v.text, fontSize: s.fontSize }]}>{label}</Text>
                </View>
            )}
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
    label: { ...TEXT_DEFAULTS, fontWeight: '700', letterSpacing: 0.3, textAlign: 'center' },
    content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
});

export default Button;
