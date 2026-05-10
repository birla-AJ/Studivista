import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView, SafeAreaView, TouchableOpacity,
    ActivityIndicator, Animated, PanResponder, Dimensions,
    LayoutAnimation, UIManager, Platform,
} from 'react-native';
import { SIZES, SPACING, RADIUS, SHADOWS } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import Header from '../components/Header';
import AppIcon from '../components/AppIcon';
import {
    subscribeNotificationsForUser, markNotificationRead, deleteNotification,
} from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { tsToDate } from '../utils/format';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_W } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_W * 0.3;

const ICON_BY_TYPE = {
    class_start: 'broadcast-tower',
    info: 'info-circle',
    schedule: 'calendar-alt',
    recording: 'video',
    batch: 'users',
};

const formatRelative = (date) => {
    if (!date) return '';
    const diff = (Date.now() - date.getTime()) / 1000;
    if (diff < 60) return 'Just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hr ago`;
    if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} day ago`;
    return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
};

const SwipeableNotifCard = ({ notif, onPress, onDismiss, forceDismissDir }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeCardStyles(colors), [colors]);
    const translateX = useRef(new Animated.Value(0)).current;
    const opacity = useRef(new Animated.Value(1)).current;
    const dismissedRef = useRef(false);
    const date = tsToDate(notif.createdAt);
    const icon = ICON_BY_TYPE[notif.type] || 'bell';

    const animateOut = useCallback((dir) => {
        if (dismissedRef.current) return;
        dismissedRef.current = true;
        const target = dir === 'left' ? -SCREEN_W : SCREEN_W;
        Animated.parallel([
            Animated.timing(translateX, {
                toValue: target, duration: 240, useNativeDriver: false,
            }),
            Animated.timing(opacity, {
                toValue: 0, duration: 240, useNativeDriver: false,
            }),
        ]).start(() => {
            // Smoothly collapse the row gap when the card unmounts
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            onDismiss?.(dir);
        });
    }, [translateX, opacity, onDismiss]);

    useEffect(() => {
        if (forceDismissDir) animateOut(forceDismissDir);
    }, [forceDismissDir, animateOut]);

    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (_, g) =>
                Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
            onPanResponderMove: (_, g) => {
                translateX.setValue(g.dx);
                // Fade as it moves
                opacity.setValue(1 - Math.min(Math.abs(g.dx) / SCREEN_W, 0.6));
            },
            onPanResponderRelease: (_, g) => {
                if (Math.abs(g.dx) > SWIPE_THRESHOLD) {
                    animateOut(g.dx > 0 ? 'right' : 'left');
                } else {
                    Animated.parallel([
                        Animated.spring(translateX, {
                            toValue: 0, tension: 70, friction: 8, useNativeDriver: false,
                        }),
                        Animated.timing(opacity, {
                            toValue: 1, duration: 150, useNativeDriver: false,
                        }),
                    ]).start();
                }
            },
            onPanResponderTerminate: () => {
                Animated.parallel([
                    Animated.spring(translateX, { toValue: 0, useNativeDriver: false }),
                    Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: false }),
                ]).start();
            },
        }),
    ).current;

    return (
        <Animated.View
            style={[
                styles.swipeWrap,
                { transform: [{ translateX }], opacity },
            ]}
            {...panResponder.panHandlers}
        >
            <TouchableOpacity
                style={[styles.notifCard, !notif.read && styles.notifCardUnread]}
                onPress={onPress}
                activeOpacity={0.85}
            >
                <View style={[styles.notifIcon, !notif.read && styles.notifIconUnread]}>
                    <AppIcon name={icon} size={20} color={notif.read ? colors.textMuted : colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                    <View style={styles.notifTopRow}>
                        <Text style={styles.notifTitle}>{notif.title}</Text>
                        {!notif.read && <View style={styles.unreadDot} />}
                    </View>
                    <Text style={styles.notifMessage}>{notif.body}</Text>
                    <Text style={styles.notifTime}>{formatRelative(date)}</Text>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

const makeCardStyles = (colors) => StyleSheet.create({
    swipeWrap: { marginTop: SPACING.sm },
    notifCard: {
        flexDirection: 'row', alignItems: 'flex-start',
        backgroundColor: colors.surface, borderRadius: RADIUS.lg,
        padding: SPACING.md, gap: SPACING.md,
        borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...SHADOWS.small,
    },
    notifCardUnread: { borderLeftWidth: 3, borderLeftColor: colors.primary, backgroundColor: colors.primary + '08' },
    notifIcon: {
        width: 46, height: 46, borderRadius: RADIUS.md,
        backgroundColor: colors.surfaceSubtle, alignItems: 'center', justifyContent: 'center',
    },
    notifIconUnread: { backgroundColor: colors.primary + '20' },
    notifTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 },
    notifTitle: { fontSize: SIZES.md, fontWeight: '700', color: colors.text, flex: 1 },
    unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
    notifMessage: { fontSize: SIZES.sm, color: colors.textMuted, lineHeight: 20, marginBottom: 4 },
    notifTime: { fontSize: SIZES.xs, color: colors.textMuted, fontWeight: '600' },
});

const NotificationsScreen = ({ navigation }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const { user } = useAuth();
    const [notifications, setNotifications] = useState(null);
    const [clearing, setClearing] = useState(false);
    // Map of notifId → 'left' | 'right' to programmatically force-dismiss a card.
    const [dismissDir, setDismissDir] = useState({});

    useEffect(() => {
        if (!user?.uid) return;
        const unsub = subscribeNotificationsForUser(user.uid, setNotifications);
        return () => unsub && unsub();
    }, [user?.uid]);

    const unreadCount = (notifications || []).filter(n => !n.read).length;

    const handleDismiss = async (notif) => {
        try {
            if (!notif.read) await markNotificationRead(notif.id);
            await deleteNotification(notif.id);
        } catch {}
    };

    // Sweep through oldest → latest, animating each card out then deleting it.
    const markAllRead = async () => {
        if (clearing) return;
        const list = [...(notifications || [])].sort((a, b) => {
            const ta = a.createdAt?.toMillis?.() || 0;
            const tb = b.createdAt?.toMillis?.() || 0;
            return ta - tb; // oldest first
        });
        if (list.length === 0) return;
        setClearing(true);
        for (let i = 0; i < list.length; i++) {
            const n = list[i];
            const dir = i % 2 === 0 ? 'right' : 'left';
            setDismissDir(prev => ({ ...prev, [n.id]: dir }));
            await new Promise(r => setTimeout(r, 280));
            try {
                if (!n.read) await markNotificationRead(n.id);
                await deleteNotification(n.id);
            } catch {}
            await new Promise(r => setTimeout(r, 80));
        }
        setClearing(false);
        setDismissDir({});
    };

    return (
        <SafeAreaView style={styles.container}>
            <Header
                title="Notifications"
                subtitle={notifications === null ? 'Loading…' : (unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!')}
                showBack
                onBack={() => navigation.goBack()}
                rightComponent={
                    (notifications && notifications.length > 0) ? (
                        <TouchableOpacity onPress={markAllRead} disabled={clearing}>
                            <Text style={[styles.markAllText, clearing && { opacity: 0.5 }]}>
                                {clearing ? 'Clearing…' : (unreadCount > 0 ? 'Mark all read' : 'Clear all')}
                            </Text>
                        </TouchableOpacity>
                    ) : null
                }
            />

            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                {notifications === null ? (
                    <View style={styles.empty}><ActivityIndicator color={colors.primary} /></View>
                ) : notifications.length === 0 ? (
                    <View style={styles.empty}>
                        <AppIcon name="bell" size={64} color={colors.textMuted} />
                        <Text style={styles.emptyTitle}>No Notifications</Text>
                        <Text style={styles.emptySub}>You're all caught up!</Text>
                    </View>
                ) : (
                    <>
                        <Text style={styles.hint}>Swipe left or right to dismiss</Text>
                        {notifications.map(notif => (
                            <SwipeableNotifCard
                                key={notif.id}
                                notif={notif}
                                forceDismissDir={dismissDir[notif.id]}
                                onPress={() => !notif.read && markNotificationRead(notif.id)}
                                onDismiss={() => handleDismiss(notif)}
                            />
                        ))}
                    </>
                )}

                <View style={{ height: 60 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

const makeStyles = (colors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    scroll: { flex: 1, paddingHorizontal: SPACING.base },
    markAllText: { color: colors.primary, fontSize: SIZES.xs, fontWeight: '700' },
    empty: { alignItems: 'center', paddingTop: 80, gap: SPACING.md },
    emptyTitle: { fontSize: SIZES.xl, fontWeight: '800', color: colors.text },
    emptySub: { fontSize: SIZES.md, color: colors.textMuted },
    hint: {
        fontSize: SIZES.xs, color: colors.textMuted,
        textAlign: 'center', marginTop: SPACING.sm,
        fontStyle: 'italic',
    },
});

export default NotificationsScreen;
