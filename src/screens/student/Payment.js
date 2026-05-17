import React, { useMemo, useState } from 'react';
import {
    View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, TextInput,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { SIZES, SPACING, RADIUS, SHADOWS } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';
import Header from '../../components/Header';
import AppIcon from '../../components/AppIcon';
import { Toast } from '../../components/Toast';
import { getCourseById, paletteForLevel, formatPrice } from '../../data/courses';

const METHODS = [
    { id: 'upi',     label: 'UPI',          sub: 'GPay, PhonePe, Paytm', icon: 'mobile-alt' },
    { id: 'card',    label: 'Card',         sub: 'Credit / Debit',       icon: 'credit-card' },
    { id: 'netbank', label: 'Net Banking',  sub: 'All major banks',      icon: 'university' },
    { id: 'wallet',  label: 'Wallet',       sub: 'Paytm, Amazon Pay',    icon: 'wallet' },
];

const Payment = ({ navigation, route }) => {
    const { colors } = useTheme();
    const styles = useMemo(() => makeStyles(colors), [colors]);
    const courseId = route.params?.courseId;
    const course = useMemo(() => getCourseById(courseId), [courseId]);
    const [method, setMethod] = useState('upi');
    const [promo, setPromo] = useState('');
    const [promoApplied, setPromoApplied] = useState(0);

    if (!course) {
        return (
            <SafeAreaView style={styles.container}>
                <Header title="Payment" showBack onBack={() => navigation.goBack()} />
                <View style={styles.notFound}>
                    <AppIcon name="exclamation-circle" size={32} color={colors.textMuted} />
                    <Text style={styles.notFoundText}>Course not found.</Text>
                </View>
            </SafeAreaView>
        );
    }

    const pal = paletteForLevel(course.level);
    const subtotal = course.price;
    const discount = course.originalPrice ? course.originalPrice - course.price : 0;
    const tax = Math.round(subtotal * 0.18);
    const total = subtotal + tax - promoApplied;

    const applyPromo = () => {
        const code = promo.trim().toUpperCase();
        if (!code) return;
        if (code === 'NEW10') {
            const amt = Math.round(subtotal * 0.1);
            setPromoApplied(amt);
            Toast.success(`${formatPrice(amt)} off applied`, 'Promo applied');
        } else {
            setPromoApplied(0);
            Toast.error('Try NEW10 for 10% off', 'Invalid code');
        }
    };

    const handlePay = () => {
        Toast.info('Payment gateway integration is coming soon', 'Demo mode');
    };

    return (
        <SafeAreaView style={styles.container}>
            <Header title="Checkout" subtitle="Secure payment" showBack onBack={() => navigation.goBack()} />

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ paddingBottom: 140 }}
                showsVerticalScrollIndicator={false}
            >
                {/* Order summary */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Order Summary</Text>
                    <View style={styles.orderCard}>
                        <View style={[styles.orderIcon, { backgroundColor: pal.tile }]}>
                            <AppIcon name={course.icon} size={22} color={pal.strong} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.orderTitle} numberOfLines={2}>{course.title}</Text>
                            <Text style={styles.orderSub} numberOfLines={1}>{course.instructor}</Text>
                            <View style={styles.orderMeta}>
                                <View style={[styles.orderTag, { backgroundColor: pal.tile }]}>
                                    <Text style={[styles.orderTagText, { color: pal.strong }]}>{course.type}</Text>
                                </View>
                                <View style={[styles.orderTag, { backgroundColor: pal.tile }]}>
                                    <Text style={[styles.orderTagText, { color: pal.strong }]}>{course.level}</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Promo */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Promo Code</Text>
                    <View style={styles.promoRow}>
                        <View style={styles.promoInputWrap}>
                            <AppIcon name="tag" size={12} color={colors.textMuted} />
                            <TextInput
                                style={styles.promoInput}
                                placeholder="Enter code (try NEW10)"
                                placeholderTextColor={colors.textMuted}
                                autoCapitalize="characters"
                                value={promo}
                                onChangeText={setPromo}
                            />
                        </View>
                        <TouchableOpacity style={styles.applyBtn} onPress={applyPromo} activeOpacity={0.85}>
                            <Text style={styles.applyBtnText}>Apply</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Payment methods */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Payment Method</Text>
                    {METHODS.map(m => {
                        const active = method === m.id;
                        return (
                            <TouchableOpacity
                                key={m.id}
                                style={[
                                    styles.methodCard,
                                    active && { borderColor: pal.rail, backgroundColor: pal.tile },
                                ]}
                                onPress={() => setMethod(m.id)}
                                activeOpacity={0.85}
                            >
                                <View style={[
                                    styles.methodIcon,
                                    { backgroundColor: active ? pal.rail : colors.surfaceSubtle },
                                ]}>
                                    <AppIcon name={m.icon} size={16} color={active ? '#FFFFFF' : colors.textMuted} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={[styles.methodLabel, active && { color: pal.strong }]}>{m.label}</Text>
                                    <Text style={styles.methodSub}>{m.sub}</Text>
                                </View>
                                <View style={[styles.radio, active && { borderColor: pal.rail }]}>
                                    {active && <View style={[styles.radioInner, { backgroundColor: pal.rail }]} />}
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Price breakdown */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Price Details</Text>
                    <View style={styles.breakdownCard}>
                        <Row label="Course price" value={formatPrice(course.originalPrice || subtotal)} />
                        {discount > 0 && (
                            <Row label="Course discount" value={`- ${formatPrice(discount)}`} valueColor="#16A34A" />
                        )}
                        <Row label="GST (18%)" value={formatPrice(tax)} />
                        {promoApplied > 0 && (
                            <Row label="Promo (NEW10)" value={`- ${formatPrice(promoApplied)}`} valueColor="#16A34A" />
                        )}
                        <View style={styles.breakdownDivider} />
                        <Row label="Total payable" value={formatPrice(total)} bold />
                    </View>
                </View>

                <View style={styles.assurance}>
                    <AppIcon name="lock" size={11} color={colors.textMuted} />
                    <Text style={styles.assuranceText}>
                        Payments are 256-bit encrypted. Your card details are never stored on our servers.
                    </Text>
                </View>
            </ScrollView>

            {/* Sticky pay button */}
            <View style={styles.payBar}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.payLabel}>Total payable</Text>
                    <Text style={styles.payAmount}>{formatPrice(total)}</Text>
                </View>
                <TouchableOpacity
                    onPress={handlePay}
                    activeOpacity={0.9}
                    style={styles.payBtnShadow}
                >
                    <LinearGradient
                        colors={pal.gradient}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.payBtn}
                    >
                        <AppIcon name="lock" size={13} color="#FFFFFF" />
                        <Text style={styles.payBtnText}>Pay {formatPrice(total)}</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

const Row = ({ label, value, valueColor, bold }) => {
    const { colors } = useTheme();
    return (
        <View style={rowStyles.row}>
            <Text style={[rowStyles.label, { color: bold ? colors.text : colors.textMuted, fontWeight: bold ? '900' : '600' }]}>
                {label}
            </Text>
            <Text style={[rowStyles.value, {
                color: valueColor || (bold ? colors.text : colors.text),
                fontWeight: bold ? '900' : '700',
                fontSize: bold ? SIZES.md : SIZES.sm,
            }]}>
                {value}
            </Text>
        </View>
    );
};

const rowStyles = StyleSheet.create({
    row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
    label: { fontSize: SIZES.sm },
    value: {},
});

const makeStyles = colors => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.md },
    notFoundText: { color: colors.textMuted, fontSize: SIZES.sm },

    section: { paddingHorizontal: SPACING.base, marginTop: SPACING.base },
    sectionTitle: { fontSize: SIZES.sm, fontWeight: '900', color: colors.text, marginBottom: SPACING.sm, letterSpacing: 0.2, textTransform: 'uppercase' },

    orderCard: {
        flexDirection: 'row', gap: SPACING.md,
        backgroundColor: colors.surface, borderRadius: RADIUS.lg,
        padding: SPACING.md,
        borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
        ...SHADOWS.small,
    },
    orderIcon: { width: 52, height: 52, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
    orderTitle: { color: colors.text, fontSize: SIZES.md, fontWeight: '900' },
    orderSub: { color: colors.textMuted, fontSize: SIZES.xs, marginTop: 2 },
    orderMeta: { flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' },
    orderTag: { paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.full },
    orderTagText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.3 },

    promoRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
    promoInputWrap: {
        flex: 1, height: 48,
        flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
        backgroundColor: colors.inputBg, borderRadius: RADIUS.md,
        paddingHorizontal: SPACING.md,
        borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    },
    promoInput: { flex: 1, color: colors.text, fontSize: SIZES.sm, fontWeight: '700' },
    applyBtn: {
        backgroundColor: colors.text,
        paddingHorizontal: SPACING.lg, height: 48,
        borderRadius: RADIUS.md,
        alignItems: 'center', justifyContent: 'center',
    },
    applyBtnText: { color: colors.bg, fontSize: SIZES.sm, fontWeight: '900', letterSpacing: 0.3 },

    methodCard: {
        flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
        backgroundColor: colors.surface, borderRadius: RADIUS.lg,
        padding: SPACING.md, marginBottom: SPACING.sm,
        borderWidth: 1.5, borderColor: colors.border,
    },
    methodIcon: { width: 40, height: 40, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
    methodLabel: { color: colors.text, fontSize: SIZES.md, fontWeight: '800' },
    methodSub: { color: colors.textMuted, fontSize: SIZES.xs, marginTop: 1 },
    radio: {
        width: 22, height: 22, borderRadius: 11,
        borderWidth: 2, borderColor: colors.border,
        alignItems: 'center', justifyContent: 'center',
    },
    radioInner: { width: 10, height: 10, borderRadius: 5 },

    breakdownCard: {
        backgroundColor: colors.surface, borderRadius: RADIUS.lg,
        padding: SPACING.md,
        borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
    },
    breakdownDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: SPACING.sm },

    assurance: {
        flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
        paddingHorizontal: SPACING.base, marginTop: SPACING.base,
    },
    assuranceText: { flex: 1, color: colors.textMuted, fontSize: 10, fontWeight: '600', lineHeight: 15 },

    payBar: {
        position: 'absolute', left: 0, right: 0, bottom: 0,
        flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
        paddingHorizontal: SPACING.base,
        paddingTop: SPACING.md,
        paddingBottom: SPACING.base + 8,
        backgroundColor: colors.surface,
        borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.border,
        ...SHADOWS.medium,
    },
    payLabel: { color: colors.textMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
    payAmount: { color: colors.text, fontSize: SIZES.xxl, fontWeight: '900' },
    payBtnShadow: {
        borderRadius: RADIUS.full,
        ...SHADOWS.small,
    },
    payBtn: {
        flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
        paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md,
        borderRadius: RADIUS.full,
    },
    payBtnText: { color: '#FFFFFF', fontSize: SIZES.sm, fontWeight: '900', letterSpacing: 0.3 },
});

export default Payment;
