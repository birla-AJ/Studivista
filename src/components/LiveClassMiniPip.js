import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { StackActions } from '@react-navigation/native';
import { RTCView } from 'react-native-webrtc';
import { RADIUS, SIZES, SPACING } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import { useLiveClassPip } from '../contexts/LiveClassPipContext';
import AppIcon from './AppIcon';

const CONTROL_HIDE_DELAY_MS = 2000;

const LiveClassMiniPip = ({ navigationRef }) => {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const { pipState } = useLiveClassPip();
  const [sizeScale, setSizeScale] = useState(1);
  const metrics = useMemo(
    () => getMetrics(width, height, sizeScale),
    [height, sizeScale, width],
  );
  const styles = useMemo(() => makeStyles(colors, metrics), [colors, metrics]);
  const [controlsVisible, setControlsVisible] = useState(false);
  const position = useRef(
    new Animated.ValueXY(metrics.initialPosition),
  ).current;
  const latestPosition = useRef(metrics.initialPosition);
  const dragStart = useRef(metrics.initialPosition);
  const hasMoved = useRef(false);
  const pinchStartDistance = useRef(null);
  const pinchStartScale = useRef(sizeScale);

  const openLiveClass = useCallback(() => {
    if (!navigationRef?.isReady?.()) return;
    setControlsVisible(false);
    navigationRef.dispatch(
      StackActions.popTo('LiveClass', pipState.routeParams || undefined),
    );
  }, [navigationRef, pipState.routeParams]);

  const showControls = useCallback(() => setControlsVisible(true), []);

  useEffect(() => {
    const clamped = clampPosition(latestPosition.current, metrics);
    latestPosition.current = clamped;
    dragStart.current = clamped;
    position.setValue(clamped);
  }, [metrics, position]);

  useEffect(() => {
    if (!pipState.active || !pipState.visible) {
      setControlsVisible(false);
      return undefined;
    }
    if (!controlsVisible) return undefined;
    const timer = setTimeout(
      () => setControlsVisible(false),
      CONTROL_HIDE_DELAY_MS,
    );
    return () => clearTimeout(timer);
  }, [controlsVisible, pipState.active, pipState.visible]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_event, gesture) =>
          gesture.numberActiveTouches >= 2 ||
          Math.abs(gesture.dx) > 5 ||
          Math.abs(gesture.dy) > 5,
        onMoveShouldSetPanResponderCapture: (_event, gesture) =>
          gesture.numberActiveTouches >= 2 ||
          Math.abs(gesture.dx) > 5 ||
          Math.abs(gesture.dy) > 5,
        onPanResponderGrant: event => {
          dragStart.current = latestPosition.current;
          hasMoved.current = false;
          pinchStartDistance.current = getTouchDistance(
            event.nativeEvent.touches,
          );
          pinchStartScale.current = sizeScale;
        },
        onPanResponderMove: (event, gesture) => {
          hasMoved.current = true;
          setControlsVisible(true);
          const pinchDistance = getTouchDistance(event.nativeEvent.touches);
          if (gesture.numberActiveTouches >= 2 && pinchDistance) {
            if (!pinchStartDistance.current) {
              pinchStartDistance.current = pinchDistance;
              pinchStartScale.current = sizeScale;
            }
            const nextScale =
              pinchStartScale.current *
              (pinchDistance / pinchStartDistance.current);
            setSizeScale(clamp(nextScale, 0.86, 1.36));
            return;
          }

          const next = clampPosition(
            {
              x: dragStart.current.x + gesture.dx,
              y: dragStart.current.y + gesture.dy,
            },
            metrics,
          );
          position.setValue(next);
        },
        onPanResponderRelease: (_event, gesture) => {
          const next = clampPosition(
            {
              x: dragStart.current.x + gesture.dx,
              y: dragStart.current.y + gesture.dy,
            },
            metrics,
          );
          const wasTap =
            !hasMoved.current &&
            Math.abs(gesture.dx) <= 5 &&
            Math.abs(gesture.dy) <= 5;
          if (wasTap) {
            showControls();
          } else {
            latestPosition.current = next;
            position.setValue(next);
          }
          pinchStartDistance.current = null;
        },
        onPanResponderTerminate: () => {
          position.setValue(latestPosition.current);
          hasMoved.current = false;
          pinchStartDistance.current = null;
        },
      }),
    [metrics, position, showControls, sizeScale],
  );

  if (!pipState.active || !pipState.visible) return null;

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <Animated.View
        style={[
          styles.cardWrap,
          { transform: position.getTranslateTransform() },
        ]}
        {...panResponder.panHandlers}
      >
        <View style={styles.card}>
          <View style={styles.videoWrap}>
            {pipState.streamURL ? (
              <RTCView
                streamURL={pipState.streamURL}
                style={styles.video}
                objectFit={pipState.fit || 'cover'}
                mirror={!!pipState.mirror}
                zOrder={0}
              />
            ) : (
              <View style={styles.fallback}>
                <AppIcon name="video" size={22} color="#FFFFFF" />
                <Text style={styles.fallbackText} numberOfLines={1}>
                  {pipState.placeholderText || 'You are live'}
                </Text>
              </View>
            )}
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
            <View style={styles.labelOverlay}>
              <Text style={styles.label} numberOfLines={1}>
                {pipState.label || pipState.placeholderText || 'You are live'}
              </Text>
            </View>
            <Pressable style={styles.tapTarget} onPress={showControls} />
            {controlsVisible && (
              <View pointerEvents="box-none" style={styles.controlsOverlay}>
                <Pressable
                  style={styles.closeControl}
                  onPress={() => setControlsVisible(false)}
                  hitSlop={12}
                >
                  <AppIcon
                    name="times"
                    size={14}
                    color="#FFFFFF"
                    solid={false}
                  />
                </Pressable>
                <Pressable
                  style={styles.fullscreenControl}
                  onPress={openLiveClass}
                  hitSlop={10}
                >
                  <AppIcon name="expand" size={16} color="#FFFFFF" />
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Animated.View>
    </View>
  );
};

