import React, { useEffect, useRef, useState } from 'react';
import { Animated, Text, StyleSheet, Platform, TouchableOpacity, View, Dimensions } from 'react-native';
import { SIZES, SPACING, RADIUS } from '../theme';
import AppIcon from './AppIcon';

// Tiny global toast.
//   Toast.success(message, title?)
//   Toast.error(message, title?)
//   Toast.warning(message, title?)
//   Toast.info(message, title?)
// Mount <ToastHost /> once at the App root.

let _show = null;

export const Toast = {
    show: (opts) => _show && _show(opts),
    success: (message, title) => _show && _show({ type: 'success', title, message }),
    error:   (message, title) => _show && _show({ type: 'error', title, message }),
    warning: (message, title) => _show && _show({ type: 'warning', title, message }),
    info:    (message, title) => _show && _show({ type: 'info', title, message }),
};

const COLOR_MAP = {
    success: { accent: '#16A34A', tint: 'rgba(22, 163, 74, 0.12)', icon: 'check-circle' },
    error:   { accent: '#DC2626', tint: 'rgba(220, 38, 38, 0.12)',  icon: 'times-circle' },
    warning: { accent: '#F59E0B', tint: 'rgba(245, 158, 11, 0.14)', icon: 'exclamation-circle' },
    info:    { accent: '#2563EB', tint: 'rgba(37, 99, 235, 0.12)',  icon: 'info-circle' },
};

const HIDDEN_Y = 140; // off-screen offset for slide-in from bottom

export const ToastHost = () => {
    const [data, setData] = useState(null);
    const slide = useRef(new Animated.Value(HIDDEN_Y)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const timerRef = useRef(null);

    const animateOut = (after) => {
        Animated.parallel([
            Animated.timing(slide, { toValue: HIDDEN_Y, duration: 200, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        ]).start(() => {
            setData(null);
            after?.();
        });
    };

    useEffect(() => {
        _show = (opts = {}) => {
            const { type = 'info', title, message, duration = 2800 } = opts;
            setData({ ...opts, type, title, message });

            if (timerRef.current) clearTimeout(timerRef.current);

            Animated.parallel([
                Animated.spring(slide, { toValue: 0, tension: 80, friction: 11, useNativeDriver: true }),
                Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
            ]).start();

            timerRef.current = setTimeout(() => animateOut(), duration);
        };
        return () => { _show = null; };
    }, [slide, opacity]);

    if (!data) return null;
    const { accent, tint, icon } = COLOR_MAP[data.type] || COLOR_MAP.info;

    const hide = () => {
        if (timerRef.current) clearTimeout(timerRef.current);
        animateOut();
    };
    const handleAction = () => {
        hide();
        data.onAction?.();
    };

    return (
        <View pointerEvents="box-none" style={styles.wrapper}>
            <Animated.View
                style={[
                    styles.toast,
                    { opacity, transform: [{ translateY: slide }] },
                ]}
            >
                <View style={[styles.accentBar, { backgroundColor: accent }]} />
                <View style={[styles.iconCircle, { backgroundColor: tint }]}>
                    <AppIcon name={icon} size={18} color={accent} />
                </View>
                <View style={styles.body}>
                    {!!data.title && <Text style={styles.title} numberOfLines={1}>{data.title}</Text>}
                    {!!data.message && (
                        <Text
                            style={[styles.message, !data.title && styles.messageOnly]}
                            numberOfLines={3}
                        >
                            {data.message}
                        </Text>
                    )}
                </View>
                {!!data.actionLabel && !!data.onAction ? (
                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: accent }]}
                        onPress={handleAction}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.actionText}>{data.actionLabel}</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={styles.closeBtn}
                        onPress={hide}
                        activeOpacity={0.7}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <AppIcon name="times" size={14} color="#94A3B8" />
                    </TouchableOpacity>
                )}
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: Platform.OS === 'ios' ? 32 : 20,
        alignItems: 'center',
        zIndex: 9999,
        elevation: 14,
    },
    toast: {
        width: Math.min(Dimensions.get('window').width - SPACING.md * 2, 520),
        backgroundColor: '#FFFFFF',
        borderRadius: RADIUS.lg,
        paddingVertical: SPACING.md,
        paddingHorizontal: SPACING.md,
        paddingLeft: SPACING.md + 6, // room for the accent bar
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        borderWidth: 1,
        borderColor: 'rgba(15, 23, 42, 0.06)',
        overflow: 'hidden',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.18,
        shadowRadius: 24,
    },
    accentBar: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 4,
        borderTopLeftRadius: RADIUS.lg,
        borderBottomLeftRadius: RADIUS.lg,
    },
    iconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    body: { flex: 1, paddingRight: SPACING.xs },
    title: {
        color: '#0F172A',
        fontSize: SIZES.md,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    message: {
        color: '#475569',
        fontSize: SIZES.sm,
        fontWeight: '500',
        marginTop: 2,
        lineHeight: SIZES.sm + 6,
    },
    messageOnly: {
        color: '#0F172A',
        fontWeight: '600',
        marginTop: 0,
    },
    actionBtn: {
        borderRadius: RADIUS.md,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
    },
    actionText: {
        color: '#FFFFFF',
        fontSize: SIZES.xs,
        fontWeight: '900',
        letterSpacing: 0.4,
        textTransform: 'uppercase',
    },
    closeBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.04)',
    },
});

export default ToastHost;
