import React, { useMemo } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SPACING, RADIUS, SIZES } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import AppIcon from './AppIcon';

const TAB_CONFIG = {
    admin: [
        { key: 'AdminDashboard', icon: 'home', label: 'Home' },
        { key: 'TeacherList', icon: 'chalkboard-teacher', label: 'Teachers' },
        { key: 'BatchList', icon: 'users', label: 'Batches' },
        { key: 'StudentList', icon: 'graduation-cap', label: 'Students' },
        { key: 'AdminClasses', icon: 'calendar-alt', label: 'Classes' },
        { key: 'Profile', icon: 'user-circle', label: 'Profile' },
    ],
    teacher: [
        { key: 'TeacherDashboard', icon: 'home', label: 'Home' },
        { key: 'MyClasses', icon: 'book-open', label: 'Classes' },
        { key: 'TeacherStudents', icon: 'graduation-cap', label: 'Students' },
        { key: 'Attendance', icon: 'check-circle', label: 'Attendance' },
        { key: 'Profile', icon: 'user-circle', label: 'Profile' },
    ],
    student: [
        { key: 'StudentDashboard', icon: 'home', label: 'Home' },
        { key: 'JoinClass', icon: 'broadcast-tower', label: 'Join' },
        { key: 'StudentRecordings', icon: 'video', label: 'Recordings' },
        { key: 'StudentAttendance', icon: 'check-circle', label: 'Attendance' },
        { key: 'Profile', icon: 'user-circle', label: 'Profile' },
    ],
};

const BottomTabBar = ({ activeScreen, onNavigate, role = 'student' }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const navigation = useNavigation();
    const tabs = TAB_CONFIG[role] || TAB_CONFIG.student;

    const handleTap = (key) => {
        if (onNavigate) onNavigate(key);
        try { navigation.navigate(key); } catch {}
    };

    return (
        <View style={styles.container}>
            {tabs.map((tab) => {
                const isActive = activeScreen === tab.key;
                return (
                    <TouchableOpacity
                        key={tab.key}
                        style={styles.tab}
                        onPress={() => handleTap(tab.key)}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.iconContainer, isActive && styles.activeIconContainer]}>
                            <AppIcon name={tab.icon} size={18} color={isActive ? colors.primary : colors.textMuted} />
                        </View>
                        <Text style={[styles.label, isActive && styles.activeLabel]}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
};

const makeStyles = (colors) => StyleSheet.create({
    container: {
        flexDirection: 'row',
        backgroundColor: colors.surface,
        paddingBottom: SPACING.base + 4,
        paddingTop: SPACING.md,
        paddingHorizontal: SPACING.sm,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border,
    },
    tab: { flex: 1, alignItems: 'center', gap: 3 },
    iconContainer: {
        width: 44, height: 32,
        borderRadius: RADIUS.md,
        alignItems: 'center', justifyContent: 'center',
    },
    activeIconContainer: { backgroundColor: colors.primary + '25' },
    label: { fontSize: SIZES.xs, color: colors.textMuted, fontWeight: '500' },
    activeLabel: { color: colors.primary, fontWeight: '700' },
});

export default BottomTabBar;
