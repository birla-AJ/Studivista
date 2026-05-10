import React from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet, StatusBar, Image,
} from 'react-native';
import { SIZES, SPACING, RADIUS } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import AppIcon from './AppIcon';

const LOGO = require('../assets/logo.png');

const Header = ({
    title,
    subtitle,
    showBack,
    onBack,
    rightComponent,
    centerTitle = true,
    showThemeToggle = true,
}) => {
    const { colors, isDark, toggle } = useTheme();

    return (
        <View style={[styles.header, { backgroundColor: colors.headerBg, borderBottomColor: colors.border }]}>
            <StatusBar
                barStyle={isDark ? 'light-content' : 'dark-content'}
                backgroundColor={colors.headerBg}
            />
            <View style={styles.leftSection}>
                {showBack ? (
                    <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
                        <Text style={[styles.backIcon, { color: colors.text }]}>‹</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={{ width: 36 }} />
                )}
            </View>

            <View style={[styles.centerSection, !centerTitle && { alignItems: 'flex-start' }]}>
                <Image source={LOGO} style={styles.logoImg} resizeMode="cover" />
                {title ? (
                    <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{title}</Text>
                ) : null}
                {subtitle ? (
                    <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>{subtitle}</Text>
                ) : null}
            </View>

            <View style={styles.rightSection}>
                {showThemeToggle && !rightComponent ? (
                    <TouchableOpacity onPress={toggle} activeOpacity={0.7} style={styles.toggleBtn}>
                        <AppIcon name={isDark ? 'sun' : 'moon'} size={18} color={colors.text} />
                    </TouchableOpacity>
                ) : (rightComponent || <View style={{ width: 36 }} />)}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: SPACING.base,
        paddingVertical: SPACING.md,
        paddingTop: SPACING.xl + 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    leftSection: { width: 44, alignItems: 'flex-start' },
    centerSection: { flex: 1, alignItems: 'center' },
    rightSection: { width: 44, alignItems: 'flex-end' },
    backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
    backIcon: { fontSize: 32, lineHeight: 36, fontWeight: '300' },
    logoImg: { width: 32, height: 32, borderRadius: RADIUS.sm, marginBottom: 4 },
    title: { fontSize: SIZES.md, fontWeight: '700', letterSpacing: 0.2 },
    subtitle: { fontSize: SIZES.xs, marginTop: 1 },
    toggleBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});

export default Header;
