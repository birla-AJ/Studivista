import { Dimensions, Platform } from 'react-native';

// Responsive scale: tokens grow/shrink based on the device's shorter side.
// Clamped so tablets don't blow up (1.3x cap) and tiny phones don't crush (0.85x floor).
const { width: _w, height: _h } = Dimensions.get('window');
const _shortSide = Math.min(_w, _h);
const _BASE = 390;
const _ratio = Math.min(Math.max(_shortSide / _BASE, 0.85), 1.3);
const _s = (n) => Math.round(n * _ratio);

// Brand & status colors — identical in both themes
const BRAND = {
    primary: '#F2A636',
    primaryLight: '#F8C171',
    primaryDark: '#D88E1A',
    secondary: '#1A1F4D',
    secondaryLight: '#3D447A',
    accent: '#FFB347',
    success: '#16A34A',
    warning: '#F59E0B',
    danger: '#DC2626',
    info: '#2563EB',
    live: '#DC2626',
    online: '#16A34A',
    offline: '#9CA3AF',
    busy: '#F59E0B',
    adminColor: '#F2A636',
    teacherColor: '#1A1F4D',
    studentColor: '#16A34A',
};

const lightColors = {
    ...BRAND,
    bg: '#FAF8F1',
    surface: '#FFFFFF',
    surfaceElevated: '#FFFFFF',
    surfaceSubtle: '#F4F1E8',
    border: '#E8E5DD',
    borderStrong: '#CFC9BC',
    text: '#1A1F4D',
    textMuted: '#6B7280',
    textInverted: '#FFFFFF',
    inputBg: '#FFFFFF',
    headerBg: '#FFFFFF',
    overlay: 'rgba(26, 31, 77, 0.5)',
};

const darkColors = {
    ...BRAND,
    bg: '#0B0B0F',
    surface: '#1A1A1A',
    surfaceElevated: '#242424',
    surfaceSubtle: '#111114',
    border: '#2A2A2A',
    borderStrong: '#3D3D3D',
    text: '#FFFFFF',
    textMuted: '#A1A1AA',
    textInverted: '#0B0B0F',
    inputBg: '#1F1F1F',
    headerBg: '#0B0B0F',
    overlay: 'rgba(0, 0, 0, 0.7)',
    // Neutral light gray accents — keeps secondary/teacher chips readable on near-black surfaces
    secondary: '#A1A1AA',
    secondaryLight: '#D4D4D8',
    teacherColor: '#A1A1AA',
};

export const themes = { light: lightColors, dark: darkColors };

// Backwards-compat: legacy COLORS export.
// Used by screens that haven't been migrated to useTheme yet — they keep the old dark look.
export const COLORS = {
    ...darkColors,
    // Old keys kept for compatibility
    dark: darkColors.bg,
    darkCard: darkColors.surface,
    darkSecondary: darkColors.surfaceElevated,
    darkBorder: darkColors.border,
    darkElevated: darkColors.surfaceElevated,
    white: '#FFFFFF',
    lightBg: lightColors.bg,
    lightCard: lightColors.surface,
    lightBorder: lightColors.border,
    textDark: '#1A1F4D',
    textGray: darkColors.textMuted,
    textLight: '#FFFFFF',
};

export const SIZES = {
    xs: _s(10), sm: _s(12), md: _s(14), base: _s(16), lg: _s(18),
    xl: _s(20), xxl: _s(24), xxxl: _s(32), title: _s(28),
};

export const FONT = {
    family: Platform.select({
        android: 'sans-serif',
        ios: 'System',
        default: undefined,
    }),
    regular: '400',
    medium: '600',
    bold: '800',
    heavy: '900',
};

export const TEXT_DEFAULTS = {
    fontFamily: FONT.family,
    includeFontPadding: false,
};

export const SPACING = {
    xs: _s(4), sm: _s(8), md: _s(12), base: _s(16),
    lg: _s(20), xl: _s(24), xxl: _s(32), xxxl: _s(40),
};

export const RADIUS = {
    xs: _s(4), sm: _s(8), md: _s(12), lg: _s(16),
    xl: _s(24), xxl: _s(32), full: 999,
};

// Helper for screens that need to scale arbitrary values.
export const scale = _s;
export const screen = { width: _w, height: _h, shortSide: _shortSide };

export const SHADOWS = {
    small: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 3 },
    medium: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 6 },
    primary: { shadowColor: BRAND.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 14, elevation: 8 },
    secondary: { shadowColor: BRAND.secondary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 14, elevation: 8 },
};
