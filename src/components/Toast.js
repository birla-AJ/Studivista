import React, { useEffect, useRef, useState } from 'react';
import { Animated, Text, StyleSheet, Platform, View } from 'react-native';
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
    success: { bg: '#16A34A', icon: 'check-circle' },
    error:   { bg: '#DC2626', icon: 'times-circle' },
    warning: { bg: '#F59E0B', icon: 'exclamation-circle' },
    info:    { bg: '#2563EB', icon: 'info-circle' },
};

export const ToastHost = () => {
    const [data, setData] = useState(null);
    const slide = useRef(new Animated.Value(-120)).current;
    const opacity = useRef(new Animated.Value(0)).current;
    const timerRef = useRef(null);

    useEffect(() => {
        _show = ({ type = 'info', title, message, duration = 2500 }) => {
            setData({ type, title, message });

            if (timerRef.current) clearTimeout(timerRef.current);

            Animated.parallel([
                Animated.spring(slide, { toValue: 0, tension: 70, friction: 10, useNativeDriver: true }),
                Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
            ]).start();

            timerRef.current = setTimeout(() => {
                Animated.parallel([
                    Animated.timing(slide, { toValue: -120, duration: 180, useNativeDriver: true }),
                    Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
                ]).start(() => setData(null));
            }, duration);
        };
        return () => { _show = null; };
    }, [slide, opacity]);

    if (!data) return null;
    const { bg, icon } = COLOR_MAP[data.type] || COLOR_MAP.info;

    return (
        <Animated.View
            pointerEvents="none"
            style={[
                styles.toast,
                { backgroundColor: bg, opacity, transform: [{ translateY: slide }] },
            ]}
        >
            <AppIcon name={icon} size={20} color="#FFFFFF" />
            <View style={{ flex: 1 }}>
                {!!data.title && <Text style={styles.title}>{data.title}</Text>}
                {!!data.message && <Text style={styles.message}>{data.message}</Text>}
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    toast: {
        position: 'absolute',
        top: Platform.OS === 'ios' ? 50 : 24,
        left: SPACING.md, right: SPACING.md,
        borderRadius: RADIUS.lg,
        paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
        flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
        zIndex: 9999, elevation: 14,
        shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.25, shadowRadius: 12,
    },
    title: { color: '#FFFFFF', fontSize: SIZES.sm, fontWeight: '800', letterSpacing: 0.3 },
    message: { color: '#FFFFFF', fontSize: SIZES.xs, fontWeight: '600', marginTop: 2, lineHeight: 18 },
});

export default ToastHost;
