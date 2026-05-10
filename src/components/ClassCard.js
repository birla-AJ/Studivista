import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SIZES, SPACING, RADIUS, SHADOWS } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import AppIcon from './AppIcon';
import { formatDateLabel, formatTimeLabel } from '../utils/format';

const StatusBadge = ({ status }) => {
    const { colors } = useTheme();
    const config = {
        live: { label: 'LIVE', icon: 'circle', bg: colors.primary, text: '#FFFFFF' },
        upcoming: { label: 'UPCOMING', icon: 'clock', bg: colors.warning + '22', text: colors.warning },
        scheduled: { label: 'SCHEDULED', icon: 'calendar-alt', bg: colors.secondary + '22', text: colors.secondary },
        completed: { label: 'COMPLETED', icon: 'check-circle', bg: colors.success + '22', text: colors.success },
    };
    const c = config[status] || config.scheduled;
    return (
        <View style={[badgeStyles.statusBadge, { backgroundColor: c.bg }]}>
            <AppIcon name={c.icon} size={8} color={c.text} />
            <Text style={[badgeStyles.statusText, { color: c.text }]}>{c.label}</Text>
        </View>
    );
};

const badgeStyles = StyleSheet.create({
    statusBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.full, flexDirection: 'row', alignItems: 'center', gap: 5 },
    statusText: { fontSize: SIZES.xs, fontWeight: '800', letterSpacing: 0.5 },
});

const ClassCard = ({ cls, onPress, totalStudents }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const color = cls.color || colors.primary;
    const dateLabel = cls.date || formatDateLabel(cls.scheduledAt);
    const timeLabel = cls.time || formatTimeLabel(cls.scheduledAt);
    const durationLabel = cls.durationMin ? `${cls.durationMin} min` : (cls.duration || '');
    const batchLabel = cls.batchName || cls.batch || '';
    const teacherLabel = cls.teacherName || cls.teacher || '';
    const joined = (cls.joinedStudentIds?.length ?? cls.studentsJoined ?? 0);
    const total = totalStudents ?? cls.totalStudents ?? 0;

    return (
        <TouchableOpacity
            style={[styles.card, SHADOWS.medium]}
            onPress={onPress}
            activeOpacity={0.85}
        >
            <View style={[styles.accentBar, { backgroundColor: color }]} />

            <View style={styles.content}>
                <View style={styles.topRow}>
                    <StatusBadge status={cls.status} />
                    <Text style={styles.duration}>{durationLabel}</Text>
                </View>

                <Text style={styles.title} numberOfLines={2}>{cls.title}</Text>
                <Text style={styles.batchName} numberOfLines={1}>{batchLabel}</Text>

                <View style={styles.bottomRow}>
                    <View style={styles.teacherRow}>
                        <View style={styles.teacherAvatar}>
                            <AppIcon name="chalkboard-teacher" size={12} color={colors.teacherColor} />
                        </View>
                        <Text style={styles.teacherName} numberOfLines={1}>{teacherLabel}</Text>
                    </View>
                    <View style={styles.timeBox}>
                        <Text style={styles.dateText}>{dateLabel}</Text>
                        <Text style={[styles.timeText, { color }]}>{timeLabel}</Text>
                    </View>
                </View>

                {cls.status === 'live' && total > 0 && (
                    <View style={styles.joinedRow}>
                        <View style={styles.progressBar}>
                            <View style={[styles.progressFill, { backgroundColor: color, width: `${(joined / total) * 100}%` }]} />
                        </View>
                        <Text style={styles.joinedText}>{joined}/{total} joined</Text>
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );
};

const makeStyles = (colors) => StyleSheet.create({
    card: { borderRadius: RADIUS.lg, marginBottom: SPACING.md, overflow: 'hidden', flexDirection: 'row', backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
    accentBar: { width: 4, borderTopLeftRadius: RADIUS.lg, borderBottomLeftRadius: RADIUS.lg },
    content: { flex: 1, padding: SPACING.base },
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
    duration: { fontSize: SIZES.xs, fontWeight: '600', color: colors.textMuted },
    title: { fontSize: SIZES.base, fontWeight: '800', lineHeight: 22, marginBottom: 4, color: colors.text },
    batchName: { fontSize: SIZES.sm, color: colors.textMuted, marginBottom: SPACING.md },
    bottomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    teacherRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
    teacherAvatar: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.teacherColor + '22', alignItems: 'center', justifyContent: 'center' },
    teacherName: { fontSize: SIZES.xs, color: colors.textMuted, fontWeight: '600', flex: 1 },
    timeBox: { alignItems: 'flex-end' },
    dateText: { fontSize: SIZES.xs, color: colors.textMuted },
    timeText: { fontSize: SIZES.sm, fontWeight: '800' },
    joinedRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.sm },
    progressBar: { flex: 1, height: 4, backgroundColor: colors.surfaceSubtle, borderRadius: 2, overflow: 'hidden' },
    progressFill: { height: '100%', borderRadius: 2 },
    joinedText: { fontSize: SIZES.xs, color: colors.textMuted, fontWeight: '600' },
});

export { StatusBadge };
export default ClassCard;
