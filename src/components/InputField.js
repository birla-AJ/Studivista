import React, { useState } from 'react';
import { View, TextInput, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { RADIUS, SIZES, SPACING, TEXT_DEFAULTS } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import AppIcon from './AppIcon';

const InputField = ({
    label,
    placeholder,
    value,
    onChangeText,
    secureTextEntry = false,
    keyboardType = 'default',
    icon,
    error,
    multiline = false,
    numberOfLines = 1,
    autoCapitalize,
}) => {
    const { colors } = useTheme();
    const [secure, setSecure] = useState(secureTextEntry);
    const [focused, setFocused] = useState(false);

    return (
        <View style={styles.wrapper}>
            {label ? <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text> : null}
            <View style={[
                styles.inputContainer,
                { backgroundColor: colors.inputBg, borderColor: focused ? colors.primary : colors.border },
            ]}>
                {icon ? <AppIcon name={icon} size={16} color={colors.textMuted} style={styles.icon} /> : null}
                <TextInput
                    style={[styles.input, { color: colors.text }, multiline && { textAlignVertical: 'top', minHeight: numberOfLines * 24 }]}
                    placeholder={placeholder}
                    placeholderTextColor={colors.textMuted}
                    value={value}
                    onChangeText={onChangeText}
                    secureTextEntry={secure}
                    keyboardType={keyboardType}
                    autoCapitalize={autoCapitalize}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    multiline={multiline}
                    numberOfLines={numberOfLines}
                />
                {secureTextEntry && (
                    <TouchableOpacity onPress={() => setSecure(!secure)} style={styles.eyeBtn}>
                        <AppIcon name={secure ? 'eye' : 'eye-slash'} size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                )}
            </View>
            {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: { marginBottom: SPACING.base },
    label: { ...TEXT_DEFAULTS, fontSize: SIZES.sm, fontWeight: '600', marginBottom: SPACING.xs, letterSpacing: 0.3 },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: RADIUS.md,
        borderWidth: 1.5,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm + 2,
    },
    icon: { marginRight: SPACING.sm },
    input: { ...TEXT_DEFAULTS, flex: 1, fontSize: SIZES.md, fontWeight: '500' },
    eyeBtn: { padding: SPACING.xs },
    error: { ...TEXT_DEFAULTS, fontSize: SIZES.xs, marginTop: 4 },
});

export default InputField;
