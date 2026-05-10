import React, { useState } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, TouchableOpacity, ScrollView,
} from 'react-native';
import { COLORS, SIZES, SPACING, RADIUS } from '../theme';
import AppIcon from '../components/AppIcon';

const VideoPlayer = ({ navigation, route }) => {
    const recording = route?.params?.recording || {};
    const [playing, setPlaying] = useState(false);
    const [progress, setProgress] = useState(0.35);

    const formatTime = (seconds) => {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const totalSeconds = 3600;
    const currentSeconds = Math.floor(totalSeconds * progress);

    return (
        <SafeAreaView style={styles.container}>
            {/* Video Area */}
            <View style={styles.videoArea}>
                <View style={styles.videoPlaceholder}>
                    <TouchableOpacity
                        style={styles.playPauseBtn}
                        onPress={() => setPlaying(!playing)}
                        activeOpacity={0.85}
                    >
                        <AppIcon name={playing ? 'pause' : 'play'} size={32} color={COLORS.white} />
                    </TouchableOpacity>
                </View>

                {/* Top Overlay */}
                <View style={styles.topOverlay}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Text style={styles.backIcon}>‹</Text>
                    </TouchableOpacity>
                    <View style={styles.topRight}>
                        <TouchableOpacity style={styles.overlayBtn}><AppIcon name="volume-up" size={18} color={COLORS.white} /></TouchableOpacity>
                        <TouchableOpacity style={styles.overlayBtn}><AppIcon name="expand" size={18} color={COLORS.white} /></TouchableOpacity>
                    </View>
                </View>

                {/* Progress Bar */}
                <View style={styles.progressArea}>
                    <Text style={styles.timeText}>{formatTime(currentSeconds)}</Text>
                    <TouchableOpacity style={styles.progressBar} activeOpacity={0.9}>
                        <View style={styles.progressBg}>
                            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
                            <View style={[styles.progressThumb, { left: `${progress * 100}%` }]} />
                        </View>
                    </TouchableOpacity>
                    <Text style={styles.timeText}>{recording.duration || '58:30'}</Text>
                </View>

                {/* Controls */}
                <View style={styles.videoControls}>
                    <TouchableOpacity style={styles.controlBtn}><AppIcon name="step-backward" size={20} color={COLORS.white} /></TouchableOpacity>
                    <TouchableOpacity style={styles.controlBtn}><AppIcon name="backward" size={20} color={COLORS.white} /></TouchableOpacity>
                    <TouchableOpacity style={[styles.controlBtn, styles.mainControlBtn]} onPress={() => setPlaying(!playing)}>
                        <AppIcon name={playing ? 'pause' : 'play'} size={28} color={COLORS.white} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.controlBtn}><AppIcon name="forward" size={20} color={COLORS.white} /></TouchableOpacity>
                    <TouchableOpacity style={styles.controlBtn}><AppIcon name="step-forward" size={20} color={COLORS.white} /></TouchableOpacity>
                </View>
            </View>

            {/* Info Panel */}
            <ScrollView style={styles.infoPanel} showsVerticalScrollIndicator={false}>
                <View style={styles.infoPanelContent}>
                    <Text style={styles.recTitle}>{recording.title || 'Calculus - Derivatives'}</Text>
                    <View style={styles.recBatchRow}>
                        <AppIcon name="book-open" size={12} color={COLORS.textGray} />
                        <Text style={styles.recBatch}>{recording.batch || 'Batch A - Mathematics'}</Text>
                    </View>

                    <View style={styles.metaRow}>
                        <View style={styles.metaItem}>
                            <AppIcon name="user" size={14} color={COLORS.textGray} />
                            <Text style={styles.metaText}>{recording.teacher || 'Prof. Sarah Johnson'}</Text>
                        </View>
                        <View style={styles.metaItem}>
                            <AppIcon name="calendar-alt" size={14} color={COLORS.textGray} />
                            <Text style={styles.metaText}>{recording.date || '20 Jan 2024'}</Text>
                        </View>
                        <View style={styles.metaItem}>
                            <AppIcon name="eye" size={14} color={COLORS.textGray} />
                            <Text style={styles.metaText}>{recording.views || 24} views</Text>
                        </View>
                    </View>

                    {/* Speed Control */}
                    <View style={styles.speedRow}>
                        <Text style={styles.speedLabel}>Playback Speed</Text>
                        <View style={styles.speedBtns}>
                            {['0.5x', '1x', '1.5x', '2x'].map(s => (
                                <TouchableOpacity
                                    key={s}
                                    style={[styles.speedBtn, s === '1x' && styles.speedBtnActive]}
                                >
                                    <Text style={[styles.speedBtnText, s === '1x' && styles.speedBtnTextActive]}>{s}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Actions */}
                    <View style={styles.actionRow}>
                        <TouchableOpacity style={styles.actionBtn}>
                            <AppIcon name="download" size={22} color={COLORS.textGray} />
                            <Text style={styles.actionBtnLabel}>Download</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn}>
                            <AppIcon name="share" size={22} color={COLORS.textGray} />
                            <Text style={styles.actionBtnLabel}>Share</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn}>
                            <AppIcon name="sticky-note" size={22} color={COLORS.textGray} />
                            <Text style={styles.actionBtnLabel}>Notes</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.actionBtn}>
                            <AppIcon name="star" size={22} color={COLORS.textGray} />
                            <Text style={styles.actionBtnLabel}>Bookmark</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0D0F1A' },
    videoArea: { backgroundColor: '#000', position: 'relative', aspectRatio: 16 / 9 },
    videoPlaceholder: {
        flex: 1, alignItems: 'center', justifyContent: 'center',
        backgroundColor: '#111827',
    },
    playPauseBtn: {
        width: 70, height: 70, borderRadius: 35,
        backgroundColor: COLORS.primary + 'CC',
        alignItems: 'center', justifyContent: 'center',
    },
    topOverlay: {
        position: 'absolute', top: 0, left: 0, right: 0,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: SPACING.md,
        backgroundColor: 'linear-gradient(to bottom, rgba(0,0,0,0.6), transparent)',
    },
    backBtn: { padding: SPACING.sm },
    backIcon: { fontSize: 32, color: COLORS.white, fontWeight: '300' },
    topRight: { flexDirection: 'row', gap: SPACING.sm },
    overlayBtn: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center', justifyContent: 'center',
    },
    progressArea: {
        position: 'absolute', bottom: 44, left: 0, right: 0,
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: SPACING.md, gap: SPACING.sm,
    },
    timeText: { color: COLORS.white, fontSize: SIZES.xs, fontWeight: '600', width: 36 },
    progressBar: { flex: 1, paddingVertical: SPACING.sm },
    progressBg: {
        height: 4, backgroundColor: 'rgba(255,255,255,0.3)',
        borderRadius: 2, position: 'relative',
    },
    progressFill: {
        height: '100%', backgroundColor: COLORS.primary, borderRadius: 2,
    },
    progressThumb: {
        position: 'absolute', top: -5,
        width: 14, height: 14, borderRadius: 7,
        backgroundColor: COLORS.primary, marginLeft: -7,
    },
    videoControls: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        flexDirection: 'row', justifyContent: 'center',
        alignItems: 'center', paddingBottom: SPACING.sm, gap: SPACING.base,
    },
    controlBtn: {
        width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
    },
    mainControlBtn: {
        width: 52, height: 52, borderRadius: 26,
        backgroundColor: COLORS.primary,
    },
    infoPanel: { flex: 1, backgroundColor: COLORS.dark },
    infoPanelContent: { padding: SPACING.base },
    recTitle: {
        fontSize: SIZES.xl, fontWeight: '800', color: COLORS.white,
        marginBottom: 6, marginTop: SPACING.sm,
    },
    recBatch: { fontSize: SIZES.sm, color: COLORS.textGray, flex: 1 },
    recBatchRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: SPACING.md },
    metaRow: { flexDirection: 'row', gap: SPACING.base, marginBottom: SPACING.lg },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: SIZES.xs, color: COLORS.textGray, fontWeight: '600' },
    speedRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: COLORS.darkCard, borderRadius: RADIUS.lg,
        padding: SPACING.md, marginBottom: SPACING.md,
    },
    speedLabel: { fontSize: SIZES.sm, color: COLORS.textGray, fontWeight: '600' },
    speedBtns: { flexDirection: 'row', gap: SPACING.sm },
    speedBtn: {
        paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
        borderRadius: RADIUS.full, backgroundColor: COLORS.darkSecondary,
        borderWidth: 1, borderColor: COLORS.darkBorder,
    },
    speedBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
    speedBtnText: { color: COLORS.textGray, fontSize: SIZES.sm, fontWeight: '600' },
    speedBtnTextActive: { color: COLORS.white },
    actionRow: {
        flexDirection: 'row', justifyContent: 'space-around',
        backgroundColor: COLORS.darkCard, borderRadius: RADIUS.lg, padding: SPACING.md,
    },
    actionBtn: { alignItems: 'center', gap: SPACING.xs },
    actionBtnLabel: { fontSize: SIZES.xs, color: COLORS.textGray, fontWeight: '600' },
});

export default VideoPlayer;