const getMetrics = (width, height, sizeScale) => {
  const baseWidth = Math.min(220, Math.max(168, Math.round(width * 0.46)));
  const cardWidth = Math.min(
    Math.round(width * 0.74),
    Math.max(148, Math.round(baseWidth * sizeScale)),
  );
  const cardHeight = Math.round((cardWidth * 9) / 16);
  const margin = SPACING.md;
  const bottomDockOffset = 164;
  return {
    cardWidth,
    cardHeight,
    margin,
    maxX: Math.max(margin, width - cardWidth - margin),
    maxY: Math.max(margin, height - cardHeight - margin),
    initialPosition: {
      x: Math.max(margin, width - cardWidth - margin),
      y: Math.max(margin, height - cardHeight - bottomDockOffset),
    },
  };
};

const clampPosition = (point, metrics) => ({
  x: Math.min(metrics.maxX, Math.max(metrics.margin, point.x)),
  y: Math.min(metrics.maxY, Math.max(metrics.margin, point.y)),
});

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const getTouchDistance = touches => {
  if (!touches || touches.length < 2) return null;
  const [first, second] = touches;
  const dx = first.pageX - second.pageX;
  const dy = first.pageY - second.pageY;
  return Math.sqrt(dx * dx + dy * dy);
};

const makeStyles = (colors, metrics) => {
  return StyleSheet.create({
    overlay: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      zIndex: 9999,
      elevation: 9999,
    },
    cardWrap: {
      position: 'absolute',
      width: metrics.cardWidth,
      height: metrics.cardHeight,
    },
    card: {
      width: metrics.cardWidth,
      height: metrics.cardHeight,
      borderRadius: RADIUS.xs,
      overflow: 'hidden',
      backgroundColor: '#000000',
      elevation: 12,
      shadowColor: '#000000',
      shadowOpacity: 0.24,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
    },
    videoWrap: {
      width: '100%',
      height: '100%',
      backgroundColor: '#000000',
    },
    video: {
      width: '100%',
      height: '100%',
      backgroundColor: '#000000',
    },
    fallback: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: '#181A22',
    },
    fallbackText: {
      color: '#FFFFFF',
      fontSize: SIZES.xs,
      fontWeight: '800',
    },
    liveBadge: {
      position: 'absolute',
      top: 6,
      left: 6,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 7,
      paddingVertical: 3,
      borderRadius: RADIUS.full,
      backgroundColor: 'rgba(0,0,0,0.72)',
      zIndex: 5,
    },
    liveDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.danger,
    },
    liveText: {
      color: '#FFFFFF',
      fontSize: 9,
      fontWeight: '900',
    },
    labelOverlay: {
      position: 'absolute',
      left: 8,
      right: 8,
      bottom: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: RADIUS.sm,
      backgroundColor: 'rgba(0,0,0,0.58)',
      zIndex: 5,
    },
    label: {
      color: '#FFFFFF',
      fontSize: SIZES.xs,
      fontWeight: '800',
      textAlign: 'center',
    },
    tapTarget: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 6,
    },
    controlsOverlay: {
      ...StyleSheet.absoluteFillObject,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.20)',
      zIndex: 8,
    },
    closeControl: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 30,
      height: 30,
      //borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      //backgroundColor: 'rgba(0,0,0,0.26)',
    },
    fullscreenControl: {
      width: 40,
      height: 40,
      //   borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      //   backgroundColor: 'rgba(0,0,0,0.26)',
      // borderWidth: 1,
      //borderColor: 'rgba(255,255,255,0.18)',
    },
  });
};

export default LiveClassMiniPip;
