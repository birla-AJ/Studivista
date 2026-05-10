import React, { useEffect, useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, SafeAreaView,
} from 'react-native';
import { SIZES, SPACING, RADIUS, SHADOWS } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';
import Header from '../../components/Header';
import ClassCard from '../../components/ClassCard';
import Button from '../../components/Button';
import BottomTabBar from '../../components/BottomTabBar';
import AppIcon from '../../components/AppIcon';
import { subscribeClassesByBatches, subscribeBatchesByIds } from '../../services/firestoreService';
import { useAuth } from '../../contexts/AuthContext';

const JoinClass = ({ navigation }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const { profile } = useAuth();
    const [active, setActive] = useState('JoinClass');
    const [classes, setClasses] = useState([]);
    const [batches, setBatches] = useState([]);

    useEffect(() => {
        const ids = profile?.batchIds || [];
        if (ids.length === 0) return;
        const u1 = subscribeClassesByBatches(ids, setClasses);
        const u2 = subscribeBatchesByIds(ids, setBatches);
        return () => { u1?.(); u2?.(); };
    }, [profile?.batchIds?.join(',')]);

    const handleNav = (screen) => {
        setActive(screen);
        const routes = {
            StudentDashboard: 'StudentDashboard', StudentRecordings: 'StudentRecordings',
            StudentAttendance: 'StudentAttendance',
        };
        if (routes[screen]) navigation.navigate(routes[screen]);
    };

    const liveClasses = classes.filter(c => c.status === 'live');
    const upcoming = classes.filter(c => c.status === 'scheduled');

    const totalForBatch = (batchId) => batches.find(b => b.id === batchId)?.studentIds?.length || 0;

    return (
        <SafeAreaView style={styles.container}>
            <Header title="Join Class" subtitle="Live and upcoming classes" showBack onBack={() => navigation.goBack()} />

            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                {liveClasses.length > 0 ? (
                    <>
                        <View style={styles.sectionTitleRow}>
                            <AppIcon name="circle" size={10} color={colors.primary} />
                            <Text style={styles.sectionTitle}>Live Now — Join Instantly</Text>
                        </View>
                        {liveClasses.map(cls => {
                            const inBatch = (profile?.batchIds || []).includes(cls.batchId);
                            const goJoin = () => {
                                const params = { roomId: cls.id, name: profile?.name || 'Student', cls };
                                navigation.navigate(inBatch ? 'LiveClass' : 'Waiting', inBatch ? { ...params, role: 'student' } : params);
                            };
                            return (
                                <View key={cls.id}>
                                    <ClassCard
                                        cls={cls}
                                        totalStudents={totalForBatch(cls.batchId)}
                                        onPress={goJoin}
                                    />
                                    <Button
                                        label={inBatch ? 'Join Live Class' : 'Request to Join'}
                                        onPress={goJoin}
                                        size="lg"
                                        icon="broadcast-tower"
                                        style={styles.joinBtn}
                                    />
                                </View>
                            );
                        })}
                    </>
                ) : (
                    <View style={styles.noLive}>
                        <View style={styles.iconBox}>
                            <AppIcon name="broadcast-tower" size={40} color={colors.textMuted} />
                        </View>
                        <Text style={styles.noLiveTitle}>No live classes right now</Text>
                        <Text style={styles.noLiveSub}>You'll get a notification when your teacher starts a class.</Text>
                    </View>
                )}

                <View style={styles.sectionTitleRow}>
                    <AppIcon name="book-open" size={14} color={colors.text} />
                    <Text style={styles.sectionTitle}>My Scheduled Classes</Text>
                </View>
                {upcoming.length === 0 ? (
                    <Text style={styles.empty}>No upcoming classes scheduled.</Text>
                ) : upcoming.map(cls => (
                    <ClassCard
                        key={cls.id}
                        cls={cls}
                        totalStudents={totalForBatch(cls.batchId)}
                        onPress={() => {}}
                    />
                ))}

                <View style={styles.infoCard}>
                    <View style={styles.infoTitleRow}>
                        <AppIcon name="info-circle" size={16} color={colors.text} />
                        <Text style={styles.infoTitle}>How to Join</Text>
                    </View>
                    {[
                        'Wait for your teacher to start the class.',
                        'You will receive a push notification when class begins.',
                        'Tap the live class card to join.',
                        'Only students enrolled in the batch can see and join.',
                    ].map((tip, i) => (
                        <View key={i} style={styles.tipRow}>
                            <View style={[styles.tipNum, { backgroundColor: colors.primary }]}>
                                <Text style={styles.tipNumText}>{i + 1}</Text>
                            </View>
                            <Text style={styles.tipText}>{tip}</Text>
                        </View>
                    ))}
                </View>

                <View style={{ height: 100 }} />
            </ScrollView>

            <BottomTabBar activeScreen={active} onNavigate={handleNav} role="student" />
        </SafeAreaView>
    );
};

const makeStyles = (colors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { flex: 1, paddingHorizontal: SPACING.base },
    sectionTitle: { fontSize: SIZES.base, fontWeight: '800', color: colors.text, marginTop: SPACING.base, marginBottom: SPACING.sm },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.base, marginBottom: SPACING.sm },
    joinBtn: { marginTop: -SPACING.sm, marginBottom: SPACING.md },
    noLive: {
        backgroundColor: colors.surface, borderRadius: RADIUS.xl,
        padding: SPACING.lg, marginVertical: SPACING.md,
        alignItems: 'center', gap: SPACING.sm,
        borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...SHADOWS.small,
    },
    iconBox: {
        width: 76, height: 76, borderRadius: 24,
        backgroundColor: colors.surfaceSubtle,
        alignItems: 'center', justifyContent: 'center',
    },
    noLiveTitle: { fontSize: SIZES.lg, fontWeight: '800', color: colors.text },
    noLiveSub: { fontSize: SIZES.sm, color: colors.textMuted, textAlign: 'center' },
    empty: { color: colors.textMuted, fontSize: SIZES.sm, paddingVertical: SPACING.md, textAlign: 'center' },
    infoCard: {
        backgroundColor: colors.surface, borderRadius: RADIUS.xl,
        padding: SPACING.base, marginTop: SPACING.md,
        borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...SHADOWS.small,
    },
    infoTitle: { fontSize: SIZES.md, fontWeight: '800', color: colors.text },
    infoTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.md },
    tipRow: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md, marginBottom: SPACING.sm },
    tipNum: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
    tipNumText: { color: '#FFFFFF', fontSize: SIZES.xs, fontWeight: '800' },
    tipText: { flex: 1, fontSize: SIZES.sm, color: colors.textMuted, lineHeight: 20 },
});

export default JoinClass;
