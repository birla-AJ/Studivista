import React from 'react';
import { View, Image, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

const Avatar = ({ uri, size = 48, online = false, badge, badgeColor }) => {
    const { colors } = useTheme();
    return (
        <View style={{ position: 'relative', width: size + 4, height: size + 4 }}>
            <Image
                source={{ uri }}
                style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.surface }}
            />
            {online && (
                <View style={[
                    styles.dot,
                    { width: 12, height: 12, borderRadius: 6, bottom: 1, right: 1, backgroundColor: colors.online, borderColor: colors.bg },
                ]} />
            )}
            {badge !== undefined && (
                <View style={[
                    styles.badge,
                    { backgroundColor: badgeColor || colors.primary, borderColor: colors.bg },
                ]}>
                    <Text style={styles.badgeText}>{badge}</Text>
                </View>
            )}
        </View>
    );
};

const RoleBadge = ({ role }) => {
    const { colors } = useTheme();
    const config = {
        admin: { label: 'Admin', bg: colors.adminColor },
        teacher: { label: 'Teacher', bg: colors.teacherColor },
        student: { label: 'Student', bg: colors.studentColor },
    };
    const { label, bg } = config[role] || config.student;
    return (
        <View style={[styles.roleBadge, { backgroundColor: bg + '22', borderColor: bg + '44' }]}>
            <Text style={[styles.roleText, { color: bg }]}>{label}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    dot: { position: 'absolute', borderWidth: 2 },
    badge: {
        position: 'absolute',
        top: -2, right: -2,
        borderRadius: 10,
        minWidth: 18, height: 18,
        alignItems: 'center', justifyContent: 'center',
        borderWidth: 1.5,
        paddingHorizontal: 3,
    },
    badgeText: { color: '#FFFFFF', fontSize: 9, fontWeight: '700' },
    roleBadge: {
        paddingHorizontal: 8, paddingVertical: 3,
        borderRadius: 20, borderWidth: 1,
    },
    roleText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.3 },
});

export { RoleBadge };
export default Avatar;
