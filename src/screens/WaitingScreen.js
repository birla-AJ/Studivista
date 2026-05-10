import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import io from 'socket.io-client';
import { SERVER_URL } from '../config';
import { SIZES, SPACING, RADIUS } from '../theme';
import { useTheme } from '../theme/ThemeContext';

// Student-side waiting room: connects to socket, sends request-join, waits.
// On approval, hands the live socket up to LiveClass via navigation params so the
// socketId stays stable across the room handoff.
const WaitingScreen = ({ navigation, route }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const { roomId, name, cls } = route.params || {};
    const socketRef = useRef(null);
    const handedOff = useRef(false);

    useEffect(() => {
        const socket = io(SERVER_URL, { transports: ['websocket'] });
        socketRef.current = socket;

        socket.on('connect', () => {
            socket.emit('request-join', { roomId, name });
        });

        socket.on('join-approved', () => {
            handedOff.current = true;
            navigation.replace('LiveClass', { socket, roomId, name, role: 'student', cls });
        });

        socket.on('join-rejected', () => {
            socket.disconnect();
            navigation.goBack();
        });

        return () => {
            if (!handedOff.current && socket.connected) socket.disconnect();
        };
    }, []);

    const handleCancel = () => {
        socketRef.current?.disconnect();
        navigation.goBack();
    };

    return (
        <View style={styles.container}>
            <Text style={styles.emoji}>⏳</Text>
            <Text style={styles.title}>Waiting for approval</Text>
            <Text style={styles.subtitle}>Your teacher will let you in soon</Text>
            <Text style={styles.info}>Class: {cls?.title || roomId}</Text>
            <Text style={styles.info}>You: {name}</Text>

            <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 30 }} />

            <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
                <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
        </View>
    );
};

const makeStyles = (colors) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg, justifyContent: 'center', alignItems: 'center', padding: SPACING.xxl },
    emoji: { fontSize: 56, marginBottom: SPACING.md },
    title: { color: colors.text, fontSize: SIZES.xxl, fontWeight: '900', marginBottom: SPACING.sm },
    subtitle: { color: colors.textMuted, fontSize: SIZES.md, textAlign: 'center', marginBottom: SPACING.lg },
    info: { color: colors.textMuted, fontSize: SIZES.sm, marginBottom: 4 },
    cancelBtn: {
        marginTop: SPACING.md, borderWidth: 1, borderColor: colors.border,
        paddingHorizontal: SPACING.xxl, paddingVertical: SPACING.md, borderRadius: RADIUS.full,
    },
    cancelText: { color: colors.textMuted, fontSize: SIZES.md },
});

export default WaitingScreen;
