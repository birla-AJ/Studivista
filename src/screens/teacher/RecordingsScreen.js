import React, { useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, ScrollView,
} from 'react-native';
import { SIZES, SPACING, RADIUS } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';
import Header from '../../components/Header';
import BottomTabBar from '../../components/BottomTabBar';
import AppIcon from '../../components/AppIcon';

const RecordingsScreen = ({ navigation, route }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const role = route?.params?.role || 'teacher';
    const [active, setActive] = useState('Recordings');

    const handleNav = (screen) => {
        setActive(screen);
        const routes = {
            TeacherDashboard: 'TeacherDashboard', StudentDashboard: 'StudentDashboard',
            MyClasses: 'MyClasses', Attendance: 'Attendance',
            JoinClass: 'JoinClass', StudentAttendance: 'StudentAttendance',
            TeacherStudents: 'TeacherStudents',
        };
        if (routes[screen]) navigation.navigate(screen);
    };

    return (
        <SafeAreaView style={styles.container}>
            <Header title="Recordings" subtitle="Coming soon" showBack onBack={() => navigation.goBack()} />

            <ScrollView style={styles.scroll}>
                <View style={styles.empty}>
                    <View style={styles.iconBox}>
                        <AppIcon name="video" size={56} color={colors.primary} />
                    </View>
                    <Text style={styles.title}>Class Recordings</Text>
                    <Text style={styles.body}>
                        Live streaming and recording will be added in a future update. Once available, recorded sessions will appear here automatically.
                    </Text>
                </View>
            </ScrollView>

            <BottomTabBar activeScreen={active} onNavigate={handleNav} role={role} />
        </SafeAreaView>
    );
};

const makeStyles = (colors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { flex: 1, paddingHorizontal: SPACING.base },
    empty: { alignItems: 'center', paddingTop: 100, gap: SPACING.md },
    iconBox: {
        width: 100, height: 100, borderRadius: 30,
        backgroundColor: colors.primary + '18',
        alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md,
    },
    title: { fontSize: SIZES.xl, fontWeight: '800', color: colors.text },
    body: { color: colors.textMuted, fontSize: SIZES.sm, textAlign: 'center', paddingHorizontal: SPACING.lg, lineHeight: 20 },
});

export default RecordingsScreen;
